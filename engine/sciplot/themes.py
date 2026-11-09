"""The design system of dsh-sci-plot: base manuscript style, domain presets,
journal presets, figure size presets and style resolution.

Priority: base < domain < journal < size < explicit user overrides.
A resolved style is a plain dict consumed by :mod:`sciplot.context`.
"""
from __future__ import annotations

from . import fonts

MM_PER_INCH = 25.4

# ---------------------------------------------------------------------------
# Base style: a clean, print-first default that every preset refines.
# ---------------------------------------------------------------------------

BASE = {
    "font": "arial",
    "rc": {
        "font.size": 7.0,
        "axes.titlesize": 8.0,
        "axes.titleweight": "normal",
        "axes.labelsize": 7.5,
        "axes.labelpad": 2.5,
        "axes.linewidth": 0.6,
        "axes.edgecolor": "#111111",
        "axes.labelcolor": "#111111",
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.spines.left": True,
        "axes.spines.bottom": True,
        "axes.grid": False,
        "axes.axisbelow": True,
        "axes.formatter.use_mathtext": True,
        "axes.formatter.limits": (-3, 4),
        "axes.formatter.useoffset": True,
        "axes.unicode_minus": False,
        "xtick.labelsize": 6.5,
        "ytick.labelsize": 6.5,
        "xtick.direction": "out",
        "ytick.direction": "out",
        "xtick.major.size": 3.0,
        "ytick.major.size": 3.0,
        "xtick.major.width": 0.6,
        "ytick.major.width": 0.6,
        "xtick.minor.size": 1.6,
        "ytick.minor.size": 1.6,
        "xtick.minor.width": 0.5,
        "ytick.minor.width": 0.5,
        "xtick.top": False,
        "ytick.right": False,
        "xtick.color": "#111111",
        "ytick.color": "#111111",
        "legend.fontsize": 6.5,
        "legend.title_fontsize": 7.0,
        "legend.frameon": False,
        "legend.handlelength": 1.7,
        "legend.handletextpad": 0.45,
        "legend.labelspacing": 0.32,
        "legend.borderaxespad": 0.25,
        "legend.columnspacing": 0.9,
        "legend.numpoints": 1,
        "legend.scatterpoints": 1,
        "figure.titlesize": 8.5,
        "figure.dpi": 150,
        "savefig.dpi": 300,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.02,
        "lines.linewidth": 1.1,
        "lines.markersize": 3.2,
        "lines.markeredgewidth": 0.7,
        "lines.solid_capstyle": "round",
        "lines.dash_capstyle": "round",
        "patch.linewidth": 0.6,
        "patch.edgecolor": "#111111",
        "patch.facecolor": "#ffffff",
        "errorbar.capsize": 2.2,
        "errorbar.elinewidth": 0.8,
        "errorbar.capthick": 0.8,
        "grid.color": "#E4E4E4",
        "grid.linewidth": 0.5,
        "grid.linestyle": "-",
        "grid.alpha": 1.0,
        "text.color": "#111111",
        "figure.facecolor": "#ffffff",
        "axes.facecolor": "#ffffff",
        "mathtext.fontset": "stixsans",
        "mathtext.default": "regular",
        "hatch.linewidth": 0.5,
        "hist.bins": "auto",
    },
    "spines": ("left", "bottom"),
    "ticks": "out",
    "minor": False,
    "grid": {"show": False, "axis": "both", "which": "major", "linestyle": "-", "color": "#E4E4E4", "linewidth": 0.5, "alpha": 1.0},
    "palette": "okabe-ito",
    "cmap": "viridis",
    "diverging_cmap": "rdbu",
    "line": {"lw": 1.1, "ms": 3.2, "marker": "o", "mew": 0.7, "alpha": 1.0},
    "errorbar": {"capsize": 2.2, "elinewidth": 0.8, "capthick": 0.8},
    "legend": {"frameon": False, "loc": "best"},
    "figure": {"width_mm": 89.0, "height_ratio": 0.75, "dpi": 300},
    "text": "#111111",
    "axes_face": "#ffffff",
    "figure_face": "#ffffff",
}

