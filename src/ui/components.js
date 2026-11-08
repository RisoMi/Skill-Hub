/* ------------------------------------------------------------
   components.js · 可复用的渲染片段
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc, fmtRelative, fmtBytes } = SH.util;
  const I = SH.icons;

  function sourceColorVar(sourceId) {
    return SH.store.sourceColor(sourceId);
  }

  function categoryColorVar(categoryId) {
    return SH.store.categoryColor(categoryId);
  }

  function iconPlate(categoryId, size = 34, iconSize = 18) {
    const color = categoryColorVar(categoryId);
    return `<span class="card__icon" style="width:${size}px;height:${size}px;flex-basis:${size}px;background:color-mix(in srgb, ${color} var(--icon-tint, 22%), var(--surface));color:${color}">${I.category(
      categoryId,
      iconSize
    )}</span>`;
  }

  function checkIcon() {
    return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.4 2.4 4.6-4.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function starIcon(filled) {
    return `<span class="card__fav" title="已收藏">${I.svg(filled ? "starFill" : "star", 12)}</span>`;
  }

  /* ---------------- 多 Agent 安装点 ---------------- */
  function shortName(name) {
    const known = {
      "Claude Code": "CC",
      Codex: "CX",
      WorkBuddy: "WB",
      Trae: "TR",
      豆包工作: "豆",
      自定义目录: "自",
    };
    if (known[name]) return known[name];
    const ascii = String(name).replace(/[^A-Za-z]/g, "");
    if (ascii.length >= 2) return ascii.slice(0, 2).toUpperCase();
    return String(name).slice(0, 1);
  }

  function installDots(status, size = "md") {
    const dots = status
      .map((item) => {
        const color = SH.store.sourceColor(item.source);
        const cls = [
          "install-dot",
          `install-dot--${size}`,
          item.installed ? "is-on" : "",
          item.readonly ? "is-locked" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const style = item.installed
          ? `background:${color};border-color:${color};color:#fff`
          : "";
        const state = item.installed
          ? item.sameContent
            ? "已安装"
            : "已安装（内容与当前源有差异）"
          : item.readonly
          ? "只读目录，不可安装"
          : "未安装";
        return `<span class="${cls}" style="${style}" title="${esc(
          `${item.source.name} · ${state}`
        )}">${esc(shortName(item.source.name))}</span>`;
      })
      .join("");
    return `<span class="install-dots">${dots}</span>`;
  }

  function installCounts(status) {
    return {
      installed: status.filter((s) => s.installed).length,
      total: status.length,
    };
  }

  /* ---------------- 卡片 ---------------- */
  function cardHtml(skill, { active, checked }) {
    const src = SH.store.sourceName(skill.sourceId);
    const cat = SH.store.categoryName(skill.categoryId);
    const display = SH.store.displayName(skill);
    const isAlias = display !== skill.name;
    const sub = isAlias ? `${skill.name} · ${src}` : `${src} · SKILL.md`;
    const status = SH.store.installStatus(skill);
    const counts = installCounts(status);
    const drifted = status.filter((s) => s.installed && !s.sameContent).length;
    return `
      <article class="card ${checked ? "is-selected" : ""} ${active ? "is-active" : ""}"
               data-id="${esc(skill.id)}" data-action="open" tabindex="0" role="button"
               aria-pressed="${checked ? "true" : "false"}" aria-label="${esc(skill.name)}">
        <div class="card__top">
          ${iconPlate(skill.categoryId)}
          <div class="card__col">
            <span class="card__name" title="${esc(display)}">${esc(display)}</span>
            <span class="card__src" title="${esc(sub)}">${esc(sub)}</span>
          </div>
          <div class="card__actions">
            <button class="card__edit" data-action="edit-skill" data-id="${esc(skill.id)}"
                    aria-label="编辑 ${esc(skill.name)}" title="编辑技能">${I.svg("pencil", 12)}</button>
            <button class="card__check" data-action="check" data-id="${esc(skill.id)}"
                    aria-label="选择 ${esc(skill.name)}" title="选择">${checkIcon()}</button>
          </div>
        </div>
        <p class="card__desc">${esc(skill.description)}</p>
        <div class="card__bottom">
          <span class="tag">${esc(cat)}</span>
          ${skill.favorite ? starIcon(true) : ""}
          <span class="card__meta">${esc(skill.version)} · ${esc(fmtRelative(skill.updatedAt))}</span>
        </div>
        <div class="card__installs">
          ${installDots(status, "md")}
          <span class="card__install-count ${drifted ? "is-drift" : ""}">${
      counts.installed
    }/${counts.total} 个 Agent${drifted ? " · 有差异" : ""}</span>
        </div>
      </article>`;
  }

  /* ---------------- 列表行 ---------------- */
  function rowHtml(skill, { active, checked }) {
    const src = SH.store.sourceName(skill.sourceId);
    const rowColor = categoryColorVar(skill.categoryId);
    const display = SH.store.displayName(skill);
    const isAlias = display !== skill.name;
    const status = SH.store.installStatus(skill);
    const counts = installCounts(status);
    return `
      <div class="skill-row ${checked ? "is-selected" : ""} ${active ? "is-active" : ""}"
           data-id="${esc(skill.id)}" data-action="open" tabindex="0" role="button">
        <span class="skill-row__icon" style="color:${rowColor};background:color-mix(in srgb, ${rowColor} var(--icon-tint, 22%), var(--surface))">${I.category(
      skill.categoryId,
      15
    )}</span>
        <div class="skill-row__main">
          <span class="skill-row__name">${esc(display)}${
            isAlias ? `<span class="skill-row__alias">${esc(skill.name)}</span>` : ""
          }</span>
          <span class="skill-row__desc">${esc(skill.description)}</span>
        </div>
        <span class="skill-row__src">${esc(src)}</span>
        <span class="skill-row__installs" title="已安装 ${counts.installed}/${counts.total} 个 Agent">${counts.installed}/${counts.total}</span>
        <span class="skill-row__meta">${esc(skill.version)} · ${esc(fmtRelative(skill.updatedAt))}</span>
        <button class="card__edit" data-action="edit-skill" data-id="${esc(skill.id)}"
                aria-label="编辑 ${esc(skill.name)}" title="编辑技能">${I.svg("pencil", 12)}</button>
        <button class="card__check" data-action="check" data-id="${esc(skill.id)}"
                aria-label="选择 ${esc(skill.name)}">${checkIcon()}</button>
      </div>`;
  }

  /* ---------------- 分组头 ---------------- */
  function groupHeadHtml(group) {
    return `
      <div class="group-head" data-group="${esc(group.key)}" data-kind="${esc(group.kind)}">
        <h2>${esc(group.name)}</h2>
        <span class="group-head__count">${group.items.length}</span>
        <span class="group-head__spacer"></span>
        <button class="group-head__link" data-action="focus-group"
                data-group="${esc(group.key)}" data-kind="${esc(group.kind)}">查看全部</button>
      </div>`;
  }

  /* ---------------- 空状态 ---------------- */
  function emptyHtml({ title, text, actions = [] }) {
    return `
      <div class="empty">
        <div class="empty__icon">${I.svg("search", 24)}</div>
        <p class="empty__title">${esc(title)}</p>
        <p class="empty__text">${esc(text)}</p>
        ${
          actions.length
            ? `<div class="empty__actions">${actions
                .map(
                  (a) =>
                    `<button class="btn ${a.primary ? "btn--primary" : "btn--outline"}" data-action="${esc(
                      a.action
                    )}">${esc(a.label)}</button>`
                )
                .join("")}</div>`
            : ""
        }
      </div>`;
  }

  /* ---------------- 详情面板空态 ---------------- */
  function inspectorEmptyHtml() {
    return `
      <div class="empty" style="min-height:100%">
        <div class="empty__icon">${I.svg("file", 24)}</div>
        <p class="empty__title">未选择 SKILL</p>
        <p class="empty__text">在左侧点选任意技能，这里会显示 SKILL.md 原文、关联文件与元信息。</p>
      </div>`;
  }

  function fileSizeText(size) {
    return size ? fmtBytes(size) : "";
  }

  SH.components = {
    sourceColorVar,
    categoryColorVar,
    cardHtml,
    rowHtml,
    groupHeadHtml,
    emptyHtml,
    inspectorEmptyHtml,
    iconPlate,
    checkIcon,
    fileSizeText,
    shortName,
    installDots,
    installCounts,
  };
})();
