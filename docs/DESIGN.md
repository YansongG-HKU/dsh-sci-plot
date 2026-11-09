# 设计说明 · dsh-sci-plot

## 目标与取舍

科研绘图有两条常见路线：一是让模型现场拼 matplotlib 代码，二是给一个「图表模板商场」。前者自由但不稳定、无投稿规范；后者稳定但图种与审美受限于模板数量。dsh-sci-plot 走第三条路：

- **引擎管样式**：字体、字号、线宽、刻度方向、边框、网格、色板、物理画幅、导出规格全部由主题系统决定，渲染器只负责「画什么」。
- **spec 是一等公民**：面板的每个控件、Agent 的每次调用、导出重渲染，都是同一份 JSON spec。面板与工具没有第二套逻辑。
- **可验收**：每次渲染都跑投稿质检并返回逐项结果；没人需要凭感觉判断「够不够专业」。

## 分层

```
Client (src/client/*.js)             Agent tools (lib/tools.js)
        │                                    │
        └────────── HTTP /api/* ─────────────┘
                          │
                    Host service (lib/service.js)
              ┌───────────┼─────────────┐
        FigureStore    PlotEngine     data.js
        (作品/设置)   (解释器发现/CLI) (CSV/画像/推荐)
                          │
                 Python engine (engine/sciplot)
        spec → themes → context → renderers → export → quality
```

### Python 引擎

| 模块 | 职责 |
|---|---|
| `themes.py` | BASE + 13 学科 + 16 期刊 + 8 画幅；分层合并、字体缩放、物理尺寸解析 |
| `palettes.py` | 17 套分类色板、27 套连续色标；CVD 模拟（Machado 矩阵）、Lab 色差、文字对比色 |
| `fonts.py` | 字体预设 → 实际可用 family 列表（拉丁 + CJK 逐字回退），mathtext 风格 |
| `spec.py` | spec 归一化、series/table/matrix/sample 四种数据形态、mapping 展开 |
| `context.py` | 画布/坐标轴创建、刻度边框网格、图例、色标、标题、面板编号；渲染器唯一入口 |
| `helpers.py` | KDE、ECDF、线性拟合并 bootstrap CI、显著性括号、角标、数值标签等统计助手 |
| `registry.py` | 图种注册表（kind/别名/分类/参数 schema/demo），按模块导入，单模块失败不影响其他 |
| `quality.py` | 12 类投稿检查 → 0–100 分与 A/B/C/D |
| `export.py` | PNG/SVG/PDF/EPS/TIFF/JPG，Type 42 字体，缩略图，像素尺寸回读 |
| `cli.py` | 所有命令 JSON in/out；单个进程完成一次渲染，便于 Host 超时/隔离控制 |
| `renderers/*.py` | 71 个图种，按族拆分；禁止直接改 rcParams、硬编码颜色字号 |

### 风格解析

```
BASE（7pt Arial、0.6pt 线宽、无 top/right 边框、300dpi、89mm）
  ← DOMAIN（生命医学：开放轴；物理：Times + 内向主次刻度 + 闭合框；经济：横向参考线 …）
  ← JOURNAL（Nature 89/183mm、IEEE 3.5in Times 8pt、Cell 85/174mm …）
  ← SIZE（single/double/wide/narrow/slide/square/golden/custom + 用户 width_mm）
  ← 用户覆盖（palette/cmap/font/grid/legend/ticks/font_size/height_ratio/dpi …）
```

期刊只覆盖它真正规定的东西（画幅、字号、刻度、边框、字体），不强行改变学科的数据表达习惯；用户可任意覆盖任一字段。

### 质检评分

