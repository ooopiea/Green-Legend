/* ============================================================
   《绿神话》舞台页场景库（剧场式 UI 专用）
   只做一件事：月份/步骤/状态 → 完整 SVG 字符串。
   - viewBox 0 0 800 450（16:9），preserveAspectRatio="xMidYMid slice" 铺满裁切
   - 风格：简笔扁平，青玉深浅渐变天空，远景 opacity .5 浅色营造景深
   - 动画全部走 class + stage-theater.css 的 keyframes（零 JS 驱动）
   另导出 ICON（24×24 stroke 图标，currentColor）与 MONTH_TINT（观战页联动色）
   ============================================================ */

(function (root) {
  "use strict";

  const VB = "0 0 800 450";

  /* ---------- 通用部件（PARTS）---------- */
  // 每个部件返回 SVG 片段字符串；坐标为 viewBox 单位，s 为缩放
  const P = {
    sky(top, bot, id) {
      const gid = "sky-" + (id || top.replace("#", ""));
      return '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bot + '"/>'
        + '</linearGradient></defs>'
        + '<rect width="800" height="450" fill="url(#' + gid + ')"/>';
    },
    ground(color, y) {
      const gy = y == null ? 360 : y;
      return '<rect x="0" y="' + gy + '" width="800" height="' + (450 - gy) + '" fill="' + color + '"/>'
        + '<line x1="0" y1="' + gy + '" x2="800" y2="' + gy + '" stroke="rgba(255,255,255,.12)" stroke-width="2"/>';
    },
    cloud(x, y, s, cls) {
      return '<g class="cloud' + (cls ? " " + cls : "") + '" transform="translate(' + x + "," + y + ') scale(' + s + ')">'
        + '<ellipse cx="0" cy="0" rx="52" ry="20" fill="rgba(255,255,255,.16)"/>'
        + '<ellipse cx="-30" cy="8" rx="30" ry="13" fill="rgba(255,255,255,.13)"/>'
        + '<ellipse cx="28" cy="6" rx="34" ry="15" fill="rgba(255,255,255,.13)"/></g>';
    },
    stormCloud(x, y, s) {
      return '<g class="cloud storm" transform="translate(' + x + "," + y + ') scale(' + s + ')">'
        + '<ellipse cx="0" cy="0" rx="60" ry="24" fill="rgba(30,40,48,.85)"/>'
        + '<ellipse cx="-36" cy="10" rx="34" ry="16" fill="rgba(30,40,48,.8)"/>'
        + '<ellipse cx="34" cy="8" rx="38" ry="18" fill="rgba(30,40,48,.8)"/></g>';
    },
    sun(x, y, r) {
      return '<g class="sun" transform="translate(' + x + "," + y + ')">'
        + '<g class="sun-rays">'
        + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) {
            const rad = a * Math.PI / 180, r1 = (r || 46) + 10, r2 = (r || 46) + 26;
            return '<line x1="' + (Math.cos(rad) * r1).toFixed(1) + '" y1="' + (Math.sin(rad) * r1).toFixed(1)
              + '" x2="' + (Math.cos(rad) * r2).toFixed(1) + '" y2="' + (Math.sin(rad) * r2).toFixed(1)
              + '" stroke="#d4a017" stroke-width="5" stroke-linecap="round"/>';
          }).join("")
        + '</g>'
        + '<circle r="' + (r || 46) + '" fill="#d4a017"/>'
        + '<circle r="' + ((r || 46) - 12) + '" fill="#e8bd3f"/></g>';
    },
    // 厂房（w 宽 h 高），chimney=烟囱数量，smoke=是否冒烟
    factory(x, y, w, h, chimney, smoke) {
      let out = '<g transform="translate(' + x + "," + y + ')">'
        + '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#24352f" stroke="#3a5449" stroke-width="3"/>'
        + '<path d="M0,0 L' + (w * 0.16) + ',-26 L' + (w * 0.34) + ',-26 L' + (w * 0.5) + ',0 L' + (w * 0.68) + ',-26 L' + (w * 0.86) + ',-26 L' + w + ',0 Z" fill="#2b433a"/>'
        + '<rect x="' + (w * 0.12) + '" y="' + (h * 0.35) + '" width="' + (w * 0.16) + '" height="' + (h * 0.3) + '" fill="#8fb8a8" opacity=".5"/>'
        + '<rect x="' + (w * 0.42) + '" y="' + (h * 0.35) + '" width="' + (w * 0.16) + '" height="' + (h * 0.3) + '" fill="#8fb8a8" opacity=".5"/>'
        + '<rect x="' + (w * 0.72) + '" y="' + (h * 0.35) + '" width="' + (w * 0.14) + '" height="' + (h * 0.3) + '" fill="#8fb8a8" opacity=".5"/>';
      for (let i = 0; i < (chimney || 0); i++) {
        const cx = w * (0.18 + i * 0.28);
        out += '<rect x="' + (cx - 8) + '" y="-52" width="16" height="52" fill="#31473d"/>'
          + '<rect x="' + (cx - 11) + '" y="-56" width="22" height="8" fill="#3d574b"/>';
        if (smoke) {
          out += '<g class="smoke" transform="translate(' + cx + ',-58)">'
            + '<circle class="puff p1" r="9" fill="rgba(200,210,205,.5)"/>'
            + '<circle class="puff p2" r="12" fill="rgba(200,210,205,.4)"/>'
            + '<circle class="puff p3" r="7" fill="rgba(200,210,205,.45)"/></g>';
        }
      }
      return out + "</g>";
    },
    // 斜面光伏板（cls 可为 "shake" / "glow"）
    pvPanel(x, y, s, cls) {
      return '<g class="pv' + (cls ? " " + cls : "") + '" transform="translate(' + x + "," + y + ') scale(' + (s || 1) + ')">'
        + '<line x1="-26" y1="18" x2="-14" y2="2" stroke="#3d574b" stroke-width="4"/>'
        + '<line x1="26" y1="18" x2="14" y2="2" stroke="#3d574b" stroke-width="4"/>'
        + '<polygon points="-30,0 30,-8 30,8 -30,14" fill="#1d5c74"/>'
        + '<line x1="-10,-1.7" y1="0" x2="-10" y2="11.7" stroke="#2f7d9c" stroke-width="2"/>'
        + '<line x1="10" y1="-4.3" x2="10" y2="9" stroke="#2f7d9c" stroke-width="2"/>'
        + '<line x1="-30,7" x2="30,-" y2="0" stroke="none"/></g>';
    },
    pvRow(x, y, n, gap, cls) {
      let out = "";
      for (let i = 0; i < n; i++) out += P.pvPanel(x + i * (gap || 64), y, 1, cls);
      return out;
    },
    tree(x, y, s) {
      return '<g transform="translate(' + x + "," + y + ') scale(' + (s || 1) + ')">'
        + '<rect x="-3" y="-8" width="6" height="18" fill="#4a3626"/>'
        + '<circle cx="0" cy="-18" r="14" fill="#2f7d5b"/>'
        + '<circle cx="-10" cy="-12" r="9" fill="#286b4e"/>'
        + '<circle cx="10" cy="-12" r="9" fill="#286b4e"/></g>';
    },
    battery(x, y, s) {
      return '<g transform="translate(' + x + "," + y + ') scale(' + (s || 1) + ')">'
        + '<rect x="-16" y="-22" width="32" height="44" rx="4" fill="#24352f" stroke="#58c9a9" stroke-width="3"/>'
        + '<rect x="-6" y="-28" width="12" height="6" rx="2" fill="#58c9a9"/>'
        + '<rect x="-9" y="-12" width="6" height="14" fill="#58c9a9"/>'
        + '<rect x="-1" y="-12" width="6" height="14" fill="#58c9a9" opacity=".6"/>'
        + '<rect x="7" y="-12" width="0" height="14" fill="#58c9a9"/></g>';
    },
    charger(x, y, s, twoWay) {
      const col = twoWay ? "#e8bd3f" : "#58c9a9";
      return '<g transform="translate(' + x + "," + y + ') scale(' + (s || 1) + ')">'
        + '<rect x="-12" y="-26" width="24" height="46" rx="4" fill="#24352f" stroke="' + col + '" stroke-width="3"/>'
        + '<rect x="-6" y="-18" width="12" height="14" rx="2" fill="' + col + '" opacity=".8"/>'
        + (twoWay ? '<path d="M-3,8 L3,2 L3,6 L-3,12 Z" fill="' + col + '"/>' : '<rect x="-3" y="6" width="6" height="8" fill="' + col + '"/>')
        + "</g>";
    },
    coin(x, y, s) {
      return '<g class="coin" transform="translate(' + x + "," + y + ') scale(' + (s || 1) + ')">'
        + '<circle r="11" fill="#d4a017"/><circle r="7" fill="#e8bd3f"/>'
        + '<text y="4" text-anchor="middle" font-size="10" fill="#8a6a0a" font-weight="700">¥</text></g>';
    },
    virus(x, y, s, cls) {
      let spikes = "";
      for (let i = 0; i < 6; i++) {
        const a = i * 60 * Math.PI / 180;
        const x1 = Math.cos(a) * 12, y1 = Math.sin(a) * 12, x2 = Math.cos(a) * 20, y2 = Math.sin(a) * 20;
        spikes += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1)
          + '" stroke="#ff7b6b" stroke-width="3.5" stroke-linecap="round"/><circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="3" fill="#ff7b6b"/>';
      }
      return '<g class="virus' + (cls ? " " + cls : "") + '" transform="translate(' + x + "," + y + ') scale(' + (s || 1) + ')">'
        + spikes + '<circle r="12" fill="#c0392b"/><circle r="6" fill="#e05a4c"/></g>';
    },
    office(x, y, w, h) {
      let win = "";
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        win += '<rect x="' + (x + w * (0.14 + c * 0.2)) + '" y="' + (y + h * (0.12 + r * 0.2)) + '" width="' + (w * 0.11) + '" height="' + (h * 0.12) + '" fill="#8fb8a8" opacity="' + ((r + c) % 2 ? ".35" : ".55") + '"/>';
      }
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#24352f" stroke="#3a5449" stroke-width="3"/>' + win
        + '<rect x="' + (x + w * 0.42) + '" y="' + (y - 18) + '" width="' + (w * 0.16) + '" height="18" fill="#2b433a"/>';
    },
    rain(n) {
      let out = "";
      for (let i = 0; i < (n || 14); i++) {
        const x = 20 + i * 56 + (i % 3) * 12;
        out += '<line class="drop d' + (i % 4) + '" x1="' + x + '" y1="90" x2="' + (x - 8) + '" y2="122" stroke="rgba(140,190,220,.7)" stroke-width="3" stroke-linecap="round"/>';
      }
      return out;
    },
    haze(y, op) {
      return '<rect class="haze" x="0" y="' + y + '" width="800" height="60" fill="rgba(150,150,140,' + (op || .18) + ')"/>';
    },
  };

  /* ---------- 12 个月 + 终局 + 空态 ---------- */
  const SCENES = {
    /* 1 月：设备采购——厂房 + 三台不同尺寸设备，巨兽配浓烟 */
    1: function (state) {
      let out = P.sky("#16302a", "#1e443a", "m1") + P.ground("#1a3b32");
      out += P.cloud(150, 70, 1) + P.cloud(560, 50, 0.8);
      out += P.factory(90, 190, 240, 170, 1, false);
      // 三台设备：小 / 中 / 巨兽（猛兽）
      out += '<g transform="translate(410,320)"><rect x="-16" y="-18" width="32" height="18" rx="3" fill="#3d574b"/><circle cx="-9" cy="2" r="5" fill="#24352f"/><circle cx="9" cy="2" r="5" fill="#24352f"/><rect x="-10" y="-14" width="20" height="8" fill="#58c9a9" opacity=".7"/></g>';
      out += '<g transform="translate(500,318)"><rect x="-26" y="-30" width="52" height="30" rx="4" fill="#3d574b"/><circle cx="-14" cy="4" r="7" fill="#24352f"/><circle cx="14" cy="4" r="7" fill="#24352f"/><rect x="-16" y="-24" width="32" height="12" fill="#e8bd3f" opacity=".7"/></g>';
      out += '<g transform="translate(630,312)"><rect x="-42" y="-46" width="84" height="46" rx="5" fill="#4a2430" stroke="#c0392b" stroke-width="2"/><circle cx="-24" cy="6" r="10" fill="#24352f"/><circle cx="24" cy="6" r="10" fill="#24352f"/><rect x="-28" y="-38" width="56" height="18" fill="#ff7b6b" opacity=".55"/>'
        + '<g class="smoke" transform="translate(30,-48)"><circle class="puff p1" r="11" fill="rgba(180,170,160,.55)"/><circle class="puff p2" r="14" fill="rgba(180,170,160,.45)"/><circle class="puff p3" r="8" fill="rgba(180,170,160,.5)"/></g></g>';
      return out;
    },

    /* 2 月：围护改造——建筑外墙剖面 + 保温层 + 吊车 */
    2: function (state) {
      let out = P.sky("#16302a", "#1e443a", "m2") + P.ground("#1a3b32");
      out += P.cloud(620, 60, 0.9);
      // 建筑剖面：外墙 + 内层（保温层斜线）
      out += '<g transform="translate(230,150)">'
        + '<rect x="0" y="0" width="260" height="210" fill="#2b433a" stroke="#3a5449" stroke-width="3"/>'
        + '<rect x="18" y="18" width="224" height="174" fill="#1f332c"/>'
        + '<g stroke="#d4a017" stroke-width="3" opacity=".8">'
        + '<line x1="30" y1="180" x2="80" y2="30"/><line x1="70" y1="180" x2="120" y2="30"/><line x1="110" y1="180" x2="160" y2="30"/><line x1="150" y1="180" x2="200" y2="30"/><line x1="190" y1="180" x2="240" y2="30"/></g>'
        + '<rect x="110" y="120" width="60" height="90" fill="#16302a" stroke="#58c9a9" stroke-width="2"/></g>';
      // 吊车
      out += '<g transform="translate(540,160)" stroke="#e8bd3f" stroke-width="4" fill="none">'
        + '<line x1="0" y1="200" x2="0" y2="0"/><line x1="-30" y1="0" x2="90" y2="0"/>'
        + '<line x1="0" y1="0" x2="-30" y2="20"/><line x1="0" y1="0" x2="30" y2="20"/>'
        + '<line x1="70" y1="0" x2="70" y2="46"/><rect x="58" y="46" width="24" height="18" fill="#e8bd3f"/></g>';
      return out;
    },

    /* 3 月：团建——办公楼 + 三岔路标（飞机 / 骑马 / 树苗） */
    3: function (state, step) {
      let out = P.sky("#16302a", "#1e443a", "m3") + P.ground("#1a3b32");
      out += P.cloud(180, 60, 1) + P.cloud(600, 46, 0.75);
      out += P.office(70, 130, 200, 230);
      // 疫情 followUp 已揭示时叠加病毒
      if (step && step.followUp && state && state.revealed) {
        out += P.virus(180, 110, 1.1, "drift") + P.virus(120, 80, 0.8, "drift");
      }
      // 三岔路口指示牌
      out += '<g transform="translate(430,330)"><rect x="-4" y="-120" width="8" height="120" fill="#4a3626"/></g>';
      out += '<g class="signpost" transform="translate(430,210)">'
        + '<g transform="translate(-60,-14)"><rect width="130" height="30" rx="15" fill="#24352f" stroke="#e8bd3f" stroke-width="2"/><path d="M12,21 l8,-12 l5,6 l7,-9 l6,15 z" fill="#e8bd3f" transform="translate(2,0) scale(.9)"/><text x="60" y="21" font-size="16" fill="#f7f9f7">环球影城</text></g></g>';
      out += '<g transform="translate(430,330)"><rect x="-4" y="-110" width="8" height="110" fill="#4a3626"/></g>';
      out += '<g transform="translate(430,252)"><g transform="translate(-30,-12)"><rect width="118" height="28" rx="14" fill="#24352f" stroke="#58c9a9" stroke-width="2"/><text x="14" y="20" font-size="15" fill="#f7f9f7">新疆骑马</text><path d="M78,14 q6,-10 12,-2 q8,6 14,0" stroke="#58c9a9" stroke-width="2.5" fill="none"/></g></g>';
      out += '<g class="signpost" transform="translate(430,296)">'
        + '<g transform="translate(60,-14)"><rect width="120" height="30" rx="15" fill="#24352f" stroke="#58c9a9" stroke-width="2"/><text x="12" y="21" font-size="16" fill="#f7f9f7">种树</text><circle cx="86" cy="15" r="8" fill="#2f7d5b"/><rect x="84" y="20" width="4" height="8" fill="#4a3626"/></g></g>';
      out += P.tree(700, 350, 1.3);
      return out;
    },

    /* 4 月：公共卫生——政府大楼 + 病毒粒子脉动 */
    4: function (state) {
      let out = P.sky("#1a2f33", "#24403c", "m4") + P.ground("#1a3b32");
      out += P.cloud(660, 56, 0.9);
      // 政府大楼（台阶 + 立柱 + 国徽位）
      out += '<g transform="translate(240,150)">'
        + '<rect x="-30" y="190" width="380" height="20" fill="#2b433a"/>'
        + '<rect x="-14" y="176" width="348" height="14" fill="#33503f"/>'
        + '<rect x="0" y="40" width="320" height="140" fill="#24352f" stroke="#3a5449" stroke-width="3"/>'
        + '<rect x="20" y="20" width="280" height="24" fill="#2b433a"/>'
        + '<g fill="#8fb8a8" opacity=".6">'
        + '<rect x="36" y="70" width="20" height="100"/><rect x="84" y="70" width="20" height="100"/>'
        + '<rect x="132" y="70" width="20" height="100"/><rect x="180" y="70" width="20" height="100"/>'
        + '<rect x="228" y="70" width="20" height="100"/></g>'
        + '<circle cx="160" cy="32" r="12" fill="#d4a017"/></g>';
      // 病毒粒子 ×5（脉动 + 漂浮）
      out += P.virus(120, 120, 1, "drift") + P.virus(680, 150, 0.85, "pulse")
        + P.virus(600, 90, 0.7, "drift") + P.virus(90, 240, 0.75, "pulse") + P.virus(720, 260, 0.9, "drift");
      return out;
    },

    /* 5 月：屋顶光伏——按企业资产条件亮起 + 太阳 */
    5: function (state) {
      let out = P.sky("#1b3a2e", "#2a5540", "m5") + P.ground("#1a3b32") + P.sun(680, 90, 44);
      out += P.cloud(200, 70, 0.9);
      const hasPV = state && state.companies ? state.companies.filter(function (c) { return c.assets && c.assets.rooftopPV; }).length : 0;
      // 三栋厂房代表三家企业，装了光伏的屋顶亮起光伏阵列
      for (let i = 0; i < 3; i++) {
        const x = 70 + i * 250, lit = i < hasPV;
        out += P.factory(x, 210, 180, 150, 0, false);
        if (lit) out += P.pvRow(x + 34, 208, 2, 56, "glow");
        else out += '<text x="' + (x + 90) + '" y="198" text-anchor="middle" font-size="15" fill="#7d8f88">未安装</text>';
      }
      return out;
    },

    /* 6 月：光伏补贴——光伏屋顶 + 金币雨 */
    6: function (state) {
      let out = P.sky("#1b3a2e", "#2a5540", "m6") + P.ground("#1a3b32") + P.sun(110, 90, 40);
      out += P.cloud(620, 60, 0.85);
      out += P.factory(430, 200, 260, 160, 0, false);
      out += P.pvRow(460, 198, 3, 60, "glow");
      // 金币雨（6 组，delay 错开）
      out += '<g class="coin-rain">'
        + P.coin(200, -20) + P.coin(300, -60) + P.coin(400, -30) + P.coin(500, -70) + P.coin(620, -20) + P.coin(700, -50)
        + "</g>";
      return out;
    },

    /* 7 月：充电桩——停车场 + 电动车 + 单向/双向充电桩 */
    7: function (state) {
      let out = P.sky("#16302a", "#1e443a", "m7") + P.ground("#20262b", 340);
      // 停车位划线
      out += '<g stroke="rgba(255,255,255,.25)" stroke-width="3">';
      for (let i = 0; i < 5; i++) out += '<line x1="' + (90 + i * 150) + '" y1="340" x2="' + (90 + i * 150) + '" y2="430"/>';
      out += '<line x1="60" y1="340" x2="760" y2="340"/></g>';
      // 电动车 ×2（简笔侧视）
      const car = function (x, y, col) {
        return '<g transform="translate(' + x + "," + y + ')">'
          + '<rect x="-46" y="-16" width="92" height="22" rx="8" fill="' + col + '"/>'
          + '<path d="M-28,-16 L-18,-32 L18,-32 L28,-16 Z" fill="' + col + '" opacity=".85"/>'
          + '<circle cx="-26" cy="8" r="9" fill="#11181a"/><circle cx="26" cy="8" r="9" fill="#11181a"/>'
          + '<rect x="-10" y="-28" width="20" height="10" fill="#8fb8a8" opacity=".7"/></g>';
      };
      out += car(180, 350, "#2f7d9c") + car(480, 350, "#3c8a68");
      // 充电桩：单向（绿）+ 双向（金 + 双向箭头 + bolt 闪烁）
      out += P.charger(300, 356, 1.4, false);
      out += P.charger(600, 356, 1.4, true);
      out += '<g class="bolt"><path d="M600,310 l-8,16 h7 l-9,18 16,-20 h-7 l8,-14 z" fill="#e8bd3f"/></g>';
      return out;
    },

    /* 8 月：并网受限——电网塔 + 断线符号 + 蓄电池 */
    8: function (state, step) {
      let out = P.sky("#182f35", "#22424a", "m8") + P.ground("#1a3b32");
      out += P.cloud(150, 64, 0.9);
      // 电网塔 ×2（输电线一断一通）
      const tower = function (x, broken) {
        return '<g transform="translate(' + x + ',210)" stroke="#3d574b" stroke-width="4" fill="none">'
          + '<path d="M-36,150 L-20,0 L20,0 L36,150"/><path d="M-30,44 L30,44 M-26,88 L26,88 M-22,120 L22,120"/>'
          + '<path d="M-48,0 L48,0"/>'
          + (broken
              ? '<path d="M-48,0 L-30,-14" stroke="#c0392b"/><path d="M-30,-14 L-42,-26" stroke="#c0392b" stroke-width="3"/><path d="M48,0 L64,-12" stroke="#c0392b"/><path d="M64,-12 L54,-24" stroke="#c0392b" stroke-width="3"/>'
              : '<line x1="-48" y1="0" x2="48" y2="0"/>')
          + "</g>";
      };
      out += tower(200, true) + tower(560, false);
      // 电塔间连线
      out += '<path d="M152,210 Q380,150 512,210" stroke="#3d574b" stroke-width="3" fill="none" stroke-dasharray="8,10" opacity=".6"/>';
      // 蓄电池（居中近景，充电指示）
      out += P.battery(400, 330, 2.4);
      out += '<g class="bolt"><path d="M400,286 l-10,20 h9 l-11,22 20,-25 h-9 l10,-17 z" fill="#58c9a9"/></g>';
      return out;
    },

    /* 9 月：台风「塔巴」——乌云 + 螺旋风 + 摇晃光伏 + 雨；blackout 步骤叠停电层 */
    9: function (state, step) {
      let out = P.sky("#131f26", "#1d2f3a", "m9") + P.ground("#16262b");
      out += P.stormCloud(160, 80, 1.2) + P.stormCloud(500, 60, 1.5) + P.stormCloud(700, 110, 0.9);
      out += '<g class="cyclone"><path d="M400,70 q80,50 20,110 q-50,50 -130,40 q90,30 160,-15 q75,-50 15,-115 q-40,-42 -65,-20 z" fill="#3a5a78"/>'
        + '<path d="M410,95 q45,30 10,70 q-30,32 -80,26 q55,18 100,-10 q45,-32 8,-72 z" fill="#2c4a64"/></g>';
      const hasPV = state && state.companies && state.companies.some(function (c) { return c.assets && c.assets.rooftopPV; });
      if (hasPV) { out += P.pvPanel(190, 330, 1.6, "shake") + P.pvPanel(560, 330, 1.6, "shake"); }
      out += P.rain(14);
      if (step && step.id === "m9-blackout") out += '<rect width="800" height="450" fill="#000" opacity="0.28"/>';
      return out;
    },

    /* 10 月：油价飙升——油桶 + 上涨箭头 + 厂房 */
    10: function (state) {
      let out = P.sky("#2b2f26", "#3a4030", "m10") + P.ground("#20262b");
      out += P.cloud(580, 60, 0.8);
      out += P.factory(90, 190, 230, 170, 2, true);
      // 油桶 ×3
      const barrel = function (x, y) {
        return '<g transform="translate(' + x + "," + y + ')">'
          + '<rect x="-24" y="-34" width="48" height="68" rx="6" fill="#6b4a1e" stroke="#8a6a2e" stroke-width="3"/>'
          + '<line x1="-24" y1="-14" x2="24" y2="-14" stroke="#8a6a2e" stroke-width="3"/>'
          + '<line x1="-24" y1="12" x2="24" y2="12" stroke="#8a6a2e" stroke-width="3"/>'
          + '<text y="6" text-anchor="middle" font-size="18" fill="#e8bd3f" font-weight="700">油</text></g>';
      };
      out += barrel(430, 350) + barrel(500, 356, 0) + barrel(570, 350);
      // 上涨箭头
      out += '<g class="price-up" transform="translate(690,300)">'
        + '<path d="M0,60 L0,-30 M0,-30 l-14,16 M0,-30 l14,16" stroke="#ff7b6b" stroke-width="7" stroke-linecap="round" fill="none"/>'
        + '<text y="86" text-anchor="middle" font-size="22" fill="#ff7b6b" font-weight="700">↑</text></g>';
      return out;
    },

    /* 11 月：零碳园区——牌匾 + 三资格图标 + 政务窗口 */
    11: function (state) {
      let out = P.sky("#1b3a2e", "#2a5540", "m11") + P.ground("#1a3b32") + P.sun(100, 90, 38);
      // 园区牌匾（绿底金框 + 「零碳园区」）
      out += '<g transform="translate(400,120)">'
        + '<rect x="-130" y="-46" width="260" height="92" rx="10" fill="#16302a" stroke="#d4a017" stroke-width="4"/>'
        + '<text y="-6" text-anchor="middle" font-size="34" fill="#e8bd3f" font-weight="700" font-family="serif">零碳园区</text>'
        + '<text y="28" text-anchor="middle" font-size="14" fill="#9fb3ab">试点申报</text></g>';
      // 三资格图标横排（光伏 / 双向桩 / 蓄电池）
      out += '<g transform="translate(400,268)">' + P.pvPanel(-110, 0, 1.5, "glow") + P.charger(0, 6, 1.3, true) + P.battery(110, 4, 1.3) + "</g>";
      // 政务窗口（柜台 + 窗口）
      out += '<g transform="translate(580,330)"><rect x="-70" y="0" width="140" height="14" fill="#2b433a"/><rect x="-70" y="-60" width="140" height="60" fill="#24352f" stroke="#3a5449" stroke-width="3"/><rect x="-46" y="-46" width="92" height="34" fill="#16302a"/><circle cx="0" cy="-29" r="10" fill="#58c9a9" opacity=".7"/></g>';
      out += P.tree(120, 350, 1.4) + P.tree(720, 355, 1.1);
      return out;
    },

    /* 12 月：雾霾限产——灰霾层 + 城市轮廓 + 关停生产线 */
    12: function (state) {
      let out = P.sky("#2a3230", "#3a423c", "m12") + P.ground("#262c28");
      // 城市轮廓（远景浅）
      out += '<g fill="#39443d" opacity=".55">'
        + '<rect x="60" y="220" width="70" height="140"/><rect x="150" y="180" width="60" height="180"/>'
        + '<rect x="600" y="200" width="80" height="160"/><rect x="700" y="170" width="60" height="190"/></g>';
      // 厂房（近景）+ 关停生产线（停产标识 ⏸）
      out += P.factory(280, 210, 240, 150, 1, false);
      out += '<g transform="translate(400,285)">'
        + '<circle r="26" fill="none" stroke="#ff7b6b" stroke-width="4"/>'
        + '<rect x="-9" y="-10" width="7" height="20" fill="#ff7b6b"/><rect x="3" y="-10" width="7" height="20" fill="#ff7b6b"/></g>';
      // 灰霾三层叠加（缓慢流动）
      out += P.haze(240, .14) + P.haze(300, .18) + P.haze(170, .1);
      return out;
    },

    /* 终局：金色领奖台 + 奖杯 + 纸屑 */
    final: function (state) {
      let out = P.sky("#2b2416", "#443416", "fin") + P.ground("#33290f");
      // 领奖台三级
      out += '<g transform="translate(400,360)">'
        + '<rect x="-140" y="-70" width="84" height="70" fill="#3d574b" stroke="#8fb8a8" stroke-width="2"/><text y="-40" text-anchor="middle" font-size="22" fill="#8fb8a8">2</text>'
        + '<rect x="-42" y="-110" width="84" height="110" fill="#6b5413" stroke="#e8bd3f" stroke-width="3"/><text y="-80" text-anchor="middle" font-size="24" fill="#e8bd3f" font-weight="700">1</text>'
        + '<rect x="56" y="-46" width="84" height="46" fill="#5a4a2e" stroke="#d4a017" stroke-width="2"/><text y="-22" text-anchor="middle" font-size="20" fill="#d4a017">3</text></g>';
      // 奖杯
      out += '<g transform="translate(400,200)">'
        + '<path d="M-26,-34 h52 v14 a26,26 0 0 1 -52,0 z" fill="#d4a017"/>'
        + '<path d="M-26,-28 h-14 a16,16 0 0 0 18,20 M26,-28 h14 a16,16 0 0 1 -18,20" stroke="#d4a017" stroke-width="4" fill="none"/>'
        + '<rect x="-4" y="-8" width="8" height="16" fill="#a0770a"/><rect x="-16" y="8" width="32" height="8" rx="3" fill="#a0770a"/></g>';
      // 纸屑 ×10
      out += '<g class="confetti">';
      const cols = ["#e8bd3f", "#58c9a9", "#ff7b6b", "#8fb8a8"];
      for (let i = 0; i < 10; i++) {
        out += '<rect class="cf c' + (i % 5) + '" x="' + (60 + i * 74) + '" y="' + (-10 - (i % 3) * 26) + '" width="10" height="14" rx="2" fill="' + cols[i % 4] + '" transform="rotate(' + (i * 36) + ' ' + (65 + i * 74) + ' 0)"/>';
      }
      out += "</g>";
      return out;
    },

    /* 空态：呼吸圆环等待幕 */
    empty: function () {
      let out = P.sky("#12100d", "#1c2a24", "emp");
      out += '<g class="ring r1"><circle cx="400" cy="210" r="70" fill="none" stroke="#1f8a70" stroke-width="3" opacity=".8"/></g>'
        + '<g class="ring r2"><circle cx="400" cy="210" r="100" fill="none" stroke="#1f8a70" stroke-width="2" opacity=".5"/></g>'
        + '<g class="ring r3"><circle cx="400" cy="210" r="130" fill="none" stroke="#1f8a70" stroke-width="2" opacity=".3"/></g>'
        + '<text x="400" y="380" text-anchor="middle" font-size="22" fill="#7d8f88">等待主持人开局</text>';
      return out;
    },
  };

  /* ---------- 选项卡图标（24×24 stroke，currentColor）---------- */
  function ic(paths, vb) {
    return '<svg viewBox="' + (vb || "0 0 24 24") + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' + paths + "</svg>";
  }
  const ICON = {
    factory: ic('<path d="M2 20V9l5 3V9l5 3V9l5 3v8H2z"/><path d="M17 20v-6h4v6"/><path d="M6 13v0"/>'),
    machine: ic('<rect x="4" y="8" width="12" height="10" rx="2"/><path d="M16 12h3l1 3v3h-4"/><circle cx="8" cy="19" r="1.6"/><circle cx="13" cy="19" r="1.6"/><path d="M7 8V4h6v4"/>'),
    beast: ic('<rect x="3" y="6" width="15" height="11" rx="2"/><path d="M18 10h3v7h-3"/><circle cx="7" cy="20" r="1.8"/><circle cx="14" cy="20" r="1.8"/><path d="M5 6V3h3"/><path d="M8 10v3M11 10v3"/>'),
    envelope: ic('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 8l9 6 9-6"/><path d="M7 12l-3 5M17 12l3 5"/>'),
    plane: ic('<path d="M10.5 13.5L3 11l18-7-7 18-2.5-7.5z"/><path d="M10.5 13.5L21 4"/>'),
    horse: ic('<path d="M4 20c0-6 3-9 8-9 2 0 3-1 3-3l2-3 3 3-2 2c1 4-1 8-4 10"/><path d="M9 20v-4M14 20v-3"/>'),
    seedling: ic('<path d="M12 21v-8"/><path d="M12 13C12 8 8 6 4 6c0 5 3 7 8 7z"/><path d="M12 11c0-4 3-6 8-6 0 5-3 7-8 7z"/>'),
    mask: ic('<path d="M5 8c0-1 5-3 14-2l1 6c0 4-4 7-8 7s-8-3-8-7l1-4z"/><path d="M3 9c2 1 4 1 5 0M21 9c-2 1-4 1-5 0"/><path d="M9 11h6"/>'),
    gov: ic('<path d="M3 9l9-5 9 5"/><path d="M4 9v9M8 11v7M12 11v7M16 11v7M20 9v9"/><path d="M2 20h20"/>'),
    pv: ic('<rect x="4" y="4" width="16" height="10" rx="1"/><path d="M4 9h16M12 4v10"/><path d="M9 14l-2 7M15 14l2 7"/>'),
    battery: ic('<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M19 10h2v4h-2"/><path d="M7 10v4M11 10v4"/>'),
    chargerOneway: ic('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 7h4M10 10h4"/><path d="M12 13v4M10 15l2 2 2-2"/>'),
    chargerTwoway: ic('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 7h4M10 10h4"/><path d="M9 14h6M12 12l2 2-2 2M12 12l-2 2 2 2"/>'),
    coin: ic('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 9.5c0-1 5-1 5 .5s-5 1-5 2.5 5 1.5 5 .5"/>'),
    oil: ic('<rect x="5" y="7" width="14" height="14" rx="2"/><path d="M5 11h14M5 16h14"/><path d="M9 7V4h6v3"/><path d="M8 13v1M12 13v1M16 13v1"/>'),
    smog: ic('<path d="M4 9h16M2 13h20M4 17h16"/><path d="M7 9V5l3-2M17 9V6"/>'),
    award: ic('<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>'),
    bolt: ic('<path d="M13 2L5 13h5l-2 9 9-12h-6l2-8z"/>'),
    wind: ic('<path d="M3 8h9a3 3 0 1 0-3-3"/><path d="M3 12h13a3 3 0 1 1-3 3"/><path d="M3 16h6"/>'),
    doc: ic('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/>'),
    pause: ic('<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>'),
    dice: ic('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>'),
  };

  /* ---------- 月份主题色（观战页联动）---------- */
  const MONTH_TINT = {
    1: "#e8bd3f", 2: "#d4a017", 3: "#58c9a9", 4: "#ff7b6b", 5: "#e8bd3f",
    6: "#d4a017", 7: "#58c9a9", 8: "#3a9c9c", 9: "#6a8fae", 10: "#c08a3e",
    11: "#2f9d81", 12: "#8a9490", final: "#d4a017",
  };

  /* ---------- 入口 ---------- */
  function pick(month, step, state) {
    let fn;
    if (month === "final") fn = SCENES.final;
    else if (month === "empty" || !month) fn = SCENES.empty;
    else fn = SCENES[month] || SCENES.empty;
    return '<svg viewBox="' + VB + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
      + fn(state || null, step || null) + "</svg>";
  }

  root.GreenScenes = { pick: pick, SCENES: SCENES, PARTS: P, ICON: ICON, MONTH_TINT: MONTH_TINT, VB: VB };
})(typeof self !== "undefined" ? self : this);
