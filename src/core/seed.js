/* ------------------------------------------------------------
   seed.js · 内置演示数据
   说明：浏览器无法读取本机 ~/.claude/skills 等真实目录，
   这里用一份结构与真实 SKILL 一致的种子数据；接入 Tauri 后
   由 core/nativeProvider 替换（见 README「数据来源」）。
   ------------------------------------------------------------ */
(function () {
  const SH = window.SH;
  const { DAY, byteLength } = SH.util;
  const now = Date.now();

  const sources = [
    {
      id: "claude",
      name: "Claude Code",
      path: "~/.claude/skills",
      colorVar: "--src-claude",
      readonly: false,
      builtin: true,
    },
    {
      id: "codex",
      name: "Codex",
      path: "~/.codex/skills",
      colorVar: "--src-codex",
      readonly: false,
      builtin: true,
    },
    {
      id: "workbuddy",
      name: "WorkBuddy",
      path: "~/.workbuddy/skills",
      colorVar: "--src-workbuddy",
      readonly: false,
      builtin: true,
    },
    {
      id: "trae",
      name: "Trae",
      path: "~/.trae/skills",
      colorVar: "--src-trae",
      readonly: false,
      builtin: true,
    },
    {
      id: "doubao",
      name: "豆包工作",
      path: "~/Doubao/skills",
      colorVar: "--src-doubao",
      readonly: false,
      builtin: true,
    },
    {
      id: "custom",
      name: "自定义目录",
      path: "~/my-skills",
      colorVar: "--src-custom",
      readonly: false,
      builtin: false,
    },
  ];

  const categories = [
    { id: "code", name: "代码开发", colorVar: "--cat-code" },
    { id: "doc", name: "文档写作", colorVar: "--cat-doc" },
    { id: "data", name: "数据分析", colorVar: "--cat-data" },
    { id: "design", name: "设计创意", colorVar: "--cat-design" },
    { id: "auto", name: "效率自动化", colorVar: "--cat-auto" },
    { id: "other", name: "其他", colorVar: "--cat-other" },
  ];

  const defs = [
    {
      name: "commit-message",
      cat: "code",
      src: "claude",
      version: "v1.2",
      days: 2,
      fav: true,
      tags: ["git", "规范"],
      desc: "根据暂存区改动生成符合 Conventional Commits 规范的提交信息，自动判断变更范围。",
      summary:
        "读取暂存区改动，按 Conventional Commits 规范输出提交信息，并自动判断变更类型与影响范围。适合在提交前手动触发，避免写完代码再回头想 type 和 scope。",
      steps: [
        "运行 `git diff --cached --stat` 获取本次改动范围",
        "判断 type 与 scope，不要猜测未改动的业务模块",
        "生成不超过 72 字符的 subject，正文说明动机而非实现细节",
      ],
      example: {
        lang: "bash",
        code: "git diff --cached --stat\n\nfeat(skills): 支持跨平台目录扫描",
      },
      notes: ["暂存区为空时直接退出，不要编造改动", "不要自动执行 commit，交由用户确认"],
      tools: "Bash(git diff), Read",
    },
    {
      name: "code-review",
      cat: "code",
      src: "codex",
      version: "v2.0",
      days: 5,
      fav: true,
      tags: ["review", "质量"],
      desc: "按团队规范审查改动，输出可执行的修改建议，并标注风险等级与影响范围。",
      summary:
        "把 diff 拆成「必须修 / 建议修 / 可以忽略」三档，每条给出具体行号与替代写法，避免只给抽象评价。",
      steps: [
        "先读 `references/conventions.md` 里的团队约定",
        "按文件逐个审查，标注风险等级（高 / 中 / 低）",
        "对每条问题给出可直接替换的代码片段",
        "最后汇总可能受影响的模块与回归点",
      ],
      example: {
        lang: "text",
        code: "高  src/store.js:42  闭包捕获了过期索引，改为传入快照\n中  src/ui/list.js:88  重复渲染，建议加 key 比较",
      },
      notes: ["不要评论格式问题，交给 formatter", "没有发现问题时明确说明已覆盖的范围"],
      tools: "Read, Bash(git diff)",
    },
    {
      name: "flutter-test",
      cat: "code",
      src: "workbuddy",
      version: "v1.0",
      days: 7,
      tags: ["flutter", "测试"],
      desc: "为 Flutter 页面生成组件测试与主题切换回归用例，自动覆盖暗色模式状态。",
      summary:
        "根据页面结构生成 widget test 骨架，覆盖首屏渲染、空状态、加载态与暗色主题切换四条主路径。",
      steps: [
        "读取目标页面的 build 方法，识别关键组件与控制点",
        "生成 `testWidgets` 用例，使用 `pumpWidget` 包裹主题",
        "暗色模式下再跑一遍，断言颜色来自主题而非硬编码",
      ],
      example: {
        lang: "dart",
        code: "testWidgets('dark theme rebuilds', (tester) async {\n  await tester.pumpWidget(App(theme: ThemeMode.dark));\n  expect(find.byType(HomePage), findsOneWidget);\n});",
      },
      notes: ["不要 mock 掉主题控制器，那会掩盖真实问题"],
      tools: "Read, Bash(flutter test)",
    },
    {
      name: "api-mock-server",
      cat: "code",
      src: "trae",
      version: "v0.8",
      days: 3,
      tags: ["mock", "接口"],
      desc: "根据接口定义快速生成本地 Mock 服务，支持延迟、异常与分页场景模拟。",
      summary:
        "把 OpenAPI 或手写路由转成本地 Mock 服务，内置延迟、错误码、分页三种场景开关，方便前端联调。",
      steps: [
        "读取接口定义，生成路由表",
        "为每个接口生成 3~5 条示例数据",
        "启动本地服务并打印可访问地址",
      ],
      example: {
        lang: "bash",
        code: "api-mock --spec ./openapi.yaml --port 4010 --delay 180",
      },
      notes: ["默认只监听 127.0.0.1", "不要在示例数据里放真实用户信息"],
      tools: "Read, Bash",
    },
    {
      name: "docx-report",
      cat: "doc",
      src: "workbuddy",
      version: "v1.4",
      days: 4,
      fav: true,
      tags: ["报告", "word"],
      desc: "把结构化数据整理成可交付的 Word 报告，自动套用标题层级与表格样式。",
      meta: {
        formatId: "workbuddy-market",
        fileName: "_skillhub_meta.json",
        source: "marketplace",
        extra: {
          name: "文档报告生成器",
          skillId: "skill_2097864900645801984",
          examples_zh: ["把这份数据整理成周报 Word", "按模板出一份验收文档"],
          examples_en: ["Turn this data into a weekly report docx"],
        },
      },
      summary:
        "输入结构化数据或 Markdown 草稿，输出带目录、页眉页脚与统一表格样式的 .docx，适合周报、调研与验收文档。",
      steps: [
        "确认数据源与报告结构（标题层级、图表位置）",
        "套用模板样式，表格统一为三线表",
        "导出前检查页码、目录与交叉引用",
      ],
      example: {
        lang: "text",
        code: "report.md + data.csv  ->  weekly-report.docx",
      },
      notes: ["图片统一压缩到 150dpi，避免文档过大", "不要改动用户的正文措辞"],
      tools: "Read, Write",
    },
    {
      name: "meeting-notes",
      cat: "doc",
      src: "doubao",
      version: "v1.1",
      days: 6,
      tags: ["会议", "纪要"],
      desc: "从会议转写提取决议、待办与责任人，输出带时间线的结构化纪要。",
      summary:
        "把无结构的会议转写整理成「结论 / 待办 / 分歧」三段式纪要，待办自动带上责任人与时间点。",
      steps: ["先通读转写，标记发言人", "抽取决议与待办，按议题归组", "输出统一格式的纪要"],
      example: {
        lang: "text",
        code: "## 结论\n- 下版本先做索引增量扫描\n\n## 待办\n- 扫描性能压测 / 王工 / 本周五",
      },
      notes: ["区分「讨论」与「决议」，不要把讨论写进结论"],
      tools: "Read",
    },
    {
      name: "gzh-article",
      cat: "doc",
      src: "claude",
      version: "v1.6",
      days: 1,
      fav: true,
      tags: ["公众号", "写作"],
      desc: "把技术要点改写成公众号可读的长文，控制段落密度并给出配图位置建议。",
      summary:
        "面向非专业读者的技术写作：先给结论，再给场景，最后给可复制的做法；每 300 字给一个可扫读的小标题。",
      steps: [
        "确定读者与单一主张，砍掉所有不服务于主张的段落",
        "按「结论—场景—做法—边界」重排结构",
        "标注配图位置与图片说明",
      ],
      example: {
        lang: "text",
        code: "标题：为什么你的 SKILL 总是找不到\n配图位：#2 目录结构示意\n配图位：#3 导入流程截图",
      },
      notes: ["不要用「赋能」「闭环」这类空词", "结尾不要强行升华"],
      tools: "Read, Write",
    },
    {
      name: "pdf-extract",
      cat: "doc",
      src: "custom",
      version: "v0.9",
      days: 12,
      tags: ["pdf", "提取"],
      desc: "从扫描件或 PDF 中提取正文与表格，保留段落顺序并标注可疑识别结果。",
      summary:
        "按页提取文本块，识别表格并转成 CSV，对置信度低的块加标记，方便人工复核。",
      steps: ["按页切分并提取文本块", "检测表格区域，转为结构化行", "输出正文 Markdown 与表格 CSV"],
      example: {
        lang: "bash",
        code: "pdf-extract ./contract.pdf --tables --mark-low-confidence",
      },
      notes: ["扫描件优先走 OCR，纯文本层直接读取更快"],
      tools: "Read, Write, Bash",
    },
    {
      name: "sql-explorer",
      cat: "data",
      src: "codex",
      version: "v1.3",
      days: 2,
      tags: ["sql", "查询"],
      desc: "从自然语言问题生成只读 SQL，先解释执行计划再落查询，避免全表扫描。",
      summary:
        "把业务问题翻译成只读查询：先 EXPLAIN，确认命中索引后再执行，结果自动转成可读表格。",
      steps: ["确认表结构与数据量级", "写出查询并先跑 EXPLAIN", "执行后把结果整理成表格并说明口径"],
      example: {
        lang: "sql",
        code: "EXPLAIN SELECT source_id, COUNT(*)\nFROM skills GROUP BY source_id;",
      },
      notes: ["只允许 SELECT / WITH，禁止写操作", "涉及大表时先加 LIMIT 试跑"],
      tools: "Bash(psql), Read",
    },
    {
      name: "chart-report",
      cat: "data",
      src: "workbuddy",
      version: "v1.0",
      days: 9,
      tags: ["图表", "可视化"],
      desc: "根据数据特征推荐图表类型，生成配色一致的可视化并附解读要点。",
      summary:
        "先判断数据关系（趋势 / 对比 / 构成 / 分布），再选图表，避免所有数据都画成折线图。",
      steps: ["判断数据关系与量级", "选图表并统一配色与坐标轴", "给每个图表配一句结论"],
      example: {
        lang: "text",
        code: "趋势 -> 折线；对比 -> 条形；构成 -> 堆叠条（不用饼图）",
      },
      notes: ["同一份报告里图表配色保持一致", "坐标轴从零开始，除非明确标注截断"],
      tools: "Read, Write",
    },
    {
      name: "csv-cleaner",
      cat: "data",
      src: "custom",
      version: "v0.7",
      days: 15,
      tags: ["清洗", "csv"],
      desc: "统一日期、金额与空值格式，输出去重报告而不是静默丢弃数据。",
      summary:
        "清洗前先出一份「问题清单」：多少空值、多少重复、多少格式不一致，清理后给出前后对比。",
      steps: ["读取并推断每列类型", "输出问题清单供确认", "执行清洗并生成差异报告"],
      example: {
        lang: "bash",
        code: "csv-clean ./orders.csv --dedupe --date-format YYYY-MM-DD --report",
      },
      notes: ["绝不静默删除行", "原始文件另存一份 .bak"],
      tools: "Read, Write, Bash",
    },
    {
      name: "ab-test-reader",
      cat: "data",
      src: "claude",
      version: "v1.1",
      days: 20,
      tags: ["实验", "统计"],
      desc: "读取实验分流数据，计算显著性与置信区间，明确指出样本量是否足够。",
      summary:
        "输出不止 p 值：同时给效应量、置信区间与所需样本量，避免「显著但没用」的结论。",
      steps: ["校验分流比例与样本量", "计算转化差值与置信区间", "判断是否达到最小可检测效应"],
      example: {
        lang: "text",
        code: "+2.4% (95% CI 0.3% ~ 4.5%)  p=0.03  样本量达标",
      },
      notes: ["不要用「趋势向好」替代统计结论"],
      tools: "Read, Bash",
    },
    {
      name: "ui-critique",
      cat: "design",
      src: "trae",
      version: "v1.2",
      days: 3,
      tags: ["评审", "ui"],
      desc: "对界面截图做结构化评审，按信息层级、对齐、密度与一致性四类给出修改项。",
      summary:
        "先判断用户要完成的主任务，再看界面对它的支持度；评审结论必须落到可执行的修改，而不是审美评价。",
      steps: ["识别主任务与视线路径", "按四类问题逐项检查", "输出按优先级排序的修改清单"],
      example: {
        lang: "text",
        code: "P0 主操作与次操作视觉权重接近，看不出该点哪个\nP1 列表与详情间距不一致，13 / 16 混用",
      },
      notes: ["不要只说「不够美观」，要指出具体元素与改法"],
      tools: "Read",
    },
    {
      name: "icon-set",
      cat: "design",
      src: "workbuddy",
      version: "v0.9",
      days: 8,
      tags: ["图标", "svg"],
      desc: "按统一网格与线宽生成成组 SVG 图标，输出可复用的 sprite 与组件映射。",
      meta: {
        formatId: "workbuddy-user",
        fileName: "_user_meta.json",
        source: "userImport",
      },
      summary:
        "16 / 20 / 24 三档网格，线宽与端点规则固定；生成后自动检查视觉重量是否一致。",
      steps: ["确定网格与线宽", "按同一构造规则绘制", "导出 sprite 与名称映射表"],
      example: {
        lang: "text",
        code: "24 网格 / 1.5 线宽 / 圆角端点  ->  icons.svg + icons.json",
      },
      notes: ["同一组内不要混用实心与描边风格"],
      tools: "Read, Write",
    },
    {
      name: "poster-layout",
      cat: "design",
      src: "doubao",
      version: "v1.0",
      days: 11,
      tags: ["海报", "排版"],
      desc: "根据文案长度与投放尺寸生成海报版式方案，给出字号阶梯与留白比例。",
      summary: "先定信息优先级，再定版式骨架；输出两套可选方案与对应的字号、留白参数。",
      steps: ["拆分标题 / 副标题 / 正文 / 落款", "选版式骨架并给字号阶梯", "输出方案对比与适用场景"],
      example: {
        lang: "text",
        code: "方案 A 居中：主标 72 / 副标 28 / 正文 16，留白 18%",
      },
      notes: ["不要为了填满画面堆装饰元素"],
      tools: "Read",
    },
    {
      name: "color-audit",
      cat: "design",
      src: "custom",
      version: "v0.6",
      days: 25,
      tags: ["配色", "无障碍"],
      desc: "检查界面配色的对比度与语义一致性，标出不满足 WCAG AA 的文本组合。",
      summary:
        "遍历文本与背景组合，计算对比度，找出低于 4.5:1 的正文与 3:1 的大字，并给出最近的可通过色。",
      steps: ["收集文本色与背景色组合", "计算对比度并分级", "给出最小改动的替代色"],
      example: {
        lang: "text",
        code: "#8C8C86 on #F8F6F2 = 3.1:1  ✗ 正文不足\n→ #6E6E68 = 4.6:1  ✓",
      },
      notes: ["辅助文字也要检查，别只测标题"],
      tools: "Read",
    },
    {
      name: "wechat-sender",
      cat: "auto",
      src: "custom",
      version: "v2.1",
      days: 1,
      fav: true,
      tags: ["自动化", "微信"],
      desc: "按配置向指定会话发送文本与图片，带发送前校验与失败重试。",
      summary:
        "发送前校验会话标题、输入框焦点与粘贴结果，发送后截图取证；失败按指数退避重试三次。",
      steps: ["定位会话并校验标题", "粘贴内容并确认非空", "发送并截图取证"],
      example: {
        lang: "bash",
        code: "wechat-send --chat \"TEST 群\" --message \"构建完成\" --group",
      },
      notes: ["不要向未经确认的联系人发送", "失败时保留截图而不是静默重试"],
      tools: "Bash",
    },
    {
      name: "cron-runner",
      cat: "auto",
      src: "codex",
      version: "v1.4",
      days: 6,
      tags: ["定时", "调度"],
      desc: "把脚本注册为定时任务，支持错过补偿策略与单实例锁，输出运行日志。",
      summary:
        "统一 cron 表达式语义，默认「错过即跳过」，每个任务加单实例锁，日志按天切分。",
      steps: ["校验 cron 表达式与时区", "注册任务并设置补偿策略", "启动调度并确认下次触发时间"],
      example: {
        lang: "text",
        code: "0 9 * * 1-5  weekday-report  catch_up=false  timeout=300",
      },
      notes: ["调度器只在启动时读取配置，改完必须重启"],
      tools: "Bash, Read",
    },
    {
      name: "folder-tidy",
      cat: "auto",
      src: "workbuddy",
      version: "v1.0",
      days: 14,
      tags: ["整理", "文件"],
      desc: "按类型与时间整理下载目录，先出方案再执行，所有移动进入系统回收站。",
      summary:
        "默认只出报告不动文件；确认后才执行，且一律走回收站而非直接删除，支持按批次回滚。",
      steps: ["扫描并生成分类方案", "输出待移动清单供确认", "分批执行，每批不超过 10 个文件"],
      example: {
        lang: "text",
        code: "Downloads/  ->  Documents/发票 (12) · Pictures/截图 (38) · 保留 (7)",
      },
      notes: ["禁止对家目录做递归删除", "每批执行后校验结果"],
      tools: "Bash, Read",
    },
    {
      name: "clipboard-bridge",
      cat: "auto",
      src: "claude",
      version: "v0.5",
      days: 30,
      tags: ["剪贴板", "桥接"],
      desc: "在本机与远程会话之间同步剪贴板文本，自动去重并限制单条大小。",
      summary: "监听剪贴板变化，超过阈值的内容只同步摘要，避免把大段日志塞进远程会话。",
      steps: ["监听变化并去重", "超过 8KB 时截断并提示", "写入目标端并回执"],
      example: {
        lang: "text",
        code: "clipboard -> remote  (12.4 KB, 已截断至 8 KB)",
      },
      notes: ["不要同步疑似密钥的内容"],
      tools: "Bash",
    },
    {
      name: "changelog-keeper",
      cat: "other",
      src: "trae",
      version: "v1.1",
      days: 5,
      tags: ["changelog", "发布"],
      desc: "从提交记录与合并请求生成面向用户的更新日志，按影响面分组。",
      summary: "把内部提交信息改写成用户能理解的变化，按「新增 / 改进 / 修复」分组，去掉内部编号。",
      steps: ["收集区间内的提交与 PR", "过滤纯重构与依赖升级", "改写为用户语言并按影响面分组"],
      example: {
        lang: "text",
        code: "## 新增\n- 支持导入 SKILL 并选择目标 Agent\n\n## 修复\n- 修复深色模式下计数不可见",
      },
      notes: ["不要直接贴 commit 标题"],
      tools: "Read, Bash(git log)",
    },
    {
      name: "prompt-tester",
      cat: "other",
      src: "claude",
      version: "v0.8",
      days: 10,
      tags: ["提示词", "评测"],
      desc: "对同一组提示词跑多组输入，输出稳定性、边界失败与回归对比。",
      summary: "固定输入集，比较不同提示词版本的通过率与失败模式，避免只看单次效果。",
      steps: ["准备覆盖正常与边界的输入集", "分别跑各版本并记录结果", "汇总失败模式与改进建议"],
      example: {
        lang: "text",
        code: "v3 通过 24/30（边界 6 例中失败 4）\nv4 通过 27/30（边界失败 1）",
      },
      notes: ["样本量太小时不要下结论"],
      tools: "Read, Write",
    },
    {
      name: "docs-sync",
      cat: "other",
      src: "workbuddy",
      version: "v1.2",
      days: 18,
      tags: ["文档", "同步"],
      desc: "比对代码与文档的接口签名，标出过期说明并生成待改清单。",
      summary: "解析导出的类型定义，与文档中的签名逐一比对，输出「缺失 / 过期 / 多余」三类差异。",
      steps: ["提取代码中的公开签名", "解析文档中的签名", "输出差异清单并定位到行"],
      example: {
        lang: "text",
        code: "过期  docs/api.md:64  listSkills(limit)  ->  listSkills(filter)",
      },
      notes: ["只报告差异，不自动改文档"],
      tools: "Read",
    },
    {
      name: "license-check",
      cat: "other",
      src: "codex",
      version: "v1.0",
      days: 22,
      tags: ["合规", "依赖"],
      desc: "扫描依赖许可证，按风险分级，给出可替换方案与义务说明。",
      summary: "输出依赖许可证清单，标出 copyleft 与商用限制，并说明分发时需要履行的义务。",
      steps: ["解析依赖树与许可证字段", "按风险分级（高 / 中 / 低）", "给出替代库与义务说明"],
      example: {
        lang: "text",
        code: "高  gpl-3.0  libx@2.1  分发需开源衍生作品",
      },
      notes: ["许可证字段缺失时要标注「未知」，不能默认安全"],
      tools: "Read, Bash",
    },
  ];

  function buildContent(d) {
    const lines = [
      "---",
      `name: ${d.name}`,
      `description: ${d.desc}`,
      `allowed-tools: ${d.tools || "Read"}`,
      "---",
      "",
      `# ${d.name}`,
      "",
      d.summary,
      "",
      "## 使用步骤",
      "",
      ...d.steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      "## 示例",
      "",
      "```" + (d.example.lang || "bash"),
      d.example.code,
      "```",
      "",
      "## 注意事项",
      "",
      ...d.notes.map((n) => `- ${n}`),
      "",
    ];
    return lines.join("\n");
  }

  function buildFiles(d, content) {
    const files = [
      { name: "SKILL.md", content },
      {
        name: "references/conventions.md",
        content: [
          `# ${d.name} · 约定`,
          "",
          `本文件记录 ${d.name} 的边界与团队约定，供 SKILL 执行时参考。`,
          "",
          "- 只处理被明确指定的输入，不主动扩大范围",
          "- 所有写操作都需要用户确认",
          "- 输出保持结构化，便于后续脚本消费",
          "",
        ].join("\n"),
      },
    ];
    if (d.example) {
      files.push({
        name: `templates/${d.name}.txt`,
        content: `${d.name} 输出模板\n\n${d.example.code}\n`,
      });
    }
    return files.map((f) => ({ ...f, size: byteLength(f.content) }));
  }

  const skills = defs.map((d, index) => {
    const content = buildContent(d);
    const updatedAt = now - d.days * DAY - index * 37 * 60 * 1000;
    const created = updatedAt - (18 + (index % 12) * 7) * DAY;
    const src = sources.find((s) => s.id === d.src);

    /* 两条示例带真实结构的来源标记，便于在详情里查看 */
    const meta = d.meta
      ? {
          formatId: d.meta.formatId,
          fileName: d.meta.fileName,
          data: Object.assign(
            {
              name: d.name,
              installedAt: updatedAt,
              source: d.meta.source,
              version: String(d.version).replace(/^v/, ""),
              description_zh: d.desc,
            },
            d.meta.extra || {}
          ),
        }
      : null;

    return {
      id: `sk_${d.name.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
      name: d.name,
      description: d.desc,
      categoryId: d.cat,
      sourceId: d.src,
      version: d.version,
      updatedAt,
      createdAt: created,
      favorite: !!d.fav,
      exportable: !src.readonly,
      tags: d.tags || [],
      path: `${src.path}/${d.name}`,
      content,
      files: buildFiles(d, content),
      meta,
    };
  });

  /* 演示多 Agent 安装：真实环境里每个 Agent 目录下各有一份同名技能 */
  const extraInstalls = [
    { name: "commit-message", to: "workbuddy" },
    { name: "commit-message", to: "trae" },
    { name: "code-review", to: "workbuddy" },
    { name: "docx-report", to: "claude" },
    { name: "icon-set", to: "trae" },
  ];

  extraInstalls.forEach((entry, index) => {
    const origin = skills.find((s) => s.name === entry.name);
    const target = sources.find((s) => s.id === entry.to);
    if (!origin || !target) return;
    if (skills.some((s) => s.name === entry.name && s.sourceId === entry.to)) return;

    skills.push({
      ...JSON.parse(JSON.stringify(origin)),
      id: `${origin.id}_${entry.to}`,
      sourceId: entry.to,
      path: `${target.path}/${entry.name}`,
      updatedAt: origin.updatedAt - (index + 1) * 3600000,
      exportable: !target.readonly,
      // 只有 WorkBuddy 的安装点带来源标记，其他 Agent 目录下没有 *_meta.json
      meta: entry.to === "workbuddy" && origin.meta ? JSON.parse(JSON.stringify(origin.meta)) : null,
      syncedFrom: origin.sourceId,
      syncedAt: origin.updatedAt,
    });
  });

  SH.seed = {
    sources,
    categories,
    skills,
    builtAt: now,
    version: 1,
  };
})();
