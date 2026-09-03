/* ============================================================
   《绿神话》中控台（#/control）
   职责：开局设置、流程推进、企业录入与统一揭示、政府决策、
        掷骰、救助、撤销、导出导入、生成观战二维码
   ============================================================ */

(function (root) {
  "use strict";

  const E = root.GreenEngine, EV = root.GreenEvents, U = root.GreenUI;

  const ControlConsole = { state: null, timer: null };

  /* ================= 存档 ================= */

  function save() {
    if (ControlConsole.state) {
      U.storage.set(E.SAVE_KEY, E.serialize(ControlConsole.state));
      // 通知同源舞台页窗口
      try { U.storage.set("greentales-tick", String(Date.now())); } catch (e) {}
    }
  }

  function load() {
    const raw = U.storage.get(E.SAVE_KEY);
    if (!raw) return null;
    const r = E.deserialize(raw);
    return r.ok ? r.state : null;
  }

  /* ================= 步骤导航 ================= */

  function monthDef(month) { return EV.MONTHS.find(m => m.month === month); }
  function currentStep(state) {
    const md = monthDef(state.month);
    if (!md) return null;
    return md.steps[state.stepIndex] || null;
  }
  function totalSteps(state) {
    const md = monthDef(state.month);
    return md ? md.steps.length : 0;
  }

  /* 单步推进：不落盘不渲染（由 advanceStep 统一收尾）。
     换月分支：先快照（撤销点），再换月，再月初持续收益结算。 */
  function advanceOne(state) {
    if (state.stepIndex + 1 < totalSteps(state)) {
      state.stepIndex++;
      state.revealed = false; // 月内推进同样复位揭示标志，否则下一步的题面页会被跳过
    } else if (state.month < 12) {
      E.snapshot(state, "M" + state.month + " 月末（推进下月前）");
      state.month++;
      state.stepIndex = 0;
      state.pendingDecisions = {};
      state.revealed = false;
      E.log(state, "system", "—— 进入 " + state.month + " 月 ——");
      E.settleMonthOpening(state);
    } else {
      state.finished = true;
      E.log(state, "system", "—— 12 个月结束，进入年终结算 ——");
    }
    state.phase = currentStep(state) ? currentStep(state).type : "finished";
  }

  function advanceStep(state) {
    // 两阶段结算：stepSettled.skip 记录需跳过的后续步骤数（如 4 月停工跳过掷骰）
    const skip = (state.stepSettled && state.stepSettled.skip) || 0;
    state.stepSettled = null;
    for (let i = 0; i < 1 + skip; i++) advanceOne(state);
    save();
    render();
  }

  /* 当前步骤是否处于"已结算待推进"（答案页停留阶段） */
  function isSettled(state, step) {
    return !!(state.stepSettled && state.stepSettled.stepId === step.id);
  }

  /* 政府决策后是否需要跳过下一步掷骰（所选政策未 triggersDice，如 4 月停工） */
  function computeSkip(state, step, chosenOption) {
    const md = monthDef(state.month);
    const next = md ? md.steps[state.stepIndex + 1] : null;
    if (step.type === "governmentChoice" && next && next.type === "diceCheck" && !(chosenOption && chosenOption.triggersDice)) {
      return 1;
    }
    return 0;
  }

  function settledCard(state, title) {
    const card = U.el("div", { class: "card", style: "border-color:var(--gold)" });
    card.appendChild(U.el("h4", { text: "✓ " + title }));
    card.appendChild(U.el("p", { style: "font-size:13px;color:var(--slate)", text: "答案页已投影，讲解后点「下一步」继续。" }));
    card.appendChild(U.el("button", { class: "btn-lg btn-gold", text: "下一步 ▸", onclick: function () { advanceStep(ControlConsole.state); } }));
    return card;
  }

  /* ================= 舞台投影控制（演示翻页） ================= */

  const STAGE_UI_KEY = "greentales-stage";
  const STAGE_TOTAL = 42;

  function readStageUi() {
    try {
      const v = JSON.parse(U.storage.get(STAGE_UI_KEY) || "");
      if (v && v.ver === 1) return v;
    } catch (e) {}
    return { ver: 1, offset: 0, introSlide: 1, hudVisible: true };
  }

  function writeStageUi(v) {
    U.storage.set(STAGE_UI_KEY, JSON.stringify(v));
    try { U.storage.set("greentales-tick", String(Date.now())); } catch (e) {}
  }

  function stageAutoSlide(state) {
    const GL = root.GreenSlides;
    if (!state || !GL || typeof GL.autoSlide !== "function") return null;
    return GL.autoSlide(state);
  }

  /* 演示翻页器：自动联动 + 手动 ±1 微调（自动页变化时偏移归零） */
  function buildPager(state) {
    const ui = readStageUi();
    const auto = stageAutoSlide(state);
    const eff = auto != null ? Math.min(STAGE_TOTAL, Math.max(1, auto + ui.offset)) : ui.introSlide;

    function shift(dir) {
      if (auto != null) {
        const want = Math.min(STAGE_TOTAL, Math.max(1, eff + dir));
        ui.offset = want - auto;
      } else {
        ui.introSlide = Math.min(STAGE_TOTAL, Math.max(1, ui.introSlide + dir));
      }
      writeStageUi(ui);
      render();
    }

    const card = U.el("div", { class: "card", style: "padding:10px 12px" });
    card.appendChild(U.el("h4", { text: "舞台投影 · 翻页（共 " + STAGE_TOTAL + " 页）" }));
    const row = U.el("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" });
    row.appendChild(U.el("button", { class: "btn-sm btn-ghost", text: "◀ 上一页", onclick: function () { shift(-1); } }));
    row.appendChild(U.el("span", { class: "num", style: "min-width:88px;text-align:center", text: "第 " + eff + " / " + STAGE_TOTAL + " 页" }));
    row.appendChild(U.el("button", { class: "btn-sm btn-ghost", text: "下一页 ▶", onclick: function () { shift(1); } }));
    if (auto != null && ui.offset !== 0) {
      row.appendChild(U.el("button", {
        class: "btn-sm", style: "border-color:var(--gold);color:var(--gold)",
        text: "手动偏移 " + (ui.offset > 0 ? "+" : "") + ui.offset + " · 点击归零",
        title: "恢复自动跟随当前流程页",
        onclick: function () { ui.offset = 0; writeStageUi(ui); render(); },
      }));
    } else if (auto != null) {
      row.appendChild(U.el("span", { class: "badge badge-jade", text: "自动跟随" }));
    }
    row.appendChild(U.el("button", {
      class: "btn-sm btn-ghost", text: ui.hudVisible ? "记分 HUD：显示" : "记分 HUD：隐藏",
      onclick: function () { ui.hudVisible = !ui.hudVisible; writeStageUi(ui); render(); },
    }));
    card.appendChild(row);
    return card;
  }

  /* ================= 渲染主框架 ================= */

  ControlConsole.mount = function (app) {
    ControlConsole.state = load();
    render();
  };

  function render() {
    const app = document.getElementById("app");
    U.clear(app);
    const state = ControlConsole.state;

    // 自动页变化时手动偏移归零（含撤销导致的回跳）
    const auto = stageAutoSlide(state);
    if (auto !== ControlConsole._lastAuto) {
      ControlConsole._lastAuto = auto;
      const ui = readStageUi();
      if (ui.offset !== 0) { ui.offset = 0; writeStageUi(ui); }
    }

    app.appendChild(buildTopbar(state));

    if (!state) {
      app.appendChild(buildSetup());
      return;
    }
    if (state.finished) {
      app.appendChild(buildFinal());
      return;
    }

    const layout = U.el("div", { class: "control-layout" });
    layout.appendChild(buildMonthNav(state));
    layout.appendChild(buildStageOps(state));
    layout.appendChild(buildStatusCol(state));
    app.appendChild(layout);

    // 救助待决策弹窗
    if (state.rescuePending) showRescueDialog();
  }

  function buildTopbar(state) {
    const links = [];
    links.push(U.el("a", { href: "#/control", class: "active", text: "中控台" }));
    // 外链一律新标签打开：↗ 图标名副其实，且当前窗口恒留中控（同窗口跳走会被误认为"自动跳转到舞台页"）
    links.push(U.el("a", { href: "#/stage", target: "_blank", rel: "noopener", text: "舞台页 ↗" }));
    links.push(U.el("a", { href: "#/archive", target: "_blank", rel: "noopener", text: "归档复盘" }));
    return U.el("div", { class: "topbar" },
      U.el("span", { class: "brand", text: "绿神话 · 中控" }),
      links,
      U.el("span", { class: "spacer" }),
      state ? U.el("span", { text: state.month + " 月 · " + (monthDef(state.month) ? monthDef(state.month).title : ""), style: "font-size:14px;color:#cfd8d3" }) : null,
      state ? U.el("button", { class: "btn-sm btn-ghost", style: "color:#fff;border-color:#556", text: "撤销上一步", onclick: doUndo }) : null,
      state ? U.el("button", { class: "btn-sm btn-ghost", style: "color:#fff;border-color:#556", text: "导出", onclick: doExport }) : null,
      state ? U.el("button", { class: "btn-sm btn-ghost", style: "color:#fff;border-color:#556", text: "观战码", onclick: showQr }) : null);
  }

  /* ================= 开局设置 ================= */

  function buildSetup() {
    const wrap = U.el("div", { class: "setup-wrap" });
    const card = U.el("div", { class: "card" });
    card.appendChild(U.el("h3", { text: "《绿神话》开局设置" }));

    const names = {};
    ["A", "B", "C"].forEach(id => {
      const row = U.el("div", { class: "setup-row" });
      row.appendChild(U.el("label", { text: "企业 " + id + " 名称" }));
      const inp = U.el("input", { type: "text", value: "企业 " + id, "data-id": id });
      names[id] = inp;
      row.appendChild(inp);
      card.appendChild(row);
    });

    const govRow = U.el("div", { class: "setup-row" });
    govRow.appendChild(U.el("label", { text: "政府组名称" }));
    const govInput = U.el("input", { type: "text", value: "政府" });
    govRow.appendChild(govInput);
    card.appendChild(govRow);

    const diceRow = U.el("div", { class: "setup-row" });
    diceRow.appendChild(U.el("label", { text: "掷骰方式" }));
    const diceSel = U.el("select", {},
      U.el("option", { value: "auto", text: "网页自动掷骰（推荐）" }),
      U.el("option", { value: "manual", text: "实体骰子，主持人手动录入" }));
    diceSel.value = "auto";
    diceRow.appendChild(diceSel);
    card.appendChild(diceRow);

    card.appendChild(U.el("div", { class: "setup-row" },
      U.el("label", { text: "规则摘要（核对后开局）" }),
      U.el("div", { class: "rules-summary", html:
        "<li>企业初始经济 60、生态 60；政府初始财政 100。</li>" +
        "<li>企业胜负 = 12 月后「经济值 + 生态值」总分最高。</li>" +
        "<li>政府三目标：总生态 ≥240、总经济 ≥320、财政 ≥0。</li>" +
        "<li>生态 ≤20 触发滑坡额外扣 10；经济首次 ≤20 触发一次救助（企业+10 / 财政-10）。</li>" +
        "<li>政府全年任意时点财政不得为负，不足的政策不可选。</li>" +
        "<li>4 月停工按每企业经济 -10；11 月试点资金四档 +0/+10/+20/+40。</li>" })));

    card.appendChild(U.el("div", { style: "margin-top:16px;display:flex;gap:10px" },
      U.el("button", { class: "btn-lg", text: "开 局", onclick: function () {
        ControlConsole.state = E.createGame({
          companyNames: { A: names.A.value.trim() || "企业 A", B: names.B.value.trim() || "企业 B", C: names.C.value.trim() || "企业 C" },
          governmentName: govInput.value.trim() || "政府",
          autoDice: diceSel.value === "auto",
        });
        save();
        U.toast("游戏开始，进入 1 月", "ok");
        render();
      } })));

    // 导入已有存档
    const importRow = U.el("div", { class: "setup-row" });
    importRow.appendChild(U.el("label", { text: "或导入已有存档（JSON）" }));
    const file = U.el("input", { type: "file", accept: ".json,application/json" });
    file.addEventListener("change", function () {
      const f = file.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () { doImportJson(reader.result); };
      reader.readAsText(f);
    });
    importRow.appendChild(file);
    card.appendChild(importRow);

    wrap.appendChild(card);
    // 课前规则页（1-8 页）手动翻页演示
    wrap.appendChild(buildPager(null));
    return wrap;
  }

  function doImportJson(text) {
    const r = E.deserialize(text);
    if (!r.ok) { U.toast("导入失败：" + r.error, "warn"); return; }
    ControlConsole.state = r.state;
    save();
    U.toast("导入成功，已恢复到 " + r.state.month + " 月", "ok");
    render();
  }

  /* ================= 左栏：月份导航 ================= */

  function buildMonthNav(state) {
    const nav = U.el("div", { class: "month-nav" });
    const card = U.el("div", { class: "card" });
    card.appendChild(U.el("h4", { text: "月度进度" }));
    EV.MONTHS.forEach(m => {
      const done = m.month < state.month;
      const cur = m.month === state.month;
      card.appendChild(U.el("div", { class: "month-chip" + (cur ? " current" : done ? " done" : "") },
        U.el("span", { text: m.month + " 月 · " + m.title.slice(0, 8) }),
        U.el("span", { class: "dot" })));
    });
    nav.appendChild(card);

    const tools = U.el("div", { class: "tools" });
    tools.appendChild(U.el("button", { class: "btn-ghost btn-sm", text: "↺ 快照列表", onclick: showSnapshots }));
    tools.appendChild(U.el("button", { class: "btn-ghost btn-sm", text: "⤓ 导出 JSON", onclick: doExport }));
    tools.appendChild(U.el("button", { class: "btn-ghost btn-sm btn-danger", style: "background:var(--cinnabar);color:#fff;border-color:var(--cinnabar)", text: "重新开局", onclick: function () {
      U.confirm("重新开局", "当前进度将清空且不可恢复（建议先导出 JSON 存档）。确认重新开局？", function () {
        U.storage.remove(E.SAVE_KEY);
        ControlConsole.state = null;
        render();
      });
    } }));
    nav.appendChild(tools);
    return nav;
  }

  /* ================= 中栏：阶段操作 ================= */

  function buildStageOps(state) {
    const col = U.el("div", { class: "stage-ops" });
    const md = monthDef(state.month);
    const step = currentStep(state);

    // 月标题卡
    const head = U.el("div", { class: "card" });
    head.appendChild(U.el("div", { class: "event-head" },
      U.el("span", { class: "event-month", text: state.month + " 月" }),
      U.el("span", { class: "event-title", text: md ? md.title : "" }),
      U.el("span", { class: "badge badge-jade", text: "步骤 " + (state.stepIndex + 1) + "/" + totalSteps(state) + " · " + stepTypeName(step) })));
    col.appendChild(head);
    col.appendChild(buildPager(state));

    if (!step) { col.appendChild(U.el("div", { class: "card", text: "本月步骤已完成" })); return col; }

    // 事件卡
    const evCard = U.el("div", { class: "card" });
    if (step.prompt) evCard.appendChild(U.el("div", { class: "event-prompt", text: step.prompt }));
    if (step.note) evCard.appendChild(U.el("p", { style: "color:var(--slate);font-size:14px;margin:6px 0", text: step.note }));
    if (step.timer) evCard.appendChild(buildTimerRow());
    col.appendChild(evCard);

    // 按步骤类型分派（政府/掷骰/自动结算后处于"已结算待推进"阶段时显示答案页停留卡）
    switch (step.type) {
      case "companyChoice": col.appendChild(buildCompanyChoice(state, step)); break;
      case "governmentChoice":
        if (isSettled(state, step)) col.appendChild(settledCard(state, (step.government && step.government.mode === "perApplicantFunding") ? "试点资金已发放" : "政府决策已结算"));
        else if (step.government && step.government.mode === "perApplicantFunding") col.appendChild(buildFundingPanel(state, step));
        else col.appendChild(buildGovPanel(state, step));
        break;
      case "diceCheck":
        if (isSettled(state, step)) col.appendChild(settledCard(state, "掷骰已结算"));
        else col.appendChild(buildDicePanel(state, step));
        break;
      case "autoEvent":
        if (isSettled(state, step)) col.appendChild(settledCard(state, "自动事件已结算：" + step.title));
        else col.appendChild(buildAutoPanel(state, step));
        break;
      case "awardCeremony": col.appendChild(buildAwardPanel(state, step)); break;
    }
    return col;
  }

  function stepTypeName(step) {
    if (!step) return "结束";
    return { companyChoice: "企业决策", governmentChoice: "政府决策", diceCheck: "掷骰", autoEvent: "自动结算", awardCeremony: "颁奖" }[step.type] || step.type;
  }

  /* ---------- 倒计时 ---------- */

  function buildTimerRow() {
    const row = U.el("div", { class: "timer-row" });
    const disp = U.el("span", { class: "timer-display", text: "01:00" });
    const startBtn = U.el("button", { text: "▶ 开始计时", onclick: function () {
      if (!ControlConsole.timer) ControlConsole.timer = new U.CountdownTimer(60, tick, end);
      ControlConsole.timer.start();
    } });
    const pauseBtn = U.el("button", { class: "btn-ghost", text: "⏸ 暂停", onclick: function () { if (ControlConsole.timer) ControlConsole.timer.pause(); } });
    const resetBtn = U.el("button", { class: "btn-ghost", text: "↺ 重置", onclick: function () {
      if (ControlConsole.timer) ControlConsole.timer.reset(60);
      disp.textContent = "01:00"; disp.classList.remove("urgent");
    } });
    function tick(left) {
      disp.textContent = U.mmss(left);
      disp.classList.toggle("urgent", left <= 10);
    }
    function end() { U.toast("讨论时间到！", "warn"); }
    row.appendChild(disp); row.appendChild(startBtn); row.appendChild(pauseBtn); row.appendChild(resetBtn);
    return row;
  }

  /* ---------- 企业选择 ---------- */

  function buildCompanyChoice(state, step) {
    const card = U.el("div", { class: "card" });
    card.appendChild(U.el("h4", { text: "企业决策录入（三家全部录入后统一揭示）" }));

    const grid = U.el("div", { class: "stash-grid" });
    state.companies.forEach(c => {
      const sc = U.el("div", { class: "stash-card" + (state.pendingDecisions[c.id] ? " submitted" : "") });
      sc.appendChild(U.el("h5", {}, c.name + " ",
        U.el("span", { class: "badge " + (state.pendingDecisions[c.id] ? "badge-jade" : ""), text: state.pendingDecisions[c.id] ? "已提交" : "待提交" })));
      const btns = U.el("div", { class: "opt-btns" });
      step.options.forEach(opt => {
        const isDisabled = opt.requires && !optionAvailable(state, c, opt);
        const sel = state.pendingDecisions[c.id] && state.pendingDecisions[c.id].optionId === opt.id;
        btns.appendChild(U.el("button", {
          class: "opt-btn" + (sel ? " selected" : ""),
          disabled: state.revealed || isDisabled,
          title: isDisabled ? "不满足资格条件" : "",
          onclick: function () {
            state.pendingDecisions[c.id] = { optionId: opt.id };
            save();
            render();
          },
        }, U.el("span", {}, U.el("span", { class: "num", text: opt.key || "·" }), opt.label),
           opt.requires && !optionAvailable(state, c, opt) ? U.el("div", { style: "font-size:11px;color:var(--cinnabar)", text: "需先具备资格资产" }) : null));
      });
      sc.appendChild(btns);
      grid.appendChild(sc);
    });
    card.appendChild(grid);

    // 11 月：选择 B（加装后申报）的企业继续选加装项
    if (step.retrofitOptions) {
      const retrofitUsers = state.companies.filter(c => state.pendingDecisions[c.id] && state.pendingDecisions[c.id].optionId === "m11-B");
      if (retrofitUsers.length) {
        card.appendChild(U.el("h4", { text: "加装设备选择（选择「加装后申报」的企业）" }));
        const rgrid = U.el("div", { class: "stash-grid" });
        retrofitUsers.forEach(c => {
          const sc = U.el("div", { class: "stash-card" + (state.pendingDecisions[c.id].retrofitId ? " submitted" : "") });
          sc.appendChild(U.el("h5", { text: c.name }));
          const btns = U.el("div", { class: "opt-btns" });
          step.retrofitOptions.forEach(r => {
            const disabled = r.requires && !Object.keys(r.requires).every(k => c.assets[k] === r.requires[k]);
            const sel = state.pendingDecisions[c.id].retrofitId === r.id;
            btns.appendChild(U.el("button", {
              class: "opt-btn" + (sel ? " selected" : ""),
              disabled: state.revealed || disabled,
              title: disabled ? "不满足条件（如需已有单向充电桩）" : "",
              onclick: function () {
                state.pendingDecisions[c.id].retrofitId = r.id;
                save();
                render();
              },
            }, U.el("span", {}, U.el("span", { class: "num", text: "加" }), r.label)));
          });
          sc.appendChild(btns);
          rgrid.appendChild(sc);
        });
        card.appendChild(rgrid);
      }
    }

    // 统一揭示按钮
    const allSet = state.companies.every(c => {
      const d = state.pendingDecisions[c.id];
      if (!d) return false;
      if (step.retrofitOptions && d.optionId === "m11-B") return !!d.retrofitId;
      return true;
    });
    const revealRow = U.el("div", { class: "reveal-row" });
    if (!state.revealed) {
      revealRow.appendChild(U.el("button", { class: "btn-lg btn-gold", disabled: !allSet, text: "🔔 统一揭示并结算", onclick: function () { doReveal(step); } }));
      revealRow.appendChild(U.el("span", { class: "reveal-hint", text: allSet ? "全部已录入，可以揭示" : "还有企业未完成录入（含加装选择）" }));
    } else {
      revealRow.appendChild(U.el("span", { class: "badge badge-jade", text: "✓ 已揭示并结算" }));
      revealRow.appendChild(U.el("button", { class: "btn-ghost", text: "下一步 ▸", onclick: function () { advanceStep(ControlConsole.state); } }));
    }
    card.appendChild(revealRow);
    return card;
  }

  function optionAvailable(state, company, opt) {
    if (!opt.requires) return true;
    return Object.keys(opt.requires).every(k => company.assets[k] === opt.requires[k]);
  }

  function doReveal(step) {
    const state = ControlConsole.state;
    state.revealed = true;
    // 结算企业选择
    E.settleCompanyChoice(state, step, state.pendingDecisions);
    // 11 月加装子结算
    if (step.retrofitOptions) {
      const retrofitDecisions = {};
      state.companies.forEach(c => {
        const d = state.pendingDecisions[c.id];
        if (d && d.optionId === "m11-B" && d.retrofitId) retrofitDecisions[c.id] = d.retrofitId;
      });
      if (Object.keys(retrofitDecisions).length) E.settleRetrofit(state, step, retrofitDecisions);
      // 加装后复查资格
      const apps = E.finalizeZeroCarbon(state, state.pendingDecisions, retrofitDecisions);
      const msgs = [];
      state.companies.forEach(c => {
        const a = apps[c.id];
        if (a && a.applied) {
          msgs.push(c.name + (a.eligible ? "（资格 ✔）" : "（资格不足 " + a.assetCount + "/2 ✘）"));
        }
      });
      if (msgs.length) E.log(state, "settle", "零碳园区申报：" + msgs.join("、"));
    }
    save();
    U.toast("已揭示并结算", "ok");
    render(); // render() 内部已统一处理 rescuePending 弹窗，此处不再重复调用
  }

  /* ---------- 政府面板 ---------- */

  function buildGovPanel(state, step) {
    const card = U.el("div", { class: "card gov-panel" });
    card.appendChild(U.el("h4", {}, "政府决策 · 当前财政 ",
      U.el("span", { class: "finance-big num", text: state.government.finance })));

    if (step.government.target === "ecoExtrema") {
      // 显示当前生态排名辅助政府决策
      const sorted = state.companies.slice().sort((a, b) => a.ecology - b.ecology);
      card.appendChild(U.el("p", { style: "font-size:13px;color:var(--slate)",
        text: "当前生态排名（低→高）：" + sorted.map(c => c.name + " " + c.ecology).join(" < ") }));
    }

    const reasonInput = U.el("input", { type: "text", class: "reason-input", placeholder: "政策理由（选填，将记入日志）" });

    const list = U.el("div", { class: "policy-list" });
    step.government.options.forEach(opt => {
      const btn = U.el("button", { class: "policy-btn" },
        U.el("span", { class: "p-label", text: opt.label }),
        U.el("span", { class: "p-detail", text: opt.detail }));
      // 财政红线预判
      const need = predictFinanceNeed(state, step, opt);
      if (need != null && state.government.finance + need < 0) {
        btn.disabled = true;
        btn.title = "财政红线：不足以执行";
        btn.appendChild(U.el("span", { class: "p-detail", style: "color:var(--cinnabar)", text: "⚠ 财政不足（需 " + (-need) + "）" }));
      }
      btn.addEventListener("click", function () {
        U.confirm(opt.label, opt.detail + "\n\n确认执行该政策？", function () {
          const r = E.settleGovernmentPolicy(state, step, opt.id, reasonInput.value.trim());
          if (!r.ok) { U.toast(r.error, "warn"); return; }
          // 两阶段：结算后停在答案页，教师点「下一步」再推进（可能跳过掷骰步）
          state.stepSettled = { stepId: step.id, skip: computeSkip(state, step, opt) };
          save();
          U.toast("政策已执行：" + opt.label, "ok");
          render();
        });
      });
      list.appendChild(btn);
    });
    card.appendChild(list);
    card.appendChild(reasonInput);
    return card;
  }

  /* 预判政策财政需求（与引擎同口径） */
  function predictFinanceNeed(state, step, opt) {
    const apply = opt.apply;
    if (!apply || !apply.finance) return 0;
    if (apply.target === "hasRooftopPV") {
      const n = state.companies.filter(c => c.assets.rooftopPV).length;
      return apply.finance * (n || 1);
    }
    return apply.finance;
  }

  /* ---------- 11 月试点资金面板 ---------- */

  function buildFundingPanel(state, step) {
    const card = U.el("div", { class: "card gov-panel" });
    card.appendChild(U.el("h4", {}, "零碳园区试点资金 · 财政 ",
      U.el("span", { class: "finance-big num", text: state.government.finance })));

    const apps = state.zeroCarbonApplications || {};
    const applicants = state.companies.filter(c => apps[c.id] && apps[c.id].applied);
    if (!applicants.length) {
      card.appendChild(U.el("p", { text: "本月无企业申报零碳园区试点。" }));
      card.appendChild(U.el("button", { class: "btn-gold", text: "跳过资金发放 ▸", onclick: function () { advanceStep(state); } }));
      return card;
    }
    card.appendChild(U.el("p", { style: "font-size:14px", html: applicants.map(c => {
      const a = apps[c.id];
      return c.name + "：" + (a.eligible
        ? "<b style='color:var(--jade-deep)'>合格（资格资产 " + a.assetCount + "/3）</b>"
        : "<b style='color:var(--cinnabar)'>不合格（资格资产 " + a.assetCount + "/3）</b>");
    }).join("　｜　") }));

    const tiers = step.government.tiers;
    const selections = {};
    const reasons = {};
    applicants.forEach(c => { selections[c.id] = 0; reasons[c.id] = ""; });

    applicants.forEach(c => {
      const row = U.el("div", { class: "award-row", style: "grid-template-columns:1.2fr 2fr 2fr" });
      row.appendChild(U.el("strong", { text: c.name }));
      const tierBtns = U.el("div", { style: "display:flex;gap:6px;flex-wrap:wrap" });
      tiers.forEach(t => {
        tierBtns.appendChild(U.el("button", {
          class: "btn-sm " + (selections[c.id] === t.amount ? "" : "btn-ghost"),
          text: t.label + " +" + t.amount,
          onclick: function () {
            selections[c.id] = t.amount;
            U.clear(tierBtns);
            tiers.forEach(t2 => {
              tierBtns.appendChild(U.el("button", {
                class: "btn-sm " + (selections[c.id] === t2.amount ? "" : "btn-ghost"),
                text: t2.label + " +" + t2.amount,
                onclick: function () { row.querySelectorAll("button").forEach(() => {}); selections[c.id] = t2.amount; syncTierBtns(); },
              }));
            });
            function syncTierBtns() {
              const bs = tierBtns.querySelectorAll("button");
              bs.forEach((b, i) => { b.className = "btn-sm " + (selections[c.id] === tiers[i].amount ? "" : "btn-ghost"); });
            }
            syncTierBtns();
          },
        }));
      });
      row.appendChild(tierBtns);
      const reason = U.el("input", { type: "text", placeholder: "档位理由（选填）", style: "width:100%" });
      reason.addEventListener("input", () => { reasons[c.id] = reason.value; });
      row.appendChild(reason);
      card.appendChild(row);
    });

    card.appendChild(U.el("button", { class: "btn-lg btn-gold", text: "💰 发放试点资金 ▸", onclick: function () {
      const r = E.settlePilotFunding(state, step, selections, reasons);
      if (!r.ok) { U.toast(r.error, "warn"); return; }
      state.stepSettled = { stepId: step.id, skip: 0 };
      save();
      render();
    } }));
    return card;
  }

  /* ---------- 掷骰面板 ---------- */

  function buildDicePanel(state, step) {
    const card = U.el("div", { class: "card" });
    card.appendChild(U.el("h4", { text: "掷骰" }));
    card.appendChild(U.el("p", { style: "font-size:14px;color:var(--slate)", text: step.note || "" }));

    // 参与企业：全部或仅具资产者
    let participants = state.companies;
    if (step.onlyCompaniesWith) {
      participants = state.companies.filter(c => c.assets[step.onlyCompaniesWith]);
      card.appendChild(U.el("p", { style: "font-size:14px", text: "参与企业：" + (participants.map(c => c.name).join("、") || "无（跳过本步）") }));
      if (!participants.length) {
        card.appendChild(U.el("button", { class: "btn", text: "无参与企业，跳过 ▸", onclick: function () { advanceStep(state); } }));
        return card;
      }
    }

    const rolls = {};
    const rows = [];
    participants.forEach(c => { rolls[c.id] = null; });

    participants.forEach(c => {
      const row = U.el("div", { class: "dice-row" });
      row.appendChild(U.el("strong", { style: "min-width:90px", text: c.name }));
      const cube = U.el("div", { class: "dice-cube", text: "?" });
      row.appendChild(cube);
      if (state.settings.autoDice) {
        row.appendChild(U.el("button", { text: "🎲 自动掷骰", onclick: function () {
          cube.classList.add("rolling");
          setTimeout(function () {
            cube.classList.remove("rolling");
            const f = E.rollDie();
            cube.textContent = f;
            rolls[c.id] = f;
            refresh();
          }, 600);
        } }));
      }
      const manual = U.el("select", {},
        U.el("option", { value: "", text: "或手动录入…" }),
        U.el("option", { value: "1", text: "骰面 1" }), U.el("option", { value: "2", text: "骰面 2" }),
        U.el("option", { value: "3", text: "骰面 3" }), U.el("option", { value: "4", text: "骰面 4" }),
        U.el("option", { value: "5", text: "骰面 5" }), U.el("option", { value: "6", text: "骰面 6" }));
      manual.addEventListener("change", function () {
        if (manual.value) { rolls[c.id] = parseInt(manual.value, 10); cube.textContent = manual.value; refresh(); }
      });
      row.appendChild(manual);
      rows.push({ row: row, cube: cube });
      card.appendChild(row);
    });

    const settleBtn = U.el("button", { class: "btn-lg", disabled: true, text: "✓ 结算掷骰结果 ▸", onclick: function () {
      E.settleDiceResults(state, step, rolls);
      state.stepSettled = { stepId: step.id, skip: 0 };
      save();
      render();
    } });
    card.appendChild(settleBtn);

    function refresh() {
      settleBtn.disabled = !participants.every(c => rolls[c.id] != null);
    }
    return card;
  }

  /* ---------- 自动事件面板 ---------- */

  function buildAutoPanel(state, step) {
    const card = U.el("div", { class: "card" });
    card.appendChild(U.el("h4", { text: step.title }));
    // 预演各企业影响
    const preview = step.autoApply(state.companies);
    preview.forEach(r => {
      const c = E.getCompany(state, r.companyId);
      card.appendChild(U.el("div", { class: "dice-row" },
        U.el("strong", { style: "min-width:90px", text: c.name }),
        U.el("span", { text: r.note }),
        U.el("span", { class: r.economy > 0 ? "delta-pos" : r.economy < 0 ? "delta-neg" : "delta-zero num", text: E.fmtDelta(r.economy || 0) })));
    });
    card.appendChild(U.el("button", { class: "btn-lg", text: "⚡ 执行结算 ▸", onclick: function () {
      E.settleAutoEvent(state, step);
      state.stepSettled = { stepId: step.id, skip: 0 };
      save();
      render();
    } }));
    return card;
  }

  /* ---------- 年终颁奖 ---------- */

  function buildAwardPanel(state, step) {
    const card = U.el("div", { class: "card" });
    card.appendChild(U.el("h4", { text: "年终颁奖（3 个奖项，不改分值）" }));
    const rows = [];
    for (let i = 0; i < 3; i++) {
      const row = U.el("div", { class: "award-row" });
      const nameInp = U.el("input", { type: "text", placeholder: "奖项名称（如：绿色先锋奖）" });
      const compSel = U.el("select", {}, state.companies.map(c => U.el("option", { value: c.id, text: c.name })));
      const reasonInp = U.el("input", { type: "text", placeholder: "获奖理由" });
      row.appendChild(nameInp); row.appendChild(compSel); row.appendChild(reasonInp);
      card.appendChild(row);
      rows.push({ nameInp, compSel, reasonInp });
    }
    card.appendChild(U.el("button", { class: "btn-lg btn-gold", text: "🏆 完成颁奖，查看年终结算 ▸", onclick: function () {
      state.government.awards = rows.map(r => ({
        name: r.nameInp.value.trim() || "未命名奖",
        companyId: r.compSel.value,
        reason: r.reasonInp.value.trim(),
      }));
      E.log(state, "government", "年终颁奖：" + state.government.awards.map(a => "「" + a.name + "」→ " + E.getCompany(state, a.companyId).name).join("，"));
      save();
      state.finished = true;
      save();
      render();
    } }));
    return card;
  }

  /* ---------- 年终结算页 ---------- */

  function buildFinal() {
    const state = ControlConsole.state;
    const fin = E.computeFinal(state);
    const wrap = U.el("div", { class: "setup-wrap", style: "max-width:860px" });
    const card = U.el("div", { class: "card" });
    card.appendChild(U.el("h3", { text: "🏁 年终结算" }));

    const table = U.el("table", { class: "final-table" });
    table.appendChild(U.el("tr", {},
      U.el("th", { text: "名次" }), U.el("th", { text: "企业" }),
      U.el("th", { text: "经济值" }), U.el("th", { text: "生态值" }), U.el("th", { text: "总分" })));
    fin.ranking.forEach((r, i) => {
      table.appendChild(U.el("tr", { class: i === 0 ? "rank-1" : "" },
        U.el("td", { text: "第 " + (i + 1) + " 名" }),
        U.el("td", { text: r.name }),
        U.el("td", { class: "num", text: String(r.economy) }),
        U.el("td", { class: "num", text: String(r.ecology) }),
        U.el("td", { class: "num", text: String(r.total) })));
    });
    card.appendChild(table);

    card.appendChild(U.el("h4", { text: "政府治理目标" }));
    const goals = U.el("div", {});
    goals.appendChild(U.el("span", { class: "goal-chip " + (fin.goals.ecology.achieved ? "ok" : "bad"),
      text: (fin.goals.ecology.achieved ? "✔" : "✘") + " 全社会生态 " + fin.totalEcology + " / 240" }));
    goals.appendChild(U.el("span", { class: "goal-chip " + (fin.goals.economy.achieved ? "ok" : "bad"),
      text: (fin.goals.economy.achieved ? "✔" : "✘") + " 全社会经济 " + fin.totalEconomy + " / 320" }));
    goals.appendChild(U.el("span", { class: "goal-chip " + (fin.goals.finance.achieved ? "ok" : "bad"),
      text: (fin.goals.finance.achieved ? "✔" : "✘") + " 财政 " + fin.govFinance + " / ≥0" }));
    card.appendChild(goals);

    if (state.government.awards.length) {
      card.appendChild(U.el("h4", { text: "颁奖记录" }));
      state.government.awards.forEach(a => {
        card.appendChild(U.el("p", {}, "🏆 " + a.name + "：" + E.getCompany(state, a.companyId).name + (a.reason ? " — " + a.reason : "")));
      });
    }

    card.appendChild(U.el("div", { style: "margin-top:14px;display:flex;gap:10px" },
      U.el("button", { class: "btn-ghost", text: "查看归档复盘 ↗", onclick: function () { location.hash = "#/archive"; } }),
      U.el("button", { class: "btn-ghost", text: "⤓ 导出 JSON", onclick: doExport })));
    wrap.appendChild(card);
    wrap.appendChild(buildPager(state));
    return wrap;
  }

  /* ================= 右栏：状态 ================= */

  function buildStatusCol(state) {
    const col = U.el("div", { class: "status-col" });

    // 企业状态
    const cCard = U.el("div", { class: "card", style: "padding:10px 12px" });
    cCard.appendChild(U.el("h4", { text: "企业状态" }));
    state.companies.forEach(c => {
      const danger = c.economy <= 20 || c.ecology <= 20;
      const mini = U.el("div", { class: "company-mini" + (danger ? " danger" : "") });
      mini.appendChild(U.el("h5", {}, c.name + (danger ? " ⚠" : ""),
        U.el("span", { class: "num", text: (c.economy + c.ecology) + " 分" })));
      const vals = U.el("div", { class: "vals" });
      vals.appendChild(U.el("span", { text: "经济 " }));
      vals.appendChild(U.el("b", { class: c.economy <= 20 ? "delta-neg" : "", text: String(c.economy) }));
      vals.appendChild(U.el("span", { text: "　生态 " }));
      vals.appendChild(U.el("b", { class: c.ecology <= 20 ? "delta-neg" : "", text: String(c.ecology) }));
      mini.appendChild(vals);
      const assets = U.el("div", { class: "assets" });
      E.ASSET_KEYS.forEach(k => {
        const meta = EV.ASSET_META[k];
        assets.appendChild(U.el("span", { class: "asset-badge" + (c.assets[k] ? " on" : ""), text: meta.icon + " " + meta.name }));
      });
      mini.appendChild(assets);
      cCard.appendChild(mini);
    });
    col.appendChild(cCard);

    // 政府财政
    const gCard = U.el("div", { class: "gov-mini" });
    gCard.appendChild(U.el("h5", { style: "margin:0 0 4px;font-size:14px", text: state.government.name + " · 财政" }));
    gCard.appendChild(U.el("div", { class: "finance", text: String(state.government.finance) }));
    col.appendChild(gCard);

    // 最近日志
    const lCard = U.el("div", { class: "card", style: "padding:10px 12px;flex:1" });
    lCard.appendChild(U.el("h4", { text: "最近日志" }));
    const logBox = U.el("div", { class: "log-mini scroll-y" });
    state.logs.slice(-14).reverse().forEach(l => {
      logBox.appendChild(U.el("div", { class: "entry k-" + l.kind, text: l.text }));
    });
    lCard.appendChild(logBox);
    col.appendChild(lCard);
    return col;
  }

  /* ================= 救助弹窗 ================= */

  function showRescueDialog() {
    const state = ControlConsole.state;
    const p = state.rescuePending;
    const c = E.getCompany(state, p.companyId);
    const body = U.el("div", {});
    body.appendChild(U.el("div", { class: "rescue-info" },
      U.el("p", {}, "⚠ ", U.el("strong", { text: c.name }), " 经济值降至 " + p.economy + "（≤ 20），濒临破产"),
      U.el("p", { text: "救助方案：企业经济 +10，政府财政 -10" }),
      U.el("p", { text: "当前政府财政：" + state.government.finance + (state.government.finance < 10 ? "（不足以支付！）" : "") })));
    const reason = U.el("input", { type: "text", placeholder: "决策理由（选填，记入日志）", style: "width:100%" });
    body.appendChild(reason);

    const dlg = U.modal({
      title: "破产救助决策",
      tone: "danger",
      dismissable: false,
      body: body,
      buttons: [
        { label: "撤销上一步", onClick: function () { doUndo(); } },
        { label: "不发放", onClick: function () {
          E.resolveRescue(state, false, reason.value.trim());
          save(); render();
          closeAndChain(); // 可能还有下一家
        } },
        { label: "发放救助 +10", tone: "btn-danger", closes: false, onClick: function () {
          const r = E.resolveRescue(state, true, reason.value.trim());
          if (!r.ok) { U.toast(r.error, "warn"); return false; }
          save(); render();
          closeAndChain();
        } },
      ],
    });
    // 关闭当前弹窗；若 render() 因新一家 rescuePending 已再开弹窗则不重复
    function closeAndChain() {
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      if (state.rescuePending && !document.querySelector(".modal-backdrop")) showRescueDialog();
    }
  }

  /* ================= 快照 / 导出 / 撤销 ================= */

  function doUndo() {
    const state = ControlConsole.state;
    const r = E.undo(state);
    if (!r.ok) { U.toast(r.error, "warn"); return; }
    ControlConsole.state = r.state;
    save();
    // 清扫残留弹窗（含救助弹窗本身）：撤销后由 render() 按恢复状态决定是否重开。
    // 幂等移除：modal 按钮自身关闭逻辑可能已将其摘除，remove 前判 parentNode
    document.querySelectorAll(".modal-backdrop").forEach(function (b) {
      if (b.parentNode) b.parentNode.removeChild(b);
    });
    U.toast("已撤销到最近快照", "ok");
    render();
  }

  function showSnapshots() {
    const state = ControlConsole.state;
    const body = U.el("div", {});
    if (!state.snapshots.length) body.appendChild(U.el("p", { text: "暂无快照" }));
    state.snapshots.slice().reverse().forEach(snap => {
      body.appendChild(U.el("div", { style: "display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--slate-border)" },
        U.el("span", { style: "flex:1", text: snap.label + "（" + snap.at.slice(11, 19) + "）" }),
        U.el("button", { class: "btn-sm btn-ghost", text: "恢复", onclick: function () {
          ControlConsole.state = JSON.parse(JSON.stringify(snap.state));
          ControlConsole.state.snapshots = state.snapshots;
          save();
          U.toast("已恢复到：" + snap.label, "ok");
          render();
        } })));
    });
    U.modal({ title: "快照列表（最近在前）", body: body });
  }

  function doExport() {
    const state = ControlConsole.state;
    const blob = new Blob([E.serialize(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "greentales-" + state.month + "月-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ================= 观战二维码 ================= */

  function showQr() {
    const state = ControlConsole.state;
    const pub = E.publicSnapshot(state, EV);
    const url = buildSpectateUrl(pub);
    const body = U.el("div", { style: "text-align:center" });
    try {
      const svg = root.GreenQR.toSvg(url, 4);
      body.appendChild(U.el("div", { html: svg, style: "background:#fff;padding:12px;border-radius:8px;display:inline-block" }));
    } catch (e) {
      body.appendChild(U.el("p", { class: "delta-neg", text: "二维码生成失败：" + e.message }));
    }
    body.appendChild(U.el("p", { style: "word-break:break-all;font-size:12px;color:var(--slate)", text: url }));
    body.appendChild(U.el("p", { text: "学生扫码或访问该 URL 即可查看公开状态（揭示前不含企业选择）。" }));
    U.modal({ title: "学生观战二维码", tone: "gold", body: body });
  }

  function buildSpectateUrl(pub) {
    // 最小化快照（数组形态）：[月, 已揭示, 财政, [企业[名,经,生,资产CSV,已提交,选择],...]]
    // 月份标题由观战页按月份数字从本地 events.js 查表还原，不占 URL
    const mini = [
      pub.month,
      pub.reveal ? 1 : 0,
      pub.govFinance,
      pub.companies.map(function (c) {
        return [c.name, c.economy, c.ecology,
          c.assets.length ? c.assets.join(",") : "",
          c.submitted ? 1 : 0,
          (pub.revealedLabels && pub.revealedLabels[c.id]) || c.revealedChoice || ""];
      }),
    ];
    const json = JSON.stringify(mini);
    const b64 = root.btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return location.origin + location.pathname + "#/spectate?s=" + b64;
  }

  root.ControlConsole = ControlConsole;
})(typeof self !== "undefined" ? self : this);
