/* ------------------------------------------------------------
   metaFormats.js · 来源标记文件（*_meta.json）格式注册与生成
   模板依据本机真实文件：
     ~/.workbuddy/skills/<skill>/_skillhub_meta.json   技能市场安装
     ~/.workbuddy/skills/<skill>/_user_meta.json       用户导入
     ~/.workbuddy/skills/<skill>/_meta.json            插件清单
   其他 Agent 目录下未发现同类官方标记文件，统一使用通用结构。
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;

  /* 文件名 → 已知格式（导入时用于识别） */
  const FILE_FORMAT = {
    "_skillhub_meta.json": "workbuddy-market",
    "_user_meta.json": "workbuddy-user",
    "_meta.json": "workbuddy-plugin",
  };

  const SOURCE_OPTIONS = [
    { value: "marketplace", label: "技能市场安装" },
    { value: "local", label: "本地目录" },
    { value: "userImport", label: "用户导入" },
  ];

  /* ---------------- 工具 ---------------- */
  function normalizeVersion(v) {
    let s = String(v || "")
      .trim()
      .replace(/^v/i, "");
    if (!s) return "1.0.0";
    const parts = s.split(".");
    while (parts.length < 3) parts.push("0");
    return parts.slice(0, 3).join(".");
  }

  /** 去掉空值，保持字段顺序 */
  function clean(obj) {
    const out = {};
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value) && value.length === 0) return;
      out[key] = value;
    });
    return out;
  }

  async function sha256(text) {
    try {
      if (!window.crypto || !window.crypto.subtle) return "";
      const buf = await window.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(String(text))
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (err) {
      return "";
    }
  }

  /* ---------------- 各格式的字段构造 ---------------- */
  const BUILDERS = {
    async market(skill, opts) {
      const hash = opts.hash === false ? "" : await sha256(skill.content || "");
      return clean({
        name: opts.name || skill.name,
        installedAt: opts.installedAt || Date.now(),
        source: opts.source || "marketplace",
        version: normalizeVersion(skill.version),
        userModified: opts.userModified ? true : undefined,
        skillId: opts.skillId || undefined,
        description_zh: skill.description || undefined,
        description_en: opts.descriptionEn || undefined,
        examples_zh: opts.examplesZh || undefined,
        examples_en: opts.examplesEn || undefined,
        installedContentHash: hash ? `sha256:${hash}` : undefined,
      });
    },

    user(skill, opts) {
      return clean({
        name: opts.name || skill.name,
        installedAt: opts.installedAt || Date.now(),
        source: "userImport",
      });
    },

    plugin(skill, opts) {
      return clean({
        ownerId: opts.ownerId || "local",
        slug: opts.name || skill.name,
        version: normalizeVersion(skill.version),
        publishedAt: opts.installedAt || Date.now(),
      });
    },

    async generic(skill, opts) {
      const hash = opts.hash === false ? "" : await sha256(skill.content || "");
      return clean({
        name: opts.name || skill.name,
        installedAt: opts.installedAt || Date.now(),
        source: opts.source || "local",
        version: normalizeVersion(skill.version),
        skillId: opts.skillId || undefined,
        description_zh: skill.description || undefined,
        description_en: opts.descriptionEn || undefined,
        examples_zh: opts.examplesZh || undefined,
        examples_en: opts.examplesEn || undefined,
        installedContentHash: hash ? `sha256:${hash}` : undefined,
        generator: "Skill Hub",
      });
    },
  };

  /* ---------------- 格式清单 ---------------- */
  const FORMATS = [
    {
      id: "workbuddy-market",
      agentId: "workbuddy",
      agentName: "WorkBuddy",
      label: "技能市场安装",
      fileName: "_skillhub_meta.json",
      builder: "market",
      official: true,
      note: "技能市场安装时写入，含市场 ID、双语描述与内容哈希",
      needsSource: true,
      needsSkillId: true,
      supportsModified: true,
    },
    {
      id: "workbuddy-user",
      agentId: "workbuddy",
      agentName: "WorkBuddy",
      label: "用户导入（精简）",
      fileName: "_user_meta.json",
      builder: "user",
      official: true,
      note: "手动导入技能时写入，仅记录名称、安装时间与来源类型",
    },
    {
      id: "workbuddy-plugin",
      agentId: "workbuddy",
      agentName: "WorkBuddy",
      label: "插件清单",
      fileName: "_meta.json",
      builder: "plugin",
      official: true,
      note: "插件市场清单：发布者、slug、版本与发布时间",
      needsOwnerId: true,
    },
    {
      id: "claude-generic",
      agentId: "claude",
      agentName: "Claude Code",
      label: "通用来源标记",
      fileName: "_skillhub_meta.json",
      builder: "generic",
      official: false,
      note: "该 Agent 未发现官方标记文件，写入通用结构",
      needsSource: true,
    },
    {
      id: "codex-generic",
      agentId: "codex",
      agentName: "Codex",
      label: "通用来源标记",
      fileName: "_skillhub_meta.json",
      builder: "generic",
      official: false,
      note: "该 Agent 未发现官方标记文件，写入通用结构",
      needsSource: true,
    },
    {
      id: "trae-generic",
      agentId: "trae",
      agentName: "Trae",
      label: "通用来源标记",
      fileName: "_skillhub_meta.json",
      builder: "generic",
      official: false,
      note: "该 Agent 未发现官方标记文件，写入通用结构",
      needsSource: true,
    },
    {
      id: "doubao-generic",
      agentId: "doubao",
      agentName: "豆包工作",
      label: "通用来源标记",
      fileName: "_skillhub_meta.json",
      builder: "generic",
      official: false,
      note: "该 Agent 未发现官方标记文件，写入通用结构",
      needsSource: true,
    },
    {
      id: "custom-generic",
      agentId: "custom",
      agentName: "自定义来源",
      label: "通用来源标记",
      fileName: "_skillhub_meta.json",
      builder: "generic",
      official: false,
      note: "通用结构，适用于任意自定义技能目录",
      needsSource: true,
    },
  ];

  function getFormat(id) {
    return FORMATS.find((f) => f.id === id) || FORMATS[0];
  }

  /** 按 Agent 分组，供下拉框使用 */
  function groupedFormats() {
    const groups = [];
    FORMATS.forEach((fmt) => {
      let group = groups.find((g) => g.agentId === fmt.agentId);
      if (!group) {
        group = { agentId: fmt.agentId, agentName: fmt.agentName, items: [] };
        groups.push(group);
      }
      group.items.push(fmt);
    });
    return groups;
  }

  /**
   * 生成标记文件
   * @returns {{formatId, fileName, data, content, size}}
   */
  async function build(skill, formatId, options = {}) {
    const fmt = getFormat(formatId);
    const data = await BUILDERS[fmt.builder](skill, options);
    const content = `${JSON.stringify(data, null, 2)}\n`;
    return {
      formatId: fmt.id,
      fileName: fmt.fileName,
      data,
      content,
      size: SH.util.byteLength(content),
    };
  }

  /** 批量生成；格式按技能来源自动匹配时用 resolveFormat */
  async function buildMany(skills, formatId, options = {}) {
    const out = [];
    for (const skill of skills) {
      // eslint-disable-next-line no-await-in-loop
      out.push(await build(skill, formatId, options));
    }
    return out;
  }

  /** 从技能所属来源推断默认格式 */
  function resolveFormat(sourceId) {
    const map = {
      workbuddy: "workbuddy-market",
      claude: "claude-generic",
      codex: "codex-generic",
      trae: "trae-generic",
      doubao: "doubao-generic",
      custom: "custom-generic",
    };
    return map[sourceId] || "workbuddy-market";
  }

  /** 容错解析：真实标记文件里存在尾随逗号（并非严格 JSON） */
  function parseLoose(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "");
    try {
      return JSON.parse(raw);
    } catch (err) {
      /* 落到宽松解析 */
    }
    try {
      const cleaned = raw.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(cleaned);
    } catch (err) {
      return null;
    }
  }

  /** 识别导入包里的标记文件 */
  function detect(fileName, rawText) {
    const base = String(fileName).split("/").pop();
    const formatId = FILE_FORMAT[base];
    if (!formatId) return null;
    const data = parseLoose(rawText);
    if (!data || typeof data !== "object") return null;
    return { formatId, fileName: base, data, raw: rawText };
  }

  /** 把一份 meta 数据渲染成可读摘要 */
  function describe(meta) {
    if (!meta || !meta.data) return null;
    const d = meta.data;
    const fmt = meta.formatId ? getFormat(meta.formatId) : null;
    return {
      formatName: fmt ? `${fmt.agentName} · ${fmt.label}` : "未知格式",
      fileName: meta.fileName,
      name: d.name || d.slug || "—",
      source: d.source || (d.ownerId ? "plugin" : "—"),
      version: d.version || "—",
      installedAt: d.installedAt || d.publishedAt || null,
      skillId: d.skillId || d.ownerId || null,
      userModified: !!d.userModified,
      hash: d.installedContentHash || null,
    };
  }

  SH.meta = {
    FORMATS,
    SOURCE_OPTIONS,
    getFormat,
    groupedFormats,
    build,
    buildMany,
    resolveFormat,
    detect,
    describe,
    parseLoose,
    normalizeVersion,
    sha256,
  };
})();
