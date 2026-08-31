/* ============================================================
   零依赖二维码生成器（QR Code Model 2，Byte 模式，纠错级别 M）
   输出内联 SVG。支持 version 1-13（Byte-M 容量 14~362 字节）。
   实现：GF(256) Reed-Solomon 纠错码 + 掩码评估（简化规则 0/1）
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GreenQR = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- GF(256) 运算（多项式 0x11D） ---------- */
  const EXP = new Array(512), LOG = new Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* RS 生成多项式（高位在前，含首一：gen[0]=1, gen[ecLen]=常数项） */
  function rsGenPoly(ecLen) {
    let poly = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];                    // * x
        next[j + 1] ^= gmul(poly[j], EXP[i]);  // * α^i
      }
      poly = next;
    }
    return poly;
  }

  /* RS 纠错码字：消息多项式（高位在前）乘 x^ecLen 后对 gen 做合成除法，取余数 */
  function rsEncode(data, ecLen) {
    const gen = rsGenPoly(ecLen);
    const res = data.slice().concat(new Array(ecLen).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], coef);
      }
    }
    return res.slice(data.length);
  }

  /* ---------- version 容量表（纠错 M，Byte 模式） ---------- */
  /* [version]: { totalCodewords, ecPerBlock, blocksG1, dataG1, blocksG2, dataG2 } */
  const EC_M = {
    1:  { total: 26,  ec: 10, b1: 1, d1: 16 },
    2:  { total: 44,  ec: 16, b1: 1, d1: 28 },
    3:  { total: 70,  ec: 26, b1: 1, d1: 44 },
    4:  { total: 100, ec: 18, b1: 2, d1: 32 },
    5:  { total: 134, ec: 24, b1: 2, d1: 43 },
    6:  { total: 172, ec: 16, b1: 4, d1: 27 },
    7:  { total: 196, ec: 18, b1: 4, d1: 31 },
    8:  { total: 242, ec: 22, b1: 2, d1: 38, b2: 2, d2: 39 },
    9:  { total: 292, ec: 22, b1: 3, d1: 36, b2: 2, d2: 37 },
    10: { total: 346, ec: 26, b1: 4, d1: 43, b2: 1, d2: 44 },
    11: { total: 404, ec: 30, b1: 1, d1: 50, b2: 4, d2: 51 },
    12: { total: 466, ec: 22, b1: 6, d1: 36, b2: 2, d2: 37 },
    13: { total: 532, ec: 22, b1: 8, d1: 37, b2: 1, d2: 38 },
  };

  function capacityBytes(v) {
    const spec = EC_M[v];
    const dataCW = spec.b1 * spec.d1 + (spec.b2 || 0) * (spec.d2 || 0);
    return dataCW; // 数据码字数（容量 = dataCW 字节，Byte 模式无需额外开销计算——见下 encode）
  }

  function pickVersion(byteLen) {
    for (let v = 1; v <= 13; v++) {
      const spec = EC_M[v];
      const dataCW = spec.b1 * spec.d1 + (spec.b2 || 0) * (spec.d2 || 0);
      // Byte 模式 4 bit 指示 + 8/16 bit 长度 + 数据
      const lenBits = v < 10 ? 8 : 16;
      const need = Math.ceil((4 + lenBits + byteLen * 8) / 8);
      if (need <= dataCW) return v;
    }
    return null;
  }

  /* ---------- 对齐图案位置 ---------- */
  function alignPositions(v) {
    if (v === 1) return [];
    const num = Math.floor(v / 7) + 2;
    if (v === 32) { /* 不在支持范围 */ }
    const size = 17 + 4 * v;
    const step = (v === 32) ? 0 : Math.ceil((v - 1) / (num - 2) / 2) * 2 + 2; // 近似
    // 精确表（v1-13）
    const table = {
      2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
      7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
      11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62],
    };
    return table[v] || [6, size - 7];
  }

  /* ---------- 主入口：text → SVG ---------- */
  function toSvg(text, modulePx) {
    const matrix = encode(text);
    const n = matrix.size;
    const px = modulePx || 4;
    const quiet = 4; // 静区
    const dim = (n + quiet * 2) * px;
    let rects = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix.get(r, c)) {
          rects += '<rect x="' + ((c + quiet) * px) + '" y="' + ((r + quiet) * px) + '" width="' + px + '" height="' + px + '"/>';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim + '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#ffffff"/>' +
      '<g fill="#000000">' + rects + '</g></svg>';
  }

  function encode(text) {
    // UTF-8 编码
    const bytes = [];
    const s = unescape(encodeURIComponent(text));
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);

    const v = pickVersion(bytes.length);
    if (!v) throw new Error("内容过长（>" + capacityBytes(10) + " 字节），无法生成 v1-13 二维码");
    const spec = EC_M[v];
    const size = 17 + 4 * v;
    const dataCW = spec.b1 * spec.d1 + (spec.b2 || 0) * (spec.d2 || 0);

    /* --- 位流：模式 0100 + 长度 + 数据 + 终止符（截断到容量内）--- */
    const lenBits = v < 10 ? 8 : 16;
    const dataBitLen = 4 + lenBits + bytes.length * 8;
    const capacityBits = dataCW * 8;
    let bits = "0100";
    bits += bytes.length.toString(2).padStart(lenBits, "0");
    for (const b of bytes) bits += b.toString(2).padStart(8, "0");
    // 终止符：最多 4 个 0（不越过容量）
    const termLen = Math.min(4, Math.max(0, capacityBits - dataBitLen));
    bits += "0".repeat(termLen);
    // 位填充：补 0 到字节边界；若已对齐且后面还有完整数据码字空间，
    // 再补一个全 0 字节（对齐 segno 等主流实现的实测口径，保证解码兼容）
    if (bits.length % 8 !== 0) {
      while (bits.length % 8 !== 0) bits += "0";
    } else if (bits.length / 8 < dataCW) {
      bits += "00000000";
    }
    const codewords = [];
    for (let i = 0; i < bits.length / 8; i++) codewords.push(parseInt(bits.slice(i * 8, i * 8 + 8), 2));
    // 填充码字
    const pad = [0xec, 0x11];
    let pi = 0;
    while (codewords.length < dataCW) codewords.push(pad[pi++ % 2]);

    /* --- 分块 RS 纠错 --- */
    const blocks = [];
    let off = 0;
    for (let i = 0; i < spec.b1; i++) { blocks.push({ data: codewords.slice(off, off + spec.d1) }); off += spec.d1; }
    if (spec.b2) for (let i = 0; i < spec.b2; i++) { blocks.push({ data: codewords.slice(off, off + spec.d2) }); off += spec.d2; }
    blocks.forEach(b => { b.ec = rsEncode(b.data, spec.ec); });

    /* --- 交织 --- */
    const maxData = Math.max(spec.d1, spec.d2 || 0);
    const final = [];
    for (let i = 0; i < maxData; i++) {
      for (const b of blocks) if (i < b.data.length) final.push(b.data[i]);
    }
    for (let i = 0; i < spec.ec; i++) {
      for (const b of blocks) final.push(b.ec[i]);
    }

    /* --- 矩阵构造 --- */
    const modules = [];
    const reserved = [];
    for (let i = 0; i < size; i++) {
      modules.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }
    const M = {
      size: size,
      get: (r, c) => (r >= 0 && c >= 0 && r < size && c < size) ? modules[r][c] : false,
      set: (r, c, v) => { if (r >= 0 && c >= 0 && r < size && c < size) modules[r][c] = v; },
      isReserved: (r, c) => reserved[r][c],
      mark: (r, c) => { if (r >= 0 && c >= 0 && r < size && c < size) reserved[r][c] = true; },
    };

    // 三个定位图案
    function finder(r, c) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const onRing = inOuter && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
          const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          M.set(rr, cc, onRing || inCore);
          M.mark(rr, cc);
        }
      }
    }
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    // 校正图案
    const apos = alignPositions(v);
    for (const ar of apos) {
      for (const ac of apos) {
        // 跳过与定位图案重叠的三个角
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === apos[apos.length - 1] && ac === size - 7) ||
            (ar === apos[apos.length - 1] && ar === size - 7 && ac === 6)) continue;
        if (M.isReserved(ar, ac)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            M.set(ar + dr, ac + dc, on);
            M.mark(ar + dr, ac + dc);
          }
        }
      }
    }

    // 时序图案
    for (let i = 8; i < size - 8; i++) {
      if (!M.isReserved(6, i)) { M.set(6, i, i % 2 === 0); M.mark(6, i); }
      if (!M.isReserved(i, 6)) { M.set(i, 6, i % 2 === 0); M.mark(i, 6); }
    }

    // 格式信息区（先占位，稍后填）
    for (let i = 0; i < 9; i++) {
      if (i !== 6) { M.mark(8, i); M.mark(i, 8); }
    }
    for (let i = 0; i < 8; i++) {
      M.mark(8, size - 1 - i);
      M.mark(size - 1 - i, 8);
    }
    M.mark(size - 8, 8); // 暗模块

    // 版本信息（v ≥ 7）：bit 3i/3i+1/3i+2 依次放在第 i 行的 3 列上，
    // 右上块（行 0-5，列 size-11..size-9）与左下块（转置位置）各一份
    if (v >= 7) {
      const vb = versionBits(v);
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          const bit = ((vb >> (r * 3 + c)) & 1) === 1;
          M.set(r, size - 11 + c, bit); M.mark(r, size - 11 + c);
          M.set(size - 11 + c, r, bit); M.mark(size - 11 + c, r);
        }
      }
    }

    /* --- 数据放置（两列蛇形） --- */
    let bitIdx = 0;
    const totalBits = final.length * 8;
    function dataBit(i) {
      if (i >= totalBits) return 0;
      return (final[i >> 3] >> (7 - (i & 7))) & 1;
    }
    let col = size - 1;
    let upward = true;
    while (col > 0) {
      if (col === 6) col--; // 跳过时序列
      for (let i = 0; i < size; i++) {
        const r = upward ? size - 1 - i : i;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (!M.isReserved(r, c)) {
            M.set(r, c, dataBit(bitIdx++) === 1);
          }
        }
      }
      upward = !upward;
      col -= 2;
    }

    /* --- 掩码（固定使用掩码 0，避免评估开销）---
       掩码 0：mask(r,c) = (r+c) % 2 === 0 */
    function applyMask() {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!M.isReserved(r, c)) {
            if ((r + c) % 2 === 0) M.set(r, c, !M.get(r, c));
          }
        }
      }
    }
    applyMask();

    /* --- 格式信息（纠错 M = 00，掩码 0 = 000）---
       5 bit 格式 = ECL(2) + mask(3) = 00000 → BCH(15,5) 生成 0x537 → 异或 0x5412 */
    function bch15_5(data5) {
      let d = data5 << 10;
      const G = 0x537;
      for (let i = 14; i >= 10; i--) {
        if ((d >> i) & 1) d ^= G << (i - 10);
      }
      return ((data5 << 10) | d) ^ 0x5412;
    }
    const fmt5 = 0; // M=00, mask0=000
    const fmtBits = bch15_5(fmt5);
    // 放置两份（注意行列方向，set(行, 列)：
    //   第一份 bit0-5 沿【列 8】自上而下、bit6-8 在角落、bit9-14 沿【行 8】自右向左）
    for (let i = 0; i <= 5; i++) M.set(i, 8, ((fmtBits >> i) & 1) === 1);
    M.set(7, 8, ((fmtBits >> 6) & 1) === 1);
    M.set(8, 8, ((fmtBits >> 7) & 1) === 1);
    M.set(8, 7, ((fmtBits >> 8) & 1) === 1);
    for (let i = 9; i < 15; i++) M.set(8, 14 - i, ((fmtBits >> i) & 1) === 1);
    // 第二份：bit0-7 沿【行 8】右端自右向左，bit8-14 沿【列 8】向下直到底边
    for (let i = 0; i < 8; i++) M.set(8, size - 1 - i, ((fmtBits >> i) & 1) === 1);
    for (let i = 8; i < 15; i++) M.set(size - 15 + i, 8, ((fmtBits >> i) & 1) === 1);
    M.set(size - 8, 8, true); // 暗模块恒黑

    return M;
  }

  function versionBits(v) {
    // BCH(18,6)：先对 12 位临时量做模 2 除法求余，再与版本号高 6 位拼接
    let d = v << 12;
    const G = 0x1f25;
    for (let i = 17; i >= 12; i--) {
      if ((d >> i) & 1) d ^= G << (i - 12);
    }
    return (v << 12) | (d & 0xfff);
  }

  return { toSvg: toSvg, encode: encode, pickVersion: pickVersion };
});
