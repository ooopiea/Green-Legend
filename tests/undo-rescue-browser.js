/* ============================================================
   撤销回退浏览器测试（Playwright，开发者用，不进交付物）
   用法：NODE_PATH=<playwright路径> node tests/undo-rescue-browser.js [baseUrl]
   验证 Bug 修复：救助弹窗不再卡死撤销——
     1) 救助弹窗内新增「撤销上一步」按钮，可直接回退；
     2) 连续撤销可穿越救助决策点，退回更早决策直至最早快照（1 月揭示前）；
     3) 撤销后无残留弹窗，可正常重新决策。
   ============================================================ */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8000/index.html';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext();
  const ctrl = await ctx.newPage();
  const errors = [];
  ctrl.on('pageerror', e => errors.push('ctrl: ' + e.message));

  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok });
    console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : ' — ' + (detail || '')));
  }

  await ctrl.goto(BASE + '#/control');
  await ctrl.waitForTimeout(500);
  await ctrl.evaluate(() => localStorage.clear());
  await ctrl.reload();
  await ctrl.waitForTimeout(600);

  // 剧本：1月 A 选 D（猛兽设备），2月 A 不改造 → 从重奖惩 → A 17 ≤20 触发救助弹窗
  await ctrl.click('text=开 局');
  await ctrl.waitForTimeout(700);

  // 1 月：A=D B=B C=C → 提交揭示
  const btns0 = ctrl.locator('.opt-btns');
  await btns0.nth(0).locator('.opt-btn').nth(3).click(); await ctrl.waitForTimeout(120);
  await btns0.nth(1).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(120);
  await btns0.nth(2).locator('.opt-btn').nth(2).click(); await ctrl.waitForTimeout(120);
  await ctrl.click('button:has-text("统一揭示并结算")');
  await ctrl.waitForTimeout(500);
  await ctrl.click('button:has-text("下一步")');
  await ctrl.waitForTimeout(300);

  // 2 月：A 不改造（A）、B 改造（B）、C 改造（B）→ 提交揭示
  await btns0.nth(0).locator('.opt-btn').nth(0).click(); await ctrl.waitForTimeout(100);
  await btns0.nth(1).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(100);
  await btns0.nth(2).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(100);
  await ctrl.click('button:has-text("统一揭示并结算")');
  await ctrl.waitForTimeout(500);
  // 2 月揭示后 A 生态 15 ≤20 滑坡 → 5；A 经济 22 → 无救助，点下一步进入生态奖惩步
  await ctrl.click('button:has-text("下一步")');
  await ctrl.waitForTimeout(400);

  // 2 月生态奖惩：从重（第 2 个政策按钮）→ A 生态 5 最低 -20 → 2 ≤20 → 救助弹窗
  const pb = ctrl.locator('.policy-btn');
  check('2月生态奖惩面板：2 档并行选项', (await pb.count()) === 2, 'n=' + (await pb.count()));
  await pb.nth(1).click(); await ctrl.waitForTimeout(250);
  const okBtn = ctrl.locator('.modal button:has-text("确认")');
  if (await okBtn.count()) { await okBtn.click(); await ctrl.waitForTimeout(400); }

  // 救助弹窗出现（dismissable:false 强制决策）
  const rescueDlg = ctrl.locator('.modal:has-text("破产救助决策")');
  check('救助弹窗弹出（A 经济 ≤20）', (await rescueDlg.count()) === 1, 'n=' + (await rescueDlg.count()));

  // 核心断言 1：弹窗内含「撤销上一步」按钮
  const undoInDlg = rescueDlg.locator('button:has-text("撤销上一步")');
  check('救助弹窗内提供「撤销上一步」', (await undoInDlg.count()) === 1, 'n=' + (await undoInDlg.count()));

  // 核心断言 2：弹窗内点撤销，直接回退到生态奖惩前（撤销"救助决策前"快照后
  // 弹窗关闭；若再出现救助类快照则继续穿越——引擎快照在救助决策前压入，
  // 撤销即回到触发前的政策步，rescuePending 不在恢复态中）
  await undoInDlg.first().click(); await ctrl.waitForTimeout(300);
  const stAfter1 = await ctrl.evaluate(() => {
    const s = ControlConsole.state;
    return { month: s.month, stepIndex: s.stepIndex, rescue: s.rescuePending !== null,
      snaps: s.snapshots.length, revealed: s.revealed };
  });
  check('弹窗内撤销一步：回到奖惩决策前（弹窗消失）', stAfter1.month === 2 && stAfter1.rescue === false,
    JSON.stringify(stAfter1));

  // 连续从弹窗或顶栏撤销，直到最早快照（1 月揭示结算前）
  let month = 99, steps = 0, rescuedAgain = false;
  for (let i = 0; i < 30; i++) {
    // 优先点弹窗内撤销按钮（若弹窗开着），否则点顶栏撤销
    const dlgUndo = ctrl.locator('.modal button:has-text("撤销上一步")');
    const topUndo = ctrl.locator('button.topbar ~ *, .topbar button:has-text("撤销上一步")');
    if (await dlgUndo.count()) { await dlgUndo.first().click(); }
    else {
      const tb = ctrl.locator('.topbar button:has-text("撤销上一步")');
      if (await tb.count()) await tb.click();
      else break;
    }
    await ctrl.waitForTimeout(220);
    steps++;
    const st = await ctrl.evaluate(() => {
      const s = ControlConsole.state;
      return { month: s.month, stepIndex: s.stepIndex, snaps: s.snapshots.length, rescue: s.rescuePending !== null };
    });
    month = st.month;
    if (st.rescue) rescuedAgain = true;
    if (st.month === 1 && st.stepIndex === 0 && st.snaps === 0) break; // 回到 1 月揭示前、无剩余快照
  }
  const finalSt = await ctrl.evaluate(() => {
    const s = ControlConsole.state;
    return { month: s.month, stepIndex: s.stepIndex, snaps: s.snapshots.length,
      rescue: s.rescuePending !== null,
      eco: s.companies[0].ecology, econ: s.companies[0].economy };
  });
  check('连续撤销穿越救助点回到 1 月揭示前', finalSt.month === 1 && finalSt.stepIndex === 0, JSON.stringify(finalSt));
  check('撤销到底后救助弹窗关闭（rescuePending 清空）', finalSt.rescue === false, 'rescue=' + finalSt.rescue);
  check('数值回退到 1 月初始分（A 60/60）', finalSt.econ === 60 && finalSt.eco === 60, 'A=' + finalSt.econ + '/' + finalSt.eco);
  const residueModals = await ctrl.locator('.modal-backdrop').count();
  check('无残留弹窗', residueModals === 0, 'n=' + residueModals);

  // 核心断言 3：回退后可正常重新决策（1 月 revealed 保持 true 为引擎既定行为，
  // 先点"下一步"进入 2 月，再正常录入选择）
  const nextBtn = ctrl.locator('button:has-text("下一步")');
  if (await nextBtn.count()) {
    await nextBtn.first().click(); await ctrl.waitForTimeout(300);
  }
  const stM2 = await ctrl.evaluate(() => ({ m: ControlConsole.state.month, rev: ControlConsole.state.revealed }));
  const optBtns = ctrl.locator('.opt-btns');
  const ob0 = optBtns.nth(0).locator('.opt-btn:not([disabled])');
  if (!stM2.rev && (await ob0.count())) {
    await ob0.nth(0).click(); await ctrl.waitForTimeout(120);
    const picked = await ctrl.evaluate(() => Object.keys(ControlConsole.state.pendingDecisions || {}).length);
    check('回退后可重新提交决策', picked >= 1, 'picked=' + picked);
  } else {
    check('回退后可重新提交决策', false, JSON.stringify(stM2));
  }

  const fail = results.filter(r => !r.ok);
  console.log(`\n[撤销回退断言] ${results.length - fail.length}/${results.length} 通过`);
  console.log('[JS错误]', errors.length ? errors.slice(0, 5).join(' | ') : '无');
  await browser.close();
  process.exit(fail.length || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
