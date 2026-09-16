/* ============================================================
   浏览器全流程冒烟（Playwright，开发者用，不进交付物）
   用法：NODE_PATH=<playwright路径> node tests/fullgame-browser.js [baseUrl]
   自动打完 12 个月 + 年终颁奖，核对终局与刷新恢复；
   两阶段结算：政府/掷骰/自动/资金结算后先停答案页，再点下一步推进。
   ============================================================ */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8000/index.html';
const COMPANY_COUNT = Math.max(3, Math.min(6, Number(process.env.GREEN_COMPANY_COUNT || 3) || 3));

function pickSteps(m, k) { return (m + k) % 4; } // 选项轮转策略：覆盖不同分支

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext();
  const ctrl = await ctx.newPage();
  const stage = await ctx.newPage();
  const errors = [];
  ctrl.on('pageerror', e => errors.push('ctrl: ' + e.message));
  stage.on('pageerror', e => errors.push('stage: ' + e.message));

  await stage.goto(BASE + '#/stage');
  await stage.waitForTimeout(500);
  await ctrl.goto(BASE + '#/control');
  await ctrl.waitForTimeout(500);
  await ctrl.evaluate(() => localStorage.clear());
  await ctrl.reload();
  await ctrl.waitForTimeout(600);
  await ctrl.locator('.setup-row:has(label:has-text("企业数量")) select').selectOption(String(COMPANY_COUNT));
  await ctrl.click('text=开 局');
  await ctrl.waitForTimeout(800);
  const started = await ctrl.evaluate(() => ({
    count: ControlConsole.state.companies.length,
    declared: ControlConsole.state.companyCount,
  }));
  if (started.count !== COMPANY_COUNT || started.declared !== COMPANY_COUNT) {
    throw new Error(`开局数量错误：期望 ${COMPANY_COUNT}，实际 ${JSON.stringify(started)}`);
  }

  let month = 1, stepInMonth = 0, guard = 0;
  const monthLog = [];
  let lastPosition = "";
  let stuckCount = 0;
  while (guard++ < 300) {
    const st = await ctrl.evaluate(() => {
      const s = ControlConsole.state;
      if (!s) return null;
      const md = GreenEvents.MONTHS.find(m => m.month === s.month);
      const step = md && s.stepIndex < md.steps.length ? md.steps[s.stepIndex] : null;
      return { month: s.month, stepIndex: s.stepIndex, finished: s.finished, stepType: step ? step.type : null, govMode: step && step.government ? (step.government.mode || (step.government.options ? 'options' : null)) : null, optCount: step && step.options ? step.options.length : 0, stepId: step ? step.id : null, settled: !!(s.stepSettled && step && s.stepSettled.stepId === step.id) };
    });
    if (!st) { console.log('状态丢失'); break; }
    const position = `${st.month}:${st.stepIndex}:${st.stepId}`;
    if (position === lastPosition) stuckCount++;
    else { lastPosition = position; stuckCount = 0; }
    if (stuckCount >= 6) {
      const pageButtons = await ctrl.evaluate(() => [...document.querySelectorAll('button')].map(button => ({
        text: button.textContent.trim(),
        disabled: button.disabled,
        visible: !!(button.offsetWidth || button.offsetHeight),
      })));
      throw new Error('自动化在同一状态连续停滞：' + JSON.stringify({ state: st, pageButtons }));
    }
    if (st.finished) { monthLog.push('终局'); break; }

    const tag = `${st.month}月#${st.stepIndex}(${st.stepType}${st.govMode ? ':' + st.govMode : ''})`;

    // 两阶段：政府/掷骰/自动/资金已结算待推进 → 点下一步（答案页停留后推进）
    if (st.settled) {
      const nb = ctrl.locator('button:has-text("下一步")');
      if (await nb.count()) { await nb.first().click(); await ctrl.waitForTimeout(350); continue; }
      console.log(`  [${tag}] 已结算但无下一步按钮`); break;
    }

    if (st.stepType === 'companyChoice') {
      // 已揭示 → 点"下一步"推进；未揭示 → 当前局全部企业录选后统一揭示
      const revealed = await ctrl.evaluate(() => ControlConsole.state.revealed);
      if (revealed) {
        const nb = ctrl.locator('button:has-text("下一步")');
        if (await nb.count()) { await nb.click(); await ctrl.waitForTimeout(300); continue; }
        console.log(`  [${tag}] 已揭示但无下一步按钮`); break;
      }
      const n = st.optCount;
      let allChosen = true;
      for (let g = 0; g < COMPANY_COUNT; g++) {
        const pick = pickSteps(st.month, g) % n + 1; // 1-based 选项序号
        const btns = ctrl.locator('.opt-btns').nth(g).locator('.opt-btn');
        const cnt = await btns.count();
        const enabledIdx = [];
        for (let bi = 0; bi < cnt; bi++) if (await btns.nth(bi).isEnabled()) enabledIdx.push(bi);
        if (!enabledIdx.length) { allChosen = false; console.log(`  [${tag}] 企业${g} 无可选项（资格限制）`); break; }
        const target = enabledIdx[(pick - 1) % enabledIdx.length];
        await btns.nth(target).click();
        await ctrl.waitForTimeout(120);
      }
      // 11 月：选了「加装后申报」(m11-B) 的企业还要点加装项（第二组 .opt-btns）
      const retrofitCards = ctrl.locator('.stash-card').filter({ has: ctrl.locator('h5') });
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
        else { console.log(`  [${tag}] 揭示按钮不可用`); break; }
      } else {
        // 有企业因资格无法选择 → 揭示按钮不启用：用下一步按钮跳过
        const nb = ctrl.locator('button:has-text("下一步")');
        if (await nb.count()) { await nb.click(); await ctrl.waitForTimeout(300); }
        else { console.log(`  [${tag}] 卡死：揭示与下一步均不可用`); break; }
      }
    } else if (st.stepType === 'governmentChoice') {
      if (st.govMode === 'options') {
        // 找可用政策按钮（财政红线跳过禁用项）
        const pbs = ctrl.locator('.policy-btn');
        const cnt = await pbs.count();
        let clicked = false;
        for (let bi = 0; bi < cnt; bi++) {
          if (await pbs.nth(bi).isEnabled()) {
            await pbs.nth(bi).click();
            await ctrl.waitForTimeout(250);
            // 确认弹窗
            const ok = ctrl.locator('.modal button:has-text("确认")');
            if (await ok.count()) { await ok.click(); await ctrl.waitForTimeout(350); }
            clicked = true; break;
          }
        }
        if (!clicked) { console.log(`  [${tag}] 无可用政策（财政红线全部禁用？）`); break; }
      } else if (st.govMode === 'perApplicantFunding') {
        // 给首位申报企业点第 2 档，覆盖档位发放路径
        const t2 = ctrl.locator('.award-row').first().locator('button:has-text("第 2 档")');
        if (await t2.count()) { await t2.click(); await ctrl.waitForTimeout(150); }
        const fb = ctrl.locator('button:has-text("发放试点资金")');
        if (await fb.count()) { await fb.click(); await ctrl.waitForTimeout(450); }
        else { const sb = ctrl.locator('button:has-text("跳过资金发放")'); if (await sb.count()) { await sb.click(); await ctrl.waitForTimeout(300); } }
      } else if (st.govMode === 'ecoExtrema') {
        const pbs = ctrl.locator('.policy-btn');
        const cnt = await pbs.count();
        if (cnt && await pbs.nth(0).isEnabled()) {
          await pbs.nth(0).click();
          await ctrl.waitForTimeout(250);
          const ok = ctrl.locator('.modal button:has-text("确认")');
          if (await ok.count()) { await ok.click(); await ctrl.waitForTimeout(350); }
        } else { console.log(`  [${tag}] ecoExtrema 无可用按钮`); break; }
      } else if (st.govMode === 'plantOrReward') {
        // A 是父选项，第一次点击展开 A1/A2，再选择一个可执行子项。
        const parent = ctrl.locator('.policy-btn').first();
        if (await parent.count()) {
          await parent.click();
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
          if (!chosen) break;
          await ctrl.waitForTimeout(250);
          await ctrl.evaluate(() => {
            const ok = [...document.querySelectorAll('.modal button')].find(button => button.textContent.trim() === '确认');
            if (ok) ok.click();
          });
          await ctrl.waitForTimeout(350);
          if (!chosen) { console.log(`  [${tag}] plantOrReward 无可执行子项`); break; }
        } else { console.log(`  [${tag}] plantOrReward 无政策按钮`); break; }
      } else {
        // 其它政府模式：尝试任意政策/下一步
        const nb = ctrl.locator('button:has-text("下一步"), button:has-text("跳过")');
        if (await nb.count()) { await nb.first().click(); await ctrl.waitForTimeout(300); }
      }
    } else if (st.stepType === 'diceCheck') {
      // 全部自动掷骰
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
      else { console.log(`  [${tag}] 未知步骤类型，无可用按钮`); break; }
    }

    // 救助弹窗处理（发放）——可能多家排队，循环处理
    for (let ri = 0; ri < 5; ri++) {
      const rescue = ctrl.locator('.modal button:has-text("发放救助")');
      if (await rescue.count()) { await rescue.first().click(); await ctrl.waitForTimeout(400); }
      else break;
    }

    // 追踪月份推进
    const now = await ctrl.evaluate(() => ({ m: ControlConsole.state.month, f: ControlConsole.state.finished }));
    if (now.m !== month) {
      month = now.m; monthLog.push('→' + month + '月');
      // 舞台断言：月份切换后 HUD 月份与幻灯片页号随动
      await stage.waitForTimeout(900);
      try {
        const hudM = (await stage.locator('.th-hud-month').textContent()).trim();
        const okHud = new RegExp('^' + month + '\\s*月').test(hudM);
        const slide = await stage.locator('.sl-canvas').first().getAttribute('data-slide-n');
        console.log(`  [舞台 ${month}月] HUD:${okHud ? 'OK' : 'FAIL(' + hudM + ')'} 页:${slide || '无'}`);
      } catch (e) { console.log(`  [舞台 ${month}月] 断言异常: ${e.message.slice(0, 60)}`); }
    }
  }

  const fin = await ctrl.evaluate(() => {
    const s = ControlConsole.state;
    return {
      finished: s.finished, month: s.month,
      companies: s.companies.map(c => c.name + ':' + c.economy + '/' + c.ecology + '(投' + c.totalInvestment + ')'),
      finance: s.government.finance,
      logs: s.logs.length, snapshots: s.snapshots.length, dice: s.dice.length,
      awards: (s.government.awards || []).map(a => a.name),
    };
  });
  console.log('[终局]', JSON.stringify(fin, null, 1));
  console.log('[月份轨迹]', monthLog.join(' '));
  console.log('[JS错误]', errors.length ? errors.slice(0, 5).join(' | ') : '无');
  const failures = [];
  if (!fin.finished) failures.push('全流程未到达终局');
  if (fin.awards.length !== COMPANY_COUNT) failures.push(`年终奖项数量应为 ${COMPANY_COUNT}，实际 ${fin.awards.length}`);

  // 刷新恢复
  await ctrl.reload();
  await ctrl.waitForTimeout(800);
  const after = await ctrl.evaluate(() => {
    const s = ControlConsole.state;
    return s ? { month: s.month, finished: s.finished, fin: s.government.finance } : null;
  });
  console.log('[刷新恢复]', after && after.finished ? 'OK（终局保持）' : JSON.stringify(after));
  if (!after || !after.finished) failures.push('刷新后终局丢失');

  // 舞台终局同步（幻灯片播放器）
  await stage.waitForTimeout(1200);
  const stTxt = (await stage.textContent('#app')).replace(/\s+/g, ' ');
  console.log('[舞台终局]', /年终|排名|冠军/.test(stTxt) ? 'OK · ' + stTxt.slice(0, 80) : 'FAIL: ' + stTxt.slice(0, 80));
  if (!/年终|排名|冠军/.test(stTxt)) failures.push('舞台未显示年终结算');
  // 幻灯片终局断言：第 42 页画布 + 排名行数与本局企业数一致 + 目标胶囊 3 枚
  const slideN = await stage.locator('.sl-canvas').first().getAttribute('data-slide-n');
  const rankRows = await stage.locator('.sl-rank-row').count();
  const goals = await stage.locator('.sl-goal').count();
  console.log('[幻灯终局]', slideN === '42' && rankRows === COMPANY_COUNT && goals === 3
    ? `OK（第42页 · 排名${rankRows}行 · 目标${goals}枚）`
    : `FAIL（页${slideN} 排名${rankRows} 目标${goals}）`);
  if (slideN !== '42' || rankRows !== COMPANY_COUNT || goals !== 3) failures.push('年终幻灯片断言失败');

  await browser.close();
  process.exit(errors.length || failures.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
