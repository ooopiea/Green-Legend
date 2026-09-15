const path = require("path");
const { chromium } = require("playwright");
const E = require("../web/js/engine.js");
const EV = require("../web/js/events.js");

(async () => {
  const state = E.createGame({
    companyNames: { A: "甲公司", B: "乙公司", C: "丙公司" },
  });
  state.companies.find(c => c.id === "B").ecology = 80;
  state.companies.find(c => c.id === "C").ecology = 80;
  state.month = 8;
  state.stepIndex = EV.MONTHS.find(m => m.month === 8).steps.findIndex(s => s.id === "m8-ecoPolicy");
  state.phase = "governmentChoice";
  state.pendingDecisions = {};
  state.revealed = true;
  state.stepSettled = null;

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const serialized = E.serialize(state);
  await context.addInitScript(([key, value]) => {
    localStorage.setItem(key, value);
  }, [E.SAVE_KEY, serialized]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  const url = "file:///" + path.resolve(__dirname, "../web/index.html").replace(/\\/g, "/") + "#/control";
  await page.goto(url);
  await page.waitForLoadState("networkidle");

  const bodyText = await page.locator("body").innerText();
  if (!bodyText.includes("总点数将由这些企业平均分摊")) throw new Error("并列提示未显示");
  await page.screenshot({ path: path.resolve(__dirname, "tie-average-before.png"), fullPage: true });

  await page.getByRole("button", { name: /奖励生态值高的企业/ }).click();
  await page.getByRole("button", { name: /^确认$/ }).click();
  await page.waitForTimeout(300);

  const afterText = await page.locator("body").innerText();
  if (!afterText.includes("90")) throw new Error("政府财政未显示 90");
  if (!afterText.includes("65")) throw new Error("并列企业经济未显示 65");
  await page.screenshot({ path: path.resolve(__dirname, "tie-average-verified.png"), fullPage: true });

  if (errors.length) throw new Error("页面错误：" + errors.join(" | "));
  console.log("UI tie split verified: B=65 C=65 finance=90");
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
