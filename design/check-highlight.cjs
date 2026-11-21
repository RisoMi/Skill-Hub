const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

global.window = global;
global.SH = {
  util: {
    esc: (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;"),
  },
};
require(path.join(ROOT, "src/core/highlight.js"));
const hl = SH.hl;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("PASS · " + name); }
  else { fail++; console.log("FAIL · " + name); }
}

const detects = {
  "SKILL.md": "markdown", "notes.markdown": "markdown",
  "_user_meta.json": "json", "data.geojson": "json",
  "config.yaml": "yaml", ".env": "ini", "Dockerfile": "shell",
  "index.html": "xml", "icon.svg": "xml",
  "app.js": "js", "app.tsx": "ts", "main.py": "python",
  "Main.java": "java", "theme.css": "css", "run.sh": "shell",
  "q.sql": "sql", "a.toml": "ini", "readme.txt": "text",
};
Object.keys(detects).forEach((f) => ok("detect " + f, hl.detect(f) === detects[f]));

const samples = {
  json: '{"name": "demo", "ok": true, "n": 12}',
  yaml: '# note\nname: demo\nitems:\n  - one\n  - two',
  xml: '<?xml version="1.0"?>\n<root id="x"><!-- c --><a v="1"/></root>',
  markdown: '# Title\n\n**bold** and `code`\n\n- item\n\n[link](https://x.com)',
  js: 'const x = 1; // hi\nfunction go() { return true; }',
  ts: 'interface A { x: number }\nconst v: A = { x: 1 };',
  python: '# hi\nclass A:\n    def go(self):\n        return "x"',
  java: 'public class A { public static void main(String[] a) {} }',
  css: 'body { color: #fff; margin: 0; }',
  shell: '#!/bin/bash\nif [ -f x ]; then echo "$HOME"; fi',
  sql: 'SELECT id, name FROM t WHERE x = 1;',
  ini: '[section]\nkey = "value"\nflag = true',
};
Object.keys(samples).forEach((lang) => {
  const html = hl.render(samples[lang], lang);
  const spans = (html.match(/<span class="hl-/g) || []).length;
  ok("render " + lang + " 有 token (" + spans + ")", spans >= 2);
  ok("render " + lang + " 无未转义尖括号", !/<(?!span|\/span)/.test(html));
});

const evil = '<script>alert("x")</script> & \'q\'';
const safe = hl.render(evil, "text");
ok("XSS 转义：无 <script>", safe.indexOf("<script>") < 0);
ok("XSS 转义：含 &lt;script&gt;", safe.indexOf("&lt;script&gt;") >= 0);
ok("XSS 转义：含 &amp;", safe.indexOf("&amp;") >= 0);

const jsonHtml = hl.render(samples.json, "json");
ok("JSON key 高亮", jsonHtml.indexOf('hl-key">&quot;name&quot;') >= 0);
ok("JSON 字符串高亮", jsonHtml.indexOf('hl-string">&quot;demo&quot;') >= 0);
ok("JSON bool 高亮", jsonHtml.indexOf('hl-bool">true') >= 0);
ok("JSON 数字高亮", jsonHtml.indexOf('hl-num">12') >= 0);

const xmlHtml = hl.render(samples.xml, "xml");
ok("XML 标签高亮", xmlHtml.indexOf('hl-tag">') >= 0);
ok("XML 属性高亮", xmlHtml.indexOf('hl-attr">') >= 0);
ok("XML 注释高亮", xmlHtml.indexOf('hl-comment">') >= 0);

const mdHtml = hl.render(samples.markdown, "markdown");
ok("MD 标题高亮", mdHtml.indexOf('hl-heading"># Title') >= 0);
ok("MD 粗体高亮", mdHtml.indexOf('hl-strong">**bold**') >= 0);
ok("MD 行内代码高亮", mdHtml.indexOf('hl-code">`code`') >= 0);

ok("末尾补换行", hl.render("x", "text").endsWith("x\n"));
ok("大文件降级不卡", (() => {
  const big = "a".repeat(310000);
  const t = Date.now();
  const out = hl.render(big, "js");
  return out.indexOf("<span") < 0 && Date.now() - t < 1500;
})());

console.log("\n结果：" + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
