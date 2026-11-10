/* ------------------------------------------------------------
   sidebar.js · 侧栏导航（来源 / 分类 / 标记 / 隐藏）
   ------------------------------------------------------------
   四个栏目内容都可能很长，竖排会撑爆侧栏，所以用 tab 切换。
   「全部技能」常驻在 tab 之上，不受栏目影响。
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc } = SH.util;
  const store = SH.store;
  const I = SH.icons;

  const nav = document.getElementById("sidebarNav");

  const TABS = [
    { id: "source", label: "来源" },
    { id: "category", label: "分类" },
    { id: "mark", label: "标记" },
    { id: "hidden", label: "隐藏" },
  ];

  function navRow({ id, name, count, color, active, readonly, kind, editable, enabled }) {
    return `
      <div class="nav-row ${active ? "is-active" : ""}" data-kind="${kind}" data-id="${esc(id)}"
           role="button" tabindex="0" aria-pressed="${active ? "true" : "false"}">
        <span class="dot" style="background:${color}"></span>
        <span class="nav-row__name" title="${esc(name)}">${esc(name)}</span>
        ${readonly ? '<span class="nav-row__ro">只读</span>' : ""}
        ${
          kind === "source"
            ? `<button class="nav-row__toggle ${enabled === false ? "is-off" : ""}"
                       data-action="toggle-source" data-id="${esc(id)}"
                       title="${enabled === false ? "已停用，点击启用" : "启用中，点击停用"}"
                       aria-pressed="${enabled !== false}"
                       aria-label="启用或停用 ${esc(name)}"><span></span></button>`
            : ""
        }
        ${
          editable
            ? `<button class="nav-row__edit" data-action="edit-${kind}" data-id="${esc(id)}"
                       title="管理这个${kind === "source" ? "来源" : "标记"}"
                       aria-label="管理 ${esc(name)}">${I.svg("more", 12)}</button>`
            : ""
        }
        <span class="nav-row__count">${count}</span>
      </div>`;
  }

  function tabsHtml(ui) {
    return `<div class="nav-tabs" role="tablist">
      ${TABS.map(
        (t) => `
        <button class="nav-tab ${ui.navTab === t.id ? "is-active" : ""}"
                data-action="nav-tab" data-tab="${t.id}" role="tab"
                aria-selected="${ui.navTab === t.id}">${esc(t.label)}${
          t.id === "hidden"
            ? `<span class="nav-tab__badge">${
                store.state.skills.filter((s) => s.hidden).length
              }</span>`
            : ""
        }</button>`
      ).join("")}
    </div>`;
  }

  /* ---------------- 各栏内容 ---------------- */

  function sourcePanel(ui, counts) {
    const rows = store.state.sources
      .map((src) =>
        navRow({
          id: src.id,
          name: src.name,
          count: counts[src.id] || 0,
          color: store.sourceColor(src),
          active: ui.sourceId === src.id,
          readonly: src.readonly,
          kind: "source",
          editable: true,
          enabled: src.enabled !== false,
        })
      )
      .join("");

    return `
      <div class="nav-panel__head">
        ${
          ui.sourceId !== "all"
            ? '<button class="nav-label__action" data-action="clear-source">清除筛选</button>'
            : ""
        }
        <button class="nav-label__action" data-action="add-source">＋ 新建来源</button>
      </div>
      <div class="nav-list">${rows}</div>`;
  }

  function categoryPanel(ui, counts) {
    const rows = store.state.categories
      .map((cat) =>
        navRow({
          id: cat.id,
          name: cat.name,
          count: counts[cat.id] || 0,
          color: store.categoryColor(cat),
          active: ui.categoryId === cat.id,
          kind: "category",
          editable: true,
        })
      )
      .join("");

    return `
      <div class="nav-panel__head">
        ${
          ui.categoryId !== "all"
            ? '<button class="nav-label__action" data-action="clear-category">清除筛选</button>'
            : ""
        }
        <button class="nav-label__action" data-action="new-category">＋ 新建分类</button>
      </div>
      <div class="nav-list">${rows}</div>`;
  }

  function markPanel(ui) {
    const marks = store.state.marks;
    const counts = store.markCounts();

    const rows = marks
      .map((m) =>
        navRow({
          id: m.id,
          name: m.name,
          count: counts[m.id] || 0,
          color: store.markColor(m),
          active: ui.markId === m.id,
          kind: "mark",
          editable: true,
        })
      )
      .join("");

    return `
      <div class="nav-panel__head">
        ${
          ui.markId !== "all"
            ? '<button class="nav-label__action" data-action="clear-mark">清除筛选</button>'
            : ""
        }
        <button class="nav-label__action" data-action="new-mark">＋ 新建标记</button>
      </div>
      ${
        marks.length
          ? `<div class="nav-list">${rows}</div>`
          : `<div class="nav-empty">
               还没有标记。给卡片打个标记，就能按颜色归类。
               <button class="nav-empty__link" data-action="new-mark">新建一个</button>
             </div>`
      }`;
  }

  function hiddenPanel() {
    // 用原始记录而不是聚合结果：同一个 SKILL 可能装在多个 Agent 下，
    // 按安装点分组才能看出「这个技能在哪个 Agent 里被隐藏了」
    const hiddenRaw = store.state.skills.filter((s) => s.hidden);

    if (!hiddenRaw.length) {
      return `<div class="nav-empty">
        没有被隐藏的 SKILL。<br>
        用卡片上的隐藏按钮可以把 Agent 自带、平时不用的技能收起来。
      </div>`;
    }

    const groups = new Map();
    hiddenRaw.forEach((s) => {
      const key = s.sourceId || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });

    const sections = Array.from(groups.entries())
      .map(([sourceId, items]) => {
        const src = store.getSource(sourceId);
        const color = src ? store.sourceColor(src) : "var(--text-4)";
        const label = src ? src.name : "其他来源";
        return `
          <div class="nav-subgroup">
            <div class="nav-subgroup__head">
              <span class="dot" style="background:${color}"></span>
              <span class="nav-subgroup__name" title="${esc(label)}">${esc(label)}</span>
              <span class="nav-subgroup__count">${items.length}</span>
            </div>
            ${items
              .map(
                (s) => `
              <div class="nav-row nav-row--hidden" data-kind="hidden" data-id="${esc(s.id)}">
                <span class="dot" style="background:var(--text-4)"></span>
                <span class="nav-row__name" title="${esc(s.name)}">${esc(
                  store.displayName(s)
                )}</span>
                <button class="nav-row__restore" data-action="unhide" data-id="${esc(
                  s.id
                )}" title="恢复到列表">恢复</button>
              </div>`
              )
              .join("")}
          </div>`;
      })
      .join("");

    return `
      <div class="nav-panel__head">
        <span class="nav-panel__hint">${hiddenRaw.length} 个已隐藏 · 按 Agent 分组</span>
      </div>
      <div class="nav-list">${sections}</div>`;
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    const ui = store.ui;
    const total = store.uniqueSkillCount();

    let panel = "";
    if (ui.navTab === "source") panel = sourcePanel(ui, store.sourceCounts());
    else if (ui.navTab === "category") panel = categoryPanel(ui, store.categoryCounts());
    else if (ui.navTab === "mark") panel = markPanel(ui);
    else panel = hiddenPanel();

    nav.innerHTML = `
      <div class="nav-group">
        ${navRow({
          id: "all",
          name: "全部技能",
          count: total,
          color: "var(--accent)",
          active:
            ui.sourceId === "all" && ui.categoryId === "all" && ui.markId === "all",
          kind: "all",
        })}
      </div>
      ${tabsHtml(ui)}
      <div class="nav-panel">${panel}</div>
    `;
  }

  /* ---------------- 事件 ---------------- */

  function onClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const action = actionEl.dataset.action;
      const stop = () => event.stopPropagation();

      if (action === "nav-tab") {
        stop();
        store.setNavTab(actionEl.dataset.tab);
        return;
      }
      if (action === "new-skill") {
        stop();
        SH.dialogs.openNewSkill();
        return;
      }
      if (action === "new-mark") {
        stop();
        SH.dialogs.openMarkEditor();
        return;
      }
      if (action === "edit-mark") {
        stop();
        SH.dialogs.openMarkEditor(actionEl.dataset.id);
        return;
      }
      if (action === "clear-mark") {
        stop();
        store.setMark("all");
        return;
      }
      if (action === "unhide") {
        stop();
        const res = store.setSkillHidden(actionEl.dataset.id, false);
        if (res.ok) SH.toast("已恢复到列表", "ok");
        return;
      }
      if (action === "toggle-source") {
        stop();
        const cur = store.state.sources.find((s) => s.id === actionEl.dataset.id);
        const next = !(cur && cur.enabled !== false);
        const res = store.setSourceEnabled(actionEl.dataset.id, next);
        if (res.ok) {
          SH.toast(next ? "已启用该来源" : "已停用该来源，其 SKILL 不再显示", next ? "ok" : "info");
        }
        return;
      }
      if (action === "clear-source") {
        stop();
        store.setSource("all");
        return;
      }
      if (action === "new-category") {
        stop();
        SH.dialogs.openCategoryEditor();
        return;
      }
      if (action === "edit-category") {
        stop();
        SH.dialogs.openCategoryEditor(actionEl.dataset.id);
        return;
      }
      if (action === "edit-source") {
        stop();
        SH.dialogs.openSourceEditor(actionEl.dataset.id);
        return;
      }
      if (action === "add-source") {
        stop();
        SH.dialogs.openAddSource();
        return;
      }
      if (action === "clear-category") {
        stop();
        store.setCategory("all");
        return;
      }
    }

    const row = event.target.closest(".nav-row");
    if (!row) return;
    const kind = row.dataset.kind;
    const id = row.dataset.id;

    if (kind === "all") {
      // 回到全部：连同栏目一起复位，避免停在「隐藏」栏看到空列表
      store.setNavTab("source");
      store.setSource("all");
      store.setCategory("all");
      store.setMark("all");
    } else if (kind === "source") {
      store.setSource(store.ui.sourceId === id ? "all" : id);
    } else if (kind === "category") {
      store.setCategory(store.ui.categoryId === id ? "all" : id);
    } else if (kind === "mark") {
      store.setMark(store.ui.markId === id ? "all" : id);
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
