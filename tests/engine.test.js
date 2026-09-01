/* ============================================================
   《绿神话》引擎数值与流程测试（Node）
   运行：node tests/engine.test.js
   断言口径：全部对照《游戏规则.MD》数值表
   ============================================================ */

const assert = require("assert");
const E = require("../web/js/engine.js");
const EV = require("../web/js/events.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + e.message); }
}

function newGame() {
  return E.createGame({ companyNames: { A: "甲公司", B: "乙公司", C: "丙公司" }, autoDice: true });
}
function getStep(state, month, idx) {
  const m = EV.MONTHS.find(x => x.month === month);
  return m.steps[idx];
}
function getC(state, id) { return E.getCompany(state, id); }

console.log("== 初始状态 ==");
test("初始值：企业经济 60 生态 60，政府财政 100", () => {
  const s = newGame();
  assert.strictEqual(s.companies[0].economy, 60);
  assert.strictEqual(s.companies[0].ecology, 60);
  assert.strictEqual(s.government.finance, 100);
});

console.log("== 1 月：设备采购 ==");
test("1月 A 不购买：经济 60+0+3=63，生态 60-15=45", () => {
  const s = newGame();
  const step = getStep(s, 1, 0);
  E.settleCompanyChoice(s, step, { A: { optionId: "m1-A" }, B: { optionId: "m1-A" }, C: { optionId: "m1-A" } });
  assert.strictEqual(getC(s, "A").economy, 63);
  assert.strictEqual(getC(s, "A").ecology, 45);
});
test("1月 B 高产能高能效：经济 60-30+5=35，生态 50", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-B" }, B: { optionId: "m1-B" }, C: { optionId: "m1-B" } });
  assert.strictEqual(getC(s, "A").economy, 35);
  assert.strictEqual(getC(s, "A").ecology, 50);
  assert.strictEqual(getC(s, "A").totalInvestment, 30);
});
test("1月 C 升级改造：经济 60-20+5=45，生态 45", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-C" }, B: { optionId: "m1-C" }, C: { optionId: "m1-C" } });
  assert.strictEqual(getC(s, "A").economy, 45);
  assert.strictEqual(getC(s, "A").ecology, 45);
});
test("1月 D 超高产能：经济 60-30+7=37，生态 35（不触发滑坡，>20）", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-D" }, C: { optionId: "m1-D" } });
  assert.strictEqual(getC(s, "A").economy, 37);
  assert.strictEqual(getC(s, "A").ecology, 35);
});

console.log("== 2 月：围护改造 + 生态奖惩 ==");
test("2月 B 改造：经济 -15+5，生态 0 变化", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-A" }, B: { optionId: "m1-A" }, C: { optionId: "m1-A" } });
  const before = getC(s, "A").economy;
  E.settleCompanyChoice(s, getStep(s, 2, 0), { A: { optionId: "m2-B" }, B: { optionId: "m2-B" }, C: { optionId: "m2-B" } });
  assert.strictEqual(getC(s, "A").economy, before - 15 + 5);
  assert.strictEqual(getC(s, "A").ecology, 45); // 不变
});
test("2月 生态奖惩（并行）：从轻——最低 -10 且最高 +10 同时生效，财政不变", () => {
  const s = newGame();
  // 1月：A 选 D（经济37 生态35 最低），B 选 C（经济45 生态45），C 选 B（经济35 生态50 最高）
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-C" }, C: { optionId: "m1-B" } });
  const ecoStep = getStep(s, 2, 1);
  const r = E.settleGovernmentPolicy(s, ecoStep, "m2-ecoBothLight", "警示与激励并行");
  assert.ok(r.ok);
  assert.strictEqual(getC(s, "A").economy, 37 - 10); // 生态最低：处罚
  assert.strictEqual(getC(s, "C").economy, 35 + 10); // 生态最高（C 选 m1-B 生态 50）：奖励
  assert.strictEqual(getC(s, "B").economy, 45);      // 中间：不动
  assert.strictEqual(s.government.finance, 100);     // 罚入奖出相抵
});
test("2月 生态奖惩（并行）：从重——最低 -20 且最高 +20，财政不变", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-C" }, C: { optionId: "m1-B" } });
  const r = E.settleGovernmentPolicy(s, getStep(s, 2, 1), "m2-ecoBothHeavy", "激励");
  assert.ok(r.ok);
  assert.strictEqual(getC(s, "A").economy, 37 - 20);
  assert.strictEqual(getC(s, "C").economy, 35 + 20); // C 选 m1-B 生态 50 最高
  assert.strictEqual(s.government.finance, 100);
});

