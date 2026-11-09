"""Statistics and distribution family.

Histograms, box/violin/raincloud/strip summaries, ridgelines, density and ECDF
curves, Q-Q plots, correlation matrices, pair plots, regressions with confidence
bands, residual diagnostics and Likert diverging bars.

All geometry, typography and colour choices come from the shared style system;
this module only decides *what* is drawn.  Private helpers stay local by design
(``CONTRACT.md`` section 1).
"""
from __future__ import annotations

import textwrap
from statistics import NormalDist

import numpy as np
from matplotlib.colors import to_rgb
from matplotlib.patches import Patch, Rectangle
from matplotlib.ticker import MaxNLocator

from .. import helpers as H
from ..palettes import list_continuous, to_hex
from ..registry import register
from ..spec import SpecError

try:  # SciPy is optional: every test degrades to a silent skip.
    from scipy import stats as _stats
except Exception:  # pragma: no cover
    _stats = None

REF_COLOR = "#9A9A9A"  # reference-line grey prescribed by CONTRACT.md section 6
_CONTINUOUS_IDS = {str(row["id"]) for row in list_continuous()}


def _diverging_cmap(ctx):
    """Resolve the diverging colour map, tolerating the ``RdBu``/``rdbu`` casing.

    ``themes.BASE`` names the map ``RdBu`` while :mod:`palettes` registers it as
    ``rdbu``; asking for an unknown name silently falls back to viridis, which
    would break the zero-centred convention.  This resolves the requested name
    against the registered continuous ids first.
    """
    requested = str(ctx.style.get("diverging_cmap") or "RdBu")
    for candidate in (requested, requested.lower()):
        if candidate in _CONTINUOUS_IDS:
            return ctx.cmap(candidate)
    return ctx.diverging_cmap()


def _blend(colour: str, other: str, fraction: float) -> str:
    """Mix two style colours (used for the Likert neutral midpoint)."""
    first = np.asarray(to_rgb(colour), dtype=float)
    second = np.asarray(to_rgb(other), dtype=float)
    return to_hex(first * (1.0 - float(fraction)) + second * float(fraction))


# ---------------------------------------------------------------------------
# Local helpers
# ---------------------------------------------------------------------------

def _mapping(ctx) -> dict:
    mapping = getattr(ctx.table, "mapping", None)
    return mapping if isinstance(mapping, dict) else {}


def _is_numeric(data, name: str) -> bool:
    try:
        return bool(data._is_numeric_column(str(name)))
    except Exception:
        return False


def _numeric_columns(data) -> list[str]:
    return [str(name) for name in data.column_order if _is_numeric(data, name)]


def _pretty(name) -> str:
    text = str(name).replace("_", " ").strip()
    return (text[:1].upper() + text[1:]) if text else text


def _axis_label(ctx, key: str, fallback: str) -> str:
    value = ctx.label(key)
    return str(value) if str(value).strip() else fallback


def _dark(ctx) -> str:
    return str(ctx.style.get("text", "#111111"))


def _lw(ctx) -> float:
    return float(ctx.style["line"]["lw"])


def _ms(ctx) -> float:
    return float(ctx.style["line"]["ms"])


def _font(ctx, key: str, default: float = 6.5) -> float:
    return float(ctx.style["rc"].get(key, default))


def _wrap(text, width: int = 30) -> str:
    words = textwrap.wrap(str(text), width=max(int(width), 8))
    return "\n".join(words) if words else str(text)


def _auto_rotate(names) -> int:
    longest = max((len(str(name)) for name in names), default=0)
    return 30 if longest > 9 else 0


def _series_groups(ctx):
    groups = []
    for index, item in enumerate(ctx.table.series):
        values = H.finite(item.get("y", []))
        if values.size:
            name = str(item.get("name") or item.get("label") or f"Series {index + 1}")
            groups.append({"name": name, "values": values})
    return groups


def _distribution_groups(ctx, default_value: str | None = None):
    """Return ``(groups, value_column_name)`` from series or long-table data."""
    data = ctx.table
    if data.mode == "series":
        groups = _series_groups(ctx)
        if not groups:
            raise SpecError("no finite values to plot", "invalid_data")
        return groups, "Value"

    mapping = _mapping(ctx)
    y_name = mapping.get("y")
    if isinstance(y_name, (list, tuple, np.ndarray)):
        y_name = str(y_name[0]) if len(y_name) else None
    if not (isinstance(y_name, str) and data.has(y_name)):
        y_name = default_value if isinstance(default_value, str) and data.has(default_value) else None
    if y_name is None:
        numeric = _numeric_columns(data)
        if not numeric:
            raise SpecError('the distribution plot needs a numeric "y" column', "invalid_mapping", "mapping")
        y_name = numeric[0]

    group_name = mapping.get("group")
    if group_name is None:
        x_name = mapping.get("x")
        if isinstance(x_name, str) and data.has(x_name) and not _is_numeric(data, x_name):
            group_name = x_name

    values = data.numeric(str(y_name))
    if isinstance(group_name, str) and data.has(group_name):
        labels = data.categorical(group_name)
        groups = []
        for level in data.unique(group_name):
            mask = np.asarray([str(value) == str(level) for value in labels], dtype=bool)
            vals = H.finite(values[mask])
            if vals.size:
                groups.append({"name": _pretty(level) if str(level) == str(level).lower() else str(level), "values": vals})
        if groups:
            return groups, str(y_name)
    return [{"name": str(y_name), "values": H.finite(values)}], str(y_name)


def _xy_pair(ctx):
    """Return ``(x, y, x_name, y_name)`` for two numeric columns or one series."""
    data = ctx.table
    if data.mode == "series":
        item = data.series[0]
        x, y = H.clean_xy(item.get("x", []), item.get("y", []))
        return x, y, "x", "y"
    mapping = _mapping(ctx)
    numeric = _numeric_columns(data)
    x_name = mapping.get("x")
    y_name = mapping.get("y")
    if not (isinstance(x_name, str) and data.has(x_name) and _is_numeric(data, x_name)):
        x_name = numeric[0] if numeric else None
    if not (isinstance(y_name, str) and data.has(y_name) and _is_numeric(data, y_name)):
        y_name = numeric[1] if len(numeric) > 1 else None
    if x_name is None or y_name is None:
        raise SpecError('two numeric columns are required (mapping "x" and "y")', "invalid_mapping", "mapping")
    x, y = H.clean_xy(data.numeric(str(x_name)), data.numeric(str(y_name)))
    return x, y, str(x_name), str(y_name)


def _xy_groups(ctx):
    """Return ``[(name, x, y), ...]`` honouring an optional group column."""
    data = ctx.table
    if data.mode == "series":
        output = []
        for index, item in enumerate(data.series):
            x, y = H.clean_xy(item.get("x", []), item.get("y", []))
            if x.size:
                output.append((str(item.get("name") or f"Series {index + 1}"), x, y))
        return output
    mapping = _mapping(ctx)
    numeric = _numeric_columns(data)
    x_name = mapping.get("x")
    y_name = mapping.get("y")
    if not (isinstance(x_name, str) and data.has(x_name) and _is_numeric(data, x_name)):
        x_name = numeric[0] if numeric else None
    if not (isinstance(y_name, str) and data.has(y_name) and _is_numeric(data, y_name)):
        y_name = numeric[1] if len(numeric) > 1 else None
    if x_name is None or y_name is None:
        raise SpecError('two numeric columns are required (mapping "x" and "y")', "invalid_mapping", "mapping")
    x = data.numeric(str(x_name))
    y = data.numeric(str(y_name))
    group_name = mapping.get("group")
    if isinstance(group_name, str) and data.has(group_name):
        labels = data.categorical(group_name)
        groups = []
        for level in data.unique(group_name):
            mask = np.asarray([str(value) == str(level) for value in labels], dtype=bool)
            xx, yy = H.clean_xy(x[mask], y[mask])
            if xx.size:
                groups.append((str(level), xx, yy))
        if groups:
            return groups
    xx, yy = H.clean_xy(x, y)
    return [("Data", xx, yy)]


