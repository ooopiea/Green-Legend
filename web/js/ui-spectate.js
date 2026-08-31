/* ============================================================
   《绿神话》观战页（#/spectate?s=<base64url>）
   学生用手机扫码打开：解析 URL 中的最小化公开快照，
   渲染月份 / 事件 / 三企业牌 / 政府财政。
   揭示前不显示任何企业的选择内容（只显示是否已提交）。
   数据是一次性快照——需主持人重新生成二维码才能更新。
   ============================================================ */

(function (root) {
  "use strict";

  const E = root.GreenEngine, EV = root.GreenEvents, U = root.GreenUI;

  const ControlSpectate = {};

  ControlSpectate.mount = function (app, params) {
    U.clear(app);
    const pub = parseSnapshot(params && params.s);

    if (!pub) {
      app.appendChild(U.el("div", { class: "spec-empty" },
        U.el("h2", { text: "《绿神话》观战" }),
        U.el("p", { text: "链接无效或已损坏。\n请向主持人索取最新的观战二维码。" })));
      return;
    }

    const wrap = U.el("div", { class: "spec-wrap" });

    // 月份标题：观战页本地查表（URL 不编码文字，节省容量）
    const monthDef = EV.MONTHS.find(function (m) { return m.month === pub.m; });

    // 页眉：月份 + 月份标题 + 揭示状态
    wrap.appendChild(U.el("div", { class: "spec-header" },
      U.el("span", { class: "spec-month", text: pub.m + " 月" }),
      U.el("span", { class: "spec-title", text: monthDef ? monthDef.title : "" }),
      U.el("span", { class: "spec-reveal-badge" + (pub.rv ? "" : " hidden"),
        text: pub.rv ? "已揭示" : "讨论中" })));

    // 事件卡（当前步骤标题由月份数字 + 通用说明代替——具体步骤标题属于动态状态，不在快照里）
    wrap.appendChild(U.el("div", { class: "spec-event" },
      U.el("h2", { text: monthDef ? monthDef.title : "游戏进行中" }),
      pub.rv ? U.el("p", { class: "note", text: "本阶段选择已统一揭示，见各企业卡片。" })
             : U.el("p", { class: "note", text: "讨论进行中——选择保密，等待统一揭示。" })));

    // 领先企业与危险判定
    let best = -Infinity;
    pub.cs.forEach(function (c) {
      const t = c[1] + c[2];
      if (t > best) best = t;
    });

    // 企业卡
    pub.cs.forEach(function (c) {
      wrap.appendChild(buildCompany(c, best, !!pub.rv));
    });

    // 政府财政条
    wrap.appendChild(buildGov(pub.gf));

    wrap.appendChild(U.el("p", { class: "spec-footer",
      text: "数据为生成二维码时刻的快照 · 主持人更新后需重新扫码" }));

    app.appendChild(wrap);
  };

  /* ---------- 解析 base64url 快照（数组形态）----------
     mini = [月, 已揭示, 财政, [企业[名, 经, 生, 资产CSV, 已提交, 选择], ...]] */
  function parseSnapshot(s) {
    if (!s) return null;
    try {
      const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(escape(root.atob(b64)));
      const mini = JSON.parse(json);
      // 基本结构校验：数组、月份数字、企业数组
      if (!Array.isArray(mini) || typeof mini[0] !== "number" || !Array.isArray(mini[3])) return null;
      return { m: mini[0], rv: mini[1], gf: mini[2], cs: mini[3] };
    } catch (e) {
      return null;
    }
  }

  /* ---------- 企业卡 ---------- */
  function buildCompany(c, best, revealed) {
    const name = c[0], econ = c[1], eco = c[2];
    const assetsCsv = c[3] || "", submitted = !!c[4], choiceText = c[5] || "";
    const danger = econ <= 20 || eco <= 20;
    const leader = (econ + eco) === best;

    const card = U.el("div", { class: "spec-company" + (danger ? " danger" : leader ? " leader" : "") });
    card.appendChild(U.el("div", { class: "row1" },
      U.el("h3", { text: name }),
      leader ? U.el("span", { class: "crown", text: "👑 领先" }) : null));

    const vals = U.el("div", { class: "vals" });
    vals.appendChild(valBlock("经济", econ, "econ"));
    vals.appendChild(valBlock("生态", eco, "eco"));
    card.appendChild(vals);

    if (assetsCsv) {
      const owned = assetsCsv.split(",").filter(Boolean);
      const assets = U.el("div", { class: "assets" });
      E.ASSET_KEYS.forEach(function (k) {
        const meta = EV.ASSET_META[k];
        assets.appendChild(U.el("span", { class: "spec-asset" + (owned.indexOf(k) >= 0 ? " on" : ""),
          text: meta.icon + meta.name }));
      });
      card.appendChild(assets);
    }

    if (choiceText) {
      card.appendChild(U.el("div", { class: "choice", text: "选择：" + choiceText }));
    } else if (revealed) {
      card.appendChild(U.el("div", { class: "choice", text: "（未提交）" }));
    } else {
      card.appendChild(U.el("div", { class: "choice pending-sub",
        text: submitted ? "已提交 ✅" : "讨论中 …" }));
    }
    return card;
  }

  function valBlock(lab, v, cls) {
    return U.el("div", { class: "v" },
      U.el("span", { class: "lab", text: lab }),
      U.el("span", { class: "num " + cls + (v <= 20 ? " warn" : ""), text: String(v) }));
  }

  /* ---------- 政府财政 ---------- */
  function buildGov(finance) {
    const pct = Math.max(0, Math.min(100, finance));
    const danger = finance < 30;
    return U.el("div", { class: "spec-gov" },
      U.el("span", { class: "lab", text: "政府财政" }),
      U.el("div", { class: "bar" },
        U.el("div", { class: "bar-fill" + (danger ? " danger" : ""), style: "width:" + pct + "%" })),
      U.el("span", { class: "num" + (danger ? " danger" : ""), text: String(finance) }));
  }

  root.ControlSpectate = ControlSpectate;
})(typeof self !== "undefined" ? self : this);