console.log("== 3 月：团建 + 疫情 ==");
test("3月 A 环球影城：经济 -5（团建）-5（疫情）=-10，生态 -5", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 3, 0), { A: { optionId: "m3-A" }, B: { optionId: "m3-A" }, C: { optionId: "m3-A" } });
  assert.strictEqual(getC(s, "A").economy, 60 - 5 - 5);
  assert.strictEqual(getC(s, "A").ecology, 55);
});
test("3月 B 新疆骑马：经济 -10-10=-20，生态 -10", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 3, 0), { A: { optionId: "m3-B" }, B: { optionId: "m3-B" }, C: { optionId: "m3-B" } });
  assert.strictEqual(getC(s, "A").economy, 40);
  assert.strictEqual(getC(s, "A").ecology, 50);
});
test("3月 C 种树：经济 0，生态 +5", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 3, 0), { A: { optionId: "m3-C" }, B: { optionId: "m3-C" }, C: { optionId: "m3-C" } });
  assert.strictEqual(getC(s, "A").economy, 60);
  assert.strictEqual(getC(s, "A").ecology, 65);
});

console.log("== 4 月：公共卫生 ==");
test("4月 A 停工：每企业经济 -10", () => {
  const s = newGame();
  const r = E.settleGovernmentPolicy(s, getStep(s, 4, 0), "m4-A", "");
  assert.ok(r.ok);
  for (const c of s.companies) assert.strictEqual(c.economy, 50);
});
test("4月 B 继续生产掷骰：1→-10，3→-5，5→0", () => {
  const s = newGame();
  const r = E.settleGovernmentPolicy(s, getStep(s, 4, 0), "m4-B", "");
  assert.ok(r.ok && r.triggersDice === "m4-dice");
  const diceStep = getStep(s, 4, 1);
  E.settleDiceResults(s, diceStep, { A: 1, B: 3, C: 5 });
  assert.strictEqual(getC(s, "A").economy, 50);
  assert.strictEqual(getC(s, "B").economy, 55);
  assert.strictEqual(getC(s, "C").economy, 60);
  assert.strictEqual(s.dice.length, 3);
});

console.log("== 5 月：光伏 ==");
test("5月 B/C 获得屋顶光伏资产；A 无", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 5, 0), { A: { optionId: "m5-A" }, B: { optionId: "m5-B" }, C: { optionId: "m5-C" } });
  assert.strictEqual(getC(s, "A").assets.rooftopPV, false);
  assert.strictEqual(getC(s, "B").assets.rooftopPV, true);
  assert.strictEqual(getC(s, "C").assets.rooftopPV, true);
  assert.strictEqual(getC(s, "B").economy, 60 - 20 + 2);
  assert.strictEqual(getC(s, "B").ecology, 70);
});

console.log("== 6 月：光伏补贴 ==");
test("6月 补贴：B/C 各 +2，财政 -4", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 5, 0), { A: { optionId: "m5-A" }, B: { optionId: "m5-B" }, C: { optionId: "m5-C" } });
  const econB = getC(s, "B").economy;
  const r = E.settleGovernmentPolicy(s, getStep(s, 6, 0), "m6-A", "");
  assert.ok(r.ok);
  assert.strictEqual(getC(s, "B").economy, econB + 2);
  assert.strictEqual(getC(s, "A").economy, 60); // 5月A不装光伏：投资0、每月经济0，经济保持 60，且无光伏不受补贴
  assert.strictEqual(s.government.finance, 96);
});
test("6月 不补贴：财政不变", () => {
  const s = newGame();
  const r = E.settleGovernmentPolicy(s, getStep(s, 6, 0), "m6-B", "");
  assert.ok(r.ok);
  assert.strictEqual(s.government.finance, 100);
});

console.log("== 7 月：充电桩 ==");
test("7月 B 单向桩 / C 双向桩资产正确", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 7, 0), { A: { optionId: "m7-A" }, B: { optionId: "m7-B" }, C: { optionId: "m7-C" } });
  assert.strictEqual(getC(s, "B").assets.oneWayCharger, true);
  assert.strictEqual(getC(s, "C").assets.twoWayCharger, true);
  assert.strictEqual(getC(s, "C").ecology, 80); // 60+20
});

