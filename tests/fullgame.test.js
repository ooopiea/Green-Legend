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

function playFullGame() {
  const state = E.createGame({
    companyNames: { A: "激进扩张", B: "均衡绿色", C: "深度低碳" },
    governmentName: "市政府",
    autoDice: false,
  });

  function allChoice(month, id, optionId) {
    E.settleCompanyChoice(state, step(month, id), {
      A: { optionId }, B: { optionId }, C: { optionId },
    });
  }

  /* 1 月 */
  E.settleCompanyChoice(state, step(1, "m1-equipment"), {
    A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-C" },
  });

  /* 2 月 */
  enterMonth(state, 2);
  E.settleCompanyChoice(state, step(2, "m2-envelope"), {
    A: { optionId: "m2-A" }, B: { optionId: "m2-B" }, C: { optionId: "m2-B" },
  });
  assert.ok(E.settleGovernmentPolicy(state, step(2, "m2-ecoPolicy"), "m2-plantingLight", "从轻植树").ok);

  /* 3 月 */
  enterMonth(state, 3);
  E.settleCompanyChoice(state, step(3, "m3-teambuilding"), {
    A: { optionId: "m3-B" }, B: { optionId: "m3-C" }, C: { optionId: "m3-C" },
  });

  /* 4 月 */
  enterMonth(state, 4);
  assert.ok(E.settleGovernmentPolicy(state, step(4, "m4-publicHealth"), "m4-B", "").ok);
  E.settleDiceResults(state, step(4, "m4-dice"), { A: 1, B: 3, C: 5 });

  /* 5 月 */
  enterMonth(state, 5);
  E.settleCompanyChoice(state, step(5, "m5-pv"), {
    A: { optionId: "m5-A" }, B: { optionId: "m5-C" }, C: { optionId: "m5-B" },
  });

  /* 6 月 */
  enterMonth(state, 6);
  assert.ok(E.settleGovernmentPolicy(state, step(6, "m6-pvSubsidy"), "m6-A", "一次性补贴").ok);

  /* 7 月 */
  enterMonth(state, 7);
  E.settleCompanyChoice(state, step(7, "m7-charger"), {
    A: { optionId: "m7-A" }, B: { optionId: "m7-B" }, C: { optionId: "m7-C" },
  });

  /* 8 月 */
  enterMonth(state, 8);
  E.settleCompanyChoice(state, step(8, "m8-battery"), {
    A: { optionId: "m8-A" }, B: { optionId: "m8-B" }, C: { optionId: "m8-C" },
  });
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
  const decisions = {
    A: { optionId: "m11-C" },
    B: { optionId: "m11-B", retrofitId: "m11-R4" },
    C: { optionId: "m11-A" },
  };
  E.settleCompanyChoice(state, step(11, "m11-apply"), decisions);
  E.settleRetrofit(state, step(11, "m11-apply"), { B: "m11-R4" });
  E.finalizeZeroCarbon(state, decisions, { B: "m11-R4" });
  assert.ok(E.settlePilotFunding(state, step(11, "m11-funding"), { B: 0, C: 10 }, {}).ok);
  assert.ok(E.settleGovernmentPolicy(state, step(11, "m11-ecoPolicy"), "m11-plantingLight", "补生态短板").ok);

  /* 12 月 */
  enterMonth(state, 12);
  E.settleCompanyChoice(state, step(12, "m12-smog"), {
    A: { optionId: "m12-A" }, B: { optionId: "m12-B" }, C: { optionId: "m12-B" },
  });
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

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
