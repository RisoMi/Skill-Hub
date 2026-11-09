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
    marks: [],
    syncAt: SH.seed.builtAt,
  };

  const ui = {
    query: "",
    sourceId: "all",
    categoryId: "all",
    /** 侧栏当前 tab：source / category / mark / hidden */
    navTab: "source",
    /** 标记筛选，all 表示不筛 */
    markId: "all",
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
    marks: [],
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
    state.marks = Array.isArray(base.marks) ? base.marks : [];
    state.syncAt = base.syncAt || Date.now();
    state.prefs = Object.assign({ theme: "light", platform: "auto" }, prefs || {});
  }

  let saveTimer = null;

  /**
   * 持久化用的轻量副本：剥掉正文类大字段
   * ------------------------------------------------------------
   * localStorage 每个源的配额约 5MB（按 UTF-16 计），而本机技能正文
   * 往往是几十 MB（实测 SKILL.md 合计 24.9MB，另有附件）。把 state 全量
   * 序列化进去必然抛 QuotaExceededError，表现就是每次改动都提示
   * "本地存储空间不足"。
   *
   * 索引只需要够渲染列表与分类：
   *   - 去掉 skill.content（SKILL.md 正文）
   *   - 去掉 files[].content（附件正文），保留文件名与大小
   *   - 去掉 meta.content（原文），保留 meta.data
   * 正文由启动扫描从磁盘重新读回；编辑后的内容由写盘命令持久化。
   */
  function slimSkills(skills) {
    return (skills || []).map((s) => {
      const out = Object.assign({}, s);
      delete out.content;
      if (Array.isArray(s.files)) {
        out.files = s.files.map((f) => ({ name: f.name, size: f.size || 0 }));
      }
      if (s.meta) {
        out.meta = Object.assign({}, s.meta);
        delete out.meta.content;
      }
      return out;
    });
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const payload = {
        sources: state.sources,
        categories: state.categories,
        marks: state.marks,
        skills: slimSkills(state.skills),
        syncAt: state.syncAt,
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(payload));
      } catch (err) {
        // 兜底一：连索引都放不下（技能数量极多）时退到最小结构，
        // 至少保住用户自定义的来源与分类。
        try {
          const minimal = Object.assign({}, payload, {
            skills: payload.skills.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              categoryId: s.categoryId,
              sourceId: s.sourceId,
              version: s.version,
              updatedAt: s.updatedAt,
              createdAt: s.createdAt,
              favorite: s.favorite,
              exportable: s.exportable,
              tags: s.tags,
              path: s.path,
            })),
          });
          localStorage.setItem(KEY, JSON.stringify(minimal));
          SH.toast &&
            SH.toast("本地索引较大，已只保留技能基础信息（正文会在重新扫描后恢复）", "warn");
        } catch (err2) {
          // 兜底二：彻底放不下，明确告知而不是反复刷错误
          console.warn("[store] 索引无法写入本地存储", err2);
          SH.toast && SH.toast("本地索引无法保存，重启后会自动重新扫描，不影响使用", "warn");
        }
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

    const inHiddenTab = ui.navTab === "hidden";

    return sortItems(
      pool.filter((s) => {
        // 隐藏的 SKILL 只在「隐藏」栏里出现，避免 Agent 内置技能干扰正常浏览
        if (inHiddenTab ? !s.hidden : s.hidden) return false;
        return (
          matchesQuery(s, ui.query) &&
          matchesFilter(s) &&
          (ui.categoryId === "all" || s.categoryId === ui.categoryId) &&
          (ui.markId === "all" || s.markId === ui.markId)
        );
      })
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
  /* ---------------- 标记（自定义名称与配色） ---------------- */

  const MARK_COLORS = [
    "#c0392b",
    "#e2543a",
    "#d97706",
    "#eab308",
    "#65a30d",
    "#16a34a",
    "#0d9488",
    "#0891b2",
    "#2563eb",
    "#4f46e5",
    "#7c3aed",
    "#a855f7",
    "#db2777",
    "#e11d48",
    "#78716c",
    "#0f172a",
  ];

  function getMark(id) {
    return state.marks.find((m) => m.id === id) || null;
  }

  function markColor(mark) {
    return (mark && mark.color) || "var(--line-strong)";
  }

  /** 侧栏计数只算会出现在列表里的技能，保证数字与列表一致 */
  function markCounts() {
    const map = {};
    aggregateSkills().forEach((s) => {
      if (s.hidden || !s.markId) return;
      map[s.markId] = (map[s.markId] || 0) + 1;
    });
    return map;
  }

  function addMark({ name, color } = {}) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return { ok: false, reason: "标记名称不能为空" };
    if (state.marks.some((m) => m.name === trimmed)) {
      return { ok: false, reason: "已存在同名标记" };
    }
    const id = uid("mark");
    state.marks.push({
      id,
      name: trimmed,
      color: color || MARK_COLORS[state.marks.length % MARK_COLORS.length],
    });
    persist();
    emit("marks");
    return { ok: true, id };
  }

  function updateMark(id, patch = {}) {
    const mark = getMark(id);
    if (!mark) return { ok: false, reason: "标记不存在" };
    const name = String(patch.name !== undefined ? patch.name : mark.name).trim();
    if (!name) return { ok: false, reason: "标记名称不能为空" };
    if (state.marks.some((m) => m.id !== id && m.name === name)) {
      return { ok: false, reason: "已存在同名标记" };
    }
    mark.name = name;
    if (patch.color) mark.color = patch.color;
    persist();
    emit("marks");
    return { ok: true };
  }

  function removeMark(id) {
    const mark = getMark(id);
    if (!mark) return { ok: false, reason: "标记不存在" };
    let cleared = 0;
    state.skills.forEach((s) => {
      if (s.markId === id) {
        s.markId = null;
        cleared += 1;
      }
    });
    state.marks = state.marks.filter((m) => m.id !== id);
    if (ui.markId === id) ui.markId = "all";
    persist();
    emit("marks");
    return { ok: true, cleared };
  }

  /** 给技能打标记；markId 传 null 为清除。同名多副本保持同步 */
  function setSkillMark(skillId, markId) {
    const skill = getSkill(skillId);
    if (!skill) return { ok: false, reason: "技能不存在" };
    if (markId && !getMark(markId)) return { ok: false, reason: "标记不存在" };

    const next = markId || null;
    const key = skill.name.toLowerCase();
    state.skills.forEach((s) => {
      if (s.name.toLowerCase() === key) s.markId = next;
    });

    persist();
    emit("marks");
    return { ok: true, markId: next };
  }

  /** 隐藏 / 恢复；隐藏后默认不出现在列表里 */
  function setSkillHidden(skillId, hidden) {
    const skill = getSkill(skillId);
    if (!skill) return { ok: false, reason: "技能不存在" };

    const flag = !!hidden;
    const key = skill.name.toLowerCase();
    state.skills.forEach((s) => {
      if (s.name.toLowerCase() === key) s.hidden = flag;
    });

    if (flag && ui.selectedId === skillId) ui.selectedId = null;
    persist();
    emit("hidden");
    return { ok: true, hidden: flag };
  }

  function hiddenSkills() {
    return aggregateSkills().filter((s) => s.hidden);
  }

  function setNavTab(tab) {
    const allowed = ["source", "category", "mark", "hidden"];
    ui.navTab = allowed.indexOf(tab) >= 0 ? tab : "source";
    emit("nav");
  }

  function setMark(id) {
    ui.markId = id || "all";
    emit("mark");
  }

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
  /**
   * 把一个技能的完整文件集合写到它所在目录。
   * 后端会先整目录备份再逐个覆盖同名文件（不删除其他文件）。
   * @returns {Promise<{ok:boolean, reason?:string}>}
   */
  async function writeSkillFiles(skill) {
    const native = SH.native;
    if (!native || !native.isNative) {
      return { ok: false, reason: "浏览器预览无法写入磁盘，请用桌面版" };
    }
    const src = getSource(skill.sourceId);
    const root = (src && src.nativePath) || null;
    if (!root) {
      return { ok: false, reason: "该技能没有关联的真实目录（可能来自导入包）" };
    }

    const files = (skill.files || [])
      .filter((f) => typeof f.content === "string")
      .map((f) => ({ name: f.name, content: f.content }));
    if (!files.some((f) => /^SKILL\.md$/i.test(f.name))) {
      files.unshift({ name: "SKILL.md", content: skill.content || "" });
    }
    if (skill.meta && skill.meta.fileName && skill.meta.content) {
      if (!files.some((f) => f.name === skill.meta.fileName)) {
        files.push({ name: skill.meta.fileName, content: skill.meta.content });
      }
    }

    try {
      await native.writeSkill(root, skill.name, files);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String((err && err.message) || err) };
    }
  }

  /**
   * 保存单个文件（新增或修改），改内存后立即尝试落盘。
   * 落盘失败不影响内存中的编辑结果，由调用方按 persisted 决定提示语气。
   */
  async function saveSkillFile(skillId, fileName, content) {
    const skill = getSkill(skillId);
    if (!skill) return { ok: false, reason: "技能不存在" };

    const name = String(fileName || "").trim().replace(/\\/g, "/");
    if (!name) return { ok: false, reason: "文件名不能为空" };
    if (name.startsWith("/") || name.split("/").includes("..")) {
      return { ok: false, reason: "文件名不合法" };
    }

    skill.files = Array.isArray(skill.files) ? skill.files : [];
    const text = content == null ? "" : String(content);
    const hit = skill.files.find((f) => f.name === name);
    if (hit) {
      hit.content = text;
      hit.size = SH.util.byteLength(text);
    } else {
      skill.files.push({ name, content: text, size: SH.util.byteLength(text) });
    }
    // SKILL.md 是主文件，正文同时写回 skill.content（预览与导出都读它）
    if (/^SKILL\.md$/i.test(name)) skill.content = text;
    skill.updatedAt = Date.now();

    persist();
    emit("file-saved");

    const res = await writeSkillFiles(skill);
    return {
      ok: true,
      created: !hit,
      fileName: name,
      persisted: !!res.ok,
      reason: res.reason,
    };
  }

  /**
   * 删除技能目录下的单个文件（配套新建/修改）。
   * 主文件 SKILL.md 不允许删——它承载技能正文，删了整个技能就废了。
   */
  async function deleteSkillFile(skillId, fileName) {
    const skill = getSkill(skillId);
    if (!skill) return { ok: false, reason: "技能不存在" };

    const name = String(fileName || "").trim();
    if (!name) return { ok: false, reason: "文件名不能为空" };
    if (/^SKILL\.md$/i.test(name)) {
      return { ok: false, reason: "SKILL.md 是主文件，不能删除" };
    }

    const files = Array.isArray(skill.files) ? skill.files : [];
    if (!files.some((f) => f.name === name)) {
      return { ok: false, reason: "文件不存在" };
    }

    skill.files = files.filter((f) => f.name !== name);
    skill.updatedAt = Date.now();
    persist();
    emit("file-deleted");

    const native = SH.native;
    if (!native || !native.isNative || !skill.nativeDir) {
      return { ok: true, persisted: false, reason: "浏览器预览无法写入磁盘，请用桌面版" };
    }
    try {
      await native.deleteSkillFile(skill.nativeDir, name);
      return { ok: true, persisted: true };
    } catch (err) {
      return { ok: true, persisted: false, reason: String((err && err.message) || err) };
    }
  }

  /**
   * 删除整个 SKILL：把它在每个 Agent 目录下的副本都移入回收站。
   * 回收站由后端实现（data/trash/<时间戳>/<技能名>），可手动捞回。
   * 记录会从索引里移除，避免列表残留幽灵项。
   */
  async function deleteSkill(skillId) {
    const skill = getSkill(skillId);
    if (!skill) return { ok: false, reason: "技能不存在" };

    const key = skill.name.toLowerCase();
    const records = state.skills.filter((s) => s.name.toLowerCase() === key);
    // 按路径去重：同名技能可能挂在多个来源下却指向同一个目录，
    // 不去重会对同一路径调用两次移动，第二次必然报"目录不存在"
    const dirs = Array.from(new Set(records.map((r) => r.nativeDir).filter(Boolean)));

    const failed = [];
    if (SH.native && SH.native.isNative) {
      for (const dir of dirs) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await SH.native.removeSkill(dir);
        } catch (err) {
          failed.push({ dir, reason: String((err && err.message) || err) });
        }
      }
    }

    // 即便某个目录移动失败也从索引移除：留着只会变成点不开的幽灵项
    state.skills = state.skills.filter((s) => s.name.toLowerCase() !== key);

    if (ui.selectedId === skillId) ui.selectedId = null;
    records.forEach((r) => ui.checked.delete(r.id));

    persist();
    emit("delete");

    return {
      ok: true,
      numberOf: records.length,
      dirs,
      failed,
      persisted: !!(SH.native && SH.native.isNative),
    };
  }

  /**
   * 批量删除：按技能名去重（同名多副本算一个），逐个目录移入回收站，
   * 最后一次性提交索引，避免每删一个就重渲染一次。
   */
  async function deleteSkills(skillIds) {
    const ids = Array.from(new Set(skillIds || []));
    const targets = new Map();

    ids.forEach((id) => {
      const s = getSkill(id);
      if (s) targets.set(s.name.toLowerCase(), s.name);
    });
    if (!targets.size) return { ok: false, reason: "没有可删除的项" };

    const failed = [];

    // 汇总所有待删目录并按路径去重：同名技能可能挂在多个来源下指向同一目录
    const dirs = Array.from(
      new Set(
        state.skills
          .filter((s) => targets.has(s.name.toLowerCase()))
          .map((s) => s.nativeDir)
          .filter(Boolean)
      )
    );

    if (SH.native && SH.native.isNative) {
      for (const dir of dirs) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await SH.native.removeSkill(dir);
        } catch (err) {
          failed.push({ dir, reason: String((err && err.message) || err) });
        }
      }
    }

    const before = state.skills.length;
    state.skills = state.skills.filter((s) => !targets.has(s.name.toLowerCase()));

    // 选中项若被删掉，同步清理
    const removedSelected =
      ui.selectedId &&
      !state.skills.some((s) => s.id === ui.selectedId);
    if (removedSelected) ui.selectedId = null;
    ids.forEach((id) => ui.checked.delete(id));

    persist();
    emit("delete");

    return {
      ok: true,
      names: Array.from(targets.values()),
      records: before - state.skills.length,
      dirs: dirs.length,
      failed,
      persisted: !!(SH.native && SH.native.isNative),
    };
  }

  /**
   * 本地新建一条 SKILL 记录（写盘成功后调用）。
   * 不走重扫：重扫只覆盖默认目录，会把自定义目录下的技能冲掉，
   * 而且重建索引后新技能的 id 也会变，拿不到刚建的那条。
   */
  function addLocalSkill({ name, description, sourceId, nativeDir, content }) {
    const key = String(name || "").toLowerCase();
    if (!key) return { ok: false, reason: "名称不能为空" };

    const dup = state.skills.find(
      (s) => s.sourceId === sourceId && s.name.toLowerCase() === key
    );
    if (dup) return { ok: false, reason: "该目录下已存在同名 SKILL", skill: dup };

    const text = content || "";
    const skill = {
      id: uid("sk"),
      name,
      description: description || "",
      categoryId: guessCategory(name, description || ""),
      sourceId,
      version: "v1.0",
      updatedAt: Date.now(),
      createdAt: Date.now(),
      favorite: false,
      exportable: true,
      hidden: false,
      markId: null,
      tags: [],
      path: nativeDir,
      nativeDir,
      content: text,
      files: [{ name: "SKILL.md", content: text, size: SH.util.byteLength(text) }],
      meta: null,
    };

    state.skills.push(skill);
    persist();
    emit("skills");
    return { ok: true, skill };
  }

  /**
   * 保存/清除元数据标记，并持久化到磁盘上的 _*_meta.json。
   * 清除时会把对应文件一并删掉，否则重启扫描又会被读回来。
   */
  async function setSkillMeta(skillId, meta) {
    const skill = getSkill(skillId);
    if (!skill) return { ok: false, reason: "技能不存在" };

    const oldFile = skill.meta && skill.meta.fileName ? skill.meta.fileName : null;

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

    // 清除：删除磁盘上的标记文件；保存：按当前内容写盘
    const native = SH.native;
    if (!native || !native.isNative) {
      return { ok: true, persisted: false, reason: "浏览器预览无法写入磁盘，请用桌面版" };
    }

    if (!skill.meta) {
      if (!oldFile || !skill.nativeDir) return { ok: true, persisted: true };
      try {
        await native.deleteSkillFile(skill.nativeDir, oldFile);
        return { ok: true, persisted: true, removed: oldFile };
      } catch (err) {
        return { ok: true, persisted: false, reason: String((err && err.message) || err) };
      }
    }

    const res = await writeSkillFiles(skill);
    return { ok: true, persisted: !!res.ok, reason: res.reason };
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
    getMark,
    markColor,
    markCounts,
    addMark,
    updateMark,
    removeMark,
    setSkillMark,
    setSkillHidden,
    hiddenSkills,
    setNavTab,
    setMark,
    MARK_COLORS,
    importSkills,
    rescan,
    addLocalSkill,
    setSkillMeta,
    saveSkillFile,
    deleteSkillFile,
    deleteSkill,
    deleteSkills,
    writeSkillFiles,
    removeSkill,
    resetData,
    setPref,
    guessCategory,
  };
})();
