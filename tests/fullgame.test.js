/* ============================================================
   《绿神话》全流程测试：脚本化完整一局（固定骰子）
   运行：node tests/fullgame.test.js
   手工推演对照《游戏规则.MD》数值表
   ============================================================ */

const assert = require("assert");
const E = require("../web/js/engine.js");
const EV = require("../web/js/events.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + e.message); }
}

function step(month, idx) {
  const m = EV.MONTHS.find(x => x.month === month);
  return m.steps[idx];
}

/* ---------- 剧本 ----------
   企业 A「激进扩张」：1月D猛兽设备、2月不改造、3月新疆、5月不装光伏、7月不装桩、8月维持、11月观望、12月维持
   企业 B「均衡绿色」： 1月B高能效、2月改造、3月种树、5月自发自用、7月单向桩、8月蓄电池、11月观望、12月关停
   企业 C「深度低碳」： 1月C升级、2月改造、3月种树、5月全额上网、7月双向桩、8月蓄电池、11月直接申报、12月关停
   政府：2月从轻奖惩、4月继续生产（骰子 A1 B3 C5）、6月补贴光伏、8月从轻奖惩、9月救灾、11月给C第3档、11月从轻奖惩
   （生态奖惩为并行口径：处罚生态最低 + 奖励生态最高同时生效，财政不变）
   9月台风骰子：B掷1（光伏损毁-10）、C掷2（完好）
--------------------------------------------------------------- */

