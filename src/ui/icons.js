/* ------------------------------------------------------------
   icons.js · 内联 SVG 图标（统一 14 网格，随 currentColor 着色）
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;

  const PATHS = {
    code: '<path d="M4.6 3.6L1.4 7l3.2 3.4M9.4 3.6L12.6 7l-3.2 3.4M8.2 2.4L5.8 11.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    doc: '<path d="M3.2 1.8h5l2.6 2.6v7.8H3.2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/><path d="M5.2 6.2h4M5.2 8.4h4M5.2 10.4h2.6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
    data: '<rect x="1.8" y="7.6" width="2.4" height="4.6" rx="0.6" stroke="currentColor" stroke-width="1.1" fill="none"/><rect x="5.8" y="4.6" width="2.4" height="7.6" rx="0.6" stroke="currentColor" stroke-width="1.1" fill="none"/><rect x="9.8" y="2.2" width="2.4" height="10" rx="0.6" stroke="currentColor" stroke-width="1.1" fill="none"/>',
    design: '<rect x="2" y="2" width="10" height="10" rx="2.4" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5.4" cy="5.4" r="1.2" fill="currentColor"/><path d="M2.4 10.4l3-2.6 2.4 2 1.8-1.6 2 1.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    auto: '<path d="M7.6 1.6L3.2 7.8h3.1l-0.9 4.6 4.5-6.3H6.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/>',
    other: '<circle cx="3.4" cy="7" r="1.1" fill="currentColor"/><circle cx="7" cy="7" r="1.1" fill="currentColor"/><circle cx="10.6" cy="7" r="1.1" fill="currentColor"/>',
    more: '<circle cx="3.2" cy="7" r="1.15" fill="currentColor"/><circle cx="7" cy="7" r="1.15" fill="currentColor"/><circle cx="10.8" cy="7" r="1.15" fill="currentColor"/>',
    tag: '<path d="M2 6.6V2.8h3.8l5.4 5.4-3.8 3.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/><circle cx="4.4" cy="4.2" r="0.8" fill="currentColor"/>',
    check: '<path d="M2.6 7.3l2.9 2.9 6-6.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    star: '<path d="M7 1.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 10l-3.2 1.7.6-3.6L1.8 5.6l3.6-.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" fill="none"/>',
    starFill: '<path d="M7 1.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 10l-3.2 1.7.6-3.6L1.8 5.6l3.6-.5z" fill="currentColor"/>',
    copy: '<rect x="4.6" y="4.6" width="7.2" height="7.2" rx="1.4" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M9.4 4.6V3.2a1.4 1.4 0 00-1.4-1.4H3.2a1.4 1.4 0 00-1.4 1.4V9a1.4 1.4 0 001.4 1.4h1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
    exportUp: '<path d="M7 9.2V2.4M4.4 5L7 2.4 9.6 5M2.4 11.6h9.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    importDown: '<path d="M2.4 8.6h9.2v2.4a0.8 0.8 0 01-0.8 0.8H3.2a0.8 0.8 0 01-0.8-0.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/><path d="M7 1.8v5M4.9 4.9L7 7l2.1-2.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    folder: '<path d="M1.8 4.4a1 1 0 011-1h2.6l1.2 1.4h4.6a1 1 0 011 1v6a1 1 0 01-1 1H2.8a1 1 0 01-1-1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/>',
    zip: '<rect x="2.6" y="1.6" width="8.8" height="10.8" rx="1.8" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M5.6 3.6h2M5.6 5.6h2M5.6 7.6h2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><rect x="5.4" y="9" width="2.6" height="2.4" rx="0.5" fill="currentColor"/>',
    close: '<path d="M3.4 3.4l7.2 7.2M10.6 3.4l-7.2 7.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    chevron: '<path d="M3.6 5.4L7 8.8l3.4-3.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    search: '<circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M9.2 9.2L12.5 12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    plus: '<path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    pencil: '<path d="M9.4 2.2l2.4 2.4-6.9 6.9H2.5V9.1l6.9-6.9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M8.2 3.4l2.4 2.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    eye: '<path d="M1.6 7S3.6 3.4 7 3.4 12.4 7 12.4 7 10.4 10.6 7 10.6 1.6 7 1.6 7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/><circle cx="7" cy="7" r="1.6" stroke="currentColor" stroke-width="1.2" fill="none"/>',
    save: '<path d="M2.6 2.6h6.3l2.5 2.5v6.3H2.6V2.6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/><path d="M4.8 2.6v3.2h4.1V2.6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M4.6 11.4V8.3h4.8v3.1" stroke="currentColor" stroke-width="1.2" fill="none"/>',
    gear: '<circle cx="7" cy="7" r="2.2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M7 1.5v1.4M7 11.1v1.4M1.5 7h1.4M11.1 7h1.4M3.1 3.1l1 1M9.9 9.9l1 1M10.9 3.1l-1 1M4.1 9.9l-1 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    file: '<path d="M3.4 1.8h4.8l2.4 2.4v7.8H3.4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/>',
    info: '<circle cx="7" cy="7" r="5.6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M7 6.2v4M7 3.8v0.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    warn: '<path d="M7 2.2l5.2 9.2H1.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/><path d="M7 5.6v2.6M7 9.8v0.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    trash: '<path d="M2.6 4.2h8.8M5.4 4.2V2.8h3.2v1.4M4 4.2l0.5 7.2h5l0.5-7.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    refresh: '<path d="M12 7a5 5 0 11-1.6-3.7M12 1.8v2.6H9.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    grid: '<rect x="2" y="2" width="4" height="4" rx="1" fill="currentColor"/><rect x="8" y="2" width="4" height="4" rx="1" fill="currentColor"/><rect x="2" y="8" width="4" height="4" rx="1" fill="currentColor"/><rect x="8" y="8" width="4" height="4" rx="1" fill="currentColor"/>',
    list: '<path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    sun: '<circle cx="7" cy="7" r="2.8" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M7 1.4v1.2M7 11.4v1.2M1.4 7h1.2M11.4 7h1.2M3 3l0.9 0.9M10.1 10.1l0.9 0.9M11 3l-0.9 0.9M3.9 10.1L3 11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    moon: '<path d="M11.6 8.6A5 5 0 015.4 2.4a5 5 0 108.2 6.2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/>',
  };

  const CATEGORY_ICON = {
    code: "code",
    doc: "doc",
    data: "data",
    design: "design",
    auto: "auto",
    other: "other",
  };

  function svg(name, size = 14, extraClass = "") {
    const body = PATHS[name] || PATHS.other;
    return `<svg class="${extraClass}" width="${size}" height="${size}" viewBox="0 0 14 14" fill="none" aria-hidden="true">${body}</svg>`;
  }

  function category(id, size = 18) {
    return svg(CATEGORY_ICON[id] || "other", size);
  }

  SH.icons = { svg, category, has: (n) => !!PATHS[n] };
})();
