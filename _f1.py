# -*- coding: utf-8 -*-
"""三项修复：meta 文件同步进 files、同步按钮不重绘、新建来源改选择 Agent。"""
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


# ---------- 1. 写盘后把 *_meta.json 同步进 skill.files ----------
patch(BASE + r"\src\core\store.js", [
    (
        """    try {
      await native.writeSkill(root, skill.name, files);
      return { ok: true };
    } catch (err) {""",
        """    try {
      await native.writeSkill(root, skill.name, files);

      // 写盘用的是临时数组，*_meta.json 不会自动进 skill.files，
      // 于是出现「磁盘上有这个文件，但编辑器列表里看不到」。
      if (skill.meta && skill.meta.fileName) {
        const metaContent = skill.meta.content || "";
        const rec = {
          name: skill.meta.fileName,
          content: metaContent,
          size: SH.util.byteLength(metaContent),
        };
        const list = skill.files || [];
        const idx = list.findIndex((f) => f.name === skill.meta.fileName);
        if (idx >= 0) list[idx] = rec;
        else list.push(rec);
        skill.files = list;
        persist();
        emit("files");
      }

      return { ok: true };
    } catch (err) {""",
        "writeSkillFiles 同步 files",
    ),
])

# ---------- 2. 同步按钮局部更新 ----------
patch(BASE + r"\src\ui\dialogs.js", [
    (
        """      if (act === "sync-name") {
        state.name = mdName;
        return refresh();
      }""",
        """      if (act === "sync-name") {
        state.name = mdName;
        // 只改输入框与提示，不整窗重绘（重绘会闪、也会丢焦点）
        const input = root.querySelector('input[data-act="name"]');
        if (input) input.value = mdName;
        const hint = root.querySelector(".name-pair__hint");
        if (hint) hint.textContent = nameHintText();
        return;
      }""",
        "sync-name",
    ),
])

# ---------- 3a 侧栏文案 ----------
patch(BASE + r"\src\ui\sidebar.js", [
    (
        """        <button class="nav-label__action" data-action="add-source">＋ 新建来源</button>""",
        """        <button class="nav-label__action" data-action="add-source">＋ 选择 Agent</button>""",
        "侧栏文案",
    ),
])

# ---------- 3b 弹窗：标题 + Agent 快捷选择 ----------
patch(BASE + r"\src\ui\dialogs.js", [
    (
        """              <h2 class="dialog__title">添加 SKILL 目录</h2>
              <p class="dialog__subtitle">选择任意包含 SKILL.md 的目录，自动解析并归类</p>""",
        """              <h2 class="dialog__title">选择 Agent</h2>
              <p class="dialog__subtitle">点下面的 Agent 自动填入它的技能目录，也可手动指定其它目录</p>""",
        "弹窗标题",
    ),
    (
        """          <div class="dialog__body">
            <div class="field">
              <span class="field__label">目录路径</span>""",
        """          <div class="dialog__body">
            ${agentShortcuts()}
            <div class="field">
              <span class="field__label">目录路径</span>""",
        "插入快捷选择",
    ),
    (
        """    function render() {
      return `
        <div class="dialog dialog--sm" role="dialog" aria-modal="true" aria-label="添加 SKILL 目录">""",
        """    /** 常见 Agent 快捷入口：点一下自动填路径与名称 */
    function agentShortcuts() {
      const builtins = store.state.sources.filter((s) => s.builtin);
      if (!builtins.length) return "";
      return `
        <div class="field">
          <span class="field__label">常用 Agent</span>
          <div class="agent-chips">
            ${builtins
              .map(
                (s) => `<button class="agent-chip" data-act="pick-agent" data-id="${esc(s.id)}"
                                title="${esc(s.path)}">
                          <span class="dot" style="background:${store.sourceColor(s)}"></span>
                          <span>${esc(s.name)}</span>
                        </button>`
              )
              .join("")}
          </div>
        </div>`;
    }

    function render() {
      return `
        <div class="dialog dialog--sm" role="dialog" aria-modal="true" aria-label="选择 Agent">""",
        "agentShortcuts 定义",
    ),
    (
        """        if (act === "browse") {""",
        """        if (act === "pick-agent") {
          const src = store.getSource(el.dataset.id);
          if (!src) return;
          state.pathText = src.path;
          state.displayName = src.name;
          const p = root.querySelector("#sourcePathInput");
          if (p) p.value = src.path;
          const n = root.querySelector("#sourceNameInput");
          if (n) n.value = src.name;
          return;
        }

        if (act === "browse") {""",
        "pick-agent 处理",
    ),
])

# ---------- 样式 ----------
CP = BASE + r"\assets\styles\dialogs.css"
c = io.open(CP, encoding="utf-8").read()
if ".agent-chip" not in c:
    c = c.rstrip() + """

/* 选择 Agent 的快捷入口 */
.agent-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--line-strong);
  border-radius: 13px;
  font-size: var(--fs-mini);
  color: var(--text-2);
  background: var(--surface);
  transition: border-color 0.12s var(--ease), color 0.12s var(--ease);
}

.agent-chip:hover {
  border-color: var(--accent-bright);
  color: var(--accent);
}

.agent-chip .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
"""
    io.open(CP, "w", encoding="utf-8", newline="\n").write(c)
    print("ok: dialogs.css")