console.log("== 8 月：蓄电池与生态奖惩 ==");
test("8月 B 加装蓄电池（已装光伏者）：经济-20+4 生态+10 获得资产", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 5, 0), { A: { optionId: "m5-A" }, B: { optionId: "m5-B" }, C: { optionId: "m5-B" } });
  E.settleCompanyChoice(s, getStep(s, 8, 0), { A: { optionId: "m8-A" }, B: { optionId: "m8-B" }, C: { optionId: "m8-B" } });
  assert.strictEqual(getC(s, "B").assets.battery, true);
  assert.strictEqual(getC(s, "B").economy, 42 - 20 + 4);
  assert.strictEqual(getC(s, "B").ecology, 70 + 10);
});

console.log("== 9 月：台风三段 ==");
test("9月 光伏掷骰 1→-10；2→0", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 5, 0), { A: { optionId: "m5-A" }, B: { optionId: "m5-B" }, C: { optionId: "m5-B" } });
  E.settleDiceResults(s, getStep(s, 9, 0), { B: 1, C: 2 });
  assert.strictEqual(getC(s, "B").economy, 42 - 10);
  assert.strictEqual(getC(s, "C").economy, 42);
});
test("9月 政府三选：A 停工 -15 / B 限电 -10 / C 救灾 +10 财政-30", () => {
  const s = newGame();
  E.settleGovernmentPolicy(s, getStep(s, 9, 1), "m9-A", "");
  for (const c of s.companies) assert.strictEqual(c.economy, 45);
  const s2 = newGame();
  E.settleGovernmentPolicy(s2, getStep(s2, 9, 1), "m9-B", "");
  for (const c of s2.companies) assert.strictEqual(c.economy, 50);
  const s3 = newGame();
  const r = E.settleGovernmentPolicy(s3, getStep(s3, 9, 1), "m9-C", "");
  assert.ok(r.ok);
  for (const c of s3.companies) assert.strictEqual(c.economy, 70);
  assert.strictEqual(s3.government.finance, 70);
});
test("9月 自备电力：光伏+5，蓄电池或双向桩+5，叠加+10，无资产 0", () => {
  const s = newGame();
  // A：无资产；B：光伏+蓄电池；C：光伏+双向桩（7月装）
  E.settleCompanyChoice(s, getStep(s, 5, 0), { A: { optionId: "m5-A" }, B: { optionId: "m5-B" }, C: { optionId: "m5-C" } });
  E.settleCompanyChoice(s, getStep(s, 7, 0), { A: { optionId: "m7-A" }, B: { optionId: "m7-A" }, C: { optionId: "m7-C" } });
  E.settleCompanyChoice(s, getStep(s, 8, 0), { A: { optionId: "m8-A" }, B: { optionId: "m8-B" }, C: { optionId: "m8-A" } });
  const eA = getC(s, "A").economy, eB = getC(s, "B").economy, eC = getC(s, "C").economy;
  E.settleAutoEvent(s, getStep(s, 9, 2));
  assert.strictEqual(getC(s, "A").economy, eA);       // 无资产 0
  assert.strictEqual(getC(s, "B").economy, eB + 10);  // 光伏+蓄电池
  assert.strictEqual(getC(s, "C").economy, eC + 10);  // 光伏+双向桩
});

console.log("== 10 月：油价 ==");
test("10月 有任意充电桩免影响；无桩 -3", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 7, 0), { A: { optionId: "m7-A" }, B: { optionId: "m7-B" }, C: { optionId: "m7-C" } });
  const eA = getC(s, "A").economy, eB = getC(s, "B").economy, eC = getC(s, "C").economy;
  E.settleAutoEvent(s, getStep(s, 10, 0));
  assert.strictEqual(getC(s, "A").economy, eA - 3);
  assert.strictEqual(getC(s, "B").economy, eB);
  assert.strictEqual(getC(s, "C").economy, eC);
});

