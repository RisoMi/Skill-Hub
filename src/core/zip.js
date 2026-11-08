/* ------------------------------------------------------------
   zip.js · 零依赖 ZIP 读写
   写：store（不压缩），保证任何解压工具都能打开
   读：支持 store 与 deflate（借助浏览器原生 DecompressionStream）
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");

  /* ---------------- CRC32 ---------------- */
  let crcTable = null;

  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    if (!crcTable) crcTable = makeCrcTable();
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /* ---------------- DOS 时间 ---------------- */
  function dosDateTime(date = new Date()) {
    const time =
      (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const d =
      ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time: time & 0xffff, date: d & 0xffff };
  }

  /* ---------------- 写入 ---------------- */
  function create(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const stamp = dosDateTime(new Date());

    entries.forEach((entry) => {
      const nameBytes = encoder.encode(entry.name.replace(/\\/g, "/"));
      const data =
        entry.data instanceof Uint8Array ? entry.data : encoder.encode(String(entry.content || ""));
      const crc = crc32(data);

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8 文件名
      lv.setUint16(8, 0, true); // store
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      chunks.push(local, data);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + data.length;
    });

    const centralSize = central.reduce((sum, c) => sum + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...chunks, ...central, eocd], { type: "application/zip" });
  }

  /* ---------------- 读取 ---------------- */
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("当前浏览器不支持 deflate 解压，请升级到较新版本的 Chrome / Edge / Safari");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function read(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    // 从尾部向前找 EOCD
    let eocdOffset = -1;
    const minPos = Math.max(0, bytes.length - 22 - 0xffff);
    for (let i = bytes.length - 22; i >= minPos; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) throw new Error("不是有效的 ZIP 文件：找不到目录结尾标记");

    const total = view.getUint16(eocdOffset + 10, true);
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    if (total === 0xffff || cdOffset === 0xffffffff) {
      throw new Error("暂不支持 ZIP64 格式，请用普通 zip 重新打包");
    }
    if (cdOffset + cdSize > bytes.length) throw new Error("ZIP 文件已损坏：目录区越界");

    const out = [];
    let p = cdOffset;

    for (let i = 0; i < total; i += 1) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const uncompSize = view.getUint32(p + 24, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const localOffset = view.getUint32(p + 42, true);
      const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));

      // 定位 local header 之后的数据起点
      if (view.getUint32(localOffset, true) === 0x04034b50) {
        const lNameLen = view.getUint16(localOffset + 26, true);
        const lExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + lNameLen + lExtraLen;
        const raw = bytes.subarray(dataStart, dataStart + compSize);
        let data;
        if (method === 0) {
          data = raw;
        } else if (method === 8) {
          data = await inflateRaw(raw);
        } else {
          data = new Uint8Array(0); // 不支持的压缩方式
        }
        out.push({
          name: name.replace(/\\/g, "/"),
          size: uncompSize,
          data,
          isDirectory: /\/$/.test(name),
        });
      }

      p += 46 + nameLen + extraLen + commentLen;
    }

    return out;
  }

  function textOf(entry) {
    return decoder.decode(entry.data);
  }

  SH.zip = { create, read, textOf, crc32 };
})();
