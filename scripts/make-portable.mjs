/**
 * Windows 便携包打包（macOS 不走这个脚本）
 *
 * 分发策略是两套完全不同的形态：
 *   Windows —— 纯便携：没有安装程序，exe 放哪都能跑，数据写在 exe 旁边的 data。
 *   macOS   —— 标准 .app / .dmg：数据按 Apple 规范放 ~/Library，
 *              卸载由 packaging/macos/uninstall.sh 负责完整清理。
 *
 * 产物：
 *   src-tauri/target/release/portable/
 *     Skill Hub Portable/                  解压即用
 *       ├─ Skill Hub.exe
 *       ├─ data/backups | trash | webview
 *       └─ 便携版说明.txt
 *     Skill-Hub-Portable-<ver>-windows.zip
 *
 * 用法：node scripts/make-portable.mjs（或 npm run build）
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

// macOS 用 .dmg 分发，没有"便携"这个概念
if (process.platform !== "win32") {
  console.log("当前平台不是 Windows：macOS 请用 `npm run build:mac`（产出 .app / .dmg），无需便携包。");
  process.exit(0);
}

const relDir = join(root, "src-tauri", "target", "release");
const exePath = join(relDir, "skill-hub.exe");

if (!existsSync(exePath)) {
  console.error(`找不到可执行文件：${exePath}`);
  console.error("请先运行：npm run build");
  process.exit(1);
}

const outRoot = join(relDir, "portable");
const appDir = join(outRoot, "Skill Hub Portable");
const zipPath = join(outRoot, `Skill-Hub-Portable-${version}-windows.zip`);

// 每次重建，避免上一轮的测试数据被误打进 zip
rmSync(appDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });

copyFileSync(exePath, join(appDir, "Skill Hub.exe"));

// 预置 data 结构：程序启动时也会自动建，这里是为了解压即见
for (const sub of ["data", "data/backups", "data/trash", "data/webview"]) {
  mkdirSync(join(appDir, sub), { recursive: true });
}

const readme = `Skill Hub 便携版 ${version}（Windows）
========================================

直接双击「Skill Hub.exe」运行，无需安装。这是 Windows 唯一的官方分发形态，
本项目不提供安装程序（没有 setup.exe / msi），也不写注册表和系统 AppData。

【放在哪】
任意目录都可以：桌面、D 盘、U 盘、网络盘（需可写）。
路径含中文或空格也没问题（程序内部按绝对路径处理）。

【数据存在哪】
程序启动时会在自己旁边建 data 目录，所有状态都写在里面：

  data\\backups\\   同步覆盖前的自动备份
  data\\trash\\     卸载的 SKILL（误删可以从这里捞回）
  data\\webview\\   WebView2 配置 + 本地索引（分类、来源、偏好、主题）

整个文件夹拷到别的机器，配置和分类一起带走。
想恢复初始状态：退出程序，删掉 data 目录即可（下次启动会重建）。

【卸载】
关闭程序，直接删除整个文件夹。没有残留、不需要卸载程序、不碰注册表。

【运行依赖】
Windows 10/11 自带 WebView2 运行时，一般可直接运行。
如果提示缺少 WebView2，装一次微软的 Evergreen Runtime（免费）：
https://developer.microsoft.com/microsoft-edge/webview2/

【注意】
- 程序会以只读方式扫描本机的 ~/.claude/skills 等目录来列出你的真实
  SKILL；只有在你主动点「同步」或「卸载」时才写文件。
- 覆盖或卸载前都会先备份到 data\\backups 或 data\\trash，可回滚。
- 如果程序被放在只读介质（光盘、写保护 U 盘），启动时会提示无法创建数据目录。
`;

writeFileSync(join(appDir, "便携版说明.txt"), readme, "utf8");

// 打 zip：压缩整个目录（不是 dir\*），解压后得到一层 "Skill Hub Portable"
rmSync(zipPath, { force: true });
const r = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Compress-Archive -Path '${appDir}' -DestinationPath '${zipPath}' -Force`,
  ],
  { stdio: "inherit" }
);

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(1);
console.log("\n便携版目录：", appDir);
console.log("目录内容：", readdirSync(appDir).join("  "));
console.log(
  r.status === 0 ? `便携版 zip：${zipPath}（${mb(zipPath)} MB）` : "打包 zip 失败（目录仍然可用）"
);
