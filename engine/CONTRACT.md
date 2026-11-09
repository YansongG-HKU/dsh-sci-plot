# dsh-sci-plot 渲染器开发契约（Renderer contract）

本文件是 `engine/sciplot/renderers/*.py` 的作者指南。所有渲染器共用同一套样式引擎，
**渲染器只描述"画什么"，不决定字体、字号、颜色、边距、画幅**。目标是每一张图都能直接进
Nature / Science / Cell / IEEE / ACS / NEJM 级别的投稿或汇报。

## 0. 环境与自测

```powershell
cd F:\dsh插件创造\workspace\dsh-sci-plot\engine
python -m sciplot.cli selftest --kinds line,volcano --out-dir F:\dsh插件创造\.tmp\st
```

- Python 3.13 / matplotlib 3.11 / numpy 2.5 / scipy 1.18 / Pillow 已安装。
- `selftest` 用每个渲染器的 `demo` 出图；`quality.score` 应 ≥ 95（A），不得有 `ok:false`。
- 用 `read_image` 查看生成的 PNG，肉眼按下面第 6 节的标准检查。**必须看图迭代，不能只看 exit code。**
- 单张渲染耗时目标 < 2 s。

## 1. 文件与写入范围（严禁越界）

| 文件 | 所有者 |
|---|---|
| `sciplot/renderers/basic.py` | Lead（只读） |
| `sciplot/renderers/statistics.py`, `ml.py` | engine-stats |
| `sciplot/renderers/biomedical.py`, `composite.py` | engine-bio |
| `sciplot/renderers/physical.py`, `engineering.py`, `economics.py` | engine-c |
| `engine/samples/*.csv` + `*.json` | 各自新增，文件名加模块前缀，禁止改别人的 |
| 其他共享文件（themes/palettes/context/helpers/registry/spec/cli/export/quality/basic.py） | Lead（只读） |

缺少公共工具时**在本模块内写私有 helper**，不要改 `helpers.py`。

## 2. 注册一个图种

```python
from ..registry import register
from .. import helpers as H
import numpy as np

@register(
    "volcano",                                   # kind id（小写、下划线；别名放 aliases）
    zh="火山图", en="Volcano plot",
    category="biomedical",                       # basic/statistics/biomedical/physical/engineering/economics/ml/composite
    summary_zh="差异表达火山图：以 log2FC 与 -log10(p) 定位显著基因。",
    summary_en="Differential-expression volcano: log2FC vs -log10(p).",
    tags=["差异表达", "DE", "transcriptomics"],
    aspect=0.85,                                 # 可选：覆盖画幅高宽比；方形图写 1.0
    options=[                                    # 会显示为面板上的动态控件
        {"id": "fc_cut", "type": "float", "default": 1.0, "min": 0, "max": 5, "step": 0.1,
         "label_zh": "|log2FC| 阈值", "label_en": "|log2FC| cutoff"},
    ],
    demo={                                       # 必填：selftest / 面板示例都靠它
        "data": {"sample": "volcano_de", "mapping": {"x": "log2fc", "y": "neglog10_p", "label": "gene"}},
        "style": {"domain": "omics", "journal": "nature"},
        "labels": {"x": "log$_2$ fold change", "y": "-log$_{10}$ $P$"},
        "options": {},
    },
    aliases=["volcano_plot"],
)
def render_volcano(ctx):
    ax = ctx.ax()
    ...                                        # 画图
    ctx.finish(ax, legend=True)
    return ctx.fig
```

规则：

- `kind` 全小写，英文单词用下划线（`km_survival`, `bar_grouped`）。
- `category` 必须是上面 8 个之一。
- `options` 的 `type` 只能是 `bool / int / float / enum / string / color`；enum 必须给 `choices`；
  数值必须给 `min/max/step/default`；每个 option 必须有 `label_zh` 与 `label_en`。
- `demo.style` 只写 `domain` / `journal`（可选 palette/cmap），`demo.labels` 必须带变量与单位。
- `demo.data` 优先用 `{"sample": "<id>", "mapping": {...}}`；也可以内联 `series` / `matrix`。
- 渲染器返回 `ctx.fig` 或 `None`。