# ---------------------------------------------------------------------------
# Domain presets: how a discipline draws.
# ---------------------------------------------------------------------------

DOMAINS = {
    "general": {
        "name_zh": "通用科研",
        "name_en": "General science",
        "description_zh": "中性、克制的默认风格，适用于交叉学科与快速出图。",
        "description_en": "Neutral, restrained default for interdisciplinary or quick figures.",
        "recommended": ["line", "scatter", "bar", "bar_grouped", "box", "violin", "histogram", "heatmap", "errorbar", "regression"],
    },
    "life-science": {
        "name_zh": "生命医学",
        "name_en": "Life sciences",
        "description_zh": "开放式坐标轴、细线小标记、色盲友好配色，贴近 Nature/Cell 生命科学图版。",
        "description_en": "Open axes, fine lines, small markers and CVD-safe colours, close to Nature/Cell life-science figures.",
        "font": "arial",
        "palette": "okabe-ito",
        "cmap": "viridis",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "minor": False,
        "grid": {"show": False},
        "line": {"lw": 1.05, "ms": 2.9, "marker": "o"},
        "figure": {"height_ratio": 0.72},
        "recommended": ["line", "multiline", "scatter", "bar", "bar_grouped", "box", "violin", "raincloud", "volcano", "km_survival", "roc", "forest", "cluster_heatmap", "dose_response"],
    },
    "clinical": {
        "name_zh": "临床医学",
        "name_en": "Clinical medicine",
        "description_zh": "NEJM/Lancet 式临床图：清晰的时间-事件曲线、森林图与校准曲线，字号偏大易读。",
        "description_en": "NEJM/Lancet-style clinical figures: legible survival, forest and calibration plots.",
        "palette": "nejm",
        "cmap": "viridis",
        "line": {"lw": 1.25, "ms": 3.4},
        "figure": {"height_ratio": 0.8},
        "recommended": ["km_survival", "forest", "roc", "pr_curve", "calibration", "bland_altman", "bar_grouped", "box", "errorbar"],
    },
    "omics": {
        "name_zh": "组学",
        "name_en": "Omics",
        "description_zh": "高通量数据：火山图、聚类热图、降维散点，感知均匀色标与紧凑标注。",
        "description_en": "High-throughput data: volcano, clustered heatmaps, embeddings, perceptually uniform maps.",
        "palette": "tol-bright",
        "cmap": "viridis",
        "figure": {"height_ratio": 0.8},
        "recommended": ["volcano", "ma", "manhattan", "cluster_heatmap", "pca", "tsne", "dot_plot", "gsea_bar", "violin", "heatmap"],
    },
    "chemistry": {
        "name_zh": "化学",
        "name_en": "Chemistry",
        "description_zh": "ACS/RSC 风格：闭合坐标框、内向刻度、柔和配色，适配光谱、伏安与热分析曲线。",
        "description_en": "ACS/RSC feel: boxed axes, inward ticks, muted palette for spectra, voltammetry and thermal analysis.",
        "palette": "tol-muted",
        "cmap": "viridis",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "minor": True,
        "grid": {"show": False},
        "figure": {"height_ratio": 0.78},
        "recommended": ["spectra", "cv", "xrd", "tga", "bar", "regression", "contour", "heatmap", "scatter", "errorbar"],
    },
    "materials": {
        "name_zh": "材料",
        "name_en": "Materials science",
        "description_zh": "材料物理风格：完整边框、主次刻度、相位图与 3D 表面，突出结构-性能关系。",
        "description_en": "Materials-physics style: full frame, major/minor ticks, phase maps and 3D surfaces.",
        "palette": "tol-muted",
        "cmap": "vik",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "minor": True,
        "grid": {"show": False},
        "figure": {"height_ratio": 0.8},
        "recommended": ["xrd", "spectra", "tga", "contour", "surface3d", "scatter3d", "bar", "heatmap", "line", "errorbar"],
    },
    "physics": {
        "name_zh": "物理",
        "name_en": "Physics",
        "description_zh": "APS/PRL 风格：Times 字体、内向主次刻度、闭合边框，强调误差棒与解析曲线。",
        "description_en": "APS/PRL style: Times text, inward major/minor ticks, boxed frame, error bars and theory curves.",
        "font": "times",
        "palette": "tol-muted",
        "cmap": "magma",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "minor": True,
        "grid": {"show": False},
        "line": {"lw": 1.15, "ms": 2.8},
        "figure": {"height_ratio": 0.78},
        "recommended": ["line", "scatter", "errorbar", "spectra", "contour", "surface3d", "polar", "taylor", "density", "histogram"],
    },
    "engineering": {
        "name_zh": "工程与信号",
        "name_en": "Engineering & signals",
        "description_zh": "IEEE 工程风格：浅色网格、闭合边框、内向刻度，适配 Bode/Nyquist/PSD 与波形图。",
        "description_en": "IEEE engineering style: light grid, boxed frame, inward ticks for Bode/Nyquist/PSD and waveforms.",
        "font": "arial",
        "palette": "tol-bright",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "minor": False,
        "grid": {"show": True, "axis": "both", "linestyle": "--", "color": "#D9D9D9", "linewidth": 0.5},
        "figure": {"height_ratio": 0.72},
        "recommended": ["bode", "nyquist", "psd", "waveform", "control_chart", "pareto", "errorbar", "line", "bar", "scatter"],
    },
    "earth": {
        "name_zh": "地球与环境",
        "name_en": "Earth & environment",
        "description_zh": "AGU 风格：坐标框、方向性网格、大地色系，适配等值线、风玫瑰与时间序列。",
        "description_en": "AGU style: framed axes, directional grid, earth tones for contours, wind roses and time series.",
        "palette": "earth",
        "cmap": "ylgnbu",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "minor": False,
        "grid": {"show": True, "axis": "both", "linestyle": "-", "color": "#DCE3E6", "linewidth": 0.5},
        "figure": {"height_ratio": 0.7},
        "recommended": ["contour", "heatmap", "windrose", "time_series", "scatter", "bar", "line", "density"],
    },
    "economics": {
        "name_zh": "经济金融",
        "name_en": "Economics & finance",
        "description_zh": "AER 风格：Times、仅横向参考线、开放式坐标轴，适配时间序列、扇形图与瀑布图。",
        "description_en": "AER style: Times, horizontal reference lines, open axes for time series, fan charts and waterfalls.",
        "font": "times",
        "palette": "tol-muted",
        "cmap": "blues",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": True, "axis": "y", "linestyle": "-", "color": "#E2E2E2", "linewidth": 0.6},
        "line": {"lw": 1.3, "ms": 3.0},
        "figure": {"height_ratio": 0.66},
        "recommended": ["time_series", "fan_chart", "waterfall", "tornado", "funnel", "line", "bar_grouped", "scatter", "area_stacked", "bar"],
    },
    "social": {
        "name_zh": "心理与社科",
        "name_en": "Psychology & social science",
        "description_zh": "APA 风格：无网格、低饱和配色、清晰组间对比，适配分组柱、箱线与相关矩阵。",
        "description_en": "APA style: no grid, low-saturation colours, clear group contrasts for grouped bars, boxes and correlations.",
        "palette": "tol-muted",
        "ticks": "out",
        "grid": {"show": False},
        "figure": {"height_ratio": 0.72},
        "recommended": ["bar_grouped", "bar", "box", "violin", "raincloud", "corr_heatmap", "ridge", "scatter", "regression", "likert"],
    },
    "ml": {
        "name_zh": "计算机与 AI",
        "name_en": "Computer science & AI",
        "description_zh": "NeurIPS 风格：清爽网格、稍粗曲线与较大标记，适配训练曲线、混淆矩阵与降维图。",
        "description_en": "NeurIPS style: light grid, slightly heavier curves and markers for training curves, confusion matrices and embeddings.",
        "palette": "tol-bright",
        "cmap": "viridis",
        "ticks": "out",
        "grid": {"show": True, "axis": "both", "linestyle": "-", "color": "#E8E8E8", "linewidth": 0.5},
        "line": {"lw": 1.4, "ms": 3.6},
        "figure": {"height_ratio": 0.68},
        "recommended": ["training_curves", "confusion_matrix", "roc", "pr", "feature_importance", "embedding", "box", "line", "bar", "scatter"],
    },
    "math": {
        "name_zh": "数学与统计",
        "name_en": "Mathematics & statistics",
        "description_zh": "极简数学排版：Times/STIX 公式、闭合边框、克制留白，适配分布、QQ 与收敛曲线。",
        "description_en": "Minimal mathematical typesetting: Times/STIX math, boxed frame, restrained whitespace for distributions, QQ and convergence.",
        "font": "times",
        "palette": "tol-muted",
        "cmap": "viridis",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "minor": True,
        "grid": {"show": False},
        "figure": {"height_ratio": 0.78},
        "recommended": ["density", "histogram", "qq", "ecdf", "line", "contour", "surface3d", "heatmap", "scatter", "corr_heatmap"],
    },
}

