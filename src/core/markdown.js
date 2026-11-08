/* ------------------------------------------------------------
   markdown.js · 轻量 Markdown 渲染
   只覆盖 SKILL.md 常见的语法子集；先整体转义再做语法替换，
   避免直接把文件内容当 HTML 注入。
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc, safeHref } = SH.util;

  const RE = {
    h1: /^#\s+(.*)$/,
    h2: /^##\s+(.*)$/,
    h3: /^###\s+(.*)$/,
    h4: /^####\s+(.*)$/,
    ul: /^[-*+]\s+(.*)$/,
    ol: /^(\d+)[.)]\s+(.*)$/,
    quote: /^>\s?(.*)$/,
    hr: /^(-{3,}|\*{3,}|_{3,})$/,
    tableRow: /^\|(.+)\|$/,
    tableSep: /^\|[\s:|-]+\|$/,
  };

  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
        const href = safeHref(url.replace(/&amp;/g, "&"));
        return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      });
  }

  function splitFrontmatter(raw) {
    const text = String(raw || "").replace(/\r\n/g, "\n");
    if (!text.startsWith("---")) return { frontmatter: null, body: text };
    const end = text.indexOf("\n---", 3);
    if (end === -1) return { frontmatter: null, body: text };
    const rawFm = text.slice(3, end).replace(/^\n/, "");
    const body = text.slice(end + 4).replace(/^\n+/, "");
    const pairs = [];
    rawFm.split("\n").forEach((line) => {
      if (!line.trim() || /^\s*#/.test(line)) return;
      const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (m) pairs.push([m[1], m[2].replace(/^["']|["']$/g, "")]);
    });
    return { frontmatter: { raw: rawFm, pairs }, body };
  }

  function renderTable(lines) {
    const rows = lines.map((line) =>
      line
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
    );
    const head = rows[0];
    const body = rows.slice(1);
    const th = head.map((c) => `<th>${inline(c)}</th>`).join("");
    const tb = body
      .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
  }

  function render(raw) {
    const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i];

      // 代码块
      if (/^```/.test(rawLine)) {
        const lang = rawLine.replace(/^```/, "").trim();
        const buf = [];
        i += 1;
        while (i < lines.length && !/^```/.test(lines[i])) {
          buf.push(lines[i]);
          i += 1;
        }
        i += 1; // 跳过结束围栏
        out.push(
          `<pre><code data-lang="${esc(lang)}">${esc(buf.join("\n"))}</code></pre>`
        );
        continue;
      }

      if (!rawLine.trim()) {
        i += 1;
        continue;
      }

      if (RE.hr.test(rawLine.trim())) {
        out.push("<hr>");
        i += 1;
        continue;
      }

      const h4 = rawLine.match(RE.h4);
      const h3 = rawLine.match(RE.h3);
      const h2 = rawLine.match(RE.h2);
      const h1 = rawLine.match(RE.h1);
      if (h4) {
        out.push(`<h3>${inline(esc(h4[1]))}</h3>`);
        i += 1;
        continue;
      }
      if (h3) {
        out.push(`<h3>${inline(esc(h3[1]))}</h3>`);
        i += 1;
        continue;
      }
      if (h2) {
        out.push(`<h2>${inline(esc(h2[1]))}</h2>`);
        i += 1;
        continue;
      }
      if (h1) {
        out.push(`<h1>${inline(esc(h1[1]))}</h1>`);
        i += 1;
        continue;
      }

      // 表格
      if (RE.tableRow.test(rawLine.trim()) && i + 1 < lines.length && RE.tableSep.test(lines[i + 1].trim())) {
        const buf = [rawLine.trim()];
        i += 2;
        while (i < lines.length && RE.tableRow.test(lines[i].trim())) {
          buf.push(lines[i].trim());
          i += 1;
        }
        out.push(renderTable(buf));
        continue;
      }

      // 引用
      if (RE.quote.test(rawLine)) {
        const buf = [];
        while (i < lines.length && RE.quote.test(lines[i])) {
          buf.push(lines[i].match(RE.quote)[1]);
          i += 1;
        }
        out.push(`<blockquote>${inline(esc(buf.join(" ")))}</blockquote>`);
        continue;
      }

      // 无序列表
      if (RE.ul.test(rawLine)) {
        const items = [];
        while (i < lines.length && RE.ul.test(lines[i])) {
          items.push(lines[i].match(RE.ul)[1]);
          i += 1;
        }
        out.push(`<ul>${items.map((t) => `<li>${inline(esc(t))}</li>`).join("")}</ul>`);
        continue;
      }

      // 有序列表
      if (RE.ol.test(rawLine)) {
        const items = [];
        while (i < lines.length && RE.ol.test(lines[i])) {
          items.push(lines[i].match(RE.ol)[2]);
          i += 1;
        }
        out.push(`<ol>${items.map((t) => `<li>${inline(esc(t))}</li>`).join("")}</ol>`);
        continue;
      }

      // 段落（连续非空行合并）
      const buf = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !RE.h1.test(lines[i]) &&
        !RE.h2.test(lines[i]) &&
        !RE.h3.test(lines[i]) &&
        !RE.h4.test(lines[i]) &&
        !RE.ul.test(lines[i]) &&
        !RE.ol.test(lines[i]) &&
        !RE.quote.test(lines[i]) &&
        !RE.hr.test(lines[i].trim()) &&
        !/^```/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i += 1;
      }
      if (buf.length) out.push(`<p>${inline(esc(buf.join(" ")))}</p>`);
      else i += 1;
    }

    return out.join("\n");
  }

  function renderFrontmatter(fm) {
    if (!fm) return "";
    const rows = fm.pairs
      .map(([key, value]) => {
        const idx = String(value).indexOf(":");
        return `<div class="fm-line"><span class="fm-key">${esc(key)}:</span> ${esc(value)}</div>`;
      })
      .join("");
    return [
      '<div class="fm-block">',
      '<div class="fm-block__label">SKILL.md · frontmatter</div>',
      '<div class="fm-line fm-line--mark">---</div>',
      rows,
      '<div class="fm-line fm-line--mark">---</div>',
      "</div>",
    ].join("");
  }

  SH.md = { render, splitFrontmatter, renderFrontmatter, inline };
})();
