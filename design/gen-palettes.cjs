/* ------------------------------------------------------------
   gen-palettes.cjs · 设计稿色值表 → 产品 palettes.css
   ------------------------------------------------------------
   色值唯一来源是 design/theme-proposal-v2.html 里的 `const T = {...}`，
   本脚本补齐产品需要、但设计稿色值表未列出的衍生变量
   （float / warn / scrim / 来源色 / 分类色 / 阴影 / 窗口底色等）。

   用法：node design/gen-palettes.cjs
   产出：assets/styles/palettes.css

   ⚠️ 不要用 heredoc / python -c 改写本文件：脚本内含大量 $ 与转义，
      经过 Bash 命令通道会被吃掉。直接 Write 落盘再执行。
   ------------------------------------------------------------ */
const fs = require("fs");
const path = require("path");

const DESIGN = path.join(__dirname, "theme-proposal-v2.html");
const OUT = path.join(__dirname, "..", "assets", "styles", "palettes.css");

/* ---------- 1. 从设计稿读取 T ---------- */
const html = fs.readFileSync(DESIGN, "utf8");
const marker = "const T = ";
const start = html.indexOf(marker);
if (start < 0) throw new Error("设计稿里找不到 const T");
const brace = html.indexOf("{", start);
const end = html.indexOf("\n};", brace);
if (brace < 0 || end < 0) throw new Error("设计稿里 T 的结尾找不到");
const T = new Function("return " + html.slice(brace, end + 2) + ";")();

// 与设计稿同一条兜底规则：未声明 signal / primary-bg 的方案补齐
Object.keys(T).forEach(function (k) {
  ["light", "dark"].forEach(function (m) {
    const t = T[k][m];
    if (!t.signal) t.signal = t.accent;
    if (!t["primary-bg"]) t["primary-bg"] = t.accent;
  });
});

/* ---------- 2. 产品 key 与显示名 ---------- */
const PALETTES = [
  { from: "current", key: "classic", name: "经典青绿 · 原配色" },
  { from: "indigo", key: "indigo", name: "提案 A · 靛蓝" },
  { from: "teal", key: "teal", name: "提案 B · 青绿提纯" },
  { from: "graphite", key: "graphite", name: "提案 C · 石墨极简" },
  { from: "aurora", key: "aurora", name: "提案 D · 柔雾紫" },
];

/* ---------- 3. 设计稿未列出、产品必须有的衍生变量 ---------- */
const SRC_CAT = {
  light: {
    "src-trae": "#c99996",
    "src-doubao": "#8fa3b8",
    "src-custom": "#b0afa8",
    "cat-code": "#a9c3bd",
    "cat-doc": "#c8b79a",
    "cat-data": "#a8b8c8",
    "cat-design": "#c4afb0",
    "cat-auto": "#b4c0a8",
    "cat-other": "#bdbcb6",
  },
  dark: {
    "src-trae": "#c79491",
    "src-doubao": "#8ea2b6",
    "src-custom": "#9b9a94",
    "cat-code": "#7f9e97",
    "cat-doc": "#a8967c",
    "cat-data": "#8595a4",
    "cat-design": "#a08b8c",
    "cat-auto": "#8f9c84",
    "cat-other": "#97968f",
  },
};