# ---------------------------------------------------------------------------
# Journal presets: geometry and typography of real author guidelines (mm).
# ---------------------------------------------------------------------------

JOURNALS = {
    "nature": {
        "name_zh": "Nature",
        "name_en": "Nature",
        "widths": {"single": 89.0, "double": 183.0},
        "font": "arial",
        "palette": "npg",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "rc": {"font.size": 7.0, "axes.labelsize": 7.5, "axes.titlesize": 8.0, "legend.fontsize": 6.5, "xtick.labelsize": 6.5, "ytick.labelsize": 6.5},
        "figure": {"height_ratio": 0.75},
        "note_zh": "单栏 89 mm / 双栏 183 mm，7–8 pt 无衬线字，开放坐标轴。",
        "note_en": "89 mm single / 183 mm double column, 7–8 pt sans-serif, open axes.",
    },
    "science": {
        "name_zh": "Science",
        "name_en": "Science",
        "widths": {"narrow": 55.0, "single": 120.0, "double": 183.0},
        "font": "arial",
        "palette": "science",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "figure": {"height_ratio": 0.72},
        "note_zh": "1 栏 55 mm / 2 栏 120 mm / 3 栏 183 mm，Helvetica 系 7 pt。",
        "note_en": "55 mm one column / 120 mm two / 183 mm three, Helvetica-like 7 pt.",
    },
    "cell": {
        "name_zh": "Cell",
        "name_en": "Cell",
        "widths": {"single": 85.0, "double": 174.0},
        "font": "arial",
        "palette": "npg",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "figure": {"height_ratio": 0.76},
        "note_zh": "单栏 85 mm / 双栏 174 mm，6–8 pt Arial，常用完整边框。",
        "note_en": "85 mm single / 174 mm double, 6–8 pt Arial, often boxed.",
    },
    "nejm": {
        "name_zh": "NEJM",
        "name_en": "NEJM",
        "widths": {"single": 86.0, "double": 178.0},
        "font": "arial",
        "palette": "nejm",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "rc": {"font.size": 7.5, "axes.labelsize": 8.0, "legend.fontsize": 7.0},
        "figure": {"height_ratio": 0.8},
        "note_zh": "单栏 86 mm / 双栏 178 mm，7–8 pt，临床可读性优先。",
        "note_en": "86 mm single / 178 mm double, 7–8 pt, clinical legibility first.",
    },
    "lancet": {
        "name_zh": "The Lancet",
        "name_en": "The Lancet",
        "widths": {"single": 90.0, "double": 190.0},
        "font": "arial",
        "palette": "lancet",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "rc": {"font.size": 7.5, "axes.labelsize": 8.0},
        "figure": {"height_ratio": 0.8},
        "note_zh": "单栏 90 mm / 双栏 190 mm，实用主义临床版式。",
        "note_en": "90 mm single / 190 mm double, pragmatic clinical layout.",
    },
    "jama": {
        "name_zh": "JAMA",
        "name_en": "JAMA",
        "widths": {"single": 86.0, "double": 178.0},
        "font": "arial",
        "palette": "jama",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "rc": {"font.size": 7.5, "axes.labelsize": 8.0},
        "note_zh": "单栏 86 mm / 双栏 178 mm，7 pt 起，图形语言简练。",
        "note_en": "86 mm single / 178 mm double, 7 pt and up, terse graphic language.",
    },
    "pnas": {
        "name_zh": "PNAS",
        "name_en": "PNAS",
        "widths": {"single": 87.0, "double": 178.0},
        "font": "arial",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "note_zh": "单栏 87 mm / 双栏 178 mm，6–8 pt。",
        "note_en": "87 mm single / 178 mm double, 6–8 pt.",
    },
    "ieee": {
        "name_zh": "IEEE",
        "name_en": "IEEE",
        "widths": {"single": 88.9, "double": 181.0},
        "font": "times",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "grid": {"show": True, "axis": "both", "linestyle": "--", "color": "#D9D9D9", "linewidth": 0.5},
        "rc": {"font.size": 8.0, "axes.labelsize": 8.0, "legend.fontsize": 7.0, "xtick.labelsize": 7.5, "ytick.labelsize": 7.5},
        "figure": {"height_ratio": 0.72},
        "note_zh": "3.5 in（88.9 mm）/ 7.16 in（181 mm），8 pt Times，内向刻度。",
        "note_en": "3.5 in (88.9 mm) / 7.16 in (181 mm), 8 pt Times, inward ticks.",
    },
    "acs": {
        "name_zh": "ACS",
        "name_en": "ACS",
        "widths": {"single": 82.6, "double": 177.8},
        "font": "arial",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "grid": {"show": False},
        "rc": {"font.size": 7.5, "axes.labelsize": 7.5, "legend.fontsize": 6.5},
        "figure": {"height_ratio": 0.78},
        "note_zh": "3.25 in（82.6 mm）/ 7 in（177.8 mm），4.5–7 pt，闭合框。",
        "note_en": "3.25 in (82.6 mm) / 7 in (177.8 mm), 4.5–7 pt, boxed frame.",
    },
    "rsc": {
        "name_zh": "RSC",
        "name_en": "RSC",
        "widths": {"single": 83.0, "double": 172.0},
        "font": "arial",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "grid": {"show": False},
        "rc": {"font.size": 7.5, "axes.labelsize": 7.5},
        "figure": {"height_ratio": 0.78},
        "note_zh": "单栏 83 mm / 双栏 172 mm，8 pt 以内。",
        "note_en": "83 mm single / 172 mm double, 8 pt or smaller.",
    },
    "aps": {
        "name_zh": "APS / PRL",
        "name_en": "APS / PRL",
        "widths": {"single": 86.0, "double": 178.0},
        "font": "times",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "minor": True,
        "grid": {"show": False},
        "rc": {"font.size": 8.0, "axes.labelsize": 8.0, "legend.fontsize": 7.0},
        "figure": {"height_ratio": 0.78},
        "note_zh": "单栏 86 mm / 双栏 178 mm，8 pt Times，主次刻度。",
        "note_en": "86 mm single / 178 mm double, 8 pt Times, major+minor ticks.",
    },
    "agu": {
        "name_zh": "AGU",
        "name_en": "AGU",
        "widths": {"single": 95.0, "double": 190.0},
        "font": "arial",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "grid": {"show": True, "axis": "both", "linestyle": "-", "color": "#DCE3E6", "linewidth": 0.5},
        "rc": {"font.size": 8.0, "axes.labelsize": 8.0, "legend.fontsize": 7.0},
        "figure": {"height_ratio": 0.7},
        "note_zh": "单栏 95 mm / 双栏 190 mm，地学网格版式。",
        "note_en": "95 mm single / 190 mm double, geoscience grid layout.",
    },
    "elsevier": {
        "name_zh": "Elsevier",
        "name_en": "Elsevier",
        "widths": {"single": 90.0, "double": 190.0},
        "font": "arial",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "rc": {"font.size": 7.5, "axes.labelsize": 8.0},
        "figure": {"height_ratio": 0.75},
        "note_zh": "单栏 90 mm / 双栏 190 mm，通用工程与自然科学版式。",
        "note_en": "90 mm single / 190 mm double, general STM layout.",
    },
    "springer": {
        "name_zh": "Springer",
        "name_en": "Springer",
        "widths": {"single": 84.0, "double": 174.0},
        "font": "arial",
        "spines": ("left", "right", "top", "bottom"),
        "ticks": "in",
        "grid": {"show": False},
        "rc": {"font.size": 8.0, "axes.labelsize": 8.0, "legend.fontsize": 7.0},
        "figure": {"height_ratio": 0.76},
        "note_zh": "单栏 84 mm / 双栏 174 mm，7–8 pt 无衬线。",
        "note_en": "84 mm single / 174 mm double, 7–8 pt sans-serif.",
    },
    "apa": {
        "name_zh": "APA",
        "name_en": "APA",
        "widths": {"single": 120.0, "double": 165.0},
        "font": "arial",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": False},
        "rc": {"font.size": 9.0, "axes.labelsize": 9.0, "legend.fontsize": 8.0, "xtick.labelsize": 8.0, "ytick.labelsize": 8.0},
        "figure": {"height_ratio": 0.66},
        "note_zh": "宽 120 mm / 165 mm，8–14 pt 无衬线，社科可读性优先。",
        "note_en": "120 mm / 165 mm wide, 8–14 pt sans-serif, social-science legibility.",
    },
    "neurips": {
        "name_zh": "NeurIPS",
        "name_en": "NeurIPS",
        "widths": {"single": 140.0, "double": 140.0},
        "font": "arial",
        "spines": ("left", "bottom"),
        "ticks": "out",
        "grid": {"show": True, "axis": "both", "linestyle": "-", "color": "#E8E8E8", "linewidth": 0.5},
        "rc": {"font.size": 8.0, "axes.labelsize": 8.0, "legend.fontsize": 7.0},
        "figure": {"height_ratio": 0.62},
        "note_zh": "正文宽 140 mm，8 pt，浅网格与稍粗曲线。",
        "note_en": "140 mm text width, 8 pt, light grid and slightly heavier lines.",
    },
}