def _density_curve(values, points: int = 240):
    values = H.finite(values)
    grid, density = H.kde_1d(values, gridsize=points)
    span = float(np.ptp(values)) or 1.0
    lo = float(values.min()) - 0.05 * span
    hi = float(values.max()) + 0.05 * span
    mask = (grid >= lo) & (grid <= hi)
    if int(mask.sum()) >= 8:
        return grid[mask], density[mask]
    return grid, density


def _kde_on_grid(values, grid: np.ndarray) -> np.ndarray:
    source, density = H.kde_1d(values, gridsize=260)
    return np.interp(grid, source, density, left=0.0, right=0.0)


def _draw_inner_box(ax, values, position: float, width: float, dark: str, lw: float, zorder: float = 5.0):
    values = np.asarray(values, dtype=float)
    q1, q2, q3 = np.percentile(values, [25, 50, 75])
    iqr = float(q3 - q1)
    low = float(max(np.min(values), q1 - 1.5 * iqr))
    high = float(min(np.max(values), q3 + 1.5 * iqr))
    ax.plot([position, position], [low, high], color=dark, lw=lw * 0.7, zorder=zorder, solid_capstyle="butt")
    ax.add_patch(
        Rectangle(
            (position - width / 2.0, float(q1)),
            width,
            max(float(q3 - q1), 0.0),
            facecolor="white",
            edgecolor=dark,
            linewidth=lw * 0.7,
            zorder=zorder + 1,
        )
    )
    ax.plot([position - width / 2.0, position + width / 2.0], [float(q2), float(q2)], color=dark, lw=lw * 1.4, zorder=zorder + 2)


def _group_ticks(groups) -> list[str]:
    return [f"{group['name']}\n$n$ = {group['values'].size}" for group in groups]


def _kruskal_note(groups) -> str:
    if len(groups) < 2 or _stats is None:
        return ""
    arrays = [group["values"] for group in groups if group["values"].size >= 2]
    if len(arrays) < 2:
        return ""
    try:
        p_value = float(_stats.kruskal(*arrays).pvalue)
    except Exception:
        return ""
    if not np.isfinite(p_value):
        return ""
    return f"Kruskal–Wallis {H.format_p(p_value)}"


def _spearman(x, y) -> float:
    x, y = H.clean_xy(x, y)
    if x.size < 3:
        return float("nan")
    if _stats is not None:
        try:
            return float(_stats.spearmanr(x, y).statistic)
        except Exception:
            return float("nan")
    return H.pearson(np.argsort(np.argsort(x)), np.argsort(np.argsort(y)))


# ---------------------------------------------------------------------------
# Histogram
# ---------------------------------------------------------------------------

@register(
    "histogram",
    zh="直方图",
    en="Histogram",
    category="statistics",
    summary_zh="单组或多组分布直方图，共享分箱范围，可切换概率密度与计数。",
    summary_en="One or several distributions sharing bin ranges, as probability density or counts.",
    tags=["分布", "distribution", "density", "分箱"],
    aspect=0.72,
    options=[
        {"id": "bins", "type": "int", "default": 30, "min": 5, "max": 120, "label_zh": "分箱数", "label_en": "Bins"},
        {"id": "density", "type": "bool", "default": True, "label_zh": "概率密度", "label_en": "Probability density"},
        {"id": "alpha", "type": "float", "default": 0.22, "min": 0.05, "max": 0.8, "step": 0.02, "label_zh": "填充透明度", "label_en": "Fill opacity"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "life-science", "journal": "nature"},
        "labels": {"x": "Score (a.u.)", "y": "Probability density"},
    },
    aliases=["hist"],
)
def render_histogram(ctx):
    ax = ctx.ax()
    groups, _value_name = _distribution_groups(ctx)
    bins = max(5, int(ctx.num("bins", 30)))
    density = ctx.flag("density", True)
    alpha = float(ctx.num("alpha", 0.22))
    lw = _lw(ctx)
    values = np.concatenate([group["values"] for group in groups])
    lo, hi = H.nice_limits(values, pad=0.02)
    for index, group in enumerate(groups):
        colour = ctx.color(index)
        ax.hist(
            group["values"], bins=bins, range=(lo, hi), density=density,
            histtype="stepfilled", color=colour, alpha=alpha, edgecolor=colour,
            linewidth=lw * 0.7, label=group["name"], zorder=2 + index,
        )
        ax.hist(
            group["values"], bins=bins, range=(lo, hi), density=density,
            histtype="step", color=colour, linewidth=lw, zorder=3 + index,
        )
    ylabel = _axis_label(ctx, "y", "Probability density" if density else "Count")
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", _value_name), ylabel=ylabel, legend=len(groups) > 1)
    return ctx.fig


# ---------------------------------------------------------------------------
# 2-D histogram
# ---------------------------------------------------------------------------

@register(
    "hist2d",
    zh="二维直方图",
    en="2-D histogram",
    category="statistics",
    summary_zh="双变量联合分布的热图，可对频数取对数以兼顾稀疏区。",
    summary_en="Joint distribution heat map of two variables, with optional log counts.",
    tags=["联合分布", "joint", "2D", "密度"],
    aspect=0.92,
    options=[
        {"id": "bins", "type": "int", "default": 34, "min": 8, "max": 120, "label_zh": "分箱数", "label_en": "Bins"},
        {"id": "log_color", "type": "bool", "default": False, "label_zh": "对数频数", "label_en": "Log counts"},
    ],
    demo={
        "data": {"sample": "stats_bivariate", "mapping": {"x": "x", "y": "y"}},
        "style": {"domain": "omics", "journal": "nature"},
        "labels": {"x": "Gene expression (log$_2$ TPM)", "y": "Protein abundance (log$_2$)", "colorbar": "Count"},
    },
    aliases=["histogram2d", "hist_2d"],
)
def render_hist2d(ctx):
    ax = ctx.ax()
    x, y, x_name, y_name = _xy_pair(ctx)
    if x.size < 3:
        raise SpecError("the 2-D histogram needs at least three paired observations", "invalid_data")
    bins = max(8, int(ctx.num("bins", 34)))
    counts, x_edges, y_edges = np.histogram2d(x, y, bins=bins)
    grid = np.ma.masked_where(counts.T <= 0, counts.T)
    from matplotlib.colors import LogNorm, Normalize

    if ctx.flag("log_color", False):
        norm = LogNorm(vmin=1.0, vmax=max(1.0, float(counts.max())))
    else:
        norm = Normalize(vmin=0.0, vmax=float(counts.max()) if counts.max() > 0 else 1.0)
    mesh = ax.pcolormesh(x_edges, y_edges, grid, cmap=ctx.cmap(), norm=norm, edgecolors="none", zorder=2)
    ctx.colorbar(mesh, ax, label=_axis_label(ctx, "colorbar", "Count"))
    H.corner_note(ax, f"$n$ = {x.size:,}", loc="upper right", fontsize=_font(ctx, "legend.fontsize"))
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", x_name), ylabel=_axis_label(ctx, "y", y_name), legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Box plot
# ---------------------------------------------------------------------------

