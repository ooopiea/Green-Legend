/* 《绿神话》核心规则回归测试：运行 node tests/engine.test.js */

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

function newGame() {
  return E.createGame({
    companyNames: { A: "甲公司", B: "乙公司", C: "丙公司" },
    autoDice: true,
  });
}

function step(month, id) {
  const monthData = EV.MONTHS.find(item => item.month === month);
  return monthData.steps.find(item => item.id === id);
}

function company(state, id) {
  return E.getCompany(state, id);
}

function settleAll(state, month, id, optionId) {
  E.settleCompanyChoice(state, step(month, id), {
    A: { optionId }, B: { optionId }, C: { optionId },
  });
}

function enterMonth(state, month) {
  state.month = month;
  state.stepIndex = 0;
  E.settleMonthOpening(state);
}

console.log("== 企业基础数值 ==");

test("初始值和引擎版本", () => {
  const state = newGame();
  assert.strictEqual(state.companies[0].economy, 60);
  assert.strictEqual(state.companies[0].ecology, 60);
  assert.strictEqual(state.government.finance, 100);
  assert.strictEqual(E.VERSION, "1.4.0");
  assert.strictEqual(E.fmtNumber(10 / 3), "3.33");
});

test("企业统一结算成功时返回 ok 标记", () => {
  const state = newGame();
  const result = E.settleCompanyChoice(state, step(1, "m1-equipment"), {
    A: { optionId: "m1-A" }, B: { optionId: "m1-A" }, C: { optionId: "m1-A" },
  });
  assert.deepStrictEqual(result, { ok: true });
});

test("1月 D：投资25、当月收益7、生态-20、标记低能效，且后续每月7", () => {
  const state = newGame();
  settleAll(state, 1, "m1-equipment", "m1-D");
  assert.strictEqual(company(state, "A").economy, 42);
  assert.strictEqual(company(state, "A").ecology, 40);
  assert.strictEqual(company(state, "A").assets.lowEfficiency, true);
  assert.strictEqual(company(state, "A").streams[0].amount, 7);
  enterMonth(state, 2);
  assert.strictEqual(company(state, "A").economy, 49);
});

test("12月低能效设备空气质量追责：经济-5、生态-5，仅限购入企业", () => {
  const state = newGame();
  E.settleCompanyChoice(state, step(1, "m1-equipment"), {
    A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-C" },
  });
  assert.strictEqual(company(state, "B").assets.lowEfficiency, false);
  assert.strictEqual(company(state, "C").assets.lowEfficiency, false);
  enterMonth(state, 12);
  E.settleAutoEvent(state, step(12, "m12-lowEfficiency"));
  assert.strictEqual(company(state, "A").economy, 44); // 42 + 月初流7 - 5
  assert.strictEqual(company(state, "A").ecology, 35); // 40 - 5
  assert.strictEqual(company(state, "B").economy, 40);
  assert.strictEqual(company(state, "B").ecology, 50);
  assert.strictEqual(company(state, "C").economy, 50);
  assert.strictEqual(company(state, "C").ecology, 45);
});

console.log("== 生态政策并列规则 ==");

test("生态最低并列：总点数由并列企业平均分摊", () => {
  const state = newGame();
  company(state, "A").ecology = 40;
  company(state, "B").ecology = 40;
  company(state, "C").ecology = 50;
  state.month = 2;
  const s = step(2, "m2-ecoPolicy");
  const r0 = E.settleGovernmentPolicy(state, s, "m2-plantingLight", "");
  assert.strictEqual(r0.ok, true);
  assert.strictEqual(company(state, "A").ecology, 45);
  assert.strictEqual(company(state, "B").ecology, 45);
  assert.strictEqual(company(state, "A").economy, 55);
  assert.strictEqual(company(state, "B").economy, 55);
  assert.strictEqual(state.government.finance, 110);
});

test("生态最高并列：奖励总点数由并列企业平均分摊", () => {
  const state = newGame();
  company(state, "B").ecology = 80;
  company(state, "C").ecology = 80;
  state.month = 8;
  const s = step(8, "m8-ecoPolicy");
  const r0 = E.settleGovernmentPolicy(state, s, "m8-reward", "");
  assert.strictEqual(r0.ok, true);
  assert.strictEqual(company(state, "B").economy, 65);
  assert.strictEqual(company(state, "C").economy, 65);
  assert.strictEqual(state.government.finance, 90);
});

test("无并列时生态政策不需要指定企业", () => {
  const state = newGame();
  company(state, "A").ecology = 30;
  company(state, "B").ecology = 60;
  company(state, "C").ecology = 70;
  state.month = 2;
  const r = E.settleGovernmentPolicy(state, step(2, "m2-ecoPolicy"), "m2-plantingHeavy", "");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(company(state, "A").ecology, 50);
  assert.strictEqual(company(state, "B").ecology, 60);
  assert.strictEqual(state.government.finance, 120);
});

  test("policyTargets 预览返回并列名单", () => {
    const lowTie = newGame();
    company(lowTie, "A").ecology = 40;
    company(lowTie, "B").ecology = 40;
    assert.deepStrictEqual(E.policyTargets(lowTie, { target: "ecoLowest" }), ["A", "B"]);
    const highTie = newGame();
    company(highTie, "B").ecology = 80;
    company(highTie, "C").ecology = 80;
    assert.deepStrictEqual(E.policyTargets(highTie, { target: "ecoHighest" }), ["B", "C"]);
  });

