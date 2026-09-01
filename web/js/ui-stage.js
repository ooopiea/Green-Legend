/* ============================================================
   《绿神话》舞台页（#/stage）· 剧场式布局
   同源窗口：监听 storage 事件 + 轮询 localStorage，实时镜像中控状态
   结构：.theater > .th-hud（细条）/ .th-stage（场景+题面+浮字）/ .th-deck（选项卡）

   渲染策略：骨架式增量更新——骨架只建一次；场景按 sceneKey、选项区
   按 deckSig 变化时才重建（避免 800ms 轮询重启 CSS 动画）；HUD 文本与
   数字每次直接更新（含 rAF 数字滚动），不触碰动画节点。
   ============================================================ */

(function (root) {
  "use strict";

  const E = root.GreenEngine, EV = root.GreenEvents, U = root.GreenUI, SC = root.GreenScenes;

  const ControlStage = {};
  let lastTick = null;
  let mounted = false;

  /* ---------- 骨架引用与增量签名 ---------- */
  let theaterEl = null;      // .theater
  let emptyEl = null;        // .th-empty（无存档等待幕）
  const hud = {};            // HUD 内可变节点引用
  const copy = {};           // 题面叠层节点引用
  let stageBox = null;       // .th-stage
  let sceneEl = null;        // .th-scene（整个节点按需替换以重播 scene-fade）
  let deckEl = null;         // .th-deck
  let floatsEl = null;       // .th-floats
  let lastSceneKey = null, lastDeckSig = null, lastRiskSig = null;
  let lastMonthKey = null, lastCompsSig = null, lastCopyKey = null;
  let prevVals = null;       // { fin, companies: { id: {econ, eco} } } —— 浮动数字比对基准
  const numShown = {};       // tween 键 -> 当前显示值
  const tweenSeq = {};       // tween 键 -> 序号（新 tween 使旧帧失效）

  /* ================= 同步（协议不变） ================= */

  ControlStage.mount = function (app) {
    if (mounted) { render(); return; } // hash 切回舞台页：避免重复挂监听
    mounted = true;
    window.addEventListener("storage", onStorage);
    // file:// 下部分浏览器不触发 storage 事件，轮询兜底
    setInterval(poll, 800);
    render();
  };

  function onStorage(e) {
    if (e.key === E.SAVE_KEY || e.key === "greentales-tick") render();
  }

  function poll() {
    const tick = U.storage.get("greentales-tick");
    const raw = U.storage.get(E.SAVE_KEY);
    const sig = tick + "|" + (raw ? raw.length : 0);
    if (sig !== lastTick) { lastTick = sig; render(); }
  }

  function getState() {
    const raw = U.storage.get(E.SAVE_KEY);
    if (!raw) return null;
    const r = E.deserialize(raw);
    return r.ok ? r.state : null;
  }

  /* ================= 渲染主入口 ================= */

  function render() {
    const app = document.getElementById("app");
    const state = getState();
    if (!state) { renderEmpty(app); return; }

    // 从空态/重建进入：搭骨架
    if (!theaterEl || theaterEl.parentNode !== app) buildTheater(app);

    const md = EV.MONTHS.find(m => m.month === state.month);
    const step = !state.finished && md && state.stepIndex < md.steps.length ? md.steps[state.stepIndex] : null;

    updateHud(state, md, step);
    updateScene(state, step);
    updateCopy(state, md, step);
    updateDeck(state, step);
    spawnFloats(state);
  }

  /* ---------- 空态等待幕 ---------- */

  function renderEmpty(app) {
    if (emptyEl && emptyEl.parentNode === app) return; // 已在等待幕，不重启动画
    app.innerHTML = "";
    theaterEl = null; resetSigs();
    emptyEl = U.el("div", { class: "th-empty" });
    emptyEl.appendChild(U.el("div", { class: "th-scene scene-fade", html: SC.pick("empty") }));
    emptyEl.appendChild(U.el("div", { class: "th-empty-copy" },
      U.el("h2", { text: "《绿神话》" }),
      U.el("p", { text: "等待主持人开局……请在另一窗口打开 #/control 开始游戏" })));
    app.appendChild(emptyEl);
  }

  /* ---------- 骨架 ---------- */

  function buildTheater(app) {
    app.innerHTML = "";
    emptyEl = null;
    resetSigs();

    hud.risk = U.el("span", { class: "th-hud-risk" });
    hud.month = U.el("span", { class: "th-hud-month" });
    hud.govWrap = U.el("span", { class: "th-hud-gov" }, "财政 ",
      hud.govBar = U.el("span", { class: "mini-bar" }, U.el("i")),
      hud.govNum = U.el("b", { text: "—" }));
    hud.comps = U.el("span", { class: "th-hud-comps" });

    theaterEl = U.el("div", { class: "theater" },
      U.el("div", { class: "th-hud" },
        hud.month,
        hud.govWrap,
        hud.comps,
        hud.risk,
        U.el("span", { class: "spacer" }),
        U.el("span", { class: "th-hud-qr", text: "📱 扫码观战看详情" })),
      stageBox = U.el("div", { class: "th-stage" },
        sceneEl = U.el("div", { class: "th-scene" }),
        copy.kicker = U.el("div", {},
          copy.kickerInner = U.el("span", { class: "th-copy-kicker", text: "" })),
        copy.title = U.el("h2", { class: "th-copy-title", text: "" }),
        copy.prompt = U.el("p", { class: "th-copy-prompt", text: "" }),
        floatsEl = U.el("div", { class: "th-floats" })),
      deckEl = U.el("div", { class: "th-deck" }));
    // 题面叠层包一层定位容器（kicker/title/prompt 共居中堆叠）
    const copyWrap = U.el("div", { class: "th-copy" });
    copyWrap.appendChild(copy.kicker); copyWrap.appendChild(copy.title); copyWrap.appendChild(copy.prompt);
    stageBox.appendChild(copyWrap);
    app.appendChild(theaterEl);
  }

  function resetSigs() {
    lastSceneKey = lastDeckSig = lastRiskSig = null;
    lastMonthKey = lastCompsSig = lastCopyKey = null;
    prevVals = null;
  }

  /* ---------- HUD（细条）---------- */

  function updateHud(state, md, step) {
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
    hud.govWrap.classList.toggle("danger", fin < 30);
    hud.govBar.firstChild.style.width = Math.max(0, Math.min(100, fin)) + "%";
    tweenNumber(hud.govNum, "fin", fin);
    // 三家企业总分微缩
    let best = -Infinity;
    state.companies.forEach(c => { const t = c.economy + c.ecology; if (t > best) best = t; });
    const csSig = state.companies.map(c => c.name).join("|");
    if (csSig !== lastCompsSig) {
      lastCompsSig = csSig;
      U.clear(hud.comps);
      state.companies.forEach(c => {
        // 经济/生态双值显示（如 35/45），不再只显示总和
        hud.comps.appendChild(U.el("span", { class: "th-comp", "data-id": c.id },
          c.name + " ",
          U.el("b", { class: "cv-e", text: String(c.economy) }), "/",
          U.el("b", { class: "cv-c", text: String(c.ecology) })));
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

  /* ---------- 场景（按签名替换节点，重播 scene-fade）---------- */

  function assetsSig(state) {
    return state.companies.map(c =>
      ["rooftopPV", "battery", "oneWayCharger", "twoWayCharger"].map(k => c.assets[k] ? 1 : 0).join("")
    ).join(".") + (state.revealed ? "R" : "");
  }

  function updateScene(state, step) {
    const key = (state.finished ? "final" : state.month + "-" + state.stepIndex + "-" + (step ? step.id : "x")) + "|" + assetsSig(state);
    if (key === lastSceneKey) return;
    lastSceneKey = key;
    const fresh = U.el("div", { class: "th-scene scene-fade",
      html: SC.pick(state.finished ? "final" : state.month, step, state) });
    if (sceneEl && sceneEl.parentNode) sceneEl.parentNode.replaceChild(fresh, sceneEl);
    else stageBox.insertBefore(fresh, stageBox.firstChild);
    sceneEl = fresh;
  }

  /* ---------- 题面叠层（纯文本更新，不动动画）---------- */

  function stepBadgeName(step) {
    if (!step) return "结算中";
    return { companyChoice: "企业决策", governmentChoice: "政府决策", diceCheck: "命运掷骰", autoEvent: "事件结算", awardCeremony: "年终颁奖" }[step.type] || step.type;
  }

  function updateCopy(state, md, step) {
    let kicker, title, prompt;
    if (state.finished) {
      kicker = "终局 · 12 个月经营落幕";
      title = "年终结算";
      prompt = "总分 = 经济 + 生态；排名与政府治理目标见下方";
    } else {
      const md2 = md || EV.MONTHS.find(m => m.month === state.month);
      const total = md2 ? md2.steps.length : 0;
      kicker = stepBadgeName(step) + (total ? " · 第 " + (state.stepIndex + 1) + "/" + total + " 步" : "");
      title = step ? (step.title || md2.title) : (md2 ? md2.title : "");
      prompt = (step && step.prompt) || (step && step.note) || "";
    }
    const key = kicker + "|" + title + "|" + prompt;
    if (key === lastCopyKey) return;
    lastCopyKey = key;
    copy.kickerInner.textContent = kicker;
    copy.title.textContent = title;
    copy.prompt.textContent = prompt;
    copy.prompt.style.display = prompt ? "" : "none";
  }

  /* ---------- 选项卡区（按签名重建，含入场/徽章动画）---------- */

  const OPT_ICON = {
    "m1-A": "machine", "m1-B": "machine", "m1-C": "machine", "m1-D": "beast",
    "m2-A": "factory", "m2-B": "envelope",
    "m3-A": "plane", "m3-B": "horse", "m3-C": "seedling",
    "m5-A": "factory", "m5-B": "pv", "m5-C": "pv",
    "m7-A": "factory", "m7-B": "chargerOneway", "m7-C": "chargerTwoway",
    "m8-A": "bolt", "m8-B": "battery", "m8-C": "pv",
    "m11-A": "doc", "m11-B": "doc", "m11-C": "doc",
    "m12-A": "smog", "m12-B": "pause",
  };
  const OPT_ICON_BY_MONTH = { 1: "machine", 2: "envelope", 3: "seedling", 5: "pv", 7: "chargerOneway", 8: "battery", 11: "doc", 12: "smog" };

  function iconHtml(name) {
    return (SC.ICON && SC.ICON[name]) || SC.ICON.gov || "";
  }

  function updateDeck(state, step) {
    const sig = [
      state.finished ? 1 : 0, state.month, state.stepIndex, state.revealed ? 1 : 0,
      JSON.stringify(state.pendingDecisions || {}),
      state.dice.length,
    ].join("|");
    if (sig === lastDeckSig && deckEl.firstChild) return;
    lastDeckSig = sig;
    U.clear(deckEl);
    if (state.finished) { deckEl.appendChild(buildFinalDeck(state)); return; }
    if (!step) {
      deckEl.appendChild(U.el("div", { class: "th-deck-note", text: "本月步骤已完成，等待推进……" }));
      return;
    }
    if (step.type === "companyChoice") deckEl.appendChild(buildChoiceDeck(state, step));
    else if (step.type === "governmentChoice") deckEl.appendChild(buildGovDeck(state, step));
    else if (step.type === "diceCheck") deckEl.appendChild(buildDiceDeck(state, step));
    else if (step.type === "autoEvent") deckEl.appendChild(buildAutoDeck(state, step));
    else deckEl.appendChild(U.el("div", { class: "th-deck-note", text: step.note || "进行中……" }));
  }

  /* 企业选项大卡（只显键字母 + 图标 + 标签；不显示效果方向暗示） */
  function buildChoiceDeck(state, step) {
    const track = U.el("div", { class: "th-deck-track" });
    step.options.forEach((o, i) => {
      const picks = state.revealed
        ? state.companies.filter(c => {
            const d = state.pendingDecisions[c.id];
            return d && d.optionId === o.id;
          }).map(c => U.el("span", { class: "pick-badge", text: c.name.slice(0, 6) }))
        : [];
      track.appendChild(U.el("div", { class: "th-card", style: "animation-delay:" + (i * 80) + "ms" },
        U.el("div", { class: "th-card-head" },
          U.el("span", { class: "th-card-key", text: o.key || String.fromCharCode(65 + i) }),
          U.el("span", { class: "th-card-icon", html: iconHtml(OPT_ICON[o.id] || OPT_ICON_BY_MONTH[state.month] || "factory") })),
        U.el("div", { class: "th-card-label", text: o.label }),
        U.el("div", { class: "th-card-picks" }, picks)));
    });
    const n = Object.keys(state.pendingDecisions || {}).filter(k => state.pendingDecisions[k] && state.pendingDecisions[k].optionId).length;
    const note = state.revealed ? "已揭示 · 结算完成（数值变动见浮动数字）" : "讨论中…… 已提交 " + n + " / " + state.companies.length;
    return U.el("div", {}, track, U.el("div", { class: "th-deck-note", text: note }));
  }

  /* 政府政策卡 / 4 档资金卡 */
  function buildGovDeck(state, step) {
    const gopt = step.government || {};
    if (gopt.mode === "perApplicantFunding") {
      const track = U.el("div", { class: "th-deck-track" });
      (gopt.tiers || []).forEach((t, i) => {
        track.appendChild(U.el("div", { class: "th-card", style: "animation-delay:" + (i * 80) + "ms" },
          U.el("div", { class: "th-card-head" },
            U.el("span", { class: "th-card-key", text: String(i + 1) }),
            U.el("span", { class: "th-card-icon", html: iconHtml("coin") })),
          U.el("div", { class: "th-card-label", text: t.label + "（+" + t.amount + "）" }),
          U.el("div", { class: "th-card-picks" })));
      });
      return U.el("div", {}, track,
        U.el("div", { class: "th-deck-note", text: "政府正在为试点企业分配 4 档资金……" }));
    }
    const track = U.el("div", { class: "th-deck-track" });
    (gopt.options || []).forEach((o, i) => {
      track.appendChild(U.el("div", { class: "th-card policy", style: "animation-delay:" + (i * 80) + "ms" },
        U.el("div", { class: "th-card-head" },
          U.el("span", { class: "th-card-key", text: String.fromCharCode(65 + i) }),
          U.el("span", { class: "th-card-icon", html: iconHtml("gov") })),
        U.el("div", { class: "th-card-label", text: o.label }),
        U.el("div", { class: "th-card-detail", text: o.detail || "" }),
        U.el("div", { class: "th-card-picks" })));
    });
    return U.el("div", {}, track,
      U.el("div", { class: "th-deck-note", text: gopt.target === "ecoExtrema" ? "生态奖惩 · 政府决策中……" : "政府决策中……" }));
  }

  /* 掷骰：参与企业各一枚大骰子，已结算的显示面值 */
  function buildDiceDeck(state, step) {
    let participants = state.companies;
    if (step.onlyCompaniesWith) participants = state.companies.filter(c => c.assets[step.onlyCompaniesWith]);
    if (!participants.length) {
      return U.el("div", { class: "th-deck-note", text: "无参与企业（本步将跳过）" });
    }
    const settled = {};
    state.dice.forEach(d => { if (d.eventId === step.id) settled[d.companyId] = d; });
    const row = U.el("div", { class: "th-dice-row" });
    participants.forEach(c => {
      const s = settled[c.id];
      row.appendChild(U.el("div", { class: "th-dice-co" },
        U.el("span", { class: "dc-name", text: c.name }),
        U.el("div", { class: "dice-cube" + (s ? " outset" : " rolling"), text: s ? String(s.face) : "?" },
          s ? U.el("span", { class: "dice-outcome", style: "display:block;font-size:12px;font-weight:400;color:#55655e", text: s.outcome }) : null)));
    });
    return U.el("div", {}, row, U.el("div", { class: "th-deck-note", text: step.note || "掷骰进行中……" }));
  }

  /* 自动事件：预演各企业影响 */
  function buildAutoDeck(state, step) {
    const row = U.el("div", { class: "th-auto-row" });
    let preview = [];
    try { preview = step.autoApply ? step.autoApply(state.companies) : []; } catch (e) { preview = []; }
    preview.forEach(r => {
      const c = E.getCompany(state, r.companyId);
      if (!c) return;
      row.appendChild(U.el("span", { class: "th-auto-chip" },
        c.name + " ", U.el("b", { class: r.economy > 0 ? "pos" : r.economy < 0 ? "neg" : "", text: (r.economy > 0 ? "+" : "") + (r.economy || 0) })));
    });
    return U.el("div", {}, row, U.el("div", { class: "th-deck-note", text: "自动结算 · " + (step.title || "") }));
  }

  /* 终局排名 */
  function buildFinalDeck(state) {
    const fin = E.computeFinal(state);
    const rank = U.el("div", { class: "th-final-rank" });
    fin.ranking.forEach((r, i) => {
      rank.appendChild(U.el("div", { class: "rk" },
        U.el("span", { class: "pos", text: ["冠军", "亚军", "季军"][i] || ("第" + (i + 1) + "名") }),
        U.el("span", { text: r.name }),
        U.el("span", { class: "pts", text: r.economy + " + " + r.ecology + " = " + r.total + " 分" })));
    });
    const gov = U.el("div", { class: "th-final-gov" },
      "生态 " + fin.totalEcology + "/240 ", U.el("span", { class: fin.goals.ecology.achieved ? "ok" : "no", text: fin.goals.ecology.achieved ? "✔" : "✘" }),
      "　经济 " + fin.totalEconomy + "/320 ", U.el("span", { class: fin.goals.economy.achieved ? "ok" : "no", text: fin.goals.economy.achieved ? "✔" : "✘" }),
      "　财政 " + fin.govFinance + " ", U.el("span", { class: fin.goals.finance.achieved ? "ok" : "no", text: fin.goals.finance.achieved ? "✔" : "✘" }));
    return U.el("div", { style: "display:flex;flex-direction:column;gap:8px;align-items:center" }, rank, gov);
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
      el.textContent = String(to);
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
