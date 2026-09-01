/* ============================================================
   《绿神话》公共 UI 工具：hash 路由、DOM 辅助、toast、模态框
   ============================================================ */

(function (root) {
  "use strict";

  const UI = {};

  /* ---------- DOM 辅助 ---------- */
  // children 支持三种形态：第 3 参数（节点/字符串/数组），以及第 3 参数之后的任意多个变长子节点
  // （大量调用点写作 U.el("tr", {}, child1, child2, ...)——早期实现只取第 3 参数，后续子节点被静默丢弃）
  UI.el = function (tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "disabled" || k === "checked" || k === "selected" || k === "readOnly" || k === "multiple") {
          // 布尔属性：仅 true 时设置，false 必须移除（setAttribute("disabled","false") 仍会禁用）
          if (attrs[k]) node.setAttribute(k, ""); else node.removeAttribute(k);
        }
        else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2), attrs[k]);
        } else node.setAttribute(k, attrs[k]);
      }
    }
    const rest = Array.prototype.slice.call(arguments, 2);
    const kids = rest.length === 1 && Array.isArray(rest[0]) ? rest[0] : rest;
    kids.forEach(function (ch) {
      if (ch == null) return;
      // 嵌套数组（以及 null 占位后的稀疏内容）展平处理
      if (Array.isArray(ch)) {
        ch.forEach(function (g) {
          if (g != null) node.appendChild(typeof g === "string" ? document.createTextNode(g) : g);
        });
        return;
      }
      node.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch);
    });
    return node;
  };

  UI.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); };

  UI.fmtDelta = function (n) { return n > 0 ? "+" + n : String(n); };

  UI.deltaSpan = function (n) {
    return UI.el("span", { class: n > 0 ? "delta-pos" : n < 0 ? "delta-neg" : "delta-zero", text: UI.fmtDelta(n) });
  };

  /* ---------- Toast ---------- */
  let toastRoot = null;
  UI.toast = function (text, type) {
    if (!toastRoot) {
      toastRoot = UI.el("div", { id: "toast-root" });
      document.body.appendChild(toastRoot);
    }
    const t = UI.el("div", { class: "toast " + (type || ""), text });
    toastRoot.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  };

  /* ---------- 模态框 ---------- */
  UI.modal = function (opts) {
    const backdrop = UI.el("div", { class: "modal-backdrop" });
    const box = UI.el("div", { class: "modal " + (opts.tone || "") });
    if (opts.title) box.appendChild(UI.el("h3", { text: opts.title }));
    if (opts.body) box.appendChild(opts.body);
    const actions = UI.el("div", { class: "modal-actions", style: "display:flex;gap:10px;justify-content:flex-end;margin-top:16px" });
    (opts.buttons || [{ label: "关闭" }]).forEach(function (b) {
      actions.appendChild(UI.el("button", {
        class: b.tone || "btn-ghost",
        text: b.label,
        onclick: function () {
          let keep = false;
          if (b.onClick) keep = b.onClick() === false;
          if (!keep && b.closes !== false && backdrop.parentNode) document.body.removeChild(backdrop);
        },
      }));
    });
    box.appendChild(actions);
    backdrop.appendChild(box);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop && opts.dismissable !== false && backdrop.parentNode) document.body.removeChild(backdrop);
    });
    document.body.appendChild(backdrop);
    return backdrop;
  };

  UI.confirm = function (title, body, onOk) {
    UI.modal({
      title: title,
      body: typeof body === "string" ? UI.el("p", { text: body }) : body,
      buttons: [
        { label: "取消" },
        { label: "确认", tone: "btn-danger", onClick: onOk },
      ],
    });
  };

  /* ---------- hash 路由 ---------- */
  UI.parseHash = function () {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, query] = h.split("?");
    const params = {};
    if (query) {
      query.split("&").forEach(function (kv) {
        const [k, v] = kv.split("=");
        params[k] = decodeURIComponent(v || "");
      });
    }
    return { path: path || "control", params: params };
  };

  UI.onRoute = function (fn) {
    window.addEventListener("hashchange", fn);
    fn();
  };

  /* ---------- localStorage 安全访问 ---------- */
  UI.storage = {
    get: function (key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, val) {
      try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
    },
  };

  /* ---------- 60 秒倒计时 ---------- */
  UI.CountdownTimer = function (seconds, onTick, onEnd) {
    this.total = seconds || 60;
    this.left = this.total;
    this.onTick = onTick || function () {};
    this.onEnd = onEnd || function () {};
    this.running = false;
    this._iv = null;
  };
  UI.CountdownTimer.prototype = {
    start: function () {
      const self = this;
      if (this.running) return;
      this.running = true;
      this._iv = setInterval(function () {
        self.left--;
        self.onTick(self.left);
        if (self.left <= 0) { self.stop(); self.onEnd(); }
      }, 1000);
      this.onTick(this.left);
    },
    pause: function () { this.running = false; clearInterval(this._iv); },
    resume: function () { if (!this.running && this.left > 0) this.start(); },
    reset: function (seconds) { this.pause(); this.total = seconds || this.total; this.left = this.total; this.onTick(this.left); },
    stop: function () { this.pause(); },
  };

  UI.mmss = function (s) {
    const m = Math.floor(Math.max(0, s) / 60), ss = Math.max(0, s) % 60;
    return String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
  };

  root.GreenUI = UI;
})(typeof self !== "undefined" ? self : this);