## 3. Ctx API（只允许用这些）

```python
ctx.ax()                     # 默认 1×1 主坐标轴；也可以 ctx.ax(i)
ctx.figure(nrows, ncols, height_ratios=[...], width_ratios=[...], sharex=True, sharey=True)
                             # 多子图；返回 (fig, axes[nrows*ncols] 展平列表)
ctx.color(i)                 # 分类色板第 i 色（记录用于色盲质检），优先使用
ctx.colors(n)                # 返回 n 个色
ctx.cmap(name=None)          # 顺序/发散色标；默认取预设
ctx.diverging_cmap()         # 发散色标（用于以 0 为中心的图）
ctx.series(mapping=None)     # 归一化后的序列 list[{name,x,y,yerr,xerr,size,categories,...}]
ctx.table                    # Data 对象：.columns / .mapping / .matrix / .numeric(name) / .categorical(name) / .unique(name)
ctx.label("x")               # 读 labels；ctx.labels['y'] = "..." 可补默认标签
ctx.opt("bins", 40)          # 读 options；ctx.flag("show") / ctx.num("alpha", 0.8)
ctx.rng                      # 固定种子的 numpy Generator（抖动、采样必须用它，保证可复现）
ctx.warn("...")              # 记录提示（会进入质检报告）
ctx.style                    # 解析后的样式 dict（只读）：["rc"], ["palette"], ["cmap"], ["ticks"], ["grid"], ["line"], ["errorbar"], ["width_mm"]
ctx.finish(ax, xlabel=None, ylabel=None, legend=True|dict|False, grid=None,
           xlim=None, ylim=None, xscale=None, yscale=None, colorbar_label=None, x_rotate=None)
                             # 应用刻度/边框/网格/标题/图例/坐标轴标签 —— 每个 axes 只调一次
ctx.style_axes(ax)           # 只想套样式、不设标签时
ctx.legend(ax, title=..., loc=..., ncol=..., outside=True)
ctx.colorbar(mappable, ax, label="...", fraction=0.05, pad=0.03)
ctx.panel_label(ax, "A")     # 复合图子图编号（粗体 9 pt）
ctx.add_title()              # finish() 已调用；额外调用安全
ctx.text_on(facecolor)       # 返回黑/白，用在高对比文字
```

**禁止**：`import matplotlib.pyplot as plt`、`plt.savefig`、`plt.subplots`、修改 `mpl.rcParams`、
硬编码颜色/字号/线宽/figsize、`fig.savefig`、`ax.set_facecolor`、修改共享文件。

## 4. helpers（`from .. import helpers as H`）

`clean_xy`, `finite`, `stars`, `format_p`, `nice_limits`, `jitter`, `smooth`, `rolling_mean`,
`kde_1d`, `hist_density`, `ecdf`, `fit_linear`, `bootstrap_fit_ci`, `bootstrap_ci`, `pearson`,
`corr_matrix`, `welch_p`, `mannwhitney_p`, `anova_p`, `draw_significance`, `panel_letter`,
`corner_note`, `value_labels`, `normalize_rows`, `squash`, `break_axis`.

自定义计算（PCA、聚类、生存曲线等）在模块内实现；scipy 可用但必须 `try/except` 降级。

## 5. 数据契约速查

- `data.series`: `[{name,x,y,yerr?,xerr?,size?,color?,marker?,categories?}]`
- `data.rows + data.columns + data.mapping`: 长表；`mapping` 可含
  `x,y,group,yerr,xerr,size,label,time,event,row,col,value,p,fc,...`
  `mapping.x` 为分类列时，构建出的 series 会带 `categories`。
- `data.matrix + rows + columns`: 矩阵（热图/相关矩阵）。
- `data.sample`: 内置样本 id（引擎自动展开成 rows+columns）。
- `data.mode`: `series | table | matrix`（`ctx.table.mode`）。

## 6. 顶刊级外观标准（验收硬门槛）

1. **坐标轴**：变量名 + 单位（`Time (h)`、`OD$_{600}$`、`-log$_{10}$ $P$`）；数学用 mathtext；
   对数轴用 `xscale/yscale="log"`；不写单位就 `ctx.warn`。