@register(
    "box",
    zh="箱线图",
    en="Box plot",
    category="statistics",
    summary_zh="分组分布箱线：中位线、四分位箱、1.5 IQR 须与离群点，组名下方标注样本量。",
    summary_en="Grouped box plots with median, IQR box, 1.5-IQR whiskers, outliers and per-group n.",
    tags=["分布", "distribution", "四分位", "quartile"],
    aspect=0.72,
    options=[
        {"id": "outliers", "type": "bool", "default": True, "label_zh": "显示离群点", "label_en": "Show outliers"},
        {"id": "points", "type": "bool", "default": False, "label_zh": "叠加散点", "label_en": "Overlay points"},
        {"id": "stats", "type": "bool", "default": True, "label_zh": "检验注释", "label_en": "Test annotation"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "life-science", "journal": "nature"},
        "labels": {"x": "Genotype", "y": "Score (a.u.)"},
    },
    aliases=["boxplot", "box_plot"],
)
def render_box(ctx):
    ax = ctx.ax()
    groups, value_name = _distribution_groups(ctx)
    data = [group["values"] for group in groups]
    positions = np.arange(len(groups), dtype=float)
    lw = _lw(ctx)
    dark = _dark(ctx)
    bp = ax.boxplot(
        data, positions=positions, widths=0.56, patch_artist=True, showfliers=False,
        manage_ticks=False, whis=1.5, zorder=2,
    )
    for index, patch in enumerate(bp["boxes"]):
        colour = ctx.color(index)
        patch.set_facecolor(colour)
        patch.set_alpha(0.32)
        patch.set_edgecolor(colour)
        patch.set_linewidth(lw)
    for median in bp["medians"]:
        median.set_color(dark)
        median.set_linewidth(lw * 1.7)
    for index, whisker in enumerate(bp["whiskers"]):
        whisker.set_color(ctx.color(index // 2))
        whisker.set_linewidth(lw * 0.85)
    for index, cap in enumerate(bp["caps"]):
        cap.set_color(ctx.color(index // 2))
        cap.set_linewidth(lw * 0.85)
    if ctx.flag("outliers", True):
        for index, group in enumerate(groups):
            values = group["values"]
            q1, q3 = np.percentile(values, [25, 75])
            iqr = float(q3 - q1)
            mask = (values < q1 - 1.5 * iqr) | (values > q3 + 1.5 * iqr)
            if mask.any():
                count = int(mask.sum())
                offsets = H.jitter(ctx.rng, count, 0.05)
                ax.scatter(
                    np.full(count, positions[index]) + offsets, values[mask],
                    s=_ms(ctx) ** 2 * 0.55, facecolors="white", edgecolors=ctx.color(index),
                    linewidths=0.5, zorder=4,
                )
    if ctx.flag("points", False):
        for index, group in enumerate(groups):
            offsets = H.jitter(ctx.rng, group["values"].size, 0.13)
            ax.scatter(
                np.full(group["values"].size, positions[index]) + offsets, group["values"],
                s=_ms(ctx) ** 2 * 0.4, color=ctx.color(index), alpha=0.35,
                edgecolors="none", zorder=1.5,
            )
    ax.set_xticks(positions)
    ax.set_xticklabels(_group_ticks(groups))
    rotate = _auto_rotate([group["name"] for group in groups])
    if rotate:
        ax.tick_params(axis="x", labelrotation=float(rotate))
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    ax.set_xlim(-0.6, len(groups) - 0.4)
    if ctx.flag("stats", True):
        note = _kruskal_note(groups)
        if note:
            H.corner_note(ax, note, loc="upper right", fontsize=_font(ctx, "legend.fontsize"))
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", ""), ylabel=_axis_label(ctx, "y", value_name), legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Violin plot
# ---------------------------------------------------------------------------

@register(
    "violin",
    zh="小提琴图",
    en="Violin plot",
    category="statistics",
    summary_zh="分组核密度轮廓叠加内嵌箱线，兼顾完整分布形状与四分位摘要。",
    summary_en="Grouped KDE silhouettes with an embedded box plot for shape plus quartile summary.",
    tags=["分布", "distribution", "KDE", "密度"],
    aspect=0.78,
    options=[
        {"id": "width", "type": "float", "default": 0.88, "min": 0.2, "max": 1.2, "step": 0.02, "label_zh": "小提琴宽度", "label_en": "Violin width"},
        {"id": "stats", "type": "bool", "default": True, "label_zh": "检验注释", "label_en": "Test annotation"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "clinical", "journal": "nejm"},
        "labels": {"x": "Genotype", "y": "Score (a.u.)"},
    },
    aliases=["violin_plot"],
)
def render_violin(ctx):
    ax = ctx.ax()
    groups, value_name = _distribution_groups(ctx)
    positions = np.arange(len(groups), dtype=float)
    width = float(ctx.num("width", 0.88))
    lw = _lw(ctx)
    dark = _dark(ctx)
    for index, group in enumerate(groups):
        colour = ctx.color(index)
        grid, density = _density_curve(group["values"])
        peak = float(np.max(density)) if density.size else 1.0
        half = 0.5 * width * (density / peak if peak > 0 else density)
        ax.fill_betweenx(
            grid, positions[index] - half, positions[index] + half,
            facecolor=colour, edgecolor=colour, linewidth=lw * 0.9, alpha=0.34, zorder=2,
        )
        _draw_inner_box(ax, group["values"], positions[index], 0.1, dark, lw)
    ax.set_xticks(positions)
    ax.set_xticklabels(_group_ticks(groups))
    ax.set_xlim(-0.6, len(groups) - 0.4)
    if ctx.flag("stats", True):
        note = _kruskal_note(groups)
        if note:
            H.corner_note(ax, note, loc="upper right", fontsize=_font(ctx, "legend.fontsize"))
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", ""), ylabel=_axis_label(ctx, "y", value_name), legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Raincloud plot
# ---------------------------------------------------------------------------

@register(
    "raincloud",
    zh="雨云图",
    en="Raincloud plot",
    category="statistics",
    summary_zh="半小提琴（云）+ 箱线 + 抖动散点（雨）三件套，同组三要素严格对齐。",
    summary_en="Half violin (cloud), box and jittered points (rain) aligned per group.",
    tags=["分布", "distribution", "half violin", "抖动"],
    aspect=0.9,
    options=[
        {"id": "cloud_width", "type": "float", "default": 0.34, "min": 0.1, "max": 0.6, "step": 0.02, "label_zh": "云宽度", "label_en": "Cloud width"},
        {"id": "rain_alpha", "type": "float", "default": 0.55, "min": 0.1, "max": 1.0, "step": 0.05, "label_zh": "雨点透明度", "label_en": "Rain opacity"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "social"},
        "labels": {"x": "Genotype", "y": "Score (a.u.)"},
    },
    aliases=["raincloud_plot"],
)
def render_raincloud(ctx):
    ax = ctx.ax()
    groups, value_name = _distribution_groups(ctx)
    lw = _lw(ctx)
    dark = _dark(ctx)
    cloud = float(ctx.num("cloud_width", 0.34))
    rain_alpha = float(ctx.num("rain_alpha", 0.55))
    for index, group in enumerate(groups):
        colour = ctx.color(index)
        position = float(index)
        values = group["values"]
        jitter = H.jitter(ctx.rng, values.size, 0.075)
        ax.scatter(
            position - 0.17 + jitter, values, s=_ms(ctx) ** 2 * 0.55,
            color=colour, alpha=rain_alpha, edgecolors="none", zorder=2,
        )
        _draw_inner_box(ax, values, position, 0.11, dark, lw)
        grid, density = _density_curve(values)
        peak = float(np.max(density)) if density.size else 1.0
        scaled = cloud * (density / peak if peak > 0 else density)
        start = position + 0.1
        ax.fill_betweenx(
            grid, start, start + scaled, facecolor=colour, edgecolor=colour,
            linewidth=lw * 0.9, alpha=0.34, zorder=3,
        )
    ax.set_xticks(np.arange(len(groups), dtype=float))
    ax.set_xticklabels(_group_ticks(groups))
    ax.set_xlim(-0.55, len(groups) - 0.45)
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", ""), ylabel=_axis_label(ctx, "y", value_name), legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Strip / jitter plot
# ---------------------------------------------------------------------------

@register(
    "strip",
    zh="抖动散点图",
    en="Strip plot",
    category="statistics",
    summary_zh="分组抖动散点加中央趋势横线，逐点展示样本量与离散程度。",
    summary_en="Jittered points per group with a central-tendency bar and per-group n.",
    tags=["散点", "jitter", "分布", "个体值"],
    aspect=0.7,
    options=[
        {"id": "center", "type": "enum", "default": "median", "choices": ["median", "mean"], "label_zh": "中心趋势", "label_en": "Central tendency"},
        {"id": "jitter_width", "type": "float", "default": 0.16, "min": 0.02, "max": 0.3, "step": 0.01, "label_zh": "抖动宽度", "label_en": "Jitter width"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "social"},
        "labels": {"x": "Genotype", "y": "Score (a.u.)"},
    },
    aliases=["strip_plot", "jitter"],
)
def render_strip(ctx):
    ax = ctx.ax()
    groups, value_name = _distribution_groups(ctx)
    positions = np.arange(len(groups), dtype=float)
    spread = float(ctx.num("jitter_width", 0.16))
    centre = str(ctx.opt("center", "median"))
    dark = _dark(ctx)
    lw = _lw(ctx)
    for index, group in enumerate(groups):
        colour = ctx.color(index)
        values = group["values"]
        offsets = H.jitter(ctx.rng, values.size, spread)
        ax.scatter(
            np.full(values.size, positions[index]) + offsets, values,
            s=_ms(ctx) ** 2 * 0.75, color=colour, alpha=0.72,
            edgecolors="white", linewidths=0.25, zorder=3,
        )
        value = float(np.median(values) if centre == "median" else np.mean(values))
        ax.hlines(value, positions[index] - 0.26, positions[index] + 0.26, color=dark, lw=lw * 1.2, zorder=4)
    ax.set_xticks(positions)
    ax.set_xticklabels(_group_ticks(groups))
    ax.set_xlim(-0.6, len(groups) - 0.4)
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", ""), ylabel=_axis_label(ctx, "y", value_name), legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Ridge / joyplot
# ---------------------------------------------------------------------------

@register(
    "ridge",
    zh="山脊图",
    en="Ridge plot",
    category="statistics",
    summary_zh="按组垂直偏移的半透明密度曲线，组标签在左侧，适合多组分布并列比较。",
    summary_en="Vertically offset semi-transparent densities with left-hand group labels.",
    tags=["分布", "joyplot", "多组", "density"],
    aspect=0.88,
    options=[
        {"id": "overlap", "type": "float", "default": 0.86, "min": 0.2, "max": 1.4, "step": 0.02, "label_zh": "重叠程度", "label_en": "Overlap"},
        {"id": "alpha", "type": "float", "default": 0.48, "min": 0.1, "max": 0.9, "step": 0.02, "label_zh": "填充透明度", "label_en": "Fill opacity"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "general", "palette": "tol-muted"},
        "labels": {"x": "Score (a.u.)"},
    },
    aliases=["ridgeline", "joyplot"],
)
def render_ridge(ctx):
    ax = ctx.ax()
    groups, value_name = _distribution_groups(ctx)
    lw = _lw(ctx)
    step = float(ctx.num("overlap", 0.86))
    alpha = float(ctx.num("alpha", 0.48))
    all_values = np.concatenate([group["values"] for group in groups])
    lo, hi = H.nice_limits(all_values, pad=0.04)
    grid = np.linspace(lo, hi, 260)
    curves = [_kde_on_grid(group["values"], grid) for group in groups]
    height = 1.06
    baseline_color = str((ctx.style.get("grid") or {}).get("color", "#E4E4E4"))
    total = len(groups)
    for index, group in enumerate(groups):
        offset = (total - 1 - index) * step
        curve = curves[index]
        peak = float(np.max(curve)) or 1.0
        scaled = height * curve / peak
        colour = ctx.color(index)
        ax.plot([lo, hi], [offset, offset], color=baseline_color, lw=lw * 0.6, zorder=1)
        ax.fill_between(
            grid, offset, offset + scaled, facecolor=colour, edgecolor=colour,
            linewidth=lw * 0.9, alpha=alpha, zorder=total - index + 2,
        )
    offsets = [(total - 1 - index) * step for index in range(total)]
    ax.set_yticks(offsets)
    ax.set_yticklabels([group["name"] for group in groups])
    ax.set_ylim(-0.3, (total - 1) * step + height + 0.25)
    ax.set_xlim(lo, hi)
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", value_name), ylabel="", legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Density plot
# ---------------------------------------------------------------------------

@register(
    "density",
    zh="核密度图",
    en="Density plot",
    category="statistics",
    summary_zh="分组核密度曲线，填充与描边叠加，组间峰位差异一目了然。",
    summary_en="Grouped KDE curves with matching fill and outline for direct peak comparison.",
    tags=["KDE", "密度", "distribution"],
    aspect=0.7,
    options=[
        {"id": "fill", "type": "bool", "default": False, "label_zh": "填充曲线", "label_en": "Fill curves"},
        {"id": "alpha", "type": "float", "default": 0.2, "min": 0.03, "max": 0.6, "step": 0.02, "label_zh": "填充透明度", "label_en": "Fill opacity"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "life-science", "journal": "nature"},
        "labels": {"x": "Score (a.u.)", "y": "Density"},
    },
    aliases=["kde", "density_plot"],
)
def render_density(ctx):
    ax = ctx.ax()
    groups, value_name = _distribution_groups(ctx)
    lw = _lw(ctx)
    alpha = float(ctx.num("alpha", 0.2))
    curves = []
    for group in groups:
        grid, density = H.kde_1d(group["values"], gridsize=280)
        curves.append((grid, density))
    all_values = np.concatenate([group["values"] for group in groups])
    lo, hi = H.nice_limits(all_values, pad=0.06)
    peaks = [float(np.max(density)) for _grid, density in curves if density.size]
    top = max(peaks) if peaks else 1.0
    for index, group in enumerate(groups):
        colour = ctx.color(index)
        grid, density = curves[index]
        if ctx.flag("fill", False):
            ax.fill_between(grid, 0, density, facecolor=colour, alpha=alpha, linewidth=0, zorder=2)
        ax.plot(grid, density, color=colour, lw=lw, label=group["name"], zorder=3)
    ax.set_xlim(lo, hi)
    ax.set_ylim(0, top * 1.24)
    sizes = [group["values"].size for group in groups]
    if sizes:
        note = f"$n$ = {sizes[0]}" if len(set(sizes)) == 1 else f"$n$ = {min(sizes)}–{max(sizes)}"
        H.corner_note(ax, note, loc="upper left", fontsize=_font(ctx, "legend.fontsize"))
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", value_name), ylabel=_axis_label(ctx, "y", "Density"), legend=len(groups) > 1)
    return ctx.fig


# ---------------------------------------------------------------------------
# ECDF
# ---------------------------------------------------------------------------

@register(
    "ecdf",
    zh="经验累积分布",
    en="ECDF",
    category="statistics",
    summary_zh="分组经验累积分布阶梯曲线，可读写任意分位点上的组间差距。",
    summary_en="Grouped empirical CDF steps for reading group gaps at any quantile.",
    tags=["累积分布", "CDF", "quantile"],
    aspect=0.7,
    options=[
        {"id": "percent", "type": "bool", "default": False, "label_zh": "百分比纵轴", "label_en": "Percent y axis"},
    ],
    demo={
        "data": {"sample": "distributions", "mapping": {"x": "cohort", "y": "score"}},
        "style": {"domain": "general", "palette": "tol-muted"},
        "labels": {"x": "Score (a.u.)", "y": "Cumulative probability"},
    },
    aliases=["cdf", "ecdf_plot"],
)
def render_ecdf(ctx):
    ax = ctx.ax()
    groups, value_name = _distribution_groups(ctx)
    lw = _lw(ctx)
    percent = ctx.flag("percent", False)
    scale = 100.0 if percent else 1.0
    for index, group in enumerate(groups):
        colour = ctx.color(index)
        x, y = H.ecdf(group["values"])
        ax.step(x, y * scale, where="post", color=colour, lw=lw, label=group["name"], zorder=3)
    ax.set_ylim(0, 100 if percent else 1.0)
    ax.set_xlim(H.nice_limits(np.concatenate([group["values"] for group in groups]), pad=0.04))
    sizes = [group["values"].size for group in groups]
    if sizes:
        note = f"$n$ = {sizes[0]}" if len(set(sizes)) == 1 else f"$n$ = {min(sizes)}–{max(sizes)}"
        H.corner_note(ax, note, loc="upper left", fontsize=_font(ctx, "legend.fontsize"))
    ylabel = _axis_label(ctx, "y", "Cumulative probability")
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", value_name), ylabel=ylabel, legend=len(groups) > 1)
    ctx.legend(ax, loc="lower right")
    return ctx.fig


# ---------------------------------------------------------------------------
# Q-Q plot
# ---------------------------------------------------------------------------

@register(
    "qq",
    zh="Q–Q 图",
    en="Q–Q plot",
    category="statistics",
    summary_zh="标准化样本分位数对理论正态分位数，含 1:1 参考线、95% 点态包络与 Shapiro–Wilk 检验。",
    summary_en="Standardised sample vs theoretical normal quantiles with 1:1 line, 95% envelope and Shapiro–Wilk test.",
    tags=["正态性", "normality", "quantile", "检验"],
    aspect=0.92,
    options=[
        {"id": "envelope", "type": "bool", "default": True, "label_zh": "95% 包络", "label_en": "95% envelope"},
        {"id": "reference", "type": "bool", "default": True, "label_zh": "1:1 参考线", "label_en": "1:1 reference"},
    ],
    demo={
        "data": {"sample": "stats_normality", "mapping": {"x": "group", "y": "value"}},
        "style": {"domain": "math"},
        "labels": {"x": "Theoretical quantile (normal)", "y": "Sample quantile (standardised)"},
    },
    aliases=["qq_plot", "qqplot"],
)
def render_qq(ctx):
    ax = ctx.ax()
    groups, _value_name = _distribution_groups(ctx)
    lw = _lw(ctx)
    normal = NormalDist()
    sizes = [group["values"].size for group in groups if group["values"].size >= 3]
    if not sizes:
        raise SpecError("the Q–Q plot needs at least three observations per group", "invalid_data")
    n_ref = int(np.median(sizes))
    probabilities = (np.arange(1, n_ref + 1) - 0.5) / n_ref
    theoretical = np.asarray([normal.inv_cdf(float(value)) for value in probabilities])
    density_at_quantile = np.exp(-0.5 * theoretical ** 2) / np.sqrt(2.0 * np.pi)
    standard_error = np.sqrt(probabilities * (1.0 - probabilities) / n_ref) / np.maximum(density_at_quantile, 1e-6)
    band_low = theoretical - 1.959964 * standard_error
    band_high = theoretical + 1.959964 * standard_error

    limit = float(max(np.max(np.abs(theoretical)), np.max(np.abs(band_low)), np.max(np.abs(band_high))))
    handles = []
    if ctx.flag("envelope", True):
        ax.fill_between(theoretical, band_low, band_high, color=REF_COLOR, alpha=0.16, linewidth=0, zorder=1)
        handles.append(Patch(facecolor=REF_COLOR, alpha=0.3, edgecolor="none", label="95% band"))
    if ctx.flag("reference", True):
        line, = ax.plot([-limit, limit], [-limit, limit], color=REF_COLOR, lw=0.6, ls="--", zorder=2, label="1:1")
        handles.append(line)
    points = []
    for index, group in enumerate(groups):
        values = group["values"]
        if values.size < 3:
            continue
        spread = float(np.std(values, ddof=1)) or 1.0
        standardised = np.sort((values - float(np.mean(values))) / spread)
        count = standardised.size
        p_values = (np.arange(1, count + 1) - 0.5) / count
        theo = np.asarray([normal.inv_cdf(float(value)) for value in p_values])
        label = group["name"]
        if _stats is not None:
            try:
                p_value = float(_stats.shapiro(standardised).pvalue)
                if np.isfinite(p_value):
                    label = f"{label} (Shapiro–Wilk {H.format_p(p_value)})"
            except Exception:
                pass
        colour = ctx.color(index)
        scatter = ax.scatter(theo, standardised, s=_ms(ctx) ** 2 * 0.8, color=colour, alpha=0.85,
                             edgecolors="white", linewidths=0.3, label=label, zorder=4)
        points.append(scatter)
        limit = max(limit, float(np.max(np.abs(standardised))))
    limit *= 1.05
    ax.set_xlim(-limit, limit)
    ax.set_ylim(-limit, limit)
    ordered = list(points) + handles
    if ordered:
        ctx.finish(ax, xlabel=_axis_label(ctx, "x", "Theoretical quantile"), ylabel=_axis_label(ctx, "y", "Sample quantile"), legend=False)
        ctx.legend(ax, handles=ordered, labels=[handle.get_label() for handle in ordered], loc="upper left")
    else:
        ctx.finish(ax)
    return ctx.fig


# ---------------------------------------------------------------------------
# Correlation heat map
# ---------------------------------------------------------------------------

@register(
    "corr_heatmap",
    zh="相关矩阵热图",
    en="Correlation heat map",
    category="statistics",
    summary_zh="变量两两 Pearson/Spearman 相关矩阵：发散色标以 0 居中、格内两位小数、可选下三角。",
    summary_en="Pairwise Pearson/Spearman matrix with a zero-centred diverging scale, two-decimal cells and optional lower triangle.",
    tags=["相关", "correlation", "matrix", "热图"],
    aspect=0.98,
    options=[
        {"id": "method", "type": "enum", "default": "pearson", "choices": ["pearson", "spearman"], "label_zh": "相关系数", "label_en": "Coefficient"},
        {"id": "triangle", "type": "bool", "default": True, "label_zh": "仅下三角", "label_en": "Lower triangle"},
        {"id": "annot", "type": "bool", "default": True, "label_zh": "格内系数", "label_en": "Cell values"},
    ],
    demo={
        "data": {"sample": "correlation", "mapping": {}},
        "style": {"domain": "clinical", "journal": "nejm"},
        "labels": {"x": "Metabolic marker", "y": "", "colorbar": "Pearson $r$"},
    },
    aliases=["correlogram", "corrplot"],
)
def render_corr_heatmap(ctx):
    ax = ctx.ax()
    data = ctx.table
    mapping = _mapping(ctx)
    names = mapping.get("columns") if isinstance(mapping.get("columns"), (list, tuple)) else None
    if names:
        names = [str(name) for name in names if data.has(str(name)) and _is_numeric(data, str(name))]
    else:
        names = _numeric_columns(data)
    names = names[:10]
    if len(names) < 2:
        raise SpecError("the correlation heat map needs at least two numeric columns", "invalid_mapping", "mapping")
    method = str(ctx.opt("method", "pearson")).lower()
    values = [data.numeric(name) for name in names]
    count = len(names)
    matrix = np.full((count, count), np.nan)
    for i in range(count):
        matrix[i, i] = 1.0
        for j in range(i + 1, count):
            coefficient = _spearman(values[i], values[j]) if method == "spearman" else H.pearson(values[i], values[j])
            matrix[i, j] = coefficient
            matrix[j, i] = coefficient
    display = matrix.copy()
    if ctx.flag("triangle", True):
        display[np.triu_indices(count, 1)] = np.nan
    cmap = _diverging_cmap(ctx)
    from matplotlib.colors import Normalize

    norm = Normalize(vmin=-1.0, vmax=1.0)
    grid = np.ma.masked_invalid(display)
    ax.pcolormesh(
        np.arange(count + 1), np.arange(count + 1), grid,
        cmap=cmap, norm=norm, edgecolors="white", linewidth=0.6, zorder=2,
    )
    if ctx.flag("annot", True):
        fontsize = _font(ctx, "xtick.labelsize")
        for i in range(count):
            for j in range(count):
                if not np.isfinite(display[i, j]):
                    continue
                face = to_hex(cmap(norm(display[i, j])))
                text_colour = ctx.text_on(face)
                ax.text(j + 0.5, i + 0.5, f"{display[i, j]:.2f}", ha="center", va="center",
                        fontsize=fontsize, color=text_colour, zorder=3)
    ax.set_xticks(np.arange(count) + 0.5)
    ax.set_yticks(np.arange(count) + 0.5)
    ax.set_xticklabels(names)
    ax.set_yticklabels(names)
    rotate = 35 if max((len(name) for name in names), default=0) > 7 else 0
    if rotate:
        ax.tick_params(axis="x", labelrotation=float(rotate))
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    ax.invert_yaxis()  # keep the first variable at the top-left corner
    ax.set_xlim(0, count)
    ax.set_ylim(count, 0.0)
    colour_label = _axis_label(ctx, "colorbar", "Spearman $\\rho$" if method == "spearman" else "Pearson $r$")
    mesh = ax.collections[-1] if ax.collections else None
    if mesh is not None:
        ctx.colorbar(mesh, ax, label=colour_label, fraction=0.046, pad=0.03)
    xlabel = _axis_label(ctx, "x", "")
    ylabel = _axis_label(ctx, "y", "")
    if not xlabel and not ylabel:
        xlabel = "Variables"
    ctx.finish(ax, xlabel=xlabel, ylabel=ylabel, legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Pair plot
# ---------------------------------------------------------------------------

@register(
    "pairplot",
    zh="成对散点矩阵",
    en="Pair plot",
    category="statistics",
    summary_zh="多变量两两散点矩阵：对角线核密度、下三角散点与拟合线、格内相关系数与仅外圈轴标签。",
    summary_en="Scatter matrix with diagonal KDEs, lower-triangle fits and pairwise r, labels on the outer ring only.",
    tags=["相关", "scatter matrix", "multivariate", "矩阵"],
    aspect=1.0,
    options=[
        {"id": "show_r", "type": "bool", "default": True, "label_zh": "显示相关系数", "label_en": "Show r"},
        {"id": "regression", "type": "bool", "default": True, "label_zh": "拟合线", "label_en": "Fit line"},
    ],
    demo={
        "data": {"sample": "correlation", "mapping": {"columns": ["age", "bmi", "glucose", "insulin"]}},
        "style": {"domain": "life-science", "journal": "nature"},
        "labels": {"x": "", "y": ""},
    },
    aliases=["pairs", "scatter_matrix"],
)
def render_pairplot(ctx):
    data = ctx.table
    if data.mode == "series":
        raise SpecError("the pair plot needs a table with several numeric columns", "invalid_data")
    mapping = _mapping(ctx)
    requested = mapping.get("columns") if isinstance(mapping.get("columns"), (list, tuple)) else None
    if requested:
        names = [str(name) for name in requested if data.has(str(name)) and _is_numeric(data, str(name))]
    else:
        names = _numeric_columns(data)
    if len(names) > 6:
        names = names[:6]
    if len(names) < 2:
        raise SpecError("the pair plot needs at least two numeric columns", "invalid_mapping", "mapping")
    series = [data.numeric(name) for name in names]
    count = min(values.size for values in series)
    series = [values[:count] for values in series]
    nvars = len(names)
    fig, axes = ctx.figure(nvars, nvars, aspect=1.0)
    lw = _lw(ctx)
    ms = _ms(ctx)
    dark = _dark(ctx)
    tick_size = _font(ctx, "xtick.labelsize")
    for row in range(nvars):
        for column in range(nvars):
            ax = axes[row * nvars + column]
            if column > row:  # compact lower-triangle design
                ax.set_visible(False)
                continue
            if column == row:
                colour = ctx.color(row)
                grid, density = _density_curve(series[row])
                peak = float(np.max(density)) if density.size else 1.0
                if peak > 0:
                    density = density / peak
                ax.fill_between(grid, 0.0, density, facecolor=colour, alpha=0.34,
                                edgecolor=colour, linewidth=lw * 0.8, zorder=2)
                ax.set_ylim(0.0, 1.12)
                ax.set_yticks([])
            else:
                x, y = H.clean_xy(series[column], series[row])
                colour = ctx.color(row)
                ax.scatter(x, y, s=ms ** 2 * 0.35, color=colour, alpha=0.62,
                           edgecolors="white", linewidths=0.2, zorder=3)
                if ctx.flag("regression", True) and x.size >= 3:
                    fit = H.fit_linear(x, y)
                    if np.isfinite(fit["slope"]):
                        grid = np.linspace(float(x.min()), float(x.max()), 80)
                        ax.plot(grid, fit["slope"] * grid + fit["intercept"], color=colour,
                                alpha=0.6, lw=lw * 0.8, zorder=2)
                if ctx.flag("show_r", True):
                    coefficient = H.pearson(x, y)
                    if np.isfinite(coefficient):
                        ax.text(0.05, 0.95, f"$r$ = {coefficient:.2f}", transform=ax.transAxes,
                                ha="left", va="top", fontsize=max(tick_size - 0.6, 4.5), color=dark,
                                bbox={"boxstyle": "round,pad=0.1", "facecolor": "white", "edgecolor": "none", "alpha": 0.72},
                                zorder=5)
            ctx.finish(ax, xlabel=names[column], ylabel=names[row], legend=False)
            ax.xaxis.set_major_locator(MaxNLocator(3))
            ax.yaxis.set_major_locator(MaxNLocator(3))
            if row != nvars - 1:
                ax.tick_params(labelbottom=False)
                ax.xaxis.label.set_visible(False)
            if column != 0:
                ax.tick_params(labelleft=False)
                ax.yaxis.label.set_visible(False)
            if column == row:  # density alone on the diagonal: no misleading y axis
                ax.set_yticks([])
                ax.tick_params(axis="y", left=False)
                ax.yaxis.label.set_visible(False)
                ax.spines["left"].set_visible(False)
    return fig


# ---------------------------------------------------------------------------
# Regression
# ---------------------------------------------------------------------------

@register(
    "regression",
    zh="回归图",
    en="Regression plot",
    category="statistics",
    summary_zh="分组散点 + 最小二乘拟合线 + 95% 置信带，角落注释方程、R² 与 p 值。",
    summary_en="Grouped scatter with OLS lines, 95% CI bands and an equation/R²/p note.",
    tags=["回归", "OLS", "拟合", "相关"],
    aspect=0.8,
    options=[
        {"id": "ci", "type": "bool", "default": True, "label_zh": "95% 置信带", "label_en": "95% CI band"},
        {"id": "stats", "type": "bool", "default": True, "label_zh": "统计注释", "label_en": "Statistics note"},
        {"id": "alpha", "type": "float", "default": 0.75, "min": 0.1, "max": 1.0, "step": 0.05, "label_zh": "点透明度", "label_en": "Point opacity"},
    ],
    demo={
        "data": {"sample": "correlation", "mapping": {"x": "bmi", "y": "glucose"}},
        "style": {"domain": "omics", "journal": "nature"},
        "labels": {"x": "Body mass index (kg m$^{-2}$)", "y": "Fasting glucose (mmol L$^{-1}$)"},
    },
    aliases=["linear_regression", "reg_fit"],
)
def render_regression(ctx):
    ax = ctx.ax()
    groups = _xy_groups(ctx)
    lw = _lw(ctx)
    ms = _ms(ctx)
    alpha = float(ctx.num("alpha", 0.75))
    span = 0.0
    for index, (name, x, y) in enumerate(groups):
        colour = ctx.color(index)
        fit = H.fit_linear(x, y)
        label = name if len(groups) == 1 else f"{name} ($R^2$ = {fit['r2']:.2f})" if np.isfinite(fit["r2"]) else name
        ax.scatter(x, y, s=ms ** 2 * 0.95, color=colour, alpha=alpha,
                   edgecolors="white", linewidths=0.3, label=label, zorder=3)
        if np.isfinite(fit["slope"]):
            grid = np.linspace(float(x.min()), float(x.max()), 120)
            ax.plot(grid, fit["slope"] * grid + fit["intercept"], color=colour, lw=lw * 1.15, zorder=4)
            if ctx.flag("ci", True):
                band = H.bootstrap_fit_ci(x, y, seed=ctx._seed + index)
                if band:
                    ax.fill_between(band["grid"], band["lower"], band["upper"], color=colour, alpha=0.13, linewidth=0, zorder=2)
        if x.size:
            span = max(span, float(np.ptp(x)))
    if ctx.flag("stats", True):
        x_all = np.concatenate([item[1] for item in groups])
        y_all = np.concatenate([item[2] for item in groups])
        fit = H.fit_linear(x_all, y_all)
        fontsize = _font(ctx, "legend.fontsize")
        if len(groups) == 1 and np.isfinite(fit["slope"]):
            sign = "+" if fit["slope"] >= 0 else "−"
            equation = f"OLS: $y$ = {fit['intercept']:.2f} {sign} {abs(fit['slope']):.2f}$x$"
            note = f"{equation}\n$R^2$ = {fit['r2']:.2f}, {H.format_p(fit['p'])}, $n$ = {x_all.size}"
            H.corner_note(ax, note, loc="upper left", fontsize=fontsize)
        elif len(groups) > 1:
            H.corner_note(
                ax, f"Per-group OLS, 95% CI\n$n$ = {x_all.size}; pooled $R^2$ = {fit['r2']:.2f}",
                loc="upper left", fontsize=fontsize,
            )
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", "x"), ylabel=_axis_label(ctx, "y", "y"), legend=len(groups) > 1)
    return ctx.fig


# ---------------------------------------------------------------------------
# Residual diagnostics
# ---------------------------------------------------------------------------

@register(
    "residual",
    zh="残差诊断图",
    en="Residual diagnostics",
    category="statistics",
    summary_zh="残差对拟合值散点（含 y=0 参考线）与可选 Q–Q 子图，用于线性模型假设检查。",
    summary_en="Residual-vs-fitted scatter with a y=0 reference line plus an optional Q–Q subplot.",
    tags=["回归", "diagnostics", "残差", "QQ"],
    aspect=0.6,
    options=[
        {"id": "qq", "type": "bool", "default": True, "label_zh": "Q–Q 子图", "label_en": "Q–Q subplot"},
        {"id": "stats", "type": "bool", "default": True, "label_zh": "检验注释", "label_en": "Statistics note"},
    ],
    demo={
        "data": {"sample": "correlation", "mapping": {"x": "bmi", "y": "glucose"}},
        "style": {"domain": "clinical", "journal": "nejm"},
        "labels": {"x": "Fitted glucose (mmol L$^{-1}$)", "y": "Residual (mmol L$^{-1}$)"},
    },
    aliases=["residual_plot"],
)
def render_residual(ctx):
    x, y, x_name, y_name = _xy_pair(ctx)
    if x.size < 3:
        raise SpecError("residual diagnostics need at least three paired observations", "invalid_data")
    fit = H.fit_linear(x, y)
    fitted = fit["slope"] * x + fit["intercept"]
    residuals = y - fitted
    show_qq = ctx.flag("qq", True)
    if show_qq:
        fig, axes = ctx.figure(1, 2, width_ratios=[1.25, 1.0], aspect=0.6)
        ax = axes[0]
        ax_qq = axes[1]
    else:
        ax = ctx.ax()
        ax_qq = None
    colour = ctx.color(0)
    ax.scatter(fitted, residuals, s=_ms(ctx) ** 2 * 0.8, color=colour, alpha=0.75,
               edgecolors="white", linewidths=0.3, zorder=3)
    ax.axhline(0.0, color=REF_COLOR, lw=0.6, ls="--", zorder=2)
    limit = float(np.max(np.abs(residuals))) * 1.18 if residuals.size else 1.0
    ax.set_ylim(-limit, limit)
    if ctx.flag("stats", True):
        H.corner_note(
            ax, f"OLS: $n$ = {x.size}\n$R^2$ = {fit['r2']:.2f}",
            loc="upper left", fontsize=_font(ctx, "legend.fontsize"),
        )
    ctx.finish(
        ax,
        xlabel=_axis_label(ctx, "x", f"Fitted {y_name}"),
        ylabel=_axis_label(ctx, "y", "Residual"),
        legend=False,
    )
    if ax_qq is not None:
        standardised = (residuals - float(np.mean(residuals))) / (float(np.std(residuals, ddof=1)) or 1.0)
        ordered = np.sort(standardised)
        normal = NormalDist()
        probabilities = (np.arange(1, ordered.size + 1) - 0.5) / ordered.size
        theoretical = np.asarray([normal.inv_cdf(float(value)) for value in probabilities])
        ax_qq.scatter(theoretical, ordered, s=_ms(ctx) ** 2 * 0.7, color=colour, alpha=0.8,
                      edgecolors="white", linewidths=0.3, zorder=3)
        span = float(max(np.max(np.abs(theoretical)), np.max(np.abs(ordered)))) * 1.08
        ax_qq.plot([-span, span], [-span, span], color=REF_COLOR, lw=0.6, ls="--", zorder=2)
        ax_qq.set_xlim(-span, span)
        ax_qq.set_ylim(-span, span)
        if ctx.flag("stats", True) and _stats is not None:
            try:
                p_value = float(_stats.shapiro(standardised).pvalue)
                if np.isfinite(p_value):
                    H.corner_note(ax_qq, f"Shapiro–Wilk {H.format_p(p_value)}", loc="upper left", fontsize=_font(ctx, "legend.fontsize"))
            except Exception:
                pass
        ctx.finish(
            ax_qq,
            xlabel="Theoretical quantile",
            ylabel="Standardised residual",
            legend=False,
        )
        ctx.panel_label(ax, "A")
        ctx.panel_label(ax_qq, "B")
    return ctx.fig


# ---------------------------------------------------------------------------
# Likert diverging stacked bars
# ---------------------------------------------------------------------------

@register(
    "likert",
    zh="Likert 发散堆叠条",
    en="Likert diverging bars",
    category="statistics",
    summary_zh="五级（或任意奇数级）同意度发散堆叠条：中性段居中于 0、组件图例、百分比轴。",
    summary_en="Diverging stacked Likert bars with a zero-centred neutral segment, legend and percentage axis.",
    tags=["问卷", "survey", "likert", "堆叠"],
    aspect=1.0,
    options=[
        {"id": "percent", "type": "bool", "default": True, "label_zh": "百分比", "label_en": "Percent"},
        {"id": "wrap", "type": "int", "default": 30, "min": 12, "max": 60, "label_zh": "题项换行宽度", "label_en": "Statement wrap"},
    ],
    demo={
        "data": {"sample": "stats_likert", "mapping": {"label": "statement"}},
        "style": {"domain": "social", "journal": "apa"},
        "labels": {"x": "Share of respondents (%)"},
    },
    aliases=["likert_plot", "diverging_bar"],
)
def render_likert(ctx):
    ax = ctx.ax()
    data = ctx.table
    mapping = _mapping(ctx)
    label_name = mapping.get("label") or mapping.get("x") or mapping.get("statement")
    levels = mapping.get("levels")
    if not isinstance(levels, (list, tuple)):
        levels = _numeric_columns(data)
    else:
        levels = [str(name) for name in levels if data.has(str(name))]
    if len(levels) < 3:
        raise SpecError("the Likert plot needs at least three ordered level columns", "invalid_mapping", "mapping")
    counts = np.column_stack([data.numeric(str(name)) for name in levels]).astype(float)
    if isinstance(label_name, str) and data.has(label_name):
        statements = data.categorical(label_name)
        statements = [str(value) for value in statements]
    else:
        statements = [f"Item {index + 1}" for index in range(counts.shape[0])]
    row_totals = counts.sum(axis=1)
    row_totals[row_totals == 0] = 1.0
    if ctx.flag("percent", True):
        shares = counts / row_totals[:, None] * 100.0
        xlabel = _axis_label(ctx, "x", "Share of respondents (%)")
    else:
        shares = counts
        xlabel = _axis_label(ctx, "x", "Respondents")
    k = len(levels)
    cmap = _diverging_cmap(ctx)
    negative_count = k // 2
    positive_count = k - negative_count - (1 if k % 2 else 0)
    negative_positions = np.linspace(0.05, 0.40, negative_count) if negative_count > 1 else np.array([0.12])
    positive_positions = np.linspace(0.60, 0.95, positive_count) if positive_count > 1 else np.array([0.88])
    colours: list[str] = ["white"] * k
    for index in range(negative_count):
        colours[index] = to_hex(cmap(float(negative_positions[index])))
    for offset in range(positive_count):
        colours[k - positive_count + offset] = to_hex(cmap(float(positive_positions[offset])))
    midpoint = k // 2
    if k % 2:
        colours[midpoint] = _blend(_dark(ctx), str(ctx.style.get("axes_face", "#ffffff")), 0.62)
    centres = np.arange(counts.shape[0], dtype=float)
    if k % 2:
        neutral = shares[:, midpoint]
        ax.barh(centres, neutral, left=-neutral / 2.0, height=0.68, color=colours[midpoint],
                edgecolor="white", linewidth=0.4, zorder=3)
    else:
        neutral = np.zeros(counts.shape[0])
    left_cursor = -neutral / 2.0
    for index in range(midpoint - 1, -1, -1):
        widths = shares[:, index]
        ax.barh(centres, -widths, left=left_cursor, height=0.68, color=colours[index],
                edgecolor="white", linewidth=0.4, zorder=3)
        left_cursor = left_cursor - widths
    right_cursor = neutral / 2.0
    for index in range(midpoint + (1 if k % 2 else 0), k):
        widths = shares[:, index]
        ax.barh(centres, widths, left=right_cursor, height=0.68, color=colours[index],
                edgecolor="white", linewidth=0.4, zorder=3)
        right_cursor = right_cursor + widths
    negative_extent = float(np.max(-left_cursor)) if left_cursor.size else 0.0
    positive_extent = float(np.max(right_cursor)) if right_cursor.size else 0.0
    max_extent = max(negative_extent, positive_extent, 1.0)
    step = 10.0
    for candidate in (1.0, 2.0, 5.0, 10.0, 20.0, 25.0, 50.0, 100.0, 200.0, 250.0, 500.0, 1000.0):
        if max_extent / candidate <= 7.0:
            step = candidate
            break
    else:
        step = max(1.0, float(np.ceil(max_extent / 6.0)))
    negative_ticks = np.arange(0.0, -negative_extent - 1e-9, -step)
    positive_ticks = np.arange(0.0, positive_extent + 1e-9, step)
    ticks = np.concatenate([negative_ticks[::-1], positive_ticks[1:]])
    if ticks.size < 2:
        ticks = np.array([-step, 0.0, step])
    ax.set_xticks(ticks)
    ax.set_xticklabels([f"{abs(value):.0f}" for value in ticks])
    ax.set_xlim(-max(negative_extent * 1.02, step), max(positive_extent * 1.02, step))
    ax.set_yticks(centres)
    wrap = max(12, int(ctx.num("wrap", 30)))
    ax.set_yticklabels([_wrap(statement, wrap) for statement in statements], linespacing=1.15)
    ax.invert_yaxis()
    ax.axvline(0.0, color=REF_COLOR, lw=0.5, ls="--", zorder=1)
    labels = [_pretty(level) for level in levels]
    handles = [Patch(facecolor=colours[index], edgecolor="none", label=labels[index]) for index in range(k)]
    ax.set_ylim(counts.shape[0] - 0.5, -0.5)
    ctx.finish(ax, xlabel=xlabel, ylabel="", legend=False)
    ctx.fig.legend(
        handles=handles, labels=labels, loc="lower center", ncol=min(k, 5),
        frameon=False, fontsize=_font(ctx, "legend.fontsize"),
        handlelength=1.1, handletextpad=0.4, columnspacing=1.2,
        bbox_to_anchor=(0.5, -0.06),
    )
    return ctx.fig
