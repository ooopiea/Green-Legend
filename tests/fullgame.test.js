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
   政府：2月轻罚最低生态、4月继续生产（骰子 A1 B3 C5）、6月补贴光伏、8月轻奖最高、9月救灾、11月给C第3档、11月轻罚最低
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
  // 政府：轻罚生态最低 = A（25）
  E.settleGovernmentPolicy(s, step(2, 1), "m2-ecoPunishLight", "警示");
  // A: 27，财政 110

  /* ---- 3 月 ---- */
  E.settleCompanyChoice(s, step(3, 0), {
    A: { optionId: "m3-B" }, B: { optionId: "m3-C" }, C: { optionId: "m3-C" },
  });
  // A: 27-10-10=7, eco 25-10=15 → 生态 15 ≤20 滑坡 → 5
  // B: 25, eco 55
  // C: 35, eco 50
  // A 经济 7 ≤20 → 救助资格触发！
  // 政府发放救助：A +10，财政 -10
  E.resolveRescue(s, true, "保护就业");
  // A: 17，财政 100

  /* ---- 4 月 ---- */
  const r4 = E.settleGovernmentPolicy(s, step(4, 0), "m4-B", "保障民生");
  assert.ok(r4.ok);
  E.settleDiceResults(s, step(4, 1), { A: 1, B: 3, C: 5 });
  // A: 17-10=7（再次 ≤20 但救助已用过）
  // B: 25-5=20 → ≤20！但 B 已用救助？不——B 首次触发 → rescuePending B
  // C: 35
  // 处理 B 救助：政府这次不发放
  if (s.rescuePending && s.rescuePending.companyId === "B") E.resolveRescue(s, false, "已救助过 A，财政需节约");

  /* ---- 5 月 ---- */
  E.settleCompanyChoice(s, step(5, 0), {
    A: { optionId: "m5-A" }, B: { optionId: "m5-C" }, C: { optionId: "m5-B" },
  });
  // A: 7, eco 5-10=-5 → 注意：5为起始检查……引擎按月记录 ecologyStart=上轮末值-10? 实际按边沿触发：5>-20? 边沿=结算前 > 20 → 5 ≤ 20 且上轮 5 ≤ 20 → 不再扣
  // B: 20-20+2=2 → ≤20 首次？B 资格已在 4 月标记 → 不再触发
  // B eco: 55+10=65
  // C: 35-20+2=17 → ≤20 首次触发救助资格！
  // C eco: 50+10=60
  if (s.rescuePending) E.resolveRescue(s, true, "低碳标杆企业");
  // C: 27，财政 90

  /* ---- 6 月 ---- */
  E.settleGovernmentPolicy(s, step(6, 0), "m6-A", "精准激励");
  // B、C 有光伏各 +2，财政 -4 → 86
  // B: 4, C: 29

  /* ---- 7 月 ---- */
  E.settleCompanyChoice(s, step(7, 0), {
    A: { optionId: "m7-A" }, B: { optionId: "m7-B" }, C: { optionId: "m7-C" },
  });
  // A: 7, eco -5-10=-15
  // B: 4-20+4=-12 → ≤20 已用 → 仅警告
  // B eco: 65+15=80
  // C: 29-30+4=3 → 已用 → 警告
  // C eco: 60+20=80

  /* ---- 8 月 ---- */
  E.settleCompanyChoice(s, step(8, 0), {
    A: { optionId: "m8-A" }, B: { optionId: "m8-B" }, C: { optionId: "m8-B" },
  });
  // A: 7, eco -15-5=-20
  // B: -12-20+4=-28, eco 90
  // C: 3-20+4=-13, eco 90
  // 政府：轻奖生态最高——B/C 并列 90 → 两者都 +10，财政 -20 → 66
  E.settleGovernmentPolicy(s, step(8, 1), "m8-ecoRewardLight", "并列第一，共同奖励");
  // B: -18, C: -3

  /* ---- 9 月 ---- */
  E.settleDiceResults(s, step(9, 0), { B: 1, C: 2 });
  // B 光伏被吹走：-28-10=-38
  // C 完好：-3
  E.settleGovernmentPolicy(s, step(9, 1), "m9-C", "保企业韧性");
  // 各 +10：A 17, B -28, C 7；财政 66-30=36
  E.settleAutoEvent(s, step(9, 2));
  // A 无资产 0 → 17
  // B 光伏+蓄电池 +10 → -18
  // C 光伏+蓄电池+双向桩：光伏+5 储电+5 → +10 → 17

  /* ---- 10 月 ---- */
  E.settleAutoEvent(s, step(10, 0));
  // A 无桩 -3 → 14；B 有桩 0；C 有桩 0

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
  E.settleGovernmentPolicy(s, step(11, 2), "m11-ecoPunishLight", "A 生态持续垫底");
  // 生态最低：A（-20）→ A 经济 14-10=4；财政 26

  /* ---- 12 月 ---- */
  E.settleCompanyChoice(s, step(12, 0), {
    A: { optionId: "m12-A" }, B: { optionId: "m12-B" }, C: { optionId: "m12-B" },
  });
  // A: 4, eco -20-10=-30
  // B: -18-20=-38, eco 90+10=100
  // C: 37-20=17, eco 90+10=100

  s.finished = true;
  return s;
}

