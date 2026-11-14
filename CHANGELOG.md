# Changelog

## 1.2.2 — 2026-11-15

- 对齐 DeepSeek Harness 0.2.2-rc.3：`engines.dsh` 提升至 `>=0.2.2-rc.3`，面板与 Host 版本号同步为 `1.2.2`；绘图引擎不变，73/73 测试通过。

## 1.2.1 — 2026-11-10

- 合并同时进行的 Python 解释器探测和能力查询。显式刷新使旧任务失去回填缓存的资格，失败后可以重试。[Issue #1](https://github.com/YansongG-HKU/dsh-sci-plot/issues/1)
- Windows 实机 Python 基准中，8 个并发冷启动的探测和能力查询均由 8 次降至 1 次。该批次耗时从 21.1 s 降至 8.5 s。

## 1.2.0 — 2026-11-09

交付与协同：把「会出图」补成「能交付、能记住偏好、能双向协作」。绘图引擎不变。

### 交付（R8）

- `sci_plot_export` 新增 `purpose` 交付预设：submission（PNG+PDF+TIFF @600dpi）/ slides（PNG+PDF @300dpi）/ web（PNG+SVG @150dpi）；新增 `reveal:true` 打开文件夹；返回每个格式的绝对文件路径。
- 新增 `sci_plot_pack`：把多张图打成**一个 ZIP**（`figures/` + `manifest.json` + `README.txt`，含每图质检分），支持 `figureIds` 或 `recent:N`；自带纯 Node ZIP 读写（`lib/zip.js`），零第三方依赖。

### 偏好与风格锁（R5 / 多图一致性）

- 新增 `sci_plot_preferences`（get/set/reset）：用户说「以后默认 IEEE 双栏 600dpi」时把偏好写进作品库 settings，面板与所有新渲染立即生效。
- `sci_plot_auto` 新增 `styleFrom:"<figureId>"`：复用已有图的 domain/journal/palette/font/size/dpi，保证一组论文配图风格一致。

### 数据（R6）

- 新增 `.xlsx` 支持：自带 OOXML 解析（`lib/xlsx.js`：ZIP + sharedStrings/styles/worksheet，日期序列号转 ISO，表头去重），读取第一个非空工作表，无需 openpyxl/pandas。
- 面板工作区数据发现、`sci_plot_inspect_data`、`sci_plot_auto`、面板预览全部支持 xlsx；旧版 `.xls` 返回明确修复提示（另存为 .xlsx/CSV）。

### 面板 ↔ 对话（R9 / R4）

- 作品详情新增「在对话中继续 / Continue in chat」：复制带 figureId 的迭代指令并回到对话，AI 用 `sci_plot_figures get` 接着改。
- `sci_plot_render` 新增 `parentId`：迭代时记录版本链；`sci_plot_figures` 新增 `action:"rewind"` 回到上一版（parentId 优先，否则同图种上一张），`action:"list"` 显示 parentId。
- 提示词同步：偏好、xlsx、交付预设/打包、面板 handoff、rewind/styleFrom 的行为约定。

### 验收

- host 单元 38 + client 单元 32 + engine 集成 7 + live panel 3 = **80 项测试全绿**；引擎 selftest 71/71 不变。
- 真实环境：xlsx 出图、偏好持久化、双图 ZIP、rewind、styleFrom、面板 handoff 按钮均已实物验证。

## 1.1.0 — 2026-11-09

会话原生出图：从「打开面板画图」升级为「AI 在对话里自主判断、一次出图、内联展示、一句话迭代」。绘图引擎与面板主体不变。

### 行为策略（系统提示）

- 触发矩阵：数据分析/探索、论文/报告/汇报准备、明确图表请求时主动出 1 张主图；代码、闲聊、纯数值问题不出图。
- 意图→图种速查（火山、KM、ROC、光谱、XRD、CV、TGA、Bode、训练曲线、时序、分布、组间、散点）。
- 默认每轮 1 张主图、质量门 ≥90、迭代只改被点名字段、无关任务不插入；图卡只做 UI，不占模型图像 token。
- 回复内同时给 Markdown 图（进程折叠时仍然可见）+ 一行图注 + 一句结论。

### 新工具

- `sci_plot_auto`：一次调用完成数据画像 → 图种/映射/风格 → 渲染 → 质检（含一次修复重试），返回 `figure/quality/chosen/caption/alternatives`；失败给出结构化错误与手动工具链回退提示。
- 工具返回瘦身：`sci_plot_render / export / figures get` 去掉内联数据行与完整质检清单，实测单次 payload 11.6 KB → 1.2 KB（-90%）；`figures get` 的 spec 改用 `data.path` 引用，继续迭代时 Host 自动重新读取。

### 会话内联图卡（Client）

- 注册 `tool.call.toolview`（`sci_plot_render` / `sci_plot_auto`）：缩略图、标题、图种/学科/期刊/尺寸/DPI/格式 chips、质检徽标、选型理由、备选图种、查看大图/在面板中打开、迭代提示。
- 图卡走面板同源 loopback 图片路由，不产生模型图像 token；排版跟随宿主主题 token，失败态给修复建议。

### 修复与质量

- 自动补全 demo 映射的缺省键（如 KM 生存曲线的 `group`），修掉 `recommend()` 的 KM 映射缺 group 导致的 `invalid_mapping`。
- 低于质量门自动尝试调色板/补标签/开图例重渲染一次，取更高分版本并清理失败图。
- 空数据、无 numeric 列、未知 kind、引擎不可用均结构化失败并给修复路径；“只有时间列”的数据默认出折线而不是把时间当柱状值。

### 验收

- 单元 + 集成测试全绿（host、client、engine、live panel），真实 GUI 内联图卡截图见 [docs/screenshots/conversation-inline-card.png](docs/screenshots/conversation-inline-card.png)。

## 1.0.0 — 2026-11-09

首个正式版本：把「科研绘图」做成可投稿的图表工作室。

### 引擎（Python / matplotlib）

- 新增 `engine/sciplot` 发布级绘图引擎：主题解析、色板系统、字体栈、spec 归一化、渲染上下文、统计助手、导出、投稿质检、CLI。
- 71 个图种，8 大族：基础 14、统计分布 15、生物医学 15、物理化学 11、工程信号 6、经济金融 5、机器学习 4、复合排版 1。
- 13 个学科预设 + 16 种期刊预设（真实单/双栏毫米宽度、字号与刻度规则）；风格按 base → domain → journal → size → 用户覆盖分层解析。
- 17 套分类色板（Okabe-Ito / Tol / ColorBrewer / NPG / Science / Lancet / NEJM / JAMA / Tableau / 灰阶 / 大地）与 27 套连续/发散/循环色标；内置 CVD 模拟 + Lab 色差分析。
- 论文级导出：PNG 300/600/1200 dpi、SVG、PDF/EPS（Type 42 可编辑字体）、TIFF（LZW）、JPG；按期刊物理尺寸出图。
- 投稿就绪度质检：0–100 分 + A/B/C/D，12 类逐项检查（矢量、分辨率、最小字号、字体嵌入、色盲安全、图例、坐标轴单位、空图、色标、刻度密度、过度绘制、缺字）。
- 51 套内置样本数据集（12 个学科，CSV + JSON sidecar，含字段类型/默认映射/推荐图种）。
- CLI：`render / capabilities / probe / validate / selftest / gallery / sample`，全部 JSON in/out。

### Host（Node）

- Python 解释器自动发现（config → 环境变量 → PATH → DSH 运行时 → 常见 conda/Python 安装），带 matplotlib 可用性探测与缓存。
- 作品库：`~/.dsh/sci-plot` 每图一目录（PNG/SVG/PDF/EPS/TIFF/缩略图 + spec + meta）、索引、240 张上限自动清理、面板默认设置持久化。
- 数据层：容错 CSV/TSV/JSON 解析、字段画像、图种推荐、工作区数据发现、路径边界校验、60k 行上限。
- 工具：`sci_plot_capabilities / inspect_data / render / export / figures / doctor`，结构化失败 + 修复建议。
- 面板 HTTP API：state / capabilities / render / export / delete / reveal / 文件流 / datasets / preview / validate / settings / diagnostics / gallery / assets，loopback + 插件头 + Origin 三重校验。
- 系统提示词小节：让 Agent 在科研绘图请求中走原生工作流。

### 面板（Client）

- 五个视图：画廊（作品网格 + 详情 + 质检清单 + 导出）、工作室（数据源 → 图种 → 风格 → 标签 → 参数 → 渲染）、风格库（学科/期刊/色板/画幅）、数据（51 套样本 + 工作区文件 + 预览 + 用它绘图）、设置（引擎/默认风格/目录/诊断）。
- 图种动态参数表单：bool / int / float / enum / string / color 六类控件，与引擎 option schema 同源。
- 实时预览：论文白底 + 棋盘格衬底、缩放、质检分数徽标、按期刊/DPI/宽度导出。
- 中英双语即时切换、浅/深色主题 token 自适应、1440/1024/768 响应式（<900px 导航转顶部横向）。
- 30 张策展示例图集 + 无 Python 时的只读能力清单兜底。

### 测试

- 引擎 selftest：71/71 通过（最低 98，均分 99.7）。
- 示例图集：30/30 渲染成功（2.98 MB）。
- 引擎单元测试 26 项、Host 单测 19 项、面板单测 27 项、真实引擎集成测试 8 项。
- 面板真实环境验收：桌面 GUI 侧栏入口、画廊/工作室/风格库/数据/设置五页、渲染→质检→导出链路、中英切换、1024/768 响应式。

### 已知限制

- 3D 画布网格样式由 matplotlib 统一控制，无法逐轴自定义。
- Taylor 图需要 `correlation` + `std_ratio` 列；`rmsd` 仅参考。
- 风玫瑰色标上界按数据最大风速取整（`≥10` 档为开区间近似）。
- 漏斗图期望区间为合并率 ±n·SE 正态近似。
- `multi_panel` 六面板渲染约 3 s，其余图种通常 < 2 s。
- 无 SciPy 时剂量-反应不给置信带、聚类热图走 NumPy 降级。
- 中文标签依赖系统 CJK 字体；无字体时质检报告缺字风险。