2. **颜色**：只用 `ctx.color(i)` / `ctx.cmap()`；显著性/分组配色要可区分（色盲安全）；
   连续量用感知均匀色标；以 0 为中心的量（logFC、z-score、残差）用发散色标且 0 居中。
3. **图例**：多序列必须给图例；图例不加边框；顺序与数据一致；必要时 `outside=True`。
4. **留白与密度**：不要出现大片空白或元素互相遮挡；长标签自动旋转/换行；
   文字不压数据点；参考线用浅灰细虚线（`#9A9A9A`, lw 0.6, ls "--"）。
5. **统计表达**：误差用误差棒/带；显著性括号放数据上方；p 值格式用 `H.format_p`；
   n 值、检验方法、R² 等放角落注释（`H.corner_note`）；不要编造统计量。
6. **子图**：多面板用 `ctx.panel_label(ax, "A")`；共享轴时不要重复标签。
7. **注释**：只标注最有信息量的点（如 top-5 gene、阈值线）；注释不得互相重叠。
8. **可复现**：所有随机数走 `ctx.rng`，禁止 `np.random.*` 全局调用。

## 7. 各图种必须具备的专业元素（摘要）

- **火山图**：两条 FC 阈值竖线 + 一条 p 阈值横线（虚线）、上调/下调/不显著三组配色、
  top 基因文字标注（引线不遮点）、图例计数。
- **MA 图**：M–A 散点 + 阈值线 + 上调/下调配色。
- **曼哈顿图**：染色体交替双色、-log10p 轴、显著性阈值线、top 位点标注、染色体刻度稀疏。
- **KM 生存曲线**：阶梯曲线、删失刻度、主图下方风险人数表、log-rank p、图例分组。
- **森林图**：点估计 + 95% CI 横线、无效线（OR=1/HR=1）、权重/分组行、坐标轴 log 可选。
- **ROC/PR**：对角线/基线、AUC/AP 标注、阶梯或平滑曲线、图例。
- **校准曲线**：理想线 y=x、分组折线、误差棒。
- **Bland–Altman**：均值差横线、±1.96 SD 虚线、散点。
- **剂量-响应**：实测点 + 4PL 拟合曲线 + 95% 置信带 + EC50 标注（log x）。
- **聚类热图**：行列树状图、色标居中 0、行列标签、可选 z-score 标准化。
- **PCA/t-SNE**：主图散点分组 + 椭圆/质心、轴解释方差百分比、图例。
- **dot plot / GSEA 棒图**：点大小/颜色双编码、图例、排序。
- **谱图（FTIR/UV-Vis/Raman）**：峰位标注、可选反向波数轴、多曲线偏移或归一化。
- **XRD**：堆叠谱线、2θ 轴、特征峰标注、可选参考卡片竖线。
- **CV**：闭合回线、扫描方向箭头、电位/电流轴。
- **TGA/DSC**：双 y 轴（失重 % / 热流）、温度轴、拐点标注。
- **等值线/热图**：色标 + 物理量标签、层数/等高线标签合理、网格与地形配色。
- **3D 表面/散点**：视角、色标、投影、光照克制；避免彩虹色。
- **极坐标/风玫瑰**：角度方向、径向刻度、频率图例。
- **Taylor 图**：相关角、RMSD 同心圆、参考点。
- **Bode/Nyquist/PSD**：log 轴、相位子图、网格、单位。
- **波形/控制图/帕累托**：多通道偏移、UCL/LCL、累计贡献线。
- **时间序列/扇形图**：置信带、参考线、衰退区间可选项。
- **瀑布图/龙卷风图/漏斗图**：累计连接、正负色、排序、基线。
- **训练曲线/混淆矩阵/特征重要性**：均值±SD 多 seed、归一化混淆矩阵、排序棒图。
- **复合图**：`panels` 由 Lead 负责协议；本模块只做 `multi_panel`（行/列布局 + 子图编号）。

## 8. 交付

完成后在回复中给出：实现的 kind 列表（含 category）、`selftest` 通过数与最低 quality、
新增样本文件名、已知限制。不要写长报告。
