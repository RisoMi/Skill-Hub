# -*- coding: utf-8 -*-
"""来源可隐藏：仅影响侧栏来源列表，不影响其 SKILL。"""
import io, sys

BASE = r"F:\AISpace\WorkBuddy\常规任务\Skill-Hub"


def patch(path, pairs):
    t = io.open(path, encoding="utf-8").read()
    for old, new, label in pairs:
        if t.count(old) != 1:
            print("锚点异常(%d)：%s" % (t.count(old), label)); sys.exit(1)
        t = t.replace(old, new, 1)
    io.open(path, "w", encoding="utf-8", newline="").write(t)
    print("ok:", path.split("\\")[-1])


# ---------- store：hidden 字段 + setSourceHidden ----------
patch(BASE + r"\src\core\store.js", [
    (
        """    state.sources = (base.sources || clone(defaults.sources)).map((s) =>
      Object.assign({}, s, { enabled: s.enabled !== false })
    );""",
        """    state.sources = (base.sources || clone(defaults.sources)).map((s) =>
      Object.assign({}, s, { enabled: s.enabled !== false, hidden: !!s.hidden })
    );""",
        "load hidden",
    ),
    (
        """  function setSourceEnabled(sourceId, enabled) {""",
        """  /**
   * 隐藏来源：只影响左侧来源列表的显示，不影响它下面的 SKILL。
   * 与 enabled 的区别：enabled=false 是「停用」，技能不再进列表。
   */
  function setSourceHidden(sourceId, hidden) {
    const src = getSource(sourceId);
    if (!src) return { ok: false, reason: "来源不存在" };
    src.hidden = !!hidden;
    persist();
    emit("sources");
    return { ok: true, hidden: src.hidden };
  }

  function setSourceEnabled(sourceId, enabled) {""",
        "setSourceHidden",
    ),
    (
        "    isSourceEnabled,\n    setSourceEnabled,",
        "    isSourceEnabled,\n    setSourceEnabled,\n    setSourceHidden,",
        "导出",
    ),
])

# ---------- sidebar：过滤隐藏来源 ----------
patch(BASE + r"\src\ui\sidebar.js", [
    (
        """    const rows = store.state.sources
      .map((src) =>""",
        """    const visible = store.state.sources.filter((src) => !src.hidden);

    if (!visible.length) {
      return `
        <div class="nav-panel__head">
          <button class="nav-label__action" data-action="add-source">＋ 选择 Agent</button>
        </div>
        <div class="nav-empty">所有来源都已隐藏。<br>点上面「选择 Agent」把需要的显示出来。</div>`;
    }

    const rows = visible
      .map((src) =>""",
        "过滤隐藏来源",
    ),
])

# ---------- dialogs：每行加隐藏/显示 ----------
patch(BASE + r"\src\ui\dialogs.js", [
    (
        """          <div class="source-row">
            <span class="dot" style="background:${store.sourceColor(src)}"></span>""",
        """          <div class="source-row ${src.hidden ? "is-hidden" : ""}" data-row="${esc(src.id)}">
            <span class="dot" style="background:${store.sourceColor(src)}"></span>""",
        "行 class",
    ),
    (
        """            <button class="source-row__remove" data-act="edit-source" data-id="${esc(
              src.id
            )}">编辑</button>""",
        """            <button class="source-row__remove" data-act="toggle-source-hidden"
                    data-id="${esc(src.id)}">${src.hidden ? "显示" : "隐藏"}</button>
            <button class="source-row__remove" data-act="edit-source" data-id="${esc(
              src.id
            )}">编辑</button>""",
        "隐藏按钮",
    ),
    (
        """        if (act === "pick-agent") {""",
        """        if (act === "toggle-source-hidden") {
          const id = el.dataset.id;
          const rec = store.state.sources.find((s) => s.id === id);
          const next = !(rec && rec.hidden);
          const res = store.setSourceHidden(id, next);
          if (!res.ok) return;

          // 局部更新，不重绘弹窗
          const row = root.querySelector(`[data-row="${id}"]`);
          if (row) row.classList.toggle("is-hidden", next);
          el.textContent = next ? "显示" : "隐藏";
          SH.toast(next ? "已隐藏该来源（技能仍会出现在列表里）" : "已显示该来源", next ? "info" : "ok");
          return;
        }

        if (act === "pick-agent") {""",
        "隐藏按钮处理",
    ),
])

# ---------- 样式 ----------
CP = BASE + r"\assets\styles\dialogs.css"
c = io.open(CP, encoding="utf-8").read()
if ".source-row.is-hidden" not in c:
    c = c.rstrip() + """

/* 被隐藏的来源：整行降透明度，一眼区分 */
.source-row.is-hidden {
  opacity: 0.5;
}

.source-row.is-hidden:hover {
  opacity: 0.8;
}
"""
    io.open(CP, "w", encoding="utf-8", newline="\n").write(c)
    print("ok: 样式")
