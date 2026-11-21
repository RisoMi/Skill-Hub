/* ------------------------------------------------------------
   highlight.js · 编辑器轻量语法高亮
   ------------------------------------------------------------
   纯原生实现，不引第三方依赖。按扩展名选语言，全文 token 扫描
   （规则可跨行匹配块注释 / 三引号字符串），输出片段一律 esc()，
   绝不把 SKILL 文件内容当 HTML 注入。

   用法：
     SH.hl.detect("a.json")  -> "json"
     SH.hl.label("json")     -> "JSON"
     SH.hl.render(text, lang)-> 高亮后的 HTML 字符串
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const esc = SH.util.esc;

  const LANGS = {
    markdown: { label: "Markdown", ext: ["md", "markdown", "mdx"] },
    json: { label: "JSON", ext: ["json", "jsonc", "geojson", "jsonl"] },
    yaml: { label: "YAML", ext: ["yaml", "yml"] },
    xml: { label: "XML / HTML", ext: ["xml", "html", "htm", "xhtml", "svg", "plist", "xsd", "xsl"] },
    js: { label: "JavaScript", ext: ["js", "jsx", "mjs", "cjs"] },
    ts: { label: "TypeScript", ext: ["ts", "tsx"] },
    python: { label: "Python", ext: ["py", "pyw"] },
    java: { label: "Java", ext: ["java"] },
    css: { label: "CSS", ext: ["css", "scss", "less"] },
    shell: { label: "Shell", ext: ["sh", "bash", "zsh", "fish"] },
    sql: { label: "SQL", ext: ["sql"] },
    ini: { label: "INI / TOML", ext: ["ini", "toml", "cfg", "conf", "properties"] },
    text: { label: "纯文本", ext: [] },
  };

  function detect(fileName) {
    const n = String(fileName || "").toLowerCase();
    const base = n.split("/").pop();
    if (/^(dockerfile|makefile|jenkinsfile)$/.test(base)) return "shell";
    if (/^\.(gitignore|gitattributes|env)/.test(base)) return "ini";
    const dot = base.lastIndexOf(".");
    if (dot < 0) return "text";
    const ext = base.slice(dot + 1);
    for (const id in LANGS) {
      if (LANGS[id].ext.indexOf(ext) >= 0) return id;
    }
    return "text";
  }

  function label(lang) {
    return (LANGS[lang] || LANGS.text).label;
  }

  /* ---------------- 各语言规则 ----------------
     规则顺序即同位置优先级；priority 显式提高可覆盖顺序。
     每条正则必须带 g（可加 m / i），匹配结果整段高亮。       */

  const R = {
    json: [
      { re: /"(?:\\.|[^"\\])*"(?=\s*:)/g, cls: "key", priority: 10 },
      { re: /"(?:\\.|[^"\\])*"/g, cls: "string" },
      { re: /\b(?:true|false|null)\b/g, cls: "bool", priority: 5 },
      { re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, cls: "num" },
      { re: /[{}[\],:]/g, cls: "punc" },
    ],

    yaml: [
      { re: /#[^\n]*/g, cls: "comment", priority: 8 },
      { re: /"(?:\\.|[^"\\])*"|'(?:''|[^'])*'/g, cls: "string", priority: 5 },
      { re: /[\w.-]+(?=\s*:)/g, cls: "key", priority: 6 },
      { re: /\b(?:true|false|null|yes|no|on|off)\b/gi, cls: "bool" },
      { re: /^---\s*$|^\.\.\.\s*$/gm, cls: "punc", priority: 7 },
      { re: /^\s*-\s+/gm, cls: "punc" },
      { re: /\b-?\d+(?:\.\d+)?\b/g, cls: "num" },
    ],

    xml: [
      { re: /<!--[\s\S]*?-->/g, cls: "comment", priority: 20 },
      { re: /<!\[CDATA\[[\s\S]*?\]\]>/g, cls: "string", priority: 20 },
      { re: /<\?[\s\S]*?\?>/g, cls: "comment", priority: 18 },
      { re: /<\/?[\w:.-]+|\/?>/g, cls: "tag", priority: 12 },
      { re: /[\w:.-]+(?=\s*=)/g, cls: "attr", priority: 8 },
      { re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, cls: "string", priority: 6 },
      { re: /&[\w#]+;/g, cls: "bool" },
    ],

    markdown: [
      { re: /^```[\s\S]*?^```/gm, cls: "code", priority: 30 },
      { re: /^#{1,6}\s+[^\n]*/gm, cls: "heading", priority: 15 },
      { re: /^>\s?[^\n]*/gm, cls: "quote", priority: 14 },
      { re: /^---\s*$/gm, cls: "punc", priority: 13 },
      { re: /`[^`\n]+`/g, cls: "code", priority: 12 },
      { re: /\[[^\]\n]+\]\([^)\n]+\)/g, cls: "link", priority: 11 },
      { re: /\*\*[^*\n]+\*\*|__[^_\n]+__/g, cls: "strong", priority: 10 },
      { re: /\*[^*\n]+\*|_[^_\n]+_/g, cls: "em", priority: 9 },
      { re: /^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, cls: "punc" },
    ],

    js: [
      { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, cls: "comment", priority: 20 },
      { re: /`(?:\\.|[^`\\])*`/g, cls: "string", priority: 12 },
      { re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, cls: "string", priority: 10 },
      { re: /\b(?:const|let|var|function|return|if|else|for|while|do|of|in|class|new|this|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|extends|super|static|switch|case|break|continue|null|undefined|true|false)\b/g, cls: "keyword", priority: 8 },
      { re: /\b-?\d+(?:\.\d+)?\b/g, cls: "num" },
      { re: /[A-Za-z_$][\w$]*(?=\s*\()/g, cls: "func" },
    ],

    ts: [
      { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, cls: "comment", priority: 20 },
      { re: /`(?:\\.|[^`\\])*`/g, cls: "string", priority: 12 },
      { re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, cls: "string", priority: 10 },
      { re: /\b(?:const|let|var|function|return|if|else|for|while|of|in|class|new|this|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|extends|super|static|switch|case|break|continue|null|undefined|true|false|interface|type|enum|implements|public|private|protected|readonly|as|is|keyof|infer|declare|namespace)\b/g, cls: "keyword", priority: 8 },
      { re: /\b-?\d+(?:\.\d+)?\b/g, cls: "num" },
      { re: /[A-Za-z_$][\w$]*(?=\s*\()/g, cls: "func" },
    ],

    python: [
      { re: /"""[\s\S]*?"""|'''[\s\S]*?'''/g, cls: "string", priority: 20 },
      { re: /#[^\n]*/g, cls: "comment", priority: 18 },
      { re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, cls: "string", priority: 10 },
      { re: /@[\w.]+/g, cls: "attr", priority: 9 },
      { re: /\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|yield|lambda|global|nonlocal|pass|break|continue|assert|del|is|None|True|False|async|await)\b/g, cls: "keyword", priority: 8 },
      { re: /\b-?\d+(?:\.\d+)?\b/g, cls: "num" },
      { re: /[A-Za-z_]\w*(?=\s*\()/g, cls: "func" },
    ],

    java: [
      { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, cls: "comment", priority: 20 },
      { re: /@[\w.]+/g, cls: "attr", priority: 9 },
      { re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, cls: "string", priority: 10 },
      { re: /\b(?:public|private|protected|class|interface|enum|extends|implements|static|final|abstract|void|return|if|else|for|while|new|this|super|import|package|try|catch|finally|throw|throws|switch|case|break|continue|null|true|false|int|long|double|float|boolean|char|byte|short)\b/g, cls: "keyword", priority: 8 },
      { re: /\b-?\d+[LlFfDd]?\b/g, cls: "num" },
      { re: /[A-Za-z_$][\w$]*(?=\s*\()/g, cls: "func" },
    ],

    css: [
      { re: /\/\*[\s\S]*?\*\//g, cls: "comment", priority: 20 },
      { re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, cls: "string", priority: 10 },
      { re: /#[0-9a-fA-F]{3,8}\b/g, cls: "num", priority: 9 },
      { re: /[-a-zA-Z]+(?=\s*:)/g, cls: "attr", priority: 8 },
      { re: /[.#@][-\w]+/g, cls: "tag", priority: 7 },
      { re: /\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/g, cls: "num" },
    ],

    shell: [
      { re: /#[^\n]*/g, cls: "comment", priority: 18 },
      { re: /"(?:\\.|[^"\\])*"|'(?:[^'])*'/g, cls: "string", priority: 10 },
      { re: /\$\{?\w+\}?|\$[?@#*!]/g, cls: "attr", priority: 9 },
      { re: /\b(?:if|then|else|elif|fi|for|in|do|done|while|case|esac|function|return|export|source|set|shift|local)\b/g, cls: "keyword", priority: 8 },
      { re: /^\s*[\w./-]+(?=\s)/gm, cls: "func" },
    ],

    sql: [
      { re: /--[^\n]*|\/\*[\s\S]*?\*\//g, cls: "comment", priority: 20 },
      { re: /'(?:''|[^'])*'/g, cls: "string", priority: 10 },
      { re: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|PRIMARY|KEY|FOREIGN|REFERENCES|DISTINCT|COUNT|SUM|AVG|MIN|MAX|UNION|ALL)\b/gi, cls: "keyword", priority: 8 },
      { re: /\b-?\d+(?:\.\d+)?\b/g, cls: "num" },
    ],

    ini: [
      { re: /[;#][^\n]*/g, cls: "comment", priority: 18 },
      { re: /"(?:\\.|[^"\\])*"|'(?:[^'])*'/g, cls: "string", priority: 10 },
      { re: /^\s*\[[^\]\n]+\]/gm, cls: "tag", priority: 9 },
      { re: /[\w.-]+(?=\s*=)/g, cls: "attr", priority: 8 },
      { re: /\b(?:true|false|yes|no)\b/gi, cls: "bool" },
      { re: /\b-?\d+(?:\.\d+)?\b/g, cls: "num" },
    ],
  };

  /** 在整段文本上按规则取「最靠前、同级最长」的 token */
  function tokenize(text, rules) {
    let out = "";
    let pos = 0;
    let guard = 0;
    const len = text.length;

    while (pos < len && guard++ < 200000) {
      let best = null;
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        rule.re.lastIndex = pos;
        const m = rule.re.exec(text);
        if (!m || m.index < pos) continue;
        const pri = rule.priority || 0;
        if (
          !best ||
          m.index < best.start ||
          (m.index === best.start &&
            (pri > best.pri || (pri === best.pri && m[0].length > best.text.length)))
        ) {
          best = { start: m.index, text: m[0], cls: rule.cls, pri };
        }
      }

      if (!best) {
        out += esc(text.slice(pos));
        break;
      }
      if (best.start > pos) out += esc(text.slice(pos, best.start));
      const cls = typeof best.cls === "function" ? best.cls(best.text) : best.cls;
      out += cls
        ? '<span class="hl-' + cls + '">' + esc(best.text) + "</span>"
        : esc(best.text);
      pos = best.start + best.text.length;
      if (best.text.length === 0) pos += 1;
    }

    if (pos < len) out += esc(text.slice(pos));
    return out;
  }

  /**
   * 渲染高亮 HTML。末尾补一个换行，保证高亮层与 textarea 行数一致。
   * 超大文件降级为纯转义文本，避免输入时卡顿。
   */
  function render(text, lang) {
    const src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    const rules = R[lang];
    if (!rules || src.length > 300000) return esc(src) + "\n";
    return tokenize(src, rules) + "\n";
  }

  SH.hl = {
    detect,
    label,
    render,
    languages: Object.keys(LANGS),
  };
})();
