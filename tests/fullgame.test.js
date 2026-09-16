/* 《绿神话》完整流程回归测试：运行 node tests/fullgame.test.js */

const assert = require("assert");
const E = require("../web/js/engine.js");
const EV = require("../web/js/events.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (error) {
    failed++;
    console.error("  ✗ " + name + "\n    " + error.message);
  }
}

function step(month, id) {
  const monthData = EV.MONTHS.find(item => item.month === month);
  return monthData.steps.find(item => item.id === id);
}

function company(state, id) {
  return E.getCompany(state, id);
}

function enterMonth(state, month) {
  state.month = month;
  state.stepIndex = 0;
  E.settleMonthOpening(state);
}

function playFullGame(companyCount = 3) {
  const state = E.createGame({
    companyCount,
    companyNames: { A: "激进扩张", B: "均衡绿色", C: "深度低碳" },
    governmentName: "市政府",
    autoDice: false,
  });

  const ids = state.companies.map(item => item.id);
  function choices(pattern) {
    return Object.fromEntries(ids.map((id, index) => [id, { optionId: pattern[index % pattern.length] }]));
  }
  function allChoice(month, id, optionPattern) {
    E.settleCompanyChoice(state, step(month, id), choices(optionPattern));
  }

  /* 1 月 */
  allChoice(1, "m1-equipment", ["m1-D", "m1-B", "m1-C"]);

  /* 2 月 */
  enterMonth(state, 2);
  allChoice(2, "m2-envelope", ["m2-A", "m2-B", "m2-B"]);
  assert.ok(E.settleGovernmentPolicy(state, step(2, "m2-ecoPolicy"), "m2-plantingLight", "从轻植树").ok);

  /* 3 月 */
  enterMonth(state, 3);
  allChoice(3, "m3-teambuilding", ["m3-B", "m3-C", "m3-C"]);

  /* 4 月 */
  enterMonth(state, 4);
  assert.ok(E.settleGovernmentPolicy(state, step(4, "m4-publicHealth"), "m4-B", "").ok);
  E.settleDiceResults(state, step(4, "m4-dice"), Object.fromEntries(ids.map((id, index) => [id, [1, 3, 5][index % 3]])));

  /* 5 月 */
  enterMonth(state, 5);
  allChoice(5, "m5-pv", ["m5-A", "m5-C", "m5-B"]);

  /* 6 月 */
  enterMonth(state, 6);
  assert.ok(E.settleGovernmentPolicy(state, step(6, "m6-pvSubsidy"), "m6-A", "一次性补贴").ok);

  /* 7 月 */
  enterMonth(state, 7);
  allChoice(7, "m7-charger", ["m7-A", "m7-B", "m7-C"]);

  /* 8 月 */
  enterMonth(state, 8);
  allChoice(8, "m8-battery", ["m8-A", "m8-B", "m8-C"]);
  assert.ok(E.settleGovernmentPolicy(state, step(8, "m8-ecoPolicy"), "m8-reward", "奖励领先").ok);

  /* 9 月 */
  enterMonth(state, 9);
  E.settleDiceResults(state, step(9, "m9-typhoonPV"), { B: 1, C: 2 });
  assert.ok(E.settleGovernmentPolicy(state, step(9, "m9-blackout"), "m9-C", "救灾").ok);
  E.settleAutoEvent(state, step(9, "m9-selfPower"));

  /* 10 月 */
  enterMonth(state, 10);
  E.settleAutoEvent(state, step(10, "m10-oil"));

  /* 11 月 */
  enterMonth(state, 11);
  const decisions = Object.fromEntries(ids.map((id, index) => [
    id,
    index % 3 === 0
      ? { optionId: "m11-C" }
      : index % 3 === 1
        ? { optionId: "m11-B", retrofitId: "m11-R4" }
        : { optionId: "m11-A" },
  ]));
  const retrofits = Object.fromEntries(ids
    .filter((id, index) => index % 3 === 1)
    .map(id => [id, "m11-R4"]));
  E.settleCompanyChoice(state, step(11, "m11-apply"), decisions);
  E.settleRetrofit(state, step(11, "m11-apply"), retrofits);
  E.finalizeZeroCarbon(state, decisions, retrofits);
  const funding = Object.fromEntries(ids.map((id, index) => [id, index % 3 === 2 ? 10 : 0]));
  assert.ok(E.settlePilotFunding(state, step(11, "m11-funding"), funding, {}).ok);
  assert.ok(E.settleGovernmentPolicy(state, step(11, "m11-ecoPolicy"), "m11-plantingLight", "补生态短板").ok);

  /* 12 月 */
  enterMonth(state, 12);
  allChoice(12, "m12-smog", ["m12-A", "m12-B", "m12-B"]);
  E.settleAutoEvent(state, step(12, "m12-lowEfficiency"));
  state.finished = true;
  return state;
}

