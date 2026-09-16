/* 3-6 家企业舞台完整展示审计：运行 node tests/company-count-browser.js [baseUrl] */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const E = require("../web/js/engine.js");

const BASE = process.argv[2] || "http://localhost:8000/index.html";
const OUTPUT_DIR = path.join(__dirname, "..", "temp");

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const stage = await context.newPage();
  const errors = [];
  stage.on("pageerror", error => errors.push(error.message));

  await stage.goto(BASE + "#/stage");
  await stage.evaluate(() => localStorage.clear());
  await stage.waitForTimeout(900);

  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok });
    console.log((ok ? "  ✓ " : "  ✗ ") + name + (ok ? "" : " — " + detail));
  }

  async function putState(state) {
    await stage.evaluate(raw => {
      localStorage.removeItem("greentales-save");
      localStorage.setItem("greentales-save", raw);
      localStorage.setItem("greentales-tick", String(Date.now()));
    }, E.serialize(state));
    await stage.waitForTimeout(1200);
  }

  async function activeAudit(count) {
    return await stage.evaluate(expected => {
      const hud = document.querySelector(".th-hud");
      const cards = [...document.querySelectorAll(".th-hud-comps .th-comp")];
      const chips = [...document.querySelectorAll(".sl-chip:not(.timer)")];
      const canvas = document.querySelector(".sl-canvas");
      const view = document.documentElement.getBoundingClientRect();
      const complete = cards.every(card => {
        const r = card.getBoundingClientRect();
        return r.width > 20 && r.height > 20 &&
          r.left >= view.left - 1 && r.right <= view.right + 1 &&
          r.top >= view.top - 1 && r.bottom <= view.bottom + 1;
      });
      return {
        cards: cards.length,
        chips: chips.filter(item => item.getBoundingClientRect().width > 10).length,
        complete,
        hudOverflow: !hud || hud.scrollWidth > hud.clientWidth + 1 || hud.scrollHeight > hud.clientHeight + 1,
        canvasVisible: !!canvas && canvas.getBoundingClientRect().height > 100,
        expected,
      };
    }, count);
  }

  async function finalAudit(count) {
    return await stage.evaluate(expected => {
      const cards = [...document.querySelectorAll(".th-hud-comps .th-comp")];
      const canvas = document.querySelector(".sl-canvas");
      const rankBox = document.querySelector(".sl-rank");
      const rankRows = [...document.querySelectorAll(".sl-rank-row")];
      const awardCards = [...document.querySelectorAll(".sl-award")];
      const goals = document.querySelector(".sl-goals");
      const awards = document.querySelector(".sl-awards");
      const head = document.querySelector(".sl-finalhead");
      const view = document.documentElement.getBoundingClientRect();
      const complete = cards.every(card => {
        const r = card.getBoundingClientRect();
        return r.width > 20 && r.height > 20 &&
          r.left >= view.left - 1 && r.right <= view.right + 1 &&
          r.top >= view.top - 1 && r.bottom <= view.bottom + 1;
      });
      const rank = rankBox ? rankBox.getBoundingClientRect() : null;
      const goal = goals ? goals.getBoundingClientRect() : null;
      const award = awards ? awards.getBoundingClientRect() : null;
      const header = head ? head.getBoundingClientRect() : null;
      return {
        cards: cards.length,
        complete,
        finance: document.querySelector(".th-hud-gov b") ? document.querySelector(".th-hud-gov b").textContent.trim() : "",
        rankRows: rankRows.length,
        awards: awardCards.length,
        awardsBoxOverflow: !!awards && (awards.scrollHeight > awards.clientHeight + 1 || awards.scrollWidth > awards.clientWidth + 1),
        rankClass: rankBox ? [...rankBox.classList].find(name => name.startsWith("sl-rank-")) : "",
        rowsInsideCanvas: rankRows.every(row => {
          const r = row.getBoundingClientRect();
          const c = canvas.getBoundingClientRect();
          return r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1;
        }),
        noPress: !!rank && !!goal && !!header &&
          header.bottom <= rank.top - 4 &&
          rank.bottom <= goal.top - 4 &&
          (!!award ? goal.bottom <= award.top - 4 : true),
        awardsInsideCanvas: awardCards.every(card => {
          const r = card.getBoundingClientRect();
          const c = canvas.getBoundingClientRect();
          return r.width > 10 && r.height > 10 &&
            r.left >= c.left - 1 && r.right <= c.right + 1 &&
            r.top >= c.top - 1 && r.bottom <= c.bottom + 1;
        }),
        targets: [...(goals ? goals.querySelectorAll(".sl-goal") : [])].map(item => item.textContent.replace(/\s+/g, "")),
        expected,
      };
    }, count);
  }

  for (let count = 3; count <= 6; count++) {
    const ids = ["A", "B", "C", "D", "E", "F"].slice(0, count);
    const state = E.createGame({
      companyCount: count,
      companyNames: Object.fromEntries(ids.map(id => [id, "审计企业 " + id])),
      autoDice: true,
    });
    state.companies.forEach((company, index) => {
      company.economy = 65 + index;
      company.ecology = 70 + index * 2;
    });

    await putState(state);
    const active = await activeAudit(count);
    check(`${count} 家：顶部企业卡完整且无溢出`, active.cards === count && active.complete && !active.hudOverflow && active.canvasVisible, JSON.stringify(active));
    check(`${count} 家：题面选择芯片齐全`, active.chips === count, `chips=${active.chips}`);

    state.finished = true;
    state.government.awards = ids.map((id, index) => ({
      name: "专属审计奖 " + (index + 1),
      companyId: id,
      reason: "每家企业都有奖",
    }));
    await putState(state);
    const final = await finalAudit(count);
    const ecologyTarget = 70 * count;
    const economyTarget = 80 * count;
    const startingFinance = 40 + 20 * count;
    const targetText = final.targets.join("|");
    check(`${count} 家：初始财政按人数调整`, final.finance === String(startingFinance), `finance=${final.finance}`);
    check(`${count} 家：年终排名完整且区域不互压`, final.rankRows === count && final.rankClass === `sl-rank-${count}` && final.rowsInsideCanvas && final.noPress, JSON.stringify(final));
    check(`${count} 家：每家企业都有完整奖项`, final.awards === count && final.awardsInsideCanvas && !final.awardsBoxOverflow, JSON.stringify(final));
    check(`${count} 家：年终顶部企业卡完整`, final.cards === count && final.complete, JSON.stringify(final));
    check(`${count} 家：目标胶囊显示调整后目标`, targetText.includes(`≥${ecologyTarget}`) && targetText.includes(`≥${economyTarget}`), targetText);
    await stage.screenshot({ path: path.join(OUTPUT_DIR, `company-count-${count}.png`), fullPage: false });
  }

  await stage.setViewportSize({ width: 1366, height: 768 });
  await stage.waitForTimeout(800);
  const narrow = await finalAudit(6);
  check("1366px：6 家顶部企业卡仍完整", narrow.cards === 6 && narrow.complete && narrow.rankRows === 6, JSON.stringify(narrow));
  await stage.screenshot({ path: path.join(OUTPUT_DIR, "company-count-6-1366.png"), fullPage: false });

  await browser.close();
  const failed = results.filter(item => !item.ok).length;
  console.log(`\n[企业数量舞台审计] ${results.length - failed}/${results.length} 通过`);
  console.log("[JS错误]", errors.length ? errors.join(" | ") : "无");
  process.exit(failed || errors.length ? 1 : 0);
})().catch(error => {
  console.error("FATAL", error.message);
  process.exit(1);
});
