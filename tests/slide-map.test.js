/* ============================================================
   舞台幻灯片页号映射测试（Node）
   运行：node tests/slide-map.test.js
   断言口径：STEP_PAGE 映射表（题面页/答案页成对；
   settled 或 revealed → 答案页），SLIDES 42 页完整性。
   ============================================================ */

const assert = require("assert");
const EV = require("../web/js/events.js");
const E = require("../web/js/engine.js");
const GL = require("../web/js/stage-slides.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + e.message); }
}

/* 期望映射表：stepId → [题面页, 答案页]（同页步两值相等） */
const EXPECT = {
  "m1-equipment": [9, 10],
  "m2-envelope": [11, 12],
  "m2-ecoPolicy": [13, 14],
  "m3-teambuilding": [15, 16],
  "m4-publicHealth": [18, 19],
  "m4-dice": [19, 19],
  "m5-pv": [20, 21],
  "m6-pvSubsidy": [22, 23],
  "m7-charger": [24, 25],
  "m8-battery": [26, 27],
  "m8-ecoPolicy": [28, 29],
  "m9-typhoonPV": [30, 30],
  "m9-blackout": [31, 32],
  "m9-selfPower": [33, 33],
  "m10-oil": [34, 34],
  "m11-apply": [35, 36],
  "m11-funding": [37, 37],
  "m11-ecoPolicy": [38, 39],
  "m12-smog": [40, 41],
  "m12-lowEfficiency": [41, 41],
  "final-awards": [42, 42],
};

/* 合成状态：置于指定步骤（不揭示、不结算） */
function stateAt(stepId) {
  const s = E.createGame({ companyNames: { A: "企业 A", B: "企业 B", C: "企业 C" }, autoDice: true });
  let found = null;
  for (const m of EV.MONTHS) {
    for (let i = 0; i < m.steps.length; i++) {
      if (m.steps[i].id === stepId) { found = { month: m.month, index: i }; break; }
    }
    if (found) break;
  }
  if (!found) throw new Error("步骤不存在：" + stepId);
  s.month = found.month;
  s.stepIndex = found.index;
  return s;
}

console.log("== 基础 ==");

test("TOTAL = 42 且 SLIDES 42 页连续编号", () => {
  assert.strictEqual(GL.TOTAL, 42);
  assert.strictEqual(GL.SLIDES.length, 42);
  GL.SLIDES.forEach((sl, i) => assert.strictEqual(sl.n, i + 1, "第 " + i + " 项 n 应为 " + (i + 1)));
});

test("无状态 → null（课前手动翻页）", () => {
  assert.strictEqual(GL.autoSlide(null, EV), null);
});

test("finished → 42", () => {
  const s = E.createGame({});
  s.finished = true;
  assert.strictEqual(GL.autoSlide(s, EV), 42);
});

test("12 月颁奖步（final-awards）→ 42", () => {
  const s = stateAt("final-awards");
  assert.strictEqual(GL.autoSlide(s, EV), 42);
  s.revealed = true;
  assert.strictEqual(GL.autoSlide(s, EV), 42);
});

test("步号越界（月末已推进完）→ null", () => {
  const s = stateAt("m12-smog");
  s.stepIndex = 9;
  assert.strictEqual(GL.autoSlide(s, EV), null);
});

console.log("== 映射表逐条（题面页 / revealed / settled）==");

Object.keys(EXPECT).forEach(id => {
  const [q, a] = EXPECT[id];
  test(id + " 题面页 = " + q, () => {
    const s = stateAt(id);
    assert.strictEqual(GL.autoSlide(s, EV), q);
  });
  test(id + " revealed → " + a, () => {
    const s = stateAt(id);
    s.revealed = true;
    assert.strictEqual(GL.autoSlide(s, EV), a);
  });
  test(id + " settled → " + a + "（两阶段结算停留）", () => {
    const s = stateAt(id);
    s.stepSettled = { stepId: id, skip: 0 };
    assert.strictEqual(GL.autoSlide(s, EV), a);
  });
});

console.log("== settled 的 stepId 不匹配当前步（已推进）→ 按新步题面页 ==");

test("stepSettled 指向上一步时按当前步取题面页", () => {
  const s = stateAt("m2-envelope");
  s.stepSettled = { stepId: "m1-equipment", skip: 0 };
  assert.strictEqual(GL.autoSlide(s, EV), 11);
});

test("m4-dice 题面与答案同页（19）", () => {
  const s = stateAt("m4-dice");
  assert.strictEqual(GL.autoSlide(s, EV), 19);
  s.revealed = true;
  assert.strictEqual(GL.autoSlide(s, EV), 19);
});

console.log("== phaseKey ==");

test("phaseKey(null) = 'empty'", () => {
  assert.strictEqual(GL.phaseKey(null), "empty");
});

test("phaseKey 随揭示/结算/提交数变化", () => {
  const s = stateAt("m1-equipment");
  const k0 = GL.phaseKey(s);
  s.pendingDecisions.A = { optionId: "m1-B" };
  const k1 = GL.phaseKey(s);
  s.revealed = true;
  const k2 = GL.phaseKey(s);
  s.stepSettled = { stepId: "m1-equipment", skip: 0 };
  const k3 = GL.phaseKey(s);
  assert.notStrictEqual(k0, k1);
  assert.notStrictEqual(k1, k2);
  assert.notStrictEqual(k2, k3);
});

console.log(`\n[幻灯片映射] ${passed}/${passed + failed} 通过`);
process.exit(failed ? 1 : 0);