const DERIVED = {
  classic: {
    light: {
      "body-bg": "#eceae5",
      "warn-bg": "#f7ede2",
      "warn-text": "#a8795e",
      "on-danger": "#ffffff",
      "float-bg": "#232825",
      "float-text": "#ffffff",
      "float-muted": "#b9c4c0",
      "shadow-window": "0 16px 44px -8px rgba(26,31,29,.14)",
      "shadow-dialog": "0 24px 56px -12px rgba(20,26,23,.28)",
      "shadow-float": "0 8px 22px -4px rgba(20,26,23,.24)",
      scrim: "rgba(26,28,28,.42)",
    },
    dark: {
      "body-bg": "#131614",
      "warn-bg": "#3a2e24",
      "warn-text": "#d3a87f",
      "on-danger": "#241210",
      "float-bg": "#ecebe6",
      "float-text": "#1a1a1a",
      "float-muted": "#6c6f69",
      "shadow-window": "0 16px 44px -8px rgba(0,0,0,.5)",
      "shadow-dialog": "0 24px 56px -12px rgba(0,0,0,.62)",
      "shadow-float": "0 8px 22px -4px rgba(0,0,0,.5)",
      scrim: "rgba(8,10,9,.6)",
    },
  },
  indigo: {
    light: {
      "body-bg": "#e8ecf5",
      "warn-bg": "#fff4e5",
      "warn-text": "#a9712f",
      "on-danger": "#ffffff",
      "float-bg": "#1e2740",
      "float-text": "#ffffff",
      "float-muted": "#aab8d4",
      "shadow-window": "0 16px 44px -8px rgba(16,24,40,.15)",
      "shadow-dialog": "0 24px 56px -12px rgba(16,24,40,.28)",
      "shadow-float": "0 8px 22px -4px rgba(16,24,40,.24)",
      scrim: "rgba(18,22,32,.44)",
    },
    dark: {
      "body-bg": "#080c14",
      "warn-bg": "#3a2c1c",
      "warn-text": "#e0b074",
      "on-danger": "#1e1012",
      "float-bg": "#eef2fa",
      "float-text": "#101827",
      "float-muted": "#6b7891",
      "shadow-window": "0 16px 44px -8px rgba(0,0,0,.5)",
      "shadow-dialog": "0 24px 56px -12px rgba(0,0,0,.62)",
      "shadow-float": "0 8px 22px -4px rgba(0,0,0,.5)",
      scrim: "rgba(3,5,10,.66)",
    },
  },
  teal: {
    light: {
      "body-bg": "#e9eef1",
      "warn-bg": "#fdf1e3",
      "warn-text": "#a9712f",
      "on-danger": "#ffffff",
      "float-bg": "#122a2f",
      "float-text": "#ffffff",
      "float-muted": "#a8c6c9",
      "shadow-window": "0 16px 44px -8px rgba(12,38,42,.15)",
      "shadow-dialog": "0 24px 56px -12px rgba(12,38,42,.28)",
      "shadow-float": "0 8px 22px -4px rgba(12,38,42,.24)",
      scrim: "rgba(16,24,28,.44)",
    },
    dark: {
      "body-bg": "#070e11",
      "warn-bg": "#38291c",
      "warn-text": "#dfae79",
      "on-danger": "#1b100f",
      "float-bg": "#eaf4f4",
      "float-text": "#0f1d22",
      "float-muted": "#6d878a",
      "shadow-window": "0 16px 44px -8px rgba(0,0,0,.5)",
      "shadow-dialog": "0 24px 56px -12px rgba(0,0,0,.62)",
      "shadow-float": "0 8px 22px -4px rgba(0,0,0,.5)",
      scrim: "rgba(2,7,9,.66)",
    },
  },
  graphite: {
    light: {
      "body-bg": "#f0f0ee",
      "warn-bg": "#fdf1e3",
      "warn-text": "#9a5316",
      "on-danger": "#ffffff",
      "float-bg": "#1c1c1f",
      "float-text": "#ffffff",
      "float-muted": "#a9a9ad",
      "shadow-window": "0 16px 44px -8px rgba(16,17,20,.15)",
      "shadow-dialog": "0 24px 56px -12px rgba(16,17,20,.27)",
      "shadow-float": "0 8px 22px -4px rgba(16,17,20,.22)",
      scrim: "rgba(20,20,22,.44)",
    },
    dark: {
      "body-bg": "#060607",
      "warn-bg": "#33261a",
      "warn-text": "#f0b378",
      "on-danger": "#1c0e0d",
      "float-bg": "#f5f5f4",
      "float-text": "#16171a",
      "float-muted": "#75757a",
      "shadow-window": "0 16px 44px -8px rgba(0,0,0,.5)",
      "shadow-dialog": "0 24px 56px -12px rgba(0,0,0,.66)",
      "shadow-float": "0 8px 22px -4px rgba(0,0,0,.5)",
      scrim: "rgba(0,0,0,.68)",
    },
  },
  aurora: {
    light: {
      "body-bg": "#eeeefa",
      "warn-bg": "#fdf0e8",
      "warn-text": "#a9663a",
      "on-danger": "#ffffff",
      "float-bg": "#221f3c",
      "float-text": "#ffffff",
      "float-muted": "#b6b2d6",
      "shadow-window": "0 16px 44px -8px rgba(40,32,90,.16)",
      "shadow-dialog": "0 24px 56px -12px rgba(40,32,90,.3)",
      "shadow-float": "0 8px 22px -4px rgba(40,32,90,.26)",
      scrim: "rgba(24,20,42,.44)",
    },
    dark: {
      "body-bg": "#0b0b15",
      "warn-bg": "#34231c",
      "warn-text": "#e5b184",
      "on-danger": "#1c0e18",
      "float-bg": "#f2f1ff",
      "float-text": "#1b1a2e",
      "float-muted": "#7d7aa2",
      "shadow-window": "0 16px 44px -8px rgba(0,0,0,.5)",
      "shadow-dialog": "0 24px 56px -12px rgba(0,0,0,.64)",
      "shadow-float": "0 8px 22px -4px rgba(0,0,0,.5)",
      scrim: "rgba(5,4,12,.66)",
    },
  },
};

