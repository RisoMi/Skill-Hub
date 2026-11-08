/* ------------------------------------------------------------
   utils.js · 基础工具
   ------------------------------------------------------------ */
(function () {
  const SH = (window.SH = window.SH || {});

  const DAY = 86400000;

  const util = {
    DAY,

    uid(prefix = "id") {
      return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
    },

    /** HTML 转义：所有插入模板的用户/文件内容都必须经过这里 */
    esc(value) {
      if (value === null || value === undefined) return "";
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    /** 属性值转义（用于 data-* 等） */
    attr(value) {
      return util.esc(value);
    },

    debounce(fn, wait = 140) {
      let timer = null;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    clamp(n, min, max) {
      return Math.min(max, Math.max(min, n));
    },

    fmtBytes(bytes) {
      if (!bytes && bytes !== 0) return "—";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    },

    /** 兼容别名 */
    formatBytes(bytes) {
      return util.fmtBytes(bytes);
    },

    /** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期 */
    fmtRelative(ts) {
      if (!ts) return "—";
      const diff = Date.now() - ts;
      if (diff < 60 * 1000) return "刚刚";
      if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < DAY) return `${Math.floor(diff / 3600000)} 小时前`;
      if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    },

    fmtDate(ts) {
      const d = new Date(ts || Date.now());
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    },

    fmtDateTime(ts) {
      const d = new Date(ts || Date.now());
      return `${util.fmtDate(ts)} ${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;
    },

    isMac() {
      return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
    },

    isWindows() {
      return /win/i.test(navigator.platform || navigator.userAgent);
    },

    /** 修饰键文案：mac 用 ⌘，其他用 Ctrl */
    modKey() {
      return util.isMac() ? "Cmd" : "Ctrl";
    },

    /** 把 "~" 展开成示意路径（浏览器里无法拿到真实家目录，仅做展示） */
    displayPath(p) {
      if (!p) return "";
      return p.replace(/^~/, util.isMac() ? "~" : "~");
    },

    async copyText(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (err) {
        /* 落到下面的兜底 */
      }
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (err) {
        return false;
      }
    },

    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },

    /** 单行截断，避免卡片标题撑破布局 */
    ellipsis(text, max) {
      const s = String(text || "");
      return s.length > max ? `${s.slice(0, max - 1)}…` : s;
    },

    /** 读取文件为文本 */
    readText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
        reader.readAsText(file, "utf-8");
      });
    },

    readBuffer(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
        reader.readAsArrayBuffer(file);
      });
    },

    /** 字节数估算（UTF-8） */
    byteLength(str) {
      try {
        return new Blob([str]).size;
      } catch (err) {
        return String(str).length;
      }
    },

    wait(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },

    /** 简易防 XSS 的链接渲染：只允许 http/https/mailto */
    safeHref(raw) {
      const url = String(raw || "").trim();
      if (/^(https?:|mailto:)/i.test(url)) return url;
      if (/^(#|\/|\.\/)/.test(url)) return url;
      return "#";
    },
  };

  SH.util = util;
})();
