/* ------------------------------------------------------------
   editor.js · 独立的技能编辑模式
   ------------------------------------------------------------
   与侧边栏的只读预览区分开：这里是一层覆盖全窗口的编辑页，
   左边是完整文件清单，右边是可编辑的正文（.md 支持预览）。

   为什么不在侧边栏里编辑：详情面板宽度有限，编辑器需要足够空间，
   而且侧边栏被主列表挤压时编辑体验很差。
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const store = SH.store;
  const esc = SH.util.esc;

  let root = null;

  const state = {
    open: false,
    skillId: null,
    file: null,
    /** "edit" | "preview"，仅对 .md 生效 */
    mode: "edit",
    /** 文件名 -> 未保存的正文 */
    dirty: {},
    newMode: false,
    error: "",
  };

  function ensureRoot() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "skillEditorRoot";
    root.className = "se-root";
    document.body.appendChild(root);
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKeydownInRoot);
    return root;
  }

  const currentSkill = () => (state.skillId ? store.getSkill(state.skillId) : null);
  const filesOf = (skill) => (skill && Array.isArray(skill.files) ? skill.files : []);
  const isMd = (name) => /\.md$/i.test(String(name || ""));

  function contentOf(skill, fileName) {
    if (state.dirty[fileName] !== undefined) return state.dirty[fileName];
    const hit = filesOf(skill).find((f) => f.name === fileName);
    return hit ? hit.content || "" : "";
  }

  const isDirty = (name) => state.dirty[name] !== undefined;
  const hasAnyDirty = () => Object.keys(state.dirty).length > 0;

  /* ---------------- 渲染 ---------------- */

  function fileListHtml(skill) {
    const files = filesOf(skill);
    if (!files.length) return `<div class="se-empty">这个技能还没有文件</div>`;
    return files
      .map(
        (f) => `
        <div class="se-file-row">
          <button class="se-file ${f.name === state.file ? "is-active" : ""}"
                  data-act="file" data-file="${esc(f.name)}">
            ${SH.icons.svg(isMd(f.name) ? "doc" : "file", 12)}
            <span class="se-file__name truncate">${esc(f.name)}</span>
            ${isDirty(f.name) ? `<span class="se-file__dot" title="未保存"></span>` : ""}
          </button>
          ${
            /^SKILL\.md$/i.test(f.name)
              ? ""
              : `<button class="se-file__del" data-act="delete" data-file="${esc(f.name)}"
                        title="删除 ${esc(f.name)}">${SH.icons.svg("trash", 12)}</button>`
          }
        </div>`
      )
      .join("");
  }

  function mainHtml(skill, file, text) {
    if (!file) {
      return `<div class="se-placeholder">左侧选一个文件开始编辑</div>`;
    }
    if (isMd(file) && state.mode === "preview") {
      const body = SH.md.splitFrontmatter(text).body;
      return `<div class="se-preview md">${SH.md.render(body)}</div>`;
    }
    return `
      <textarea id="seTextarea" class="se-textarea" spellcheck="false"
                placeholder="在这里编辑 ${esc(file)}">${esc(text)}</textarea>`;
  }

  function render() {
    const skill = currentSkill();
    if (!skill) return close();

    const file = state.file;
    const text = file ? contentOf(skill, file) : "";
    const md = isMd(file);

    // 标题用展示名；副标题在两者相同时改用来源名，避免重复显示同一个词
    const display = store.displayName(skill);
    const subLabel = display !== skill.name ? skill.name : store.sourceName(skill.sourceId);

    root.innerHTML = `
      <div class="se-panel" role="dialog" aria-modal="true"
           aria-label="编辑技能 ${esc(skill.name)}">
        <header class="se-bar">
          <div class="se-bar__left">
            <button class="se-icon" data-act="close" title="关闭（Esc）">
              ${SH.icons.svg("close", 14)}
            </button>
            <div class="se-bar__titles">
              <span class="se-bar__name">${esc(display)}</span>
              <span class="se-bar__sub">${esc(subLabel)}</span>
            </div>
          </div>
          <div class="se-bar__right">
            ${
              md
                ? `<button class="se-btn" data-act="mode" title="切换预览">
                     ${SH.icons.svg("eye", 13)}
                     <span>${state.mode === "preview" ? "继续编辑" : "预览"}</span>
                   </button>`
                : ""
            }
            <button class="se-btn se-btn--primary" data-act="save" title="保存（Ctrl/Cmd + S）">
              ${SH.icons.svg("save", 13)}<span>保存</span>
            </button>
          </div>
        </header>

        <div class="se-body">
          <aside class="se-files">
            <div class="se-files__head">
              <span>文件 ${filesOf(skill).length}</span>
              <button class="se-icon" data-act="new" title="新建文件">
                ${SH.icons.svg("plus", 13)}
              </button>
            </div>
            ${
              state.newMode
                ? `<div class="se-new">
                     <input id="seNewFile" class="se-new__input" placeholder="references/notes.md"
                            autocomplete="off" spellcheck="false">
                     <button class="se-btn se-btn--tiny" data-act="create">创建</button>
                     <button class="se-icon" data-act="cancel-new" title="取消">
                       ${SH.icons.svg("close", 12)}
                     </button>
                   </div>`
                : ""
            }
            <div class="se-files__list">${fileListHtml(skill)}</div>
          </aside>

          <main class="se-main">${mainHtml(skill, file, text)}</main>
        </div>

        <footer class="se-foot">
          <span class="se-foot__hint ${
            state.error ? "is-error" : ""
          }">${esc(state.error || "Ctrl / Cmd + S 保存 · Esc 关闭")}</span>
          <span class="se-foot__stat">${
            file ? `${esc(file)} · ${SH.util.byteLength(text)} 字节${isDirty(file) ? " · 未保存" : ""}` : "未选择文件"
          }</span>
        </footer>
      </div>`;

    if (state.newMode) {
      const input = root.querySelector("#seNewFile");
      if (input) input.focus();
    } else if (!md || state.mode === "edit") {
      const area = root.querySelector("#seTextarea");
      if (area) area.focus();
    }
  }

  /** 只刷新会变的部分，避免整页重绘导致光标丢失 */
  function refreshStatus() {
    if (!root) return;
    const skill = currentSkill();
    const file = state.file;
    if (!skill || !file) return;

    const stat = root.querySelector(".se-foot__stat");
    if (stat) {
      const text = contentOf(skill, file);
      stat.textContent = `${file} · ${SH.util.byteLength(text)} 字节${isDirty(file) ? " · 未保存" : ""}`;
    }
    const box = root.querySelector(".se-files__list");
    if (box) box.innerHTML = fileListHtml(skill);
  }

  /* ---------------- 行为 ---------------- */

  function switchFile(name) {
    if (!name || name === state.file) return;
    state.file = name;
    state.mode = "edit";
    state.error = "";
    render();
  }

  async function save() {
    const skill = currentSkill();
    const file = state.file;
    if (!skill || !file) return;

    const text = contentOf(skill, file);
    const res = await store.saveSkillFile(skill.id, file, text);
    if (!res.ok) {
      state.error = res.reason || "保存失败";
      render();
      return;
    }

    delete state.dirty[file];
    state.error = "";
    refreshStatus();
    SH.toast(
      res.persisted ? `已保存 ${file}` : `已更新 ${file}，但未写入磁盘：${res.reason || "请用桌面版"}`,
      res.persisted ? "ok" : "warn"
    );
  }

  async function createFile() {
    const input = root.querySelector("#seNewFile");
    const name = (input ? input.value : "").trim().replace(/\\/g, "/");
    if (!name) {
      state.error = "文件名不能为空";
      render();
      return;
    }
    const skill = currentSkill();
    if (!skill) return;

    const res = await store.saveSkillFile(skill.id, name, "");
    if (!res.ok) {
      state.error = res.reason || "创建失败";
      render();
      return;
    }

    state.newMode = false;
    state.file = name;
    state.mode = "edit";
    state.error = "";
    render();
    SH.toast(`已创建 ${name}`, "ok");
  }

  async function deleteFile(name) {
    const skill = currentSkill();
    if (!skill) return;

    const res = await store.deleteSkillFile(skill.id, name);
    if (!res.ok) {
      state.error = res.reason || "删除失败";
      render();
      return;
    }

    delete state.dirty[name];
    if (state.file === name) {
      const rest = filesOf(skill);
      state.file = rest.length ? rest[0].name : null;
      state.mode = "edit";
    }
    state.error = "";
    render();
    SH.toast(
      res.persisted
        ? `已删除 ${name}`
        : `已从列表移除，但文件未真正删除：${res.reason || "请用桌面版"}`,
      res.persisted ? "ok" : "warn"
    );
  }

  async function requestClose() {
    if (hasAnyDirty()) {
      // 不用 window.confirm：Tauri 下它可能不弹窗直接返回 true
      const ok = await SH.dialogs.confirmAction({
        title: "放弃未保存的修改？",
        message: "有文件还没保存，关闭后这些改动会丢失。",
        confirmText: "放弃并关闭",
        danger: true,
      });
      if (!ok) return;
    }
    close();
  }

  /* ---------------- 事件 ---------------- */

  function onClick(event) {
    const el = event.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;

    if (act === "close") return requestClose();
    if (act === "file") return switchFile(el.dataset.file);
    if (act === "delete") {
      const name = el.dataset.file;
      if (!name) return;
      SH.dialogs
        .confirmAction({
          title: "删除文件",
          message: `确定删除 ${name}？`,
          detail: "会从技能目录里移除这个文件，无法撤销。",
          confirmText: "删除",
          danger: true,
        })
        .then((ok) => {
          if (ok) deleteFile(name);
        });
      return;
    }
    if (act === "mode") {
      state.mode = state.mode === "edit" ? "preview" : "edit";
      return render();
    }
    if (act === "save") return void save();
    if (act === "new") {
      state.newMode = true;
      state.error = "";
      return render();
    }
    if (act === "cancel-new") {
      state.newMode = false;
      return render();
    }
    if (act === "create") return void createFile();
  }

  function onInput(event) {
    const area = event.target;
    if (!area || area.id !== "seTextarea" || !state.file) return;
    state.dirty[state.file] = area.value;
    refreshStatus();
  }

  function onKeydownInRoot(event) {
    if (event.target && event.target.id === "seNewFile" && event.key === "Enter") {
      event.preventDefault();
      createFile();
    }
  }

  function onKeydown(event) {
    if (!state.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  }

  /* ---------------- 开关 ---------------- */

  function open(skillId, fileName) {
    const skill = store.getSkill(skillId);
    if (!skill) return;

    ensureRoot();
    state.open = true;
    state.skillId = skillId;
    state.dirty = {};
    state.error = "";
    state.newMode = false;
    state.mode = "edit";

    const files = filesOf(skill);
    const requested = fileName ? files.find((f) => f.name === fileName) : null;
    const preferred =
      requested ||
      files.find((f) => /^SKILL\.md$/i.test(f.name)) ||
      files.find((f) => isMd(f.name)) ||
      files[0];
    state.file = preferred ? preferred.name : null;

    document.body.classList.add("is-editing-skill");
    root.classList.add("is-open");
    document.addEventListener("keydown", onKeydown);
    render();
  }

  function close() {
    state.open = false;
    state.skillId = null;
    state.file = null;
    state.dirty = {};
    state.newMode = false;
    state.error = "";
    document.body.classList.remove("is-editing-skill");
    document.removeEventListener("keydown", onKeydown);
    if (root) {
      root.classList.remove("is-open");
      root.innerHTML = "";
    }
  }

  SH.editor = { open, close, isOpen: () => state.open };
})();