# ---------------------------------------------------------------------------
# Figure size presets
# ---------------------------------------------------------------------------

SIZES = {
    "single": {"name_zh": "单栏", "name_en": "Single column", "width_mm": 89.0, "note_zh": "期刊单栏宽度", "note_en": "Journal single-column width"},
    "double": {"name_zh": "双栏", "name_en": "Double column", "width_mm": 183.0, "note_zh": "期刊通栏宽度", "note_en": "Journal full width"},
    "wide": {"name_zh": "超宽", "name_en": "Wide", "width_mm": 190.0, "note_zh": "满版宽度", "note_en": "Full-page width"},
    "narrow": {"name_zh": "窄栏", "name_en": "Narrow", "width_mm": 55.0, "note_zh": "Science 单栏等窄版", "note_en": "Narrow column (Science one-column)"},
    "slide": {"name_zh": "幻灯片", "name_en": "Slide", "width_mm": 192.0, "note_zh": "16:9 演示用", "note_en": "16:9 presentation"},
    "square": {"name_zh": "方形", "name_en": "Square", "width_mm": 120.0, "note_zh": "热图/相关矩阵", "note_en": "Heatmaps and matrices"},
    "golden": {"name_zh": "黄金比", "name_en": "Golden", "width_mm": 120.0, "note_zh": "1.618 比例", "note_en": "Golden-ratio canvas"},
    "custom": {"name_zh": "自定义", "name_en": "Custom", "width_mm": 120.0, "note_zh": "手动指定宽高", "note_en": "Explicit width/height"},
}


