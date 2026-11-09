/* ------------------------------------------------------------
   dialogs.js · 导出 / 导入向导 / 添加目录 / 设置
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc, fmtBytes, fmtDate, copyText } = SH.util;
  const store = SH.store;
  const I = SH.icons;
  const root = document.getElementById("overlayRoot");

  let current = null;

  /** 从绝对路径取最后一段，作为默认来源名 */
  function baseNameOfPath(p) {
    const parts = String(p || "")
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    return parts[parts.length - 1] || "自定义目录";
  }

  /* ---------------- 弹层基础设施 ---------------- */
  function mount(renderFn, handler, extraClass = "") {
    root.innerHTML = "";
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.dataset.role = "scrim";
    root.appendChild(overlay);

    current = { overlay, renderFn, handler, extraClass };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
        return;
      }
      handler(event);
    });
    overlay.addEventListener("dragover", (event) => {
      const zone = event.target.closest(".dropzone");
      if (!zone) return;
      event.preventDefault();
      zone.classList.add("is-over");
    });
    overlay.addEventListener("dragleave", (event) => {
      const zone = event.target.closest(".dropzone");
      if (zone) zone.classList.remove("is-over");
    });
    overlay.addEventListener("drop", (event) => {
      const zone = event.target.closest(".dropzone");
      if (!zone) return;
      event.preventDefault();
      zone.classList.remove("is-over");
      if (typeof current.onDrop === "function" && event.dataTransfer.files.length) {
        current.onDrop(event.dataTransfer.files);
      }
    });

    refresh();
    return overlay;
  }

  function refresh() {
    if (current) current.overlay.innerHTML = current.renderFn();
  }

  function close() {
    root.innerHTML = "";
    current = null;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && current) {
      event.preventDefault();
      close();
    }
  });

  /* ============================================================
     导出
     ============================================================ */
  function openExport(ids) {
    const skills = (ids || []).map((id) => store.getSkill(id)).filter(Boolean);
    if (!skills.length) {
      SH.toast("没有可导出的 SKILL", "error");
      return;
    }

    const state = {
      format: "zip",
      includeSkillFile: true,
      includeAttachments: true,
      includeManifest: true,
      includeMeta: true,
      metaFormatId: SH.meta.resolveFormat(skills[0].sourceId),
      metaSource: "marketplace",
      metaSkillId: "",
      metaUserModified: false,
      metaReuse: true,
      metaMoreOpen: false,
      metaDescriptionEn: "",
      metaExamplesZh: "",
      metaExamplesEn: "",
      metaPreview: null,
      metaPreviewOpen: false,
      metaPreviewLoading: false,
      usePicker: false,
      busy: false,
      error: "",
    };

    function options() {
      return {
        includeSkillFile: state.includeSkillFile,
        includeAttachments: state.includeAttachments,
        includeManifest: state.includeManifest,
        includeMeta: state.includeMeta,
        metaFormatId: state.metaFormatId,
        metaReuse: state.metaReuse,
        metaOptions: (() => {
          const fmt = SH.meta.getFormat(state.metaFormatId);
          const idValue = state.metaSkillId.trim();
          const split = (text) =>
            String(text || "")
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean);
          return {
            source: state.metaSource,
            skillId: fmt.needsOwnerId ? undefined : idValue || undefined,
            ownerId: fmt.needsOwnerId ? idValue || "local" : undefined,
            userModified: state.metaUserModified,
            descriptionEn: state.metaDescriptionEn.trim() || undefined,
            examplesZh: split(state.metaExamplesZh),
            examplesEn: split(state.metaExamplesEn),
          };
        })(),
      };
    }

    function pathText() {
      const stamp = fmtDate(Date.now()).replace(/-/g, "");
      if (state.format === "zip") {
        return state.usePicker
          ? "导出时选择保存位置 · .zip"
          : `~/Downloads/skill-hub-export-${stamp}.zip`;
      }
      return state.usePicker
        ? "导出时选择目标文件夹"
        : `~/Downloads/skill-hub-export-${stamp}/`;
    }

    function render() {
      const s = SH.io.estimate(skills, options());
      const readonlyCount = skills.filter((x) => !x.exportable).length;
      const fmt = SH.meta.getFormat(state.metaFormatId);
      const withMeta = skills.filter((s) => s.meta).length;

      return `
        <div class="dialog dialog--md" role="dialog" aria-modal="true" aria-label="导出 SKILL 包">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">导出 SKILL 包</h2>
              <p class="dialog__subtitle">将所选 ${skills.length} 个 SKILL 打包为可迁移的文件</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="field">
              <span class="field__label">导出格式</span>
              <div class="option-row">
                <button class="option-card ${state.format === "zip" ? "is-active" : ""}" data-act="format" data-value="zip">
                  <span class="option-card__icon">${I.svg("zip", 26)}</span>
                  <span class="option-card__col">
                    <span class="option-card__name">ZIP 压缩包</span>
                    <span class="option-card__desc">单个文件，便于分享与归档</span>
                  </span>
                </button>
                <button class="option-card ${state.format === "folder" ? "is-active" : ""}" data-act="format" data-value="folder">
                  <span class="option-card__icon">${I.svg("folder", 26)}</span>
                  <span class="option-card__col">
                    <span class="option-card__name">文件夹</span>
                    <span class="option-card__desc">保留原始目录结构，便于直接引用</span>
                  </span>
                </button>
              </div>
            </div>

            <div class="field">
              <span class="field__label">包含内容</span>
              <div class="check-row">
                <label class="check">
                  <input type="checkbox" data-act="include" data-key="includeSkillFile" ${state.includeSkillFile ? "checked" : ""}>
                  <span class="check__box">${I.svg("check", 11)}</span>
                  <span>SKILL.md 主文件</span>
                </label>
                <label class="check">
                  <input type="checkbox" data-act="include" data-key="includeAttachments" ${state.includeAttachments ? "checked" : ""}>
                  <span class="check__box">${I.svg("check", 11)}</span>
                  <span>引用文件与模板</span>
                </label>
                <label class="check">
                  <input type="checkbox" data-act="include" data-key="includeManifest" ${state.includeManifest ? "checked" : ""}>
                  <span class="check__box">${I.svg("check", 11)}</span>
                  <span>来源元信息清单</span>
                </label>
              </div>
            </div>

            <div class="field">
              <label class="check check--strong">
                <input type="checkbox" data-act="include-meta" ${state.includeMeta ? "checked" : ""}>
                <span class="check__box">${I.svg("check", 11)}</span>
                <span>生成来源标记文件</span>
                <span class="field__hint">${
                  state.includeMeta ? `${withMeta}/${skills.length} 个已有标记` : "_skillhub_meta.json"
                }</span>
              </label>

              ${
                state.includeMeta
                  ? `<div class="meta-config">
                      <div class="meta-config__row">
                        <label class="meta-config__field meta-config__field--grow">
                          <span class="meta-config__label">按哪个 Agent 的格式</span>
                          <select class="select" data-act="meta-format">
                            ${SH.meta
                              .groupedFormats()
                              .map(
                                (g) =>
                                  `<optgroup label="${esc(g.agentName)}">${g.items
                                    .map(
                                      (f) =>
                                        `<option value="${esc(f.id)}" ${
                                          f.id === state.metaFormatId ? "selected" : ""
                                        }>${esc(f.label)}</option>`
                                    )
                                    .join("")}</optgroup>`
                              )
                              .join("")}
                          </select>
                        </label>
                        <div class="meta-config__file">
                          <span class="meta-config__label">文件名</span>
                          <code class="meta-config__code">${esc(fmt.fileName)}</code>
                        </div>
                      </div>
                      <p class="meta-config__note">${esc(fmt.note)}</p>
                      <label class="check check--sm">
                        <input type="checkbox" data-act="meta-reuse" ${state.metaReuse ? "checked" : ""}>
                        <span class="check__box">${I.svg("check", 11)}</span>
                        <span>优先沿用技能自带的标记，没有的再按此格式生成</span>
                      </label>
                      ${
                        fmt.needsSource || fmt.needsOwnerId
                          ? `<div class="meta-config__row">
                              ${
                                fmt.needsSource
                                  ? `<label class="meta-config__field">
                                      <span class="meta-config__label">来源类型</span>
                                      <select class="select" data-act="meta-source">
                                        ${SH.meta.SOURCE_OPTIONS.map(
                                          (o) =>
                                            `<option value="${esc(o.value)}" ${
                                              o.value === state.metaSource ? "selected" : ""
                                            }>${esc(o.label)}</option>`
                                        ).join("")}
                                      </select>
                                    </label>`
                                  : ""
                              }
                              <label class="meta-config__field meta-config__field--grow">
                                <span class="meta-config__label">${
                                  fmt.needsOwnerId ? "发布者 ID" : "技能 ID（可选）"
                                }</span>
                                <input class="input input--mono" data-act="meta-skill-id"
                                       value="${esc(state.metaSkillId)}"
                                       placeholder="${fmt.needsOwnerId ? "525909" : "skill_..."}"
                                       spellcheck="false">
                              </label>
                            </div>`
                          : ""
                      }
                      ${
                        fmt.supportsModified
                          ? `<label class="check check--sm">
                              <input type="checkbox" data-act="meta-modified" ${
                                state.metaUserModified ? "checked" : ""
                              }>
                              <span class="check__box">${I.svg("check", 11)}</span>
                              <span>安装后修改过（写入 userModified）</span>
                            </label>`
                          : ""
                      }
                      <div class="meta-config__more">
                        <button class="meta-config__toggle" data-act="meta-more">
                          ${state.metaMoreOpen ? "收起可选字段" : "更多可选字段（英文描述、示例）"}
                        </button>
                        ${
                          state.metaMoreOpen
                            ? `<div class="meta-config__more-body">
                                <label class="meta-config__field">
                                  <span class="meta-config__label">英文描述</span>
                                  <input class="input" data-act="meta-desc-en"
                                         value="${esc(state.metaDescriptionEn)}"
                                         placeholder="English description（留空则不写入）" spellcheck="false">
                                </label>
                                <label class="meta-config__field">
                                  <span class="meta-config__label">示例 · 中文（逗号分隔）</span>
                                  <input class="input" data-act="meta-ex-zh"
                                         value="${esc(state.metaExamplesZh)}"
                                         placeholder="跑一篇草稿, 生成配图提示词" spellcheck="false">
                                </label>
                                <label class="meta-config__field">
                                  <span class="meta-config__label">示例 · 英文（逗号分隔）</span>
                                  <input class="input" data-act="meta-ex-en"
                                         value="${esc(state.metaExamplesEn)}"
                                         placeholder="Draft a post, Generate prompts" spellcheck="false">
                                </label>
                              </div>`
                            : ""
                        }
                      </div>
                      <div class="meta-config__preview">
                        <button class="meta-config__toggle" data-act="meta-preview">
                          ${
                            state.metaPreviewOpen
                              ? "收起预览"
                              : `预览生成的 JSON（以 ${esc(skills[0].name)} 为例）`
                          }
                        </button>
                        ${
                          state.metaPreviewOpen
                            ? `<pre class="meta-config__json">${
                                state.metaPreviewLoading ? "生成中…" : esc(state.metaPreview || "")
                              }</pre>`
                            : ""
                        }
                      </div>
                    </div>`
                  : ""
              }
            </div>

            <div class="field">
              <span class="field__label">目录结构</span>
              <div class="summary-bar" style="margin:0">
                ${I.svg("folder", 14)}
                <span>${
                  skills.length === 1
                    ? `单个导出：<code>${esc(
                        skills[0].name
                      )}/SKILL.md</code>（根目录直接是技能文件夹）`
                    : `批量导出：<code>skills/${
                        skills.length
                      } 个技能各自一个文件夹</code>`
                }</span>
              </div>
            </div>

            <div class="field">
              <span class="field__label">保存位置</span>
              <div class="path-box">
                ${I.svg("folder", 15)}
                <span class="path-box__text">${esc(pathText())}</span>
                <button class="path-box__action" data-act="pick-path">更改</button>
              </div>
            </div>

            <div class="summary-bar">
              ${I.svg("info", 14)}
              <span>共 ${skills.length} 个 SKILL · ${s.files} 个文件 · 预计 ${fmtBytes(s.bytes)}</span>
            </div>

            ${
              readonlyCount
                ? `<div class="notice notice--warn">${I.svg("warn", 14)}<span>其中 ${readonlyCount} 个来自只读目录，导出的是本地缓存副本。</span></div>`
                : ""
            }
            ${
              state.error
                ? `<div class="notice notice--error">${I.svg("warn", 14)}<span>${esc(state.error)}</span></div>`
                : ""
            }
          </div>
          <div class="dialog__foot">
            <span class="dialog__foot-hint">${I.svg("info", 13)}导出后可直接在其他工具中导入</span>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--primary" data-act="do-export" ${state.busy ? "disabled" : ""}>
                ${state.busy ? "正在导出…" : "开始导出"}
              </button>
            </div>
          </div>
        </div>`;
    }

    async function doExport() {
      if (state.busy) return;
      state.busy = true;
      state.error = "";
      refresh();

      try {
        if (state.format === "zip") {
          const { blob, filename, bytes } = await SH.io.exportZip(skills, options());

          // 支持保存位置选择时优先用 File System Access
          if (state.usePicker && window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [{ description: "ZIP 压缩包", accept: { "application/zip": [".zip"] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
          } else {
            SH.util.downloadBlob(blob, filename);
          }

          state.busy = false;
          close();
          SH.toast(`已导出 ${skills.length} 个 SKILL · ${fmtBytes(bytes)}`, "ok");
        } else {
          const { folderName } = await SH.io.exportFolder(skills, options());
          state.busy = false;
          close();
          SH.toast(`已写入文件夹 ${folderName}`, "ok");
        }
      } catch (err) {
        state.busy = false;
        const aborted = err && err.name === "AbortError";
        state.error = aborted
          ? "已取消保存"
          : err.message || "导出失败，请换一种格式再试";
        refresh();
      }
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();

      if (act === "format") {
        state.format = el.dataset.value;
        state.error = "";
        return refresh();
      }

      if (act === "pick-path") {
        state.usePicker = !window.showSaveFilePicker ? state.usePicker : !state.usePicker;
        if (!window.showSaveFilePicker) {
          SH.toast("当前浏览器不支持选择保存位置，将下载到默认目录", "info");
        }
        return refresh();
      }

      if (act === "meta-more") {
        state.metaMoreOpen = !state.metaMoreOpen;
        return refresh();
      }

      if (act === "meta-preview") {
        if (state.metaPreviewOpen) {
          state.metaPreviewOpen = false;
          return refresh();
        }
        state.metaPreviewOpen = true;
        state.metaPreviewLoading = true;
        refresh();
        SH.meta
          .build(skills[0], state.metaFormatId, options().metaOptions)
          .then((built) => {
            state.metaPreview = built.content;
          })
          .catch((err) => {
            state.metaPreview = `// 生成失败：${err.message}`;
          })
          .finally(() => {
            state.metaPreviewLoading = false;
            refresh();
          });
        return;
      }

      if (act === "do-export") return doExport();
    }

    const overlay = mount(render, handler);

    // 复选框 / 下拉用 change，文本框用 input（不重渲染，避免失焦）
    overlay.addEventListener("change", (event) => {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "include") {
        state[el.dataset.key] = el.checked;
        return refresh();
      }
      if (act === "include-meta") {
        state.includeMeta = el.checked;
        return refresh();
      }
      if (act === "meta-reuse") {
        state.metaReuse = el.checked;
        return refresh();
      }
      if (act === "meta-modified") {
        state.metaUserModified = el.checked;
        return refresh();
      }
      if (act === "meta-format") {
        state.metaFormatId = el.value;
        state.metaPreview = null;
        return refresh();
      }
      if (act === "meta-source") {
        state.metaSource = el.value;
        state.metaPreview = null;
        return refresh();
      }
    });

    overlay.addEventListener("input", (event) => {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;
      if (act === "meta-skill-id") state.metaSkillId = el.value;
      else if (act === "meta-desc-en") state.metaDescriptionEn = el.value;
      else if (act === "meta-ex-zh") state.metaExamplesZh = el.value;
      else if (act === "meta-ex-en") state.metaExamplesEn = el.value;
      else return;
      state.metaPreview = null;
    });
  }

  /* ============================================================
     添加 SKILL 目录
     ============================================================ */
  function openAddSource() {
    const state = {
      dirHandle: null,
      dirName: "",
      scanning: false,
      progress: 0,
      found: null,
      error: "",
      pathText: "",
      displayName: "",
    };

    function readOnlySourceRows() {
      return store.state.sources
        .map(
          (src) => `
          <div class="source-row">
            <span class="dot" style="background:${store.sourceColor(src)}"></span>
            <span class="source-row__name" title="${esc(src.name)}">${esc(src.name)} · ${
            store.sourceCounts()[src.id] || 0
          } 个</span>
            <span class="source-row__path">${esc(src.path)}</span>
            <button class="source-row__remove" data-act="edit-source" data-id="${esc(
              src.id
            )}">编辑</button>
            ${
              src.builtin
                ? ""
                : `<button class="source-row__remove source-row__remove--danger" data-act="remove-source" data-id="${esc(
                    src.id
                  )}">移除</button>`
            }
          </div>`
        )
        .join("");
    }

    function render() {
      return `
        <div class="dialog dialog--sm" role="dialog" aria-modal="true" aria-label="添加 SKILL 目录">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">添加 SKILL 目录</h2>
              <p class="dialog__subtitle">选择任意包含 SKILL.md 的目录，自动解析并归类</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="field">
              <span class="field__label">目录路径</span>
              <div class="input-row">
                <input class="input input--mono" id="sourcePathInput" placeholder="粘贴目录路径，或点「浏览」选择"
                       value="${esc(state.pathText)}" autocomplete="off" spellcheck="false">
                <button class="btn btn--outline" style="height:28px;padding:0 10px" data-act="browse">浏览…</button>
              </div>
              <p class="field__help">浏览器环境需要一次目录授权才能读取文件；手填路径仅作记录，无法扫描内容。</p>
            </div>

            <div class="field">
              <span class="field__label">显示名称</span>
              <input class="input" id="sourceNameInput" maxlength="24"
                     placeholder="侧栏里显示的名字，例如：团队共享技能"
                     value="${esc(state.displayName)}" autocomplete="off" spellcheck="false">
              <p class="field__help">默认取目录名，之后也可以在来源列表里随时改名。</p>
            </div>

            ${
              state.scanning
                ? `<div class="scan-box">
                     <div class="scan-box__text"><span>正在扫描 SKILL.md…</span><span class="mono">${state.progress}%</span></div>
                     <div class="progress"><div class="progress__bar" style="width:${state.progress}%"></div></div>
                   </div>`
                : ""
            }
            ${
              state.found
                ? `<div class="notice">${I.svg("info", 14)}<span>扫描完成：发现 ${state.found.length} 个 SKILL，确认后会作为新来源加入侧栏。</span></div>`
                : ""
            }
            ${
              state.error
                ? `<div class="notice notice--error">${I.svg("warn", 14)}<span>${esc(state.error)}</span></div>`
                : ""
            }

            <div style="height:1px;background:var(--line)"></div>

            <div class="field">
              <span class="field__label">已启用的来源 · ${store.state.sources.length}</span>
              <div class="source-list">${readOnlySourceRows()}</div>
            </div>

            <div class="notice">${I.svg("info", 14)}<span>自定义目录会与内置来源一起出现在侧栏，可随时移除。扫描为本地只读操作。</span></div>
          </div>
          <div class="dialog__foot">
            <span class="dialog__foot-hint">扫描为本地只读操作，不会修改源文件</span>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--primary" data-act="confirm" ${!state.found ? "disabled" : ""}>
                ${state.found ? `添加 ${state.found.length} 个 SKILL` : "扫描并添加"}
              </button>
            </div>
          </div>
        </div>`;
    }

    async function collect(dirHandle, prefix = "", depth = 0, acc = { files: [] }) {
      if (depth > 4 || acc.files.length > 500) return acc;
      for await (const [name, handle] of dirHandle.entries()) {
        const path = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === "file") {
          acc.files.push({ name, path, handle });
        } else if (handle.kind === "directory") {
          await collect(handle, path, depth + 1, acc);
        }
      }
      return acc;
    }

    async function browse() {
      // 桌面端：系统目录选择器 + 后端直接扫描
      if (SH.native && SH.native.isNative) {
        const dir = await SH.native.pickDirectory();
        if (!dir) return;

        state.dirHandle = null;
        state.dirName = baseNameOfPath(dir);
        state.pathText = dir;
        if (!state.displayName) state.displayName = dir;
        state.found = null;
        state.error = "";
        state.scanning = true;
        refresh();

        const roots = await SH.native.scanRoots([dir]);
        state.scanning = false;

        const root = roots && roots[0];
        if (root && root.exists) {
          state.found = root.skills.map((s) => SH.native.toSkill(s, "pending"));
        } else {
          state.error = "无法读取该目录，请确认路径是否存在";
        }
        refresh();
        return;
      }

      if (!window.showDirectoryPicker) {
        state.error = "当前浏览器不支持目录选择，请改用「导入 SKILL」选择 ZIP 包。";
        return refresh();
      }
      try {
        const handle = await window.showDirectoryPicker({ mode: "read" });
        state.dirHandle = handle;
        state.dirName = handle.name;
        state.pathText = `~/${handle.name}`;
        if (!state.displayName) state.displayName = handle.name;
        state.found = null;
        state.error = "";
        refresh();
        return scan();
      } catch (err) {
        if (err && err.name === "AbortError") return;
        state.error = err.message || "无法读取该目录";
        refresh();
      }
    }

    async function scan() {
      if (!state.dirHandle) return;
      state.scanning = true;
      state.progress = 8;
      state.error = "";
      refresh();

      const timer = setInterval(() => {
        if (state.progress < 88) {
          state.progress += 6;
          refresh();
        }
      }, 90);

      try {
        const acc = await collect(state.dirHandle);
        const skillFiles = acc.files.filter((f) => /^SKILL\.md$/i.test(f.name));
        const items = [];

        for (const file of skillFiles) {
          const text = await (await file.handle.getFile()).text();
          const dir = file.path.replace(/\/?SKILL\.md$/i, "");
          const meta = SH.md.splitFrontmatter(text).frontmatter;
          const map = {};
          if (meta) meta.pairs.forEach(([k, v]) => (map[k.toLowerCase()] = v));
          items.push({
            name: map.name || (dir ? dir.split("/").pop() : state.dirName),
            description: map.description || "从自定义目录扫描到的 SKILL",
            content: text,
            files: [{ name: "SKILL.md", content: text, size: SH.util.byteLength(text) }],
            origin: dir || "根目录",
          });
        }

        clearInterval(timer);
        state.scanning = false;
        state.progress = 100;

        if (!items.length) {
          state.error =
            "这个目录里没有找到 SKILL.md。请确认目录结构，或改用「导入 SKILL」选择 ZIP 包。";
        }
        state.found = items;
        refresh();
      } catch (err) {
        clearInterval(timer);
        state.scanning = false;
        state.error = err.message || "扫描失败";
        refresh();
      }
    }

    function confirm() {
      if (!state.found) return;
      const name = String(state.displayName || state.dirName || "").trim();
      if (!name) {
        state.error = "请先填写这个来源的显示名称";
        return refresh();
      }
      const res = store.addSource({
        name,
        path: state.pathText,
        count: state.found.length,
      });
      if (!res.ok) {
        state.error = res.reason;
        return refresh();
      }
      // 桌面端记住真实路径，后续同步/卸载才能落到磁盘
      if (SH.native && SH.native.isNative) {
        const src = store.getSource(res.id);
        if (src) {
          src.nativePath = state.pathText;
          src.native = true;
        }
      }
      const result = store.importSkills(state.found, res.id, "rename");
      close();
      store.setSource(res.id);
      SH.toast(`已添加「${name}」并导入 ${result.added} 个 SKILL`, "ok");
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();
      if (act === "browse") return browse();
      if (act === "confirm") return confirm();
      if (act === "edit-source") return openSourceEditor(el.dataset.id);
      if (act === "remove-source") {
        const res = store.removeSource(el.dataset.id);
        if (!res.ok) SH.toast(res.reason, "error");
        else SH.toast(`已移除来源，连带 ${res.removed} 个 SKILL`, "ok");
        return refresh();
      }
    }

    mount(render, handler);

    // 路径输入只记录，不触发重渲染（避免失焦）
    const overlay = current.overlay;
    overlay.addEventListener("input", (event) => {
      if (event.target.id === "sourcePathInput") {
        state.pathText = event.target.value;
        state.found = null;
        const btn = overlay.querySelector('[data-act="confirm"]');
        if (btn) {
          btn.disabled = true;
          btn.textContent = "扫描并添加";
        }
        return;
      }
      if (event.target.id === "sourceNameInput") {
        state.displayName = event.target.value;
      }
    });
  }

  /* ============================================================
     分类 / 来源编辑
     ============================================================ */
  const PALETTE = [
    "#7FA6A0",
    "#C0A97E",
    "#8CA3B8",
    "#B89A9C",
    "#9BAE8C",
    "#A9A8A2",
    "#9C8FB0",
    "#C08F72",
  ];

  function swatches(current) {
    return `<div class="swatches">${PALETTE.map(
      (c) =>
        `<button class="swatch ${c.toLowerCase() === String(current).toLowerCase() ? "is-active" : ""}"
                 data-act="color" data-value="${c}" style="background:${c}"
                 title="${c}" aria-label="颜色 ${c}"></button>`
    ).join("")}</div>`;
  }

  /**
   * 新建 / 编辑标记：名称 + 颜色。
   * 标记是纯本地概念，只影响卡片展示与侧栏归类，不写进技能目录。
   */
  function openMarkEditor(markId) {
    const editing = markId ? store.getMark(markId) : null;
    const state = {
      name: editing ? editing.name : "",
      color: editing ? editing.color : store.MARK_COLORS[0],
      error: "",
      confirmDelete: false,
    };

    function render() {
      return `
        <div class="dialog dialog--xs" role="dialog" aria-modal="true"
             aria-label="${editing ? "编辑标记" : "新建标记"}">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">${editing ? "编辑标记" : "新建标记"}</h2>
              <p class="dialog__subtitle">标记显示在卡片上，用颜色区分用途</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="field">
              <span class="field__label">名称</span>
              <input class="input" id="markName" maxlength="12"
                     placeholder="例如：常用、待整理、客户项目"
                     value="${esc(state.name)}" autocomplete="off" spellcheck="false">
            </div>
            <div class="field">
              <span class="field__label">颜色</span>
              <div class="swatches">
                ${store.MARK_COLORS.map(
                  (c) => `<button class="swatch ${c === state.color ? "is-active" : ""}"
                              data-act="color" data-color="${c}"
                              style="background:${c}" aria-label="选择颜色 ${c}"></button>`
                ).join("")}
                <label class="swatch swatch--custom ${
                  store.MARK_COLORS.indexOf(state.color) < 0 ? "is-active" : ""
                }" title="自定义颜色">
                  <input type="color" id="markCustomColor" value="${esc(state.color)}"
                         aria-label="自定义颜色">
                </label>
              </div>
            </div>
            ${
              state.error
                ? `<p class="field__help" style="color:var(--danger,#c0392b)">${esc(
                    state.error
                  )}</p>`
                : ""
            }
          </div>
          <div class="dialog__foot">
            <div class="dialog__foot-hint">
              ${
                editing
                  ? state.confirmDelete
                    ? `<button class="btn btn--danger btn--sm" data-act="delete">确认删除标记</button>`
                    : `<button class="link-danger" data-act="ask-delete">删除标记</button>`
                  : ""
              }
            </div>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--primary" data-act="save">保存</button>
            </div>
          </div>
        </div>`;
    }

    /** 只同步色块选中态，不碰输入框 */
    function syncSwatches() {
      const box = root.querySelector(".swatches");
      if (!box) return;

      box.querySelectorAll("[data-color]").forEach((el) => {
        el.classList.toggle("is-active", el.dataset.color === state.color);
      });

      const custom = box.querySelector(".swatch--custom");
      if (custom) {
        const isPreset = store.MARK_COLORS.indexOf(state.color) >= 0;
        custom.classList.toggle("is-active", !isPreset);
        const input = custom.querySelector("input");
        if (input && input.value.toLowerCase() !== state.color.toLowerCase()) {
          input.value = state.color;
        }
      }
    }

    function save() {
      const name = state.name.trim();
      if (!name) {
        state.error = "标记名称不能为空";
        return refresh();
      }
      const res = editing
        ? store.updateMark(editing.id, { name, color: state.color })
        : store.addMark({ name, color: state.color });
      if (!res.ok) {
        state.error = res.reason;
        return refresh();
      }
      close();
      SH.toast(editing ? "标记已更新" : `已创建标记「${name}」`, "ok");
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;
      if (act === "close") return close();
      if (act === "color") {
        state.color = el.dataset.color;
        // 关键：只切色块的选中态，不重绘整个弹窗。
        // 重绘会重建 input，导致未提交的名称被清空、焦点丢失（表现为闪屏）。
        syncSwatches();
        return;
      }
      if (act === "save") return save();
      if (act === "ask-delete") {
        state.confirmDelete = true;
        return refresh();
      }
      if (act === "delete") {
        const res = store.removeMark(editing.id);
        close();
        SH.toast(
          res.ok ? `标记已删除，${res.cleared} 个 SKILL 已解除标记` : res.reason,
          res.ok ? "ok" : "error"
        );
      }
    }

    mount(render, handler);

    const input = document.querySelector("#markName");
    if (input) {
      input.focus();
      input.addEventListener("input", () => {
        state.name = input.value;
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        }
      });
    }

    const customColor = document.querySelector("#markCustomColor");
    if (customColor) {
      customColor.addEventListener("input", () => {
        state.color = customColor.value;
        syncSwatches();
      });
    }
  }

  /** 卡片上的标记选择器：选一个已有标记，或直接新建 */
  function openMarkPicker(skillId) {
    const skill = store.getSkill(skillId);
    if (!skill) return;
    const current = skill.markId || null;

    function render() {
      const marks = store.state.marks;
      return `
        <div class="dialog dialog--xs" role="dialog" aria-modal="true" aria-label="设置标记">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">标记</h2>
              <p class="dialog__subtitle">${esc(store.displayName(skill))}</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="mark-picker">
              <button class="mark-item ${!current ? "is-active" : ""}" data-act="pick" data-id="">
                <span class="mark-item__dot" style="background:var(--line-strong)"></span>
                <span class="mark-item__name">无标记</span>
                ${!current ? `<span class="mark-item__check">${I.svg("check", 12)}</span>` : ""}
              </button>
              ${marks
                .map(
                  (m) => `
                <button class="mark-item ${current === m.id ? "is-active" : ""}"
                        data-act="pick" data-id="${esc(m.id)}">
                  <span class="mark-item__dot" style="background:${esc(m.color)}"></span>
                  <span class="mark-item__name">${esc(m.name)}</span>
                  ${current === m.id ? `<span class="mark-item__check">${I.svg("check", 12)}</span>` : ""}
                </button>`
                )
                .join("")}
            </div>
            <button class="btn btn--outline btn--sm" data-act="new"
                    style="align-self:flex-start;margin-top:8px">＋ 新建标记</button>
          </div>
        </div>`;
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();

      if (act === "pick") {
        const id = el.dataset.id || null;
        const res = store.setSkillMark(skillId, id);
        close();
        if (!res.ok) {
          SH.toast(res.reason, "error");
          return;
        }
        const mark = id ? store.getMark(id) : null;
        SH.toast(mark ? `已标记为「${mark.name}」` : "已清除标记", "ok");
        return;
      }

      if (act === "new") {
        close();
        openMarkEditor();
        return;
      }
    }

    mount(render, handler);
  }

  /**
   * 删除整个 SKILL：列出将被移动的目录，二次确认后移入回收站。
   */
  function openDeleteSkill(skillId) {
    const skill = store.getSkill(skillId);
    if (!skill) return;

    const key = skill.name.toLowerCase();
    const records = store.state.skills.filter((s) => s.name.toLowerCase() === key);
    const dirs = records.map((r) => r.nativeDir).filter(Boolean);
    const state = { busy: false };

    function render() {
      return `
        <div class="dialog dialog--sm" role="dialog" aria-modal="true" aria-label="删除 SKILL">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">删除 SKILL</h2>
              <p class="dialog__subtitle">${esc(store.displayName(skill))} · ${records.length} 个安装点</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <p class="field__help" style="margin-bottom:6px">以下目录会被移动到回收站：</p>
            <ul class="danger-list">
              ${
                dirs.length
                  ? dirs
                      .map((d) => `<li class="danger-list__item">${esc(d)}</li>`)
                      .join("")
                  : `<li class="danger-list__item">没有本地目录，仅从列表中移除</li>`
              }
            </ul>
            <p class="field__help" style="margin-top:8px">
              回收站位置：<code>data/trash/&lt;时间戳&gt;/&lt;技能名&gt;</code>，
              可通过「设置 → 打开数据目录」找回。
            </p>
          </div>
          <div class="dialog__foot">
            <div class="dialog__foot-hint">删除不可在应用内撤销</div>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--danger" data-act="confirm" ${
                state.busy ? "disabled" : ""
              }>${state.busy ? "删除中…" : "确认删除"}</button>
            </div>
          </div>
        </div>`;
    }

    async function doDelete() {
      if (state.busy) return;
      state.busy = true;
      refresh();

      const res = await store.deleteSkill(skillId);
      close();

      if (!res.ok) {
        SH.toast(res.reason || "删除失败", "error");
        return;
      }
      SH.toast(
        res.persisted
          ? `已删除 ${skill.name}，可在回收站找回`
          : `已从列表移除 ${skill.name}（浏览器预览不改动磁盘）`,
        res.persisted ? "ok" : "warn"
      );
      if (res.failed && res.failed.length) {
        SH.toast(`${res.failed.length} 个目录移动失败，可能正被占用`, "warn");
      }
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;
      if (act === "close") return close();
      if (act === "confirm") return void doDelete();
    }

    mount(render, handler);
  }

  /**
   * 新建 SKILL：选一个可写目录，填名字与描述，
   * 生成 SKILL.md 后写盘，再重扫让列表立刻出现。
   */
  function openNewSkill() {
    if (!SH.native.isNative) {
      SH.toast("浏览器预览无法写入磁盘，请在桌面版新建", "warn");
      return;
    }
    const writable = store.state.sources.filter((s) => s.nativePath && !s.readonly);
    if (!writable.length) {
      SH.toast("先添加一个可写的 SKILL 目录", "warn");
      return;
    }

    const state = {
      sourceId: writable[0].id,
      name: "",
      description: "",
      error: "",
      busy: false,
    };

    function render() {
      return `
        <div class="dialog" role="dialog" aria-modal="true" aria-label="新建 SKILL">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">新建 SKILL</h2>
              <p class="dialog__subtitle">会在所选目录下创建同名文件夹与 SKILL.md</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="field">
              <span class="field__label">创建到</span>
              <select class="input" id="newSkillSource">
                ${writable
                  .map(
                    (s) =>
                      `<option value="${esc(s.id)}" ${
                        s.id === state.sourceId ? "selected" : ""
                      }>${esc(s.name)} · ${esc(s.nativePath)}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="field">
              <span class="field__label">名称</span>
              <input class="input input--mono" id="newSkillName" maxlength="60"
                     placeholder="my-new-skill"
                     value="${esc(state.name)}" autocomplete="off" spellcheck="false">
              <span class="field__help">小写字母、数字和短横线，会作为目录名</span>
            </div>
            <div class="field">
              <span class="field__label">描述</span>
              <input class="input" id="newSkillDesc" maxlength="200"
                     placeholder="一句话说明这个 SKILL 做什么"
                     value="${esc(state.description)}" autocomplete="off">
            </div>
            ${
              state.error
                ? `<p class="field__help" style="color:var(--danger,#c0392b)">${esc(
                    state.error
                  )}</p>`
                : ""
            }
          </div>
          <div class="dialog__foot">
            <div class="dialog__foot-hint">创建后可直接在编辑器里补充内容</div>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--primary" data-act="create" ${
                state.busy ? "disabled" : ""
              }>${state.busy ? "创建中…" : "创建"}</button>
            </div>
          </div>
        </div>`;
    }

    async function create() {
      if (state.busy) return;
      const name = state.name.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
        state.error = "名称只能用小写字母、数字和短横线，且以字母或数字开头";
        return refresh();
      }
      if (store.state.skills.some((s) => s.name.toLowerCase() === name)) {
        state.error = "已存在同名 SKILL，换个名字";
        return refresh();
      }
      const src = store.getSource(state.sourceId);
      if (!src || !src.nativePath) {
        state.error = "所选目录不可用";
        return refresh();
      }

      state.busy = true;
      state.error = "";
      refresh();

      const desc = state.description.trim() || "新建的 SKILL";
      const content = `---\nname: ${name}\ndescription: ${desc}\n---\n\n# ${name}\n\n${desc}\n`;

      try {
        await SH.native.writeSkill(src.nativePath, name, [
          { name: "SKILL.md", content },
        ]);
      } catch (err) {
        state.busy = false;
        state.error = `写入失败：${String((err && err.message) || err)}`;
        return refresh();
      }

      close();
      SH.toast(`已创建 ${name}`, "ok");

      // 重扫后按名字找回新技能，直接进编辑器继续写内容
      try {
        const roots = await SH.native.defaultRoots();
        const scanned = await SH.native.scanRoots(roots);
        if (scanned) {
          const result = store.applyNativeScan(scanned);
          const created =
            result.applied &&
            store.state.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
          if (created && SH.editor) {
            store.selectSkill(created.id);
            SH.editor.open(created.id, "SKILL.md");
            return;
          }
        }
        SH.toast("已创建，但没能自动打开编辑器，可从列表进入", "warn");
      } catch (err) {
        SH.toast("已写入，但列表刷新失败，可点右上角重新扫描", "warn");
      }
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;
      if (act === "close") return close();
      if (act === "create") return void create();
    }

    mount(render, handler);

    const sel = document.querySelector("#newSkillSource");
    if (sel) sel.addEventListener("change", () => { state.sourceId = sel.value; });

    const nameInput = document.querySelector("#newSkillName");
    if (nameInput) {
      nameInput.focus();
      nameInput.addEventListener("input", () => { state.name = nameInput.value; });
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); create(); }
      });
    }
    const descInput = document.querySelector("#newSkillDesc");
    if (descInput) {
      descInput.addEventListener("input", () => { state.description = descInput.value; });
    }
  }

  function openCategoryEditor(categoryId) {
    const editing = categoryId ? store.getCategory(categoryId) : null;
    const state = {
      name: editing ? editing.name : "",
      color: editing
        ? editing.color || "#7FA6A0"
        : PALETTE[store.state.categories.length % PALETTE.length],
      confirmDelete: false,
      error: "",
    };

    function render() {
      return `
        <div class="dialog dialog--xs" role="dialog" aria-modal="true" aria-label="${
          editing ? "编辑分类" : "新建分类"
        }">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">${editing ? "编辑分类" : "新建分类"}</h2>
              <p class="dialog__subtitle">分类会出现在侧栏，用于给 SKILL 归组</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="field">
              <span class="field__label">名称</span>
              <input class="input" id="catNameInput" maxlength="16"
                     placeholder="例如：前端工程、内容运营"
                     value="${esc(state.name)}" autocomplete="off" spellcheck="false">
            </div>
            <div class="field">
              <span class="field__label">颜色</span>
              ${swatches(state.color)}
            </div>
            ${
              state.error
                ? `<div class="notice notice--error">${I.svg("warn", 14)}<span>${esc(state.error)}</span></div>`
                : ""
            }
            ${
              editing
                ? `<p class="meta-section__note">删除后，这个分类下的 SKILL 会移到其他分类，不会被删除。</p>`
                : ""
            }
          </div>
          <div class="dialog__foot">
            <div class="dialog__foot-hint">
              ${
                editing
                  ? state.confirmDelete
                    ? `<button class="btn btn--danger btn--sm" data-act="delete">确认删除分类</button>`
                    : `<button class="link-danger" data-act="ask-delete">删除分类</button>`
                  : ""
              }
            </div>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--primary" data-act="save">保存</button>
            </div>
          </div>
        </div>`;
    }

    function save() {
      const name = state.name.trim();
      if (!name) {
        state.error = "分类名称不能为空";
        return refresh();
      }
      const res = editing
        ? store.updateCategory(editing.id, { name, color: state.color })
        : store.addCategory({ name, color: state.color });
      if (!res.ok) {
        state.error = res.reason;
        return refresh();
      }
      close();
      SH.toast(editing ? `已更新分类「${name}」` : `已创建分类「${name}」`, "ok");
    }

    function remove() {
      const res = store.removeCategory(editing.id);
      if (!res.ok) {
        state.error = res.reason;
        return refresh();
      }
      close();
      SH.toast(`已删除分类，「${res.moved} 个 SKILL」移到「${res.fallbackName}」`, "ok");
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();
      if (act === "color") {
        state.color = el.dataset.value;
        return refresh();
      }
      if (act === "save") return save();
      if (act === "ask-delete") {
        state.confirmDelete = true;
        return refresh();
      }
      if (act === "delete") return remove();
    }

    const overlay = mount(render, handler);
    overlay.addEventListener("input", (event) => {
      if (event.target.id === "catNameInput") state.name = event.target.value;
    });
    const input = overlay.querySelector("#catNameInput");
    if (input) {
      input.focus();
      input.select();
    }
  }

  function openSourceEditor(sourceId) {
    const src = store.getSource(sourceId);
    if (!src) return;

    const state = {
      name: src.name,
      path: src.path,
      color: store.sourceColor(src),
      confirmDelete: false,
      error: "",
    };

    function render() {
      const count = store.sourceCounts()[src.id] || 0;
      return `
        <div class="dialog dialog--xs" role="dialog" aria-modal="true" aria-label="编辑来源">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">编辑来源</h2>
              <p class="dialog__subtitle">${esc(src.name)} · ${count} 个 SKILL${
        src.builtin ? " · 内置来源" : ""
      }</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="field">
              <span class="field__label">显示名称</span>
              <input class="input" id="srcNameInput" maxlength="24"
                     placeholder="例如：团队共享技能、个人实验目录"
                     value="${esc(state.name)}" autocomplete="off" spellcheck="false">
              <p class="field__help">这是侧栏里显示的名字，随时可以再改。</p>
            </div>
            <div class="field">
              <span class="field__label">目录路径</span>
              <input class="input input--mono" id="srcPathInput"
                     value="${esc(state.path)}" autocomplete="off" spellcheck="false"
                     ${src.builtin ? "disabled" : ""}>
              <p class="field__help">${
                src.builtin
                  ? "内置来源的路径由 Agent 决定，不可修改。"
                  : "改路径只影响展示与后续写入位置，已导入的 SKILL 不会移动。"
              }</p>
            </div>
            <div class="field">
              <span class="field__label">标识颜色</span>
              ${swatches(state.color)}
            </div>
            ${
              state.error
                ? `<div class="notice notice--error">${I.svg("warn", 14)}<span>${esc(state.error)}</span></div>`
                : ""
            }
          </div>
          <div class="dialog__foot">
            <div class="dialog__foot-hint">
              ${
                src.builtin
                  ? "内置来源不可移除"
                  : state.confirmDelete
                  ? `<button class="btn btn--danger btn--sm" data-act="delete">确认移除来源</button>`
                  : `<button class="link-danger" data-act="ask-delete">移除来源</button>`
              }
            </div>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--primary" data-act="save">保存</button>
            </div>
          </div>
        </div>`;
    }

    function save() {
      const name = state.name.trim();
      if (!name) {
        state.error = "来源名称不能为空";
        return refresh();
      }
      const res = store.updateSource(src.id, {
        name,
        path: src.builtin ? undefined : state.path,
        color: state.color.startsWith("#") ? state.color : undefined,
      });
      if (!res.ok) {
        state.error = res.reason;
        return refresh();
      }
      close();
      SH.toast(`已更新来源「${name}」`, "ok");
    }

    function remove() {
      const res = store.removeSource(src.id);
      if (!res.ok) {
        state.error = res.reason;
        return refresh();
      }
      close();
      SH.toast(`已移除来源，连带 ${res.removed} 个 SKILL`, "ok");
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();
      if (act === "color") {
        state.color = el.dataset.value;
        return refresh();
      }
      if (act === "save") return save();
      if (act === "ask-delete") {
        state.confirmDelete = true;
        return refresh();
      }
      if (act === "delete") return remove();
    }

    const overlay = mount(render, handler);
    overlay.addEventListener("input", (event) => {
      if (event.target.id === "srcNameInput") state.name = event.target.value;
      if (event.target.id === "srcPathInput") state.path = event.target.value;
    });
    const input = overlay.querySelector("#srcNameInput");
    if (input) {
      input.focus();
      input.select();
    }
  }

  /* ============================================================
     来源标记编辑（_skillhub_meta.json 等）
     ============================================================ */
  function toLocalInput(ts) {
    const d = new Date(ts || Date.now());
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  /** SKILL.md 里的 name（调用时用于匹配），取不到则退回技能名 */
  function skillCallName(skill) {
    const { frontmatter } = SH.md.splitFrontmatter(skill.content || "");
    if (frontmatter) {
      const hit = frontmatter.pairs.find(([k]) => String(k).toLowerCase() === "name");
      if (hit && hit[1] && String(hit[1]).trim()) return String(hit[1]).trim();
    }
    return skill.name;
  }

  function openMetaEditor(skillId) {
    const skill = store.getSkill(skillId);
    if (!skill) return;

    const mdName = skillCallName(skill);
    const existing = skill.meta;
    const initial = existing && existing.data ? existing.data : {};
    const formatId = existing ? existing.formatId : SH.meta.resolveFormat(skill.sourceId);

    const state = {
      creating: !existing,
      formatId,
      name: initial.name || initial.slug || skill.name,
      version: initial.version || SH.meta.normalizeVersion(skill.version),
      source: initial.source || "local",
      installedAt: toLocalInput(initial.installedAt || initial.publishedAt || Date.now()),
      userModified: !!initial.userModified,
      skillIdValue: initial.skillId || "",
      ownerId: initial.ownerId || "",
      descriptionZh: initial.description_zh || skill.description || "",
      descriptionEn: initial.description_en || "",
      examplesZh: Array.isArray(initial.examples_zh) ? initial.examples_zh.join(", ") : "",
      examplesEn: Array.isArray(initial.examples_en) ? initial.examples_en.join(", ") : "",
      error: "",
      busy: false,
    };

    function sameName() {
      return state.name.trim().toLowerCase() === mdName.trim().toLowerCase();
    }

    function nameHintText() {
      return sameName()
        ? "两者当前一致。元数据名称可以改成中文显示名，不影响调用。"
        : "两者不同：应用里显示的是元数据名称；调用时 WorkBuddy 按 SKILL.md 名称自动匹配，这是正常用法。";
    }

    function render() {
      const fmt = SH.meta.getFormat(state.formatId);
      const isUser = fmt.id === "workbuddy-user";
      const isPlugin = fmt.id === "workbuddy-plugin";

      return `
        <div class="dialog dialog--sm" role="dialog" aria-modal="true" aria-label="来源标记">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">${state.creating ? "添加来源标记" : "编辑来源标记"}</h2>
              <p class="dialog__subtitle">${esc(skill.name)} · 写入 ${esc(fmt.fileName)}</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>
          <div class="dialog__body">
            <div class="field">
              <span class="field__label">格式</span>
              ${
                state.creating
                  ? `<select class="select" data-act="format">
                      ${SH.meta
                        .groupedFormats()
                        .map(
                          (g) =>
                            `<optgroup label="${esc(g.agentName)}">${g.items
                              .map(
                                (f) =>
                                  `<option value="${esc(f.id)}" ${
                                    f.id === state.formatId ? "selected" : ""
                                  }>${esc(f.label)}</option>`
                              )
                              .join("")}</optgroup>`
                        )
                        .join("")}
                    </select>
                    <p class="field__help">${esc(fmt.note)}</p>`
                  : `<div class="meta-editor__fixed">
                       <span>${esc(fmt.agentName)} · ${esc(fmt.label)}</span>
                       <code>${esc(fmt.fileName)}</code>
                     </div>
                     <p class="field__help">格式由现有标记决定；要换格式，可在导出时重新生成。</p>`
              }
            </div>

            <div class="name-pair">
              <div class="name-pair__row">
                <span class="name-pair__label">SKILL.md 名称<em>调用时匹配 · 不可改</em></span>
                <code class="name-pair__md" title="${esc(mdName)}">${esc(mdName)}</code>
              </div>
              <div class="name-pair__row">
                <span class="name-pair__label">元数据名称<em>应用内显示 · 可中文</em></span>
                <input class="input" data-act="name" maxlength="64"
                       value="${esc(state.name)}" placeholder="例如：文档报告生成器">
                <button class="name-pair__sync" data-act="sync-name" title="把元数据名称改成与 SKILL.md 一致">同步</button>
              </div>
              <p class="name-pair__hint">${esc(nameHintText())}</p>
            </div>

            <div class="field-grid">
              <label class="field">
                <span class="field__label">版本</span>
                <input class="input input--mono" data-act="version" value="${esc(
                  state.version
                )}" placeholder="1.0.0">
              </label>
              ${
                fmt.needsSource
                  ? `<label class="field">
                       <span class="field__label">来源类型</span>
                       <select class="select" data-act="source">
                         ${SH.meta.SOURCE_OPTIONS.map(
                           (o) =>
                             `<option value="${esc(o.value)}" ${
                               o.value === state.source ? "selected" : ""
                             }>${esc(o.label)}</option>`
                         ).join("")}
                       </select>
                     </label>`
                  : ""
              }
              <label class="field">
                <span class="field__label">${isPlugin ? "发布时间" : "安装时间"}</span>
                <input class="input input--mono" type="datetime-local" data-act="installed-at"
                       value="${esc(state.installedAt)}">
              </label>
            </div>

            ${
              isPlugin
                ? `<label class="field">
                     <span class="field__label">发布者 ID</span>
                     <input class="input input--mono" data-act="owner-id" value="${esc(
                       state.ownerId
                     )}" placeholder="525909">
                   </label>`
                : ""
            }
            ${
              fmt.needsSkillId
                ? `<label class="field">
                     <span class="field__label">技能 ID（可选）</span>
                     <input class="input input--mono" data-act="skill-id" value="${esc(
                       state.skillIdValue
                     )}" placeholder="skill_...">
                   </label>`
                : ""
            }

            ${
              isUser
                ? `<div class="notice">${I.svg("info", 14)}<span>用户导入格式只记录名称、安装时间与来源类型，其余字段不会写入。</span></div>`
                : `
                  <label class="field">
                    <span class="field__label">中文描述</span>
                    <textarea class="input textarea" data-act="desc-zh" rows="2">${esc(
                      state.descriptionZh
                    )}</textarea>
                  </label>
                  <label class="field">
                    <span class="field__label">英文描述（可选）</span>
                    <input class="input" data-act="desc-en" value="${esc(
                      state.descriptionEn
                    )}" placeholder="留空则不写入这一项" spellcheck="false">
                  </label>
                  <div class="field-grid">
                    <label class="field">
                      <span class="field__label">示例 · 中文（逗号分隔）</span>
                      <input class="input" data-act="ex-zh" value="${esc(state.examplesZh)}">
                    </label>
                    <label class="field">
                      <span class="field__label">示例 · 英文（逗号分隔）</span>
                      <input class="input" data-act="ex-en" value="${esc(
                        state.examplesEn
                      )}" spellcheck="false">
                    </label>
                  </div>
                  ${
                    fmt.supportsModified
                      ? `<label class="check check--sm">
                           <input type="checkbox" data-act="modified" ${
                             state.userModified ? "checked" : ""
                           }>
                           <span class="check__box">${I.svg("check", 11)}</span>
                           <span>安装后修改过（写入 userModified）</span>
                         </label>`
                      : ""
                  }
                `
            }

            ${
              state.error
                ? `<div class="notice notice--error">${I.svg("warn", 14)}<span>${esc(
                    state.error
                  )}</span></div>`
                : ""
            }
          </div>
          <div class="dialog__foot">
            <div class="dialog__foot-hint">
              ${
                state.creating
                  ? ""
                  : `<button class="link-danger" data-act="remove-meta">删除标记文件</button>`
              }
            </div>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              <button class="btn btn--primary" data-act="save" ${
                state.busy ? "disabled" : ""
              }>${state.busy ? "保存中…" : "保存"}</button>
            </div>
          </div>
        </div>`;
    }

    async function save() {
      if (state.busy) return;
      const name = state.name.trim();
      if (!name) {
        state.error = "名称不能为空";
        return refresh();
      }
      const version = state.version.trim();
      if (!version) {
        state.error = "版本不能为空";
        return refresh();
      }

      state.busy = true;
      state.error = "";
      refresh();

      const fmt = SH.meta.getFormat(state.formatId);
      const ts = new Date(state.installedAt).getTime() || Date.now();
      const split = (text) =>
        String(text || "")
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean);

      let data;

      if (fmt.id === "workbuddy-user") {
        data = { name, installedAt: ts, source: "userImport" };
      } else if (fmt.id === "workbuddy-plugin") {
        data = {
          ownerId: state.ownerId.trim() || "local",
          slug: name,
          version,
          publishedAt: ts,
        };
      } else {
        data = { name, installedAt: ts, source: state.source, version };
        if (state.userModified) data.userModified = true;
        if (state.skillIdValue.trim()) data.skillId = state.skillIdValue.trim();
        if (state.descriptionZh.trim()) data.description_zh = state.descriptionZh.trim();
        if (state.descriptionEn.trim()) data.description_en = state.descriptionEn.trim();

        const zh = split(state.examplesZh);
        const en = split(state.examplesEn);
        if (zh.length) data.examples_zh = zh;
        if (en.length) data.examples_en = en;

        const hash = await SH.meta.sha256(skill.content || "");
        if (hash) data.installedContentHash = `sha256:${hash}`;
        if (fmt.builder === "generic") data.generator = "Skill Hub";
      }

      const content = `${JSON.stringify(data, null, 2)}\n`;
      const res = await store.setSkillMeta(skill.id, {
        formatId: fmt.id,
        fileName: fmt.fileName,
        data,
        content,
      });

      state.busy = false;
      if (!res.ok) {
        state.error = res.reason;
        return refresh();
      }
      close();
      if (res.persisted) {
        SH.toast(`已保存 ${fmt.fileName}`, "ok");
      } else {
        SH.toast(`已更新索引，但未写入磁盘：${res.reason || "未知原因"}`, "warn");
      }
    }

    async function removeMeta() {
      const res = await store.setSkillMeta(skill.id, null);
      close();
      if (res.persisted) {
        SH.toast("已删除标记文件", "ok");
      } else {
        SH.toast(`已从索引移除，但删除文件失败：${res.reason || "未知原因"}`, "warn");
      }
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();
      if (act === "save") return save();
      if (act === "remove-meta") return removeMeta();
      if (act === "sync-name") {
        state.name = mdName;
        return refresh();
      }
    }

    const overlay = mount(render, handler);

    overlay.addEventListener("change", (event) => {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;
      if (act === "format") {
        state.formatId = el.value;
        return refresh();
      }
      if (act === "source") {
        state.source = el.value;
        return refresh();
      }
      if (act === "modified") {
        state.userModified = el.checked;
        return refresh();
      }
      if (act === "installed-at") {
        state.installedAt = el.value;
      }
    });

    overlay.addEventListener("input", (event) => {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;
      const value = el.value;

      if (act === "name") {
        state.name = value;
        // 输入时只更新提示文案，不重建 DOM，避免输入框失焦
        const hint = overlay.querySelector(".name-pair__hint");
        if (hint) hint.textContent = nameHintText();
        return;
      }

      if (act === "version") state.version = value;
      else if (act === "skill-id") state.skillIdValue = value;
      else if (act === "owner-id") state.ownerId = value;
      else if (act === "desc-zh") state.descriptionZh = value;
      else if (act === "desc-en") state.descriptionEn = value;
      else if (act === "ex-zh") state.examplesZh = value;
      else if (act === "ex-en") state.examplesEn = value;
    });
  }

  /* ============================================================
     导入 SKILL（两步向导）
     ============================================================ */
  function openImport(preset) {
    const writable = store.state.sources.filter((s) => !s.readonly);
    const state = {
      step: 1,
      parsed: null,
      targetId: writable.length ? writable[0].id : store.state.sources[0]?.id || "",
      policy: "overwrite",
      selected: new Set(),
      busy: false,
      error: "",
      parsing: false,
    };

    // 外部已有解析结果时（例如从系统拖放直接进入），可跳过第一步
    if (preset && Array.isArray(preset.items) && preset.items.length) {
      state.parsed = preset;
      state.selected = new Set(preset.items.map((_, i) => i));
      state.step = 2;
    }

    function targetName() {
      const s = store.getSource(state.targetId);
      return s ? s.name : "未选择";
    }

    function targetPath() {
      const s = store.getSource(state.targetId);
      return s ? s.path : "";
    }

    function conflicts() {
      if (!state.parsed) return [];
      return state.parsed.items.filter((item) =>
        store.state.skills.some(
          (s) =>
            s.sourceId === state.targetId && s.name.toLowerCase() === item.name.toLowerCase()
        )
      );
    }

    async function parseFiles(fileList) {
      state.parsing = true;
      state.error = "";
      refresh();
      try {
        const parsed = await SH.io.parseSelection(fileList);
        state.parsed = parsed;
        state.selected = new Set(parsed.items.map((_, i) => i));
        state.error = "";
      } catch (err) {
        state.parsed = null;
        state.error = err.message || "解析失败，请确认文件格式";
      } finally {
        state.parsing = false;
        refresh();
      }
    }

    function stepsHtml() {
      const done1 = state.step > 1;
      return `
        <div class="steps">
          <div class="step ${state.step === 1 ? "is-current" : "is-done"}">
            <span class="step__num">${done1 ? I.svg("check", 11) : "1"}</span>
            <span class="step__label">选择来源与目标 Agent</span>
          </div>
          <span class="step__line"></span>
          <div class="step ${state.step === 2 ? "is-current" : ""}">
            <span class="step__num">2</span>
            <span class="step__label">确认内容并写入</span>
          </div>
        </div>`;
    }

    function fileArea() {
      if (state.parsing) {
        return `<div class="dropzone"><div class="dropzone__title">正在解析…</div>
                  <div class="dropzone__hint">读取目录结构并解析 frontmatter</div></div>`;
      }
      if (state.parsed) {
        return `
          <div class="file-card">
            <span class="file-card__icon" style="color:var(--accent)">${I.svg(
              state.parsed.fileKind === "zip" ? "zip" : "file",
              28
            )}</span>
            <div class="file-card__col">
              <span class="file-card__name">${esc(state.parsed.fileName)}</span>
              <span class="file-card__meta">已解析 · ${state.parsed.items.length} 个 SKILL · ${
          state.parsed.items.reduce((n, i) => n + (i.files ? i.files.length : 1), 0)
        } 个关联文件 · ${fmtBytes(state.parsed.fileSize)}</span>
            </div>
            <button class="file-card__action" data-act="change-file">更改</button>
          </div>
          ${
            state.parsed.warnings && state.parsed.warnings.length
              ? `<div class="notice notice--warn">${I.svg("warn", 14)}<span>${esc(
                  state.parsed.warnings[0]
                )}</span></div>`
              : ""
          }`;
      }
      return `
        <div class="dropzone" data-act="pick-file">
          <span style="color:var(--text-4)">${I.svg("importDown", 26)}</span>
          <span class="dropzone__title">拖入 <b>.zip</b> 包、<b>SKILL.md</b> 或整个文件夹</span>
          <span class="dropzone__hint">或点击选择文件 · 支持一次导入多个技能</span>
        </div>`;
    }

    function agentRows() {
      const sc = store.sourceCounts();
      return store.state.sources
        .map((src) => {
          const disabled = src.readonly;
          const selected = state.targetId === src.id;
          return `
            <button class="agent-row ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}"
                    data-act="pick-target" data-id="${esc(src.id)}" ${disabled ? "disabled" : ""}
                    aria-pressed="${selected ? "true" : "false"}">
              <span class="agent-row__radio"></span>
              <span class="dot" style="background:var(${esc(src.colorVar)})"></span>
              <span class="agent-row__name">${esc(src.name)}</span>
              <span class="agent-row__spacer"></span>
              <span class="agent-row__path">${esc(src.path)}</span>
              <span class="agent-row__divider"></span>
              <span class="agent-row__state">${disabled ? "只读 · 不可写入" : `可写入 · ${sc[src.id] || 0} 个`}</span>
            </button>`;
        })
        .join("");
    }

    function step1Body() {
      return `
        <div class="field">
          <span class="field__label">导入来源</span>
          ${fileArea()}
          <input type="file" id="importFileInput" accept=".zip,.md,.markdown" multiple hidden>
          <input type="file" id="importFolderInput" webkitdirectory directory multiple hidden>
          ${
            !state.parsed
              ? `<div style="display:flex;gap:8px">
                   <button class="btn btn--outline" style="height:28px" data-act="pick-folder">选择文件夹…</button>
                   <button class="btn btn--outline" style="height:28px" data-act="pick-file">选择文件…</button>
                 </div>`
              : ""
          }
        </div>

        <div class="field">
          <div class="field__label-row">
            <span class="field__label">导入到哪个 Agent</span>
            <span class="field__hint">必选 · 单选</span>
          </div>
          <div class="agent-list">${agentRows()}</div>
        </div>

        ${
          state.error
            ? `<div class="notice notice--error">${I.svg("warn", 14)}<span>${esc(state.error)}</span></div>`
            : `<div class="notice">${I.svg("info", 14)}<span>将写入 ${
                targetPath() || "目标目录"
              } · 同名 SKILL 会在下一步选择覆盖或跳过</span></div>`
        }
      `;
    }

    function step2Body() {
      const items = state.parsed ? state.parsed.items : [];
      const conflictNames = new Set(conflicts().map((c) => c.name.toLowerCase()));

      const rows = items
        .map((item, index) => {
          const isConflict = conflictNames.has(item.name.toLowerCase());
          const checked = state.selected.has(index);
          const existing = store.state.skills.find(
            (s) =>
              s.sourceId === state.targetId && s.name.toLowerCase() === item.name.toLowerCase()
          );
          return `
            <div class="import-row ${isConflict ? "is-conflict" : ""} ${checked ? "" : "is-skip"}">
              <button class="card__check ${checked ? "is-checked" : ""}" data-act="toggle-item" data-index="${index}"
                      style="${checked ? "background:var(--accent);border-color:var(--accent);color:#fff" : ""}"
                      aria-pressed="${checked}">${SH.components.checkIcon()}</button>
              <span class="import-row__name">${esc(item.name)}</span>
              ${
                isConflict
                  ? '<span class="mini-badge mini-badge--warn">同名冲突</span>'
                  : '<span class="mini-badge">新导入</span>'
              }
              <span class="import-row__spacer"></span>
              <span class="import-row__meta">${
                isConflict && existing
                  ? `${esc(existing.version)} → ${esc(item.version || "v1.0")}`
                  : `${item.files ? item.files.length : 1} 个文件 · ${esc(item.version || "v1.0")}`
              }</span>
            </div>`;
        })
        .join("");

      const count = state.selected.size;

      return `
        <div class="target-card">
          <span style="color:var(--accent)">${I.svg("folder", 26)}</span>
          <div class="target-card__col">
            <span class="target-card__name">导入到 ${esc(targetName())}</span>
            <span class="target-card__path">${esc(targetPath())}/ · ${count} 个 SKILL 将写入此目录</span>
          </div>
          <button class="file-card__action" data-act="back-to-1">更改目标</button>
        </div>

        <div class="field">
          <div class="field__label-row">
            <span class="field__label">待导入 SKILL</span>
            <span class="field__hint">${count} 个已选 · 已解析 ${
        state.parsed ? state.parsed.fileName : ""
      }</span>
          </div>
          <div class="import-list">${rows || '<div class="notice">没有可导入的 SKILL</div>'}</div>
        </div>

        ${
          conflictNames.size
            ? `<div class="field">
                 <span class="field__label">同名冲突处理（${conflictNames.size} 个）</span>
                 <div class="seg-choose" data-act="policy-group">
                   <button class="seg-choose__btn ${
                     state.policy === "skip" ? "is-active" : ""
                   }" data-act="policy" data-value="skip">跳过</button>
                   <button class="seg-choose__btn ${
                     state.policy === "overwrite" ? "is-active" : ""
                   }" data-act="policy" data-value="overwrite">覆盖并备份</button>
                   <button class="seg-choose__btn ${
                     state.policy === "rename" ? "is-active" : ""
                   }" data-act="policy" data-value="rename">重命名保留</button>
                 </div>
               </div>`
            : ""
        }

        <div class="notice">${I.svg("info", 14)}<span>仅写入所选 Agent 的目录 · 导入后重建本地索引并保留来源元信息</span></div>
      `;
    }

    function render() {
      const isStep1 = state.step === 1;
      const canNext =
        isStep1 && state.parsed && state.parsed.items.length > 0 && !!state.targetId;
      const canImport = !isStep1 && state.selected.size > 0;

      return `
        <div class="dialog" role="dialog" aria-modal="true" aria-label="导入 SKILL">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">${isStep1 ? "导入 SKILL" : "确认导入内容"}</h2>
              <p class="dialog__subtitle">${
                isStep1
                  ? "导入 SKILL 包或目录，并选择写入哪个 Agent"
                  : "核对将写入的 SKILL，处理同名冲突后开始导入"
              }</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          ${stepsHtml()}
          <div class="dialog__body">${isStep1 ? step1Body() : step2Body()}</div>
          <div class="dialog__foot">
            ${
              isStep1
                ? '<span class="dialog__foot-hint">支持 .zip / SKILL.md / 文件夹</span>'
                : '<button class="file-card__action" data-act="back-to-1">← 上一步</button>'
            }
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">取消</button>
              ${
                isStep1
                  ? `<button class="btn btn--primary" data-act="next" ${
                      canNext && !state.parsing ? "" : "disabled"
                    }>下一步：确认导入</button>`
                  : `<button class="btn btn--primary" data-act="do-import" ${
                      canImport && !state.busy ? "" : "disabled"
                    }>${state.busy ? "正在写入…" : "开始导入"}</button>`
              }
            </div>
          </div>
        </div>`;
    }

    function triggerFileInput(id) {
      const input = current.overlay.querySelector(id);
      if (input) input.click();
    }

    function doImport() {
      if (state.busy || !state.parsed) return;
      const picked = state.parsed.items.filter((_, i) => state.selected.has(i));
      if (!picked.length) return;

      state.busy = true;
      refresh();

      setTimeout(() => {
        const result = store.importSkills(picked, state.targetId, state.policy);
        const name = targetName();
        close();

        const parts = [];
        if (result.added) parts.push(`新增 ${result.added}`);
        if (result.overwritten) parts.push(`覆盖 ${result.overwritten}`);
        if (result.renamed) parts.push(`重命名 ${result.renamed}`);
        if (result.skipped) parts.push(`跳过 ${result.skipped}`);
        SH.toast(
          `已导入到 ${name}${parts.length ? ` · ${parts.join(" · ")}` : ""}`,
          result.added + result.overwritten + result.renamed ? "ok" : "info"
        );

        // 跳到目标来源，方便查看
        store.setSource(state.targetId);
        const first = picked[0];
        const fresh = store.state.skills.find(
          (s) => s.sourceId === state.targetId && s.name.startsWith(first.name)
        );
        if (fresh) store.selectSkill(fresh.id);
      }, 320);
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();
      if (act === "next") {
        if (!state.parsed || !state.targetId) return;
        state.step = 2;
        return refresh();
      }
      if (act === "back-to-1") {
        state.step = 1;
        return refresh();
      }
      if (act === "pick-file") return triggerFileInput("#importFileInput");
      if (act === "pick-folder") return triggerFileInput("#importFolderInput");
      if (act === "change-file") {
        state.parsed = null;
        state.error = "";
        refresh();
        return triggerFileInput("#importFileInput");
      }
      if (act === "pick-target") {
        const id = el.dataset.id;
        const src = store.getSource(id);
        if (!src || src.readonly) return;
        state.targetId = id;
        return refresh();
      }
      if (act === "toggle-item") {
        const index = Number(el.dataset.index);
        if (state.selected.has(index)) state.selected.delete(index);
        else state.selected.add(index);
        return refresh();
      }
      if (act === "policy") {
        state.policy = el.dataset.value;
        return refresh();
      }
      if (act === "do-import") return doImport();
    }

    const overlay = mount(render, handler);

    current.onDrop = (files) => parseFiles(files);

    overlay.addEventListener("change", (event) => {
      const id = event.target.id;
      if (id === "importFileInput" || id === "importFolderInput") {
        if (event.target.files && event.target.files.length) {
          parseFiles(event.target.files);
        }
      }
    });
  }

  /* ============================================================
     设置
     ============================================================ */
  /**
   * 关于块里的运行环境说明。
   * 桌面版才有 SH.runtime；浏览器预览下退回 localStorage 说明。
   */
  function runtimeBlockHtml() {
    const rt = SH.runtime;
    if (!rt) {
      return `<p class="sheet__desc">数据存放在浏览器 localStorage，导入导出为本地文件操作。</p>`;
    }

    const rows = (rt.managed || [])
      .map(
        (p) => `
        <div class="path-row">
          <span class="path-row__label">${esc(p.label)}${
          p.exists ? "" : '<em class="path-row__muted"> · 未创建</em>'
        }</span>
          <code class="path-row__path">${esc(p.path)}</code>
        </div>`
      )
      .join("");

    return `
      <div class="kv">
        <div class="kv__row">
          <span class="kv__key">分发形态</span>
          <span class="kv__val">${
            rt.portable ? "便携版 · 数据随程序走" : "标准安装 · 数据在 ~/Library"
          }</span>
        </div>
      </div>
      <div class="path-list">${rows}</div>
      <p class="sheet__desc">${
        rt.portable
          ? "整个文件夹可拷到 U 盘，分类、来源与偏好会一起带走。"
          : "遵循 macOS 目录规范；卸载请用下面的卸载脚本，才能连这些目录一起清干净。"
      }</p>`;
  }

  /** 卸载说明：两个平台的方式完全不同 */
  function uninstallBlockHtml() {
    const rt = SH.runtime;
    if (!rt) return "";

    if (rt.portable) {
      return `<p class="sheet__desc">便携形态，没有安装程序，也不写注册表和 AppData。
      关闭程序后<strong>直接删除整个文件夹</strong>即完成卸载，不会留下任何东西。</p>`;
    }

    return `<p class="sheet__desc">把 <code>.app</code> 拖进废纸篓<strong>只会删掉程序本体</strong>，
      配置、缓存、日志和 WebView 数据仍留在 <code>~/Library</code> 下。</p>
      <button class="btn btn--outline btn--sm" data-act="export-uninstaller" style="align-self:flex-start">
        导出卸载脚本到桌面
      </button>
      <p class="sheet__desc">双击桌面上生成的「卸载 Skill Hub.command」即可完整清理；
      脚本会先列出所有将被删除的目录与体积，确认后才执行，清理完自动检查残留。</p>`;
  }

  function openSettings() {
    const state = {};

    function render() {
      const prefs = store.state.prefs;
      return `
        <div class="sheet" role="dialog" aria-modal="true" aria-label="设置与偏好">
          <div class="sheet__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title" style="font-size:15px">设置与偏好</h2>
              <p class="dialog__subtitle">仅影响本机这一份索引</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${I.svg("close", 15)}</button>
          </div>
          <div class="sheet__body">
            <div class="sheet__group">
              <span class="sheet__label">主题</span>
              <div class="seg-choose">
                ${["light", "dark", "system"]
                  .map(
                    (v) =>
                      `<button class="seg-choose__btn ${
                        prefs.theme === v ? "is-active" : ""
                      }" data-act="theme" data-value="${v}">${
                        v === "light" ? "浅色" : v === "dark" ? "深色" : "跟随系统"
                      }</button>`
                  )
                  .join("")}
              </div>
              <p class="sheet__desc">深色只映射背景与文字，结构与间距保持不变。</p>
            </div>

            <div class="sheet__divider"></div>

            <div class="sheet__group">
              <span class="sheet__label">标题栏外观</span>
              <div class="seg-choose">
                ${["auto", "win", "mac"]
                  .map(
                    (v) =>
                      `<button class="seg-choose__btn ${
                        prefs.platform === v ? "is-active" : ""
                      }" data-act="platform" data-value="${v}">${
                        v === "auto" ? "自动" : v === "win" ? "Windows" : "macOS"
                      }</button>`
                  )
                  .join("")}
              </div>
              <p class="sheet__desc">只影响窗口控件位置与快捷键显示，内容区完全一致。</p>
            </div>

            <div class="sheet__divider"></div>

            <div class="sheet__group">
              <span class="sheet__label">快捷键</span>
              <div class="kv">
                <div class="kv__row"><span class="kv__key">${SH.util.modKey()} K</span><span class="kv__val">聚焦搜索</span></div>
                <div class="kv__row"><span class="kv__key">${SH.util.modKey()} R</span><span class="kv__val">重新扫描目录</span></div>
                <div class="kv__row"><span class="kv__key">↑ ↓</span><span class="kv__val">在列表中移动</span></div>
                <div class="kv__row"><span class="kv__key">Esc</span><span class="kv__val">关闭弹窗 / 清空搜索</span></div>
              </div>
            </div>

            <div class="sheet__divider"></div>

            <div class="sheet__group">
              <span class="sheet__label">数据</span>
              <div class="sheet__row">
                <div>
                  <div style="font-size:12px">重新扫描全部来源</div>
                  <p class="sheet__desc">上次同步：${esc(SH.util.fmtRelative(store.state.syncAt))}</p>
                </div>
                <button class="btn btn--outline" data-act="rescan">重新扫描</button>
              </div>
              <div class="sheet__row">
                <div>
                  <div style="font-size:12px">重置为演示数据</div>
                  <p class="sheet__desc">会清空导入与收藏记录，无法撤销</p>
                </div>
                <button class="btn btn--outline" style="color:var(--danger);border-color:var(--line)" data-act="reset">重置</button>
              </div>
            </div>

            <div class="sheet__divider"></div>

            <div class="sheet__group">
              <span class="sheet__label">关于</span>
              <p class="sheet__desc">Skill Hub v0.9 · 跨平台 SKILL 统一管理器<br>
              本地索引 + 增量扫描 · 无框架前端，零运行时依赖</p>
              ${runtimeBlockHtml()}
            </div>

            ${
              SH.runtime
                ? `<div class="sheet__divider"></div>
            <div class="sheet__group">
              <span class="sheet__label">卸载</span>
              ${uninstallBlockHtml()}
            </div>`
                : ""
            }
          </div>
        </div>`;
    }

    function handler(event) {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      const act = el.dataset.act;

      if (act === "close") return close();

      if (act === "export-uninstaller") {
        SH.native
          .exportUninstaller()
          .then((p) => SH.toast(`已导出到桌面：${p.split("/").pop()}`, "ok"))
          .catch((err) => SH.toast(err.message || "导出卸载脚本失败", "warn"));
        return;
      }

      if (act === "theme") {
        store.setPref("theme", el.dataset.value);
        SH.applyPrefs();
        return refresh();
      }
      if (act === "platform") {
        store.setPref("platform", el.dataset.value);
        SH.applyPrefs();
        return refresh();
      }
      if (act === "rescan") {
        SH.rescan();
        return;
      }
      if (act === "reset") {
        store.resetData();
        close();
        SH.toast("已重置为演示数据", "ok");
      }
    }

    mount(render, handler);
  }

  SH.dialogs = {
    openExport,
    openImport,
    openAddSource,
    openNewSkill,
    openDeleteSkill,
    openMarkEditor,
    openMarkPicker,
    openCategoryEditor,
    openSourceEditor,
    openMetaEditor,
    openSettings,
    close,
  };
})();
