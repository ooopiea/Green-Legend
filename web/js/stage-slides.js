/* ============================================================
   《绿神话》舞台幻灯片库（PPT 42 页复刻）
   - autoSlide(state, EV)：中控状态 → 自动页号（纯函数，Node 可测）
   - phaseKey(state)：同页内容相位键（供播放器判断是否需重建）
   - renderSlide(n, ctx)：第 n 页 DOM 渲染（浏览器；ctx = { state, EV }）
   - SLIDES：42 页元数据清单
   题面/数值单一事实源为 events.js（GreenEvents）；
   1-8 页课前静态文案取自 PPT 原文。
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GreenSlides = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TOTAL = 42;

  /* ---------- 工具（纯逻辑部分，Node 可用） ---------- */

  function fmt(n) { return n > 0 ? "+" + n : String(n); }

  function findStep(EV, id) {
    for (const m of EV.MONTHS) {
      for (const s of m.steps) {
        if (s.id === id) return { month: m.month, monthTitle: m.title, step: s };
      }
    }
    return null;
  }

  function currentStepOf(state, EV) {
    if (!state || state.finished) return null;
    const md = EV.MONTHS.find(function (m) { return m.month === state.month; });
    if (!md || state.stepIndex >= md.steps.length) return null;
    return md.steps[state.stepIndex];
  }

  /* 自动页号：无状态 → null（课前手动翻页）；finished / 颁奖 → 42 */
  const STEP_PAGE = {
    "m1-equipment": [9, 10],     // [题面页, 答案页]
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
    "final-awards": [42, 42],
  };

  function autoSlide(state, EV) {
    if (!state) return null;
    if (state.finished) return 42;
    EV = EV || (typeof GreenEvents !== "undefined" ? GreenEvents : null);
    if (!EV) return null;
    const step = currentStepOf(state, EV);
    if (!step) return null;
    const pages = STEP_PAGE[step.id];
    if (!pages) return null;
    const settled = !!(state.stepSettled && state.stepSettled.stepId === step.id);
    const revealed = !!state.revealed;
    if (settled || revealed) return pages[1];
    return pages[0];
  }

  /* 同页相位键：变更才重建 DOM（提交数/骰子/结算态） */
  function phaseKey(state) {
    if (!state) return "empty";
    return [
      state.month, state.stepIndex,
      state.revealed ? 1 : 0,
      state.stepSettled ? state.stepSettled.stepId + "#" + (state.stepSettled.skip || 0) : "",
      Object.keys(state.pendingDecisions || {}).filter(function (k) { return state.pendingDecisions[k]; }).length,
      (state.dice || []).length,
      (state.government && state.government.policyLog || []).length,
      (state.government && state.government.awards || []).length,
      state.finished ? 1 : 0,
    ].join("|");
  }

  /* ---------- 42 页元数据 ---------- */

  const SLIDES = [
    { n: 1, kind: "title", title: "企业策略游戏《绿神话》" },
    { n: 2, kind: "rules", title: "游戏规则" },
    { n: 3, kind: "campCompany", title: "阵营 · 企业" },
    { n: 4, kind: "metricTwo", title: "指标 · 生态与经济" },
    { n: 5, kind: "campGov", title: "阵营 · 政府" },
    { n: 6, kind: "metricAll", title: "指标 · 全社会" },
    { n: 7, kind: "flowBody", title: "流程" },
    { n: 8, kind: "flow", title: "流程" },
    { n: 9, kind: "q", step: "m1-equipment", title: "1月 设备采购" },
    { n: 10, kind: "ans", step: "m1-equipment", title: "1月 设备采购 · 答案" },
    { n: 11, kind: "q", step: "m2-envelope", title: "2月 围护结构改造" },
    { n: 12, kind: "ans", step: "m2-envelope", title: "2月 围护结构改造 · 答案" },
    { n: 13, kind: "govq", step: "m2-ecoPolicy", title: "2月 生态奖惩" },
    { n: 14, kind: "ecoAns", step: "m2-ecoPolicy", month: 2, title: "2月 生态奖惩 · 答案" },
    { n: 15, kind: "q", step: "m3-teambuilding", title: "3月 团建选择" },
    { n: 16, kind: "ans", step: "m3-teambuilding", title: "3月 团建选择 · 答案" },
    { n: 17, kind: "pandemic", title: "3月 疫情突发事件（手动 +1）" },
    { n: 18, kind: "govq", step: "m4-publicHealth", title: "4月 公共卫生决策" },
    { n: 19, kind: "m4Ans", step: "m4-publicHealth", title: "4月 疫情应对 · 答案/掷骰" },
    { n: 20, kind: "q", step: "m5-pv", title: "5月 屋顶光伏" },
    { n: 21, kind: "ans", step: "m5-pv", title: "5月 屋顶光伏 · 答案" },
    { n: 22, kind: "govq", step: "m6-pvSubsidy", title: "6月 光伏补贴决策" },
    { n: 23, kind: "m6Ans", step: "m6-pvSubsidy", title: "6月 光伏补贴 · 答案" },
    { n: 24, kind: "q", step: "m7-charger", title: "7月 充电桩决策" },
    { n: 25, kind: "ans", step: "m7-charger", title: "7月 充电桩 · 答案" },
    { n: 26, kind: "q", step: "m8-battery", title: "8月 并网受限应对" },
    { n: 27, kind: "ans", step: "m8-battery", title: "8月 并网受限 · 答案" },
    { n: 28, kind: "govq", step: "m8-ecoPolicy", title: "8月 生态奖惩" },
    { n: 29, kind: "ecoAns", step: "m8-ecoPolicy", month: 8, title: "8月 生态奖惩 · 答案" },
    { n: 30, kind: "typhoon", step: "m9-typhoonPV", title: "9月 台风掷骰" },
    { n: 31, kind: "govq", step: "m9-blackout", title: "9月 停电应对" },
    { n: 32, kind: "m9Ans", step: "m9-blackout", title: "9月 停电应对 · 答案" },
    { n: 33, kind: "selfPower", step: "m9-selfPower", title: "9月 自备电力加成" },
    { n: 34, kind: "oil", step: "m10-oil", title: "10月 油价冲击" },
    { n: 35, kind: "q", step: "m11-apply", title: "11月 零碳园区申报" },
    { n: 36, kind: "m11Ans", step: "m11-apply", title: "11月 申报 · 答案" },
    { n: 37, kind: "funding", step: "m11-funding", title: "11月 试点资金" },
    { n: 38, kind: "govq", step: "m11-ecoPolicy", title: "11月 生态奖惩" },
    { n: 39, kind: "ecoAns", step: "m11-ecoPolicy", month: 11, title: "11月 生态奖惩 · 答案" },
    { n: 40, kind: "q", step: "m12-smog", title: "12月 雾霾限产" },
    { n: 41, kind: "ans", step: "m12-smog", title: "12月 雾霾限产 · 答案" },
    { n: 42, kind: "final", title: "年终 · 政府颁奖环节" },
  ];

  /* ============================================================
     以下为 DOM 渲染（仅浏览器）
     ============================================================ */

  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
    }
    const rest = Array.prototype.slice.call(arguments, 2);
    const kids = rest.length === 1 && Array.isArray(rest[0]) ? rest[0] : rest;
    kids.forEach(function (ch) {
      if (ch == null) return;
      if (Array.isArray(ch)) ch.forEach(function (g) { if (g != null) node.appendChild(g); });
      else node.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch);
    });
    return node;
  }

  /* 【】高亮：控制文本走 textContent，无 innerHTML 注入面 */
  function rich(node, text) {
    String(text).split(/(【[^】]*】)/).forEach(function (p) {
      if (!p) return;
      if (p.charAt(0) === "【") node.appendChild(el("span", { class: "sl-hl", text: p }));
      else node.appendChild(document.createTextNode(p));
    });
  }

  function img(src, cls, style) {
    return el("img", { class: cls || "", src: "assets/" + src, alt: "", style: style || "" });
  }

  /* 数值格：lit 才点亮 */
  function numCell(val, lit, withBadge) {
    if (!val) return el("span", { class: "sl-num zero", text: "—" });
    const cls = "sl-num " + (val > 0 ? "pos" : "neg") + (lit ? " lit" : "");
    const cell = el("span", { class: "sl-numwrap" },
      el("span", { class: cls + " num", text: fmt(val) }),
      withBadge ? el("span", { class: "sl-mbadge", text: "每月" }) : null);
    return cell;
  }

  function iconNum(icon, val, lit, badge) {
    return el("span", { class: "sl-cell" },
      img(icon, "sl-ic"),
      numCell(val, lit, badge));
  }

  /* ============================================================
     renderSlide 入口
     ============================================================ */

  function renderSlide(n, ctx) {
    ctx = ctx || {};
    const state = ctx.state || null;
    const EV = ctx.EV || (typeof GreenEvents !== "undefined" ? GreenEvents : null);
    const meta = SLIDES[n - 1] || SLIDES[0];
    const canvas = el("div", { class: "sl-canvas" + (n <= 8 ? " sl-pre" : ""), "data-slide-n": n });

    const stepInfo = meta.step && EV ? findStep(EV, meta.step) : null;
    const cur = state && EV ? currentStepOf(state, EV) : null;
    const atStep = !!(cur && stepInfo && cur.id === stepInfo.step.id); // 中控正处在本页对应步骤
    const settled = !!(state && state.stepSettled && cur && state.stepSettled.stepId === cur.id);
    const revealed = !!(state && state.revealed);

    switch (meta.kind) {
      case "title": buildTitle(canvas); break;
      case "rules": buildRules(canvas); break;
      case "campCompany": buildCampCompany(canvas); break;
      case "metricTwo": buildMetricTwo(canvas); break;
      case "campGov": buildCampGov(canvas); break;
      case "metricAll": buildMetricAll(canvas); break;
      case "flowBody": buildFlowBody(canvas); break;
      case "flow": buildFlow(canvas); break;
      case "q": buildQuestion(canvas, stepInfo, state, atStep, revealed); break;
      case "ans": buildAnswer(canvas, stepInfo, state, atStep, revealed); break;
      case "govq": buildGovQuestion(canvas, stepInfo, state, atStep); break;
      case "ecoAns": buildEcoAnswer(canvas, stepInfo, meta.month, state, atStep && settled); break;
      case "pandemic": buildPandemic(canvas, stepInfo, state); break;
      case "m4Ans": buildM4Answer(canvas, stepInfo, state, atStep, settled); break;
      case "m6Ans": buildM6Answer(canvas, stepInfo, state, atStep && settled); break;
      case "typhoon": buildTyphoon(canvas, stepInfo, state, atStep && settled); break;
      case "m9Ans": buildM9Answer(canvas, stepInfo, state, atStep && settled); break;
      case "selfPower": buildSelfPower(canvas, stepInfo, state, atStep && settled); break;
      case "oil": buildOil(canvas, stepInfo, state, atStep && settled); break;
      case "m11Ans": buildM11Answer(canvas, stepInfo, state, atStep, revealed); break;
      case "funding": buildFunding(canvas, stepInfo, state, atStep && settled); break;
      case "final": buildFinal(canvas, state); break;
      default: canvas.appendChild(el("div", { class: "sl-center-note", text: "第 " + n + " 页" }));
    }
    return canvas;
  }

  /* ---------- 头部（月徽 + 题面） ---------- */

  function head(canvas, month, prompt, dim) {
    canvas.appendChild(el("div", { class: "sl-month num", text: month + "月" }));
    const p = el("div", { class: "sl-prompt" + (dim ? " dim" : "") });
    rich(p, prompt);
    canvas.appendChild(p);
  }

  /* ============================================================
     课前 1-8 页（静态，文案取自 PPT 原文）
     ============================================================ */

  function buildTitle(canvas) {
    canvas.appendChild(el("div", { class: "sl-titlepage" },
      el("img", { class: "sl-logo", src: "assets/logo.png", alt: "绿神话" }),
      el("div", { class: "sl-gametitle font-serif", text: "企业策略游戏" }),
      el("div", { class: "sl-gametitle-md font-serif", text: "《绿神话》" })));
  }

  function buildRules(canvas) {
    const body = el("div", { class: "sl-body-wide" });
    rich(body,
      "欢迎进入角色扮演策略挑战！你们将被分成 4 组：一组担任【政府】的掌舵者，另外三组为【企业】的决策者。通过【集体讨论和投票】，每组将做出至关重要的决策。注意！每次事件的讨论时间仅为【60 秒】，时间紧迫，务必快速做出明智的选择！");
    canvas.appendChild(sectionTitle("创设意象是什么？", "游戏规则"));
    canvas.appendChild(body);
  }

  function buildCampCompany(canvas) {
    canvas.appendChild(sideTab("企业"));
    canvas.appendChild(sectionTitle(null, "阵营"));
    const body = el("div", { class: "sl-body-half" });
    rich(body,
      "在每个事件中，各企业将【独立】做出一个关键决策，各企业的【生态】【经济】两个指标将有对应变动，属性增减将在组内做出决定后展示。　游戏目标：最大化你的经济收益和生态影响力！经济和生态总值最高的企业将成为游戏的赢家。");
    canvas.appendChild(body);
    canvas.appendChild(img("camp-companies.png", "sl-img", "right:56px;top:218px;width:614px;"));
    canvas.appendChild(img("logo.png", "sl-logo-sm", "right:30px;bottom:22px;"));
  }

  function buildMetricTwo(canvas) {
    canvas.appendChild(sectionTitle(null, "指标"));
    const left = el("div", { class: "sl-mcard" },
      el("img", { class: "sl-micon", src: "assets/metric-eco.png", alt: "" }),
      el("div", { class: "sl-mname font-serif", text: "生态" }));
    rich(left, "生态环境的衡量指标，碳排放过多将使生态值下降。初始值：60。当【生态值】≤20 时，【生态值】将减少 10 点。这可是个危险的信号，千万别让生态值滑坡！");
    const right = el("div", { class: "sl-mcard" },
      el("img", { class: "sl-micon", src: "assets/metric-econ.png", alt: "" }),
      el("div", { class: "sl-mname font-serif", text: "经济" }));
    rich(right, "企业可以通过生产活动来提升【经济值】，以维持盈利状态。初始值：60。当【经济值】≤20 时，企业濒临破产，可得到一次政府补贴，【经济值】+10（但机会只有一次哦！）");
    canvas.appendChild(el("div", { class: "sl-mcards" }, left, right));
    canvas.appendChild(img("logo.png", "sl-logo-sm", "right:30px;bottom:22px;"));
  }

  function buildCampGov(canvas) {
    canvas.appendChild(sideTab("政府"));
    canvas.appendChild(sectionTitle(null, "阵营"));
    const body = el("div", { class: "sl-body-half" });
    rich(body,
      "当局可以在关键时刻实施以下干预：严格的处罚措施、经济奖励、补贴。　游戏目标：作为政府，推动企业完成生态转型是你的首要任务。在保障【生态值】提升的同时，还需确保【经济增长】，每一次决策都必须权衡经济发展、环境可持续性和公平性。");
    canvas.appendChild(body);
    canvas.appendChild(img("gov-decor.png", "sl-img", "right:40px;top:120px;width:560px;opacity:.92;"));
  }

  function buildMetricAll(canvas) {
    canvas.appendChild(sectionTitle(null, "指标"));
    const eco = el("div", { class: "sl-mcard" },
      el("img", { class: "sl-micon", src: "assets/metric-eco.png", alt: "" }),
      el("div", { class: "sl-mname font-serif", text: "生态" }));
    rich(eco, "全社会初始值：60×3=180。政府的目的是将最终全社会的总生态值改善到【240】以上！");
    const econ = el("div", { class: "sl-mcard" },
      el("img", { class: "sl-micon", src: "assets/metric-econ.png", alt: "" }),
      el("div", { class: "sl-mname font-serif", text: "经济" }));
    rich(econ, "全社会初始值：60×3=180。政府的目的是促进经济发展，将最终全社会的总经济值提升到【320】以上！");
    const fin = el("div", { class: "sl-mcard" },
      el("img", { class: "sl-micon", src: "assets/metric-finance.png", alt: "" }),
      el("div", { class: "sl-mname font-serif", text: "财政" }));
    rich(fin, "初始值：100。政府的目的是在全年合理分配财政支出！");
    canvas.appendChild(el("div", { class: "sl-mcards3" }, eco, econ, fin));
    canvas.appendChild(img("logo.png", "sl-logo-sm", "right:30px;bottom:22px;"));
  }

  function buildFlowBody(canvas) {
    const body = el("div", { class: "sl-body-wide sl-flowbody" });
    rich(body,
      "游戏周期为 12 个月，每个月企业都会面临一个决策问题，企业做出的不同选择将产生不同的【生态值】和【经济值】变化。政府在特定环节根据各企业表现制定【惩罚】或【奖励】政策。　一年结束后，请政府设计 3 个奖项，为各个企业颁奖，各企业发表获奖感言。　祝大家都能扮演好自己的角色，体验双碳背景下企业与政府的抉择过程，游戏愉快！");
    canvas.appendChild(body);
  }

  function buildFlow(canvas) {
    canvas.appendChild(sectionTitle("创设意象是什么？", "流程"));
    const body = el("div", { class: "sl-body-wide" });
    rich(body,
      "欢迎进入角色扮演策略挑战！你们将被分成 4 组：一组担任【政府】的掌舵者，另外三组为【企业】的决策者。通过【集体讨论和投票】，每组将做出至关重要的决策。注意！每次事件的讨论时间仅为【60 秒】，时间紧迫，务必快速做出明智的选择！");
    canvas.appendChild(body);
  }

  function sectionTitle(banner, title) {
    const wrap = el("div", { class: "sl-sect-head" });
    if (banner) wrap.appendChild(el("div", { class: "sl-sect-banner font-serif", text: banner }));
    wrap.appendChild(el("div", { class: "sl-sect-title font-serif", text: title }));
    return wrap;
  }

  function sideTab(text) {
    return el("div", { class: "sl-tab font-serif", text: text });
  }

  /* ============================================================
     题面页（企业选择）
     ============================================================ */

  /* 每月配图（位置按 PPT 复刻） */
  const Q_MEDIA = {
    "m2-envelope": ["envelope.png", "left:170px;bottom:26px;width:430px;"],
    "m5-pv": ["pv.jpeg", "right:50px;bottom:40px;width:470px;"],
    "m7-charger": ["charger-twoway.jpeg", "right:30px;bottom:30px;width:420px;"],
    "m11-apply": ["zero-carbon-park.png", "right:50px;top:250px;width:400px;"],
  };

  function buildQuestion(canvas, stepInfo, state, atStep, revealed) {
    if (!stepInfo) return;
    const step = stepInfo.step;
    head(canvas, stepInfo.month, step.prompt, false);
    const media = Q_MEDIA[step.id];
    const opts = el("div", { class: "sl-opts" + (media ? " narrow" : "") });
    (step.options || []).forEach(function (o) {
      opts.appendChild(el("div", { class: "sl-opt" },
        el("span", { class: "sl-key", text: o.key || "" }),
        el("div", { class: "sl-opt-body" },
          el("div", { class: "sl-opt-label", text: o.label }),
          o.detail ? el("div", { class: "sl-opt-detail", text: o.detail.replace(/【|】/g, "") }) : null)));
    });
    canvas.appendChild(opts);
    if (media) canvas.appendChild(img(media[0], "sl-img", media[1]));
    if (step.id === "m7-charger") canvas.appendChild(img("charger-oneway.png", "sl-img", "right:400px;bottom:60px;width:300px;opacity:.95;"));

    /* 提交状态芯片：不泄选择 */
    if (state && atStep && !revealed) {
      const chips = el("div", { class: "sl-chips" });
      state.companies.forEach(function (c) {
        const done = !!(state.pendingDecisions && state.pendingDecisions[c.id]);
        chips.appendChild(el("span", { class: "sl-chip" + (done ? " on" : ""), text: c.name + " · " + (done ? "已提交" : "待提交") }));
      });
      chips.appendChild(el("span", { class: "sl-chip timer", text: "讨论 60 秒" }));
      canvas.appendChild(chips);
    }
  }

  /* ============================================================
     答案页（企业选择）：投资 / 每月经济 / 生态 三列
     ============================================================ */

  function pickChips(state, step, matchId, revealed) {
    if (!state || !revealed) return null;
    const picks = [];
    (state.companies || []).forEach(function (c) {
      const d = state.pendingDecisions && state.pendingDecisions[c.id];
      if (d && d.optionId === matchId) picks.push(c.name);
    });
    if (!picks.length) return null;
    return el("span", { class: "sl-picks" }, picks.map(function (nm) {
      return el("span", { class: "sl-pick", text: nm });
    }));
  }

  function buildAnswer(canvas, stepInfo, state, atStep, revealed) {
    if (!stepInfo) return;
    const step = stepInfo.step;
    const lit = !!(state && atStep && revealed);
    head(canvas, stepInfo.month, step.prompt, true);

    if (step.id === "m3-teambuilding") {
      canvas.appendChild(el("div", { class: "sl-banner", text: "董事长的签证被拒了，团建活动改为去北京环球影城" }));
    }

    const rows = el("div", { class: "sl-rows" });
    rows.appendChild(ansHeader());
    (step.options || []).forEach(function (o) {
      const monthlyBadge = !!(o.recurring && o.monthly);
      rows.appendChild(el("div", { class: "sl-row" + (lit ? " lit" : "") },
        el("div", { class: "sl-row-label" },
          el("span", { class: "sl-key sm", text: o.key || "" }),
          el("span", { class: "sl-row-name", text: o.label }),
          pickChips(state, step, o.id, lit)),
        el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", o.cost || 0, lit, false)),
        el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", o.monthly || 0, lit, monthlyBadge)),
        el("div", { class: "sl-row-cell" }, iconNum("metric-eco-sm.png", o.ecology || 0, lit, false))));
    });
    canvas.appendChild(rows);
    if (!lit) canvas.appendChild(el("div", { class: "sl-center-note", text: "等待统一揭示" }));
  }

  function ansHeader() {
    return el("div", { class: "sl-row sl-rowhead" },
      el("div", { class: "sl-row-label", text: "选项" }),
      el("div", { class: "sl-row-cell", text: "投资" }),
      el("div", { class: "sl-row-cell", text: "每月经济" }),
      el("div", { class: "sl-row-cell", text: "生态" }));
  }

  /* ============================================================
     政府题面页
     ============================================================ */

  function buildGovQuestion(canvas, stepInfo, state, atStep) {
    if (!stepInfo) return;
    const step = stepInfo.step;
    head(canvas, stepInfo.month, step.prompt, false);
    const opts = el("div", { class: "sl-opts gov" });
    (step.government.options || []).forEach(function (o, i) {
      opts.appendChild(el("div", { class: "sl-opt" },
        el("span", { class: "sl-key", text: String.fromCharCode(65 + i) }),
        el("div", { class: "sl-opt-body" },
          el("div", { class: "sl-opt-label", text: o.label }),
          el("div", { class: "sl-opt-detail", text: (o.detail || "").replace(/【|】/g, "") }))));
    });
    canvas.appendChild(opts);
    if (step.id !== "m9-blackout") {
      canvas.appendChild(img("gov-decor.png", "sl-img", "right:36px;bottom:24px;width:380px;"));
    } else {
      canvas.appendChild(img("grid-damage.jpeg", "sl-img", "right:40px;top:200px;width:420px;"));
      canvas.appendChild(img("gov-decor.png", "sl-img", "right:36px;bottom:24px;width:380px;"));
    }
    if (state && atStep) {
      canvas.appendChild(el("div", { class: "sl-chips" },
        el("span", { class: "sl-chip gold", text: "政府决策 · 公开进行" })));
    }
  }

  /* ============================================================
     生态奖惩答案页（14 / 29 / 39）
     ============================================================ */

  function ecoExtrema(state) {
    let min = Infinity, max = -Infinity, minIds = [], maxIds = [];
    (state.companies || []).forEach(function (c) {
      if (c.ecology < min) { min = c.ecology; minIds = [c.name]; }
      else if (c.ecology === min) minIds.push(c.name);
      if (c.ecology > max) { max = c.ecology; maxIds = [c.name]; }
      else if (c.ecology === max) maxIds.push(c.name);
    });
    return { lowest: minIds, highest: maxIds };
  }

  function buildEcoAnswer(canvas, stepInfo, month, state, settled) {
    if (!stepInfo) return;
    head(canvas, stepInfo.month, stepInfo.step.prompt, true);
    /* 所选力度：从 policyLog 取（ecoBothLight=±10 / ecoBothHeavy=±20） */
    let chosen = null;
    if (state) {
      const logs = state.government.policyLog.filter(function (p) { return p.month === month && p.policyId.indexOf("ecoBoth") >= 0; });
      if (logs.length) {
        const pid = logs[logs.length - 1].policyId;
        chosen = pid.indexOf("Light") >= 0 ? 10 : 20;
      }
    }
    const on = function (v) { return settled && chosen === v ? " picked" : ""; };
    const ext = state ? ecoExtrema(state) : null;
    const orb = function (v, lab) {
      return el("span", { class: "sl-orb" + on(Math.abs(v)) },
        iconNum("metric-econ-sm.png", v, settled && chosen === Math.abs(v), false),
        el("span", { class: "sl-orb-txt", text: lab }));
    };

    canvas.appendChild(el("div", { class: "sl-ecoblocks" },
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "对生态值最低的企业罚款，用于植树造林" }),
        el("div", { class: "sl-eco-chips" },
          orb(-10, "从轻"), el("span", { class: "sl-or-sep", text: "或" }), orb(-20, "从重")),
        ext && settled ? el("div", { class: "sl-eco-who neg", text: "最低：" + ext.lowest.join("、") }) : null),
      el("div", { class: "sl-eco-block-sep" }),
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "对生态值最高的企业奖励" }),
        el("div", { class: "sl-eco-chips" },
          orb(10, "从轻"), el("span", { class: "sl-or-sep", text: "或" }), orb(20, "从重")),
        ext && settled ? el("div", { class: "sl-eco-who pos", text: "最高：" + ext.highest.join("、") }) : null)));

    canvas.appendChild(el("div", { class: "sl-center-note", text: settled ? "力度一致 · 同时生效 · 财政净变动 0" : "请政府决定罚款和奖励力度" }));
  }

  /* ============================================================
     17 疫情页（手动 +1 到达）
     ============================================================ */

  function buildPandemic(canvas, stepInfo, state) {
    canvas.appendChild(el("div", { class: "sl-month num", text: "3月" }));
    canvas.appendChild(el("div", { class: "sl-big-title font-serif", text: "突发事件 : 疫情爆发 !!!" }));
    const rows = el("div", { class: "sl-rows left" });
    const eff = stepInfo ? (stepInfo.step.followUp || {}).effects || {} : {};
    const caps = {
      "m3-A": "去环球影城的员工，由于人群密集，部分不幸感染",
      "m3-B": "去新疆骑马团建的员工因疫情爆发被困在酒店隔离",
      "m3-C": "在公司楼下种树的员工没有受到影响",
    };
    ["m3-A", "m3-B", "m3-C"].forEach(function (id) {
      rows.appendChild(el("div", { class: "sl-row lit" },
        el("div", { class: "sl-row-label", text: caps[id] }),
        el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", (eff[id] || {}).economy || 0, true, false))));
    });
    canvas.appendChild(rows);
    canvas.appendChild(img("pandemic.png", "sl-img", "right:60px;bottom:60px;width:320px;"));
  }

  /* ============================================================
     19 页：4 月答案（停工 / 继续生产 + 掷骰 B1-B3）
     ============================================================ */

  function diceChips(state, eventId, month) {
    const list = (state && state.dice || []).filter(function (d) { return d.eventId === eventId && d.month === month; });
    if (!list.length) return null;
    return el("div", { class: "sl-chips dice" }, list.map(function (d) {
      const c = state.companies.find(function (x) { return x.id === d.companyId; });
      return el("span", { class: "sl-chip on", text: (c ? c.name : d.companyId) + " ⚂" + d.face + " → " + d.outcome });
    }));
  }

  function buildM4Answer(canvas, stepInfo, state, atStep, settled) {
    if (!stepInfo) return;
    head(canvas, 4, stepInfo.step.prompt, true);

    let chosenId = null;
    if (state) {
      const logs = state.government.policyLog.filter(function (p) { return p.month === 4; });
      if (logs.length) chosenId = logs[logs.length - 1].policyId;
    }
    const isA = chosenId === "m4-A";
    const isB = chosenId === "m4-B";
    const m4lit = settled || (state && state.stepSettled && state.stepSettled.stepId === "m4-dice");

    canvas.appendChild(el("div", { class: "sl-m4wrap" },
      el("div", { class: "sl-m4-col" },
        el("div", { class: "sl-eco-title", text: "若选择 A · 停工停产" }),
        el("div", { class: "sl-orb" + (isA ? " picked" : "") },
          iconNum("metric-econ-sm.png", -10, isA && settled, false), el("span", { class: "sl-orb-txt", text: "每家企业" }))),
      el("div", { class: "sl-m4-col" },
        el("div", { class: "sl-eco-title", text: "若选择 B · 继续正常生产（掷骰）" }),
        el("div", { class: "sl-rows dense" },
          el("div", { class: "sl-row" + (m4lit ? " lit" : "") },
            el("div", { class: "sl-row-label", text: "B1 · 员工大规模阳了，无法工作" }),
            el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", -10, m4lit, false))),
          el("div", { class: "sl-row" + (m4lit ? " lit" : "") },
            el("div", { class: "sl-row-label", text: "B2 · 部分员工阳了，效率下降" }),
            el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", -5, m4lit, false))),
          el("div", { class: "sl-row" + (m4lit ? " lit" : "") },
            el("div", { class: "sl-row-label", text: "B3 · 大家都是天选打工人" }),
            el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", 0, m4lit, false)))),
        el("div", { class: "sl-note", text: "掷骰规则：结果 1、2 → B1；3、4 → B2；5、6 → B3" }))));

    const chips = diceChips(state, "m4-dice", 4);
    if (chips) canvas.appendChild(chips);
  }

  /* ============================================================
     23 页：6 月补贴答案
     ============================================================ */

  function buildM6Answer(canvas, stepInfo, state, settled) {
    if (!stepInfo) return;
    head(canvas, 6, stepInfo.step.prompt, true);
    let chosen = null;
    if (state) {
      const logs = state.government.policyLog.filter(function (p) { return p.month === 6; });
      if (logs.length) chosen = logs[logs.length - 1].policyId;
    }
    const sub = chosen === "m6-A";
    const pvNames = state ? state.companies.filter(function (c) { return c.assets.rooftopPV; }).map(function (c) { return c.name; }) : [];

    canvas.appendChild(el("div", { class: "sl-ecoblocks" },
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "【对于已安装光伏的企业】" }),
        el("div", { class: "sl-eco-chips" },
          el("span", { class: "sl-orb" + (sub && settled ? " picked" : "") },
            iconNum("metric-econ-sm.png", 2, sub && settled, true), el("span", { class: "sl-orb-txt", text: "每月经济" }))),
        sub && settled && pvNames.length ? el("div", { class: "sl-eco-who pos", text: "受益：" + pvNames.join("、") }) : null),
      el("div", { class: "sl-eco-block-sep" }),
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "【未安装光伏的企业】" }),
        el("div", { class: "sl-eco-chips" },
          el("span", { class: "sl-orb" }, iconNum("metric-econ-sm.png", 0, false, false), el("span", { class: "sl-orb-txt", text: "不受影响" }))))));

    canvas.appendChild(el("div", { class: "sl-center-note", text: settled
      ? (sub ? "政府财政 6 月一次性每家 -2；企业侧此后每月 +2（光伏自身收益），持续到 12 月" : "政府决定不进行补贴")
      : "请政府决策" }));
  }

  /* ============================================================
     30 页：台风掷骰
     ============================================================ */

  function buildTyphoon(canvas, stepInfo, state, settled) {
    canvas.appendChild(el("div", { class: "sl-month num", text: "9月" }));
    canvas.appendChild(el("div", { class: "sl-big-title sm font-serif", text: "突发事件：台风「塔巴」登陆 !!!" }));
    const rows = el("div", { class: "sl-rows left" });
    const step = stepInfo ? stepInfo.step : null;
    const res = step ? step.results : [];
    const caps = ["A", "B"];
    res.forEach(function (r, i) {
      const label = i === 0 ? "A · 屋顶光伏不堪一击，被台风连根拔起，修缮费用" : "B · 光伏板坚如磐石，成功抵御狂风，设备完好无损";
      rows.appendChild(el("div", { class: "sl-row" + (settled ? " lit" : "") },
        el("div", { class: "sl-row-label", text: label }),
        el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", r.economy, settled, false))));
    });
    canvas.appendChild(rows);
    canvas.appendChild(el("div", { class: "sl-note", text: "请【拥有屋顶光伏】的企业掷骰子决定：结果 1、3、5 → A；2、4、6 → B" }));
    const chips = diceChips(state, "m9-typhoonPV", 9);
    if (chips) canvas.appendChild(chips);
    canvas.appendChild(img("typhoon.jpeg", "sl-img", "right:50px;top:120px;width:480px;border-radius:16px;"));
  }

  /* ============================================================
     32 页：9 月停电政府答案
     ============================================================ */

  function buildM9Answer(canvas, stepInfo, state, settled) {
    if (!stepInfo) return;
    head(canvas, 9, stepInfo.step.prompt, true);
    let chosen = null;
    if (state) {
      const logs = state.government.policyLog.filter(function (p) { return p.month === 9 && p.policyId.indexOf("m9-") === 0; });
      if (logs.length) chosen = logs[logs.length - 1].policyId;
    }
    const caps = {
      "m9-A": "企业完全停工，经济损失严重",
      "m9-B": "企业生产效率大幅下降",
      "m9-C": "企业获得资金",
    };
    const econ = { "m9-A": -15, "m9-B": -10, "m9-C": 10 };
    const rows = el("div", { class: "sl-rows left" });
    (stepInfo.step.government.options || []).forEach(function (o) {
      const picked = settled && chosen === o.id;
      rows.appendChild(el("div", { class: "sl-row" + (settled ? " lit" : "") + (picked ? " picked-row" : "") },
        el("div", { class: "sl-row-label" },
          el("span", { class: "sl-key sm", text: o.id.slice(-1) }),
          el("span", { class: "sl-row-name", text: o.label }),
          el("span", { class: "sl-opt-detail", text: caps[o.id] || "" })),
        el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", econ[o.id] || 0, settled, false))));
    });
    canvas.appendChild(rows);
    if (settled && chosen === "m9-C") {
      canvas.appendChild(el("div", { class: "sl-center-note", text: "政府财政 -30（抢险救灾资金）" }));
    }
  }

  /* ============================================================
     33 页：自备电力加成（自动事件）
     ============================================================ */

  function buildSelfPower(canvas, stepInfo, state, settled) {
    canvas.appendChild(el("div", { class: "sl-month num", text: "9月" }));
    const p = el("div", { class: "sl-prompt" });
    rich(p, "台风「塔巴」重创本市，电力设施大规模损毁，预计电网中断一个月。面对这场危机，企业：");
    canvas.appendChild(p);
    canvas.appendChild(el("div", { class: "sl-ecoblocks" },
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "【拥有屋顶光伏】" }),
        el("div", { class: "sl-eco-chips" },
          el("span", { class: "sl-orb" }, iconNum("metric-econ-sm.png", 5, settled, false), el("span", { class: "sl-orb-txt", text: "经济" })))),
      el("div", { class: "sl-eco-block-sep" }),
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "【拥有蓄电池】或【拥有双向充电桩】" }),
        el("div", { class: "sl-eco-chips" },
          el("span", { class: "sl-orb" }, iconNum("metric-econ-sm.png", 5, settled, false), el("span", { class: "sl-orb-txt", text: "经济（可叠加 +10）" }))))));

    if (state && settled) {
      const chips = el("div", { class: "sl-chips" });
      state.companies.forEach(function (c) {
        const pv = c.assets.rooftopPV;
        const st = c.assets.battery || c.assets.twoWayCharger;
        const delta = (pv ? 5 : 0) + (st ? 5 : 0);
        chips.appendChild(el("span", { class: "sl-chip" + (delta > 0 ? " on" : "") },
          c.name + "：光伏" + (pv ? "✔" : "✘") + " 储电" + (st ? "✔" : "✘") + " → " + (delta > 0 ? "+" + delta : "无加成")));
      });
      canvas.appendChild(chips);
    } else {
      canvas.appendChild(el("div", { class: "sl-center-note", text: "按各企业资产自动结算" }));
    }
  }

  /* ============================================================
     34 页：油价冲击（自动事件 + 持续流）
     ============================================================ */

  function buildOil(canvas, stepInfo, state, settled) {
    canvas.appendChild(el("div", { class: "sl-month num", text: "10月" }));
    canvas.appendChild(el("div", { class: "sl-prompt", text: "俄乌战争导致全球供应链受到冲击，国际油价大幅飙升" }));
    canvas.appendChild(el("div", { class: "sl-ecoblocks" },
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "【已安装电动车充电桩】的企业" }),
        el("div", { class: "sl-eco-chips" },
          el("span", { class: "sl-orb" }, iconNum("metric-econ-sm.png", 0, false, false), el("span", { class: "sl-orb-txt", text: "不受影响" })))),
      el("div", { class: "sl-eco-block-sep" }),
      el("div", { class: "sl-ecoblock" },
        el("div", { class: "sl-eco-title", text: "【未安装电动车充电桩】的企业" }),
        el("div", { class: "sl-eco-chips" },
          el("span", { class: "sl-orb" }, iconNum("metric-econ-sm.png", -3, settled, true), el("span", { class: "sl-orb-txt", text: "每月经济，直至 12 月" }))))));

    if (state && settled) {
      const chips = el("div", { class: "sl-chips" });
      state.companies.forEach(function (c) {
        const has = c.assets.oneWayCharger || c.assets.twoWayCharger;
        chips.appendChild(el("span", { class: "sl-chip" + (has ? " on" : " warn") },
          c.name + "：" + (has ? "已有充电桩，不受影响" : "每月经济 -3")));
      });
      canvas.appendChild(chips);
    } else {
      canvas.appendChild(el("div", { class: "sl-center-note", text: "按各企业资产自动结算" }));
    }
  }

  /* ============================================================
     36 页：11 月申报答案（意图 + R1-R4 加装表）
     ============================================================ */

  function buildM11Answer(canvas, stepInfo, state, atStep, revealed) {
    if (!stepInfo) return;
    const step = stepInfo.step;
    const lit = !!(state && atStep && revealed);
    head(canvas, 11, step.prompt, true);

    /* 申报意图 */
    if (lit) {
      const chips = el("div", { class: "sl-chips" });
      state.companies.forEach(function (c) {
        const d = state.pendingDecisions && state.pendingDecisions[c.id];
        const label = d && d.optionId === "m11-A" ? "直接申报" : d && d.optionId === "m11-B" ? "加装后申报" : "观望";
        chips.appendChild(el("span", { class: "sl-chip" + (label === "观望" ? "" : " on") }, c.name + "：" + label));
      });
      canvas.appendChild(chips);
    }

    canvas.appendChild(el("div", { class: "sl-banner", text: "对于选择 B（加装后申报）的企业：" }));
    const rows = el("div", { class: "sl-rows m11" });
    rows.appendChild(ansHeader());
    (step.retrofitOptions || []).forEach(function (r) {
      const picks = [];
      if (state && lit) {
        const rc = state.retrofitChoices || {};
        state.companies.forEach(function (c) { if (rc[c.id] === r.id) picks.push(c.name); });
      }
      rows.appendChild(el("div", { class: "sl-row" + (lit ? " lit" : "") },
        el("div", { class: "sl-row-label" },
          el("span", { class: "sl-row-name", text: r.label }),
          picks.length ? el("span", { class: "sl-picks" }, picks.map(function (nm) { return el("span", { class: "sl-pick", text: nm }); })) : null),
        el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", r.cost || 0, lit, false)),
        el("div", { class: "sl-row-cell" }, iconNum("metric-econ-sm.png", r.monthly || 0, lit, !!(r.recurring && r.monthly))),
        el("div", { class: "sl-row-cell" }, iconNum("metric-eco-sm.png", r.ecology || 0, lit, false))));
    });
    canvas.appendChild(rows);
    if (!lit) canvas.appendChild(el("div", { class: "sl-center-note", text: "等待统一揭示" }));
  }

  /* ============================================================
     37 页：试点资金（资格 + 四档）
     ============================================================ */

  function buildFunding(canvas, stepInfo, state, settled) {
    if (!stepInfo) return;
    head(canvas, 11, stepInfo.step.prompt, true);
    const tiers = stepInfo.step.government.tiers || [];

    /* 已发放档位（金额集合）与各企业所得 */
    const granted = {};
    const grantedAmt = {};
    if (state) {
      state.government.policyLog.filter(function (p) { return p.month === 11 && p.policyId === "m11-funding"; })
        .forEach(function (p) {
          const cid = p.targets && p.targets[0];
          if (cid) { granted[cid] = p.label; grantedAmt[-p.finance] = true; }
        });
    }

    /* 资格行：紧贴题面之下 */
    const apps = state && state.zeroCarbonApplications;
    if (state && apps) {
      const list = el("div", { class: "sl-chips fund" });
      state.companies.forEach(function (c) {
        const a = apps[c.id] || {};
        let txt = c.name + "：", cls = "";
        if (!a.applied) txt += "未申报";
        else if (!a.eligible) { txt += "申报 · 资格不足 ✘"; cls = " warn"; }
        else if (granted[c.id]) { txt += "合格 ✔ → " + granted[c.id]; cls = " gold"; }
        else { txt += "合格 ✔ · 待发放"; cls = " on"; }
        list.appendChild(el("span", { class: "sl-chip" + cls }, txt));
      });
      canvas.appendChild(list);
    }

    const chips = el("div", { class: "sl-tierrow" });
    tiers.forEach(function (t, i) {
      chips.appendChild(el("span", { class: "sl-orb tier" + (settled && grantedAmt[t.amount] ? " picked" : "") },
        iconNum("metric-econ-sm.png", t.amount, settled, false),
        el("span", { class: "sl-orb-txt", text: t.label })));
      if (i < tiers.length - 1) chips.appendChild(el("span", { class: "sl-or-sep", text: "或" }));
    });
    canvas.appendChild(chips);

    canvas.appendChild(el("div", { class: "sl-center-note", text: "资格：屋顶光伏 / 双向充电桩 / 蓄电池 至少具备两项" }));
  }

  /* ============================================================
     42 页：年终
     ============================================================ */

  function buildFinal(canvas, state) {
    canvas.appendChild(el("div", { class: "sl-finalhead" },
      el("div", { class: "sl-big-title font-serif", text: "一年结束" }),
      el("div", { class: "sl-award-title font-serif", text: "政府颁奖环节" })));

    if (!state || !state.companies) return;
    const ranked = state.companies.map(function (c) {
      return { name: c.name, economy: c.economy, ecology: c.ecology, total: c.economy + c.ecology };
    }).sort(function (a, b) { return b.total - a.total; });
    const totalEco = state.companies.reduce(function (s, c) { return s + c.ecology; }, 0);
    const totalEcon = state.companies.reduce(function (s, c) { return s + c.economy; }, 0);
    const fin = state.government.finance;

    const rk = el("div", { class: "sl-rank" });
    ranked.forEach(function (r, i) {
      rk.appendChild(el("div", { class: "sl-rank-row" + (i === 0 ? " first" : "") },
        el("span", { class: "sl-rank-pos font-serif", text: ["第一名", "第二名", "第三名"][i] }),
        el("span", { class: "sl-rank-name", text: r.name }),
        el("span", { class: "sl-rank-vals num", text: "经济 " + r.economy + " · 生态 " + r.ecology }),
        el("span", { class: "sl-rank-total num", text: r.total + " 分" })));
    });
    canvas.appendChild(rk);

    canvas.appendChild(el("div", { class: "sl-goals" },
      goalChip("全社会生态≥240：", totalEco, totalEco >= 240),
      goalChip("全社会经济≥320：", totalEcon, totalEcon >= 320),
      goalChip("财政不为负：", fin, fin >= 0)));

    const awards = state.government.awards || [];
    if (awards.length) {
      const list = el("div", { class: "sl-awards" });
      awards.forEach(function (a) {
        const c = state.companies.find(function (x) { return x.id === a.companyId; });
        list.appendChild(el("div", { class: "sl-award" },
          el("span", { class: "sl-award-name font-serif", text: "« " + a.name + " »" }),
          el("span", { class: "sl-award-to", text: (c ? c.name : "") + (a.reason ? " — " + a.reason : "") })));
      });
      canvas.appendChild(list);
    }
  }

  function goalChip(label, value, ok) {
    return el("span", { class: "sl-goal " + (ok ? "ok" : "miss") },
      label + " " + value + (ok ? " ✓ 达成" : " ✗ 未达"));
  }

  /* ---------- 导出 ---------- */

  return {
    TOTAL: TOTAL,
    SLIDES: SLIDES,
    autoSlide: autoSlide,
    phaseKey: phaseKey,
    renderSlide: renderSlide,
  };
});
