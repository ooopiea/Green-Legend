/* ============================================================
   《绿神话》舞台页（#/stage）· 幻灯片播放器
   同源窗口：监听 storage 事件 + 轮询 localStorage，实时镜像中控状态
   结构：.theater > .th-hud（细条）/ .th-slidebox > .th-slide-scale
        > .sl-canvas（1280×720 设计画布，transform:scale 适配）
        + .th-veil（等待幕）/ .th-floats（结算飘字，不随缩放）

   渲染策略：页号 = 有存档时 clamp(autoSlide+offset,1,42)，否则 introSlide；
   仅当页号或相位键（GreenSlides.phaseKey）变化时重建页面节点——
   同页重渲染加 .no-anim 抑制动画，防止 800ms 轮询重播；
   换页 450ms 交叉过渡（prefers-reduced-motion 直接替换）。
   HUD 文本与数字每次直接更新（含 rAF 数字滚动），不触碰动画节点。
   ============================================================ */

(function (root) {
  "use strict";

  const E = root.GreenEngine, EV = root.GreenEvents, U = root.GreenUI, GL = root.GreenSlides;
  const STAGE_UI_KEY = "greentales-stage";
  const TOTAL = 42;

  const ControlStage = {};
  let mounted = false;
  let lastTick = null;

  /* ---------- 骨架引用与增量签名 ---------- */
  let theaterEl = null;      // .theater
  let hudEl = null;          // .th-hud（整条，受 hudVisible 门控）
  let slideboxEl = null;     // .th-slidebox
  let veilEl = null;         // .th-veil（无存档等待幕）
  let floatsEl = null;       // .th-floats
  let scaleLayer = null;     // 当前 .th-slide-scale
  const hud = {};            // HUD 内可变节点引用
  let lastSlideNo = null, lastPhase = null;
  let lastMonthKey = null, lastCompsSig = null, lastRiskSig = null;
  let prevVals = null;       // { fin, companies: { id: {econ, eco} } } —— 飘字比对基准
  const numShown = {};       // tween 键 -> 当前显示值
  const tweenSeq = {};       // tween 键 -> 序号（新 tween 使旧帧失效）

  /* ================= 同步（协议不变） ================= */

  ControlStage.mount = function (app) {
    if (mounted) { render(); return; } // hash 切回舞台页：避免重复挂监听
    mounted = true;
    window.addEventListener("storage", onStorage);
    // file:// 下部分浏览器不触发 storage 事件，轮询兜底
    setInterval(poll, 800);
    window.addEventListener("resize", fitScale);
    render();
  };

  function onStorage(e) {
    if (e.key === E.SAVE_KEY || e.key === "greentales-tick" || e.key === STAGE_UI_KEY) render();
  }

  function poll() {
    const tick = U.storage.get("greentales-tick");
    const raw = U.storage.get(E.SAVE_KEY);
    const stageUi = U.storage.get(STAGE_UI_KEY);
    // 第三段取原文：等长改写（如偏移 ±1 往返）也能触发
    const sig = tick + "|" + (raw ? raw.length : 0) + "|" + (stageUi || "");
    if (sig !== lastTick) { lastTick = sig; render(); }
  }

  function getState() {
    const raw = U.storage.get(E.SAVE_KEY);
    if (!raw) return null;
    const r = E.deserialize(raw);
    return r.ok ? r.state : null;
  }

  function readStageUi() {
    try {
      const v = JSON.parse(U.storage.get(STAGE_UI_KEY) || "");
      if (v && v.ver === 1) return v;
    } catch (e) {}
    return { ver: 1, offset: 0, introSlide: 1, hudVisible: true };
  }

  /* ================= 渲染主入口 ================= */

  function render() {
    const app = document.getElementById("app");
    const state = getState();
    const ui = readStageUi();

    if (!theaterEl || theaterEl.parentNode !== app) buildTheater(app);

    /* 等待幕：无存档时暗显当前页并盖幕 */
    veilEl.style.display = state ? "none" : "";

    /* 页号：有存档随流程自动 + 手动偏移；无存档用课前手动页 */
    let slideNo;
    if (state) {
      const auto = GL.autoSlide(state, EV);
      slideNo = auto == null ? ui.introSlide : Math.min(TOTAL, Math.max(1, auto + (ui.offset || 0)));
    } else {
      slideNo = Math.min(TOTAL, Math.max(1, ui.introSlide || 1));
    }
    updateSlide(slideNo, state);

    /* HUD：无存档或中控关闭时整条隐藏 */
    hudEl.style.display = state && ui.hudVisible !== false ? "" : "none";
    if (state && ui.hudVisible !== false) updateHud(state);
    else prevVals = null;

    if (state) spawnFloats(state);
  }

  /* ---------- 骨架 ---------- */

  function buildTheater(app) {
    app.innerHTML = "";
    resetSigs();

    hud.risk = U.el("span", { class: "th-hud-risk" });
    hud.month = U.el("span", { class: "th-hud-month" });
    hud.govWrap = U.el("span", { class: "th-hud-gov" }, "财政 ",
      hud.govBar = U.el("span", { class: "mini-bar" }, U.el("i")),
      hud.govNum = U.el("b", { text: "—" }),
      hud.govTotals = U.el("span", { class: "th-hud-totals" },
        hud.totalEcology = U.el("span", { class: "th-total", text: "总生态 —/240" }),
        hud.totalEconomy = U.el("span", { class: "th-total", text: "总经济 —/320" }),
        hud.financeGoal = U.el("span", { class: "th-total", text: "财政目标 ≥0" })));
    hud.comps = U.el("span", { class: "th-hud-comps" });

    hudEl = U.el("div", { class: "th-hud" },
      U.el("div", { class: "th-hud-meta" },
        hud.month,
        hud.govWrap,
        hud.risk,
        U.el("span", { class: "spacer" })),
      hud.comps,

    );

    veilEl = U.el("div", { class: "th-veil" },
      U.el("h2", { text: "《绿神话》" }),
      U.el("p", { text: "等待主持人开局……请在另一窗口打开 #/control 开始游戏" }));

    floatsEl = U.el("div", { class: "th-floats" });

    theaterEl = U.el("div", { class: "theater" },
      hudEl,
      slideboxEl = U.el("div", { class: "th-slidebox" }, veilEl, floatsEl),
      // 逃生口：舞台页无任何导航，误入（链接/会话恢复/地址栏补全）后困在此页——右下角常驻返回
      U.el("button", {
        class: "th-back", text: "⟲ 返回中控",
        title: "在本窗口打开中控台",
        onclick: function () { location.hash = "#/control"; },
      }));
    app.appendChild(theaterEl);
  }

  function resetSigs() {
    lastSlideNo = lastPhase = null;
    lastMonthKey = lastCompsSig = lastRiskSig = null;
    prevVals = null;
    scaleLayer = null;
  }

  /* ---------- 幻灯片（页号/相位键变化时重建）---------- */

  function updateSlide(slideNo, state) {
    const phase = GL.phaseKey(state);
    if (slideNo === lastSlideNo && phase === lastPhase) return;
    const samePage = slideNo === lastSlideNo;
    lastSlideNo = slideNo;
    lastPhase = phase;

    const canvas = GL.renderSlide(slideNo, { state: state, EV: EV });
    if (samePage) canvas.classList.add("no-anim"); // 同页重渲染不重播动画
    const layer = U.el("div", { class: "th-slide-scale" }, canvas);

    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const old = scaleLayer;
    if (old && old.parentNode) {
      if (!reduced && !samePage) {
        old.classList.add("leave");
        layer.classList.add("enter");
        setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 480);
      } else {
        slideboxEl.removeChild(old);
      }
    } else if (!reduced) {
      layer.classList.add("enter"); // 首挂淡入
    }
    slideboxEl.insertBefore(layer, floatsEl); // 飘字层恒在其上
    scaleLayer = layer;
    fitScale();
  }

  /* 设计画布 1280×720 → 视口信箱化适配（floats/veil 不随缩放） */
  function fitScale() {
    if (!slideboxEl) return;
    const w = slideboxEl.clientWidth, h = slideboxEl.clientHeight;
    if (!w || !h) return;
    const s = Math.min(w / 1280, h / 720);
    Array.prototype.forEach.call(slideboxEl.querySelectorAll(".th-slide-scale"), function (l) {
      l.style.transform = "translate(-50%, -50%) scale(" + s + ")";
    });
  }

  /* ---------- HUD（细条）---------- */

  function updateHud(state) {
    const md = EV.MONTHS.find(m => m.month === state.month);
    // 月份 + 月标题
    const mk = state.month + "|" + (md ? md.title : "") + "|" + (state.finished ? 1 : 0);
    if (mk !== lastMonthKey) {
      lastMonthKey = mk;
      U.clear(hud.month);
      hud.month.appendChild(U.el("b", { text: state.month + " 月" }));
      hud.month.appendChild(document.createTextNode(" " + (state.finished ? "年终结算" : (md ? md.title : ""))));
    }
    // 财政（数字滚动 + 微缩条）
    const fin = state.government.finance;
    const final = E.computeFinal(state);
    hud.govWrap.classList.toggle("danger", fin < 30);
    hud.govBar.firstChild.style.width = Math.max(0, Math.min(100, fin)) + "%";
    tweenNumber(hud.govNum, "fin", fin);
    hud.totalEcology.textContent = "总生态 " + E.fmtNumber(final.totalEcology) + "/" + final.goals.ecology.target;
    hud.totalEcology.classList.toggle("ok", final.goals.ecology.achieved);
    hud.totalEconomy.textContent = "总经济 " + E.fmtNumber(final.totalEconomy) + "/" + final.goals.economy.target;
    hud.totalEconomy.classList.toggle("ok", final.goals.economy.achieved);
    hud.financeGoal.textContent = "财政目标 ≥" + final.goals.finance.target;
    hud.financeGoal.classList.toggle("ok", final.goals.finance.achieved);
    // 三家企业经济/生态双值
    let best = -Infinity;
    state.companies.forEach(c => { const t = c.economy + c.ecology; if (t > best) best = t; });
    const csSig = state.companies
      .map(c => c.name + ":" + assetsSignature(c.assets))
      .join("|");
    if (csSig !== lastCompsSig) {
      lastCompsSig = csSig;
      U.clear(hud.comps);
      state.companies.forEach(c => {
        hud.comps.appendChild(U.el("div", { class: "th-comp", "data-id": c.id },
          U.el("div", { class: "th-comp-head" },
            U.el("span", { class: "th-comp-name", text: c.name }),
            U.el("div", { class: "th-assets" }, assetTags(c.assets))),
          U.el("div", { class: "th-values" },
            U.el("div", { class: "th-value" },
              U.el("small", { text: "经济" }),
              U.el("b", { class: "cv-e", text: E.fmtNumber(c.economy) })),
            U.el("div", { class: "th-value" },
              U.el("small", { text: "生态" }),
              U.el("b", { class: "cv-c", text: E.fmtNumber(c.ecology) })))));
      });
    }
    state.companies.forEach(c => {
      const el = hud.comps.querySelector('[data-id="' + c.id + '"]');
      if (!el) return;
      el.classList.toggle("danger", c.economy <= 20 || c.ecology <= 20);
      el.classList.toggle("leader", (c.economy + c.ecology) === best);
      tweenNumber(el.querySelector(".cv-e"), "comp-e-" + c.id, c.economy);
      tweenNumber(el.querySelector(".cv-c"), "comp-c-" + c.id, c.ecology);
    });
    // 风险提示
    const risky = state.companies.filter(c => c.economy <= 20 || c.ecology <= 20);
    const rSig = risky.map(c => c.id + (c.economy <= 20 ? "E" : "") + (c.ecology <= 20 ? "C" : "")).join(",");
    if (rSig !== lastRiskSig) {
      lastRiskSig = rSig;
      hud.risk.style.display = risky.length ? "" : "none";
      hud.risk.textContent = risky.length
        ? "⚠ " + risky.map(c => c.name + (c.economy <= 20 && c.ecology <= 20 ? "（经济/生态）" : c.economy <= 20 ? "（经济）" : "（生态）")).join(" / ")
        : "";
    }
  }

  function assetsSignature(assets) {
    const owned = assets || {};
    return Object.keys(EV.ASSET_META).map(id => owned[id] ? "1" : "0").join("");
  }

  function assetTags(assets) {
    const owned = assets || {};
    const shortNames = {
      rooftopPV: "光伏",
      battery: "蓄电池",
      oneWayCharger: "单向桩",
      twoWayCharger: "双向桩",
    };
    return Object.keys(EV.ASSET_META)
      .filter(id => owned[id])
      .map(id => {
        const meta = EV.ASSET_META[id];
        return U.el("span", {
          class: "th-asset",
          text: meta.icon + " " + (shortNames[id] || meta.name),
          title: meta.name,
        });
      });
  }

  /* ---------- 浮动结算数字（比对上次值，通用覆盖各类结算）---------- */

  function spawnFloats(state) {
    const cur = { fin: state.government.finance, companies: {} };
    state.companies.forEach(c => { cur.companies[c.id] = { econ: c.economy, eco: c.ecology }; });

    if (prevVals && floatsEl) {
      let idx = 0;
      state.companies.forEach(c => {
        const pv = prevVals.companies[c.id];
        if (!pv) return;
        const dE = c.economy - pv.econ, dC = c.ecology - pv.eco;
        if (dE === 0 && dC === 0) return;
        const tag = U.el("div", { class: "float-tag", style: "top:" + (24 + idx * 16) + "%;animation-delay:" + (idx * 0.18) + "s" },
          U.el("span", { class: "fname", text: c.name }),
          U.el("span", { class: "fdelta" },
            U.el("span", { class: dE > 0 ? "pos" : dE < 0 ? "neg" : "flat", text: "经济 " + (dE > 0 ? "+" : "") + dE }),
            "　",
            U.el("span", { class: dC > 0 ? "pos" : dC < 0 ? "neg" : "flat", text: "生态 " + (dC > 0 ? "+" : "") + dC })));
        floatsEl.appendChild(tag);
        setTimeout(function () { if (tag.parentNode) tag.parentNode.removeChild(tag); }, 2400);
        idx++;
      });
    }
    prevVals = cur;
  }

  /* ---------- HUD 数字滚动 ---------- */

  function tweenNumber(el, key, to) {
    const from = numShown[key];
    if (from === undefined || from === to) {
      numShown[key] = to;
      el.textContent = E.fmtNumber(to);
      return;
    }
    numShown[key] = to;
    const seq = (tweenSeq[key] = (tweenSeq[key] || 0) + 1);
    const start = performance.now(), dur = 400;
    function frame(now) {
      if (tweenSeq[key] !== seq) return; // 已有更新的目标，放弃旧动画
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  root.ControlStage = ControlStage;
})(typeof self !== "undefined" ? self : this);
