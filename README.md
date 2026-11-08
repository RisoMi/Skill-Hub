# Skill Hub

跨平台 SKILL 统一管理器的可运行实现，按设计稿 1:1 还原界面与交互：多来源聚合成一个列表，按分类浏览，右侧直接读 SKILL.md 原文，支持勾选打包导出，以及「导入并选择目标 Agent」的两步向导。

零依赖、无构建步骤，纯静态资源。

---

## 快速运行

**A. 桌面应用（推荐）**

- **Windows**：只要便携版，解压 `src-tauri/target/release/portable/Skill Hub Portable/` 直接运行，**没有安装程序**。
- **macOS**：标准 `.dmg`，拖进 `/Applications`；卸载请用附带的卸载脚本（见「macOS：卸载与完整清理」）。

自己构建：

```bash
npm install
npm run build      # Windows：出便携目录 + zip
npm run build:mac  # macOS：出 .app + .dmg（需在 Mac 上执行）
npm run dev        # 开发模式（自动起本地服务再开窗口）
```

桌面版会真实扫描本机技能目录、同步写盘、卸载到回收站，详见下一节。

**B. 浏览器开发预览**

```bash
node scripts/dev-server.mjs     # http://127.0.0.1:8765
# 或：python serve.py
```

两者都会发 `no-store`，改完刷新即生效。若用 `python -m http.server 8765`，浏览器可能缓存旧 JS，
遇到怪问题按 `Ctrl + Shift + R` 硬刷新。

**C. 直接双击 index.html**

界面和大部分交互可用，但目录读取、File System Access 受限，导入请用 `.zip` 或 `.md` 文件。

浏览器推荐 Chrome / Edge 111+（需要 `color-mix`、`DecompressionStream`、File System Access）。

---

## 桌面应用（Windows / macOS）

### 为什么用 Tauri

不内置 Chromium，直接用系统 WebView（Windows 走 WebView2，macOS 走 WKWebView）。安装包 5–10MB 级、冷启动快、常驻内存低——和这个产品"轻量、天天要开"的定位一致。Electron 会带进来一整个浏览器，这里不划算。

### 打包与卸载

两个平台走**完全不同的分发策略**，这是刻意设计，不是遗留差异：

