/* ------------------------------------------------------------
   app.js · 启动、全局事件、快捷键
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { esc, fmtRelative, debounce } = SH.util;
  const store = SH.store;

  const $ = (id) => document.getElementById(id);

  /* ---------------- 主题与平台 ---------------- */
  function applyPrefs() {
    const prefs = store.state.prefs;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    // 切换主题的瞬间先关掉过渡，避免旧配色残留一帧
    root.classList.add("theme-switching");
    const release = () => root.classList.remove("theme-switching");
    requestAnimationFrame(() => requestAnimationFrame(release));
    setTimeout(release, 80);

    let theme = prefs.theme;
    if (theme === "system") theme = media.matches ? "dark" : "light";
    root.dataset.theme = theme;

    let platform = prefs.platform;
    if (platform === "auto") platform = SH.util.isMac() ? "mac" : "win";
    root.dataset.platform = platform;

    const mod = platform === "mac" ? "Cmd" : "Ctrl";
    $("searchKbd").textContent = `${mod} K`;
    $("rescanHint").textContent = `${mod} R`;

    $("macLights").hidden = platform !== "mac";
    $("winControls").style.display = platform === "mac" ? "none" : "flex";
  }

  /* ---------------- Toast ---------------- */
  function toast(message, type = "ok") {
    const root = $("toastRoot");
    const iconName = type === "error" ? "warn" : type === "info" ? "info" : "check";
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "toast--error" : ""}`;
    el.innerHTML = `<span class="toast__icon">${SH.icons.svg(iconName, 15)}</span><span class="toast__text">${esc(
      message
    )}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-out");
      setTimeout(() => el.remove(), 220);
    }, 2800);
  }

  /* ---------------- 渲染 ---------------- */
  function updateStatus() {
    const uniq = store.uniqueSkillCount();
    const installs = store.state.skills.length;
    const m = store.state.sources.length;
    $("statusText").textContent = `本地索引 · ${uniq} 个 SKILL · ${installs} 个安装点 · ${m} 个来源`;
    $("syncText").textContent = `已同步 ${m} 个目录 · ${fmtRelative(store.state.syncAt)}`;

    // 筛选条与排序按钮的视觉状态
    document.querySelectorAll("#filterChips .chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.filter === store.ui.filter);
    });
    document.querySelectorAll("#viewToggle .segmented__btn").forEach((btn) => {
      const active = btn.dataset.view === store.ui.view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    const sortLabel = $("sortLabel");
    const map = { updated: "最近更新", name: "名称 A → Z", source: "按来源分组", created: "最近导入" };
    sortLabel.textContent = map[store.ui.sort] || "最近更新";
    document.querySelectorAll("#sortMenu .menu__item").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.sort === store.ui.sort);
    });
  }

  function renderAll() {
    SH.sidebar.render();
    SH.list.render();
    SH.detail.render();
    updateStatus();
  }

  /* ---------------- 重新扫描 ---------------- */
  let scanning = false;

  async function rescan() {
    if (scanning) return;
    scanning = true;
    const dot = document.querySelector(".sync-row .dot");
    if (dot) {
      dot.classList.remove("dot--live");
      dot.classList.add("dot--busy");
    }
    $("statusText").textContent = "正在扫描目录 · 读取 SKILL.md frontmatter…";
    try {
      await store.rescan();
      toast(`重新扫描完成 · 共 ${store.state.skills.length} 个 SKILL`, "ok");
    } finally {
      scanning = false;
      if (dot) {
        dot.classList.add("dot--live");
        dot.classList.remove("dot--busy");
      }
      updateStatus();
    }
  }

  /* ---------------- 排序菜单 ---------------- */
  function setupSortMenu() {
    const btn = $("sortBtn");
    const menu = $("sortMenu");

    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !menu.hidden;
      menu.hidden = open;
      btn.setAttribute("aria-expanded", open ? "false" : "true");
    });

    menu.addEventListener("click", (event) => {
      const item = event.target.closest(".menu__item");
      if (!item) return;
      store.setSort(item.dataset.sort);
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("click", (event) => {
      if (menu.hidden) return;
      if (!event.target.closest("#sortWrap")) {
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------------- 搜索 ---------------- */
  function setupSearch() {
    const input = $("searchInput");
    const apply = debounce((value) => store.setQuery(value), 120);

    input.addEventListener("input", (event) => apply(event.target.value));

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (input.value) {
          input.value = "";
          store.setQuery("");
        } else {
          input.blur();
        }
      }
    });

    $("searchBox").addEventListener("click", (event) => {
      if (event.target.tagName !== "INPUT") input.focus();
    });
  }

  /* ---------------- 工具栏 ---------------- */
  function setupToolbar() {
    $("filterChips").addEventListener("click", (event) => {
      const chip = event.target.closest(".chip");
      if (!chip) return;
      store.setFilter(chip.dataset.filter);
    });

    $("viewToggle").addEventListener("click", (event) => {
      const btn = event.target.closest(".segmented__btn");
      if (!btn) return;
      store.setView(btn.dataset.view);
    });

    $("importBtn").addEventListener("click", () => SH.dialogs.openImport());
    $("newSkillBtn").addEventListener("click", () => SH.dialogs.openNewSkill());
    $("settingsBtn").addEventListener("click", () => SH.dialogs.openSettings());
    $("rescanBtn").addEventListener("click", rescan);

    const exportChecked = () => {
      const ids = Array.from(store.ui.checked);
      if (!ids.length) {
        toast("先勾选要导出的 SKILL", "info");
        return;
      }
      SH.dialogs.openExport(ids);
    };

    $("exportSelectedBtn").addEventListener("click", exportChecked);
    $("selectionExportBtn").addEventListener("click", exportChecked);
    $("clearSelectionBtn").addEventListener("click", () => store.clearChecks());

    // 桌面端接管系统窗口；浏览器预览只做提示，不伪造系统行为
    document.querySelectorAll("[data-win]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (SH.native && SH.native.isNative) {
          await SH.native.windowAction(btn.dataset.win);
          return;
        }
        toast("浏览器预览中不可用；桌面版会交给系统窗口处理", "info");
      });
    });
  }

  /* ---------------- 快捷键 ---------------- */
  function setupShortcuts() {
    document.addEventListener("keydown", (event) => {
      const mod = event.metaKey || event.ctrlKey;
      const inField =
        document.activeElement &&
        /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("searchInput").focus();
        $("searchInput").select();
        return;
      }

      if (mod && event.key.toLowerCase() === "r") {
        event.preventDefault();
        rescan();
        return;
      }

      if (inField) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        SH.list.moveSelection(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        SH.list.moveSelection(-1);
      } else if (event.key === "Enter") {
        const active = document.activeElement;
        if (active && active.dataset && active.dataset.id) {
          store.selectSkill(active.dataset.id);
        }
      } else if (event.key === "/") {
        event.preventDefault();
        $("searchInput").focus();
      }
    });
  }

  /* ---------------- 桌面端启动扫描 ---------------- */
  async function bootNativeScan() {
    try {
      const roots = await SH.native.defaultRoots();
      if (!roots || !roots.length) return;

      const scanned = await SH.native.scanRoots(roots);
      if (!scanned) return;

      const result = store.applyNativeScan(scanned);
      if (result.applied) {
        toast(`已读取本机 ${result.skills} 个 SKILL（${result.sources} 个目录）`, "ok");
        const first = store.filteredSkills()[0];
        if (first) store.selectSkill(first.id);
      } else {
        toast("本机没有找到 SKILL 目录，先显示演示数据", "info");
      }
    } catch (err) {
      console.warn("[native] 启动扫描失败", err);
    }
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    applyPrefs();
    SH.sidebar.init();
    SH.list.init();
    SH.detail.init();
    setupSearch();
    setupSortMenu();
    setupToolbar();
    setupShortcuts();

    store.subscribe(renderAll);

    // 首屏选中第一个技能，避免右侧大片空白
    if (!store.ui.selectedId) {
      const first = store.filteredSkills()[0];
      if (first) store.ui.selectedId = first.id;
    }

    renderAll();

    // 系统主题变化时跟随
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (store.state.prefs.theme === "system") applyPrefs();
    });

    // 窗口尺寸变化时收起窄屏详情
    window.addEventListener("resize", debounce(() => {
      const panel = document.getElementById("inspector");
      if (window.innerWidth > 1180) panel.classList.remove("is-open");
    }, 160));

    // 桌面端：启动后扫描本机真实 SKILL 目录
    if (SH.native && SH.native.isNative) {
      document.documentElement.dataset.native = "true";
      // 运行环境（数据目录）缓存起来，设置面板同步读取
      SH.native.runtimeInfo().then((info) => {
        if (info) SH.runtime = info;
      });
      setTimeout(bootNativeScan, 80);
    }

    // 开发预览入口：?demo=import|export|add|settings 直接打开对应弹窗
    const demo = new URLSearchParams(location.search).get("demo");
    if (demo) {
      const map = {
        import: () => SH.dialogs.openImport(),
        import2: () =>
          SH.dialogs.openImport({
            fileName: "skill-hub-export-20261107.zip",
            fileSize: 88112,
            fileKind: "zip",
            items: [
              {
                name: "commit-message",
                description: "更新后的提交信息生成规则，支持 scope 自动推断",
                version: "v1.3",
                content: "---\nname: commit-message\n---\n# commit-message\n",
                files: [{ name: "SKILL.md", content: "" }],
              },
              {
                name: "sql-explainer",
                description: "把慢查询的执行计划翻译成可执行的优化建议",
                version: "v1.0",
                content: "---\nname: sql-explainer\n---\n# sql-explainer\n",
                files: [
                  { name: "SKILL.md", content: "" },
                  { name: "references/plan.md", content: "执行计划解读约定\n" },
                ],
              },
              {
                name: "release-note",
                description: "从提交记录生成面向用户的发布说明",
                version: "v0.9",
                content: "---\nname: release-note\n---\n# release-note\n",
                files: [
                  { name: "SKILL.md", content: "" },
                  { name: "templates/release.txt", content: "发布说明模板\n" },
                ],
              },
            ],
          }),
        export: () => {
          const ids = Array.from(store.ui.checked);
          if (!ids.length) {
            const first = store.filteredSkills()[0];
            if (first) ids.push(first.id);
          }
          SH.dialogs.openExport(ids);
        },
        // 批量导出预览（3 个技能，用来对比目录结构差异）
        exportbatch: () => {
          const ids = store.filteredSkills().slice(0, 3).map((s) => s.id);
          if (ids.length) SH.dialogs.openExport(ids);
        },
        add: () => SH.dialogs.openAddSource(),
        settings: () => SH.dialogs.openSettings(),
        // 预览两个平台的设置面板（浏览器里没有 SH.runtime，这里造一份）
        settingsmac: () => {
          SH.runtime = {
            platform: "macos",
            portable: false,
            data_dir: "/Users/lei/Library/Application Support/com.skillhub.desktop",
            managed: [
              { label: "用户数据 / 备份 / 回收站", path: "/Users/lei/Library/Application Support/com.skillhub.desktop", exists: true },
              { label: "缓存", path: "/Users/lei/Library/Caches/com.skillhub.desktop", exists: true },
              { label: "日志", path: "/Users/lei/Library/Logs/com.skillhub.desktop", exists: false },
              { label: "WebView 数据（localStorage）", path: "/Users/lei/Library/WebKit/com.skillhub.desktop", exists: true },
              { label: "偏好设置", path: "/Users/lei/Library/Preferences/com.skillhub.desktop.plist", exists: true },
            ],
          };
          SH.dialogs.openSettings();
        },
        // 预览文件编辑态
        // 预览独立编辑模式
        fileedit: () => {
          const list = store.filteredSkills();
          const target =
            list.find((s) => (s.files || []).some((f) => /^SKILL\.md$/i.test(f.name))) ||
            list[0];
          if (!target) return;
          store.selectSkill(target.id);
          store.setTab("files");
          SH.editor && SH.editor.open(target.id, "SKILL.md");
        },
        // 预览标记编辑弹窗（色板与自定义取色）
        markedit: () => SH.dialogs.openMarkEditor(),
        // 预览标记效果（两个标记 + 侧栏切到标记栏）
        marked: () => {
          const m1 = SH.store.addMark({ name: "常用", color: "#c0392b" });
          const m2 = SH.store.addMark({ name: "待整理", color: "#2563eb" });
          const list = store.filteredSkills();
          if (list[0] && m1.ok) store.setSkillMark(list[0].id, m1.id);
          if (list[1] && m2.ok) store.setSkillMark(list[1].id, m2.id);
          store.setNavTab("mark");
        },
        settingswin: () => {
          SH.runtime = {
            platform: "windows",
            portable: true,
            data_dir: "D:\\Tools\\Skill Hub\\data",
            managed: [
              { label: "备份", path: "D:\\Tools\\Skill Hub\\data\\backups", exists: true },
              { label: "回收站", path: "D:\\Tools\\Skill Hub\\data\\trash", exists: true },
              { label: "界面数据（localStorage）", path: "D:\\Tools\\Skill Hub\\data\\webview", exists: true },
            ],
          };
          SH.dialogs.openSettings();
        },
        newcat: () => SH.dialogs.openCategoryEditor(),
        editsrc: () => {
          const target =
            store.state.sources.find((s) => !s.builtin) || store.state.sources[0];
          if (target) SH.dialogs.openSourceEditor(target.id);
        },
        meta: () => {
          const target =
            store.state.skills.find((s) => s.meta) || store.filteredSkills()[0];
          if (!target) return;
          store.selectSkill(target.id);
          store.setTab("meta");
        },
        editmeta: () => {
          const target =
            store.state.skills.find((s) => s.meta) || store.filteredSkills()[0];
          if (!target) return;
          store.selectSkill(target.id);
          store.setTab("meta");
          setTimeout(() => SH.dialogs.openMetaEditor(target.id), 60);
        },
        installs: () => {
          const byName = (name) =>
            store.aggregateSkills().find((s) => s.name === name) || null;
          const target =
            byName("commit-message") || store.filteredSkills()[0];
          if (!target) return;
          store.selectSkill(target.id);
          store.setTab("installs");
        },
        syncresult: () => {
          const byName = (name) =>
            store.aggregateSkills().find((s) => s.name === name) || null;
          const target = byName("commit-message") || store.filteredSkills()[0];
          if (!target) return;
          store.selectSkill(target.id);
          store.syncSkillToAll(target.id);
          store.setTab("installs");
        },
        uninstall: () => {
          const byName = (name) =>
            store.aggregateSkills().find((s) => s.name === name) || null;
          const target = byName("commit-message") || store.filteredSkills()[0];
          if (!target) return;
          store.selectSkill(target.id);
          store.setTab("installs");
          const other = store
            .installStatus(target)
            .find((s) => s.installed && s.source.id !== target.sourceId);
          if (other) setTimeout(() => store.setPendingUninstall(other.skill.id), 60);
        },
        addmeta: () => {
          const target =
            store.state.skills.find((s) => !s.meta) || store.filteredSkills()[0];
          if (!target) return;
          store.selectSkill(target.id);
          store.setTab("meta");
          setTimeout(() => SH.dialogs.openMetaEditor(target.id), 60);
        },
        dark: () => {
          store.setPref("theme", "dark");
          applyPrefs();
        },
        list: () => store.setView("list"),
        mac: () => {
          store.setPref("platform", "mac");
          applyPrefs();
        },
        darklist: () => {
          store.setPref("theme", "dark");
          applyPrefs();
          store.setView("list");
        },
        files: () => {
          const first = store.filteredSkills()[0];
          if (!first) return;
          store.selectSkill(first.id);
          store.setTab("files");
          if (first.files && first.files[1]) store.openFile(first.files[1].name);
        },
      };
      if (map[demo]) setTimeout(map[demo], 120);
    }
  }

  SH.toast = toast;
  SH.applyPrefs = applyPrefs;
  SH.rescan = rescan;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
