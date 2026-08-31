/* ============================================================
   《绿神话》规则引擎（纯逻辑，Node / 浏览器双模式）
   职责：全局状态、月度结算、风险规则、政府财政红线、
        日志、自动快照与撤销、存档序列化
   不依赖 DOM。
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GreenEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const SAVE_KEY = "greentales-save";
  const SNAPSHOT_LIMIT = 30;
  const RISK_LINE = 20; // 生态/经济 ≤ 20 触发风险规则
  const RESCUE_AMOUNT = 10; // 破产救助：企业 +10 / 政府 -10

  const COMPANY_IDS = ["A", "B", "C"];
  const ASSET_KEYS = ["rooftopPV", "battery", "oneWayCharger", "twoWayCharger"];

  /* ============ 初始化 ============ */

  function createGame(setup) {
    setup = setup || {};
    const names = setup.companyNames || {};
    const state = {
      version: VERSION,
      createdAt: new Date().toISOString(),
      month: 1,
      stepIndex: 0, // 当前月内的步骤下标
      phase: "companyChoice", // 当前步骤类型
      companies: COMPANY_IDS.map(function (id) {
        return {
          id: id,
          name: names[id] || "企业 " + id,
          economy: 60,
          ecology: 60,
          assets: {
            rooftopPV: false,
            battery: false,
            oneWayCharger: false,
            twoWayCharger: false,
          },
          totalInvestment: 0,
          history: [], // MonthlyRecord[]
        };
      }),
      government: {
        name: setup.governmentName || "政府",
        finance: 100,
        policyLog: [],
        awards: [],
      },
      pendingDecisions: {}, // companyId -> { optionId, retrofitId? } | null（companyChoice 进行中）
      revealed: false, // 当前 companyChoice 是否已统一揭示
      dice: [], // DiceLog[]
      logs: [], // LogEntry[]
      snapshots: [], // Snapshot[]
      rescueUsed: {}, // companyId -> boolean
      rescuePending: null, // 待政府决策的救助 { companyId, economy }
      finished: false,
      settings: {
        autoDice: setup.autoDice !== false, // 默认自动掷骰
      },
    };
    log(state, "system", "游戏创建，初始值：企业经济 60 / 生态 60，政府财政 100");
    return state;
  }

  /* ============ 工具 ============ */

  function log(state, kind, text, extra) {
    state.logs.push({
      t: new Date().toISOString(),
      month: state.month,
      kind: kind, // system | company | government | dice | risk | rescue | settle
      text: text,
      extra: extra || null,
    });
  }

  function snapshot(state, label) {
    // 深拷贝当前状态（排除 snapshots 自身历史，避免嵌套膨胀）
    const copy = JSON.parse(JSON.stringify(state));
    copy.snapshots = [];
    state.snapshots.push({
      label: label || ("M" + state.month + "·步骤" + (state.stepIndex + 1)),
      at: new Date().toISOString(),
      state: copy,
    });
    if (state.snapshots.length > SNAPSHOT_LIMIT) state.snapshots.shift();
  }

  function getCompany(state, id) {
    for (var i = 0; i < state.companies.length; i++) {
      if (state.companies[i].id === id) return state.companies[i];
    }
    return null;
  }

  function fmtDelta(n) {
    return n > 0 ? "+" + n : String(n);
  }

  /* ============ 月度记录 ============ */

  function ensureMonthlyRecord(state, companyId) {
    const c = getCompany(state, companyId);
    const m = state.month;
    var rec = null;
    for (var i = 0; i < c.history.length; i++) {
      if (c.history[i].month === m) { rec = c.history[i]; break; }
    }
    if (!rec) {
      rec = { month: m, economyStart: c.economy, ecologyStart: c.ecology, investment: 0, monthlyIncome: 0, ecologyDelta: 0, govDelta: 0, notes: [] };
      c.history.push(rec);
    }
    return rec;
  }

  /* ============ 风险规则 ============ */

  /* 结算前调用：记录各企业结算前的瞬时值，作为风险边沿触发基准 */
  function markPreSettle(state) {
    state._preSettle = {};
    for (const c of state.companies) {
      state._preSettle[c.id] = { economy: c.economy, ecology: c.ecology };
    }
  }

  /* 每次结算后检查；返回触发的事件列表（引擎内部直接执行生态滑坡扣分）
     生态滑坡口径：本次结算前 > 20 且结算后 ≤ 20 才额外扣 10（边沿触发，防重复扣分） */
  function checkRisks(state) {
    const events = [];
    for (const c of state.companies) {
      const pre = state._preSettle && state._preSettle[c.id] ? state._preSettle[c.id] : { economy: c.economy, ecology: c.ecology };
      if (c.ecology <= RISK_LINE && pre.ecology > RISK_LINE) {
        c.ecology -= 10;
        events.push({ type: "ecoSlide", companyId: c.id, value: c.ecology });
        log(state, "risk", "⚠ " + c.name + " 生态值降至 " + pre.ecology + " ≤ 20，生态滑坡额外扣 10，现 " + c.ecology);
      } else if (c.ecology <= RISK_LINE) {
        events.push({ type: "ecoWarning", companyId: c.id, value: c.ecology });
      }
      if (c.economy <= RISK_LINE && !state.rescueUsed[c.id]) {
        state.rescueUsed[c.id] = true; // 资格标记（无论政府是否发放，资格只有一次）
        // 救助待决队列：多家同时濒危时依次弹出（旧档无队列字段则兼容单值）
        if (!state.rescueQueue) state.rescueQueue = [];
        if (!state.rescuePending) state.rescuePending = { companyId: c.id, economy: c.economy };
        else state.rescueQueue.push({ companyId: c.id, economy: c.economy });
        events.push({ type: "bankruptcy", companyId: c.id, value: c.economy });
        log(state, "risk", "⚠ " + c.name + " 经济值 " + c.economy + " ≤ 20，濒临破产，触发救助资格（限一次）");
      }
    }
    return events;
  }

  /* 政府救助决策 */
  function resolveRescue(state, approve, reason) {
    const p = state.rescuePending;
    if (!p) return { ok: false, error: "无待决策救助" };
    snapshot(state, "救助决策前");
    const c = getCompany(state, p.companyId);
    if (approve) {
      if (state.government.finance < RESCUE_AMOUNT) {
        return { ok: false, error: "财政不足以支付救助（需 ≥ " + RESCUE_AMOUNT + "）" };
      }
      c.economy += RESCUE_AMOUNT;
      state.government.finance -= RESCUE_AMOUNT;
      const rec = ensureMonthlyRecord(state, c.id);
      rec.govDelta += RESCUE_AMOUNT;
      rec.notes.push("破产救助 +" + RESCUE_AMOUNT);
      log(state, "rescue", "政府向 " + c.name + " 发放破产救助 +" + RESCUE_AMOUNT + "，政府财政 -" + RESCUE_AMOUNT + (reason ? "。理由：" + reason : ""));
    } else {
      log(state, "rescue", "政府决定不向 " + c.name + " 发放救助" + (reason ? "。理由：" + reason : ""));
    }
    state.rescuePending = state.rescueQueue && state.rescueQueue.length ? state.rescueQueue.shift() : null;
    return { ok: true };
  }

  /* ============ 结算：企业选项 ============ */

  function settleCompanyChoice(state, step, decisions) {
    // decisions: { companyId: { optionId, retrofitId? } }
    snapshot(state, "M" + state.month + " 揭示结算前");
    markPreSettle(state);
    const optMap = {};
    for (const o of step.options) optMap[o.id] = o;

    for (const cid of COMPANY_IDS) {
      const d = decisions[cid];
      if (!d) continue;
      const opt = optMap[d.optionId];
      if (!opt) continue;
      const c = getCompany(state, cid);
      const rec = ensureMonthlyRecord(state, cid);

      // 投资成本
      if (opt.cost) {
        c.economy += opt.cost;
        c.totalInvestment += -opt.cost;
        rec.investment += opt.cost;
      }
      // 每月经济
      if (opt.monthly) {
        c.economy += opt.monthly;
        rec.monthlyIncome += opt.monthly;
      }
      // 生态变化
      if (opt.ecology) {
        c.ecology += opt.ecology;
        rec.ecologyDelta += opt.ecology;
      }
      // 资产授予
      if (opt.grants) {
        for (const k in opt.grants) {
          c.assets[k] = opt.grants[k] ? true : c.assets[k] && opt.grants[k] !== false ? c.assets[k] : false;
        }
        // grants 值为 true 的直接置 true；false 表示移除（如单向桩升级为双向）
        for (const k in opt.grants) {
          if (opt.grants[k] === true) c.assets[k] = true;
          if (opt.grants[k] === false) c.assets[k] = false;
        }
      }
      let noteText = "选择 " + (opt.key || "") + " " + opt.label + "（投资 " + fmtDelta(opt.cost || 0) + "，经济 " + fmtDelta(opt.monthly || 0) + "，生态 " + fmtDelta(opt.ecology || 0) + "）";
      rec.notes.push(noteText);
      log(state, "company", "【" + state.month + "月】" + c.name + noteText);

      // followUp（3 月疫情）
      if (step.followUp && step.followUp.effects[d.optionId]) {
        const eff = step.followUp.effects[d.optionId];
        if (eff.economy) {
          c.economy += eff.economy;
          rec.monthlyIncome += eff.economy;
        }
        if (eff.ecology) {
          c.ecology += eff.ecology;
          rec.ecologyDelta += eff.ecology;
        }
        rec.notes.push("疫情：" + eff.note + "（经济 " + fmtDelta(eff.economy) + "）");
        log(state, "settle", c.name + " " + eff.note + "，经济 " + fmtDelta(eff.economy));
      }
    }
    checkRisks(state);
  }

  /* ============ 11 月：加装（子选择）结算 ============ */

  function settleRetrofit(state, step, decisions) {
    // decisions: { companyId: retrofitId }（仅 applyIntent === "applyWithRetrofit" 的企业）
    snapshot(state, "M11 加装结算前");
    markPreSettle(state);
    const retrofitMap = {};
    for (const r of step.retrofitOptions || []) retrofitMap[r.id] = r;
    const retrofitChoices = (state.retrofitChoices = state.retrofitChoices || {});

    for (const cid of COMPANY_IDS) {
      const rid = decisions[cid];
      if (!rid) continue;
      const r = retrofitMap[rid];
      if (!r) continue;
      const c = getCompany(state, cid);
      const rec = ensureMonthlyRecord(state, cid);
      if (r.cost) {
        c.economy += r.cost;
        c.totalInvestment += -r.cost;
        rec.investment += r.cost;
      }
      if (r.monthly) { c.economy += r.monthly; rec.monthlyIncome += r.monthly; }
      if (r.ecology) { c.ecology += r.ecology; rec.ecologyDelta += r.ecology; }
      if (r.grants) {
        for (const k in r.grants) {
          c.assets[k] = r.grants[k] === true ? true : r.grants[k] === false ? false : c.assets[k];
        }
      }
      rec.notes.push("加装：" + r.label + "（投资 " + fmtDelta(r.cost || 0) + "，经济 " + fmtDelta(r.monthly || 0) + "，生态 " + fmtDelta(r.ecology || 0) + "）");
      log(state, "company", "【11月】" + c.name + " 加装 " + r.label);
      retrofitChoices[cid] = rid;
    }
    checkRisks(state);
  }

  /* ============ 结算：政府政策 ============ */

  function policyTargets(state, apply) {
    // 返回受影响企业 id 数组
    switch (apply.target) {
      case "all":
        return COMPANY_IDS.slice();
      case "hasRooftopPV":
        return state.companies.filter(function (c) { return c.assets.rooftopPV; }).map(function (c) { return c.id; });
      case "ecoLowest": {
        let min = Infinity, ids = [];
        for (const c of state.companies) {
          if (c.ecology < min) { min = c.ecology; ids = [c.id]; }
          else if (c.ecology === min) ids.push(c.id);
        }
        return ids; // 并列全部生效（规则建议：并列同时奖惩或选一家说明理由——默认全部）
      }
      case "ecoHighest": {
        let max = -Infinity, ids = [];
        for (const c of state.companies) {
          if (c.ecology > max) { max = c.ecology; ids = [c.id]; }
          else if (c.ecology === max) ids.push(c.id);
        }
        return ids;
      }
      case "none":
      default:
        return [];
    }
  }

  function settleGovernmentPolicy(state, step, optionId, reason) {
    const opt = step.government.options.find(function (o) { return o.id === optionId; });
    if (!opt) return { ok: false, error: "未知政策选项" };
    const apply = opt.apply;
    const targets = policyTargets(state, apply);

    // 财政红线：6 月补贴按受影响企业数逐家扣（-2 × N）；其余政策财政为一次性总额
    const perCompanyFinance = apply.target === "hasRooftopPV";
    const totalFinance = perCompanyFinance ? apply.finance * (targets.length || 1) : apply.finance;
    if (totalFinance < 0 && state.government.finance + totalFinance < 0) {
      return { ok: false, error: "财政红线：当前财政 " + state.government.finance + "，不足以执行该政策（需 " + (-totalFinance) + "）" };
    }

    snapshot(state, "M" + state.month + " 政策前：" + opt.label);
    markPreSettle(state);
    for (const cid of targets) {
      const c = getCompany(state, cid);
      const rec = ensureMonthlyRecord(state, cid);
      if (apply.economy) {
        c.economy += apply.economy;
        rec.govDelta += apply.economy;
      }
      if (perCompanyFinance) {
        state.government.finance += apply.finance; // 每家单独扣
      }
      rec.notes.push("政府「" + opt.label + "」经济 " + fmtDelta(apply.economy));
    }
    if (!perCompanyFinance && apply.finance) {
      state.government.finance += apply.finance;
    }

    state.government.policyLog.push({
      t: new Date().toISOString(),
      month: state.month,
      policyId: optionId,
      label: opt.label,
      detail: opt.detail,
      targets: targets,
      finance: apply.finance,
      reason: reason || "",
    });
    log(state, "government", "【" + state.month + "月】政府执行「" + opt.label + "」，受影响企业：" + (targets.join("、") || "无") + "，财政 " + fmtDelta(totalFinance) + (reason ? "。理由：" + reason : ""));
    checkRisks(state);
    return { ok: true, triggersDice: opt.triggersDice || null };
  }

  /* ============ 11 月：资格检查与试点资金 ============ */

  function qualifiedAssets(assets) {
    // 屋顶光伏、双向充电桩、蓄电池 至少 2 项
    let n = 0;
    if (assets.rooftopPV) n++;
    if (assets.twoWayCharger) n++;
    if (assets.battery) n++;
    return n;
  }

  function checkZeroCarbonEligibility(state, decisions) {
    // decisions: { companyId: { optionId } }（m11-apply 步骤的决策）
    const result = {};
    for (const cid of COMPANY_IDS) {
      const d = decisions[cid];
      const c = getCompany(state, cid);
      const n = qualifiedAssets(c.assets);
      const intent = d ? (d.optionId === "m11-A" ? "applyDirect" : d.optionId === "m11-B" ? "applyWithRetrofit" : "skip") : "skip";
      let eligible = false;
      if (intent === "applyDirect") eligible = n >= 2;
      // applyWithRetrofit 的资格在加装结算后复查
      result[cid] = { intent: intent, assetCount: n, eligible: eligible };
    }
    // 记录公开的申报状态（含加装后复查）
    state.zeroCarbonApplications = state.zeroCarbonApplications || {};
    for (const cid of COMPANY_IDS) result[cid].intent;
    log(state, "settle", "零碳园区资格检查完成");
    return result;
  }

  function finalizeZeroCarbon(state, decisions, retrofitDecisions) {
    // 在加装结算之后调用，得到最终合格申报企业集合
    const apps = {};
    for (const cid of COMPANY_IDS) {
      const d = decisions[cid];
      if (!d) { apps[cid] = { applied: false, eligible: false }; continue; }
      const intent = d.optionId === "m11-A" ? "applyDirect" : d.optionId === "m11-B" ? "applyWithRetrofit" : "skip";
      const n = qualifiedAssets(getCompany(state, cid).assets);
      const applied = intent !== "skip";
      const eligible = applied && n >= 2;
      apps[cid] = { applied: applied, eligible: eligible, assetCount: n };
      if (applied && !eligible) {
        log(state, "settle", getCompany(state, cid).name + " 申报零碳园区但资格不足（资格资产 " + n + "/2），政府审查不通过");
      }
    }
    state.zeroCarbonApplications = apps;
    return apps;
  }

  function settlePilotFunding(state, step, tierByCompany, reasons) {
    // tierByCompany: { companyId: tierAmount(0/10/20/40) }
    const valid = state.zeroCarbonApplications || {};
    snapshot(state, "M11 试点资金发放前");
    markPreSettle(state);
    for (const cid of COMPANY_IDS) {
      const app = valid[cid];
      const amount = tierByCompany[cid];
      if (!app || !app.eligible || !amount) continue;
      const c = getCompany(state, cid);
      if (state.government.finance - amount < 0) {
        return { ok: false, error: "财政红线：第 " + amount + " 档资金不足（当前财政 " + state.government.finance + "）" };
      }
      c.economy += amount;
      state.government.finance -= amount;
      const rec = ensureMonthlyRecord(state, cid);
      rec.govDelta += amount;
      rec.notes.push("零碳园区试点资金 +" + amount);
      state.government.policyLog.push({
        t: new Date().toISOString(),
        month: 11,
        policyId: "m11-funding",
        label: "试点资金 第" + (amount === 0 ? 1 : amount === 10 ? 2 : amount === 20 ? 3 : 4) + "档 +" + amount,
        targets: [cid],
        finance: -amount,
        reason: (reasons && reasons[cid]) || "",
      });
      log(state, "government", "【11月】政府向 " + c.name + " 发放试点资金 +" + amount + (reasons && reasons[cid] ? "。理由：" + reasons[cid] : ""));
    }
    checkRisks(state);
    return { ok: true };
  }

  /* ============ 掷骰 ============ */

  function rollDie() {
    return 1 + Math.floor(Math.random() * 6);
  }

  function settleDiceResults(state, step, rolls) {
    // rolls: { companyId: face(1-6) }；或政府单骰 { __gov: face }
    snapshot(state, "M" + state.month + " 掷骰结算前");
    markPreSettle(state);
    const entries = [];
    for (const cid in rolls) {
      const face = rolls[cid];
      const res = step.results.find(function (r) { return r.faces.indexOf(face) >= 0; });
      if (!res) continue;
      entries.push({ companyId: cid, face: face, result: res });
      const diceLog = {
        t: new Date().toISOString(),
        month: state.month,
        eventId: step.id,
        mode: rolls.__mode || "manual",
        face: face,
        companyId: cid,
        outcome: res.label,
      };
      state.dice.push(diceLog);
      if (cid !== "__gov") {
        const c = getCompany(state, cid);
        if (res.economy) {
          c.economy += res.economy;
          const rec = ensureMonthlyRecord(state, cid);
          rec.monthlyIncome += res.economy;
        }
        if (res.ecology) {
          c.ecology += res.ecology;
          const rec = ensureMonthlyRecord(state, cid);
          rec.ecologyDelta += res.ecology;
        }
        log(state, "dice", "【" + state.month + "月】" + c.name + " 掷出 " + face + "：" + res.label + "（经济 " + fmtDelta(res.economy) + "）");
      }
    }
    checkRisks(state);
    return entries;
  }

  /* ============ 自动事件（9 月自备电力 / 10 月油价） ============ */

  function settleAutoEvent(state, step) {
    snapshot(state, "M" + state.month + " 自动结算前：" + step.title);
    markPreSettle(state);
    const results = step.autoApply(state.companies);
    for (const r of results) {
      const c = getCompany(state, r.companyId);
      if (r.economy) {
        c.economy += r.economy;
        const rec = ensureMonthlyRecord(state, c.id);
        rec.monthlyIncome += r.economy;
        rec.notes.push(step.title + " " + fmtDelta(r.economy));
      }
      if (r.ecology) {
        c.ecology += r.ecology;
        const rec = ensureMonthlyRecord(state, c.id);
        rec.ecologyDelta += r.ecology;
      }
      log(state, "settle", "【" + state.month + "月】" + c.name + " " + step.title + "：" + r.note);
    }
    checkRisks(state);
    return results;
  }

  /* ============ 年终结算 ============ */

  function computeFinal(state) {
    const ranking = state.companies
      .map(function (c) {
        return { id: c.id, name: c.name, economy: c.economy, ecology: c.ecology, total: c.economy + c.ecology };
      })
      .sort(function (a, b) { return b.total - a.total; });
    const totalEco = state.companies.reduce(function (s, c) { return s + c.ecology; }, 0);
    const totalEcon = state.companies.reduce(function (s, c) { return s + c.economy; }, 0);
    return {
      ranking: ranking,
      totalEcology: totalEco,
      totalEconomy: totalEcon,
      govFinance: state.government.finance,
      goals: {
        ecology: { target: 240, value: totalEco, achieved: totalEco >= 240 },
        economy: { target: 320, value: totalEcon, achieved: totalEcon >= 320 },
        finance: { target: 0, value: state.government.finance, achieved: state.government.finance >= 0 },
      },
    };
  }

  /* ============ 撤销 ============ */

  function undo(state) {
    if (!state.snapshots.length) return { ok: false, error: "无快照可撤销" };
    const snap = state.snapshots.pop();
    const restored = snap.state;
    restored.snapshots = state.snapshots; // 保留剩余快照栈
    log(restored, "system", "撤销：恢复到「" + snap.label + "」");
    return { ok: true, state: restored };
  }

  /* ============ 序列化 ============ */

  function serialize(state) {
    return JSON.stringify(state);
  }

  function deserialize(json) {
    let obj;
    try { obj = JSON.parse(json); } catch (e) {
      return { ok: false, error: "JSON 解析失败：" + e.message };
    }
    if (!obj.version || obj.version !== VERSION) {
      return { ok: false, error: "版本不匹配（存档 " + obj.version + "，当前 " + VERSION + "），拒绝导入" };
    }
    if (!obj.companies || obj.companies.length !== 3 || !obj.government) {
      return { ok: false, error: "存档结构不完整" };
    }
    return { ok: true, state: obj };
  }

  /* ============ 公开快照（观战页用，最小化） ============ */

  function publicSnapshot(state, eventsData) {
    let currentStep = null;
    const monthDef = eventsData.MONTHS.find(function (m) { return m.month === state.month; });
    if (monthDef && state.stepIndex < monthDef.steps.length) {
      currentStep = monthDef.steps[state.stepIndex];
    }
    const s = {
      v: VERSION,
      month: state.month,
      monthTitle: monthDef ? monthDef.title : "",
      stepTitle: currentStep ? currentStep.title : "",
      prompt: currentStep && currentStep.prompt ? currentStep.prompt : "",
      options: currentStep && currentStep.options
        ? currentStep.options.map(function (o) { return { key: o.key || o.id, label: o.label }; })
        : [],
      reveal: !!state.revealed,
      submittedCount: Object.keys(state.pendingDecisions || {}).filter(function (k) { return state.pendingDecisions[k]; }).length,
      companies: state.companies.map(function (c) {
        return {
          id: c.id, name: c.name, economy: c.economy, ecology: c.ecology,
          assets: ASSET_KEYS.filter(function (k) { return c.assets[k]; }),
          submitted: !!(state.pendingDecisions && state.pendingDecisions[c.id]),
          revealedChoice: state.revealed && state.pendingDecisions[c.id]
            ? (state.pendingDecisions[c.id].optionId || null)
            : null,
        };
      }),
      govFinance: state.government.finance,
      govName: state.government.name,
      finished: !!state.finished,
      // 揭示后的公开选择结果（用 label 便于观战页直接显示）
      revealedLabels: state.revealed
        ? Object.keys(state.pendingDecisions || {}).reduce(function (acc, cid) {
            const d = state.pendingDecisions[cid];
            if (d && d.optionId) {
              const step = currentStep;
              const opt = step && step.options ? step.options.find(function (o) { return o.id === d.optionId; }) : null;
              acc[cid] = opt ? (opt.key ? opt.key + " · " + opt.label : opt.label) : d.optionId;
            }
            return acc;
          }, {})
        : null,
    };
    return s;
  }

  /* ============ 导出 API ============ */

  return {
    VERSION: VERSION,
    SAVE_KEY: SAVE_KEY,
    RISK_LINE: RISK_LINE,
    RESCUE_AMOUNT: RESCUE_AMOUNT,
    COMPANY_IDS: COMPANY_IDS,
    ASSET_KEYS: ASSET_KEYS,
    createGame: createGame,
    log: log,
    snapshot: snapshot,
    getCompany: getCompany,
    ensureMonthlyRecord: ensureMonthlyRecord,
    markPreSettle: markPreSettle,
    checkRisks: checkRisks,
    resolveRescue: resolveRescue,
    settleCompanyChoice: settleCompanyChoice,
    settleRetrofit: settleRetrofit,
    settleGovernmentPolicy: settleGovernmentPolicy,
    qualifiedAssets: qualifiedAssets,
    finalizeZeroCarbon: finalizeZeroCarbon,
    settlePilotFunding: settlePilotFunding,
    rollDie: rollDie,
    settleDiceResults: settleDiceResults,
    settleAutoEvent: settleAutoEvent,
    computeFinal: computeFinal,
    undo: undo,
    serialize: serialize,
    deserialize: deserialize,
    publicSnapshot: publicSnapshot,
    fmtDelta: fmtDelta,
  };
});
