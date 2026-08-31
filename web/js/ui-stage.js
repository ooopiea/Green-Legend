/* ============================================================
   《绿神话》舞台页（#/stage）
   同源窗口：监听 storage 事件 + 轮询 localStorage，实时镜像中控状态
   布局：月份题头 → 事件卡 → 三企业牌 → 政府财政条
   ============================================================ */

(function (root) {
  "use strict";

  const E = root.GreenEngine, EV = root.GreenEvents, U = root.GreenUI;

  const ControlStage = {};
  let lastTick = null;

  ControlStage.mount = function (app) {
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

  /* ---------- 渲染 ---------- */

  function render() {
    const app = document.getElementById("app");
    U.clear(app);
    const state = getState();

    if (!state) {
      app.appendChild(U.el("div", { class: "stage-empty" },
        U.el("h2", { text: "《绿神话》" }),
        U.el("p", { text: "等待主持人开局……请在另一窗口打开 #/control 开始游戏" })));
      return;
    }

    const wrap = U.el("div", { class: "stage-wrap" });

    // 题头
    const md = EV.MONTHS.find(m => m.month === state.month);
    const step = md && state.stepIndex < md.steps.length ? md.steps[state.stepIndex] : null;
    wrap.appendChild(U.el("div", { class: "stage-header" },
      U.el("span", { class: "stage-month", text: state.month + " 月" }),
      U.el("span", { class: "stage-month-title", text: md ? md.title : (state.finished ? "年终结算" : "") }),
      U.el("span", { class: "spacer" }),
      U.el("span", { class: "stage-step-badge", text: stepBadgeName(step, state) })));

    if (state.finished) {
      wrap.appendChild(buildFinal(state));
      app.appendChild(wrap);
      return;
    }

    // 风险横幅
    const risky = state.companies.filter(c => c.economy <= 20 || c.ecology <= 20);
    if (risky.length) {
      wrap.appendChild(U.el("div", { class: "stage-risk",
        text: "⚠ " + risky.map(c => c.name + "（" + (c.economy <= 20 ? "经济 " + c.economy : "") + (c.ecology <= 20 ? (c.economy <= 20 ? " / " : "") + "生态 " + c.ecology : "") + "）").join("　") }));
    }

    // 事件卡
    if (step) wrap.appendChild(buildEventCard(state, step));

    // 企业牌
    wrap.appendChild(buildCompanies(state));

    // 政府财政条
    wrap.appendChild(buildGovBar(state));

    app.appendChild(wrap);
  }

  function stepBadgeName(step, state) {
    if (!step) return "结算中";
    const names = { companyChoice: "企业决策", governmentChoice: "政府决策", diceCheck: "命运掷骰", autoEvent: "事件结算", awardCeremony: "年终颁奖" };
    return names[step.type] || step.type;
  }

  function buildEventCard(state, step) {
    const card = U.el("div", { class: "stage-event" });
    card.appendChild(U.el("h2", { class: "stage-event-title", text: step.title || "" }));
    if (step.prompt) card.appendChild(U.el("p", { class: "stage-event-prompt", text: step.prompt }));

    if (step.type === "companyChoice" && !state.revealed) {
      const ul = U.el("ul", { class: "stage-options" });
      (step.options || []).forEach(o => {
        ul.appendChild(U.el("li", {}, U.el("span", { class: "key", text: o.key || "·" }), " " + o.label));
      });
      card.appendChild(ul);
      card.appendChild(U.el("p", { class: "stage-event-note",
        text: "讨论中…… 已提交 " + submittedCount(state) + " / " + state.companies.length }));
    } else if (step.type === "governmentChoice") {
      const gopt = step.government;
      if (gopt && gopt.options) {
        const ul = U.el("ul", { class: "stage-options" });
        gopt.options.forEach((o, i) => {
          ul.appendChild(U.el("li", {}, U.el("span", { class: "key", text: String.fromCharCode(65 + i) }), " " + o.label));
        });
        card.appendChild(ul);
      } else if (gopt && gopt.mode === "perApplicantFunding") {
        card.appendChild(U.el("p", { class: "stage-event-note", text: "政府正在为试点企业分配 4 档资金……" }));
      }
    } else if (step.type === "diceCheck") {
      card.appendChild(U.el("p", { class: "stage-event-note", text: "掷骰进行中……" + (step.note || "") }));
    } else if (step.note) {
      card.appendChild(U.el("p", { class: "stage-event-note", text: step.note }));
    }
    return card;
  }

  function submittedCount(state) {
    return Object.keys(state.pendingDecisions || {}).filter(k => state.pendingDecisions[k]).length;
  }

  function buildCompanies(state) {
    const grid = U.el("div", { class: "stage-companies" });
    // 揭示后显示选择
    const md = EV.MONTHS.find(m => m.month === state.month);
    const step = md && state.stepIndex < md.steps.length ? md.steps[state.stepIndex] : null;

    // 领先企业（总分最高）
    let best = -Infinity;
    state.companies.forEach(c => { const t = c.economy + c.ecology; if (t > best) best = t; });

    state.companies.forEach(c => {
      const total = c.economy + c.ecology;
      const danger = c.economy <= 20 || c.ecology <= 20;
      const card = U.el("div", { class: "stage-company" + (danger ? " danger" : total === best ? " leader" : "") });
      card.appendChild(U.el("h3", { text: c.name + (total === best ? " 👑" : "") }));

      const vals = U.el("div", { class: "vals" });
      const econBlock = U.el("div", { class: "val-block" });
      econBlock.appendChild(U.el("span", { class: "val-label", text: "经济" }));
      econBlock.appendChild(U.el("span", { class: "val-num econ num" + (c.economy <= 20 ? " warn" : ""), text: String(c.economy) }));
      const ecoBlock = U.el("div", { class: "val-block" });
      ecoBlock.appendChild(U.el("span", { class: "val-label", text: "生态" }));
      ecoBlock.appendChild(U.el("span", { class: "val-num eco num" + (c.ecology <= 20 ? " warn" : ""), text: String(c.ecology) }));
      vals.appendChild(econBlock); vals.appendChild(ecoBlock);
      card.appendChild(vals);

      const assets = U.el("div", { class: "assets" });
      E.ASSET_KEYS.forEach(k => {
        const meta = EV.ASSET_META[k];
        assets.appendChild(U.el("span", { class: "stage-asset" + (c.assets[k] ? " on" : ""), text: meta.icon + meta.name }));
      });
      card.appendChild(assets);

      // 选择状态
      if (step && step.type === "companyChoice") {
        if (state.revealed) {
          const d = state.pendingDecisions[c.id];
          if (d) {
            const opt = step.options.find(o => o.id === d.optionId);
            card.appendChild(U.el("div", { class: "choice", text: "选择 " + (opt ? (opt.key || "·") + " · " + opt.label : d.optionId) }));
          }
        } else {
          card.appendChild(U.el("div", { class: "choice pending",
            text: state.pendingDecisions[c.id] ? "已提交 ✅" : "讨论中 …" }));
        }
      }
      grid.appendChild(card);
    });
    return grid;
  }

  function buildGovBar(state) {
    const pct = Math.max(0, Math.min(100, state.government.finance));
    const danger = state.government.finance < 30;
    return U.el("div", { class: "stage-gov" },
      U.el("span", { class: "gov-label", text: state.government.name + " · 财政" }),
      U.el("div", { class: "bar" },
        U.el("div", { class: "bar-fill" + (danger ? " danger" : ""), style: "width:" + pct + "%" })),
      U.el("span", { class: "gov-num num" + (danger ? " danger" : ""), text: String(state.government.finance) }));
  }

  function buildFinal(state) {
    const fin = E.computeFinal(state);
    const box = U.el("div", {});
    box.appendChild(U.el("div", { class: "stage-event" },
      U.el("h2", { class: "stage-event-title", text: "🏁 年终结算 · 企业排名" })));
    const rank = U.el("div", { class: "stage-final-rank" });
    fin.ranking.forEach((r, i) => {
      rank.appendChild(U.el("div", { class: "rk" },
        U.el("span", { class: "pos", text: ["冠军", "亚军", "季军"][i] || ("第" + (i + 1) + "名") }),
        U.el("span", { text: r.name }),
        U.el("span", { class: "pts", text: r.economy + " + " + r.ecology + " = " + r.total + " 分" })));
    });
    box.appendChild(rank);
    box.appendChild(U.el("div", { class: "stage-gov", style: "margin-top:16px" },
      U.el("span", { class: "gov-label", text: "政府治理" }),
      U.el("span", { style: "font-size:26px;line-height:1.6",
        text: "生态 " + fin.totalEcology + "/240 " + (fin.goals.ecology.achieved ? "✔" : "✘") +
              "　经济 " + fin.totalEconomy + "/320 " + (fin.goals.economy.achieved ? "✔" : "✘") +
              "　财政 " + fin.govFinance + " " + (fin.goals.finance.achieved ? "✔" : "✘") })));
    return box;
  }

  root.ControlStage = ControlStage;
})(typeof self !== "undefined" ? self : this);