console.log("== 完整流程 ==");

test("12 个月后企业终值与手工推演一致", () => {
  const state = playFullGame();
  assert.strictEqual(company(state, "A").economy, 65);
  assert.strictEqual(company(state, "A").ecology, -10);
  assert.strictEqual(company(state, "B").economy, 78);
  assert.strictEqual(company(state, "B").ecology, 112);
  assert.strictEqual(company(state, "C").economy, 96);
  assert.strictEqual(company(state, "C").ecology, 100);
  assert.strictEqual(state.government.finance, 58);
  assert.strictEqual(company(state, "A").assets.lowEfficiency, true);
  assert.strictEqual(company(state, "B").assets.lowEfficiency, false);
});

test("3 月没有收益流；6 月补贴也不生成收益流", () => {
  const state = playFullGame();
  assert.ok(!company(state, "A").streams.some(item => item.id === "m3-B"));
  assert.ok(!company(state, "B").streams.some(item => item.id === "m6-A"));
  assert.ok(!company(state, "C").streams.some(item => item.id === "m6-A"));
});

test("后续收益流清单符合新规则", () => {
  const state = playFullGame();
  assert.deepStrictEqual(company(state, "A").streams.map(item => item.id), ["m1-D", "m10-oil"]);
  assert.deepStrictEqual(company(state, "B").streams.map(item => item.id), [
    "m1-B", "m2-B", "m5-C", "m7-B", "m8-B", "m11-R4",
  ]);
  assert.deepStrictEqual(company(state, "C").streams.map(item => item.id), [
    "m1-C", "m2-B", "m5-B", "m7-C", "m8-C",
  ]);
});

test("生态政策记录为互斥的植树或奖励选项", () => {
  const state = playFullGame();
  const ids = state.government.policyLog
    .filter(item => /planting|reward/.test(item.policyId))
    .map(item => item.policyId);
  assert.deepStrictEqual(ids, ["m2-plantingLight", "m8-reward", "m11-plantingLight"]);
});

test("年终排名与政府目标按新口径计算", () => {
  const state = playFullGame();
  const final = E.computeFinal(state);
  assert.deepStrictEqual(final.ranking.map(item => item.id), ["C", "B", "A"]);
  assert.strictEqual(final.ranking[0].total, 196);
  assert.strictEqual(final.totalEcology, 202);
  assert.strictEqual(final.totalEconomy, 239);
  assert.strictEqual(final.govFinance, 58);
});

test("6 家企业全流程都能决策、计分并排名", () => {
  const state = playFullGame(6);
  const final = E.computeFinal(state);
  assert.strictEqual(state.companies.map(item => item.id).join(""), "ABCDEF");
  assert.strictEqual(final.ranking.length, 6);
  assert.deepStrictEqual(final.ranking.map(item => item.id), ["C", "F", "E", "B", "A", "D"]);
  assert.strictEqual(final.totalEcology, 384);
  assert.strictEqual(final.totalEconomy, 498);
  assert.strictEqual(final.govFinance, 96);
  assert.strictEqual(final.goals.ecology.target, 420);
  assert.strictEqual(final.goals.economy.target, 480);
  assert.strictEqual(final.goals.ecology.achieved, false);
  assert.ok(final.goals.economy.achieved);
  assert.ok(state.companies.every(item => item.history.some(record => record.month === 12)));
});

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
