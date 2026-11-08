/* ------------------------------------------------------------
   importExport.js · 导入解析 / 导出打包
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { readBuffer, readText, byteLength, fmtDate } = SH.util;

  const SKILL_FILE = /(^|\/)SKILL\.md$/i;

  /* ---------------- 解析 frontmatter ---------------- */
  function parseMeta(content, fallbackName) {
    const { frontmatter } = SH.md.splitFrontmatter(content);
    const map = {};
    if (frontmatter) {
      frontmatter.pairs.forEach(([k, v]) => {
        map[k.toLowerCase()] = v;
      });
    }
    const description =
      map.description ||
      map.desc ||
      (String(content).match(/^#\s+(.+)$/m) ? `来自 ${fallbackName} 的 SKILL` : "");
    return {
      name: map.name || fallbackName,
      description: description || "导入的 SKILL",
      version: map.version || "v1.0",
      tags: map.tags ? map.tags.split(/[,\s]+/).filter(Boolean) : ["导入"],
    };
  }

  function baseName(path) {
    const parts = String(path).split("/");
    return parts[parts.length - 1] || "SKILL.md";
  }

  function dirName(path) {
    const parts = String(path).split("/").filter(Boolean);
    if (parts.length <= 1) return "";
    return parts[parts.length - 2];
  }

  /**
   * 把「路径 + 内容」列表按 SKILL.md 所在目录聚合成技能
   */
  function groupEntries(entries) {
    const skillDirs = new Map();
    const looseMd = [];

    entries.forEach((entry) => {
      if (entry.isDirectory) return;
      const name = entry.path;
      if (SKILL_FILE.test(name)) {
        const dir = name.replace(SKILL_FILE, "").replace(/\/$/, "");
        skillDirs.set(dir, entry);
      } else if (/\.md$/i.test(name) && !/\/references\//i.test(name)) {
        looseMd.push(entry);
      }
    });

    const items = [];

    // 每个 SKILL.md 目录一个技能
    skillDirs.forEach((mainEntry, dir) => {
      const prefix = dir ? `${dir}/` : "";
      const siblings = entries.filter(
        (e) => !e.isDirectory && e.path.startsWith(prefix) && e.path !== mainEntry.path
      );

      // 目录里的 *_meta.json 走「来源标记」通道，不作为普通文件重复打包
      const isMetaFile = (p) => /_meta\.json$/i.test(String(p).split("/").pop());
      const metaFiles = siblings
        .filter((s) => isMetaFile(s.path))
        .sort((a, b) => {
          const rank = (p) =>
            /_skillhub_meta\.json$/i.test(p) ? 0 : /_user_meta\.json$/i.test(p) ? 1 : 2;
          return rank(a.path) - rank(b.path);
        });
      let sourceMeta = null;
      for (const file of metaFiles) {
        const detected = SH.meta.detect(file.path, file.content);
        if (detected) {
          sourceMeta = detected;
          break;
        }
      }

      const fm = parseMeta(mainEntry.content, dir ? baseName(dir) + "" : "SKILL");
      const name = fm.name || (dir ? dir.split("/").pop() : "SKILL");
      items.push({
        name,
        description: fm.description,
        version: fm.version,
        tags: fm.tags,
        content: mainEntry.content,
        files: [
          { name: "SKILL.md", content: mainEntry.content, size: byteLength(mainEntry.content) },
          ...siblings
            .filter((s) => !isMetaFile(s.path))
            .map((s) => ({
              name: s.path.slice(prefix.length),
              content: s.content,
              size: byteLength(s.content),
            })),
        ],
        meta: sourceMeta,
        origin: dir || "根目录",
      });
    });

    // 没有 SKILL.md 的零散 .md：每个当作一个技能
    if (skillDirs.size === 0 && looseMd.length) {
      looseMd.forEach((entry) => {
        const meta = parseMeta(entry.content, baseName(entry.path).replace(/\.md$/i, ""));
        items.push({
          name: meta.name,
          description: meta.description,
          version: meta.version,
          tags: meta.tags,
          content: entry.content,
          files: [{ name: "SKILL.md", content: entry.content, size: byteLength(entry.content) }],
          origin: entry.path,
        });
      });
    }

    // 同批内重名去重
    const seen = new Map();
    const warnings = [];
    const unique = items.filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) {
        warnings.push(`「${item.name}」在同一批次中重复，已保留第一个`);
        return false;
      }
      seen.set(key, true);
      return true;
    });

    return { items: unique, warnings };
  }

  /**
   * 解析用户选择的文件（zip / md / 文件夹）
   * @param {FileList|File[]} fileList
   */
  async function parseSelection(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) throw new Error("没有选择任何文件");

    const zipFile = files.find((f) => /\.zip$/i.test(f.name));
    if (zipFile) {
      const buffer = await readBuffer(zipFile);
      const entriesRaw = await SH.zip.read(buffer);
      const entries = entriesRaw
        .filter((e) => !e.isDirectory)
        .map((e) => ({
          path: e.name,
          content: /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip)$/i.test(e.name)
            ? ""
            : SH.zip.textOf(e),
          isDirectory: false,
        }));

      const grouped = groupEntries(entries);
      return {
        ...grouped,
        fileName: zipFile.name,
        fileSize: zipFile.size,
        fileKind: "zip",
      };
    }

    // 文件夹 / 多个 md
    const entries = [];
    for (const f of files) {
      const path = f.webkitRelativePath || f.name;
      entries.push({
        path,
        content: /\.md$/i.test(f.name) ? await readText(f) : "",
        isDirectory: false,
      });
    }

    const grouped = groupEntries(entries);
    if (!grouped.items.length) {
      throw new Error("没有找到 SKILL.md，请确认目录结构是否正确");
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    return {
      ...grouped,
      fileName: files.length === 1 ? files[0].name : `${files.length} 个文件`,
      fileSize: totalSize,
      fileKind: files.length === 1 ? "file" : "folder",
    };
  }

  /* ---------------- 导出 ---------------- */
  function buildManifest(skills, options) {
    return JSON.stringify(
      {
        generator: "Skill Hub v0.9",
        exportedAt: new Date().toISOString(),
        count: skills.length,
        options: {
          includeSkillFile: options.includeSkillFile,
          includeAttachments: options.includeAttachments,
          includeManifest: options.includeManifest,
          includeMeta: !!options.includeMeta,
          metaFormat: options.includeMeta ? options.metaFormatId : undefined,
        },
        skills: skills.map((s) => ({
          name: s.name,
          description: s.description,
          version: s.version,
          source: SH.store.sourceName(s.sourceId),
          category: SH.store.categoryName(s.categoryId),
          path: s.path,
          files:
            options.includeAttachments && s.files
              ? s.files.map((f) => f.name)
              : ["SKILL.md"],
        })),
      },
      null,
      2
    );
  }

  async function buildEntries(skills, options) {
    const entries = [];

    for (const skill of skills) {
      const folder = `skills/${skill.name}`;
      if (options.includeSkillFile) {
        entries.push({
          name: `${folder}/SKILL.md`,
          content: skill.content || `---\nname: ${skill.name}\n---\n`,
        });
      }
      if (options.includeAttachments && Array.isArray(skill.files)) {
        skill.files.forEach((f) => {
          if (/^SKILL\.md$/i.test(f.name)) return;
          if (!f.content) return;
          entries.push({ name: `${folder}/${f.name}`, content: f.content });
        });
      }
      if (options.includeMeta) {
        // 沿用包里已有的标记，或按当前选定的 Agent 格式重新生成
        let built;
        if (options.metaReuse && skill.meta && skill.meta.content) {
          built = { fileName: skill.meta.fileName, content: skill.meta.content };
        } else if (options.metaReuse && skill.meta && skill.meta.data) {
          built = {
            fileName: skill.meta.fileName,
            content: `${JSON.stringify(skill.meta.data, null, 2)}\n`,
          };
        } else {
          // eslint-disable-next-line no-await-in-loop
          built = await SH.meta.build(skill, options.metaFormatId, options.metaOptions || {});
        }
        entries.push({ name: `${folder}/${built.fileName}`, content: built.content });
      }
    }

    if (options.includeManifest) {
      entries.push({ name: "manifest.json", content: buildManifest(skills, options) });
    }

    return entries;
  }

  /** 同步估算：用于对话框里的实时摘要，不触发哈希计算 */
  function estimate(skills, options) {
    let files = 0;
    let bytes = 0;
    let attachments = 0;

    skills.forEach((skill) => {
      if (options.includeSkillFile) {
        files += 1;
        bytes += byteLength(skill.content || "");
      }
      if (options.includeAttachments) {
        (skill.files || []).forEach((f) => {
          if (/^SKILL\.md$/i.test(f.name) || !f.content) return;
          files += 1;
          attachments += 1;
          bytes += byteLength(f.content);
        });
      }
      if (options.includeMeta) {
        files += 1;
        bytes += 420;
      }
    });

    if (options.includeManifest) {
      files += 1;
      bytes += 900;
    }

    return { files, attachments, bytes };
  }

  function fileNameFor(format) {
    const stamp = fmtDate(Date.now()).replace(/-/g, "");
    return format === "zip"
      ? `skill-hub-export-${stamp}.zip`
      : `skill-hub-export-${stamp}`;
  }

  async function exportZip(skills, options) {
    const entries = await buildEntries(skills, options);
    const bytes = entries.reduce((sum, e) => sum + byteLength(e.content), 0);
    const blob = SH.zip.create(entries);
    return { blob, filename: fileNameFor("zip"), bytes };
  }

  /** 用 File System Access API 写目录；不支持时抛错由调用方降级 */
  async function exportFolder(skills, options) {
    if (!window.showDirectoryPicker) {
      throw new Error("当前浏览器不支持直接写目录，请改用 ZIP 格式导出");
    }
    const root = await window.showDirectoryPicker({ mode: "readwrite" });
    const base = await root.getDirectoryHandle(fileNameFor("folder"), { create: true });
    const entries = await buildEntries(skills, options);

    for (const entry of entries) {
      const parts = entry.name.split("/");
      const fileName = parts.pop();
      let dir = base;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
      }
      const handle = await dir.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(entry.content);
      await writable.close();
    }

    return { folderName: fileNameFor("folder") };
  }

  SH.io = { parseSelection, exportZip, exportFolder, buildEntries, estimate };
})();