function playFullGame() {
  const s = E.createGame({ companyNames: { A: "激进扩张", B: "均衡绿色", C: "深度低碳" }, governmentName: "市发改委", autoDice: false });

  /* ---- 1 月 ---- */
  E.settleCompanyChoice(s, step(1, 0), {
    A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-C" },
  });
  // A: 60-30+7=37, eco 60-25=35
  // B: 60-30+5=35, eco 50
  // C: 60-20+5=45, eco 45

  /* ---- 2 月 ---- */
  E.settleCompanyChoice(s, step(2, 0), {
    A: { optionId: "m2-A" }, B: { optionId: "m2-B" }, C: { optionId: "m2-B" },
  });
  // A: 37, eco 25
  // B: 35-15+5=25, eco 50
  // C: 45-15+5=35, eco 45
  // 政府从轻奖惩（并行）：罚最低 A（25）-10，奖最高 B（50）+10，财政不变
  E.settleGovernmentPolicy(s, step(2, 1), "m2-ecoBothLight", "警示与激励并行");
  // A: 27，B: 35，财政 100

  /* ---- 3 月 ---- */
  E.settleCompanyChoice(s, step(3, 0), {
    A: { optionId: "m3-B" }, B: { optionId: "m3-C" }, C: { optionId: "m3-C" },
  });
  // A: 27-10-10=7, eco 25-10=15 → 生态 15 ≤20 滑坡 → 5
  // B: 35, eco 55
  // C: 35, eco 50
  // A 经济 7 ≤20 → 救助资格触发！
  // 政府发放救助：A +10，财政 -10
  E.resolveRescue(s, true, "保护就业");
  // A: 17，财政 90

  /* ---- 4 月 ---- */
  const r4 = E.settleGovernmentPolicy(s, step(4, 0), "m4-B", "保障民生");
  assert.ok(r4.ok);
  E.settleDiceResults(s, step(4, 1), { A: 1, B: 3, C: 5 });
  // A: 17-10=7（再次 ≤20 但救助已用过）
  // B: 35-5=30
  // C: 35

  /* ---- 5 月 ---- */
  E.settleCompanyChoice(s, step(5, 0), {
    A: { optionId: "m5-A" }, B: { optionId: "m5-C" }, C: { optionId: "m5-B" },
  });
  // A: 7, eco 5-10=-5
  // B: 30-20+2=12 → ≤20 首次触发救助资格！eco 55+10=65
  // C: 35-20+2=17 → ≤20 首次触发，入救助队列！eco 50+10=60
  // B、C 双救助排队，政府均发放：财政 -20
  while (s.rescuePending) E.resolveRescue(s, true, "低碳转型关键期");
  // B: 22, C: 27，财政 70

  /* ---- 6 月 ---- */
  E.settleGovernmentPolicy(s, step(6, 0), "m6-A", "精准激励");
  // B、C 有光伏各 +2，财政 -4 → 66
  // B: 24, C: 29

  /* ---- 7 月 ---- */
  E.settleCompanyChoice(s, step(7, 0), {
    A: { optionId: "m7-A" }, B: { optionId: "m7-B" }, C: { optionId: "m7-C" },
  });
  // A: 7, eco -5-10=-15
  // B: 24-20+4=8, eco 65+15=80
  // C: 29-30+4=3, eco 60+20=80

  /* ---- 8 月 ---- */
  E.settleCompanyChoice(s, step(8, 0), {
    A: { optionId: "m8-A" }, B: { optionId: "m8-B" }, C: { optionId: "m8-B" },
  });
  // A: 7, eco -15-5=-20
  // B: 8-20+4=-8, eco 90
  // C: 3-20+4=-13, eco 90
  // 政府从轻奖惩（并行）：罚最低 A（-20）-10，奖最高 B/C 并列（90）各 +10，财政不变
  E.settleGovernmentPolicy(s, step(8, 1), "m8-ecoBothLight", "并列第一，共同奖励");
  // A: -3, B: 2, C: -3，财政 66

  /* ---- 9 月 ---- */
  E.settleDiceResults(s, step(9, 0), { B: 1, C: 2 });
  // B 光伏被吹走：2-10=-8
  // C 完好：-3
  E.settleGovernmentPolicy(s, step(9, 1), "m9-C", "保企业韧性");
  // 各 +10：A 7, B 2, C 7；财政 66-30=36
  E.settleAutoEvent(s, step(9, 2));
  // A 无资产 0 → 7
  // B 光伏+蓄电池 +10 → 12
  // C 光伏+蓄电池+双向桩：光伏+5 储电+5 → +10 → 17

  /* ---- 10 月 ---- */
  E.settleAutoEvent(s, step(10, 0));
  // A 无桩 -3 → 4；B 有桩 0；C 有桩 0

  /* ---- 11 月 ---- */
  const m11decisions = {
    A: { optionId: "m11-C" }, // 观望
    B: { optionId: "m11-C" }, // 观望
    C: { optionId: "m11-A" }, // 直接申报
  };
  E.settleCompanyChoice(s, step(11, 0), m11decisions);
  // 三家本月无数值变化
  E.finalizeZeroCarbon(s, m11decisions, {});
  // C：光伏+双向桩+蓄电池 = 3 项 ≥2 → 合格
  E.settlePilotFunding(s, step(11, 1), { C: 20 }, { C: "资产最全、方案完整" });
  // C: 17+20=37；财政 36-20=16
  // 政府从轻奖惩（并行）：罚最低 A（-20）-10，奖最高 B/C 并列（90）各 +10，财政不变
  E.settleGovernmentPolicy(s, step(11, 2), "m11-ecoBothLight", "A 生态持续垫底");
  // A: 4-10=-6；B: 12+10=22；C: 37+10=47；财政 16

  /* ---- 12 月 ---- */
  E.settleCompanyChoice(s, step(12, 0), {
    A: { optionId: "m12-A" }, B: { optionId: "m12-B" }, C: { optionId: "m12-B" },
  });
  // A: -6, eco -20-10=-30
  // B: 22-20=2, eco 90+10=100
  // C: 47-20=27, eco 90+10=100

  s.finished = true;
  return s;
}

/* ---------- 期末推演汇总（逐笔核对版，并行奖惩口径）----------
   A: 1月D(37/35) → 2月不改造+从轻罚(27/25) → 3月新疆+疫情+滑坡(7/5) → 救助+10(17)
      → 4月骰1(7) → 5月不装(7/-5) → 7月无桩(7/-15) → 8月维持(7/-20) → 8月从轻罚(-3)
      → 9月救灾+10(7) → 10月无桩-3(4) → 11月观望+从轻罚(-6/-20) → 12月维持(-6/-30)
   B: 1月B(35/50) → 2月改造+从轻奖(35/50) → 3月种树(35/55) → 4月骰3(30) → 5月自发自用(12/65)
      → 救助+10(22) → 6月补贴+2(24) → 7月单向桩(8/80) → 8月蓄电池(-8/90) → 8月并列从轻奖(2)
      → 9月骰1损毁(-8) → 救灾+10(2) → 自备+10(12) → 10月有桩(12) → 11月观望+从轻奖(22/90)
      → 12月关停(2/100)
   C: 1月C(45/45) → 2月改造(35/45) → 3月种树(35/50) → 4月骰5(35) → 5月全额上网(17/60)
      → 救助+10(27) → 6月补贴+2(29) → 7月双向桩(3/80) → 8月蓄电池(-13/90) → 并列从轻奖(-3)
      → 9月骰2完好(-3) → 救灾+10(7) → 自备+10(17) → 11月资金+20+从轻奖(47/90) → 12月关停(27/100)
   财政：2月并行±0 −10(3月救A) −10−10(5月救B/C) −4(6月补B/C) 8月并行±0 −30(9月救灾)
        −20(11月资金) 11月并行±0 = 16
   终局：A −6/−30，B 2/100，C 27/100，财政 16
------------------------------------------------------ */

