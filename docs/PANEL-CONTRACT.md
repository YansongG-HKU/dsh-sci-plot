# dsh-sci-plot 面板（Client UI）开发契约

目标：在 DSH Web GUI 里交付一块「科研绘图」工作区：左侧图标进入、主区域全宽面板，
可以浏览作品、用表单出图、浏览学科/期刊风格库、查看数据与引擎状态。视觉必须与宿主
设计系统一致，专业、克制、有编辑感；**不是**一张堆卡片的 AI dashboard。

## 1. 文件与写入范围

| 文件 | 说明 |
|---|---|
| `src/client/00-head.js` … `NN-apply.js` | 分片源码（推荐按功能拆 4–7 个文件，按文件名排序拼接） |
| `scripts/build-client.mjs` | 读取 `src/client/*.js` 按序拼接写 `client.js`，支持 `--check` |
| `client.js` | 构建产物（提交到仓库；`node --check client.js` 必须通过） |
| `test/unit/client.test.mjs` | 纯函数/工具函数单元测试（可选但推荐） |

**不要修改**：`lib/**`、`engine/**`、`package.json`、`cordis.patch.yml`、`locale/**`（这些由 Lead 负责）。
不要 import 任何 `@deepseek-ai/dsh-client-*` 包；React 只从 `require("react")` 取。

## 2. 模块格式（必须与现有插件一致）

```js
window.__ModuleLoader__.load({
  id: "dsh-sci-plot",
  factory: (require) => {
    const react = require("react")
    const h = react.createElement
    // ... 组件
    return {
      inject: ["slots", "locale", "layout"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), "dsh-sci-plot: dictionaries")
        const t = ctx.locale.bind(NS)
        ctx.slots.inject("sidebar.panellist", () => ctx.slots.register(
          { name: "sidebar.panellist", id: NS, order: 25,
            label: () => t("panel"), locale: NS },
          (props) => h(SciPlotMark, { size: props && props.size || 20 }),
        ))
        ctx.slots.inject("main", () => ctx.slots.register(
          { name: "main", key: NS, locale: NS },
          (slotProps) => h(SciPlotPanel, { t: slotProps && slotProps.t || t, layout: ctx.layout }),
        ))
      },
      __test__: { /* 纯函数，供 node 单测 */ },
    }
  },
})
```

图标可以是内联 SVG 组件（自己画：坐标轴 + 一条数据曲线 + 一个数据点，单色 `currentColor`，
在 20px 下清晰）。不要用 emoji。语言切换中/英（默认跟随浏览器/宿主 locale，可手动切换并存
localStorage）。

## 3. Host API（以 `/dsh-sci-plot` 为前缀）

所有 `fetch` 都带请求头 `x-dsh-sci-plot: 1`，响应统一：

- 成功：`{ "ok": true, "data": ... }`
- 失败：`{ "ok": false, "code": "invalid_input|not_found|no_engine|render_failed|...", "error": "用户可读原因" }`

图片/文件 URL 不需要请求头（`<img src>` 直接用）。

| 方法与路径 | 请求 | 成功返回 `data` |
|---|---|---|
| `GET /api/state` | – | `{ figures, capabilities, datasets, settings, engine, gallery, paths }` |
| `GET /api/capabilities` | – | `{ kinds:[{id,name_zh,name_en,kinds:[...]}], themes:{domains,journals,sizes,fonts}, palettes:{categorical,continuous}, samples, spec, version }` |
| `GET /api/figures` | – | `{ figures: [...] }`（最近 60 张） |
| `GET /api/figures/:id` | – | `{ figure }`（含 spec/quality/files） |
| `POST /api/render` | `{ spec, title? }` | `{ figure }`，通常 1–3 s |
| `POST /api/figures/:id/export` | `{ formats:["png","svg","pdf","tiff"], dpi?, width_mm?, journal? }` | `{ figure }` |
| `POST /api/figures/:id/delete` | `{}` | `{ deleted: true }` |
| `POST /api/figures/:id/reveal` | `{}` | `{ revealed: true }` |
| `GET /api/figures/:id/file?format=png&variant=full\|thumb` | – | 二进制（png/svg/pdf/eps/tiff） |
| `GET /api/datasets` | – | `{ samples:[...], workspace:[...] }` |
| `POST /api/datasets/preview` | `{ path }` | `{ columns:[{name,kind}], rows:[{...}], total, profile:[...] }` |
| `POST /api/validate` | `{ spec }` | `{ kind, style, issues, options }` |
| `GET /api/settings` | – | `{ settings }` |
| `POST /api/settings` | `{ patch }` | `{ settings }` |
| `POST /api/engine/refresh` | `{}` | `{ engine }` |
| `GET /api/diagnostics` | – | `{ engine, pythonCandidates, dataDir, figureCount }` |
| `GET /api/gallery` | – | `{ gallery:[...] }` |
| `GET /api/assets/gallery/:name` | – | 图片二进制 |

