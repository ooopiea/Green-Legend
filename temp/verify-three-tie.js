const path = require("path");
const { chromium } = require("playwright");
const E = require("../web/js/engine.js");
const EV = require("../web/js/events.js");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  const base = "file:///" + path.resolve(__dirname, "../web/index.html").replace(/\\/g, "/");
  await page.goto(base + "#/test");
  await page.waitForLoadState("networkidle");
  console.log("selfcheck loaded");
  const selfCheck = await page.locator("body").innerText();
  const summary = (selfCheck.match(/结果：\d+ 通过，\d+ 失败/) || ["未找到自检结果"])[0];
  const failures = selfCheck.split(/\r?\n/).filter(line => line.includes("✗")).join(" | ");
  if (summary !== "结果：7 通过，0 失败") throw new Error("浏览器自检失败：" + summary + " " + failures);

  const state = E.createGame({
    companyNames: { A: "甲公司", B: "乙公司", C: "丙公司" },
  });
  state.companies.forEach(company => { company.ecology = 80; });
  state.month = 2;
  state.stepIndex = EV.MONTHS.find(month => month.month === 2)
    .steps.findIndex(step => step.id === "m2-ecoPolicy");
  state.phase = "governmentChoice";
  state.pendingDecisions = {};
  state.revealed = true;
  state.stepSettled = null;

  await page.close();
  const tieContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await tieContext.addInitScript(([key, value]) => {
    localStorage.setItem(key, value);
  }, [E.SAVE_KEY, E.serialize(state)]);
  const tiePage = await tieContext.newPage();
  tiePage.on("pageerror", error => errors.push(error.message));
  tiePage.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await tiePage.goto(base + "#/control");
  await tiePage.waitForLoadState("networkidle");
  console.log("tie page loaded");

  const before = await tiePage.locator("body").innerText();
  if (!before.includes("总点数将由这些企业平均分摊")) throw new Error("三家并列提示未显示");
  await tiePage.evaluate(() => {
    const parent = Array.from(document.querySelectorAll("button"))
      .find(button => /罚款用于企业植树造林/.test(button.textContent || ""));
    if (!parent) throw new Error("A 选项未找到");
    parent.click();
  });
  await tiePage.waitForTimeout(100);
  await tiePage.evaluate(() => {
    const plant = Array.from(document.querySelectorAll("button"))
      .find(button => /从轻植树/.test(button.textContent || ""));
    if (!plant) {
      throw new Error("buttons=" + Array.from(document.querySelectorAll("button"))
        .map(button => button.textContent).join(" / "));
    }
    plant.click();
  });
  await tiePage.waitForTimeout(100);
  await tiePage.evaluate(() => {
    const confirm = Array.from(document.querySelectorAll("button"))
      .find(button => button.textContent.trim() === "确认");
    confirm.click();
  });
  await tiePage.waitForTimeout(300);
  console.log("policy settled");

  const after = await tiePage.locator("body").innerText();
  for (const expected of ["56.67", "83.33", "140", "110"]) {
    if (!after.includes(expected)) throw new Error("缺少显示值：" + expected);
  }
  if (after.includes("63.333333333333336")) throw new Error("仍显示长小数");
  await tiePage.screenshot({ path: path.resolve(__dirname, "three-tie-verified.png"), fullPage: true });

  if (errors.length) throw new Error("页面错误：" + errors.join(" | "));
  console.log("UI three-way tie verified: 56.67 / 83.33 / finance 110");
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
