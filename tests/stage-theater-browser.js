/* ============================================================
   剧场式舞台页断言（Playwright，开发者用，不进交付物）
   用法：NODE_PATH=<playwright路径> node tests/stage-theater-browser.js [baseUrl]
   单独验证舞台页：场景 SVG / 特征 class / 选项卡 / 方向暗示 /
   揭示徽章 / 浮动数字 / HUD 一致性 / 掷骰 / 终局。
   ============================================================ */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8000/index.html';

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
    results.push({ name, ok, detail: detail || '' });
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

  await stage.goto(BASE + '#/stage');
  await stage.waitForTimeout(400);

  // 1. 空态等待幕
  const emptySvg = await stage.locator('.th-empty svg').count();
  check('空态：等待幕 SVG 存在', emptySvg === 1, 'svg=' + emptySvg);

  await ctrl.goto(BASE + '#/control');
  await ctrl.waitForTimeout(400);
  await ctrl.evaluate(() => localStorage.clear());
  await ctrl.reload();
  await ctrl.waitForTimeout(500);
  await ctrl.click('text=开 局');
  await ctrl.waitForTimeout(900);

  // 2. 骨架与场景
  const sceneN = await stage.locator('.th-scene svg').count();
  const vb = await stage.locator('.th-scene svg').first().getAttribute('viewBox');
  check('场景：svg=1 且 viewBox 0 0 800 450', sceneN === 1 && vb === '0 0 800 450', `svg=${sceneN} vb=${vb}`);

  // 3. 1 月：4 张选项卡 + 无方向暗示（b1b4a5d 起选项卡不再显示生态/经济影响提示）
  const cardN1 = await stage.locator('.th-card').count();
  check('1月：选项卡 4 张', cardN1 === 4, 'n=' + cardN1);
  const hintN = await stage.locator('.th-card .hint').count();
  check('1月：选项卡无方向暗示', hintN === 0, 'hints=' + hintN);
  const hudFin = await stage.locator('.th-hud-gov b').textContent();
  const ctrlFin = await ctrl.evaluate(() => ControlConsole.state.government.finance);
  check('HUD 财政与中控一致', String(ctrlFin) === hudFin.trim(), `hud=${hudFin} ctrl=${ctrlFin}`);

  // 4. 提交三家 → 揭示：徽章落位 + 浮动数字
  const btns0 = ctrl.locator('.opt-btns').nth(0).locator('.opt-btn');
  await btns0.nth(0).click(); await ctrl.waitForTimeout(120);
  await ctrl.locator('.opt-btns').nth(1).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(120);
  await ctrl.locator('.opt-btns').nth(2).locator('.opt-btn').nth(3).click(); await ctrl.waitForTimeout(120);
  await clearRescue();
  const submitted = await stage.locator('.th-deck-note').textContent();
  check('提交计数显示 3/3', /3\s*\/\s*3/.test(submitted), submitted);
  await ctrl.click('button:has-text("统一揭示并结算")');
  await stage.waitForTimeout(400);
  await clearRescue();
  const badges = await stage.locator('.pick-badge').count();
  check('揭示后徽章落位 3 枚', badges === 3, 'n=' + badges);
  const floats0 = await stage.locator('.float-tag').count();
  check('揭示后浮动结算数字出现', floats0 >= 1, 'n=' + floats0);

  // 5. 推进到 3 月：场景切换 + 上向暗示卡
  await ctrl.click('button:has-text("下一步")');
  await ctrl.waitForTimeout(300);
  // 2 月
  await ctrl.locator('.opt-btns').nth(0).locator('.opt-btn').nth(0).click(); await ctrl.waitForTimeout(100);
  await ctrl.locator('.opt-btns').nth(1).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(100);
  await ctrl.locator('.opt-btns').nth(2).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(100);
  await ctrl.click('button:has-text("统一揭示并结算")'); await ctrl.waitForTimeout(300);
  await clearRescue();
  await ctrl.click('button:has-text("下一步")'); await ctrl.waitForTimeout(300);
  // 2月生态奖惩（政府）
  await ctrl.locator('.policy-btn').first().click(); await ctrl.waitForTimeout(250);
  const ok1 = ctrl.locator('.modal button:has-text("确认")');
  if (await ok1.count()) { await ok1.click(); await ctrl.waitForTimeout(300); }
  await clearRescue();
  // 3 月
  await ctrl.waitForTimeout(300);
  const hintN3 = await stage.locator('.th-card .hint').count();
  check('3月：选项卡仍无方向暗示', hintN3 === 0, 'hints=' + hintN3);
  const monthTxt = await stage.locator('.th-hud-month').textContent();
  check('HUD 显示 3 月', /3\s*月/.test(monthTxt), monthTxt);

  // 6. 4 月掷骰：先点继续生产（B），舞台出现骰子
  await ctrl.locator('.opt-btns').nth(0).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(100);
  await ctrl.locator('.opt-btns').nth(1).locator('.opt-btn').nth(1).click(); await ctrl.waitForTimeout(100);
  await ctrl.locator('.opt-btns').nth(2).locator('.opt-btn').nth(0).click(); await ctrl.waitForTimeout(100);
  await ctrl.click('button:has-text("统一揭示并结算")'); await ctrl.waitForTimeout(300);
  await clearRescue();
  await ctrl.click('button:has-text("下一步")'); await ctrl.waitForTimeout(300);
  // 4 月政府：选 B 继续生产（triggersDice）
  const pb = ctrl.locator('.policy-btn');
  const pbN = await pb.count();
  if (pbN) {
    await pb.nth(1).click(); await ctrl.waitForTimeout(250);
    const ok2 = ctrl.locator('.modal button:has-text("确认")');
    if (await ok2.count()) { await ok2.click(); await ctrl.waitForTimeout(300); }
  }
  await clearRescue();
  await stage.waitForTimeout(500);
  const diceN = await stage.locator('.th-dice').count() + await stage.locator('.dice-cube').count();
  check('4月掷骰步：舞台出现骰子元素', diceN >= 1, 'n=' + diceN);

  // 7. 轮询不重启循环动画：同一步骤内连续两次轮询后，云的动画名不变
  const animBefore = await stage.evaluate(() => {
    const cloud = document.querySelector('.th-scene .cloud');
    return cloud ? getComputedStyle(cloud).animationName : '';
  });
  await stage.waitForTimeout(1700);
  const animAfter = await stage.evaluate(() => {
    const cloud = document.querySelector('.th-scene .cloud');
    return cloud ? getComputedStyle(cloud).animationName : '';
  });
  check('轮询不重建场景（动画类保留）', animBefore !== '' && animBefore === animAfter, `${animBefore} → ${animAfter}`);

  // 汇总
  const fail = results.filter(r => !r.ok);
  console.log(`\n[舞台断言] ${results.length - fail.length}/${results.length} 通过`);
  console.log('[JS错误]', errors.length ? errors.slice(0, 5).join(' | ') : '无');
  await browser.close();
  process.exit(fail.length || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