### 数据模型

```ts
type Figure = {
  id: string; title: string; kind: string; kindNameZh: string; kindNameEn: string;
  domain: string; domainNameZh: string; journal: string | null;
  palette: string; widthMm: number; heightMm: number; dpi: number;
  formats: string[]; createdAt: string;
  quality: { score: number; grade: "A"|"B"|"C"|"D"; checks: {id,status,message_zh,message_en}[];
             counts: {pass:number,warn:number,fail:number,info:number}; summary_zh: string };
  warnings: string[];
  pngUrl: string;   // /dsh-sci-plot/api/figures/<id>/file?format=png&variant=full
  thumbUrl: string; // ...variant=thumb
  spec: object;     // 可回填到工作室
  durationMs: number;
};

type Capabilities = {
  version: string;
  kinds: { id: string; name_zh: string; name_en: string; kinds: Kind[] }[];
  themes: {
    domains: { id,name_zh,name_en,description_zh,description_en,palette,cmap,font,recommended:string[] }[];
    journals: { id,name_zh,name_en,widths:Record<string,number>,font,palette,note_zh,note_en }[];
    sizes:    { id,name_zh,name_en,width_mm,note_zh,note_en }[];
    fonts:    { id,name_zh,name_en,latin:string[],cjk:string[],available:boolean }[];
  };
  palettes: {
    categorical: { id,name_zh,name_en,colors:string[],source,cvd_safe,cvd_min_delta_e,cvd_level }[];
    continuous:  { id,name_zh,name_en,kind:"sequential"|"diverging"|"cyclic",stops:string[],source }[];
  };
  samples: Sample[];
  spec: { formats:string[]; data_modes:string[]; mapping_keys:string[]; style_keys:string[] };
};

type Kind = { kind:string; name_zh:string; name_en:string; category:string;
  summary_zh:string; summary_en:string; tags:string[];
  options: Option[]; demo?: object };
type Option = { id:string; type:"bool"|"int"|"float"|"enum"|"string"|"color";
  default:any; label_zh:string; label_en:string; min?:number; max?:number; step?:number;
  choices?:string[] };
type Sample = { id:string; name_zh:string; name_en:string; domain:string; rows:number;
  columns:{name:string,kind:string}[]; description_zh:string; description_en:string;
  mapping:object; recommended:{kind:string,style?:object}[] };

type Settings = { defaultDomain:string; defaultJournal:string; defaultPalette:string;
  defaultFont:string; defaultSize:string; defaultDpi:number; lang:"zh"|"en" };
```

`spec` 结构（渲染请求体）：

```json
{
  "kind": "line",
  "data": { "sample": "growth", "mapping": {"x":"time_h","y":"od600","group":"condition"} }
      或 { "path": "F:/data.csv", "mapping": {...} }
      或 { "series": [{ "name":"A","x":[...],"y":[...] }] }
      或 { "matrix": [[...]], "rows": ["r1"], "columns": ["c1"] },
  "style": { "domain":"life-science", "journal":"nature", "palette":"okabe-ito",
             "cmap":"viridis", "font":"arial", "size":"single", "dpi":300,
             "grid":false, "legend":true, "transparent":false,
             "width_mm":89, "height_ratio":0.75 },
  "labels": { "x":"Time (h)", "y":"OD$_{600}$", "title":"", "colorbar":"" },
  "options": { "marker": true, "smooth": 0 },
  "output": { "formats":["png","svg","pdf"], "basename":"fig1" }
}
```

## 4. 信息架构与交互

整体：顶部一条 44–52px 工具条（品牌/名称 + 当前状态 + 语言 + 刷新），下面是主工作区。
默认进入「画廊」，左侧为 240–300px 的控制/筛选列（或 tabs 导航），右侧内容区可滚动。
在宽度 < 900px 时导航变顶部横向、内容单列。

五个标签页：

