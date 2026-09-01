/* ============================================================
   《绿神话》全流程测试：脚本化完整一局（固定骰子）
   运行：node tests/fullgame.test.js
   手工推演对照《游戏规则.MD》数值表
   口径（v1.1.0）：recurring 项选择当月一次性计入后，
   次月起每月月初由 settleMonthOpening 自动计入，持续到 12 月。
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

/* 换月：月末推进时由中控调用（先快照再换月再月初结算），此处等价复现 */
function enterMonth(s, n) {
  s.month = n;
  s.stepIndex = 0;
  E.settleMonthOpening(s);
}

/* ---------- 剧本 ----------
   企业 A「激进扩张」：1月D猛兽设备、2月不改造、3月新疆、5月不装光伏、7月不装桩、8月维持、11月观望、12月维持
   企业 B「均衡绿色」：  1月B高能效、2月改造、3月种树、5月自发自用、7月单向桩、8月蓄电池、11月观望、12月关停
   企业 C「深度低碳」：  1月C升级、2月改造、3月种树、5月全额上网、7月双向桩、8月蓄电池、11月直接申报、12月关停
   政府：2月从轻奖惩、4月继续生产（骰子 A1 B3 C5）、6月补贴光伏、8月从轻奖惩、9月救灾、11月给C第3档、11月从轻奖惩
   （生态奖惩为并行口径：处罚生态最低 + 奖励生态最高同时生效，财政不变）
   9月台风骰子：B掷1（光伏损毁-10）、C掷2（完好）
   收益流：A = 1月D(+7)、10月油价(-3)；
          B = 1月B(+5)、2月B(+5)、5月C(+2)、6月补贴(+2)、7月B(+4)、8月B(+4) → 8月起合计 +22/月
          C = 1月C(+5)、2月B(+5)、5月B(+2)、6月补贴(+2)、7月C(+4)、8月B(+4) → 8月起合计 +22/月
--------------------------------------------------------------- */

