const E = require("../web/js/engine.js");
const EV = require("../web/js/events.js");

function step(month, index) {
  return EV.MONTHS.find((m) => m.month === month).steps[index];
}

function enterMonth(state, month) {
  state.month = month;
  state.stepIndex = 0;
  E.settleMonthOpening(state);
  while (state.rescuePending) E.resolveRescue(state, true, "代表路线模拟：维持经营");
}

function run(name, route, overrides = {}, others = {}) {
  const state = E.createGame({
    companyNames: { A: name + " 基准", B: "对照 1", C: "对照 2" },
    autoDice: false,
  });
  const decisions = (month, index) => {
    const pick = (cid) => {
      const r = others[cid] || route;
      const option = r[month];
      return { optionId: option, retrofitId: option === "m11-B" ? (others.retrofit && others.retrofit[cid] ? others.retrofit[cid] : (overrides.retrofit || "m11-R1")) : undefined };
    };
    return { A: pick("A"), B: pick("B"), C: pick("C") };
  };

  E.settleCompanyChoice(state, step(1, 0), decisions(1));
  enterMonth(state, 2);
  E.settleCompanyChoice(state, step(2, 0), decisions(2));
  E.settleGovernmentPolicy(state, step(2, 1), "m2-ecoBothLight", "中性从轻");
  enterMonth(state, 3);
  E.settleCompanyChoice(state, step(3, 0), decisions(3));
  enterMonth(state, 4);
  E.settleGovernmentPolicy(state, step(4, 0), overrides.m4Policy || "m4-B", "中性：正常生产");
  E.settleDiceResults(state, step(4, 1), { A: overrides.m4Roll || 3, B: overrides.m4Roll || 3, C: overrides.m4Roll || 3 });
  while (state.rescuePending) E.resolveRescue(state, overrides.rescue !== false, "代表路线模拟");
  enterMonth(state, 5);
  E.settleCompanyChoice(state, step(5, 0), decisions(5));
  enterMonth(state, 6);
  E.settleGovernmentPolicy(state, step(6, 0), "m6-A", "中性：给光伏补贴");
  enterMonth(state, 7);
  E.settleCompanyChoice(state, step(7, 0), decisions(7));
  enterMonth(state, 8);
  E.settleCompanyChoice(state, step(8, 0), decisions(8));
  E.settleGovernmentPolicy(state, step(8, 1), "m8-ecoBothLight", "中性从轻");
  while (state.rescuePending) E.resolveRescue(state, overrides.rescue !== false, "代表路线模拟");
  enterMonth(state, 9);
  const pvRoll = overrides.pvStormRoll || 2;
  const rolls = {};
  for (const c of state.companies) if (c.assets.rooftopPV) rolls[c.id] = pvRoll;
  E.settleDiceResults(state, step(9, 0), rolls);
  E.settleGovernmentPolicy(state, step(9, 1), "m9-B", "中性：部分限电");
  E.settleAutoEvent(state, step(9, 2));
  while (state.rescuePending) E.resolveRescue(state, overrides.rescue !== false, "代表路线模拟");
  enterMonth(state, 10);
  E.settleAutoEvent(state, step(10, 0));
  while (state.rescuePending) E.resolveRescue(state, overrides.rescue !== false, "代表路线模拟");
  enterMonth(state, 11);
  E.settleCompanyChoice(state, step(11, 0), decisions(11));
  if (route[11] === "m11-B") {
    E.settleRetrofit(state, step(11, 0), Object.fromEntries(["A", "B", "C"].map((id) => [id, decisions(11).A.retrofitId])));
  }
  E.finalizeZeroCarbon(state, decisions(11), {});
  const amount = overrides.funding === undefined ? 20 : overrides.funding;
  E.settlePilotFunding(state, step(11, 1), Object.fromEntries(["A", "B", "C"].map((id) => [id, amount])), { A: "模拟中间档" });
  E.settleGovernmentPolicy(state, step(11, 2), "m11-ecoBothLight", "中性从轻");
  while (state.rescuePending) E.resolveRescue(state, overrides.rescue !== false, "代表路线模拟");
  enterMonth(state, 12);
  E.settleCompanyChoice(state, step(12, 0), decisions(12));
  while (state.rescuePending) E.resolveRescue(state, overrides.rescue !== false, "代表路线模拟");
  state.finished = true;
  const c = E.getCompany(state, "A");
  const fin = E.computeFinal(state).ranking.find((x) => x.id === "A");
  return {
    name,
    economy: c.economy,
    ecology: c.ecology,
    total: fin.total,
    assets: E.qualifiedAssets(c.assets) + " 项资格资产",
    finance: state.government.finance,
  };
}