test("2月 B：投资15、每月经济1、生态不变", () => {
  const state = newGame();
  settleAll(state, 2, "m2-envelope", "m2-B");
  assert.strictEqual(company(state, "A").economy, 46);
  assert.strictEqual(company(state, "A").ecology, 60);
  assert.strictEqual(company(state, "A").streams[0].amount, 1);
});

test("3月：只有即时经济和生态变化，没有后续收益流", () => {
  const cases = [
    ["m3-A", 50, 55],
    ["m3-B", 40, 50],
    ["m3-C", 60, 65],
  ];
  for (const [optionId, economy, ecology] of cases) {
    const state = newGame();
    settleAll(state, 3, "m3-teambuilding", optionId);
    assert.strictEqual(company(state, "A").economy, economy, optionId + " 经济");
    assert.strictEqual(company(state, "A").ecology, ecology, optionId + " 生态");
    assert.strictEqual(company(state, "A").streams.length, 0);
  }
});

test("5月 C：自发自用余电上网生态+12", () => {
  const state = newGame();
  settleAll(state, 5, "m5-pv", "m5-C");
  assert.strictEqual(company(state, "A").economy, 42);
  assert.strictEqual(company(state, "A").ecology, 72);
  assert.strictEqual(company(state, "A").assets.rooftopPV, true);
  assert.strictEqual(company(state, "A").streams[0].amount, 2);
});

test("7月 B/C：投入收益与资产授予", () => {
  const state = newGame();
  E.settleCompanyChoice(state, step(7, "m7-charger"), {
    A: { optionId: "m7-B" }, B: { optionId: "m7-C" }, C: { optionId: "m7-A" },
  });
  assert.strictEqual(company(state, "A").economy, 47);
  assert.strictEqual(company(state, "A").ecology, 75);
  assert.strictEqual(company(state, "A").assets.oneWayCharger, true);
  assert.strictEqual(company(state, "B").economy, 43);
  assert.strictEqual(company(state, "B").ecology, 80);
  assert.strictEqual(company(state, "B").assets.twoWayCharger, true);
});

test("8月 B/C：蓄电池和继续安装光伏", () => {
  const state = newGame();
  company(state, "A").assets.rooftopPV = true;
  company(state, "B").assets.rooftopPV = true;
  E.settleCompanyChoice(state, step(8, "m8-battery"), {
    A: { optionId: "m8-B" }, B: { optionId: "m8-C" }, C: { optionId: "m8-A" },
  });
  assert.strictEqual(company(state, "A").economy, 49);
  assert.strictEqual(company(state, "A").ecology, 70);
  assert.strictEqual(company(state, "A").assets.battery, true);
  assert.strictEqual(company(state, "B").economy, 42);
  assert.strictEqual(company(state, "B").ecology, 70);
});

console.log("== 生态政策 ==");

function setEcology(state, values) {
  for (const id of ["A", "B", "C"]) company(state, id).ecology = values[id];
}

test("生态政策 A1：最低企业扣10、生态+10，罚款入政府财政", () => {
  const state = newGame();
  setEcology(state, { A: 30, B: 50, C: 50 });
  const result = E.settleGovernmentPolicy(state, step(2, "m2-ecoPolicy"), "m2-plantingLight", "从轻");
  assert.ok(result.ok);
  assert.strictEqual(company(state, "A").economy, 50);
  assert.strictEqual(company(state, "A").ecology, 40);
  assert.strictEqual(company(state, "B").economy, 60);
  assert.strictEqual(state.government.finance, 110);
});

test("生态政策 A2：最低企业扣20、生态+20，罚款入政府财政", () => {
  const state = newGame();
  setEcology(state, { A: 30, B: 50, C: 50 });
  const result = E.settleGovernmentPolicy(state, step(2, "m2-ecoPolicy"), "m2-plantingHeavy", "从重");
  assert.ok(result.ok);
  assert.strictEqual(company(state, "A").economy, 40);
  assert.strictEqual(company(state, "A").ecology, 50);
  assert.strictEqual(state.government.finance, 120);
});

test("生态政策 B：最高企业奖10，政府财政-10", () => {
  const state = newGame();
  setEcology(state, { A: 30, B: 50, C: 70 });
  const result = E.settleGovernmentPolicy(state, step(2, "m2-ecoPolicy"), "m2-reward", "鼓励领先");
  assert.ok(result.ok);
  assert.strictEqual(company(state, "C").economy, 70);
  assert.strictEqual(company(state, "A").economy, 60);
  assert.strictEqual(state.government.finance, 90);
});

