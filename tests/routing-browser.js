/* ============================================================
   路由回归浏览器测试（Playwright，开发者用，不进交付物）
   用法：node tests/routing-browser.js [baseUrl]（默认 http://localhost:8000/index.html）
   验证"误入舞台页"交互陷阱的修复——
     1) 无 hash 打开默认进中控，静置不自动跳转；
     2) 中控全操作（开局/选项/撤销/翻页/揭示/下一步）hash 恒不变；
     3) 顶栏"舞台页 ↗ / 归档复盘"新标签打开，原窗口原地不动；
     4) 舞台页右下角"⟲ 返回中控"可原窗口返回；
     5) 归档页"返回中控"可用；
     6) 双标签联动：中控揭示推进后舞台 HUD 同步；
     7) file:// 协议（双击打开场景）关键子集复验。
   ============================================================ */
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8000/index.html';
const FILE_BASE = pathToFileURL(path.join(__dirname, '..', 'web', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok });
    console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : ' — ' + (detail || '')));
  }
  const errors = [];

  async function newInstrumentedPage(ctx, tag) {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(tag + ': ' + e.message));
    // 每次导航后重新挂 hashchange 计数器（file:// 与 http:// 通用）
    await p.addInitScript(() => {
      window.__nav = [];
      addEventListener('hashchange', () => window.__nav.push(location.hash));
    });
    return p;
  }
  const viewOf = p => p.evaluate(() => document.querySelector('.control-layout,.setup-wrap') ? 'CONTROL'
    : document.querySelector('.theater') ? 'STAGE'
    : document.querySelector('.arch-wrap,.arch-empty') ? 'ARCHIVE' : 'OTHER');
  const navCount = p => p.evaluate(() => window.__nav.length);

  /* ================= http:// 场景 ================= */
  {
    const ctx = await browser.newContext();
    const ctrl = await newInstrumentedPage(ctx, 'ctrl');

    // ---- 1) 无 hash 打开：默认中控，静置不跳 ----
    await ctrl.goto(BASE.replace('#/control', ''));
    await ctrl.waitForTimeout(600);
    await ctrl.evaluate(() => localStorage.clear());
    await ctrl.reload();
    await ctrl.waitForTimeout(800);
    check('1a 无 hash 打开默认渲染中控', (await viewOf(ctrl)) === 'CONTROL', await viewOf(ctrl));
    await ctrl.waitForTimeout(3000);
    check('1b 静置 3s 不自动跳转（hash 空、无 hashchange）',
      (await viewOf(ctrl)) === 'CONTROL' && await navCount(ctrl) === 0,
      'view=' + (await viewOf(ctrl)) + ' nav=' + await navCount(ctrl));

    // ---- 2) 中控全操作 hash 恒不变 ----
    await ctrl.click('text=开 局');
    await ctrl.waitForTimeout(700);
    check('2a 开局后仍在中控', (await viewOf(ctrl)) === 'CONTROL' && (await navCount(ctrl)) === 0);

    for (let g = 0; g < 3; g++) {
      await ctrl.locator('.stash-card').nth(g).locator('.opt-btn:not([disabled])').first().click();
      await ctrl.waitForTimeout(150);
    }
    check('2b 三家选项录入后 hash 不变', (await navCount(ctrl)) === 0 && (await viewOf(ctrl)) === 'CONTROL');

    for (let i = 0; i < 2; i++) { await ctrl.click('button:has-text("下一页")'); await ctrl.waitForTimeout(150); }
    await ctrl.click('button:has-text("上一页")');
    await ctrl.waitForTimeout(200);
    check('2c 翻页器 ±1 不改 hash', (await navCount(ctrl)) === 0);

    await ctrl.click('button:has-text("统一揭示并结算")');
    await ctrl.waitForTimeout(600);
    await ctrl.click('button:has-text("下一步")');
    await ctrl.waitForTimeout(400);
    check('2d 揭示+下一步后仍在中控', (await viewOf(ctrl)) === 'CONTROL' && (await navCount(ctrl)) === 0);

    await ctrl.click('button:has-text("撤销上一步")');
    await ctrl.waitForTimeout(400);
    check('2e 撤销后仍在中控', (await viewOf(ctrl)) === 'CONTROL' && (await navCount(ctrl)) === 0);

    // 撤销回退到 1 月"已揭示"态：直接再点下一步推进到 2 月，供联动断言
    await ctrl.click('button:has-text("下一步")');
    await ctrl.waitForTimeout(400);
    const month = await ctrl.evaluate(() => ControlConsole.state.month);
    check('2f 撤销重推后到 2 月', month === 2, 'month=' + month);

    // ---- 3) 顶栏外链新标签打开，原窗口不动 ----
    const [stagePopup] = await Promise.all([
      ctrl.waitForEvent('popup'),
      ctrl.click('a:has-text("舞台页")'),
    ]);
    await stagePopup.waitForLoadState();
    await stagePopup.waitForTimeout(900);
    check('3a 舞台外链原窗口留中控', (await viewOf(ctrl)) === 'CONTROL' && await navCount(ctrl) === 0,
      'view=' + (await viewOf(ctrl)) + ' nav=' + await navCount(ctrl));
    check('3b 新标签落在 #/stage 且渲染舞台', (await viewOf(stagePopup)) === 'STAGE'
      && stagePopup.url().includes('#/stage'), 'url=' + stagePopup.url());

    // ---- 4) 舞台页右下角返回按钮 ----
    const backBtn = stagePopup.locator('.th-back');
    check('4a 舞台页存在 ⟲ 返回中控 按钮', (await backBtn.count()) === 1);
    await backBtn.click();
    await stagePopup.waitForTimeout(600);
    check('4b 返回后本窗口切回中控', (await viewOf(stagePopup)) === 'CONTROL'
      && stagePopup.url().includes('#/control'), 'url=' + stagePopup.url());

    // ---- 5) 归档页返回中控 ----
    const [archPopup] = await Promise.all([
      ctrl.waitForEvent('popup'),
      ctrl.click('a:has-text("归档复盘")'),
    ]);
    await archPopup.waitForLoadState();
    await archPopup.waitForTimeout(700);
    check('5a 归档外链新标签打开', archPopup.url().includes('#/archive') && await navCount(ctrl) === 0,
      'url=' + archPopup.url());
    const archBack = archPopup.locator('.topbar a:has-text("返回中控")');
    check('5b 归档页有返回中控入口', (await archBack.count()) === 1);
    await archBack.click();
    await archPopup.waitForTimeout(500);
    check('5c 归档返回后切回中控', (await viewOf(archPopup)) === 'CONTROL'
      && archPopup.url().includes('#/control'), 'url=' + archPopup.url());

    // ---- 6) 双标签联动 ----
    const stage2 = await newInstrumentedPage(ctx, 'stage2');
    await stage2.goto(BASE.replace('#/control', '') + '#/stage');
    await stage2.waitForTimeout(1500);
    const hudMonth = await stage2.evaluate(() => {
      const m = document.querySelector('.th-hud-month');
      return m ? m.textContent : '';
    });
    check('6a 舞台 HUD 同步到中控当前月（2 月）', hudMonth.indexOf('2') >= 0 && hudMonth.indexOf('月') >= 0,
      'hud=' + JSON.stringify(hudMonth));

    await ctx.close();
  }

  /* ================= file:// 场景（双击打开） ================= */
  {
    const ctx = await browser.newContext();
    const p = await newInstrumentedPage(ctx, 'file');
    await p.goto(FILE_BASE); // 无 hash，双击等价
    await p.waitForTimeout(900);
    check('7a file:// 无 hash 默认中控', (await viewOf(p)) === 'CONTROL', await viewOf(p));
    await p.waitForTimeout(2000);
    check('7b file:// 静置不跳转', (await viewOf(p)) === 'CONTROL' && await navCount(p) === 0);

    await p.click('text=开 局');
    await p.waitForTimeout(700);
    await p.locator('.stash-card').nth(0).locator('.opt-btn:not([disabled])').first().click();
    await p.waitForTimeout(200);
    await p.click('button:has-text("撤销上一步")');
    await p.waitForTimeout(300);
    check('7c file:// 开局/选项/撤销 hash 不变', await navCount(p) === 0 && (await viewOf(p)) === 'CONTROL');

    await p.goto(FILE_BASE + '#/stage');
    await p.waitForTimeout(900);
    check('7d file:// 舞台页有返回按钮', (await p.locator('.th-back').count()) === 1);
    await p.click('.th-back');
    await p.waitForTimeout(500);
    check('7e file:// 舞台返回中控生效', (await viewOf(p)) === 'CONTROL', 'view=' + (await viewOf(p)));

    await ctx.close();
  }

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log('\n== 结果：' + (results.length - fail) + ' 通过，' + fail + ' 失败 ==');
  if (errors.length) { console.log('[JS错误]', errors.slice(0, 5).join(' | ')); }
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
