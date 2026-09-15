const E = require("../web/js/engine.js");
const EV = require("../web/js/events.js");

const IDS = ["A", "B", "C"];

function step(monthNo, id) {
  const monthData = EV.MONTHS.find(item => item.month === monthNo);
  return monthData.steps.find(item => item.id === id);
}

function enterMonth(state, month) {
  state.month = month;
  state.stepIndex = 0;
  E.settleMonthOpening(state);
  resolveRescues(state, true);
}

function resolveRescues(state, approve) {
  let guard = 0;
  while (state.rescuePending && guard < 6) {
    E.resolveRescue(state, approve, "simulation");
    guard++;
  }
}

function allChoice(state, stepId, choiceByCompany) {
  const decisions = {};
  for (const id of IDS) decisions[id] = { optionId: choiceByCompany[id] };
  return E.settleCompanyChoice(state, step(state.month, stepId), decisions);
}

function ecoPolicy(state, stepId, mode, heavy) {
  const s = step(state.month, stepId);
  const prefix = stepId.replace("-ecoPolicy", "");
  const target = mode === "reward"
    ? E.policyTargets(state, { target: "ecoHighest" })
    : E.policyTargets(state, { target: "ecoLowest" });
  if (mode === "reward") return E.settleGovernmentPolicy(state, s, `${prefix}-reward`, "reward");
  const choice = heavy ? `${prefix}-plantingHeavy` : `${prefix}-plantingLight`;
  return E.settleGovernmentPolicy(state, s, choice, heavy ? "heavy" : "light");
}

function simulate(routes, gov) {
  const state = E.createGame({
    companyNames: { A: "A", B: "B", C: "C" },
    autoDice: false,
  });

  E.settleCompanyChoice(state, step(1, "m1-equipment"), pick(routes, "m1"));

  enterMonth(state, 2);
  allChoice(state, "m2-envelope", mapChoice(routes, "m2"));
  ecoPolicy(state, "m2-ecoPolicy", gov.eco2, false);

  enterMonth(state, 3);
  allChoice(state, "m3-teambuilding", mapChoice(routes, "m3"));

  enterMonth(state, 4);
  E.settleGovernmentPolicy(state, step(4, "m4-publicHealth"), gov.covid, "covid");
  E.settleDiceResults(state, step(4, "m4-dice"), { A: 3, B: 3, C: 3 });

  enterMonth(state, 5);
  allChoice(state, "m5-pv", mapChoice(routes, "m5"));

  enterMonth(state, 6);
  E.settleGovernmentPolicy(state, step(6, "m6-pvSubsidy"), gov.pvSubsidy, "pv");

  enterMonth(state, 7);
  allChoice(state, "m7-charger", mapChoice(routes, "m7"));

  enterMonth(state, 8);
  allChoice(state, "m8-battery", mapChoice(routes, "m8"));
  ecoPolicy(state, "m8-ecoPolicy", gov.eco8, false);

  enterMonth(state, 9);
  const rolls = {};
  for (const id of IDS) if (E.getCompany(state, id).assets.rooftopPV) rolls[id] = 1;
  E.settleDiceResults(state, step(9, "m9-typhoonPV"), rolls);
  E.settleGovernmentPolicy(state, step(9, "m9-blackout"), gov.blackout, "blackout");
  E.settleAutoEvent(state, step(9, "m9-selfPower"));

  enterMonth(state, 10);
  E.settleAutoEvent(state, step(10, "m10-oil"));

  enterMonth(state, 11);
  const decisions = {};
  const retrofitDecisions = {};
  for (const id of IDS) {
    decisions[id] = { optionId: routes[id].m11 };
    if (routes[id].retrofit) retrofitDecisions[id] = routes[id].retrofit;
  }
  E.settleCompanyChoice(state, step(11, "m11-apply"), decisions, retrofitDecisions);
  E.settleRetrofit(state, step(11, "m11-apply"), retrofitDecisions);
  const apps = E.finalizeZeroCarbon(state, decisions, retrofitDecisions);
  const funding = {};
  for (const id of IDS) funding[id] = apps[id] && apps[id].eligible ? gov.pilotFunding : 0;
  let fundingResult = E.settlePilotFunding(state, step(11, "m11-funding"), funding, {});
  if (!fundingResult.ok) {
    for (const id of IDS) funding[id] = 0;
    fundingResult = E.settlePilotFunding(state, step(11, "m11-funding"), funding, {});
  }
  ecoPolicy(state, "m11-ecoPolicy", gov.eco11, gov.eco11Heavy);

  enterMonth(state, 12);
  allChoice(state, "m12-smog", mapChoice(routes, "m12"));
  resolveRescues(state, gov.approveRescue);
  state.finished = true;

  return {
    state,
    final: E.computeFinal(state),
    fundingResult,
    routes,
    gov,
  };
}