function playFullGame() {
  const s = E.createGame({ companyNames: { A: "激进扩张", B: "均衡绿色", C: "深度低碳" }, governmentName: "市发改委", autoDice: false });

  /* ---- 1 月 ---- */
  E.settleCompanyChoice(s, step(1, 0), {
    A: { optionId: "m1-D" }, B: { optionId: "m1-B" }, C: { optionId: "m1-C" },
  });
  // A: 60-30+7=37, eco 35；流[m1-D+7]
  // B: 60-30+5=35, eco 50；流[m1-B+5]
  // C: 60-20+5=45, eco 45；流[m1-C+5]

  /* ---- 2 月 ---- */
  enterMonth(s, 2);
  // 月初：A +7=44，B +5=40，C +5=50
  E.settleCompanyChoice(s, step(2, 0), {
    A: { optionId: "m2-A" }, B: { optionId: "m2-B" }, C: { optionId: "m2-B" },
  });
  // A: 44, eco 25；B: 40-15+5=30, eco 50；C: 50-15+5=40, eco 45；B/C 流 += [m2-B+5]
  // 政府从轻奖惩（并行）：罚最低 A（25）-10，奖最高 B（50）+10，财政不变
  E.settleGovernmentPolicy(s, step(2, 1), "m2-ecoBothLight", "警示与激励并行");
  // A: 34，B: 40，C: 40，财政 100

  /* ---- 3 月 ---- */
  enterMonth(s, 3);
  // 月初：A +7=41，B +10=50，C +10=50
  E.settleCompanyChoice(s, step(3, 0), {
    A: { optionId: "m3-B" }, B: { optionId: "m3-C" }, C: { optionId: "m3-C" },
  });
  // A: 41-10-10=21（>20，不触发救助；一次性口径下曾为 7 需救助），eco 25-10=15 → 滑坡 → 5
  // B: 50, eco 55；C: 50, eco 50

  /* ---- 4 月 ---- */
  enterMonth(s, 4);
  // 月初：A +7=28，B +10=60，C +10=60
  const r4 = E.settleGovernmentPolicy(s, step(4, 0), "m4-B", "保障民生");
  assert.ok(r4.ok);
  E.settleDiceResults(s, step(4, 1), { A: 1, B: 3, C: 5 });
  // A: 28-10=18 ≤20 首次触发救助资格（时点从 3 月移到 4 月）
  // B: 60-5=55；C: 60
  E.resolveRescue(s, true, "保护就业");
  // A: 28，财政 90

  /* ---- 5 月 ---- */
  enterMonth(s, 5);
  // 月初：A +7=35，B +10=65，C +10=70
  E.settleCompanyChoice(s, step(5, 0), {
    A: { optionId: "m5-A" }, B: { optionId: "m5-C" }, C: { optionId: "m5-B" },
  });
  // A: 35, eco 5-10=-5
  // B: 65-20+2=47（一次性口径曾触发救助，现 >20 不触发），eco 65；流 += [m5-C+2]
  // C: 70-20+2=52, eco 60；流 += [m5-B+2]

  /* ---- 6 月 ---- */
  enterMonth(s, 6);
  // 月初：A +7=42，B +12=59，C +12=64
  E.settleGovernmentPolicy(s, step(6, 0), "m6-A", "精准激励");
  // B、C 有光伏各 +2（当月一次性；此后每月 +2 属企业光伏自身收益），财政一次性 -4 → 86
  // B: 61, C: 66；B/C 流 += [m6-A+2]

  /* ---- 7 月 ---- */
  enterMonth(s, 7);
  // 月初：A +7=49，B +14=75，C +14=80
  E.settleCompanyChoice(s, step(7, 0), {
    A: { optionId: "m7-A" }, B: { optionId: "m7-B" }, C: { optionId: "m7-C" },
  });
  // A: 49, eco -15；B: 75-20+4=59, eco 80；流 += [m7-B+4]
  // C: 80-30+4=54, eco 80；流 += [m7-C+4]

  /* ---- 8 月 ---- */
  enterMonth(s, 8);
  // 月初：A +7=56，B +18=77，C +18=72
  E.settleCompanyChoice(s, step(8, 0), {
    A: { optionId: "m8-A" }, B: { optionId: "m8-B" }, C: { optionId: "m8-B" },
  });
  // A: 56, eco -20；B: 77-20+4=61, eco 90；C: 72-20+4=56, eco 90；B/C 流 += [m8-B+4]（合计 +22/月）
  // 政府从轻奖惩（并行）：罚最低 A（-20）-10，奖最高 B/C 并列（90）各 +10，财政不变
  E.settleGovernmentPolicy(s, step(8, 1), "m8-ecoBothLight", "并列第一，共同奖励");
  // A: 46, B: 71, C: 66，财政 86

  /* ---- 9 月 ---- */
  enterMonth(s, 9);
  // 月初：A +7=53，B +22=93，C +22=88
  E.settleDiceResults(s, step(9, 0), { B: 1, C: 2 });
  // B 光伏被吹走：93-10=83；C 完好：88
  E.settleGovernmentPolicy(s, step(9, 1), "m9-C", "保企业韧性");
  // 各 +10：A 63, B 93, C 98；财政 86-30=56
  E.settleAutoEvent(s, step(9, 2));
  // A 无资产 0 → 63；B 光伏+蓄电池 +10 → 103；C 光伏+蓄电池+双向桩 +10 → 108

  /* ---- 10 月 ---- */
  enterMonth(s, 10);
  // 月初：A +7=70，B +22=125，C +22=130
  E.settleAutoEvent(s, step(10, 0));
  // A 无桩当月 -3 → 67，并注册油价流[-3/月]；B/C 有桩不受影响

  /* ---- 11 月 ---- */
  enterMonth(s, 11);
  // 月初：A +7-3=71，B +22=147，C +22=152
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
  // C: 152+20=172；财政 56-20=36
  // 政府从轻奖惩（并行）：罚最低 A（-20）-10，奖最高 B/C 并列（90）各 +10，财政不变
  E.settleGovernmentPolicy(s, step(11, 2), "m11-ecoBothLight", "A 生态持续垫底");
  // A: 61；B: 157；C: 182；财政 36

  /* ---- 12 月 ---- */
  enterMonth(s, 12);
  // 月初：A +7-3=65，B +22=179，C +22=204
  E.settleCompanyChoice(s, step(12, 0), {
    A: { optionId: "m12-A" }, B: { optionId: "m12-B" }, C: { optionId: "m12-B" },
  });
  // A: 65（维持原状无经济变化），eco -30；12 月为最后一月，流不再产生后续结算
  // B: 179-20=159, eco 100；C: 204-20=184, eco 100

  s.finished = true;
  return s;
}

