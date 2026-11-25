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

    /** 在技能目录下创建子文件夹（支持多级相对路径） */
    async createSkillDir(root, skill, dir) {
      if (!isNative) return false;
      try {
        await invoke("create_skill_dir", { root, skill, dir });
        return true;
      } catch (err) {
        console.warn("[native] create_skill_dir 失败", err);
        return false;
      }
    },

    /**
     * 无边框窗口控制。
     * 依次尝试：自写命令 -> 官方 plugin 命令 -> 官方 window API。
     * 返回 { ok, error }，error 是最后一条真实报错，便于界面直接显示原因。
     */
    async windowAction(action) {
      if (!isNative) return { ok: false, error: "非桌面环境" };
      const errors = [];

      // ⚠️ 按钮 data-win 是 min/max/close，Rust 命令匹配 minimize/maximize/close。
      // 历史版本就是这里没映射，自写命令永远返回「未知的窗口操作」。
      const act = { min: "minimize", max: "maximize", close: "close" }[action] || action;

      // 1) 自写命令（Rust 侧直接操作窗口，不需要前端权限）
      try {
        await invoke("window_action", { action: act });
        return { ok: true };
      } catch (err) {
        errors.push("自定义命令：" + (err && err.message || err));
      }

      // 2) 官方 plugin 命令（走 capabilities 权限）
      const cmd = { minimize: "plugin:window|minimize", maximize: "plugin:window|toggle_maximize", close: "plugin:window|close" }[act];
      if (cmd) {
        try {
          await invoke(cmd, { label: "main" });
          return { ok: true };
        } catch (err) {
          errors.push("官方命令 " + cmd + "：" + (err && err.message || err));
        }
      }

      // 3) 官方 window API 对象
      try {
        const W = T && T.window;
        const win = W && (W.getCurrentWindow ? W.getCurrentWindow() : W.currentWindow);
        if (win) {
          if (act === "minimize") await win.minimize();
          else if (act === "maximize") await win.toggleMaximize();
          else if (act === "close") await win.close();
          else return { ok: false, error: "未知操作" };
          return { ok: true };
        }
        errors.push("官方 window 对象不可用");
      } catch (err) {
        errors.push("官方 API：" + (err && err.message || err));
      }

      const detail = errors.join(" | ");
      console.warn("[native] 窗口操作全部失败", detail);
      return { ok: false, error: detail };
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

    /** 读取目录内文件并返回 base64（图片预览用） */
    async readFileBase64(dir, name) {
      if (!isNative) throw new Error("浏览器预览无法读取本地文件");
      return invoke("read_file_base64", { dir, name });
    },

    /** 回收站：列表 / 还原 / 彻底删除 */
    async listTrash() {
      if (!isNative) return [];
      try {
        return await invoke("list_trash");
      } catch (err) {
        console.warn("[native] list_trash 失败", err);
        return [];
      }
    },

    async restoreTrash(id) {
      if (!isNative) throw new Error("浏览器预览无法操作回收站");
      return invoke("restore_trash", { id });
    },

    async purgeTrash(id) {
      if (!isNative) throw new Error("浏览器预览无法操作回收站");
      return invoke("purge_trash", { id });
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
        dirs: Array.isArray(scanned.dirs) ? scanned.dirs.slice() : [],
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