test("生态罚款会拒绝导致企业经济为负", () => {
  const state = newGame();
  setEcology(state, { A: 30, B: 50, C: 50 });
  company(state, "A").economy = 5;
  const result = E.settleGovernmentPolicy(state, step(2, "m2-ecoPolicy"), "m2-plantingHeavy", "越界保护");
  assert.ok(!result.ok);
  assert.strictEqual(company(state, "A").economy, 5);
  assert.strictEqual(company(state, "A").ecology, 30);
  assert.strictEqual(state.government.finance, 100);
});

console.log("== 光伏补贴与补装 ==");

test("6月 A：已装光伏一次性补6，政府每家出6，无后续补贴", () => {
  const state = newGame();
  company(state, "B").assets.rooftopPV = true;
  company(state, "C").assets.rooftopPV = true;
  const result = E.settleGovernmentPolicy(state, step(6, "m6-pvSubsidy"), "m6-A", "");
  assert.ok(result.ok);
  assert.strictEqual(company(state, "B").economy, 66);
  assert.strictEqual(company(state, "C").economy, 66);
  assert.strictEqual(company(state, "A").economy, 60);
  assert.strictEqual(state.government.finance, 88);
  assert.ok(state.companies.every(item => item.streams.length === 0));
});

test("11月 B 四种补装项与此前同类投入收益一致", () => {
  const expected = {
    "m11-R1": [42, 2, 70, { rooftopPV: true }],
    "m11-R2": [43, 3, 80, { twoWayCharger: true }],
    "m11-R3": [51, 1, 65, { oneWayCharger: false, twoWayCharger: true }],
    "m11-R4": [49, 4, 70, { battery: true }],
  };
  for (const [id, [economy, stream, ecology, assets]] of Object.entries(expected)) {
    const state = newGame();
    if (id === "m11-R3") company(state, "A").assets.oneWayCharger = true;
    if (id === "m11-R4") company(state, "A").assets.rooftopPV = true;
    E.settleRetrofit(state, step(11, "m11-apply"), { A: id });
    assert.strictEqual(company(state, "A").economy, economy, id + " 经济");
    assert.strictEqual(company(state, "A").streams[0].amount, stream, id + " 月收益");
    assert.strictEqual(company(state, "A").ecology, ecology, id + " 生态");
    for (const [key, value] of Object.entries(assets)) {
      assert.strictEqual(company(state, "A").assets[key], value, id + " " + key);
    }
  }
});

test("11月蓄电池仅有光伏时可结算，引擎会拒绝无光伏选择", () => {
  const withPV = newGame();
  company(withPV, "A").assets.rooftopPV = true;
  let result = E.settleRetrofit(withPV, step(11, "m11-apply"), { A: "m11-R4" });
  assert.ok(result.ok);
  assert.strictEqual(company(withPV, "A").assets.battery, true);

  const withoutPV = newGame();
  result = E.settleRetrofit(withoutPV, step(11, "m11-apply"), { A: "m11-R4" });
  assert.ok(!result.ok);
  assert.strictEqual(company(withoutPV, "A").assets.battery, false);
});

test("企业选项和加装项不会把经济结算成负数", () => {
  const regular = newGame();
  company(regular, "A").economy = 15;
  let result = E.settleCompanyChoice(regular, step(12, "m12-smog"), {
    A: { optionId: "m12-B" }, B: { optionId: "m12-A" }, C: { optionId: "m12-A" },
  });
  assert.ok(!result.ok);
  assert.strictEqual(company(regular, "A").economy, 15);

  const retrofit = newGame();
  company(retrofit, "A").assets.rooftopPV = true;
  company(retrofit, "A").economy = 8;
  result = E.settleRetrofit(retrofit, step(11, "m11-apply"), { A: "m11-R4" });
  assert.ok(!result.ok);
  assert.strictEqual(company(retrofit, "A").economy, 8);
});

test("救助批准扣生态，且每家企业只触发一次救助资格", () => {
  const state = newGame();
  company(state, "A").economy = 20;
  state.rescuePending = { companyId: "A", economy: 20 };
  state.rescueUsed.A = true;
  const result = E.resolveRescue(state, true, "测试");
  assert.ok(result.ok);
  assert.strictEqual(company(state, "A").economy, 30);
  assert.strictEqual(company(state, "A").ecology, 50);
  assert.strictEqual(state.government.finance, 90);

  company(state, "A").economy = 10;
  state._preSettle = { A: { economy: 30, ecology: 50 } };
  E.checkRisks(state);
  assert.ok(!state.rescuePending);
});

console.log("== 版本与存档 ==");

test("存档往返并拒绝旧版本", () => {
  const state = newGame();
  const restored = E.deserialize(E.serialize(state));
  assert.ok(restored.ok);
  assert.strictEqual(restored.state.government.finance, 100);
  const old = E.deserialize(JSON.stringify({ version: "1.1.0" }));
  assert.ok(!old.ok);
});

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