console.log("== 全流程：剧本一局 ==");
test("完整 12 个月打完，最终各企业分值与手工推演一致", () => {
  const s = playFullGame();
  const A = E.getCompany(s, "A"), B = E.getCompany(s, "B"), C = E.getCompany(s, "C");
  assert.strictEqual(A.economy, -6, "A 经济，实际 " + A.economy);
  assert.strictEqual(A.ecology, -30, "A 生态，实际 " + A.ecology);
  assert.strictEqual(B.economy, 2, "B 经济，实际 " + B.economy);
  assert.strictEqual(B.ecology, 100, "B 生态，实际 " + B.ecology);
  assert.strictEqual(C.economy, 27, "C 经济，实际 " + C.economy);
  assert.strictEqual(C.ecology, 100, "C 生态，实际 " + C.ecology);
  assert.strictEqual(s.government.finance, 16, "政府财政，实际 " + s.government.finance);
});

test("年终结算：排名 / 政府三目标", () => {
  const s = playFullGame();
  const fin = E.computeFinal(s);
  assert.deepStrictEqual(fin.ranking.map(r => r.id), ["C", "B", "A"]);
  assert.strictEqual(fin.ranking[0].total, 127); // C: 27+100
  assert.strictEqual(fin.totalEcology, 170);     // -30+100+100
  assert.strictEqual(fin.totalEconomy, 23);      // -6+2+27
  assert.strictEqual(fin.govFinance, 16);
  assert.strictEqual(fin.goals.ecology.achieved, false); // 170 < 240
  assert.strictEqual(fin.goals.economy.achieved, false); // 23 < 320
  assert.strictEqual(fin.goals.finance.achieved, true);  // 16 ≥ 0
});

test("资产终态核对", () => {
  const s = playFullGame();
  const A = E.getCompany(s, "A"), B = E.getCompany(s, "B"), C = E.getCompany(s, "C");
  assert.deepStrictEqual(A.assets, { rooftopPV: false, battery: false, oneWayCharger: false, twoWayCharger: false });
  assert.deepStrictEqual(B.assets, { rooftopPV: true, battery: true, oneWayCharger: true, twoWayCharger: false });
  assert.deepStrictEqual(C.assets, { rooftopPV: true, battery: true, oneWayCharger: false, twoWayCharger: true });
});

test("日志完整性：掷骰 / 政策 / 风险均有记录", () => {
  const s = playFullGame();
  assert.ok(s.dice.length === 5, "骰子 5 次（4月3 + 9月2），实际 " + s.dice.length);
  // 政策：2月罚、4月继续生产、6月补贴、8月奖、9月救灾、11月资金、11月罚 = 7 次
  assert.ok(s.government.policyLog.length === 7, "政府政策 7 次，实际 " + s.government.policyLog.length);
  assert.ok(s.logs.some(l => l.kind === "risk" && /滑坡/.test(l.text)));
  assert.ok(s.logs.some(l => l.kind === "rescue"));
});

test("撤销最后一步后可重新结算", () => {
  const s = playFullGame();
  const r = E.undo(s);
  assert.ok(r.ok);
  // 撤销 12 月结算 → A 回到 -6（12月维持原状经济不变），B/C 回到 22/47
  assert.strictEqual(E.getCompany(r.state, "A").economy, -6);
  assert.strictEqual(E.getCompany(r.state, "B").economy, 22);
  assert.strictEqual(E.getCompany(r.state, "C").economy, 47);
});

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
