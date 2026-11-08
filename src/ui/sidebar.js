/* ------------------------------------------------------------
   sidebar.js · 来源 / 分类导航（支持自定义与就地管理）
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc } = SH.util;
  const store = SH.store;
  const I = SH.icons;

  const nav = document.getElementById("sidebarNav");

  function navRow({ id, name, count, color, active, readonly, kind, editable }) {
    return `
      <div class="nav-row ${active ? "is-active" : ""}" data-kind="${kind}" data-id="${esc(id)}"
           role="button" tabindex="0" aria-pressed="${active ? "true" : "false"}">
        <span class="dot" style="background:${color}"></span>
        <span class="nav-row__name" title="${esc(name)}">${esc(name)}</span>
        ${readonly ? '<span class="nav-row__ro">只读</span>' : ""}
        ${
          editable
            ? `<button class="nav-row__edit" data-action="edit-${kind}" data-id="${esc(id)}"
                       title="管理这个${kind === "source" ? "来源" : "分类"}"
                       aria-label="管理 ${esc(name)}">${I.svg("more", 12)}</button>`
            : ""
        }
        <span class="nav-row__count">${count}</span>
      </div>`;
  }

  function render() {
    const sc = store.sourceCounts();
    const cc = store.categoryCounts();
    const ui = store.ui;
    const total = store.uniqueSkillCount();

    const sourceRows = store.state.sources
      .map((src) =>
        navRow({
          id: src.id,
          name: src.name,
          count: sc[src.id] || 0,
          color: store.sourceColor(src),
          active: ui.sourceId === src.id,
          readonly: src.readonly,
          kind: "source",
          editable: true,
        })
      )
      .join("");

    const categoryRows = store.state.categories
      .map((cat) =>
        navRow({
          id: cat.id,
          name: cat.name,
          count: cc[cat.id] || 0,
          color: store.categoryColor(cat),
          active: ui.categoryId === cat.id,
          kind: "category",
          editable: true,
        })
      )
      .join("");

    nav.innerHTML = `
      <div class="nav-group">
        ${navRow({
          id: "all",
          name: "全部技能",
          count: total,
          color: "var(--accent)",
          active: ui.sourceId === "all" && ui.categoryId === "all",
          kind: "all",
        })}
      </div>
      <div class="nav-gap"></div>
      <div class="nav-group">
        <div class="nav-label">
          <span>来源</span>
          <button class="nav-label__action" data-action="add-source">＋ 添加</button>
        </div>
        ${sourceRows}
      </div>
      <div class="nav-divider"></div>
      <div class="nav-group">
        <div class="nav-label">
          <span>分类</span>
          <span class="nav-label__actions">
            ${
              ui.categoryId !== "all"
                ? '<button class="nav-label__action" data-action="clear-category">清除</button>'
                : ""
            }
            <button class="nav-label__action" data-action="new-category">＋ 新建</button>
          </span>
        </div>
        ${categoryRows}
      </div>
    `;
  }

  function onClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const action = actionEl.dataset.action;
      if (action === "new-category") {
        event.stopPropagation();
        SH.dialogs.openCategoryEditor();
        return;
      }
      if (action === "edit-category") {
        event.stopPropagation();
        SH.dialogs.openCategoryEditor(actionEl.dataset.id);
        return;
      }
      if (action === "edit-source") {
        event.stopPropagation();
        SH.dialogs.openSourceEditor(actionEl.dataset.id);
        return;
      }
      if (action === "add-source") {
        event.stopPropagation();
        SH.dialogs.openAddSource();
        return;
      }
      if (action === "clear-category") {
        event.stopPropagation();
        store.setCategory("all");
        return;
      }
    }

    const row = event.target.closest(".nav-row");
    if (!row) return;
    const kind = row.dataset.kind;
    const id = row.dataset.id;

    if (kind === "all") {
      store.setSource("all");
      store.setCategory("all");
    } else if (kind === "source") {
      store.setSource(store.ui.sourceId === id ? "all" : id);
    } else if (kind === "category") {
      store.setCategory(store.ui.categoryId === id ? "all" : id);
    }
  }

  function onKey(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest(".nav-row");
    if (!row) return;
    event.preventDefault();
    row.click();
  }

  function init() {
    nav.addEventListener("click", onClick);
    nav.addEventListener("keydown", onKey);
  }

  SH.sidebar = { render, init };
})();