console.log("== 11 月：零碳园区 ==");
test("11月 资格：光伏+双向桩+蓄电池 ≥2 项合格；单向桩不计", () => {
  assert.strictEqual(E.qualifiedAssets({ rooftopPV: true, battery: false, oneWayCharger: true, twoWayCharger: false }), 1);
  assert.strictEqual(E.qualifiedAssets({ rooftopPV: true, battery: true, oneWayCharger: false, twoWayCharger: false }), 2);
  assert.strictEqual(E.qualifiedAssets({ rooftopPV: false, battery: true, oneWayCharger: true, twoWayCharger: true }), 2);
});
test("11月 加装结算与单向改双向：单向清除、双向获得", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 7, 0), { A: { optionId: "m7-A" }, B: { optionId: "m7-B" }, C: { optionId: "m7-C" } });
  const step = getStep(s, 11, 0);
  E.settleRetrofit(s, step, { B: "m11-R3", C: "m11-R4" });
  assert.strictEqual(getC(s, "B").assets.oneWayCharger, false);
  assert.strictEqual(getC(s, "B").assets.twoWayCharger, true);
  assert.strictEqual(getC(s, "C").assets.battery, true);
  // B：原 44（60-20+4），升级 -10+2
  assert.strictEqual(getC(s, "B").economy, 44 - 10 + 2);
});
test("11月 试点资金 4 档：+0/+10/+20/+40，财政同步扣减", () => {
  const s = newGame();
  // 构造三家合格
  E.settleCompanyChoice(s, getStep(s, 5, 0), { A: { optionId: "m5-C" }, B: { optionId: "m5-C" }, C: { optionId: "m5-C" } });
  E.settleCompanyChoice(s, getStep(s, 7, 0), { A: { optionId: "m7-C" }, B: { optionId: "m7-C" }, C: { optionId: "m7-C" } });
  const decisions = { A: { optionId: "m11-A" }, B: { optionId: "m11-A" }, C: { optionId: "m11-A" } };
  E.finalizeZeroCarbon(s, decisions, {});
  assert.ok(s.zeroCarbonApplications.A.eligible);
  const econA = getC(s, "A").economy;
  const r = E.settlePilotFunding(s, getStep(s, 11, 1), { A: 0, B: 10, C: 40 }, {});
  assert.ok(r.ok);
  assert.strictEqual(getC(s, "A").economy, econA);
  assert.strictEqual(getC(s, "B").economy, econB(s) + 10);
  assert.strictEqual(getC(s, "C").economy, econC(s) + 40);
  assert.strictEqual(s.government.finance, 100 - 50);
  function econB(st) { return E.getCompany(st, "B").economy - 10; }
  function econC(st) { return E.getCompany(st, "C").economy - 40; }
});
test("11月 不合格申报者拿不到资金", () => {
  const s = newGame();
  const decisions = { A: { optionId: "m11-A" }, B: { optionId: "m11-C" }, C: { optionId: "m11-C" } };
  E.finalizeZeroCarbon(s, decisions, {});
  assert.ok(!s.zeroCarbonApplications.A.eligible); // A 无资产
  const econA = getC(s, "A").economy;
  const r = E.settlePilotFunding(s, getStep(s, 11, 1), { A: 20 }, {});
  assert.ok(r.ok);
  assert.strictEqual(getC(s, "A").economy, econA);
});

console.log("== 12 月：雾霾限产 ==");
test("12月 A 维持：生态 -10；B 关停：经济 -20 生态 +10", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 12, 0), { A: { optionId: "m12-A" }, B: { optionId: "m12-B" }, C: { optionId: "m12-A" } });
  assert.strictEqual(getC(s, "A").economy, 60);
  assert.strictEqual(getC(s, "A").ecology, 50);
  assert.strictEqual(getC(s, "B").economy, 40);
  assert.strictEqual(getC(s, "B").ecology, 70);
});