/* ---------- 期末推演汇总（持续收益口径，并行奖惩）----------
   月末值（经济/生态）：
   A: 1月(37/35) 2月(34/25) 3月(21/5) 4月(28/5) 5月(35/-5) 6月(42/-5) 7月(49/-15)
      8月(46/-20) 9月(63/-20) 10月(67/-20) 11月(61/-20) 12月(65/-30)
   B: 1月(35/50) 2月(40/50) 3月(50/55) 4月(55/55) 5月(47/65) 6月(61/65) 7月(59/80)
      8月(71/90) 9月(103/90) 10月(125/90) 11月(157/90) 12月(159/100)
   C: 1月(45/45) 2月(40/45) 3月(50/50) 4月(60/50) 5月(52/60) 6月(66/60) 7月(54/80)
      8月(66/90) 9月(108/90) 10月(130/90) 11月(182/90) 12月(184/100)
   财政：−10(4月救A) −4(6月补B/C) −30(9月救灾) −20(11月资金) = 36
   终局：A 65/−30，B 159/100，C 184/100，财政 36，总经济 408（≥320 达标）、总生态 170
------------------------------------------------------ */

console.log("== 全流程：剧本一局 ==");
test("完整 12 个月打完，最终各企业分值与手工推演一致", () => {
  const s = playFullGame();
  const A = E.getCompany(s, "A"), B = E.getCompany(s, "B"), C = E.getCompany(s, "C");
  assert.strictEqual(A.economy, 65, "A 经济，实际 " + A.economy);
  assert.strictEqual(A.ecology, -30, "A 生态，实际 " + A.ecology);
  assert.strictEqual(B.economy, 159, "B 经济，实际 " + B.economy);
  assert.strictEqual(B.ecology, 100, "B 生态，实际 " + B.ecology);
  assert.strictEqual(C.economy, 184, "C 经济，实际 " + C.economy);
  assert.strictEqual(C.ecology, 100, "C 生态，实际 " + C.ecology);
  assert.strictEqual(s.government.finance, 36, "政府财政，实际 " + s.government.finance);
});

test("持续收益流注册与口径", () => {
  const s = playFullGame();
  const A = E.getCompany(s, "A"), B = E.getCompany(s, "B"), C = E.getCompany(s, "C");
  assert.deepStrictEqual(A.streams.map(x => x.id), ["m1-D", "m10-oil"], "A 流清单");
  assert.strictEqual(A.streams[1].amount, -3, "油价流 -3");
  assert.strictEqual(B.streams.length, 6, "B 六条流");
  assert.strictEqual(C.streams.length, 6, "C 六条流");
  assert.strictEqual(B.streams.reduce((t, x) => t + x.amount, 0), 22, "B 流合计 +22/月");
  assert.strictEqual(C.streams.reduce((t, x) => t + x.amount, 0), 22, "C 流合计 +22/月");
  // 3 月团建 / 12 月雾霾为一次性：不注册流
  assert.ok(!A.streams.some(x => x.id.startsWith("m3")));
  assert.ok(!B.streams.some(x => x.id === "m12-B"));
  // 6 月补贴：企业侧逐月 +2，但政府财政只在 6 月一次性扣（财政 36 已含 -4）
  assert.ok(B.streams.some(x => x.id === "m6-A" && x.amount === 2));
});