const routes = [
  run("绿色冠军", { 1: "m1-C", 2: "m2-B", 3: "m3-C", 5: "m5-C", 7: "m7-C", 8: "m8-B", 11: "m11-A", 12: "m12-B" }),
  run("稳健转型", { 1: "m1-B", 2: "m2-B", 3: "m3-C", 5: "m5-C", 7: "m7-B", 8: "m8-B", 11: "m11-A", 12: "m12-B" }),
  run("补装冲刺", { 1: "m1-C", 2: "m2-B", 3: "m3-C", 5: "m5-A", 7: "m7-C", 8: "m8-A", 11: "m11-B", 12: "m12-B" }, { retrofit: "m11-R1" }),
  run("抗灾韧性", { 1: "m1-C", 2: "m2-B", 3: "m3-C", 5: "m5-C", 7: "m7-C", 8: "m8-B", 11: "m11-A", 12: "m12-B" }, { pvStormRoll: 1 }),
  run("高碳风险", { 1: "m1-D", 2: "m2-A", 3: "m3-B", 5: "m5-A", 7: "m7-A", 8: "m8-A", 11: "m11-C", 12: "m12-A" }),
  run("濒危获救", { 1: "m1-D", 2: "m2-A", 3: "m3-B", 5: "m5-A", 7: "m7-A", 8: "m8-A", 11: "m11-C", 12: "m12-A" }, { m4Roll: 1 }, {
    B: { 1: "m1-B", 2: "m2-A", 3: "m3-C", 5: "m5-A", 7: "m7-A", 8: "m8-A", 11: "m11-C", 12: "m12-A" },
    C: { 1: "m1-B", 2: "m2-A", 3: "m3-C", 5: "m5-A", 7: "m7-A", 8: "m8-A", 11: "m11-C", 12: "m12-A" },
  }),
  run("政策弃救", { 1: "m1-D", 2: "m2-A", 3: "m3-B", 5: "m5-A", 7: "m7-A", 8: "m8-A", 11: "m11-C", 12: "m12-A" }, { m4Roll: 1, rescue: false }, {
    B: { 1: "m1-B", 2: "m2-A", 3: "m3-C", 5: "m5-A", 7: "m7-A", 8: "m8-A", 11: "m11-C", 12: "m12-A" },
    C: { 1: "m1-B", 2: "m2-A", 3: "m3-C", 5: "m5-A", 7: "m7-A", 8: "m8-A", 11: "m11-C", 12: "m12-A" },
  }),
  run("设备空转", { 1: "m1-A", 2: "m2-A", 3: "m3-A", 5: "m5-C", 7: "m7-C", 8: "m8-B", 11: "m11-A", 12: "m12-B" }, { pvStormRoll: 1 }),
  run("错失试点", { 1: "m1-C", 2: "m2-B", 3: "m3-C", 5: "m5-C", 7: "m7-C", 8: "m8-B", 11: "m11-C", 12: "m12-B" }),
  run("资金保守", { 1: "m1-C", 2: "m2-B", 3: "m3-C", 5: "m5-C", 7: "m7-C", 8: "m8-B", 11: "m11-A", 12: "m12-B" }, { funding: 0 }),
];

console.table(routes);