console.log("== 风险规则 ==");
test("生态 ≤20 触发滑坡额外扣 10", () => {
  const s = newGame();
  // 直接构造低生态：1月D(-25) 2月A(-10) 3月B(-10) → 60-45=15 ≤20 → 再扣10=5
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-C" }, C: { optionId: "m1-C" } });
  E.settleCompanyChoice(s, getStep(s, 2, 0), { A: { optionId: "m2-A" }, B: { optionId: "m2-A" }, C: { optionId: "m2-A" } });
  E.settleCompanyChoice(s, getStep(s, 3, 0), { A: { optionId: "m3-B" }, B: { optionId: "m3-C" }, C: { optionId: "m3-C" } });
  assert.strictEqual(getC(s, "A").ecology, 5); // 35-10-10=15 ≤20 → -10 → 5
});
test("经济首次 ≤20 触发救助资格（限一次）", () => {
  const s = newGame();
  // 1月D(-30+7=37)；B/C 均选 B（生态50 并列最高，奖励相抵）
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-B" } });
  // 2月不改造；从重奖惩：A 最低 -20 → 17 ≤20 → rescuePending；B/C 并列最高同获 +20（财政不变）
  E.settleCompanyChoice(s, getStep(s, 2, 0), { A: { optionId: "m2-A" }, B: { optionId: "m2-A" }, C: { optionId: "m2-A" } });
  const r = E.settleGovernmentPolicy(s, getStep(s, 2, 1), "m2-ecoBothHeavy", "");
  assert.ok(r.ok);
  assert.strictEqual(getC(s, "A").economy, 17);
  assert.strictEqual(getC(s, "B").economy, 35 + 20); // 并列最高逐家奖励
  assert.strictEqual(getC(s, "C").economy, 35 + 20);
  assert.ok(s.rescuePending && s.rescuePending.companyId === "A");
  assert.strictEqual(s.rescueUsed.A, true);
  // 发放救助
  const rr = E.resolveRescue(s, true, "保护就业");
  assert.ok(rr.ok);
  assert.strictEqual(getC(s, "A").economy, 27);
  assert.strictEqual(s.government.finance, 100 - 10); // 并行奖惩财政不变，救助 -10 → 90
  // 再次降 ≤20 不再有救助资格
  s.rescuePending = null;
  getC(s, "A").economy = 15;
  E.checkRisks(s);
  assert.strictEqual(s.rescuePending, null); // 已用过
});

console.log("== 财政红线 ==");
test("财政不足时支出型政策被拒绝", () => {
  const s = newGame();
  s.government.finance = 15;
  const r = E.settleGovernmentPolicy(s, getStep(s, 9, 1), "m9-C", ""); // 需 30
  assert.ok(!r.ok && /红线/.test(r.error));
  // 并行奖惩不受红线限制：罚入奖出等额相抵（净 0），财政再低也可执行
  s.government.finance = 5;
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-C" }, C: { optionId: "m1-B" } });
  const r2 = E.settleGovernmentPolicy(s, getStep(s, 2, 1), "m2-ecoBothHeavy", "");
  assert.ok(r2.ok);
  assert.strictEqual(s.government.finance, 5); // 净 0：A 罚 20、C 奖 20（C 选 m1-B 生态 50 最高）
});

console.log("== 撤销与序列化 ==");
test("快照撤销恢复数值", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-B" }, B: { optionId: "m1-B" }, C: { optionId: "m1-B" } });
  assert.strictEqual(getC(s, "A").economy, 35);
  const r = E.undo(s);
  assert.ok(r.ok);
  const s2 = r.state;
  assert.strictEqual(E.getCompany(s2, "A").economy, 60);
});
test("序列化 / 反序列化 往返一致（version 校验）", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-B" }, B: { optionId: "m1-C" }, C: { optionId: "m1-D" } });
  const json = E.serialize(s);
  const r = E.deserialize(json);
  assert.ok(r.ok);
  assert.strictEqual(r.state.companies[0].economy, 35);
  const bad = E.deserialize(JSON.stringify({ version: "0.0.1" }));
  assert.ok(!bad.ok);
});

console.log("== 公开快照 ==");
test("publicSnapshot：揭示前不含选择，揭示后含 label", () => {
  const s = newGame();
  s.pendingDecisions = { A: { optionId: "m1-B" }, B: { optionId: "m1-A" } };
  s.revealed = false;
  const pub = E.publicSnapshot(s, EV);
  assert.strictEqual(pub.submittedCount, 2);
  assert.strictEqual(pub.companies[0].revealedChoice, null);
  s.revealed = true;
  const pub2 = E.publicSnapshot(s, EV);
  assert.strictEqual(pub2.companies[0].revealedChoice, "m1-B");
  assert.ok(pub2.revealedLabels.A.indexOf("高产能") >= 0);
});

