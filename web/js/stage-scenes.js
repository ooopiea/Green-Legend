/* ============================================================
   《绿神话》月份主题色（观战页联动用）
   剧场式场景库（SVG SCENES/PARTS/ICON）已随舞台页幻灯片化
   迁移（stage-slides.js）退役，仅保留观战页依赖的 MONTH_TINT，
   全局名 GreenScenes 不变。
   ============================================================ */

(function (root) {
  "use strict";

  /* ---------- 月份主题色（观战页联动）---------- */
  const MONTH_TINT = {
    1: "#e8bd3f", 2: "#d4a017", 3: "#58c9a9", 4: "#ff7b6b", 5: "#e8bd3f",
    6: "#d4a017", 7: "#58c9a9", 8: "#3a9c9c", 9: "#6a8fae", 10: "#c08a3e",
    11: "#2f9d81", 12: "#8a9490", final: "#d4a017",
  };

  root.GreenScenes = { MONTH_TINT: MONTH_TINT };
})(typeof self !== "undefined" ? self : this);
