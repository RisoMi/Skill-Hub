/* ------------------------------------------------------------
   trash.js · 回收站管理
   ------------------------------------------------------------
   列出 data/trash 下的条目，支持逐项 / 批量还原，以及彻底删除。
   还原 = 把目录搬回删除前的位置，并触发一次重扫。
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const esc = SH.util.esc;

  let root = null;
  let items = [];
  let checked = new Set();
  let busy = false;
  let loading = false;
  let error = "";

  function ensureRoot() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "trashRoot";
    root.className = "trash-root";
    document.body.appendChild(root);
    root.addEventListener("click", onClick);
    return root;
  }

  function fmtSize(n) {
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
    return `${(v / 1024 / 1024).toFixed(1)} MB`;
  }

  function fmtTime(ms) {
    if (!ms) return "未知时间";
    const d = new Date(Number(ms));
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function rowHtml(item) {
    const on = checked.has(item.id);
    return `
      <div class="trash-item ${on ? "is-checked" : ""}" data-id="${esc(item.id)}">
        <button class="trash-item__check ${on ? "is-on" : ""}" data-act="toggle"
                data-id="${esc(item.id)}" aria-pressed="${on}"
                aria-label="选择 ${esc(item.name)}">${SH.icons.svg("check", 11)}</button>
        <div class="trash-item__main">
          <span class="trash-item__name" title="${esc(item.name)}">${esc(item.name)}</span>
          <span class="trash-item__path" title="${esc(item.original_path || "")}">${
      item.original_path ? esc(item.original_path) : "（无原始路径，无法还原）"
    }</span>
        </div>
        <span class="trash-item__meta">${esc(fmtSize(item.size_bytes))} · ${esc(
      fmtTime(item.deleted_at)
    )}</span>
        <button class="btn btn--outline btn--sm" data-act="restore" data-id="${esc(
          item.id
        )}" ${item.original_path ? "" : "disabled"}>还原</button>
        <button class="btn btn--outline btn--sm btn--danger-text" data-act="purge"
                data-id="${esc(item.id)}">彻底删除</button>
      </div>`;
  }

  function render() {
    const box = ensureRoot();
    box.classList.add("is-open");

    const allChecked = items.length > 0 && checked.size === items.length;
    const totalSize = items.reduce((n, i) => n + (Number(i.size_bytes) || 0), 0);

    box.innerHTML = `
      <div class="overlay trash-overlay" data-role="scrim">
        <div class="dialog dialog--lg trash-dialog" role="dialog" aria-modal="true"
             aria-label="回收站">
          <div class="dialog__head">
            <div class="dialog__title-group">
              <h2 class="dialog__title">回收站</h2>
              <p class="dialog__subtitle">${
                items.length
                  ? `${items.length} 项 · 共 ${fmtSize(totalSize)}`
                  : "已删除的 SKILL 会先放在这里"
              }</p>
            </div>
            <button class="dialog__close" data-act="close" aria-label="关闭">${SH.icons.svg(
              "close",
              15
            )}</button>
          </div>
          <div class="hline" style="height:1px;background:var(--line)"></div>

          ${
            items.length
              ? `<div class="trash-bar">
                   <button class="trash-bar__select" data-act="toggle-all" aria-pressed="${allChecked}">
                     <span class="trash-item__check ${allChecked ? "is-on" : ""}">${SH.icons.svg(
                       "check",
                       11
                     )}</span>
                     <span class="trash-bar__label">${allChecked ? "取消全选" : "全选"}</span>
                   </button>
                   <span class="trash-bar__count">已选 ${checked.size} 项</span>
                   <div class="trash-bar__spacer"></div>
                   <button class="btn btn--outline btn--sm" data-act="restore-checked"
                           ${checked.size ? "" : "disabled"}>批量还原</button>
                   <button class="btn btn--outline btn--sm btn--danger-text" data-act="purge-checked"
                           ${checked.size ? "" : "disabled"}>彻底删除</button>
                 </div>`
              : ""
          }

          <div class="dialog__body trash-body">
            ${
              loading
                ? `<div class="trash-empty">正在读取…</div>`
                : items.length
                ? items.map(rowHtml).join("")
                : `<div class="trash-empty">
                     <strong>回收站是空的</strong>
                     <span>删除 SKILL 后会先移到这里，可随时还原</span>
                   </div>`
            }
            ${error ? `<p class="trash-error">${esc(error)}</p>` : ""}
          </div>

          <div class="dialog__foot">
            <div class="dialog__foot-hint">彻底删除后无法恢复 · 目录位于 data/trash</div>
            <div class="dialog__btns">
              <button class="btn btn--outline" data-act="close">关闭</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /**
   * 只同步勾选态，不重建 DOM。
   * 勾选时整窗重绘会让弹窗的入场动画重放（看起来就是闪一下），
   * 也会丢掉滚动位置。
   */
  function syncSelection() {
    if (!root) return;

    root.querySelectorAll(".trash-item").forEach((row) => {
      const on = checked.has(row.dataset.id);
      row.classList.toggle("is-checked", on);
      const box = row.querySelector(".trash-item__check");
      if (box) {
        box.classList.toggle("is-on", on);
        box.setAttribute("aria-pressed", String(on));
      }
    });

    const countEl = root.querySelector(".trash-bar__count");
    if (countEl) countEl.textContent = `已选 ${checked.size} 项`;

    const allBtn = root.querySelector('[data-act="toggle-all"]');
    if (allBtn) {
      const all = items.length > 0 && checked.size === items.length;
      allBtn.setAttribute("aria-pressed", String(all));
      const box = allBtn.querySelector(".trash-item__check");
      if (box) box.classList.toggle("is-on", all);
      const label = allBtn.querySelector(".trash-bar__label");
      if (label) label.textContent = all ? "取消全选" : "全选";
    }

    const restoreBtn = root.querySelector('[data-act="restore-checked"]');
    const purgeBtn = root.querySelector('[data-act="purge-checked"]');
    [restoreBtn, purgeBtn].forEach((btn) => {
      if (btn) btn.disabled = checked.size === 0;
    });
  }

  async function load() {
    // 本地读取很快，直接拿到结果再渲染一次即可。
    // 先渲染骨架再渲染列表会连闪两下。
    error = "";
    try {
      items = (await SH.native.listTrash()) || [];
    } catch (err) {
      items = [];
      error = `读取回收站失败：${String((err && err.message) || err)}`;
    }
    // 清掉已经不存在的勾选
    const ids = new Set(items.map((i) => i.id));
    checked = new Set(Array.from(checked).filter((id) => ids.has(id)));
    loading = false;
    render();
  }

  async function restore(ids) {
    if (busy || !ids.length) return;
    busy = true;
    const restored = [];
    const failed = [];

    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const dest = await SH.native.restoreTrash(id);
        restored.push(dest);
      } catch (err) {
        failed.push(String((err && err.message) || err));
      }
    }

    busy = false;
    checked = new Set();

    if (restored.length) {
      SH.toast(`已还原 ${restored.length} 项`, "ok");
      // 还原后目录回到原位，重扫一次才能在列表里看到
      if (SH.app && SH.app.rescan) SH.app.rescan();
    }
    if (failed.length) {
      SH.toast(`${failed.length} 项还原失败：${failed[0]}`, "error");
    }
    await load();
  }

  async function purge(ids) {
    if (busy || !ids.length) return;
    const label = ids.length === 1 ? "这一项" : `这 ${ids.length} 项`;
    const sure = window.confirm(`彻底删除${label}？\n\n不会保留任何副本，无法恢复。`);
    if (!sure) return;

    busy = true;
    const failed = [];
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await SH.native.purgeTrash(id);
      } catch (err) {
        failed.push(String((err && err.message) || err));
      }
    }
    busy = false;
    checked = new Set();

    if (failed.length) SH.toast(`${failed.length} 项删除失败：${failed[0]}`, "error");
    else SH.toast("已彻底删除", "ok");

    await load();
  }

  function onClick(event) {
    const el = event.target.closest("[data-act]");
    if (!el) {
      // 点遮罩关闭
      if (event.target.classList.contains("overlay")) close();
      return;
    }
    const act = el.dataset.act;
    const id = el.dataset.id;

    if (act === "close") return close();

    if (act === "toggle") {
      if (checked.has(id)) checked.delete(id);
      else checked.add(id);
      return syncSelection();
    }

    if (act === "toggle-all") {
      checked = checked.size === items.length ? new Set() : new Set(items.map((i) => i.id));
      return syncSelection();
    }

    if (act === "restore") return void restore([id]);
    if (act === "purge") return void purge([id]);
    if (act === "restore-checked") return void restore(Array.from(checked));
    if (act === "purge-checked") return void purge(Array.from(checked));
  }

  function open() {
    if (!SH.native.isNative) {
      SH.toast("浏览器预览没有回收站", "warn");
      return;
    }
    ensureRoot();
    checked = new Set();
    error = "";
    document.body.classList.add("is-editing-skill"); // 锁背景滚动
    load();
  }

  function close() {
    if (root) {
      root.classList.remove("is-open");
      root.innerHTML = "";
    }
    document.body.classList.remove("is-editing-skill");
  }

  SH.trash = { open, close };
})();
