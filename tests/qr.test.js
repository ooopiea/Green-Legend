/* ============================================================
   二维码生成器自检（Node）
   验证：容量选择、矩阵结构、SV#G 输出格式
   ============================================================ */

const assert = require("assert");
const QR = require("../web/js/qr.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + e.message); }
}

console.log("== QR 生成器 ==");

test("version 选择：短文本 v1，长文本更大版本", () => {
  assert.strictEqual(QR.pickVersion("hello".length), 1);
  const long200 = "x".repeat(200);
  assert.ok(QR.pickVersion(long200.length) > 1, "200 字节应选更大版本");
});

test("v1 矩阵 21x21，含定位图案", () => {
  const m = QR.encode("HELLO");
  assert.strictEqual(m.size, 21);
  // 左上定位图案中心 (3,3) 应为黑
  assert.strictEqual(m.get(3, 3), true);
  // 定位图案外环 (0,0) 黑、(1,1) 白、核心 (4,4) 黑
  assert.strictEqual(m.get(0, 0), true);
  assert.strictEqual(m.get(1, 1), false);
  assert.strictEqual(m.get(4, 4), true); // 核心 3x3（2..4, 2..4）
  assert.strictEqual(m.get(5, 5), false); // 分隔符外白区
  // 右上 (3, 17)、左下 (17, 3)
  assert.strictEqual(m.get(3, 17), true);
  assert.strictEqual(m.get(17, 3), true);
});

test("SVG 输出格式合法", () => {
  const svg = QR.toSvg("TEST 数据");
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("</svg>"));
  assert.ok(svg.includes('fill="#ffffff"'));
  assert.ok(svg.includes("<rect"));
});

test("中文 UTF-8 编码后可生成", () => {
  const svg = QR.toSvg("绿神话课堂游戏");
  assert.ok(svg.startsWith("<svg"));
});

test("超长内容抛出明确错误", () => {
  let threw = false;
  try { QR.encode("x".repeat(400)); } catch (e) { threw = true; assert.ok(/过长/.test(e.message)); }
  assert.ok(threw);
});

test("典型观战 URL（~180 字节）可生成", () => {
  const url = "http://192.168.1.100:8000/index.html#/spectate?s=" + "a".repeat(120);
  assert.ok(QR.pickVersion(url.length) >= 1);
  const svg = QR.toSvg(url);
  assert.ok(svg.startsWith("<svg"));
});

console.log("\n== 结果：" + passed + " 通过，" + failed + " 失败 ==");
process.exit(failed ? 1 : 0);
