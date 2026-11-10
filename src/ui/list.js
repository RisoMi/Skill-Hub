/* ------------------------------------------------------------
   list.js · 内容区：标题 / 筛选 / 分组卡片 / 批量操作条
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc } = SH.util;
  const store = SH.store;
  const C = SH.components;

  const scroll = document.getElementById("listScroll");
  const pageTitle = document.getElementById("pageTitle");
  const pageCount = document.getElementById("pageCount");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const resultCount = document.getElementById("resultCount");
  const selectionBar = document.getElementById("selectionBar");
  const selectionCount = document.getElementById("selectionCount");
  const exportSelectedBtn = document.getElementById("exportSelectedBtn");
  const selectionDeleteBtn = document.getElementById("selectionDeleteBtn");

  function scopeTitle() {
    const ui = store.ui;
    if (ui.categoryId !== "all") return store.categoryName(ui.categoryId);
    if (ui.sourceId !== "all") return store.sourceName(ui.sourceId);
    return "全部技能";
  }

  function scopeSubtitle(groups) {
    const ui = store.ui;
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    if (ui.query) return `搜索「${ui.query}」· ${total} 个结果`;
    const srcCount = new Set(
      groups.flatMap((g) => g.items.map((s) => s.sourceId))
    ).size;
    if (ui.categoryId !== "all") {
      return `分类 · ${srcCount} 个来源 · 按${ui.sort === "source" ? "来源" : "更新时间"}排序`;
    }
    if (ui.sourceId !== "all") {
      return `来源 · ${total} 个 SKILL · 可批量导出`;
    }
    return `来自 ${store.state.sources.length} 个来源 · 按${
      ui.sort === "source" ? "来源" : "分类"
    }浏览`;
  }

  function renderSelection() {
    const count = store.ui.checked.size;
    selectionBar.hidden = count === 0;
    selectionCount.textContent = `已选 ${count} 个 SKILL`;
    exportSelectedBtn.disabled = count === 0;
    exportSelectedBtn.title = count === 0 ? "先勾选要导出的 SKILL" : `导出所选 ${count} 个 SKILL`;
    if (selectionDeleteBtn) {
      selectionDeleteBtn.disabled = count === 0;
      selectionDeleteBtn.title =
        count === 0 ? "先勾选要删除的 SKILL" : `删除所选 ${count} 个 SKILL`;
    }
  }

  function render() {
    const keepTop = scroll.scrollTop;
    const ui = store.ui;
    const groups = store.groupedSkills();
    const total = groups.reduce((n, g) => n + g.items.length, 0);

    pageTitle.textContent = scopeTitle();
    pageCount.textContent = String(total);
    pageSubtitle.textContent = scopeSubtitle(groups);
    resultCount.textContent = `共 ${total} 个 SKILL`;

    if (!total) {
      const isFiltering =
        ui.query || ui.filter !== "all" || ui.sourceId !== "all" || ui.categoryId !== "all";
      scroll.innerHTML = isFiltering
        ? C.emptyHtml({
            title: "没有匹配的 SKILL",
            text: "换个关键词，或清除当前的来源 / 分类筛选再看一次。",
            actions: [{ action: "reset-scope", label: "清除筛选", primary: true }],
          })
        : C.emptyHtml({
            title: "还没有任何 SKILL",
            text: "先添加一个包含 SKILL.md 的目录，或直接导入现成的 SKILL 包。",
            actions: [
              { action: "import", label: "导入 SKILL", primary: true },
              { action: "add-source", label: "添加目录" },
            ],
          });
      renderSelection();
      return;
    }

    const html = groups
      .map((group) => {
        const body =
          ui.view === "list"
            ? `<div class="skill-list">${group.items
                .map((s) =>
                  C.rowHtml(s, {
                    active: s.id === ui.selectedId,
                    checked: ui.checked.has(s.id),
                  })
                )
                .join("")}</div>`
            : `<div class="card-grid">${group.items
                .map((s) =>
                  C.cardHtml(s, {
                    active: s.id === ui.selectedId,
                    checked: ui.checked.has(s.id),
                  })
                )
                .join("")}</div>`;
        return `<section class="group" data-group="${esc(group.key)}">${C.groupHeadHtml(
          group
        )}${body}</section>`;
      })
      .join("");

    scroll.innerHTML = html;
    scroll.scrollTop = keepTop;
    renderSelection();
  }

  /* ---------------- 事件 ---------------- */
  function onScrollClick(event) {
    const srcBtn = event.target.closest('[data-action="edit-source-of"]');
    if (srcBtn) {
      event.stopPropagation();
      const skill = store.getSkill(srcBtn.dataset.id);
      if (skill && SH.dialogs) SH.dialogs.openSourceEditor(skill.sourceId);
      return;
    }

    const markBtn = event.target.closest('[data-action="mark-skill"]');
    if (markBtn) {
      event.stopPropagation();
      SH.dialogs && SH.dialogs.openMarkPicker(markBtn.dataset.id);
      return;
    }

    const hideBtn = event.target.closest('[data-action="hide-skill"]');
    if (hideBtn) {
      event.stopPropagation();
      const res = store.setSkillHidden(hideBtn.dataset.id, true);
      if (res.ok) SH.toast("已隐藏，可在侧栏「隐藏」里恢复", "ok");
      return;
    }

    const editBtn = event.target.closest('[data-action="edit-skill"]');
    if (editBtn) {
      // 必须拦在这里：卡片本身是 data-action="open"，
      // 不拦的话点到编辑按钮会连带触发选中/打开详情
      event.stopPropagation();
      SH.editor && SH.editor.open(editBtn.dataset.id);
      return;
    }

    const check = event.target.closest('[data-action="check"]');
    if (check) {
      event.stopPropagation();
      store.toggleCheck(check.dataset.id);
      return;
    }

    const focusGroup = event.target.closest('[data-action="focus-group"]');
    if (focusGroup) {
      event.stopPropagation();
      if (focusGroup.dataset.kind === "source") {
        store.setSource(focusGroup.dataset.group);
      } else {
        store.setCategory(focusGroup.dataset.group);
      }
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action && action.dataset.action === "reset-scope") {
      store.setQuery("");
      document.getElementById("searchInput").value = "";
      store.setSource("all");
      store.setCategory("all");
      store.setFilter("all");
      document.querySelectorAll("#filterChips .chip").forEach((c) =>
        c.classList.toggle("is-active", c.dataset.filter === "all")
      );
      return;
    }
    if (action && action.dataset.action === "import") {
      SH.dialogs && SH.dialogs.openImport();
      return;
    }
    if (action && action.dataset.action === "add-source") {
      SH.dialogs && SH.dialogs.openAddSource();
      return;
    }

    const card = event.target.closest('[data-action="open"]');
    if (card) {
      store.selectSkill(card.dataset.id);
    }
  }

  function onScrollKey(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest('[data-action="open"]');
    if (!card) return;
    event.preventDefault();
    store.selectSkill(card.dataset.id);
  }

  /** 键盘上下移动选中项 */
  function moveSelection(delta) {
    const items = store.filteredSkills();
    if (!items.length) return;
    const idx = items.findIndex((s) => s.id === store.ui.selectedId);
    const next = idx === -1 ? 0 : Math.min(items.length - 1, Math.max(0, idx + delta));
    store.selectSkill(items[next].id);
    const el = scroll.querySelector(`[data-id="${items[next].id}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }

  function init() {
    scroll.addEventListener("click", onScrollClick);
    scroll.addEventListener("keydown", onScrollKey);
  }

  SH.list = { render, init, moveSelection, renderSelection };
})();