/* ---------- 4. 生成 ---------- */
const REQUIRED = [
  "bg", "surface", "text", "accent", "accent-bg", "accent-text",
  "on-accent", "accent-shadow", "signal", "primary-bg", "line",
  "line-strong", "danger", "danger-bg", "radius-btn", "radius-card",
  "radius-window", "shadow-card", "body-bg", "on-danger",
];

function buildVars(p, mode) {
  const t = Object.assign({}, T[p.from][mode]);
  const d = DERIVED[p.key][mode];

  // 来源标识色跟随各方案的强调色，避免在靛蓝 / 紫色主题里出现一串青绿点
  t["src-claude"] = t["src-claude"] || "#d4a574";
  t["src-codex"] = t["accent-bright"];
  t["src-workbuddy"] = t.accent;

  Object.assign(t, SRC_CAT[mode], d);
  t["icon-tint"] = mode === "light" ? "22%" : "34%";

  REQUIRED.forEach(function (k) {
    if (!t[k]) throw new Error("缺变量 " + p.key + "/" + mode + ": --" + k);
  });
  return t;
}

const ORDER = [
  "bg", "bg-list", "surface", "surface-2", "surface-3", "body-bg",
  "text", "text-2", "text-3", "text-4",
  "accent", "accent-bright", "accent-bg", "accent-soft-bg", "accent-text", "accent-text-2",
  "on-accent", "accent-shadow", "signal", "primary-bg",
  "line", "line-strong", "chip-bg", "chip-text", "icon-tint",
  "warn-bg", "warn-text", "danger", "danger-bg", "on-danger",
  "float-bg", "float-text", "float-muted",
  "shadow-card", "shadow-window", "shadow-dialog", "shadow-float", "scrim",
  "src-claude", "src-codex", "src-workbuddy", "src-trae", "src-doubao", "src-custom",
  "cat-code", "cat-doc", "cat-data", "cat-design", "cat-auto", "cat-other",
  "radius-btn", "radius-card", "radius-window",
];

const parts = [];
PALETTES.forEach(function (p) {
  ["light", "dark"].forEach(function (mode) {
    const vars = buildVars(p, mode);
    const seen = new Set();
    const lines = ORDER.map(function (k) {
      seen.add(k);
      return "  --" + k + ": " + vars[k] + ";";
    });
    Object.keys(vars).forEach(function (k) {
      if (!seen.has(k)) throw new Error("未纳入输出的变量 " + k);
    });
    const sel = mode === "light"
      ? 'html[data-palette="' + p.key + '"]'
      : 'html[data-palette="' + p.key + '"][data-theme="dark"]';
    parts.push("/* " + p.name + " · " + (mode === "light" ? "浅色" : "深色") + " */\n" + sel + " {\n" + lines.join("\n") + "\n}");
  });
});

const header = [
  "/* ============================================================",
  "   Skill Hub · 配色方案（5 套 × 浅 / 深）",
  "   ------------------------------------------------------------",
  "   由 design/gen-palettes.cjs 生成，色值取自 design/theme-proposal-v2.html。",
  "   请勿手工编辑本文件；改色请改设计稿后重新运行生成脚本。",
  "",
  "   html[data-palette]        → 浅色（默认）",
  "   html[data-palette][data-theme=\"dark\"] → 深色（更高优先级）",
  "   data-theme 仍由「浅色 / 深色 / 跟随系统」独立控制。",
  "   ============================================================ */",
  "",
].join("\n");

fs.writeFileSync(OUT, header + parts.join("\n\n") + "\n", "utf8");
console.log("palettes.css 已生成：" + PALETTES.length * 2 + " 组变量，每组 " + ORDER.length + " 个");
PALETTES.forEach(function (p) {
  console.log("  " + p.key.padEnd(10) + " ← 设计稿 " + p.from);
});