def _merge(base: dict, overlay: dict) -> dict:
    out = dict(base)
    for key, value in overlay.items():
        if key == "rc" and isinstance(value, dict):
            merged = dict(out.get("rc", {}))
            merged.update(value)
            out["rc"] = merged
        elif key in ("grid", "line", "errorbar", "figure", "legend") and isinstance(value, dict):
            merged = dict(out.get(key, {}))
            merged.update(value)
            out[key] = merged
        else:
            out[key] = value
    return out


def _domain_style(domain_id: str) -> dict:
    domain = DOMAINS.get(domain_id) or DOMAINS["general"]
    style = _merge(BASE, domain)
    style["domain"] = domain_id if domain_id in DOMAINS else "general"
    style["domain_meta"] = domain
    return style


def _journal_style(style: dict, journal_id: str) -> dict:
    journal = JOURNALS.get(journal_id)
    if not journal:
        style["journal"] = None
        return style
    resolved = _merge(style, journal)
    resolved["journal"] = journal_id
    resolved["journal_meta"] = journal
    return resolved


def resolve_style(raw: dict | None = None, kind_aspect: float | None = None) -> dict:
    """Resolve a raw style object (from a spec) into a complete style dict."""
    raw = raw if isinstance(raw, dict) else {}
    domain_id = raw.get("domain") if isinstance(raw.get("domain"), str) else "general"
    journal_id = raw.get("journal") if isinstance(raw.get("journal"), str) else None

    style = _domain_style(domain_id)
    if journal_id:
        style = _journal_style(style, journal_id)

    # Explicit user overrides.
    if isinstance(raw.get("palette"), str):
        style["palette"] = raw["palette"]
    if isinstance(raw.get("cmap"), str):
        style["cmap"] = raw["cmap"]
    if isinstance(raw.get("diverging_cmap"), str):
        style["diverging_cmap"] = raw["diverging_cmap"]
    if isinstance(raw.get("font"), str):
        style["font"] = raw["font"]
    if raw.get("ticks") in ("in", "out"):
        style["ticks"] = raw["ticks"]
    if isinstance(raw.get("minor"), bool):
        style["minor"] = raw["minor"]
    if isinstance(raw.get("grid"), bool):
        style["grid"] = {**style.get("grid", {}), "show": raw["grid"]}
    if isinstance(raw.get("spines"), (list, tuple)):
        style["spines"] = tuple(raw["spines"])
    if isinstance(raw.get("line"), dict):
        style["line"] = {**style.get("line", {}), **raw["line"]}
    if isinstance(raw.get("errorbar"), dict):
        style["errorbar"] = {**style.get("errorbar", {}), **raw["errorbar"]}
    if isinstance(raw.get("legend"), dict):
        style["legend"] = {**style.get("legend", {}), **raw["legend"]}
    if isinstance(raw.get("font_size"), (int, float)) and 4 <= raw["font_size"] <= 20:
        size = float(raw["font_size"])
        style = _scale_fonts(style, size)

    # Geometry.
    size_id = raw.get("size") if isinstance(raw.get("size"), str) else "single"
    journal_widths = (style.get("journal_meta") or {}).get("widths") or {}
    width_mm = None
    if size_id in journal_widths:
        width_mm = float(journal_widths[size_id])
    elif size_id in SIZES:
        width_mm = float(SIZES[size_id]["width_mm"])
    if raw.get("width_mm") is not None:
        try:
            width_mm = max(20.0, min(600.0, float(raw["width_mm"])))
        except (TypeError, ValueError):
            pass
    width_mm = width_mm or float(style["figure"]["width_mm"])
    height_ratio = float(raw.get("height_ratio") or style["figure"].get("height_ratio") or 0.75)
    if kind_aspect is not None:
        height_ratio = float(kind_aspect)
    height_mm = width_mm * height_ratio
    if raw.get("height_mm") is not None:
        try:
            height_mm = max(15.0, min(600.0, float(raw["height_mm"])))
        except (TypeError, ValueError):
            pass

    dpi = int(raw.get("dpi") or style["figure"].get("dpi") or 300)
    dpi = max(72, min(1200, dpi))

    # Fonts.
    family, mathset = fonts.resolve_family(style.get("font", "arial"))
    rc = dict(style["rc"])
    rc["font.family"] = family
    rc["mathtext.fontset"] = raw.get("mathtext") if raw.get("mathtext") in ("stix", "stixsans", "cm", "dejavusans", "dejavuserif", "custom") else mathset
    rc["savefig.dpi"] = dpi
    rc["figure.dpi"] = min(dpi, 300)

    # Ticks / spines / grid.
    rc["xtick.direction"] = style["ticks"]
    rc["ytick.direction"] = style["ticks"]
    rc["xtick.top"] = "top" in style["spines"]
    rc["ytick.right"] = "right" in style["spines"]
    rc["axes.spines.top"] = "top" in style["spines"]
    rc["axes.spines.right"] = "right" in style["spines"]
    rc["axes.spines.left"] = "left" in style["spines"]
    rc["axes.spines.bottom"] = "bottom" in style["spines"]
    if style["minor"]:
        rc["xtick.minor.visible"] = True
        rc["ytick.minor.visible"] = True
    grid = style.get("grid") or {}
    rc["axes.grid"] = bool(grid.get("show"))
    rc["axes.grid.axis"] = grid.get("axis", "both")
    rc["axes.grid.which"] = grid.get("which", "major")
    rc["grid.linestyle"] = grid.get("linestyle", "-")
    rc["grid.color"] = grid.get("color", "#E4E4E4")
    rc["grid.linewidth"] = grid.get("linewidth", 0.5)
    rc["grid.alpha"] = grid.get("alpha", 1.0)

    style.update(
        {
            "rc": rc,
            "font_family": family,
            "math": rc["mathtext.fontset"],
            "width_mm": round(width_mm, 2),
            "height_mm": round(height_mm, 2),
            "height_ratio": round(height_ratio, 4),
            "width_in": round(width_mm / MM_PER_INCH, 4),
            "height_in": round(height_mm / MM_PER_INCH, 4),
            "dpi": dpi,
            "size": size_id,
            "size_label_zh": (SIZES.get(size_id) or {}).get("name_zh", "自定义"),
            "size_label_en": (SIZES.get(size_id) or {}).get("name_en", "Custom"),
            "transparent": bool(raw.get("transparent", False)),
        }
    )
    if "background" in raw and isinstance(raw["background"], str):
        style["figure_face"] = raw["background"]
        style["axes_face"] = raw["background"]
    return style


