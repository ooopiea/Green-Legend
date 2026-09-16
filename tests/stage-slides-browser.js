/* ============================================================
   舞台幻灯片播放器断言（Playwright，开发者用，不进交付物）
   用法：NODE_PATH=<playwright路径> node tests/stage-slides-browser.js [baseUrl]
   验证：空态暗显第 1 页 / 开局跳 9 / 提交芯片 / 揭示答案页 /
   2 月政府答案页停留（两阶段）/ 9 月 30→33 三段 / 整局到 42 /
   同页 1.7s 轮询不重建节点。
   ============================================================ */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8000/index.html';
const COMPANY_COUNT = Math.max(3, Math.min(6, Number(process.env.GREEN_COMPANY_COUNT || 3) || 3));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const ctrl = await ctx.newPage();
  const stage = await ctx.newPage();
  const errors = [];
  ctrl.on('pageerror', e => errors.push('ctrl: ' + e.message));
  stage.on('pageerror', e => errors.push('stage: ' + e.message));

  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok });
    console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : ' — ' + (detail || '')));
  }
  // 救助弹窗处理器：点下一步/选项前先清掉可能存在的救助弹窗
  async function clearRescue() {
    for (let ri = 0; ri < 5; ri++) {
      const rescue = ctrl.locator('.modal button:has-text("发放救助")');
      if (await rescue.count()) { await rescue.first().click(); await ctrl.waitForTimeout(350); }
      else break;
    }
  }
  async function choosePlantOrRewardChild() {
    await ctrl.locator('.policy-btn').first().click();
    await ctrl.waitForTimeout(250);
    const chosen = await ctrl.evaluate(() => {
      const child = [...document.querySelectorAll('.policy-btn')].find(button => {
        const label = button.querySelector('.p-label');
        return /^A[12]/.test((label && label.textContent.trim()) || '');
      });
      if (!child || child.disabled) return false;
      child.click();
      return true;
    });
    if (!chosen) return false;
    await ctrl.waitForTimeout(250);
    await ctrl.evaluate(() => {
      const ok = [...document.querySelectorAll('.modal button')].find(button => button.textContent.trim() === '确认');
      if (ok) ok.click();
    });
    await ctrl.waitForTimeout(350);
    return true;
  }
  async function stageSlide() {
    const c = await stage.locator('.sl-canvas').first();
    return await c.getAttribute('data-slide-n');
  }
  // 舞台有 800ms 轮询 + 过渡，最多等 3s
  async function expectStage(n, name) {
    for (let i = 0; i < 12; i++) {
      if (String(await stageSlide()) === String(n)) { check(name, true); return true; }
      await stage.waitForTimeout(250);
    }
    check(name, false, '舞台=' + (await stageSlide()) + ' 期望 ' + n);
    return false;
  }
  async function ctrlState() {
    return await ctrl.evaluate(() => {
      const s = ControlConsole.state;
      if (!s) return null;
      const md = GreenEvents.MONTHS.find(m => m.month === s.month);
      const step = md && s.stepIndex < md.steps.length ? md.steps[s.stepIndex] : null;
      return {
        month: s.month, stepIndex: s.stepIndex, finished: s.finished,
        stepId: step ? step.id : null, stepType: step ? step.type : null,
        govMode: step && step.government ? (step.government.mode || (step.government.options ? 'options' : null)) : null,
        optCount: step && step.options ? step.options.length : 0,
        revealed: !!s.revealed,
        settled: !!(s.stepSettled && step && s.stepSettled.stepId === step.id),
      };
    });
  }

  /* ================= A. 空态 ================= */
  await stage.goto(BASE + '#/stage');
  await stage.waitForTimeout(600);
  check('空态：暗显第 1 页', (await stageSlide()) === '1', 'slide=' + (await stageSlide()));
  check('空态：等待幕可见', await stage.locator('.th-veil').isVisible());
  check('空态：HUD 隐藏', (await stage.locator('.th-hud').evaluate(el => el.style.display)) === 'none');

  /* ================= B. 开局 + 1 月 ================= */
  await ctrl.goto(BASE + '#/control');
  await ctrl.waitForTimeout(400);
  await ctrl.evaluate(() => localStorage.clear());
  await ctrl.reload();
  await ctrl.waitForTimeout(500);
  await ctrl.locator('.setup-row:has(label:has-text("企业数量")) select').selectOption(String(COMPANY_COUNT));
  await ctrl.click('text=开 局');
  await expectStage(9, '开局 → 第 9 页（1 月设备题面）');
  check('开局：等待幕收起', !(await stage.locator('.th-veil').isVisible()));
  const hudFin = await stage.locator('.th-hud-gov b').textContent();
  check('开局：HUD 财政与中控一致', hudFin.trim() === '100', 'hud=' + hudFin);

  // 当前局全部企业提交（都选 B 高能效）→ 芯片齐，同页 9 不换页
  const ob = ctrl.locator('.opt-btns');
  for (let g = 0; g < COMPANY_COUNT; g++) { await ob.nth(g).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(120); }
  await stage.waitForTimeout(1200);
  check(`提交 ${COMPANY_COUNT} 家：芯片齐且仍停第 9 页`,
    (await stage.locator('.sl-chip.on').count()) === COMPANY_COUNT && (await stageSlide()) === '9',
    'chips=' + (await stage.locator('.sl-chip.on').count()) + ' slide=' + (await stageSlide()));

  // 同页 1.7s 轮询稳定性：节点身份不变 + 动画名不变
  await stage.evaluate(() => { window.__c = document.querySelector('.sl-canvas'); });
  const animBefore = await stage.evaluate(() => {
    const el = document.querySelector('.sl-chip.on');
    return el ? getComputedStyle(el).animationName : '';
  });
  await stage.waitForTimeout(1700);
  const stable = await stage.evaluate(() => document.querySelector('.sl-canvas') === window.__c);
  const animAfter = await stage.evaluate(() => {
    const el = document.querySelector('.sl-chip.on');
    return el ? getComputedStyle(el).animationName : '';
  });
  check('同页 1.7s：轮询不重建画布节点', stable);
  check('同页 1.7s：动画名不变', animBefore === animAfter, animBefore + ' → ' + animAfter);

  // 揭示 → 第 10 页 + 徽章 + 点亮 + 飘字
  await ctrl.click('button:has-text("统一揭示并结算")');
  await expectStage(10, '揭示 → 第 10 页（答案表）');
  await clearRescue();
  check(`答案页：企业选择徽章 ≥${COMPANY_COUNT}`, (await stage.locator('.sl-pick').count()) >= COMPANY_COUNT);
  check('答案页：数字点亮 ≥1', (await stage.locator('.sl-num.lit').count()) >= 1);
  check('答案页：结算飘字出现', (await stage.locator('.float-tag').count()) >= 1);

  // 下一步 → 2 月围护题面
  await ctrl.click('button:has-text("下一步")');
  await expectStage(11, '下一步 → 第 11 页（2 月围护题面）');

  /* ================= C. 2 月 + 政府答案页停留 ================= */
  for (let g = 0; g < COMPANY_COUNT; g++) { await ob.nth(g).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(120); }
  await ctrl.click('button:has-text("统一揭示并结算")');
  await expectStage(12, '2 月揭示 → 第 12 页');
  await clearRescue();
  await ctrl.click('button:has-text("下一步")');
  await expectStage(13, '下一步 → 第 13 页（2 月生态奖惩题面）');

  // 政府确认（从轻）→ 两阶段：停 14 等中控下一步
  await choosePlantOrRewardChild();
  await clearRescue();
  const st1 = await ctrlState();
  check('两阶段：政府结算后 stepSettled 置位', st1.settled, JSON.stringify(st1));
  await expectStage(14, '2 月政府确认后 → 舞台停第 14 页（答案页）');
  await stage.waitForTimeout(1300);
  check('答案页停留：1.3s 后仍停 14（等中控推进）', (await stageSlide()) === '14', 'slide=' + (await stageSlide()));
  await ctrl.click('button:has-text("下一步")');
  await expectStage(15, '中控下一步 → 第 15 页（3 月团建）');

  /* ================= D. 通用推进至终局（含 9 月三段） ================= */
  function pickSteps(m, k) { return (m + k) % 4; }
  let month = 2, guard = 0, mismatches = 0;
  const monthLog = [];
  const seen = { m9typhoon: false, m9blackoutQ: false, m9blackoutA: false, m9self: false };
  while (guard++ < 400) {
    const st = await ctrlState();
    if (!st) { console.log('状态丢失'); break; }
    if (st.finished) break;

    // 9 月里程碑断言（m9-blackout 为政府决策步：结算即 settled）
    if (st.month === 9) {
      if (!seen.m9typhoon && st.stepId === 'm9-typhoonPV' && st.settled) { seen.m9typhoon = true; await expectStage(30, '9 月台风骰结算 → 停 30'); }
      if (!seen.m9blackoutQ && st.stepId === 'm9-blackout' && !st.settled) { seen.m9blackoutQ = true; await expectStage(31, '9 月停电题面 → 31'); }
      if (!seen.m9blackoutA && st.stepId === 'm9-blackout' && st.settled) { seen.m9blackoutA = true; await expectStage(32, '9 月停电结算 → 32（答案页停留）'); }
      if (!seen.m9self && st.stepId === 'm9-selfPower' && st.settled) { seen.m9self = true; await expectStage(33, '9 月自备电结算 → 33'); }
    }

    // 两阶段：已结算待推进 → 点下一步
    if (st.settled) {
      const nb = ctrl.locator('button:has-text("下一步")');
      if (await nb.count()) { await nb.first().click(); await ctrl.waitForTimeout(350); continue; }
    }

    const tag = `${st.month}月#${st.stepIndex}(${st.stepId || st.stepType})`;
    if (st.stepType === 'companyChoice') {
      if (st.revealed) {
        const nb = ctrl.locator('button:has-text("下一步")');
        if (await nb.count()) { await nb.click(); await ctrl.waitForTimeout(300); continue; }
        console.log(`  [${tag}] 已揭示但无下一步`); break;
      }
      let allChosen = true;
      for (let g = 0; g < COMPANY_COUNT; g++) {
        const btns = ctrl.locator('.opt-btns').nth(g).locator('.opt-btn');
        const cnt = await btns.count();
        const enabled = [];
        for (let bi = 0; bi < cnt; bi++) if (await btns.nth(bi).isEnabled()) enabled.push(bi);
        if (!enabled.length) { allChosen = false; break; }
        const pick = pickSteps(st.month, g) % enabled.length;
        await btns.nth(enabled[pick]).click();
        await ctrl.waitForTimeout(120);
      }
      // 11 月加装组
      const retrofitBtnGroups = ctrl.locator('.opt-btns').filter({ has: ctrl.locator('.opt-btn .num', { hasText: /^加$/ }) });
      const rg = await retrofitBtnGroups.count();
      for (let k = 0; k < rg; k++) {
        const rbtns = retrofitBtnGroups.nth(k).locator('.opt-btn');
        const rc = await rbtns.count();
        const renabled = [];
        for (let bi = 0; bi < rc; bi++) if (await rbtns.nth(bi).isEnabled()) renabled.push(bi);
        if (renabled.length) { await rbtns.nth(renabled[k % renabled.length]).click(); await ctrl.waitForTimeout(150); }
      }
      if (allChosen) {
        const rb = ctrl.locator('button:has-text("统一揭示并结算")');
        if (await rb.count() && await rb.isEnabled()) { await rb.click(); await ctrl.waitForTimeout(500); }
        else {
          const nb = ctrl.locator('button:has-text("下一步")');
          if (await nb.count()) { await nb.click(); await ctrl.waitForTimeout(300); }
          else { console.log(`  [${tag}] 卡死`); break; }
        }
      }
    } else if (st.stepType === 'governmentChoice' && st.govMode === 'plantOrReward') {
      const okPolicy = await choosePlantOrRewardChild();
      if (!okPolicy) { console.log(`  [${tag}] plantOrReward 无可执行子项`); break; }
    } else if (st.stepType === 'governmentChoice') {
      if (st.govMode === 'perApplicantFunding') {
        // 给首位申报企业点第 2 档，验证档位发放路径
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
        if (!clicked) { console.log(`  [${tag}] 无可用政策`); break; }
      }
    } else if (st.stepType === 'diceCheck') {
      const skip = ctrl.locator('button:has-text("无参与企业，跳过")');
      if (await skip.count()) { await skip.click(); await ctrl.waitForTimeout(250); continue; }
      const autoBtns = ctrl.locator('button:has-text("自动掷骰")');
      const cnt = await autoBtns.count();
      for (let bi = 0; bi < cnt; bi++) { await autoBtns.nth(bi).click(); await ctrl.waitForTimeout(700); }
      const sb = ctrl.locator('button:has-text("结算掷骰结果")');
      if (await sb.count()) { if (await sb.isEnabled()) { await sb.click(); await ctrl.waitForTimeout(350); } else { console.log(`  [${tag}] 掷骰未齐`); break; } }
    } else if (st.stepType === 'autoEvent') {
      const eb = ctrl.locator('button:has-text("执行结算")');
      if (await eb.count()) { await eb.click(); await ctrl.waitForTimeout(350); }
    } else if (st.stepType === 'awardCeremony') {
      const ab = ctrl.locator('button:has-text("完成颁奖")');
      if (await ab.count()) { await ab.click(); await ctrl.waitForTimeout(500); }
    } else {
      const nb = ctrl.locator('button:has-text("下一步"), button:has-text("继续"), button:has-text("跳过"), button:has-text("结算")');
      if (await nb.count()) { await nb.first().click(); await ctrl.waitForTimeout(300); }
      else { console.log(`  [${tag}] 未知步骤`); break; }
    }

    // 救助弹窗
    for (let ri = 0; ri < COMPANY_COUNT + 2; ri++) {
      const rescue = ctrl.locator('.modal button:has-text("发放救助")');
      if (await rescue.count()) { await rescue.first().click(); await ctrl.waitForTimeout(400); }
      else break;
    }

    // 全程页号联动一致性（autoSlide+0）
    const exp = await ctrl.evaluate(() => {
      const s = ControlConsole.state;
      if (!s) return null;
      const a = GreenSlides.autoSlide(s, GreenEvents);
      return a == null ? null : String(Math.min(42, Math.max(1, a)));
    });
    if (exp) {
      let ok = false;
      for (let i = 0; i < 6 && !ok; i++) {
        if ((await stageSlide()) === exp) ok = true;
        else await stage.waitForTimeout(300);
      }
      if (!ok) { mismatches++; console.log(`  [联动不一致 ${tag}] 舞台=${await stageSlide()} 期望=${exp}`); }
    }

    const now = await ctrl.evaluate(() => ({ m: ControlConsole.state.month, f: ControlConsole.state.finished }));
    if (now.m !== month) { month = now.m; monthLog.push('→' + month + '月'); }
  }
  check('全程页号联动一致（autoSlide + 偏移 0）', mismatches === 0, '不一致 ' + mismatches + ' 次');
  check('9 月四段 30/31/32/33 全部命中', seen.m9typhoon && seen.m9blackoutQ && seen.m9blackoutA && seen.m9self, JSON.stringify(seen));
  console.log('[月份轨迹]', monthLog.join(' '));

  /* ================= E. 终局 ================= */
  await expectStage(42, '终局 → 第 42 页（年终颁奖）');
  check(`终局：排名 ${COMPANY_COUNT} 行`, (await stage.locator('.sl-rank-row').count()) === COMPANY_COUNT);
  check('终局：目标胶囊 3 枚', (await stage.locator('.sl-goal').count()) === 3);
  check(`终局：每家企业都有奖项`, (await stage.locator('.sl-award').count()) === COMPANY_COUNT);
  // 终局页同页 1.7s 稳定性
  await stage.evaluate(() => { window.__f = document.querySelector('.sl-canvas'); });
  await stage.waitForTimeout(1700);
  check('终局页 1.7s：节点不重建', await stage.evaluate(() => document.querySelector('.sl-canvas') === window.__f));

  const fail = results.filter(r => !r.ok);
  console.log(`\n[舞台幻灯片断言] ${results.length - fail.length}/${results.length} 通过`);
  console.log('[JS错误]', errors.length ? errors.slice(0, 5).join(' | ') : '无');
  await browser.close();
  process.exit(fail.length || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
