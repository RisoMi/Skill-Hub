/* ------------------------------------------------------------
   native.js · 桌面端（Tauri）能力适配
   没有 Tauri 时全部返回 null/false，调用方回退到浏览器实现。
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const T = window.__TAURI__;
  const invoke = T && T.core && T.core.invoke ? T.core.invoke : null;
  const isNative = typeof invoke === "function";

  function platform() {
    const ua = navigator.userAgent || "";
    if (/mac/i.test(ua)) return "mac";
    return "win";
  }

  const api = {
    isNative,
    platform: platform(),

    /** 本机候选技能目录（不一定存在） */
    async defaultRoots() {
      if (!isNative) return [];
      try {
        return await invoke("default_roots");
      } catch (err) {
        console.warn("[native] default_roots 失败", err);
        return [];
      }
    },

    /** 扫描若干根目录 */
    async scanRoots(roots) {
      if (!isNative) return null;
      try {
        return await invoke("scan_roots", { roots });
      } catch (err) {
        console.warn("[native] scan_roots 失败", err);
        return null;
      }
    },

    /** 系统目录选择器 */
    async pickDirectory() {
      if (!isNative) return null;
      try {
        return await invoke("pick_directory");
      } catch (err) {
        console.warn("[native] pick_directory 失败", err);
        return null;
      }
    },

    /** 把一份技能写到目标目录（后端会先备份） */
    async writeSkill(root, name, files) {
      if (!isNative) return null;
      return invoke("write_skill", { root, name, files });
    },

    /** 卸载：后端移到回收站目录 */
    async removeSkill(dir) {
      if (!isNative) return null;
      return invoke("remove_skill", { dir });
    },

    /** 无边框窗口控制 */
    async windowAction(action) {
      if (!isNative) return false;
      try {
        await invoke("window_action", { action });
        return true;
      } catch (err) {
        console.warn("[native] window_action 失败", err);
        return false;
      }
    },

    /** 运行环境：是否便携版、数据实际落在哪里 */
    async runtimeInfo() {
      if (!isNative) return null;
      try {
        return await invoke("runtime_info");
      } catch (err) {
        console.warn("[native] runtime_info 失败", err);
        return null;
      }
    },

    /** 删除技能目录下的单个文件（清除元数据标记） */
    async deleteSkillFile(dir, name) {
      if (!isNative) throw new Error("浏览器预览无法操作磁盘");
      return invoke("delete_skill_file", { dir, name });
    },

    /** macOS：把卸载脚本导出到桌面并在 Finder 中定位 */
    async exportUninstaller() {
      if (!isNative) throw new Error("浏览器预览不可用");
      return invoke("export_uninstaller");
    },

    /** 把扫描结果转成前端 skill 结构 */
    toSkill(scanned, sourceId) {
      const metaFile = scanned.metaFile || null;
      const metaData = scanned.meta || null;
      const formatId = metaFile
        ? metaFile === "_user_meta.json"
          ? "workbuddy-user"
          : metaFile === "_meta.json"
          ? "workbuddy-plugin"
          : "workbuddy-market"
        : null;

      return {
        name: scanned.name,
        description: scanned.description || "来自本机的 SKILL",
        categoryId: null, // 交给 store 推断
        sourceId,
        version: "v1.0",
        updatedAt: scanned.updatedAt || Date.now(),
        createdAt: scanned.updatedAt || Date.now(),
        favorite: false,
        exportable: true,
        tags: ["本机"],
        path: scanned.dir,
        nativeDir: scanned.dir,
        content: scanned.content,
        files: (scanned.files || []).map((f) => ({
          name: f.name,
          content: f.content,
          size: f.size,
        })),
        meta:
          metaFile && metaData
            ? {
                formatId,
                fileName: metaFile,
                data: metaData,
                content: `${JSON.stringify(metaData, null, 2)}\n`,
              }
            : null,
      };
    },
  };

  SH.native = api;
})();