| 检查 | 判定 |
|---|---|
| vector | 请求了 SVG/PDF/EPS 且文件存在 |
| resolution | ≥300 dpi 通过，≥600 标注印刷级 |
| font_size | 最小字号 ≥6pt |
| font_embed | PDF/EPS 使用 Type 42 |
| colorblind | 实际使用颜色的 CVD 模拟最差 ΔE：≥15 通过、≥8 提示、否则警告 |
| legend | 多序列必须有图例 |
| labels | 每个数据轴至少有一个变量/单位标签（饼图等关闭坐标轴的图自动跳过） |
| empty_axes | 不允许空子图 |
| colorbar | 热图类色标需物理量标签 |
| tick_density | 横轴刻度 ≤14 |
| overplot | 数据点 >2 万提示降透明度/换密度表达 |
| layout | 绘图区面积占比 ≥32% |

扣分：fail −18、warn −7、info −1.5；≥92 A、≥82 B、≥70 C。

## 数据契约

- `data.series`：`[{name, x, y, yerr?, xerr?, size?, color?, marker?, categories?}]`
- `data.rows + columns + mapping`：长表；`mapping.x` 为分类列时，展开出的 series 带 `categories`
- `data.matrix + rows + columns`：矩阵（热图/相关矩阵）
- `data.sample`：内置样本 id（Host 直接透传，引擎展开）
- `data.path`：Host 读取 CSV/TSV/JSON 后转成 rows/columns（面板限制在工作区与插件数据目录内；Agent 工具允许任意绝对路径）

## 图种设计原则

1. 先决定这张图在论文里要回答什么问题，再决定视觉编码（例如火山图的三色分组 + 阈值线 + top 基因标注）。
2. 统计量必须真实计算（4PL 拟合、log-rank、AUC/AP、bootstrap CI），不允许装饰性假数据。
3. 注释只标最有信息量的点，标注不压数据、不互压、不出画布。
4. 多面板图必须有 A/B/C 编号、共享轴不重复标签、面板标题短。
5. 颜色只来自色板/色标；以 0 为中心的量必须用发散色标且 0 居中；不允许彩虹色。

## 面板信息架构

- **画廊**：作品列表（缩略图/种类/领域/尺寸/DPI/质检等级）+ 详情（大图缩放、逐项质检、导出、删除、定位、回工作室）。
- **工作室**：数据源 → 图种 → 风格 → 坐标轴与标题 → 输出 → 渲染；右侧预览 + 分数。
- **风格库**：13 学科卡片、16 期刊规格表、色板墙、画幅预设。
- **数据**：样本与工作区文件，字段画像、推荐图种、映射、预览、用它绘图。
- **设置**：引擎状态（解释器/matplotlib/numpy/scipy/CJK 字体）、默认风格、目录、诊断。

视觉上遵循宿主设计系统：只用 `--dsw-alias-*` token 做界面，图表永远白底 + 棋盘格衬底；强调色墨蓝 `#2C5F8A` 与赭红 `#B4552F` 只用在图标与少量 artwork 上。

## 测试策略

- **引擎矩阵**：71 个 kind 各用自己的 demo 渲染 PNG+SVG，断言成功、尺寸、质检分。
- **单元**：色板 CVD/色差、主题解析、spec 归一化、helpers、CJK 渲染、导出文件头。
- **Host**：数据解析、作品库生命周期、服务流水线（fake engine 注入）、HTTP 路由与鉴权。
- **集成**：真实 Python 引擎探测/渲染/错误码；安装后用 HTTP 端点渲染并校验 PNG 签名。
- **视觉**：`read_image` 逐张审图 + 真实桌面 GUI 截图（画廊/工作室/风格库/数据/设置、1024/768 响应式）。

## 扩展一个新图种

1. 在对应族模块写 `@register(...)`，给出中英名、分类、参数 schema、`demo`。
2. 渲染函数只用 `ctx.ax()/ctx.figure()/ctx.color()/ctx.cmap()/ctx.finish()/helpers`。
3. `python -m sciplot.cli selftest --kinds <kind>` 通过且 quality ≥95；`read_image` 看一眼。
4. 如需新样本，在 `engine/samples` 加 `<name>.csv` + `<name>.json`（含 name/domain/mapping/recommended）。
5. 若值得进示例图集，把 spec 加进 `engine/build_demo_catalog.py` 再跑 `node scripts/build-gallery.mjs`。
