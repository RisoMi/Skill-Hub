/* ------------------------------------------------------------
   store.js · 状态、持久化与查询
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { uid, DAY } = SH.util;
  const KEY = "skillhub.data.v1";
  const PREF_KEY = "skillhub.prefs.v1";

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  const defaults = {
    sources: clone(SH.seed.sources),
    categories: clone(SH.seed.categories),
    skills: clone(SH.seed.skills),
    syncAt: SH.seed.builtAt,
  };

  const ui = {
    query: "",
    sourceId: "all",
    categoryId: "all",
    filter: "all",
    sort: "updated",
    view: "grid",
    selectedId: null,
    activeTab: "preview",
    activeFile: null,
    checked: new Set(),
    lastSync: null,
    pendingUninstall: null,
  };

  const state = {
    sources: [],
    categories: [],
    skills: [],
    syncAt: 0,
    prefs: {
      theme: "light",
      platform: "auto",
    },
  };

  const listeners = new Set();

  /* ---------------- 持久化 ---------------- */
  function load() {
    let data = null;
    let prefs = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch (err) {
      console.warn("[store] 读取本地数据失败，使用内置数据", err);
    }
    try {
      const rawPrefs = localStorage.getItem(PREF_KEY);
      if (rawPrefs) prefs = JSON.parse(rawPrefs);
    } catch (err) {
      /* 忽略 */
    }

    const base = data && Array.isArray(data.skills) && data.skills.length ? data : defaults;
    state.sources = base.sources || clone(defaults.sources);
    state.categories = base.categories || clone(defaults.categories);
    state.skills = base.skills || clone(defaults.skills);
    state.syncAt = base.syncAt || Date.now();
    state.prefs = Object.assign({ theme: "light", platform: "auto" }, prefs || {});
  }

  let saveTimer = null;

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({
            sources: state.sources,
            categories: state.categories,
            skills: state.skills,
            syncAt: state.syncAt,
          })
        );
      } catch (err) {
        console.warn("[store] 保存失败（可能超出本地存储配额）", err);
        SH.toast && SH.toast("本地存储空间不足，本次改动可能无法保留", "error");
      }
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs));
      } catch (err) {
        /* 忽略 */
      }
    }, 160);
  }

  function emit(reason) {
    listeners.forEach((fn) => fn(reason || "change"));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /* ---------------- 查询 ---------------- */
  function getSkill(id) {
    return state.skills.find((s) => s.id === id) || null;
  }

  function getSource(id) {
    return state.sources.find((s) => s.id === id) || null;
  }

  function getCategory(id) {
    return state.categories.find((c) => c.id === id) || null;
  }

  /**
   * 展示名：优先元数据里的 name（可中文，WorkBuddy 应用内显示的就是它），
   * 没有元数据时退回调用名。
   */
  function displayName(skill) {
    const metaName =
      skill && skill.meta && skill.meta.data && skill.meta.data.name
        ? String(skill.meta.data.name).trim()
        : "";
    return metaName || (skill ? skill.name : "");
  }

  function sourceName(id) {
    const s = getSource(id);
    return s ? s.name : "未知来源";
  }

  function categoryName(id) {
    const c = getCategory(id);
    return c ? c.name : "未分类";
  }

  function matchesQuery(skill, q) {
    if (!q) return true;
    const hay = [
      skill.name,
      displayName(skill),
      skill.description,
      sourceName(skill.sourceId),
      categoryName(skill.categoryId),
      (skill.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function matchesFilter(skill) {
    switch (ui.filter) {
      case "favorite":
        return !!skill.favorite;
      case "recent":
        return Date.now() - skill.updatedAt <= 7 * DAY;
      case "exportable":
        return !!skill.exportable;
      default:
        return true;
    }
  }

  function sortItems(items) {
    const list = items.slice();
    switch (ui.sort) {
      case "name":
        list.sort((a, b) =>
          displayName(a).localeCompare(displayName(b), "zh-Hans-CN")
        );
        break;
      case "source":
        list.sort((a, b) => {
          const ai = state.sources.findIndex((s) => s.id === a.sourceId);
          const bi = state.sources.findIndex((s) => s.id === b.sourceId);
          return ai - bi || b.updatedAt - a.updatedAt;
        });
        break;
      case "created":
        list.sort((a, b) => b.createdAt - a.createdAt);
        break;
      default:
        list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  }

  function filteredSkills() {
    // 「全部技能」按技能名聚合去重，单个来源下天然不重复，直接用原始记录
    const pool =
      ui.sourceId === "all"
        ? aggregateSkills()
        : state.skills
            .filter((s) => s.sourceId === ui.sourceId)
            .map((s) => Object.assign({}, s, { installIds: installIdsOf(s.name) }));

    return sortItems(
      pool.filter(
        (s) =>
          matchesQuery(s, ui.query) &&
          matchesFilter(s) &&
          (ui.categoryId === "all" || s.categoryId === ui.categoryId)
      )
    );
  }

  /* ---------------- 多 Agent 安装状态 ---------------- */

  function installIdsOf(name) {
    const key = String(name || "").toLowerCase();
    return state.skills.filter((s) => s.name.toLowerCase() === key).map((s) => s.id);
  }

  /** 同名 SKILL 的多个安装点聚合成一个技能实体；主记录优先非只读、最近更新 */
  function aggregateSkills() {
    const groups = new Map();
    state.skills.forEach((skill) => {
      const key = skill.name.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(skill);
    });

    const list = [];
    groups.forEach((items) => {
      // 主记录稳定优先：原始安装点 > 非只读 > 最近更新。
      // 否则同步一次后，新写入的副本会因为时间更新而"抢走"主来源。
      const sorted = items.slice().sort((a, b) => {
        const oa = a.syncedFrom ? 1 : 0;
        const ob = b.syncedFrom ? 1 : 0;
        if (oa !== ob) return oa - ob;
        const ra = (getSource(a.sourceId) || {}).readonly ? 1 : 0;
        const rb = (getSource(b.sourceId) || {}).readonly ? 1 : 0;
        if (ra !== rb) return ra - rb;
        return b.updatedAt - a.updatedAt;
      });
      const primary = sorted[0];
      list.push(
        Object.assign({}, primary, {
          installCount: items.length,
          installIds: items.map((i) => i.id),
        })
      );
    });
    return list;
  }

  function uniqueSkillCount() {
    return new Set(state.skills.map((s) => s.name.toLowerCase())).size;
  }

  /**
   * 一个 SKILL 在所有 Agent 上的安装状态
   * @returns [{source, installed, readonly, skill, sameContent, version, updatedAt}]
   */
  function installStatus(skill) {
    const key = String(skill.name || "").toLowerCase();
    const base = String(skill.content || "").trim();
    return state.sources.map((src) => {
      const hit = state.skills.find(
        (s) => s.sourceId === src.id && s.name.toLowerCase() === key
      );
      return {
        source: src,
        installed: !!hit,
        readonly: !!src.readonly,
        isPrimary: !!hit && hit.id === skill.id,
        skill: hit || null,
        sameContent: hit ? String(hit.content || "").trim() === base : false,
        version: hit ? hit.version : null,
        updatedAt: hit ? hit.updatedAt : null,
      };
    });
  }

  function deepCopy(value) {
    return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value));
  }

  /** 写入单个目标（不触发持久化，由调用方统一收尾） */
  function writeToTarget(skill, target) {
    const existing = state.skills.find(
      (s) => s.sourceId === target.id && s.name.toLowerCase() === skill.name.toLowerCase()
    );

    if (existing) {
      if (String(existing.content || "").trim() === String(skill.content || "").trim()) {
        return { status: "skipped", reason: "内容已一致" };
      }
      existing.description = skill.description;
      existing.content = skill.content;
      existing.files = deepCopy(skill.files) || [];
      existing.meta = deepCopy(skill.meta);
      existing.version = skill.version;
      existing.tags = deepCopy(skill.tags) || [];
      existing.updatedAt = Date.now();
      existing.syncedFrom = skill.sourceId;
      return { status: "updated", reason: "已覆盖目标上的旧版本" };
    }

    state.skills.push({
      id: uid("sk"),
      name: skill.name,
      description: skill.description,
      categoryId: skill.categoryId,
      sourceId: target.id,
      version: skill.version,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      favorite: !!skill.favorite,
      exportable: !target.readonly,
      tags: deepCopy(skill.tags) || [],
      path: `${target.path}/${skill.name}`,
      content: skill.content,
      files: deepCopy(skill.files) || [],
      meta: deepCopy(skill.meta),
      syncedFrom: skill.sourceId,
      syncedAt: Date.now(),
    });
    return { status: "added" };
  }

  function precheck(skill, target) {
    if (!target) return "目标 Agent 不存在";
    if (target.readonly) return `${target.name} 是只读目录，无法写入`;
    if (target.id === skill.sourceId) return "已安装在该来源";
    if (!String(skill.content || "").trim()) return "SKILL.md 内容为空，无法同步";
    return null;
  }

  /** 单目标同步 */
  function syncSkillTo(skillId, targetId) {
    const skill = getSkill(skillId);
    if (!skill) return { status: "failed", target: targetId, reason: "技能不存在" };
    const target = getSource(targetId);
    const blocked = precheck(skill, target);
    if (blocked) {
      return {
        status: target && target.readonly ? "failed" : "skipped",
        target: target ? target.name : targetId,
        reason: blocked,
      };
    }

    const result = writeToTarget(skill, target);
    persistSkillToDisk(skill, target);
    persist();
    emit("sync");
    return Object.assign({ target: target.name, targetId: target.id }, result);
  }

  /** 同步到所有「未安装且可写」的 Agent */
  function syncSkillToAll(skillId) {
    const skill = getSkill(skillId);
    if (!skill) return { results: [], summary: {} };

    const status = installStatus(skill);
    const results = [];

    status.forEach((item) => {
      if (item.installed) return;
      if (item.source.id === skill.sourceId) return;
      if (item.source.readonly) {
        results.push({
          status: "failed",
          target: item.source.name,
          targetId: item.source.id,
          reason: `${item.source.name} 是只读目录，无法写入`,
        });
        return;
      }
      const written = writeToTarget(skill, item.source);
      if (written.status === "added" || written.status === "updated") {
        persistSkillToDisk(skill, item.source);
      }
      results.push(
        Object.assign(
          { target: item.source.name, targetId: item.source.id },
          written
        )
      );
    });

    const summary = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    ui.lastSync = { skillId, at: Date.now(), results, summary };
    persist();
    emit("sync");
    return { results, summary };
  }

  function clearSyncResult() {
    ui.lastSync = null;
    emit("sync-clear");
  }

  /* ---------------- 桌面端：真实目录 ---------------- */

  const AGENT_PATHS = [
    { id: "claude", match: "/.claude/" },
    { id: "codex", match: "/.codex/" },
    { id: "workbuddy", match: "/.workbuddy/" },
    { id: "trae", match: "/.trae/" },
    { id: "doubao", match: "/doubao/" },
  ];

  function sourceIdForPath(path) {
    const p = String(path || "").replace(/\\/g, "/").toLowerCase();
    const hit = AGENT_PATHS.find((a) => p.includes(a.match));
    return hit ? hit.id : null;
  }

  function baseNameOf(path) {
    const parts = String(path || "").replace(/\\/g, "/").split("/").filter(Boolean);
    return parts[parts.length - 1] || "自定义目录";
  }

  /**
   * 用本机扫描结果替换索引（桌面端首次启动调用）
   * @param {Array} roots [{path, exists, skills:[...]}]
   */
  function applyNativeScan(roots) {
    if (!Array.isArray(roots)) return { applied: false, skills: 0 };
    const usable = roots.filter((r) => r && r.exists && r.skills && r.skills.length);
    if (!usable.length) return { applied: false, skills: 0 };

    const nextSkills = [];
    const touched = [];

    // 上一次扫描的结果，用来给同名同源的技能沿用原 id（见下方赋值处）
    const prevByKey = new Map(
      state.skills.map((s) => [`${s.sourceId}::${String(s.name).toLowerCase()}`, s])
    );

    usable.forEach((root) => {
      let sourceId = sourceIdForPath(root.path);

      if (sourceId) {
        const src = getSource(sourceId);
        if (src) {
          src.nativePath = root.path;
          src.native = true;
        }
      } else {
        let src = state.sources.find(
          (s) => s.nativePath === root.path || s.path === root.path
        );
        if (!src) {
          src = {
            id: uid("src"),
            name: baseNameOf(root.path),
            path: root.path,
            nativePath: root.path,
            color: nextColor(state.sources),
            readonly: false,
            builtin: false,
            native: true,
          };
          state.sources.push(src);
        }
        sourceId = src.id;
      }

      touched.push(sourceId);

      root.skills.forEach((scanned) => {
        const skill = SH.native.toSkill(scanned, sourceId);
        skill.categoryId = guessCategory(skill.name, skill.description);
        skill.exportable = !(getSource(sourceId) || {}).readonly;

        // toSkill() 不带 id。少了它，卡片的 data-id 会变成 "undefined"，
        // 选中和勾选都会找不到技能（表现为右侧空白、勾选框不亮）。
        // 同名同源的沿用旧 id，保证重启后按 id 关联的状态（收藏等）不丢。
        // 注意要判 prev.id 本身是否存在：修复前落盘的老数据 id 就是 undefined，
        // 直接沿用会把 undefined 继续传下去。
        const key = `${sourceId}::${String(skill.name).toLowerCase()}`;
        const prev = prevByKey.get(key);
        skill.id = prev && prev.id ? prev.id : uid("sk");
        if (prev && prev.favorite) skill.favorite = true;

        nextSkills.push(skill);
      });
    });

    if (!nextSkills.length) return { applied: false, skills: 0 };

    state.skills = nextSkills;
    state.syncAt = Date.now();
    ui.checked.clear();
    ui.selectedId = null;
    persist();
    emit("native-scan");

    return {
      applied: true,
      skills: nextSkills.length,
      sources: touched.length,
      names: usable.map((r) => baseNameOf(r.path)),
    };
  }

  /** 桌面端：把技能真实写到目标 Agent 目录（后端会先备份旧版本） */
  function persistSkillToDisk(skill, target) {
    const native = SH.native;
    if (!native || !native.isNative) return;
    const root = target && target.nativePath;
    if (!root) return;

    const files = (skill.files || []).map((f) => ({
      name: f.name,
      content: f.content || "",
    }));
    if (!files.some((f) => /^SKILL\.md$/i.test(f.name))) {
      files.unshift({ name: "SKILL.md", content: skill.content || "" });
    }
    if (skill.meta && skill.meta.fileName && skill.meta.content) {
      if (!files.some((f) => f.name === skill.meta.fileName)) {
        files.push({ name: skill.meta.fileName, content: skill.meta.content });
      }
    }

    native.writeSkill(root, skill.name, files).catch((err) => {
      SH.toast && SH.toast(`写入 ${target.name} 失败：${err}`, "error");
    });
  }

  /** 桌面端：卸载时把目录移入回收站 */
  function removeSkillFromDisk(record) {
    const native = SH.native;
    if (!native || !native.isNative) return;
    const dir = record && record.nativeDir;
    if (!dir) return;
    native.removeSkill(dir).catch((err) => {
      SH.toast && SH.toast(`清理 ${record.name} 的目录失败：${err}`, "error");
    });
  }

  /* ---------------- 卸载 ---------------- */

  /** 进入某个安装点的卸载确认态 */
  function setPendingUninstall(skillId) {
    ui.pendingUninstall = ui.pendingUninstall === skillId ? null : skillId;
    emit("pending-uninstall");
  }

  /**
   * 从它所在的 Agent 卸载这条安装记录
   * 只读目录不允许卸载；卸载最后一个安装点后，该技能会从列表消失
   */
  function uninstallSkill(skillId) {
    const record = getSkill(skillId);
    if (!record) return { status: "failed", reason: "技能不存在" };

    const source = getSource(record.sourceId);
    if (!source) return { status: "failed", reason: "来源不存在" };
    if (source.readonly) {
      return { status: "failed", reason: `${source.name} 是只读目录，无法卸载` };
    }

    const key = record.name.toLowerCase();
    const total = state.skills.filter((s) => s.name.toLowerCase() === key).length;
    const wasSelected = ui.selectedId === skillId;

    removeSkillFromDisk(record);
    state.skills = state.skills.filter((s) => s.id !== skillId);
    ui.checked.delete(skillId);
    ui.pendingUninstall = null;

    if (wasSelected) {
      const rest = state.skills.find((s) => s.name.toLowerCase() === key);
      ui.selectedId = rest ? rest.id : null;
      ui.activeTab = "installs";
    }

    persist();
    emit("uninstall");
    return { status: "removed", target: source.name, remaining: total - 1 };
  }

  /** 分组：默认按分类，排序为「按来源分组」时按来源 */
  function groupedSkills() {
    const items = filteredSkills();
    const bySource = ui.sort === "source";
    const groups = [];

    if (bySource) {
      state.sources.forEach((src) => {
        const list = items.filter((s) => s.sourceId === src.id);
        if (list.length) {
          groups.push({
            key: src.id,
            name: src.name,
            color: sourceColor(src),
            kind: "source",
            items: list,
          });
        }
      });
      return groups;
    }

    state.categories.forEach((cat) => {
      const list = items.filter((s) => s.categoryId === cat.id);
      if (list.length) {
        groups.push({
          key: cat.id,
          name: cat.name,
          color: categoryColor(cat),
          kind: "category",
          items: list,
        });
      }
    });
    return groups;
  }

  function sourceCounts() {
    const map = {};
    state.sources.forEach((s) => {
      map[s.id] = 0;
    });
    state.skills.forEach((s) => {
      if (map[s.sourceId] === undefined) map[s.sourceId] = 0;
      map[s.sourceId] += 1;
    });
    return map;
  }

  function categoryCounts() {
    const map = {};
    state.categories.forEach((c) => {
      map[c.id] = 0;
    });
    state.skills.forEach((s) => {
      if (map[s.categoryId] === undefined) map[s.categoryId] = 0;
      map[s.categoryId] += 1;
    });
    return map;
  }

  /* ---------------- UI 状态 ---------------- */
  function setQuery(value) {
    ui.query = String(value || "").trim();
    emit("query");
  }

  function setSource(id) {
    ui.sourceId = id;
    ui.categoryId = ui.categoryId;
    emit("scope");
  }

  function setCategory(id) {
    ui.categoryId = id;
    emit("scope");
  }

  function setFilter(id) {
    ui.filter = id;
    emit("filter");
  }

  function setSort(id) {
    ui.sort = id;
    emit("sort");
  }

  function setView(id) {
    ui.view = id;
    emit("view");
  }

  function selectSkill(id) {
    ui.selectedId = id;
    ui.activeTab = "preview";
    ui.activeFile = null;
    emit("select");
  }

  function setTab(tab) {
    ui.activeTab = tab;
    ui.activeFile = null;
    emit("tab");
  }

  function openFile(name) {
    ui.activeFile = name;
    emit("file");
  }

  function toggleCheck(id) {
    if (ui.checked.has(id)) ui.checked.delete(id);
    else ui.checked.add(id);
    emit("check");
  }

  function setChecked(ids) {
    ui.checked = new Set(ids);
    emit("check");
  }

  function clearChecks() {
    ui.checked.clear();
    emit("check");
  }

  function toggleFavorite(id) {
    const skill = getSkill(id);
    if (!skill) return;
    skill.favorite = !skill.favorite;
    persist();
    emit("favorite");
  }

  /* ---------------- 数据操作 ---------------- */
  const CATEGORY_HINTS = [
    { id: "code", words: ["code", "git", "test", "api", "sql", "review", "commit", "flutter", "mock"] },
    { id: "doc", words: ["doc", "note", "article", "report", "pdf", "write", "文案", "写作", "纪要", "文档"] },
    { id: "data", words: ["data", "chart", "csv", "excel", "分析", "统计", "实验", "ab"] },
    { id: "design", words: ["ui", "icon", "design", "poster", "color", "设计", "海报", "配色", "图标"] },
    { id: "auto", words: ["auto", "cron", "clipboard", "send", "tidy", "自动化", "定时", "整理"] },
  ];

  function guessCategory(name, desc) {
    const hay = `${name} ${desc}`.toLowerCase();
    for (const hint of CATEGORY_HINTS) {
      if (hint.words.some((w) => hay.includes(w))) return hint.id;
    }
    return "other";
  }

  function normalizeName(name) {
    return String(name || "").replace(/\.md$/i, "").trim();
  }

  /** 新自定义来源 / 分类的取色板 */
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

  function nextColor(list) {
    return PALETTE[list.length % PALETTE.length];
  }

  function addSource({ name, path, count = 0 }) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return { ok: false, reason: "来源名称不能为空" };
    if (state.sources.some((s) => s.name === trimmed)) {
      return { ok: false, reason: "已存在同名来源" };
    }
    const id = uid("src");
    state.sources.push({
      id,
      name: trimmed,
      path: String(path || "").trim() || `~/${trimmed}`,
      color: nextColor(state.sources),
      readonly: false,
      builtin: false,
      count,
    });
    persist();
    emit("sources");
    return { ok: true, id };
  }

  function updateSource(id, patch = {}) {
    const src = getSource(id);
    if (!src) return { ok: false, reason: "来源不存在" };
    const name = String(patch.name !== undefined ? patch.name : src.name).trim();
    if (!name) return { ok: false, reason: "来源名称不能为空" };
    if (state.sources.some((s) => s.id !== id && s.name === name)) {
      return { ok: false, reason: "已存在同名来源" };
    }
    src.name = name;
    if (patch.path !== undefined && String(patch.path).trim()) {
      src.path = String(patch.path).trim();
    }
    if (patch.color) src.color = patch.color;
    persist();
    emit("sources");
    return { ok: true };
  }

  function removeSource(id) {
    const src = getSource(id);
    if (!src || src.builtin) return { ok: false, reason: "内置来源不可移除" };
    const owned = state.skills.filter((s) => s.sourceId === id);
    state.skills = state.skills.filter((s) => s.sourceId !== id);
    state.sources = state.sources.filter((s) => s.id !== id);
    if (ui.sourceId === id) ui.sourceId = "all";
    owned.forEach((s) => ui.checked.delete(s.id));
    if (owned.some((s) => s.id === ui.selectedId)) ui.selectedId = null;
    persist();
    emit("sources");
    return { ok: true, removed: owned.length };
  }

  /* ---------------- 分类 ---------------- */
  function addCategory({ name, color } = {}) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return { ok: false, reason: "分类名称不能为空" };
    if (state.categories.some((c) => c.name === trimmed)) {
      return { ok: false, reason: "已存在同名分类" };
    }
    const id = uid("cat");
    state.categories.push({
      id,
      name: trimmed,
      color: color || nextColor(state.categories),
      icon: "other",
      custom: true,
    });
    persist();
    emit("categories");
    return { ok: true, id };
  }

  function updateCategory(id, patch = {}) {
    const cat = getCategory(id);
    if (!cat) return { ok: false, reason: "分类不存在" };
    const name = String(patch.name !== undefined ? patch.name : cat.name).trim();
    if (!name) return { ok: false, reason: "分类名称不能为空" };
    if (state.categories.some((c) => c.id !== id && c.name === name)) {
      return { ok: false, reason: "已存在同名分类" };
    }
    cat.name = name;
    if (patch.color) cat.color = patch.color;
    persist();
    emit("categories");
    return { ok: true };
  }

  function removeCategory(id) {
    const cat = getCategory(id);
    if (!cat) return { ok: false, reason: "分类不存在" };
    if (state.categories.length <= 1) {
      return { ok: false, reason: "至少保留一个分类" };
    }
    // 优先回退到「其他」，语义上比塞进某个具体分类更轻
    const fallback =
      state.categories.find((c) => c.id !== id && c.id === "other") ||
      state.categories.find((c) => c.id !== id);
    let moved = 0;
    state.skills.forEach((s) => {
      if (s.categoryId === id) {
        s.categoryId = fallback.id;
        moved += 1;
      }
    });
    state.categories = state.categories.filter((c) => c.id !== id);
    if (ui.categoryId === id) ui.categoryId = "all";
    persist();
    emit("categories");
    return { ok: true, moved, fallbackName: fallback.name };
  }

  /** 分类的 CSS 颜色值（兼容内置 colorVar 与自定义 hex） */
  function categoryColor(catOrId) {
    const cat = typeof catOrId === "string" ? getCategory(catOrId) : catOrId;
    if (!cat) return "var(--cat-other)";
    return cat.color || `var(${cat.colorVar || "--cat-other"})`;
  }

  function sourceColor(srcOrId) {
    const src = typeof srcOrId === "string" ? getSource(srcOrId) : srcOrId;
    if (!src) return "var(--src-custom)";
    return src.color || `var(${src.colorVar || "--src-custom"})`;
  }

  /**
   * 导入技能
   * @param {Array} items [{name, description, content, files}]
   * @param {string} targetSourceId 目标 Agent
   * @param {'skip'|'overwrite'|'rename'} policy 同名冲突策略
   */
  function importSkills(items, targetSourceId, policy) {
    const target = getSource(targetSourceId);
    if (!target) return { added: 0, overwritten: 0, skipped: 0, renamed: 0 };
    if (target.readonly) return { added: 0, overwritten: 0, skipped: items.length, renamed: 0, readonly: true };

    let added = 0;
    let overwritten = 0;
    let skipped = 0;
    let renamed = 0;

    items.forEach((item) => {
      const name = normalizeName(item.name);
      if (!name) return;
      const existing = state.skills.find(
        (s) => s.sourceId === targetSourceId && s.name.toLowerCase() === name.toLowerCase()
      );

      if (existing) {
        if (policy === "skip") {
          skipped += 1;
          return;
        }
        if (policy === "rename") {
          let next = `${name}-2`;
          let n = 2;
          while (state.skills.some((s) => s.sourceId === targetSourceId && s.name === next)) {
            n += 1;
            next = `${name}-${n}`;
          }
          pushSkill({ ...item, name: next }, target);
          added += 1;
          renamed += 1;
          return;
        }
        // overwrite：保留 id / 收藏状态，覆盖内容
        existing.description = item.description || existing.description;
        existing.content = item.content || existing.content;
        existing.files = item.files && item.files.length ? item.files : existing.files;
        if (item.meta) existing.meta = item.meta;
        existing.updatedAt = Date.now();
        const num = parseFloat(String(existing.version).replace(/[^\d.]/g, "")) || 0;
        existing.version = `v${(num + 0.1).toFixed(1)}`;
        overwritten += 1;
        return;
      }

      pushSkill({ ...item, name }, target);
      added += 1;
    });

    state.syncAt = Date.now();
    persist();
    emit("import");
    return { added, overwritten, skipped, renamed };
  }

  function pushSkill(item, target) {
    const fileList = (item.files || []).map((f) => ({
      name: f.name,
      content: f.content,
      size: f.size || SH.util.byteLength(f.content || ""),
    }));
    if (!fileList.some((f) => /(^|\/)SKILL\.md$/i.test(f.name))) {
      fileList.unshift({
        name: "SKILL.md",
        content: item.content || "",
        size: SH.util.byteLength(item.content || ""),
      });
    }
    const now = Date.now();
    state.skills.push({
      id: uid("sk"),
      name: item.name,
      description: item.description || "导入的 SKILL",
      categoryId: item.categoryId || guessCategory(item.name, item.description),
      sourceId: target.id,
      version: item.version || "v1.0",
      updatedAt: now,
      createdAt: now,
      favorite: false,
      exportable: !target.readonly,
      tags: item.tags || ["导入"],
      path: `${target.path}/${item.name}`,
      content: item.content || "",
      files: fileList,
      meta: item.meta || null,
      nativeDir: item.nativeDir || null,
    });
  }

  async function rescan() {
    await SH.util.wait(760);
    const drift = Math.max(1, Math.round(state.skills.length * 0.12));
    const pool = state.skills.slice();
    for (let i = 0; i < drift && pool.length; i += 1) {
      const idx = Math.floor(Math.random() * pool.length);
      const skill = pool.splice(idx, 1)[0];
      skill.updatedAt = Date.now() - Math.floor(Math.random() * 3600000);
    }
    state.syncAt = Date.now();
    persist();
    emit("rescan");
  }

  /** 写入或清除单个 SKILL 的来源标记 */
  function setSkillMeta(skillId, meta) {
    const skill = getSkill(skillId);
    if (!skill) return { ok: false, reason: "技能不存在" };
    if (!meta) {
      skill.meta = null;
    } else {
      const data = meta.data || {};
      skill.meta = {
        formatId: meta.formatId,
        fileName: meta.fileName,
        data,
        content: meta.content || `${JSON.stringify(data, null, 2)}\n`,
      };
    }
    // 元数据变更不算内容变更，不动 updatedAt，避免列表顺序突然跳动
    persist();
    emit("meta");
    return { ok: true };
  }

  function removeSkill(id) {
    const skill = getSkill(id);
    if (!skill) return false;
    state.skills = state.skills.filter((s) => s.id !== id);
    ui.checked.delete(id);
    if (ui.selectedId === id) ui.selectedId = null;
    persist();
    emit("remove");
    return true;
  }

  function resetData() {
    state.sources = clone(defaults.sources);
    state.categories = clone(defaults.categories);
    state.skills = clone(defaults.skills);
    state.syncAt = Date.now();
    ui.checked.clear();
    ui.selectedId = null;
    ui.sourceId = "all";
    ui.categoryId = "all";
    ui.filter = "all";
    ui.query = "";
    persist();
    emit("reset");
  }

  function setPref(key, value) {
    state.prefs[key] = value;
    persist();
    emit("pref");
  }

  load();

  SH.store = {
    state,
    ui,
    subscribe,
    emit,
    persist,
    getSkill,
    getSource,
    getCategory,
    displayName,
    sourceName,
    categoryName,
    filteredSkills,
    groupedSkills,
    aggregateSkills,
    uniqueSkillCount,
    installStatus,
    syncSkillTo,
    syncSkillToAll,
    clearSyncResult,
    setPendingUninstall,
    uninstallSkill,
    applyNativeScan,
    sourceCounts,
    categoryCounts,
    setQuery,
    setSource,
    setCategory,
    setFilter,
    setSort,
    setView,
    selectSkill,
    setTab,
    openFile,
    toggleCheck,
    setChecked,
    clearChecks,
    toggleFavorite,
    addSource,
    updateSource,
    removeSource,
    addCategory,
    updateCategory,
    removeCategory,
    categoryColor,
    sourceColor,
    importSkills,
    rescan,
    setSkillMeta,
    removeSkill,
    resetData,
    setPref,
    guessCategory,
  };
})();
