/* ------------------------------------------------------------
   detail.js · 右侧详情：内容预览 / 文件 / 元信息
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc, fmtRelative, fmtDateTime, fmtBytes } = SH.util;
  const store = SH.store;
  const C = SH.components;
  const I = SH.icons;

  const panel = document.getElementById("inspector");

  /** 本地实现，避免依赖 components 的导出（缓存轮换时不会整页崩） */
  function countInstalls(status) {
    return {
      installed: status.filter((s) => s.installed).length,
      total: status.length,
    };
  }

  function tabsHtml(skill) {
    const ui = store.ui;
    const counts = countInstalls(store.installStatus(skill));
    return `
      <div class="insp-tabs" role="tablist">
        <button class="insp-tab ${ui.activeTab === "preview" ? "is-active" : ""}"
                data-action="tab" data-tab="preview" role="tab">内容预览</button>
        <button class="insp-tab ${ui.activeTab === "files" ? "is-active" : ""}"
                data-action="tab" data-tab="files" role="tab">文件 (${skill.files ? skill.files.length : 0})</button>
        <button class="insp-tab ${ui.activeTab === "installs" ? "is-active" : ""}"
                data-action="tab" data-tab="installs" role="tab">安装 ${counts.installed}/${counts.total}</button>
        <button class="insp-tab ${ui.activeTab === "meta" ? "is-active" : ""}"
                data-action="tab" data-tab="meta" role="tab">元信息</button>
      </div>`;
  }

  function previewHtml(skill) {
    const { frontmatter, body } = SH.md.splitFrontmatter(skill.content || "");
    const fm = frontmatter ? SH.md.renderFrontmatter(frontmatter) : "";
    const rendered = SH.md.render(body || skill.content || "");
    return `<div class="md">${fm}${rendered || '<p class="insp-desc">这个 SKILL 没有正文内容。</p>'}</div>`;
  }

  function filesHtml(skill) {
    const files = skill.files || [];
    const activeName = store.ui.activeFile;
    const editing = store.ui.editingFile;
    const active = files.find((f) => f.name === activeName) || null;

    const head = `
      <div class="file-bar">
        <span class="file-bar__label">${files.length} 个文件</span>
        <button class="file-bar__add" data-action="new-file">＋ 新建文件</button>
      </div>`;

    const list = files.length
      ? files
          .map(
            (f) => `
        <button class="file-item ${f.name === activeName ? "is-active" : ""}"
                data-action="file" data-file="${esc(f.name)}">
          ${I.svg("file", 13)}
          <span class="truncate">${esc(f.name)}</span>
          <span class="file-item__size">${esc(
            fmtBytes(f.size || SH.util.byteLength(f.content || ""))
          )}</span>
        </button>`
          )
          .join("")
      : `<div class="file-empty">还没有关联文件</div>`;

    let body = "";
    if (!active) {
      body = `<div class="file-hint">${
        files.length ? "选择一个文件查看或编辑" : "点右上角「新建文件」添加一个"
      }</div>`;
    } else if (editing === active.name) {
      body = `
        <div class="file-editor">
          <div class="file-editor__head">
            <span class="file-editor__name">${esc(active.name)}</span>
            <span class="file-editor__state" id="editDirtyHint">已保存</span>
          </div>
          <textarea class="file-editor__area" id="fileEditor" spellcheck="false"
                    placeholder="在这里编辑文件内容">${esc(active.content || "")}</textarea>
          <div class="file-editor__bar">
            <span class="file-editor__tip">保存前会自动备份原目录</span>
            <button class="btn btn--outline btn--sm" data-action="cancel-edit">取消</button>
            <button class="btn btn--primary btn--sm" data-action="save-file">保存</button>
          </div>
        </div>`;
    } else {
      const isMd = /\.md$/i.test(active.name);
      body = `
        <div class="file-preview">
          <div class="file-preview__head">
            <span class="file-editor__name">${esc(active.name)}</span>
            <button class="btn btn--outline btn--sm" data-action="edit-file"
                    data-file="${esc(active.name)}">编辑</button>
          </div>
          ${
            isMd
              ? `<div class="md">${SH.md.render(
                  SH.md.splitFrontmatter(active.content || "").body
                )}</div>`
              : `<div class="md"><pre><code>${esc(active.content || "")}</code></pre></div>`
          }
        </div>`;
    }

    return `${head}<div class="file-list">${list}</div>${body}`;
  }

  function metaHtml(skill) {
    const metaData = skill.meta && skill.meta.data ? skill.meta.data : null;
    const metaName = metaData && metaData.name ? String(metaData.name) : "";
    const rows = [
      ["调用名", skill.name],
      ...(metaName && metaName !== skill.name ? [["显示名", metaName]] : []),
      ["来源", store.sourceName(skill.sourceId)],
      ["分类", store.categoryName(skill.categoryId)],
      ["版本", skill.version],
      ["路径", skill.path],
      ["更新时间", fmtDateTime(skill.updatedAt)],
      ["创建时间", fmtDateTime(skill.createdAt)],
      ["文件数", String((skill.files || []).length)],
      ["可导出", skill.exportable ? "是" : "否（只读来源）"],
      ["标签", (skill.tags || []).join(" · ") || "—"],
    ];

    const info = SH.meta.describe(skill.meta);
    const metaBlock = info
      ? `
        <div class="meta-section">
          <div class="meta-section__head">
            <h3 class="meta-section__title">来源标记</h3>
            <div class="meta-section__actions">
              <button class="meta-section__action" data-action="edit-meta">编辑</button>
              <button class="meta-section__action" data-action="download-meta">下载</button>
            </div>
          </div>
          <div class="kv">
            <div class="kv__row"><span class="kv__key">文件</span><span class="kv__val">${esc(
              info.fileName
            )}</span></div>
            <div class="kv__row"><span class="kv__key">格式</span><span class="kv__val">${esc(
              info.formatName
            )}</span></div>
            <div class="kv__row"><span class="kv__key">来源</span><span class="kv__val">${esc(
              info.source
            )}</span></div>
            <div class="kv__row"><span class="kv__key">版本</span><span class="kv__val">${esc(
              info.version
            )}</span></div>
            ${
              info.skillId
                ? `<div class="kv__row"><span class="kv__key">技能 ID</span><span class="kv__val">${esc(
                    info.skillId
                  )}</span></div>`
                : ""
            }
            <div class="kv__row"><span class="kv__key">安装时间</span><span class="kv__val">${
              info.installedAt ? esc(fmtDateTime(info.installedAt)) : "—"
            }</span></div>
            ${
              info.hash
                ? `<div class="kv__row"><span class="kv__key">内容哈希</span><span class="kv__val" title="${esc(
                    info.hash
                  )}">${esc(info.hash.slice(0, 26))}…</span></div>`
                : ""
            }
          </div>
          ${
            info.userModified
              ? `<p class="meta-section__note">安装后修改过，标记文件记录了 userModified</p>`
              : ""
          }
          <p class="meta-section__note">导出时可选择其他 Agent 的标记格式重新生成。</p>
        </div>`
      : `
        <div class="meta-section">
          <div class="meta-section__head">
            <h3 class="meta-section__title">来源标记</h3>
            <button class="meta-section__action" data-action="edit-meta">添加标记</button>
          </div>
          <p class="meta-section__note">这个 SKILL 目录里没有 *_meta.json。可以直接添加，也可以在导出时按目标 Agent 生成。</p>
        </div>`;

    return `<div class="kv">${rows
      .map(
        ([k, v]) =>
          `<div class="kv__row"><span class="kv__key">${esc(k)}</span><span class="kv__val">${esc(
            v
          )}</span></div>`
      )
      .join("")}</div>${metaBlock}`;
  }

  function syncResultHtml(last) {
    const summary = last.summary || {};
    const results = last.results || [];
    const failed = results.filter((r) => r.status === "failed");
    return `
      <div class="sync-result ${failed.length ? "sync-result--warn" : "sync-result--ok"}">
        <div class="sync-result__head">
          <strong>${failed.length ? "部分完成" : "同步完成"}</strong>
          <span>新增 ${summary.added || 0} · 覆盖 ${summary.updated || 0} · 跳过 ${
      summary.skipped || 0
    } · 失败 ${failed.length}</span>
          <button class="sync-result__close" data-action="clear-sync" aria-label="关闭">×</button>
        </div>
        ${
          failed.length
            ? `<ul class="sync-result__list">${failed
                .map(
                  (r) =>
                    `<li><span>${esc(r.target)}</span><span>${esc(r.reason)}</span></li>`
                )
                .join("")}</ul>`
            : ""
        }
      </div>`;
  }

  function installsHtml(skill) {
    const status = store.installStatus(skill);
    const counts = countInstalls(status);
    const pending = status.filter((s) => !s.installed && !s.readonly).length;
    const locked = status.filter((s) => !s.installed && s.readonly).length;
    const drifted = status.filter((s) => s.installed && !s.sameContent).length;

    const last = store.ui.lastSync;
    const lastSkill = last ? store.getSkill(last.skillId) : null;
    const sameSkill =
      lastSkill && lastSkill.name.toLowerCase() === skill.name.toLowerCase();

    const rows = status
      .map((item) => {
        const color = store.sourceColor(item.source);
        if (item.installed) {
          const pending = store.ui.pendingUninstall === item.skill.id;
          const isLast = counts.installed === 1;

          if (pending) {
            return `
              <div class="install-item is-confirming">
                <span class="dot" style="background:${color}"></span>
                <div class="install-item__col">
                  <span class="install-item__name">从 ${esc(item.source.name)} 卸载？</span>
                  <span class="install-item__meta">${
                    isLast
                      ? "这是最后一个安装点，卸载后该技能会从列表移除"
                      : "只移除这一份安装，其他 Agent 不受影响"
                  }</span>
                </div>
                <button class="btn btn--danger btn--xs" data-action="confirm-uninstall"
                        data-skill="${esc(item.skill.id)}">卸载</button>
                <button class="btn btn--outline btn--xs" data-action="cancel-uninstall">取消</button>
              </div>`;
          }

          return `
            <div class="install-item">
              <span class="dot" style="background:${color}"></span>
              <div class="install-item__col">
                <span class="install-item__name">${esc(item.source.name)}${
            item.isPrimary ? '<span class="install-item__tag">当前源</span>' : ""
          }</span>
                <span class="install-item__meta">${esc(item.skill.path)} · ${esc(
            item.version || ""
          )} · ${esc(fmtRelative(item.updatedAt))}</span>
              </div>
              <span class="install-item__state ${
                item.sameContent ? "is-ok" : "is-drift"
              }">${item.sameContent ? "已同步" : "有差异"}</span>
              ${
                item.sameContent
                  ? ""
                  : `<button class="btn btn--outline btn--xs" data-action="sync-one"
                             data-source="${esc(item.source.id)}">覆盖</button>`
              }
              <button class="install-item__remove" data-action="ask-uninstall"
                      data-skill="${esc(item.skill.id)}"
                      title="从 ${esc(item.source.name)} 卸载">卸载</button>
            </div>`;
        }
        return `
          <div class="install-item is-off">
            <span class="dot dot--off"></span>
            <div class="install-item__col">
              <span class="install-item__name">${esc(item.source.name)}</span>
              <span class="install-item__meta">${esc(item.source.path)}${
          item.readonly ? " · 只读目录" : ""
        }</span>
            </div>
            ${
              item.readonly
                ? '<span class="install-item__state is-locked">不可写入</span>'
                : `<button class="btn btn--outline btn--xs" data-action="sync-one"
                           data-source="${esc(item.source.id)}">同步到此</button>`
            }
          </div>`;
      })
      .join("");

    return `
      <div class="install-summary">
        <div class="install-summary__text">
          <strong>${counts.installed} / ${counts.total}</strong> 个 Agent 已安装
          ${pending ? `<span>${pending} 个可同步</span>` : ""}
          ${locked ? `<span>${locked} 个只读</span>` : ""}
          ${drifted ? `<span class="is-drift">${drifted} 个有差异</span>` : ""}
        </div>
        <button class="btn btn--primary btn--xs" data-action="sync-all" ${
          pending ? "" : "disabled"
        }>同步到全部未安装</button>
      </div>
      ${sameSkill && last ? syncResultHtml(last) : ""}
      <div class="install-list">${rows}</div>
      <p class="install-note">同步会以当前 SKILL 的内容覆盖目标 Agent 下的同名技能；只读目录不会写入。</p>
    `;
  }

  function render() {
    const skill = store.getSkill(store.ui.selectedId);
    if (!skill) {
      panel.innerHTML = C.inspectorEmptyHtml();
      return;
    }

    const ui = store.ui;
    const src = store.getSource(skill.sourceId);
    const body =
      ui.activeTab === "files"
        ? filesHtml(skill)
        : ui.activeTab === "installs"
        ? installsHtml(skill)
        : ui.activeTab === "meta"
        ? metaHtml(skill)
        : previewHtml(skill);

    panel.innerHTML = `
      <button class="inspector__close" data-action="close-panel" title="关闭详情">
        ${I.svg("close", 14)}
      </button>
      <div class="insp-head">
        <div class="insp-src-row">
          <span class="pill" style="background:color-mix(in srgb, ${store.sourceColor(
            skill.sourceId
          )} var(--icon-tint, 22%), var(--surface));color:var(--text-2)">${esc(
      src ? src.name : "未知来源"
    )}</span>
          <button class="btn btn--outline" style="height:26px;padding:0 8px;gap:5px"
                  data-action="fav" title="${skill.favorite ? "取消收藏" : "收藏"}">
            ${I.svg(skill.favorite ? "starFill" : "star", 13)}
            <span>${skill.favorite ? "已收藏" : "收藏"}</span>
          </button>
        </div>
        <h2 class="insp-title">${esc(store.displayName(skill))}</h2>
        <p class="insp-desc">${esc(skill.description)}</p>
        <div class="insp-meta">
          <div class="insp-meta__row"><span class="insp-meta__key">来源</span><span class="insp-meta__val">${esc(
            store.sourceName(skill.sourceId)
          )}</span></div>
          <div class="insp-meta__row"><span class="insp-meta__key">分类</span><span class="insp-meta__val">${esc(
            store.categoryName(skill.categoryId)
          )} · ${skill.exportable ? "可导出" : "只读"}</span></div>
          <div class="insp-meta__row"><span class="insp-meta__key">路径</span><span class="insp-meta__val" title="${esc(
            skill.path
          )}">${esc(skill.path)}</span></div>
        </div>
      </div>
      ${tabsHtml(skill)}
      <div class="insp-body">${body}</div>
      <div class="insp-footer">
        <button class="btn btn--outline" data-action="copy-path">${I.svg("copy", 13)}<span>复制路径</span></button>
        <div class="insp-footer__spacer"></div>
        <button class="btn btn--primary" data-action="export-one" ${
          skill.exportable ? "" : "disabled title=\"该来源为只读，无法导出\""
        }>${I.svg("exportUp", 13)}<span>导出此 SKILL</span></button>
      </div>
    `;
  }

  function onClick(event) {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const skill = store.getSkill(store.ui.selectedId);

    if (action === "tab") {
      store.setTab(el.dataset.tab);
      return;
    }
    if (action === "file") {
      store.openFile(el.dataset.file);
      return;
    }
    if (action === "close-panel") {
      panel.classList.remove("is-open");
      return;
    }
    if (!skill) return;

    if (action === "fav") {
      store.toggleFavorite(skill.id);
      return;
    }
    if (action === "copy-path") {
      SH.util.copyText(skill.path).then((ok) => {
        SH.toast(ok ? `已复制路径 ${skill.path}` : "复制失败，请手动选择路径", ok ? "ok" : "error");
      });
      return;
    }
    if (action === "sync-one") {
      const result = store.syncSkillTo(skill.id, el.dataset.source);
      if (result.status === "failed") {
        SH.toast(`${result.target}：${result.reason}`, "error");
      } else if (result.status === "skipped") {
        SH.toast(`${result.target}：${result.reason}`, "info");
      } else {
        SH.toast(
          result.status === "updated"
            ? `已覆盖 ${result.target} 上的旧版本`
            : `已同步到 ${result.target}`,
          "ok"
        );
      }
      return;
    }

    if (action === "sync-all") {
      const { summary } = store.syncSkillToAll(skill.id);
      const done = (summary.added || 0) + (summary.updated || 0);
      const failed = summary.failed || 0;
      if (failed) {
        SH.toast(`已同步 ${done} 个，${failed} 个失败 · 详情见安装面板`, "error");
      } else if (done) {
        SH.toast(`已同步到 ${done} 个 Agent`, "ok");
      } else {
        SH.toast("没有可同步的目标", "info");
      }
      return;
    }

    if (action === "clear-sync") {
      store.clearSyncResult();
      return;
    }

    if (action === "ask-uninstall") {
      store.setPendingUninstall(el.dataset.skill);
      return;
    }

    if (action === "cancel-uninstall") {
      store.setPendingUninstall(null);
      return;
    }

    if (action === "confirm-uninstall") {
      const result = store.uninstallSkill(el.dataset.skill);
      if (result.status === "failed") {
        SH.toast(result.reason, "error");
      } else {
        SH.toast(
          result.remaining > 0
            ? `已从 ${result.target} 卸载 · 还剩 ${result.remaining} 个安装点`
            : `已从 ${result.target} 卸载 · 该技能已无安装点`,
          "ok"
        );
      }
      return;
    }

    if (action === "new-file") {
      SH.dialogs && SH.dialogs.openNewFile(skill.id);
      return;
    }

    if (action === "edit-file") {
      store.beginEditFile(el.dataset.file || store.ui.activeFile);
      return;
    }

    if (action === "cancel-edit") {
      store.cancelEditFile();
      return;
    }

    if (action === "save-file") {
      const area = document.getElementById("fileEditor");
      const name = store.ui.editingFile;
      if (!area || !name) return;
      const targetId = skill.id;
      store.saveSkillFile(targetId, name, area.value).then((res) => {
        if (!res.ok) {
          SH.toast(res.reason || "保存失败", "error");
          return;
        }
        store.cancelEditFile();
        if (res.persisted) {
          SH.toast(`已保存 ${res.fileName}${res.created ? "（新建）" : ""}`, "ok");
        } else {
          SH.toast(`已更新 ${res.fileName}，但未写入磁盘：${res.reason || ""}`, "warn");
        }
      });
      return;
    }

    if (action === "edit-meta") {
      SH.dialogs && SH.dialogs.openMetaEditor(skill.id);
      return;
    }
    if (action === "download-meta") {
      const m = skill.meta;
      if (!m || (!m.content && !m.data)) return;
      const content = m.content || `${JSON.stringify(m.data, null, 2)}\n`;
      const fileName = m.fileName || "_skillhub_meta.json";
      SH.util.downloadBlob(new Blob([content], { type: "application/json" }), fileName);
      SH.toast(`已下载 ${fileName}`, "ok");
      return;
    }
    if (action === "export-one") {
      SH.dialogs && SH.dialogs.openExport([skill.id]);
    }
  }

  function init() {
    panel.addEventListener("click", onClick);
    // 编辑文件时实时标记未保存状态（只改提示文字，不重渲染以免失焦）
    panel.addEventListener("input", (event) => {
      if (event.target && event.target.id === "fileEditor") {
        store.setEditDirty(true);
      }
    });
    // 窄屏下点选技能自动展开面板
    store.subscribe((reason) => {
      if (reason === "select" && window.innerWidth <= 1180) {
        panel.classList.add("is-open");
      }
    });
  }

  SH.detail = { render, init };
})();
