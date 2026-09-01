/* ============================================================
   《绿神话》归档页（#/archive）
   复盘视图：月度记录表 / 全量日志 / 骰子记录 / 快照列表 / 终局结算
   数据来源：localStorage 的引擎状态（与中控台同源）
   ============================================================ */

(function (root) {
  "use strict";

  const E = root.GreenEngine, EV = root.GreenEvents, U = root.GreenUI;

  const ControlArchive = {};
  let activeTab = "monthly";

  ControlArchive.mount = function (app) {
    U.clear(app);
    const state = getState();
    if (!state) {
      app.appendChild(U.el("div", { class: "arch-empty" },
        U.el("h2", { text: "暂无可复盘的游戏" }),
        U.el("p", { text: "请先在中控台（#/control）开局，游戏数据会自动保存。" })));
      return;
    }
    render(state);
  };

  function getState() {
    const raw = U.storage.get(E.SAVE_KEY);
    if (!raw) return null;
    const r = E.deserialize(raw);
    return r.ok ? r.state : null;
  }

  function render(state) {
    const app = document.getElementById("app");
    U.clear(app);

    const wrap = U.el("div", { class: "arch-wrap" });
    wrap.appendChild(U.el("div", { class: "arch-title" },
      U.el("span", { text: "📜 复盘归档" }),
      U.el("span", { class: "sub",
        text: "当前进度：第 " + state.month + " 月 · 快照 " + state.snapshots.length + " 个 · 日志 " + state.logs.length + " 条" })));

    // 页签
    const tabs = U.el("div", { class: "arch-tabs" });
    const TABS = [["monthly", "月度记录"], ["logs", "全程日志"], ["dice", "骰子记录"], ["snapshots", "快照列表"], ["final", "年终结算"]];
    TABS.forEach(function (t) {
      tabs.appendChild(U.el("button", {
        class: "arch-tab" + (activeTab === t[0] ? " active" : ""),
        text: t[1],
        onclick: function () { activeTab = t[0]; render(state); },
      }));
    });
    wrap.appendChild(tabs);

    const body = U.el("div", {});
    if (activeTab === "monthly") body.appendChild(buildMonthly(state));
    else if (activeTab === "logs") body.appendChild(buildLogs(state));
    else if (activeTab === "dice") body.appendChild(buildDice(state));
    else if (activeTab === "snapshots") body.appendChild(buildSnapshots(state));
    else body.appendChild(buildFinal(state));
    wrap.appendChild(body);

    app.appendChild(wrap);
  }

  /* ---------- 月度记录表 ---------- */
  function buildMonthly(state) {
    // 汇集所有出现过的月份
    const months = [];
    state.companies.forEach(function (c) {
      c.history.forEach(function (r) {
        if (months.indexOf(r.month) < 0) months.push(r.month);
      });
    });
    months.sort(function (a, b) { return a - b; });

    if (!months.length) {
      return U.el("div", { class: "arch-empty" }, U.el("p", { text: "尚无月度记录——完成第一个月的结算后生成。" }));
    }

    const table = U.el("table", { class: "arch-table" });
    const thead = U.el("tr", {},
      U.el("th", { text: "企业" }), U.el("th", { text: "月投入" }),
      U.el("th", { text: "当月经济变动" }), U.el("th", { text: "当月生态变动" }),
      U.el("th", { text: "政策性收支" }), U.el("th", { text: "月末经济" }),
      U.el("th", { text: "月末生态" }), U.el("th", { text: "备注" }));
    table.appendChild(thead);

    months.forEach(function (m) {
      // 月份分隔行
      const md = EV.MONTHS.find(function (x) { return x.month === m; });
      table.appendChild(U.el("tr", { class: "month-head" },
        U.el("td", { colspan: "8", text: "第 " + m + " 月 · " + (md ? md.title : "") })));

      state.companies.forEach(function (c) {
        const rec = c.history.find(function (r) { return r.month === m; });
        if (!rec) return;
        // 该月末值 = 下一条记录的 start，或当前值（最后一个月）
        const next = c.history.find(function (r) { return r.month === m + 1; });
        const econEnd = next ? next.economyStart : (m === state.month ? c.economy : rec.economyStart);
        const ecoEnd = next ? next.ecologyStart : (m === state.month ? c.ecology : rec.ecologyStart);

        const notes = U.el("div", {});
        (rec.notes || []).forEach(function (n) {
          notes.appendChild(U.el("div", { class: "note-line", text: n }));
        });

        table.appendChild(U.el("tr", {},
          U.el("td", { class: "company", text: c.name }),
          U.el("td", { class: "num", text: rec.investment ? String(rec.investment) : "—" }),
          U.el("td", { class: "num " + (rec.monthlyIncome > 0 ? "pos" : rec.monthlyIncome < 0 ? "neg" : ""), text: E.fmtDelta(rec.monthlyIncome) }),
          U.el("td", { class: "num " + (rec.ecologyDelta > 0 ? "pos" : rec.ecologyDelta < 0 ? "neg" : ""), text: E.fmtDelta(rec.ecologyDelta) }),
          U.el("td", { class: "num " + (rec.govDelta > 0 ? "pos" : rec.govDelta < 0 ? "neg" : ""), text: rec.govDelta ? E.fmtDelta(rec.govDelta) : "—" }),
          U.el("td", { class: "num", text: String(econEnd) }),
          U.el("td", { class: "num", text: String(ecoEnd) }),
          U.el("td", {}, notes)));
      });
    });

    const box = U.el("div", {});
    box.appendChild(table);
    box.appendChild(U.el("p", { style: "font-size:12.5px;color:var(--slate);margin-top:8px",
      text: "口径：当月经济变动 = 月初持续收益（往月购置设备/政策的逐月收益，生效至 12 月）+ 本月经营收入与事件损益；政策性收支 = 补贴/救助/奖惩等政府转移；月末值为下月起始值，末月为当前值。" }));
    return box;
  }

  /* ---------- 全程日志 ---------- */
  function buildLogs(state) {
    const KIND_NAMES = {
      system: "系统", company: "企业", government: "政府",
      dice: "掷骰", risk: "风险", rescue: "救助", settle: "结算",
    };
    const box = U.el("div", { class: "arch-log" });
    if (!state.logs.length) {
      box.appendChild(U.el("p", { text: "暂无日志。", style: "color:var(--slate)" }));
      return box;
    }
    // 倒序（最新在前）
    state.logs.slice().reverse().forEach(function (e) {
      const t = new Date(e.t);
      const hhmm = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0")
        + ":" + String(t.getSeconds()).padStart(2, "0");
      box.appendChild(U.el("div", { class: "arch-log-entry k-" + e.kind },
        U.el("span", { class: "t", text: hhmm }),
        U.el("span", { class: "k", text: KIND_NAMES[e.kind] || e.kind }),
        U.el("span", { text: e.text })));
    });
    return box;
  }

  /* ---------- 骰子记录 ---------- */
  function buildDice(state) {
    const box = U.el("div", {});
    if (!state.dice.length) {
      box.appendChild(U.el("div", { class: "arch-empty" }, U.el("p", { text: "本局尚未掷骰。" })));
      return box;
    }
    const table = U.el("table", { class: "arch-table" });
    table.appendChild(U.el("tr", {},
      U.el("th", { text: "月份" }), U.el("th", { text: "事件" }),
      U.el("th", { text: "掷骰方" }), U.el("th", { text: "点数" }),
      U.el("th", { text: "模式" }), U.el("th", { text: "结果" })));
    state.dice.slice().reverse().forEach(function (d) {
      const who = d.companyId === "__gov"
        ? state.government.name
        : (function () { const c = E.getCompany(state, d.companyId); return c ? c.name : d.companyId; })();
      table.appendChild(U.el("tr", {},
        U.el("td", { class: "num", text: String(d.month) }),
        U.el("td", { text: d.eventId || "—" }),
        U.el("td", { text: who }),
        U.el("td", {}, U.el("span", { class: "dice-face", text: String(d.face) })),
        U.el("td", { text: d.mode === "auto" ? "自动" : "手动" }),
        U.el("td", { text: d.outcome || "—" })));
    });
    box.appendChild(table);
    return box;
  }

  /* ---------- 快照列表 ---------- */
  function buildSnapshots(state) {
    const box = U.el("div", {});
    if (!state.snapshots.length) {
      box.appendChild(U.el("div", { class: "arch-empty" }, U.el("p", { text: "暂无快照——每次结算前会自动生成。" })));
      return box;
    }
    // 倒序
    state.snapshots.slice().reverse().forEach(function (snap, i) {
      const t = new Date(snap.at);
      const ts = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0") + ":" + String(t.getSeconds()).padStart(2, "0");
      box.appendChild(U.el("div", { class: "arch-snap" },
        U.el("span", { class: "lab", text: "#" + (state.snapshots.length - i) + " " + snap.label }),
        U.el("span", { class: "at", text: ts })));
    });
    box.appendChild(U.el("p", { style: "font-size:12.5px;color:var(--slate);margin-top:8px",
      text: "快照可在中控台的「快照列表」中恢复（复盘页只读，避免误操作）。" }));
    return box;
  }

  /* ---------- 年终结算 ---------- */
  function buildFinal(state) {
    const fin = E.computeFinal(state);
    const box = U.el("div", {});

    // 政府三目标
    const goals = U.el("div", { class: "arch-final-goal" });
    [["ecology", "总生态", fin.totalEcology + " / 240"],
     ["economy", "总经济", fin.totalEconomy + " / 320"],
     ["finance", "财政结余", String(fin.govFinance)]].forEach(function (g) {
      const info = fin.goals[g[0]];
      goals.appendChild(U.el("div", { class: "arch-goal " + (info.achieved ? "ok" : "fail") },
        U.el("div", { class: "g-name", text: g[1] + "（目标 " + (g[0] === "finance" ? "≥0" : "≥" + info.target) + "）" }),
        U.el("div", { class: "g-val", text: g[2] }),
        U.el("div", { class: "g-mark", text: info.achieved ? "✔ 达成" : "✘ 未达成" })));
    });
    box.appendChild(U.el("h3", { style: "font-family:'Noto Serif SC',serif;margin:6px 0", text: "政府治理目标" }));
    box.appendChild(goals);

    // 企业排名
    box.appendChild(U.el("h3", { style: "font-family:'Noto Serif SC',serif;margin:18px 0 6px", text: "企业排名（经济 + 生态总分）" }));
    const table = U.el("table", { class: "arch-table" });
    table.appendChild(U.el("tr", {},
      U.el("th", { text: "名次" }), U.el("th", { text: "企业" }),
      U.el("th", { text: "经济" }), U.el("th", { text: "生态" }),
      U.el("th", { text: "总分" }), U.el("th", { text: "总投资" })));
    fin.ranking.forEach(function (r, i) {
      const c = state.companies.find(function (x) { return x.id === r.id; });
      table.appendChild(U.el("tr", {},
        U.el("td", { class: "num", text: ["冠军", "亚军", "季军"][i] || "第" + (i + 1) + "名" }),
        U.el("td", { class: "company", text: r.name }),
        U.el("td", { class: "num", text: String(r.economy) }),
        U.el("td", { class: "num", text: String(r.ecology) }),
        U.el("td", { class: "num", text: String(r.total) }),
        U.el("td", { class: "num", text: c ? String(c.totalInvestment || 0) : "—" })));
    });
    box.appendChild(table);

    // 年终奖项
    if (state.government.awards && state.government.awards.length) {
      box.appendChild(U.el("h3", { style: "font-family:'Noto Serif SC',serif;margin:18px 0 6px", text: "年终奖项（不改分值）" }));
      const at = U.el("table", { class: "arch-table" });
      at.appendChild(U.el("tr", {}, U.el("th", { text: "奖项" }), U.el("th", { text: "获奖企业" })));
      state.government.awards.forEach(function (a) {
        at.appendChild(U.el("tr", {},
          U.el("td", { text: a.name || a.awardName || "—" }),
          U.el("td", { class: "company", text: a.companyName || a.companyId || "—" })));
      });
      box.appendChild(at);
    } else {
      box.appendChild(U.el("p", { style: "font-size:13px;color:var(--slate);margin-top:10px", text: "（尚未颁发年终奖项——在 12 月结束后的颁奖环节录入。）" }));
    }

    return box;
  }

  root.ControlArchive = ControlArchive;
})(typeof self !== "undefined" ? self : this);