/* ---------- 期末推演汇总（逐笔核对版）----------
   A: 1月D(37/35) → 2月不改造+轻罚(27/25) → 3月新疆+疫情+滑坡(7/5) → 救助+10(17)
      → 4月骰1(7) → 5月不装(7/-15) → 7月无桩(7/-65) → 8月维持(7/-80) → 9月救灾+10(17)
      → 10月无桩-3(14) → 11月观望+轻罚(4/-20) → 12月维持(4/-30)
   B: 1月B(35/50) → 2月改造(25/50) → 3月种树(25/55) → 4月骰3(20) → 5月自发自用(2/65)
      → 6月补贴+2(4) → 7月单向桩(-12/80) → 8月蓄电池(-28/90) → 8月并列轻奖+10(-18)
      → 9月骰1损毁(-28) → 救灾+10(-18) → 自备+10(-8) → 10月有桩(−8) → 12月关停(-38+10=…)
      实际：-8 → 12月关停经济-20 → -28，生态 100
   C: 1月C(45/45) → 2月改造(35/45) → 3月种树(35/50) → 4月骰5(35) → 5月全额上网(17/60)
      → 救助+10(27) → 6月补贴+2(29) → 7月双向桩(3/80) → 8月蓄电池(-13/90) → 并列轻奖(-3)
      → 9月骰2完好(-3) → 救灾+10(7) → 自备+10(17) → 11月资金+20(37) → 12月关停(17/100)
   财政：+10(2月罚) −10(3月救A) −4(6月补B/C) −20(8月奖B/C并列) −30(9月救灾) −20(11月资金) +10(11月罚) = 36
   终局：A 4/−30，B −28/100，C 17/100，财政 36
------------------------------------------------------ */

console.log("== 全流程：剧本一局 ==");
test("完整 12 个月打完，最终各企业分值与手工推演一致", () => {
  const s = playFullGame();
  const A = E.getCompany(s, "A"), B = E.getCompany(s, "B"), C = E.getCompany(s, "C");
  assert.strictEqual(A.economy, 4, "A 经济，实际 " + A.economy);
  assert.strictEqual(A.ecology, -30, "A 生态，实际 " + A.ecology);
  assert.strictEqual(B.economy, -28, "B 经济，实际 " + B.economy);
  assert.strictEqual(B.ecology, 100, "B 生态，实际 " + B.ecology);
  assert.strictEqual(C.economy, 17, "C 经济，实际 " + C.economy);
  assert.strictEqual(C.ecology, 100, "C 生态，实际 " + C.ecology);
  assert.strictEqual(s.government.finance, 36, "政府财政，实际 " + s.government.finance);
});

test("年终结算：排名 / 政府三目标", () => {
  const s = playFullGame();
  const fin = E.computeFinal(s);
  assert.deepStrictEqual(fin.ranking.map(r => r.id), ["C", "B", "A"]);
  assert.strictEqual(fin.ranking[0].total, 117); // C: 17+100
  assert.strictEqual(fin.totalEcology, 170);     // -30+100+100
  assert.strictEqual(fin.totalEconomy, -7);      // 4-28+17
  assert.strictEqual(fin.govFinance, 36);
  assert.strictEqual(fin.goals.ecology.achieved, false); // 170 < 240
  assert.strictEqual(fin.goals.economy.achieved, false); // -7 < 320
  assert.strictEqual(fin.goals.finance.achieved, true);  // 36 ≥ 0
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
  // 撤销 12 月结算 → A 回到 4（12月维持原状经济不变），B/C 回到 -8/37
  assert.strictEqual(E.getCompany(r.state, "A").economy, 4);
  assert.strictEqual(E.getCompany(r.state, "B").economy, -8);
  assert.strictEqual(E.getCompany(r.state, "C").economy, 37);
});

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