function pick(routes, key) {
  const result = {};
  for (const id of IDS) result[id] = { optionId: routes[id][key] };
  return result;
}

function mapChoice(routes, key) {
  const result = {};
  for (const id of IDS) result[id] = routes[id][key];
  return result;
}

const R = {
  passive: { m1: "m1-A", m2: "m2-A", m3: "m3-C", m5: "m5-A", m7: "m7-A", m8: "m8-A", m11: "m11-C", m12: "m12-A" },
  extractive: { m1: "m1-D", m2: "m2-A", m3: "m3-C", m5: "m5-A", m7: "m7-A", m8: "m8-A", m11: "m11-C", m12: "m12-A" },
  efficient: { m1: "m1-B", m2: "m2-B", m3: "m3-C", m5: "m5-A", m7: "m7-A", m8: "m8-A", m11: "m11-C", m12: "m12-A" },
  pragmaticGreen: { m1: "m1-B", m2: "m2-B", m3: "m3-C", m5: "m5-C", m7: "m7-B", m8: "m8-A", m11: "m11-B", retrofit: "m11-R3", m12: "m12-A" },
  fullGreen: { m1: "m1-B", m2: "m2-B", m3: "m3-C", m5: "m5-C", m7: "m7-C", m8: "m8-B", m11: "m11-A", m12: "m12-A" },
  maxGreen: { m1: "m1-C", m2: "m2-B", m3: "m3-C", m5: "m5-C", m7: "m7-C", m8: "m8-B", m11: "m11-A", m12: "m12-B" },
  riskyGreen: { m1: "m1-D", m2: "m2-B", m3: "m3-C", m5: "m5-C", m7: "m7-C", m8: "m8-B", m11: "m11-A", m12: "m12-A" },
};

const GOVS = {
  austerity: { eco2: "plant", eco8: "plant", eco11: "plant", covid: "m4-B", pvSubsidy: "m6-B", blackout: "m9-B", pilotFunding: 0, approveRescue: false },
  supportive: { eco2: "reward", eco8: "reward", eco11: "reward", covid: "m4-B", pvSubsidy: "m6-A", blackout: "m9-C", pilotFunding: 10, approveRescue: true },
  balanced: { eco2: "plant", eco8: "plant", eco11: "plant", covid: "m4-B", pvSubsidy: "m6-A", blackout: "m9-B", pilotFunding: 10, approveRescue: true },
};

function compact(result) {
  const companies = {};
  for (const c of result.state.companies) {
    companies[c.id] = {
      route: result.routes[c.id].retrofit ? result.routes[c.id].m1 + "+" + result.routes[c.id].retrofit : result.routes[c.id].m1,
      economy: c.economy,
      ecology: c.ecology,
      total: c.economy + c.ecology,
      assets: c.assets,
      rescueUsed: !!result.state.rescueUsed[c.id],
    };
  }
  return {
    companies,
    totalEcology: result.final.totalEcology,
    totalEconomy: result.final.totalEconomy,
    finance: result.final.govFinance,
    goals: result.final.goals,
  };
}

function run(label, routes, gov) {
  const result = simulate(routes, gov);
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify(compact(result), null, 2));
  if (!result.fundingResult.ok) console.log("funding fail: " + result.fundingResult.error);
  return result;
}

const same = name => ({ A: R[name], B: R[name], C: R[name] });

if (process.env.RUN !== "0") {
  for (const name of ["passive", "extractive", "efficient", "pragmaticGreen", "fullGreen", "maxGreen", "riskyGreen"]) {
    run(`${name} / balanced gov`, same(name), GOVS.balanced);
  }

  run(
    "mixed / austerity",
    { A: R.extractive, B: R.pragmaticGreen, C: R.fullGreen },
    GOVS.austerity
  );
  run(
    "mixed / supportive",
    { A: R.extractive, B: R.pragmaticGreen, C: R.fullGreen },
    GOVS.supportive
  );
  run(
    "mixed / balanced",
    { A: R.extractive, B: R.pragmaticGreen, C: R.fullGreen },
    GOVS.balanced
  );
}

module.exports = { simulate, R, GOVS };