| | Windows | macOS |
|---|---|---|
| 形态 | **只有便携版**，无安装程序 | 标准 `.app` / `.dmg` |
| 安装 | 解压即用，放任意目录 | 拖进 `/Applications` |
| 数据位置 | `<exe 目录>\data\`（随程序走） | `~/Library/**`（遵循 Apple 规范） |
| 卸载 | 删除整个文件夹 | 用 `uninstall.sh` 完整清理 5 类目录 |
| 残留 | 无 | 必须靠脚本清干净 |

#### Windows：构建与打包

```bash
npm install
npm run build
```

产物（实测体积）：

```
src-tauri/target/release/portable/
  Skill Hub Portable/                      3.4 MB   解压即用的整个目录
  Skill-Hub-Portable-0.9.0-windows.zip     1.5 MB   分发用
```

不出 `setup.exe` / `.msi`：`bundle.targets` 已置空。**没有安装程序**，
不写注册表、不写 AppData、不建快捷方式、不留服务。

**数据就跟程序走**：

| 项 | 路径 |
|---|---|
| 应用目录 | `<exe 所在目录>` |
| 数据根 | `<exe 所在目录>\data\` |
| 备份 | `data\backups\` |
| 回收站 | `data\trash\` |
| 界面数据 | `data\webview\`（WebView2 profile + localStorage） |

`data\` 不存在时程序启动会自动创建。**放任意目录都能跑**——桌面、D 盘、U 盘、
路径含中文或空格都可以。

**卸载 = 删除文件夹**：关闭程序，删掉整个目录即可，不残留任何东西。
只想重置状态但保留程序：只删 `data\` 子目录。

⚠️ 只读介质（光盘、写保护 U 盘）会启动失败并提示"无法创建数据目录"，
不会静默退回 AppData。

运行时内存约 30 MB（WebView2 进程另计），冷启动 1 秒内可见界面。
需要 Rust（1.77+）、VS Build Tools（C++ 桌面工作负载）和 WebView2（Win10/11 通常已自带）。
开发调试：`npm run dev`。

#### macOS：构建与打包

**Windows 上无法产出 macOS 包**，这是硬限制，不是配置问题：需要 macOS SDK、
hdiutil（打 dmg）、以及签名公证工具链，Apple 不授权在非 Mac 系统上分发这些组件。
两条可行路径：

1. **在 Mac 上构建**：
   ```bash
   npm install
   npm run build:mac     # → Skill Hub.app + .dmg
   ```
2. **走 CI 出 universal 包**：`.github/workflows/desktop-build.yml`，
   push 一个 `v*` tag 或手动触发。macOS job 产出 universal（Intel + Apple Silicon）
   的 `.dmg`，挂在 Actions 的 artifact 里。

**macOS 不做便携版**：数据按 Apple 的目录规范落在用户 `Library` 下，
不放在 `.app` 旁边（那样会破坏代码签名，也不符合 macOS 习惯）。

#### macOS：卸载与完整清理

把 `.app` 拖进废纸篓**只删了程序本体**——配置、缓存、日志、WebView 数据仍然留在
`~/Library` 下，加起来通常十几到几十 MB。所以有专门的卸载脚本。

**拿到脚本**：设置 →「关于」→「卸载」→「导出卸载脚本到桌面」，
桌面会生成 `卸载 Skill Hub.command`，双击即可。脚本是编译进二进制的
（`include_str!`），任何安装方式下都是同一份，不依赖 `.app` 里带没带资源。

也可以用仓库里的 `packaging/macos/uninstall.sh`。

**清理范围**（与 Rust 侧 `runtime_info` 的 `managed` 清单一一对应）：

| 类别 | 路径 |
|---|---|
| 应用本体 | `/Applications/Skill Hub.app`（支持自定义位置，靠 `--app-path` 或 Spotlight 定位） |
| 用户数据 / 备份 / 回收站 | `~/Library/Application Support/com.skillhub.desktop` |
| 缓存 | `~/Library/Caches/com.skillhub.desktop` |
| 日志 | `~/Library/Logs/com.skillhub.desktop` |
| 偏好设置 | `~/Library/Preferences/com.skillhub.desktop.plist` |
| WebView 数据 | `~/Library/WebKit/com.skillhub.desktop`（localStorage 就在这） |
| HTTP 存储 | `~/Library/HTTPStorages/com.skillhub.desktop` |
| 窗口状态 | `~/Library/Saved Application State/com.skillhub.desktop.savedState` |
| 登录项（若有） | `~/Library/LaunchAgents/com.skillhub.desktop.plist` |
| 沙箱容器（若有） | `~/Library/Containers/com.skillhub.desktop` |

**脚本行为**：

- 先列出所有命中项与体积，确认后才删（`--yes` 跳过确认）
- 删除前自动退出正在运行的应用
- 删除后**立即复扫一遍**，逐条报告是否还有残留
- 安全护栏：`/`、`$HOME`、`/System`、`/usr`、`/Library`、`/private` 等一律拒绝；
  `.app` 允许任意位置（U 盘也行），其余目录只允许在 `~/Library` 下

**验证方式**（三种，按需选）：

```bash
# 1. 只检查残留，不删任何东西（退出码 1 = 有残留）
bash packaging/macos/uninstall.sh --verify-only

# 2. 看会删什么，不动文件
bash packaging/macos/uninstall.sh --dry-run

# 3. 自检安全护栏（17 项断言，不碰任何文件）
bash packaging/macos/uninstall.sh --self-test
```

卸载成功时的输出是 `✅ 清理完成，未发现残留。`，退出码 0。若有残留，
脚本会列出具体路径与常见原因（应用在运行 / 权限不足 / 装在只读卷）。

未签名的 mac 包首次打开会被 Gatekeeper 拦，右键 →「打开」即可；正式分发需要
Apple Developer 证书 + 公证（`notarytool`）。

### 桌面版比浏览器版多什么

| 能力 | 浏览器版 | 桌面版 |
|---|---|---|
| 扫描真实技能目录 | ✗ 只能看演示数据 | ✓ 启动自动扫描 `~/.claude/skills` 等 |
| 添加任意目录 | 需要一次授权，拿不到绝对路径 | ✓ 系统选择器，绝对路径 |
| 同步 / 卸载 | 只改本地索引 | ✓ **真实写盘**：覆盖前备份、卸载进回收站 |
| 窗口控制 | 提示"不支持" | ✓ 原生最小化 / 最大化 / 关闭 |
| 读取 `*_meta.json` | 仅限导入的 zip 包 | ✓ 直接读目录里的标记文件 |

### 后端命令

| 命令 | 作用 |
|---|---|
| `default_roots` | 返回本机候选目录（`.claude/skills`、`.codex/skills`、`.workbuddy/skills`…） |
| `scan_roots` | 递归找 `SKILL.md`，解析 frontmatter 与 `*_meta.json`（含尾随逗号容错） |
| `pick_directory` | 系统目录选择器 |
| `write_skill` | 写一份技能到目标目录，**旧版本先备份** |
| `remove_skill` | 卸载：移到回收站目录，不直接删 |
| `window_action` | 无边框窗口的最小化 / 最大化 / 关闭 |

### 数据放在哪

两端策略不同（详见上面的「打包与卸载」）：

| | Windows（便携） | macOS（标准） |
|---|---|---|
| 索引 / 界面数据 | `<exe>\data\webview\` | `~/Library/WebKit/com.skillhub.desktop` |
| 备份 | `<exe>\data\backups\<时间戳>-<技能名>\` | `~/Library/Application Support/com.skillhub.desktop/backups/` |
| 回收站 | `<exe>\data\trash\<时间戳>\<技能名>\` | `~/Library/Application Support/com.skillhub.desktop/trash/` |

设置面板 →「关于」会直接列出当前实际路径与各项是否已创建。

崩溃或误操作后，可以从备份 / 回收站目录手动取回文件。
Windows 整个文件夹拷走即可迁移；macOS 迁移请连同上面两个 `Library` 目录一起拷。

### 桌面端限制

- 无边框窗口暂不支持**拖拽边缘缩放**（可用最大化按钮），要做得用 `startResizeDragging` 补 8 个热区。
- macOS 包未签名、未公证，只适合自用或内部分发。
- 同步写盘是异步的，失败会弹 toast；目前不做事务回滚（单目标写入要么整条成功、要么报错）。
- 演示数据来自内置种子，没有 `nativeDir`，在桌面端对它们做同步会提示写入失败——这是预期行为。

---

## 实现范围（对照设计稿）

| 设计稿画面 | 实现 |
|---|---|
| 01 主界面 · Windows | 三栏布局、来源/分类双轴导航、分组卡片、详情预览、批量条、状态栏 |
| 02 主界面 · macOS | 同一套内容，标题栏切交通灯、快捷键切 `Cmd`，可在设置里手动切换预览 |
| 03 导出打包 | ZIP / 文件夹两种格式、三项包含内容、保存位置、实时体积摘要 |
| 04 添加 SKILL 目录 | 目录授权读取、递归扫描 SKILL.md、来源列表增删 |
| 05 设计规范 | 视觉 token 落到 `tokens.css`，含浅 / 深双主题 |
| 06 导入 · 选择目标 Agent | 包解析摘要 + 6 个来源单选列表（路径 / 可写状态 / 已有数量） |
| 07 导入确认 | 目标回显与更改、待导入清单、同名冲突标记、跳过 / 覆盖备份 / 重命名 |
| 分类管理 | 侧栏「＋ 新建」；分类行悬停「⋯」可改名、换色、删除（删除时技能迁到「其他」） |
| 来源管理 | 任意来源可改名、换色；自定义来源可改路径、可移除；新增来源必填显示名称 |
| 来源标记 | 详情里可查看 / **编辑** / 添加 / 删除 `_*_meta.json`；导出时按所选 Agent 的格式生成，带 JSON 预览 |
| 安装状态 | 卡片上 6 格 Agent 点阵（实心=已安装 / 空心=未装 / 虚线=只读），详情「安装」页可逐个 Agent 同步或卸载 |
| 名称展示 | 卡片 / 列表 / 详情标题都用元数据里的 `name`（可中文）；调用名退为副标题，两者都可见 |

补充实现的交互：

- 搜索（`Ctrl/Cmd + K` 聚焦，`Esc` 清空）、四种筛选、四种排序、网格 / 列表切换
- 卡片勾选、批量条、全选与清空、单技能导出
- 详情三个 Tab：Markdown 渲染（含 frontmatter 高亮）、关联文件浏览、元信息表
- 收藏、复制路径、`↑ ↓` 键盘移动、`Ctrl/Cmd + R` 重新扫描
- 空状态（无数据 / 无结果）、扫描进度、错误提示、Toast 反馈
- 浅色 / 深色 / 跟随系统；窄窗口下详情转为可滑出浮层

---

## 本地索引与存储配额

**为什么以前老提示"本地存储空间不足"**

索引原先整份写进 `localStorage`（每域配额约 5MB，按 UTF-16 计）。而 SKILL 正文的量级远超这个数：
实测仅 `SKILL.md` 合计就有 **24.9MB**，再加上附件正文、以及同一技能在多个 Agent 目录下的重复副本，
序列化后轻松几十 MB。`setItem` 每次都抛 `QuotaExceededError`，于是每次改动都弹一次提示。

**判断依据**：`setItem` 抛异常即视为超限，不引入自定义阈值。

**现在**：持久化时剥离正文，只留渲染列表需要的索引。

| 字段 | 入库 | 说明 |
|---|---|---|
| `id` / `name` / `description` | ✅ | 列表与搜索 |
| `categoryId` / `sourceId` / `tags` | ✅ | 分组与筛选 |
| `version` / `updatedAt` / `favorite` / `path` | ✅ | 卡片展示 |
| `files[].name` / `files[].size` | ✅ | 文件清单 |
| `skill.content` | ❌ | 启动扫描从磁盘重新读 |
| `files[].content` | ❌ | 同上 |
| `meta.data` | ✅ | 标记信息很小 |
| `meta.content` | ❌ | 原文可由 data 重建 |

实测 120 技能 × 200KB 正文：全量 **70.38MB → 0.06MB**（1126 倍）。
另有两级兜底：索引本身也放不下时退到最小结构（只保名称与归属），
再不行就提示"重启后会自动重新扫描"，不会反复刷错误。

## 标记与隐藏

侧栏从原来的「来源 + 分类」两段竖排改成了 **tab 切换**：来源 / 分类 / 标记 / 隐藏。
四栏内容叠着放会太长，尤其标记多了以后。

### 标记（自定义名称 + 颜色）

卡片右上角**旗标按钮** → 选已有标记或直接新建。

- 每个标记有名称和颜色（**16 种预设** + 自定义取色器）
- 切换颜色只更新色块选中态，不会重绘弹窗——避免已输入的名称被清空、焦点丢失
- 一个 SKILL 只挂**一个**标记，避免多种颜色在卡片上打架
- 打了标记的卡片：**左边缘出现对应颜色竖条** + 底部同色标签 + 旗标本身变色
- 同名 SKILL 的多个安装点共享同一标记（写入所有副本）

侧栏「标记」tab 可按标记筛选，也能编辑 / 删除。删除标记只解除关联、不删技能，
提示里会给出受影响的技能数。

**标记是纯本地概念**：只影响卡片展示与侧栏归类，不写进技能目录，也不会同步给 Agent。

### 隐藏

卡片上的**眼睛按钮** → 立即隐藏，用于收掉 Agent 自带、平时不用的 SKILL。

- 隐藏后默认不出现在任何列表，也不计入侧栏计数
- 侧栏「隐藏」tab 列出全部被隐藏项，逐个「恢复」
- 只改本地索引，**不动磁盘文件**

### 数据存储

都在本地索引里（`localStorage` 的 `skillhub.data.v1`）：

| 字段 | 形式 | 默认值 |
|---|---|---|
| `state.marks[]` | `{ id, name, color }` | `[]`（空，侧栏显示引导文案） |
| `skill.markId` | 标记 id 或 `null` | `null` |
| `skill.hidden` | 布尔 | `false`（全部可见） |

两个技能字段体积极小，索引轻量化时保留，不剥掉。

## 新建 SKILL

侧栏「来源」tab 顶部「＋ 新建 SKILL」→ 选择创建到哪个可写目录 → 填名称
（小写字母/数字/短横线，作为目录名）与描述 → 创建。

「＋ 添加 SKILL 目录」就在它下面，与「分类」tab 的「＋ 新建分类」是同一套交互
（同款小字按钮、同样弹窗选目录），不再是底部独立的整块按钮。

会生成：

```
<目录>/<name>/
└─ SKILL.md          # 带 name/description frontmatter 的骨架
```

写入后自动重扫，新技能立刻出现在列表里，可直接进编辑器补内容。

- 只列**可写**目录（只读来源不在选项里）
- 名字重复会被拒
- 浏览器预览没有写盘权限，会提示改用桌面版

## 编辑 SKILL 内容

**编辑在独立页面完成，不在侧边栏里改。** 卡片右上角的铅笔按钮（或详情面板里的
「在编辑器中打开」）会打开一层覆盖全窗口的编辑页——侧边栏宽度不够，塞不下像样的编辑器。

```
┌──────────────────────────────────────────────────────┐
│ ← 技能名 / 来源                        [预览] [保存]  │
├───────────────┬──────────────────────────────────────┤
│ 文件 3     ＋ │                                      │
│  SKILL.md     │   name: gzh-article                  │
│  refs/a.md •  │   description: …                     │
│  tpl/x.txt    │   ## 使用步骤                         │
│               │   …                                  │
├───────────────┴──────────────────────────────────────┤
│ Ctrl/Cmd+S 保存 · Esc 关闭      SKILL.md · 744 字节  │
└──────────────────────────────────────────────────────┘
```

- **左栏**：技能目录下的完整文件清单，点任意一项切换；有未保存改动的文件带小圆点
- **主区**：直接编辑正文；`.md` 文件可切「预览」看渲染结果
- **新建**：左栏「＋」输入相对路径（如 `references/notes.md`），回车即建并进入编辑
- **快捷键**：`Ctrl/Cmd + S` 保存，`Esc` 关闭（有未保存内容会二次确认）

保存调用后端写回技能目录，**覆盖前整目录备份**到 `data/backups/<时间戳>-<技能名>/`。
改 `SKILL.md` 会同步更新技能正文（预览、导出、元数据哈希都读它）。
文件名会校验：拒绝绝对路径与 `..` 越界。

侧边栏的「文件」页保留为只读预览，作为快速查看的入口，不再提供行内编辑。

浏览器预览没有写盘权限：编辑只改内存，会明确提示"未写入磁盘，请用桌面版"。

**元数据表单**：详情 →「元信息」→ 来源标记 →「编辑 / 添加标记」，
按所选 Agent 格式渲染字段，保存即写回 `_*_meta.json`；清除时连文件一起删
（否则重启扫描又读回来）。

## 导出目录结构

两种模式结构不同，对话框里有明确提示：

```
单个导出                        批量导出
导出.zip                        导出.zip
└─ gzh-article/                └─ skills/
   ├─ SKILL.md                    ├─ gzh-article/
   ├─ references/…                │  ├─ SKILL.md
   └─ _skillhub_meta.json         │  └─ …
                                  └─ docx-report/
                                     └─ …
```

按本次导出的**技能数量**判定：1 个走单文件结构，多个统一收进 `skills/`。

**元数据复用**：技能目录已带标记文件时，导出**原样复制那份**，不重新生成、不覆盖。
只有取消勾选「优先沿用技能自带的标记」，才按选定格式重写。
文件夹模式下，目标位置若已存在同名标记文件也会跳过。

## 来源标记文件（_*_meta.json）

WorkBuddy 从技能市场装技能时，会在技能目录里留一份来源标记。实现里按**本机真实文件**做了三种格式，并额外提供通用格式给没有官方标记的 Agent。

| 格式 | 文件名 | 适配 Agent | 字段 |
|---|---|---|---|
| 技能市场安装 | `_skillhub_meta.json` | WorkBuddy | `name` `installedAt` `source` `version` `userModified` `skillId` `description_zh` `description_en` `examples_zh` `examples_en` `installedContentHash` |
| 用户导入 | `_user_meta.json` | WorkBuddy | `name` `installedAt` `source:"userImport"` |
| 插件清单 | `_meta.json` | WorkBuddy | `ownerId` `slug` `version` `publishedAt` |
| 通用来源标记 | `_skillhub_meta.json` | Claude Code / Codex / Trae / 豆包工作 / 自定义 | `name` `installedAt` `source` `version` `skillId` `description_zh/en` `examples_zh/en` `installedContentHash` `generator` |

使用方式：导出对话框 →「生成来源标记文件」→ 选「按哪个 Agent 的格式」→ 可预览 JSON → 随包写入 `skills/<name>/` 下。

**两个名字的区别**（编辑时同屏对照）：

- `SKILL.md` 的 `name` 是**调用名**——WorkBuddy 调用这个技能时按它匹配，编辑界面里以虚线框只读展示，并标注"调用时匹配 · 不可改"。
- 元数据的 `name` 是**应用内显示名**——WorkBuddy 的技能列表显示的是它，可以写中文。
- 两者不同是正常用法（英文调用名 + 中文显示名）。编辑弹窗顶部固定展示这两行，下方提示会随输入实时切换"一致 / 不同"的说明。
- 「同步」按钮可一键把元数据名称对齐到 SKILL.md 名称。
- 保存只写元数据文件，**SKILL.md 内容与技能的索引名都不会被改动**，所以调用匹配不会被破坏。

**展示规则**（和 WorkBuddy 应用内的观感一致）：

| 位置 | 显示 |
|---|---|
| 卡片标题 / 详情标题 | 元数据 `name`（有中文就用中文），没有元数据时退回调用名 |
| 卡片副标题 | 两者不同时 `调用名 · 来源`；相同时仍是 `来源 · SKILL.md` |
| 列表视图 | 中文名 + 后面跟一枚灰色小字调用名 |
| 搜索 | 中文显示名、英文调用名、描述、来源、标签都能命中 |
| 排序「名称 A→Z」 | 按**显示名**排，看到什么就按什么排 |

导出与同步仍然用**调用名**作为目录名（`skills/<调用名>/`），因为目标端调用时按它匹配。

**逐条编辑**：详情面板 →「元信息」→ 来源标记区 →「编辑」。

- 可改：名称、版本、来源类型、安装时间、技能 ID / 发布者 ID、中英描述、中英示例、`userModified`。
- 没有标记的技能显示「添加标记」，此时可以选任意 Agent 的格式，字段按该格式渲染。
- 已有标记时格式固定（避免字段错位），想换格式在导出时重新生成。
- 保存会重算 `installedContentHash` 并写回本地索引；**不改 SKILL 内容与更新时间**，所以列表顺序不会突然跳动。
- 也支持「删除标记文件」，删除后该技能回到"无标记"状态。

几个实现细节：

- **默认沿用原标记**：勾着「优先沿用技能自带的标记」时，已有标记的技能原样带出（`_user_meta.json` 不会被强行改成 `_skillhub_meta.json`）；没有标记的才按所选格式生成。
- **内容哈希**：`installedContentHash` 用 `crypto.subtle` 对 SKILL.md 算 SHA-256，格式与真实样本一致（`sha256:...`）。
- **版本规范化**：`v1.4` → `1.4.0`，与样本的三段式一致。
- **可选字段留空就不写**：没填英文描述 / 示例时，这些键不会出现在文件里，而不是写空字符串。
- **导入时容错**：真实文件里有尾随逗号，不是严格 JSON。读取用宽松解析（去 BOM + 去尾随逗号），否则回读会失败。
- **写出用严格 JSON**：我们生成的是合法 JSON，任何解析器都能读。

---

## 多 Agent 安装状态与同步

同一个 SKILL 往往同时装在 Claude Code、WorkBuddy、Trae 等多个目录里。实现把它当**一个技能实体的多个安装点**，而不是几条互不相干的记录。

### 状态判定

| 状态 | 判定方式 |
|---|---|
| 已安装 | 该 Agent 的来源目录下存在**同名技能**（名称忽略大小写） |
| 未安装 | 该目录下没有同名技能 |
| 已同步 | 已安装，且其 `content` 与当前主记录**逐字一致**（`trim()` 后比较） |
| 有差异 | 已安装，但内容与主记录不同——本地改过或版本不一 |
| 只读 | 来源被标记为受管目录（如豆包工作），不可写入 |

### 界面呈现

- **卡片**：底部一排 6 格缩写方块（`CC` `CX` `WB` `TR` `豆` `自`）。实心彩色=已安装，空心灰边=未安装，虚线=只读；空格悬停显示「Agent 名 · 状态」。右侧是 `3/6 个 Agent`，存在差异时追加「· 有差异」并转为警示色。
- **列表视图**：紧凑列显示 `已装数/总数`，悬停有完整提示。
- **详情 ·「安装」页**：顶部 `已安装 N / 6` 摘要（附带「N 个可同步 / N 个只读 / N 个有差异」），下面是逐 Agent 列表——已安装显示路径、版本、时间与状态徽标；未安装显示「同步到此」；只读显示「不可写入」。右上角「同步到全部未安装」。
- 同步完成后，页面顶部出现结果条：`新增 x · 覆盖 y · 跳过 z · 失败 k`，失败项逐条列出 Agent 与原因，可手动关闭。

### 一次同步到底做了什么

- **目标未安装** → 在目标来源下新建一条记录，复制 `content / files / meta / tags`，打上 `syncedFrom`。
- **目标已安装且内容一致** → 跳过，不重写（幂等，重复点不会产生副本）。
- **目标已安装但内容不同** → 覆盖内容与元数据，`syncedFrom` 指向当前源，版本号跟随源。
- **同步不修改源记录**：主记录的 `content`、`updatedAt` 都不变。

### 一致性保障

1. **主记录稳定**：聚合时按「原始安装点（无 `syncedFrom`）> 非只读 > 最近更新」排序。否则同步一次后，新写入的副本会因为时间更新而抢走主来源，卡片看起来像"来源被改了"。
2. **单一真实来源**：以主记录的 `content` 为唯一比对基准，所有安装点都跟它比，不搞两两比较。
3. **逐目标独立写入**：批量同步对每个 Agent 单独执行、单独记录结果，一个失败不影响其他。
4. **列表去重**：「全部技能」按名称聚合成一条，避免同一个技能出现多张重复卡片；但左侧来源计数仍是**该目录里的实际安装点数**（目录视角）。
5. **可回退**：失败/跳过都会带着原因返回，且不产生半写入——单个目标要么整条新增、要么整条覆盖，不会只改一半。

### 失败与部分成功

| 情况 | 处理 |
|---|---|
| 目标是只读目录 | 不发请求，直接标「不可写入」，批量时计入失败并给出原因 |
| 目标名字相同、内容一致 | 计为「跳过」，提示"内容已一致" |
| 目标名字相同、内容不同 | 覆盖并提示"已覆盖目标上的旧版本" |
| 源内容为空 | 拒绝同步，提示"SKILL.md 内容为空" |
| 批量部分成功 | 汇总条显示四类计数，失败项逐条列出 Agent + 原因，可关闭；页面不阻塞，已成功的安装点立刻生效 |

### 卸载

安装列表里每个**已安装**的 Agent 行右侧有「卸载」，点击后该行原地变成确认态（红底）：

- 文案会区分两种情况：还剩多个安装点时提示"只移除这一份安装，其他 Agent 不受影响"；**只剩一个**时提示"这是最后一个安装点，卸载后该技能会从列表移除"。
- 确认后从该 Agent 移除记录，Toast 反馈 `已从 WorkBuddy 卸载 · 还剩 2 个安装点`。
- **只读目录不可卸载**（豆包工作这类受管目录），直接拒绝并说明原因。
- 卸载当前正在查看的记录时，选中会自动切换到剩余安装点的任意一条，页面不会跳空。
- 卸载只是移除这一份安装记录，**不会影响源文件和它的元数据**；之后仍可以重新「同步到此」装回来。
- 卸载最后一个安装点后，该技能从聚合列表消失，选中态清空。

---

## 需要先说明的假设

设计稿是界面语言，有几处必须做判断，我按下面方式落地：

1. **运行时**：前端是**零依赖纯静态实现**，外壳用 Tauri（不内置浏览器，包 3.4MB）。同一份前端既能被 Tauri 直接加载，也能用静态服务器在浏览器里跑，不用维护两套。
2. **数据来源**：浏览器拿不到 `~/.claude/skills` 这类真实路径。默认用**24 条内置演示数据**（结构与真实 SKILL 一致，含 frontmatter、正文、关联文件）。其中 5 条额外复制成了跨来源副本，用来演示"一个技能装在多个 Agent"——所以是 24 个技能、29 个安装点。只有走「添加目录 → 浏览」时才是**真实读取**本地 SKILL.md。
3. **「豆包工作」只读**：设计稿里这个来源被标成只读、不可写入。实现沿用该设定，导入时禁用该目标，用于展示受管目录的约束；真实环境应由后端返回可写性。
4. **ZIP**：自己实现读写。写出用 store 模式（不压缩），兼容性优先、体积略大；读取支持 store 与 deflate（靠浏览器原生 `DecompressionStream`），ZIP64 不支持。
5. **文件夹导出**：依赖 `showDirectoryPicker`，不支持时明确提示改用 ZIP，不静默失败。
6. **窗口控件**：浏览器无法真的最小化 / 关闭，点击会提示"打包为桌面应用后由系统处理"，不做假动画。
7. **数量**：设计稿里的 126 个 SKILL 是示意数字，实现显示真实条目数（24）。
8. **重名冲突的"覆盖并备份"**：界面按设计稿呈现该策略，实现里做的是覆盖并自增版本号；备份副本需在接真实文件系统时落盘（见下）。
9. **其他 Agent 没有官方标记文件**：本机 `~/.claude/skills`、`~/.codex`、`~/.trae/skills` 下都没有 `*_meta.json`。这些来源用「通用来源标记」，界面上明确写「该 Agent 未发现官方标记文件，写入通用结构」，不伪装成官方格式。
10. **分类是本地概念**：自定义分类只存在 Skill Hub 的索引里，不写回 SKILL.md frontmatter，也不影响其他 Agent 的读取。
11. **自定义来源必填名称**：新增目录时默认填入目录名，但输入框可改，且不允许空名——不会出现固定写死的「自定义目录」。

---

## 目录结构

```
Skill-Hub/
├─ index.html                  静态骨架（三栏 + 标题栏 + 状态栏）
├─ package.json                Tauri 依赖与构建脚本
├─ serve.py                    Python 版本地服务器（禁用缓存）
├─ scripts/                    Node 版开发服务器 + 前端打包脚本
├─ src-tauri/                  桌面壳（Rust）
│  ├─ src/lib.rs               扫描 / 写盘 / 卸载 / 窗口命令
│  ├─ tauri.conf.json          窗口与打包配置
│  ├─ capabilities/            权限声明
│  └─ icons/                   双平台图标（ico / icns / png）
├─ .github/workflows/          双平台 CI 构建
├─ src/
│  ├─ core/
│  │  ├─ utils.js              转义 / 时间 / 文件 / 剪贴板
│  │  ├─ seed.js               内置演示数据（24 条 SKILL）
│  │  ├─ markdown.js           轻量 Markdown 渲染（先转义后解析）
│  │  ├─ metaFormats.js        来源标记格式注册 / 生成 / 识别（含宽松 JSON 解析）
│  │  ├─ zip.js                ZIP 读写（store 写 / store+deflate 读）
│  │  ├─ store.js              状态、筛选、分组、持久化、导入落库
│  │  └─ importExport.js       导入解析与导出打包
│  ├─ ui/
│  │  ├─ icons.js              内联 SVG 图标集
│  │  ├─ components.js         卡片 / 行 / 分组 / 空状态片段
│  │  ├─ sidebar.js            来源与分类导航
│  │  ├─ list.js               内容区渲染与事件委托
│  │  ├─ detail.js             详情三个 Tab
│  │  └─ dialogs.js            导入 / 导出 / 添加目录 / 设置
│  └─ app.js                   启动、全局事件、快捷键
└─ assets/styles/
   ├─ tokens.css               设计 token（浅 / 深双主题）
   ├─ layout.css               外壳与三栏
   ├─ components.css           通用组件
   └─ dialogs.css              对话框与抽屉
```

数据流是单向的：UI 只调用 `store` 的方法，`store` 改完状态 `emit`，各处重渲染。所有插入模板的文本都过 `esc()`。

---

## 接真实文件系统（Tauri 化）

需要替换的就三处，其余 UI 不用动：

1. `store.load()`：改为先向 Rust 侧请求索引（`invoke('scan_sources')`），拿不到再用 `seed`。
2. `SH.io.parseSelection()`：把"读 File 对象"换成"读绝对路径"。
3. `store.importSkills()` / `SH.io.exportFolder()`：把写 localStorage 改成写回目标 Agent 目录。

放两个 Tauri 命令即可：

```rust
#[tauri::command]
fn scan_sources(roots: Vec<String>) -> Vec<SkillMeta>;   // 只解析 frontmatter
#[tauri::command]
fn write_skills(target: String, bundle: PathBuf) -> ImportReport;
```

索引建议缓存在 `appData` 下，冷启动先渲染缓存、后台再增量扫描——这是"1 秒可交互"的关键。

---

## 开发调试

页面支持几个预览参数，方便直接看某个状态：

```
?demo=import      导入第一步
?demo=import2     导入第二步（带同名冲突示例）
?demo=export      导出对话框
?demo=add         添加目录
?demo=settings    设置抽屉
?demo=dark        深色主题
?demo=list        列表视图
?demo=mac         macOS 标题栏
?demo=newcat      新建分类
?demo=editsrc     编辑来源
?demo=meta        详情 · 元信息（含来源标记）
?demo=editmeta    编辑已有来源标记
?demo=addmeta     为无标记的技能添加标记
?demo=installs    安装状态页（6 个 Agent 的安装情况）
?demo=syncresult  批量同步后的部分成功结果
?demo=uninstall   卸载二次确认态
```

---

## 已知限制

- **浏览器预览**下仍受沙箱限制（目录读取、真实写盘、窗口控制都不行）；桌面版不受这些限制。
- **macOS 卸载必须用脚本**：把 `.app` 拖进废纸篓只删程序本体，`~/Library` 下还有 5 类文件
  要清。这是 macOS 的通用行为（不是本应用的问题），所以提供了 `uninstall.sh`，
  并在「设置 → 关于 → 卸载」里可一键导出到桌面。
- **Windows 未做单实例限制**：同一个便携目录被双击两次会开两个进程、共用一份
  `data\webview\`。WebView2 对同一 profile 的多实例支持有限，别同时开两个；
  不同副本之间互不影响。
- **macOS 包未签名**：首次打开需右键 →「打开」，正式分发要 Apple Developer 证书 + 公证。
- 未做虚拟滚动，几百条以内没问题，上千条需要接窗口化列表。
- 来源标记里的 `iconSource` / `iconLocalPath` / `iconDownloadedFrom` 没有生成：拿不到市场图标地址与本地图标文件，接真实来源时再补。
- 自定义分类/来源只存在本地索引里，不支持单独导入导出它们。
- 桌面版同步会**真实写盘**到目标 Agent 目录（覆盖前备份到 `data/backups`），卸载会移到
  `data/trash`；浏览器预览仍只改索引。
- ZIP 写出不压缩，导出体积会比市面上工具大一些。
