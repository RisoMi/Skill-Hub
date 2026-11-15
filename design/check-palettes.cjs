/* 静态验收：语法 / 配色键一致性 / 变量定义完整性 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0;
function ok(label, cond, extra) {
  if (!cond) throw new Error("FAIL · " + label + (extra ? " · " + extra : ""));
  pass++;
  console.log("PASS · " + label + (extra ? " · " + extra : ""));
}

/* 1. 所有前端 JS 语法 */
const jsFiles = [];
function walk(dir) {
  fs.readdirSync(path.join(ROOT, dir)).forEach(function (f) {
    const rel = dir + "/" + f;
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) return walk(rel);
    if (f.endsWith(".js")) jsFiles.push(rel);
  });
}
walk("src");
jsFiles.forEach(function (f) { new Function(read(f)); });
ok("前端 JS 全部通过语法检查", true, jsFiles.length + " 个文件");

/* 2. 配色键：JS 清单 ↔ CSS 选择器 ↔ HTML 初始值 */
const palettesJs = read("src/core/palettes.js");
const keys = Array.from(palettesJs.matchAll(/key:\s*"([a-z]+)"/g), (m) => m[1]);
const css = read("assets/styles/palettes.css");
ok("palettes.js 有 5 套配色", keys.length === 5, keys.join(", "));
keys.forEach(function (k) {
  const light = 'html[data-palette="' + k + '"] {';
  const dark = 'html[data-palette="' + k + '"][data-theme="dark"] {';
  ok("CSS 浅色块 " + k, css.indexOf(light) >= 0);
  ok("CSS 深色块 " + k, css.indexOf(dark) >= 0);
});
ok("index.html 初始 data-palette", read("index.html").indexOf('data-palette="classic"') >= 0);
ok("index.html 引入 palettes.css", read("index.html").indexOf("assets/styles/palettes.css") >= 0);
ok("index.html 引入 palettes.js", read("index.html").indexOf("src/core/palettes.js") >= 0);

/* 3. 每块变量数量与必需变量 */
const blocks = css.split(/(?=\/\* [^\n]+ · (?:浅色|深色) \*\/)/).filter((b) => b.indexOf("{") >= 0);
const REQUIRED = ["--on-accent", "--accent-shadow", "--signal", "--primary-bg", "--body-bg", "--on-danger", "--radius-card", "--shadow-card"];
const counts = [];
blocks.forEach(function (b) {
  const n = (b.match(/^\s+--[a-z0-9-]+:/gm) || []).length;
  counts.push(n);
  REQUIRED.forEach(function (v) {
    if (b.indexOf(v + ":") < 0) throw new Error("某个配色块缺 " + v + "\n" + b.slice(0, 120));
  });
});
ok("配色块数量", blocks.length === 10, blocks.length + " 块");
ok("每块变量数一致", counts.every((n) => n === 53), counts.join("/"));

/* 4. CSS 里引用的变量都有定义（允许 JS 动态注入的少数几个） */
const defined = new Set();
["assets/styles/tokens.css", "assets/styles/palettes.css"].forEach(function (f) {
  Array.from(read(f).matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]).forEach((v) => defined.add(v));
});
const DYNAMIC = new Set(["--mark-color", "--card-pad", "--swatch", "--color", "--x", "--y", "--w", "--h", "--ratio"]);
const used = new Set();
fs.readdirSync(path.join(ROOT, "assets/styles")).forEach(function (f) {
  if (!f.endsWith(".css")) return;
  Array.from(read("assets/styles/" + f).matchAll(/var\(\s*(--[a-z0-9-]+)/g), (m) => m[1]).forEach((v) => used.add(v));
});
const missing = Array.from(used).filter((v) => !defined.has(v) && !DYNAMIC.has(v));
ok("所有 CSS 变量都有定义", missing.length === 0, missing.length ? "缺: " + missing.join(", ") : used.size + " 个引用全部有定义");

/* 5. 入口与处理器 */
const app = read("src/app.js");
const store = read("src/core/store.js");
const dialogs = read("src/ui/dialogs.js");
ok("applyPrefs 写入 data-palette", app.indexOf("root.dataset.palette = SH.palettes.normalize") >= 0);
ok("外观按钮已绑定", app.indexOf("$(\"appearanceBtn\").addEventListener") >= 0);
ok("prefs 默认值含 palette", store.indexOf("palette: SH.palettes.default") >= 0);
ok("setPref 校验 palette", store.indexOf('if (key === "palette")') >= 0);
ok("外观弹窗已导出", dialogs.indexOf("openAppearance,") >= 0);
ok("切换处理器局部更新", dialogs.indexOf("if (appearanceHandler(event)) return;") >= 0);
ok(
  "旧整窗重绘 theme 分支已移除",
  dialogs.indexOf('if (act === "theme") {\n        store.setPref("theme", el.dataset.value);') < 0
);
const handlerBody = dialogs.slice(
  dialogs.indexOf("function appearanceHandler"),
  dialogs.indexOf("function openAppearance")
);
ok(
  "外观切换不重绘弹窗，只局部改 class",
  handlerBody.indexOf("refresh(") < 0 &&
    handlerBody.indexOf('classList.toggle("is-active", on)') >= 0
);

console.log("\n静态验收通过：" + pass + " 项");