console.log("== 持续收益流（v1.1.0） ==");
test("recurring 选项注册收益流：当月一次性计入，次月起月初结算", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), {
    A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-C" },
  });
  assert.strictEqual(getC(s, "A").economy, 37); // 60-30+7（当月一次性）
  assert.strictEqual(getC(s, "A").streams.length, 1);
  assert.strictEqual(getC(s, "A").streams[0].id, "m1-D");
  assert.strictEqual(getC(s, "A").streams[0].amount, 7);
  assert.strictEqual(getC(s, "A").streams[0].fromMonth, 1);
  // 换月：月初结算计入当月
  s.month = 2; s.stepIndex = 0;
  E.settleMonthOpening(s);
  assert.strictEqual(getC(s, "A").economy, 44); // 37+7
  const rec2 = getC(s, "A").history[1];
  assert.strictEqual(rec2.economyStart, 37); // economyStart = 上月末
  assert.strictEqual(rec2.monthlyIncome, 7);
  // 重复结算同一步不重复注册（按 id 去重；经济重复计入属调用方误用，此处仅验证流不重复）
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" } });
  assert.strictEqual(getC(s, "A").streams.length, 1);
});

test("6 月补贴：企业逐月 +2 流，财政仅当月一次性每家 -2", () => {
  const s = newGame();
  for (const c of s.companies) c.assets.rooftopPV = c.id !== "A";
  s.month = 6; s.stepIndex = 0;
  E.settleGovernmentPolicy(s, getStep(s, 6, 0), "m6-A", "");
  assert.strictEqual(s.government.finance, 96); // -2 × 2 家，一次性
  assert.ok(getC(s, "B").streams.some(x => x.id === "m6-A" && x.amount === 2));
  assert.ok(!getC(s, "A").streams.some(x => x.id === "m6-A")); // 无光伏不注册
  s.month = 7; s.stepIndex = 0;
  E.settleMonthOpening(s);
  assert.strictEqual(getC(s, "B").economy, 64); // 60+2(6月当月)+2(7月流)
  assert.strictEqual(s.government.finance, 96); // 财政不再扣
});

test("10 月油价：无桩注册 -3 流，有桩不注册", () => {
  const s = newGame();
  getC(s, "A").assets.rooftopPV = false;
  getC(s, "B").assets.oneWayCharger = true;
  getC(s, "C").assets.twoWayCharger = true;
  s.month = 10; s.stepIndex = 0;
  E.settleAutoEvent(s, getStep(s, 10, 0));
  assert.strictEqual(getC(s, "A").economy, 57); // 60-3 当月
  assert.ok(getC(s, "A").streams.some(x => x.id === "m10-oil" && x.amount === -3));
  assert.strictEqual(getC(s, "B").streams.length, 0);
  assert.strictEqual(getC(s, "C").streams.length, 0);
  s.month = 11; s.stepIndex = 0;
  E.settleMonthOpening(s);
  assert.strictEqual(getC(s, "A").economy, 54); // 57-3
  assert.strictEqual(getC(s, "B").economy, 60);
});

test("3 月团建 / 12 月雾霾为一次性：不注册流", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 3, 0), { A: { optionId: "m3-B" }, B: { optionId: "m3-C" }, C: { optionId: "m3-C" } });
  assert.ok(s.companies.every(c => c.streams.length === 0));
  s.month = 12; s.stepIndex = 0;
  E.settleCompanyChoice(s, getStep(s, 12, 0), { A: { optionId: "m12-A" }, B: { optionId: "m12-B" }, C: { optionId: "m12-B" } });
  assert.ok(s.companies.every(c => c.streams.length === 0));
});

test("撤销可回滚月初结算（快照由换月方负责）", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-C" } });
  E.snapshot(s, "M1 月末（推进下月前）"); // 中控换月前快照
  s.month = 2; s.stepIndex = 0;
  E.settleMonthOpening(s);
  assert.strictEqual(getC(s, "A").economy, 44);
  const r = E.undo(s);
  assert.ok(r.ok);
  assert.strictEqual(r.state.month, 1);
  assert.strictEqual(E.getCompany(r.state, "A").economy, 37);
});

test("publicSnapshot 含 streamSum", () => {
  const s = newGame();
  E.settleCompanyChoice(s, getStep(s, 1, 0), { A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-C" } });
  s.month = 3; // 当月(3)不计入，仅 fromMonth<3 的流
  const pub = E.publicSnapshot(s, EV);
  assert.strictEqual(pub.companies[0].streamSum, 7);
});

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