test("月初持续收益计入月度记录（economyStart=上月末）", () => {
  const s = playFullGame();
  const A = E.getCompany(s, "A");
  const rec2 = A.history.find(r => r.month === 2);
  assert.strictEqual(rec2.economyStart, 37, "2 月起点 = 1 月末 37");
  assert.strictEqual(rec2.monthlyIncome, 7, "2 月月初收益 +7");
  assert.ok(/持续收益/.test(rec2.notes.join("")), "备注含持续收益");
  const rec12 = A.history.find(r => r.month === 12);
  assert.strictEqual(rec12.monthlyIncome, 4, "12 月 +7-3=4");
});

test("年终结算：排名 / 政府三目标", () => {
  const s = playFullGame();
  const fin = E.computeFinal(s);
  assert.deepStrictEqual(fin.ranking.map(r => r.id), ["C", "B", "A"]);
  assert.strictEqual(fin.ranking[0].total, 284); // C: 184+100
  assert.strictEqual(fin.totalEcology, 170);     // -30+100+100
  assert.strictEqual(fin.totalEconomy, 408);     // 65+159+184
  assert.strictEqual(fin.govFinance, 36);
  assert.strictEqual(fin.goals.ecology.achieved, false); // 170 < 240
  assert.strictEqual(fin.goals.economy.achieved, true);  // 408 ≥ 320（一次性口径曾为 23 不可达）
  assert.strictEqual(fin.goals.finance.achieved, true);  // 36 ≥ 0
});

test("资产终态核对", () => {
  const s = playFullGame();
  const A = E.getCompany(s, "A"), B = E.getCompany(s, "B"), C = E.getCompany(s, "C");
  assert.deepStrictEqual(A.assets, { rooftopPV: false, battery: false, oneWayCharger: false, twoWayCharger: false });
  assert.deepStrictEqual(B.assets, { rooftopPV: true, battery: true, oneWayCharger: true, twoWayCharger: false });
  assert.deepStrictEqual(C.assets, { rooftopPV: true, battery: true, oneWayCharger: false, twoWayCharger: true });
});

test("日志完整性：掷骰 / 政策 / 风险 / 救助均有记录", () => {
  const s = playFullGame();
  assert.ok(s.dice.length === 5, "骰子 5 次（4月3 + 9月2），实际 " + s.dice.length);
  // 政策：2月罚、4月继续生产、6月补贴、8月奖、9月救灾、11月资金、11月罚 = 7 次
  assert.ok(s.government.policyLog.length === 7, "政府政策 7 次，实际 " + s.government.policyLog.length);
  assert.ok(s.logs.some(l => l.kind === "risk" && /滑坡/.test(l.text)));
  assert.ok(s.logs.some(l => l.kind === "rescue"));
  assert.ok(s.logs.filter(l => l.kind === "settle" && /月初持续收益/.test(l.text)).length >= 30, "每月每企业月初收益日志");
});

test("救助资格：持续收益下仅 A 在 4 月触发一次", () => {
  const s = playFullGame();
  assert.deepStrictEqual(s.rescueUsed, { A: true });
});

test("撤销最后一步后可重新结算", () => {
  const s = playFullGame();
  const r = E.undo(s);
  assert.ok(r.ok);
  // 撤销 12 月结算 → 回到 12 月月初（开盘值）
  assert.strictEqual(E.getCompany(r.state, "A").economy, 65);
  assert.strictEqual(E.getCompany(r.state, "B").economy, 179);
  assert.strictEqual(E.getCompany(r.state, "C").economy, 204);
});

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
