/* Temporary visual check for the three stage themes. */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8000/index.html';
const CASES = [
  { n: 13, step: 'm2-ecoPolicy' },
  { n: 22, step: 'm6-pvSubsidy' },
  { n: 31, step: 'm9-blackout' },
  { n: 37, step: 'm11-funding' },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(BASE + '#/stage');
  await page.waitForTimeout(600);
  for (const item of CASES) {
    await page.evaluate(async ({ n, step }) => {
      const host = document.createElement('div');
      host.id = 'theme-check-host';
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;';
      document.body.appendChild(host);

      const state = GreenEngine.createGame({
        companyNames: { A: '企业 A', B: '企业 B', C: '企业 C' },
        autoDice: true,
      });
      const month = GreenEvents.MONTHS.find((entry) => entry.steps.some((entryStep) => entryStep.id === step));
      state.month = month.month;
      state.stepIndex = month.steps.findIndex((entryStep) => entryStep.id === step);

      const canvas = GreenSlides.renderSlide(n, { state, EV: GreenEvents });
      host.appendChild(canvas);
      await Promise.all(Array.from(canvas.querySelectorAll('img')).map((image) => (
        image.complete && image.naturalWidth ? null : image.decode().catch(() => new Promise((resolve) => {
          image.onload = image.onerror = resolve;
        }))
      )));
    }, item);
    await page.screenshot({
      path: `temp/theme-${item.n}.png`,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
    await page.evaluate(() => document.getElementById('theme-check-host')?.remove());
  }
  await browser.close();
})().catch((error) => {
  console.error('FATAL', error.message);
  process.exit(1);
});