def _scale_fonts(style: dict, target: float) -> dict:
    """Scale every text size when a user asks for a different base font size."""
    base = float(style["rc"].get("font.size", 7.0)) or 7.0
    factor = target / base
    rc = dict(style["rc"])
    for key in ("font.size", "axes.titlesize", "axes.labelsize", "legend.fontsize", "legend.title_fontsize", "xtick.labelsize", "ytick.labelsize", "figure.titlesize"):
        if key in rc:
            try:
                rc[key] = round(float(rc[key]) * factor, 2)
            except (TypeError, ValueError):
                pass
    out = dict(style)
    out["rc"] = rc
    return out


# ---------------------------------------------------------------------------
# Catalog for tools and the panel
# ---------------------------------------------------------------------------

def catalog() -> dict:
    domains = []
    for did, meta in DOMAINS.items():
        domains.append(
            {
                "id": did,
                "name_zh": meta["name_zh"],
                "name_en": meta["name_en"],
                "description_zh": meta["description_zh"],
                "description_en": meta["description_en"],
                "palette": meta.get("palette"),
                "cmap": meta.get("cmap"),
                "font": meta.get("font", "arial"),
                "recommended": list(meta.get("recommended", [])),
            }
        )
    journals = []
    for jid, meta in JOURNALS.items():
        journals.append(
            {
                "id": jid,
                "name_zh": meta["name_zh"],
                "name_en": meta["name_en"],
                "widths": dict(meta.get("widths", {})),
                "font": meta.get("font", "arial"),
                "palette": meta.get("palette"),
                "note_zh": meta.get("note_zh", ""),
                "note_en": meta.get("note_en", ""),
            }
        )
    return {
        "domains": domains,
        "journals": journals,
        "sizes": [{"id": sid, **meta} for sid, meta in SIZES.items()],
        "fonts": fonts.list_presets(),
        "base": {
            "font_size": BASE["rc"]["font.size"],
            "dpi": BASE["figure"]["dpi"],
            "height_ratio": BASE["figure"]["height_ratio"],
        },
    }

