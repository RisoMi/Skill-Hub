/* ------------------------------------------------------------
   palettes.js · 配色方案元数据
   ------------------------------------------------------------
   这里是「有哪些配色、叫什么、缩略预览用什么颜色」的唯一清单；
   真正生效的 CSS 变量在 assets/styles/palettes.css（由设计稿生成）。

   两处色值有意保持同源：design/theme-proposal-v2.html 的 T 表。
   新增一套配色 = 这里加一条 + 设计稿 T 表加一组 + 重新生成 CSS。
   ------------------------------------------------------------ */
(function () {
  const SH = (window.SH = window.SH || {});

  const DEFAULT = "classic";

  const list = [
    {
      key: "classic",
      name: "经典青绿",
      badge: "原配色",
      desc: "暖米色底 + 低饱和青绿，保留 0.9.16 的观感，只升级按钮与操作项。",
      light: { bg: "#f8f6f2", surface: "#ffffff", accent: "#3e7a72", primary: "#3e7a72", text: "#1a1a1a", signal: "#3e7a72" },
      dark: { bg: "#1e211f", surface: "#242826", accent: "#7fbeb4", primary: "#7fbeb4", text: "#edebe6", signal: "#7fbeb4" },
    },
    {
      key: "indigo",
      name: "靛蓝",
      badge: "提案 A",
      desc: "冷灰蓝中性底 + 靛蓝强调色，现代 SaaS 感，主次对比最明确。",
      light: { bg: "#f4f6fb", surface: "#ffffff", accent: "#4f46e5", primary: "#4f46e5", text: "#101827", signal: "#4f46e5" },
      dark: { bg: "#0e131e", surface: "#171f2e", accent: "#818cf8", primary: "#818cf8", text: "#eef2fa", signal: "#818cf8" },
    },
    {
      key: "teal",
      name: "青绿提纯",
      badge: "提案 B",
      desc: "延续品牌青绿色相，但提高纯度与明度反差，深浅两套都更清爽。",
      light: { bg: "#f4f7f9", surface: "#ffffff", accent: "#0f766e", primary: "#0f766e", text: "#0f1d22", signal: "#0f766e" },
      dark: { bg: "#0d1519", surface: "#162228", accent: "#2dd4bf", primary: "#2dd4bf", text: "#eaf4f4", signal: "#2dd4bf" },
    },
    {
      key: "graphite",
      name: "石墨极简",
      badge: "提案 C",
      desc: "近黑 / 纯白做主操作，琥珀只留给选中态与焦点，最克制。",
      light: { bg: "#fafaf9", surface: "#ffffff", accent: "#18181b", primary: "#18181b", text: "#16171a", signal: "#e0863c" },
      dark: { bg: "#0c0c0e", surface: "#151517", accent: "#ffffff", primary: "#ffffff", text: "#f5f5f4", signal: "#f0a055" },
    },
    {
      key: "aurora",
      name: "柔雾紫",
      badge: "提案 D",
      desc: "紫→蓝渐变主按钮、更大的圆角与柔光投影，最柔和的一套。",
      light: {
        bg: "#f7f7fc", surface: "#ffffff", accent: "#6d5ae6",
        primary: "linear-gradient(135deg,#6d5ae6 0%,#a06cf0 100%)",
        text: "#1b1a2e", signal: "#8b5cf6",
      },
      dark: {
        bg: "#12121e", surface: "#1b1b2b", accent: "#a78bfa",
        primary: "linear-gradient(135deg,#8b5cf6 0%,#6366f1 100%)",
        text: "#f2f1ff", signal: "#a78bfa",
      },
    },
  ];

  const keys = list.map((p) => p.key);

  /** 脏数据（旧版本存档、手改 localStorage）一律退回默认配色 */
  function normalize(value) {
    return keys.indexOf(value) >= 0 ? value : DEFAULT;
  }

  function get(value) {
    const key = normalize(value);
    return list.find((p) => p.key === key);
  }

  SH.palettes = { list, keys, default: DEFAULT, normalize, get };
})();