1. **画廊**：最近作品网格（缩略图卡：白底、1px 边框、悬停抬升；底部两行元数据：kind/domain、
   日期、尺寸、quality 徽标）。筛选：kind 分类、domain。点击 → 详情视图：大图区（棋盘格底、
   适合 300dpi 图的居中显示、可滚轮缩放或点击全屏）、右侧信息栏（标题/kind/风格/尺寸/dpi、
   quality 分数与逐项 checklist、导出 PNG/SVG/PDF/TIFF、删除、在文件夹中显示、复制路径、
   回到工作室继续调参）。
2. **工作室**：两栏：左 340–380px 表单（数据源/图种/风格/标签/选项/渲染按钮），右侧实时预览。
   数据源：内置样本（按 domain 分组）+ 工作区 CSV（`datasets.workspace`）+ 粘贴数据（JSON）。
   图种：按 category 分组的可搜索列表（显示 name_zh + 摘要）；选中后渲染动态 options 控件
   （bool→switch，enum→select，int/float→slider+数字，string→input）。风格：domain、journal、
   palette（色块条 + CVD 徽标）、cmap（渐变色条）、font、size、dpi、grid/legend/transparent。
   标签：x/y/title/colorbar。渲染后右侧显示图 + quality 分数 + "已保存到画廊" 提示。
3. **风格库**：domain 卡片（名称/描述/推荐图种 chips/默认配色条），journal 表格（名称/单双栏宽度/
   字体/说明），palette 两栏：分类色板（8 色色块 + CVD 徽标 + 来源）与连续色标（渐变条），
   size 预设卡片（单栏/双栏/宽/幻灯片等宽度示意）。
4. **数据**：样本数据集（domain 分组、行数/列数、列类型、预览表 5 行、"用它绘图"按钮）；
   工作区数据文件列表（路径/行数/列、"预览"/"用它绘图"）；顶部刷新按钮。
5. **设置**：引擎状态（可用/不可用、python 路径、matplotlib/scipy 版本、CJK 字体、刷新引擎）、
   默认风格（domain/journal/palette/font/size/dpi，保存到 API）、数据目录/画廊资源路径+打开按钮、
   诊断信息。

通用要求：加载 skeleton、空状态（带"加载示例"引导）、错误状态（显示 API 的 error + 重试）、
toast（成功/失败）、按钮 disabled 状态、渲染中 spinner/进度、所有可点击元素有 hover/focus 样式，
操作可键盘完成。语言切换即时生效。不要使用 emoji；文案用真实科学语言。

## 5. 视觉规范

- 仅使用宿主主题 token：`--dsw-alias-bg-base|bg-layer-1|bg-layer-2|border-l1|border-l2|label-primary|label-secondary|label-tertiary|brand-primary|radius-md|radius-lg|shadow-lv1` 等；图表高光/装饰可用固定色（如 `#2C5F8A` 墨蓝、`#B4552F` 赭红、`#111111` 墨色）作为 artwork。
- 排版：标题 17–20px/600，节标题 12px/600 带 letter-spacing .02em，正文 12.5–13px，
  元数据 11px 且 `font-variant-numeric: tabular-nums`，等宽数字用于尺寸/评分/时间。
- 布局：8px 间距体系；面板卡 1px 边框 + 10–12px 圆角；不使用大面积渐变、不堆叠阴影、
  不使用紫蓝渐变；图形本身永远是视觉主体。
- 图预览底：浅色 `#FFFFFF` 卡片 + 细网格/棋盘（用 CSS conic-gradient 做 12px 棋盘，
  在深色主题下也能看清白底图）。
- Quality 徽标：A=绿、B=蓝、C=琥珀、D=红；CVD 徽标：safe=绿点，否则琥珀点。
- 响应式断点：1440 / 1024 / 768 / 375；375 下全部单列、控件全宽、图预览横向滚动或缩放适配。

## 6. 验收（Lead 会跑）

- `node --check client.js` 通过；`node scripts/build-client.mjs --check` 通过（产物与分片一致）。
- 安装后在 sidebar 出现「科研绘图」图标，点击进入面板；无 console error / slot crash。
- 画廊能显示示例图；工作室能选样本 → 选图种 → 渲染 → 出现图并可导出；切换中/英正常；
  深色/浅色主题下文字与边框可读；1440/768/375 三档截图正常；空数据/API 错误有兜底。
- 不出现 `@deepseek-ai/dsh-client-*` import、`document.body` 直插、`iframe`。

## 7. 交付

回复（简短）：文件列表、构建命令与产物大小、实现了哪些视图/交互、已知限制。
