/* ------------------------------------------------------------
   editor.js · 独立的技能编辑模式
   ------------------------------------------------------------
   左边是完整文件清单，右边按文件类型给不同的编辑体验：
   - .md   左编辑 / 右实时预览（可切单栏）
   - .json 编辑 + 一键格式化
   - 图片  直接预览（走后端 base64）
   - 其它  纯文本

   注意：所有「状态变化」都只做局部 DOM 更新，不整窗重绘，
   否则动画会重放（闪一下）、输入框也会失焦。
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
    /** md 是否分栏实时预览 */
    split: true,
    dirty: {},
    newMode: false,
    error: "",
  };

  /** 图片 base64 缓存：key = skillId::fileName；null=加载中，false=失败 */
  const imageCache = {};

  const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
  const MD_RE = /\.md$/i;
  const JSON_RE = /\.json$/i;

  function fileKind(name) {
    const n = String(name || "");
    if (IMAGE_RE.test(n)) return "image";
    if (MD_RE.test(n)) return "md";
    if (JSON_RE.test(n)) return "json";
    return "text";
  }

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

  function contentOf(skill, fileName) {
    if (state.dirty[fileName] !== undefined) return state.dirty[fileName];
    const hit = filesOf(skill).find((f) => f.name === fileName);
    return hit ? hit.content || "" : "";
  }

  const isDirty = (name) => state.dirty[name] !== undefined;
  const hasAnyDirty = () => Object.keys(state.dirty).length > 0;

  /* ---------------- 图片异步加载 ---------------- */

  async function loadImage(skill, file) {
    const key = `${skill.id}::${file}`;
    if (imageCache[key] !== undefined) return;
    imageCache[key] = null;

    if (!SH.native.isNative || !skill.nativeDir) {
      imageCache[key] = false;
      if (state.open && state.file === file) render();
      return;
    }
    try {
      const b64 = await SH.native.readFileBase64(skill.nativeDir, file);
      imageCache[key] = b64 || false;
    } catch (err) {
      imageCache[key] = false;
    }
    if (state.open && state.file === file) render();
  }

  /* ---------------- 渲染 ---------------- */

  function fileListHtml(skill) {
    const files = filesOf(skill);
    if (!files.length) return `<div class="se-empty">这个技能还没有文件</div>`;
    return files
      .map((f) => {
        const kind = fileKind(f.name);
        const icon = kind === "image" ? "eye" : kind === "md" ? "doc" : "file";
        return `
        <div class="se-file-row">
          <button class="se-file ${f.name === state.file ? "is-active" : ""}"
                  data-act="file" data-file="${esc(f.name)}">
            ${SH.icons.svg(icon, 12)}
            <span class="se-file__name truncate">${esc(f.name)}</span>
            ${isDirty(f.name) ? `<span class="se-file__dot" title="未保存"></span>` : ""}
          </button>
          ${
            /^SKILL\.md$/i.test(f.name)
              ? ""
              : `<button class="se-file__del" data-act="delete" data-file="${esc(f.name)}"
                        title="删除 ${esc(f.name)}">${SH.icons.svg("trash", 12)}</button>`
          }
        </div>`;
      })
      .join("");
  }

  function mainHtml(skill, file, text) {
    if (!file) return `<div class="se-placeholder">左侧选一个文件开始编辑</div>`;
    const kind = fileKind(file);

    if (kind === "image") {
      const key = `${skill.id}::${file}`;
      const b64 = imageCache[key];
      if (b64 === undefined || b64 === null) {
        loadImage(skill, file);
        return `<div class="se-placeholder">正在加载图片…</div>`;
      }
      if (!b64) {
        return `<div class="se-placeholder">这张图读不出来（可能超过 8MB，或不在本地目录）</div>`;
      }
      const ext = file.toLowerCase().split(".").pop();
      const mime = ext === "svg" ? "image/svg+xml" : `image/${ext.replace("jpg", "jpeg")}`;
      return `<div class="se-image">
        <img src="data:${mime};base64,${b64}" alt="${esc(file)}">
        <span class="se-image__name">${esc(file)}</span>
      </div>`;
    }

    if (kind === "md" && state.split) {
      return `
        <div class="se-split">
          <textarea id="seTextarea" class="se-textarea se-textarea--split" spellcheck="false"
                    placeholder="在这里编辑 ${esc(file)}">${esc(text)}</textarea>
          <div class="se-split__preview md" id="sePreview">${SH.md.render(
            SH.md.splitFrontmatter(text).body
          )}</div>
        </div>`;
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
    const kind = fileKind(file);

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
              kind === "md"
                ? `<button class="se-btn" data-act="split" title="切换分栏预览">
                     ${SH.icons.svg("eye", 13)}<span>${state.split ? "单栏" : "分栏预览"}</span>
                   </button>`
                : ""
            }
            ${
              kind === "json"
                ? `<button class="se-btn" data-act="format-json" title="格式化 JSON">
                     ${SH.icons.svg("code", 13)}<span>格式化</span>
                   </button>`
                : ""
            }
            <button class="se-btn" data-act="make-meta" title="按 Agent 生成元数据文件">
              ${SH.icons.svg("tag", 13)}<span>生成 meta</span>
            </button>
            <button class="se-btn se-btn--primary" data-act="save"
                    title="保存（Ctrl/Cmd + S）">
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
            file
              ? `${esc(file)} · ${SH.util.byteLength(text)} 字节${isDirty(file) ? " · 未保存" : ""}`
              : "未选择文件"
          }</span>
        </footer>
      </div>`;

    if (state.newMode) {
      const input = root.querySelector("#seNewFile");
      if (input) input.focus();
    } else if (kind !== "image") {
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
      stat.textContent = `${file} · ${SH.util.byteLength(text)} 字节${
        isDirty(file) ? " · 未保存" : ""
      }`;
    }
    const box = root.querySelector(".se-files__list");
    if (box) box.innerHTML = fileListHtml(skill);
  }

  /* ---------------- 行为 ---------------- */

  function switchFile(name) {
    if (!name || name === state.file) return;
    state.file = name;
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

  /** JSON 一键美化 */
  function formatJson() {
    const area = root.querySelector("#seTextarea");
    if (!area || !state.file) return;
    try {
      const pretty = JSON.stringify(JSON.parse(area.value), null, 2) + "\n";
      area.value = pretty;
      state.dirty[state.file] = pretty;
      state.error = "";
      refreshStatus();
      SH.toast("已格式化，记得保存", "ok");
    } catch (err) {
      state.error = `JSON 解析失败：${String((err && err.message) || err)}`;
      const hint = root.querySelector(".se-foot__hint");
      if (hint) {
        hint.textContent = state.error;
        hint.classList.add("is-error");
      }
    }
  }

  /** 按 Agent 生成 *_meta.json，全程不离开编辑器 */
  async function makeMeta() {
    const skill = currentSkill();
    if (!skill) return;

    const done = await SH.dialogs.pickAgentMeta(skill);
    if (!done) return;

    // 元数据写入后可能多了文件，重渲染一次让左侧列表同步
    render();
    SH.toast("元数据已生成，可在左侧文件列表查看", "ok");
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

    if (act === "close") return void requestClose();
    if (act === "file") return switchFile(el.dataset.file);

    if (act === "split") {
      state.split = !state.split;
      return render();
    }

    if (act === "format-json") return formatJson();
    if (act === "make-meta") return void makeMeta();

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
    if (act === "save") return void save();

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
    }
  }

  function onInput(event) {
    const area = event.target;
    if (!area || area.id !== "seTextarea" || !state.file) return;

    state.dirty[state.file] = area.value;

    // MD 分栏时实时刷新右侧预览
    const preview = root.querySelector("#sePreview");
    if (preview) {
      preview.innerHTML = SH.md.render(SH.md.splitFrontmatter(area.value).body);
    }
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
    state.split = true;

    const files = filesOf(skill);
    const requested = fileName ? files.find((f) => f.name === fileName) : null;
    const preferred =
      requested ||
      files.find((f) => /^SKILL\.md$/i.test(f.name)) ||
      files.find((f) => MD_RE.test(f.name)) ||
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
