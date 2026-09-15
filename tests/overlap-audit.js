/* ============================================================
   版面遮挡审计（Playwright，开发者用，不进交付物）
   用法：NODE_PATH=<playwright路径> node tests/overlap-audit.js [baseUrl]
   口径：
     A 课前静态页 1-8（无状态渲染）
     B 全部步骤 × 相位（题面 / 揭示 / 结算）合成状态渲染，逐页两两求交
     C 实战驱动整局，舞台每次相位稳定后审计真实数据页
     D HUD 在 1920 / 1366 两档宽度下的截断 + 中控页横向溢出
   判定：可见元素对（非祖先后代）交叠面积 ≥ max(40px², 较小者 6%)
         记为遮挡；另报越出画布与 nowrap 截断。
   ============================================================ */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8000/index.html';
const findings = [];
function report(kind, label, detail) {
  findings.push(kind);
  console.log(`[${kind}] ${label} :: ${detail}`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const stage = await ctx.newPage();
  const ctrl = await ctx.newPage();
  const errors = [];
  stage.on('pageerror', e => errors.push('stage: ' + e.message));
  ctrl.on('pageerror', e => errors.push('ctrl: ' + e.message));

  await stage.goto(BASE + '#/stage');
  await stage.waitForTimeout(600);

  /* ---------- 页内工具：审计 / 离屏渲染 / 合成状态 ---------- */
  await stage.evaluate(() => {
    function desc(e) {
      const cls = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      return e.tagName.toLowerCase() + (cls ? '.' + cls : '');
    }
    function rectStr(r) {
      return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }
    window.__audit = async function (canvas, label) {
      /* 等图片真正加载完成（否则 img 高度为 0，重叠会被漏判） */
      await Promise.all(Array.from(canvas.querySelectorAll('img')).map(im => {
        if (im.complete && im.naturalWidth > 0) return null;
        return im.decode().catch(() => new Promise(res => { im.onload = im.onerror = res; }));
      }));
      const n = canvas.getAttribute('data-slide-n');
      const els = Array.from(canvas.querySelectorAll('*')).filter(e => {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return false;
        const r = e.getBoundingClientRect();
        return r.width > 4 && r.height > 4;
      });
      const rects = new Map(els.map(e => [e, e.getBoundingClientRect()]));
      const disp = new Map(els.map(e => [e, getComputedStyle(e).display]));
      const raw = [];
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const a = els[i], b = els[j];
          if (a.contains(b) || b.contains(a)) continue;
          /* 同一文字流内的两个内联元素：跨行 inline 的联合包围盒天然交叠，非视觉遮挡 */
          if (disp.get(a) === 'inline' && disp.get(b) === 'inline') continue;
          const ra = rects.get(a), rb = rects.get(b);
          const x = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
          const y = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
          const inter = x * y;
          if (inter < 40) continue;
          const smaller = Math.min(ra.width * ra.height, rb.width * rb.height);
          if (inter / smaller < 0.06) continue;
          raw.push({ aEl: a, bEl: b, a: desc(a), b: desc(b), inter: Math.round(inter), ra: rectStr(ra), rb: rectStr(rb) });
        }
      }
      // 只保留最外层交叠对（子对被父对覆盖时不再重复报）
      raw.sort((p, q) => q.inter - p.inter);
      const hits = [];
      for (const h of raw) {
        const cov = k => (k === h.aEl || k.aEl.contains(h.aEl)) && (k === h.bEl || k.bEl.contains(h.bEl))
          || (k === h.bEl || k.bEl.contains(h.aEl)) && (k === h.aEl || k.aEl.contains(h.bEl));
        if (hits.some(k => cov(k))) continue;
        hits.push(h);
      }
      // 越出画布
      const cr = canvas.getBoundingClientRect();
      const over = els.filter(e => {
        const r = rects.get(e);
        return r.left < cr.left - 1 || r.top < cr.top - 1 || r.right > cr.right + 1 || r.bottom > cr.bottom + 1;
      }).slice(0, 6).map(desc);
      // nowrap 截断
      const clip = els.filter(e => {
        const cs = getComputedStyle(e);
        return cs.whiteSpace === 'nowrap' && cs.overflow === 'hidden' && e.scrollWidth > e.clientWidth + 2;
      }).slice(0, 6).map(desc);
      return { label, n, hits: hits.map(h => `${h.a} ⇄ ${h.b} 交叠${h.inter}px² [${h.ra}|${h.rb}]`), over, clip };
    };
    window.__runScratch = function (n, state, label, noAnim) {
      let host = document.getElementById('audit-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'audit-host';
        host.style.cssText = 'position:fixed;left:-10000px;top:0;';
        document.body.appendChild(host);
      }
      host.innerHTML = '';
      const canvas = GreenSlides.renderSlide(n, { state: state, EV: GreenEvents });
      if (noAnim) canvas.classList.add('no-anim');
      host.appendChild(canvas);
      return window.__audit(canvas, label);
    };
    window.__stateAt = function (stepId) {
      const s = GreenEngine.createGame({ companyNames: { A: '企业 A', B: '企业 B', C: '企业 C' }, autoDice: true });
      let f = null;
      for (const m of GreenEvents.MONTHS) {
        for (let i = 0; i < m.steps.length; i++) if (m.steps[i].id === stepId) { f = { month: m.month, index: i }; break; }
        if (f) break;
      }
      if (!f) return null;
      s.month = f.month; s.stepIndex = f.index;
      return { s, step: GreenEvents.MONTHS.find(m => m.month === f.month).steps[f.index] };
    };
  });

  function drain(res) {
    if (!res) return;
    (res.hits || []).forEach(h => report('遮挡', `第${res.n}页 ${res.label}`, h));
    (res.over || []).forEach(o => report('越界', `第${res.n}页 ${res.label}`, o));
    (res.clip || []).forEach(c => report('截断', `第${res.n}页 ${res.label}`, c));
  }

  /* ================= A. 静态页 1-8 ================= */
  for (let n = 1; n <= 8; n++) {
    drain(await stage.evaluate(n => window.__runScratch(n, null, '静态', true), n));
  }

  /* ================= B. 全步骤 × 相位（合成状态） ================= */
  const steps = await stage.evaluate(() => {
    const out = [];
    for (const m of GreenEvents.MONTHS) m.steps.forEach((st, i) => out.push({ id: st.id, type: st.type, month: m.month, index: i }));
    return out;
  });
  for (const st of steps) {
    const variants = st.type === 'companyChoice' ? ['q', 'revealed'] : ['q', 'settled'];
    for (const v of variants) {
      drain(await stage.evaluate(({ id, v }) => {
        const r = window.__stateAt(id);
        if (!r) return null;
        const { s, step } = r;
        if (step.type === 'companyChoice') {
          if (v === 'q') ['A', 'B'].forEach((cid, i) => { s.pendingDecisions[cid] = { optionId: step.options[i].id }; });
          if (v === 'revealed') {
            ['A', 'B', 'C'].forEach((cid, i) => { s.pendingDecisions[cid] = { optionId: step.options[i % step.options.length].id }; });
            s.revealed = true;
          }
        }
        if (v === 'settled') s.stepSettled = { stepId: id, skip: 0 };
        const n = GreenSlides.autoSlide(s, GreenEvents);
        if (n == null) return null;
        return window.__runScratch(n, s, id + '/' + v, true);
      }, { id: st.id, v }));
    }
  }

  /* ================= C. 实战整局（真实数据密度） ================= */
  await ctrl.goto(BASE + '#/control');
  await ctrl.waitForTimeout(400);
  await ctrl.evaluate(() => localStorage.clear());
  await ctrl.reload();
  await ctrl.waitForTimeout(500);
  await ctrl.click('text=开 局');
  await stage.waitForTimeout(1200);

  async function ctrlState() {
    return await ctrl.evaluate(() => {
      const s = ControlConsole.state;
      if (!s) return null;
      const md = GreenEvents.MONTHS.find(m => m.month === s.month);
      const step = md && s.stepIndex < md.steps.length ? md.steps[s.stepIndex] : null;
      return {
        month: s.month, stepIndex: s.stepIndex, finished: s.finished, stepType: step ? step.type : null, stepId: step ? step.id : null,
        govMode: step && step.government ? (step.government.mode || (step.government.options ? 'options' : null)) : null,
        revealed: !!s.revealed, settled: !!(s.stepSettled && step && s.stepSettled.stepId === step.id),
      };
    });
  }
  const liveDone = new Set();
  async function auditLive() {
    await stage.waitForTimeout(900);
    const res = await stage.evaluate(() => {
      const c = document.querySelector('.sl-canvas');
      if (!c) return null;
      const s = ControlConsole.state;
      return window.__audit(c, (s ? 'm' + s.month + ':' + (GreenSlides.phaseKey(s) || '').slice(0, 24) : '空'));
    });
    if (res) {
      const key = res.n + '|' + res.label;
      if (!liveDone.has(key)) { liveDone.add(key); drain(res); }
    }
  }

  let guard = 0;
  while (guard++ < 400) {
    const st = await ctrlState();
    if (!st || st.finished) break;
    if (st.settled) {
      const nb = ctrl.locator('button:has-text("下一步")');
      if (await nb.count()) { await auditLive(); await nb.first().click(); await ctrl.waitForTimeout(350); continue; }
    }
    if (st.stepType === 'companyChoice') {
      if (st.revealed) {
        const nb = ctrl.locator('button:has-text("下一步")');
        if (await nb.count()) { await auditLive(); await nb.click(); await ctrl.waitForTimeout(300); continue; }
        break;
      }
      for (let g = 0; g < 3; g++) {
        const btns = ctrl.locator('.opt-btns').nth(g).locator('.opt-btn');
        const cnt = await btns.count();
        const enabled = [];
        for (let bi = 0; bi < cnt; bi++) if (await btns.nth(bi).isEnabled()) enabled.push(bi);
        if (enabled.length) { await btns.nth(enabled[(st.month + g) % enabled.length]).click(); await ctrl.waitForTimeout(110); }
      }
      const rb = ctrl.locator('button:has-text("统一揭示并结算")');
      if (await rb.count() && await rb.isEnabled()) { await rb.click(); await ctrl.waitForTimeout(500); }
    } else if (st.stepType === 'governmentChoice') {
      if (st.govMode === 'perApplicantFunding') {
        const t2 = ctrl.locator('.award-row').first().locator('button:has-text("第 2 档")');
        if (await t2.count()) { await t2.click(); await ctrl.waitForTimeout(150); }
        const fb = ctrl.locator('button:has-text("发放试点资金")');
        if (await fb.count()) { await fb.click(); await ctrl.waitForTimeout(450); }
        else { const sb = ctrl.locator('button:has-text("跳过资金发放")'); if (await sb.count()) { await sb.click(); await ctrl.waitForTimeout(300); } }
      } else {
        const pbs = ctrl.locator('.policy-btn');
        const cnt = await pbs.count();
        let clicked = false;
        for (let bi = 0; bi < cnt; bi++) {
          if (await pbs.nth(bi).isEnabled()) {
            await pbs.nth(bi).click(); await ctrl.waitForTimeout(250);
            const ok = ctrl.locator('.modal button:has-text("确认")');
            if (await ok.count()) { await ok.click(); await ctrl.waitForTimeout(350); }
            clicked = true; break;
          }
        }
        if (!clicked) break;
      }
    } else if (st.stepType === 'diceCheck') {
      const skip = ctrl.locator('button:has-text("无参与企业，跳过")');
      if (await skip.count()) { await skip.click(); await ctrl.waitForTimeout(250); continue; }
      const autoBtns = ctrl.locator('button:has-text("自动掷骰")');
      const cnt = await autoBtns.count();
      for (let bi = 0; bi < cnt; bi++) { await autoBtns.nth(bi).click(); await ctrl.waitForTimeout(700); }
      const sb = ctrl.locator('button:has-text("结算掷骰结果")');
      if (await sb.count()) { if (await sb.isEnabled()) { await sb.click(); await ctrl.waitForTimeout(350); } else break; }
    } else if (st.stepType === 'autoEvent') {
      const eb = ctrl.locator('button:has-text("执行结算")');
      if (await eb.count()) { await eb.click(); await ctrl.waitForTimeout(350); }
    } else if (st.stepType === 'awardCeremony') {
      const ab = ctrl.locator('button:has-text("完成颁奖")');
      if (await ab.count()) { await ab.click(); await ctrl.waitForTimeout(500); }
    } else {
      const nb = ctrl.locator('button:has-text("下一步"), button:has-text("继续"), button:has-text("跳过"), button:has-text("结算")');
      if (await nb.count()) { await nb.first().click(); await ctrl.waitForTimeout(300); }
      else break;
    }
    for (let ri = 0; ri < 5; ri++) {
      const rescue = ctrl.locator('.modal button:has-text("发放救助")');
      if (await rescue.count()) { await rescue.first().click(); await ctrl.waitForTimeout(400); }
      else break;
    }
  }
  await auditLive(); // 终局 42

  /* ================= D. HUD 档位 / 中控溢出 ================= */
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    await stage.setViewportSize(vp);
    await stage.waitForTimeout(500);
    const hud = await stage.evaluate(() => {
      const h = document.querySelector('.th-hud');
      if (!h) return null;
      return { sw: h.scrollWidth, cw: h.clientWidth, shown: h.style.display !== 'none' };
    });
    if (hud && hud.shown && hud.sw > hud.cw + 1) report('HUD截断', vp.width + 'px', `scrollWidth=${hud.sw} > clientWidth=${hud.cw}`);
  }
  await stage.setViewportSize({ width: 1920, height: 1080 });

  await ctrl.setViewportSize({ width: 1366, height: 768 });
  await ctrl.waitForTimeout(400);
  const cOver = await ctrl.evaluate(() => {
    const d = document.scrollingElement;
    return { sw: d.scrollWidth, cw: d.clientWidth };
  });
  if (cOver.sw > cOver.cw + 1) report('中控溢出', '1366px', `scrollWidth=${cOver.sw} > clientWidth=${cOver.cw}`);

  console.log(`\n[遮挡审计] 发现 ${findings.length} 处待甄别（遮挡/越界/截断）`);
  console.log('[JS错误]', errors.length ? errors.slice(0, 5).join(' | ') : '无');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
