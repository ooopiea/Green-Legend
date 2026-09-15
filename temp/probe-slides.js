/* 调试探针：渲染指定页并输出元素矩形 + 截图（开发者用，不进交付物） */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const CASES = [
  { n: 3, step: null },
  { n: 11, step: 'm2-envelope' },
  { n: 20, step: 'm5-pv' },
  { n: 24, step: 'm7-charger' },
  { n: 31, step: 'm9-blackout' },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(BASE + '#/stage');
  await page.waitForTimeout(600);
  for (const c of CASES) {
    const out = await page.evaluate(async ({ n, step }) => {
      let host = document.getElementById('probe-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'probe-host';
        host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;';
        document.body.appendChild(host);
      }
      host.innerHTML = '';
      let state = null;
      if (step) {
        state = GreenEngine.createGame({ companyNames: { A: '企业 A', B: '企业 B', C: '企业 C' }, autoDice: true });
        const md = GreenEvents.MONTHS.find(m => m.steps.some(s => s.id === step));
        state.month = md.month;
        state.stepIndex = md.steps.findIndex(s => s.id === step);
      }
      const canvas = GreenSlides.renderSlide(n, { state, EV: GreenEvents });
      host.appendChild(canvas);
      await Promise.all(Array.from(canvas.querySelectorAll('img')).map(im =>
        im.complete && im.naturalWidth ? null : im.decode().catch(() => new Promise(r => { im.onload = im.onerror = r; }))));
      const rect = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
      return {
        imgs: Array.from(canvas.querySelectorAll('img.sl-img')).map(rect),
        opts: Array.from(canvas.querySelectorAll('.sl-opt, .sl-row, .sl-chip, .sl-body-half')).map(rect),
      };
    }, c);
    console.log(`slide ${c.n}: imgs=${JSON.stringify(out.imgs)} blocks=${JSON.stringify(out.opts)}`);
    await page.screenshot({ path: `temp/fix-slide${c.n}.png`, clip: { x: 0, y: 0, width: 1280, height: 720 } });
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
