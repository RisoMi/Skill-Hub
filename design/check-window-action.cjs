/* 回归：窗口按钮 data-win(min/max/close) 必须映射成 Rust 命令认的 minimize/maximize/close */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS · " + name + (extra ? " · " + extra : "")); }
  else { fail++; console.log("FAIL · " + name + (extra ? " · " + extra : "")); }
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const rs = fs.readFileSync(path.join(ROOT, "src-tauri/src/lib.rs"), "utf8");
const nj = fs.readFileSync(path.join(ROOT, "src/core/native.js"), "utf8");

const dataWins = new Set([...html.matchAll(/data-win="([^"]+)"/g)].map((m) => m[1]));
ok("按钮 data-win 值", [...dataWins].sort().join(",") === "close,max,min", [...dataWins].join(","));

const rustArms = [...rs.matchAll(/"(minimize|maximize|close)"\s*=>/g)].map((m) => m[1]);
ok("Rust 匹配 minimize/maximize/close",
  ["minimize", "maximize", "close"].every((x) => rustArms.includes(x)),
  rustArms.join(","));

ok("native.js 有 min/max 映射", /min:\s*"minimize",\s*max:\s*"maximize"/.test(nj));
ok("映射用于 invoke 参数", /invoke\("window_action",\s*\{\s*action:\s*act\s*\}\)/.test(nj));
ok("三路径回退都在",
  nj.includes('plugin:window|minimize') && nj.includes('plugin:window|toggle_maximize') && nj.includes("win.minimize()"));
ok("返回结构带 error", /\{\s*ok:\s*false,\s*error:/.test(nj));

// 模拟：mock 全局 Tauri，逐一验证映射
global.window = global;
let calls = [];
global.SH = { util: { esc: (s) => s } };
global.__TAURI__ = {
  core: {
    invoke: async (cmd, args) => {
      calls.push([cmd, args && args.action]);
      if (cmd === "window_action") return null;
      throw new Error("unexpected");
    },
  },
};
require(path.join(ROOT, "src/core/native.js"));
(async () => {
  for (const btn of ["min", "max", "close"]) {
    calls = [];
    const res = await SH.native.windowAction(btn);
    const expected = { min: "minimize", max: "maximize", close: "close" }[btn];
    ok(btn + " -> " + expected + " 且成功", res.ok === true && calls[0][1] === expected,
      JSON.stringify(calls) + " res=" + JSON.stringify(res));
  }
  console.log("\n结果：" + pass + " PASS / " + fail + " FAIL");
  process.exit(fail ? 1 : 0);
})();
