"""Basic chart family: lines, scatters, bars, areas, pies, steps.

These renderers are also the reference implementation for the renderer contract:
read data from the context, use ``ctx.color()`` / ``ctx.opt()`` / ``ctx.finish()``
and never hard-code fonts, spines or figure geometry.
"""
from __future__ import annotations

import numpy as np

from .. import helpers as H
from ..palettes import text_color_on
from ..registry import register

MARKERS = ("o", "s", "^", "D", "v", "P", "X", "*")
LINESTYLES = ("-", "--", "-.", ":")


# ---------------------------------------------------------------------------
# Shared local helpers
# ---------------------------------------------------------------------------

def _valid_series(ctx) -> list[dict]:
    return [item for item in ctx.series() if np.asarray(item.get("y", [])).size > 0]


def _categories(series: list[dict]) -> list[str] | None:
    for item in series:
        categories = item.get("categories") or item.get("x_labels") or item.get("point_labels")
        if categories is not None:
            return [str(value) for value in categories]
    return None


def _category_axis(ax, categories: list[str], rotate=None):
    positions = np.arange(len(categories), dtype=float)
    ax.set_xticks(positions)
    ax.set_xticklabels(categories)
    if rotate is None:
        longest = max((len(str(text)) for text in categories), default=0)
        rotate = 35 if longest > 9 else 0
    if rotate:
        ax.tick_params(axis="x", labelrotation=float(rotate))
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    return positions


def _auto_rotate(categories: list[str] | None) -> int:
    if not categories:
        return 0
    longest = max((len(str(text)) for text in categories), default=0)
    return 35 if longest > 9 else 0


def _zero_baseline(ax):
    y0, y1 = ax.get_ylim()
    if y0 > 0:
        ax.set_ylim(bottom=0.0)
    elif y1 < 0:
        ax.set_ylim(top=0.0)


# ---------------------------------------------------------------------------
# Line family
# ---------------------------------------------------------------------------

@register(
    "line",
    zh="折线图",
    en="Line chart",
    category="basic",
    summary_zh="一组或多组连续变量的折线图，支持误差带、标记点与平滑。",
    summary_en="One or more continuous series with error bands, markers and smoothing.",
    tags=["时间序列", "趋势", "time series", "trend"],
    options=[
        {"id": "marker", "type": "bool", "default": True, "label_zh": "显示数据点", "label_en": "Show markers"},
        {"id": "smooth", "type": "int", "default": 0, "min": 0, "max": 31, "label_zh": "平滑窗口", "label_en": "Smoothing window"},
        {"id": "band", "type": "bool", "default": True, "label_zh": "误差带", "label_en": "Error band"},
        {"id": "markevery", "type": "int", "default": 1, "min": 1, "max": 20, "label_zh": "标记间隔", "label_en": "Marker every N points"},
    ],
    demo={
        "data": {"sample": "growth", "mapping": {"x": "time_h", "y": "od600", "group": "condition"}},
        "style": {"domain": "life-science", "journal": "nature"},
        "labels": {"x": "Time (h)", "y": "OD$_{600}$"},
    },
)
def render_line(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = item.get("color") or ctx.color(index)
        markevery = max(1, int(ctx.num("markevery", 1)))
        ax.plot(
            x,
            y,
            color=colour,
            lw=float(ctx.num("linewidth", ctx.style["line"]["lw"])),
            marker=("o" if ctx.flag("marker", True) else None),
            ms=float(ctx.num("markersize", ctx.style["line"]["ms"])),
            markevery=markevery,
            mfc=colour,
            mec="white",
            mew=0.4,
            label=item.get("label") or item.get("name"),
            zorder=3,
        )
        yerr = item.get("yerr")
        if yerr is not None and ctx.flag("band", True):
            err = np.asarray(yerr, dtype=float)
            mask = np.isfinite(x) & np.isfinite(y) & np.isfinite(err[: x.size])
            if mask.any():
                ax.fill_between(x[mask], (y - err[: x.size])[mask], (y + err[: x.size])[mask], color=colour, alpha=0.16, lw=0, zorder=2)
    ctx.finish(ax, legend=True if len(series) > 1 else False)
    return ctx.fig


@register(
    "multiline",
    zh="多序列折线",
    en="Multi-series lines",
    category="basic",
    summary_zh="强调多条曲线的可区分性：自动轮换标记与线型，可选对数纵轴。",
    summary_en="Distinguishable multi-series lines with cycling markers and line styles, optional log y.",
    tags=["对比", "comparison", "log"],
    options=[
        {"id": "markers", "type": "bool", "default": True, "label_zh": "标记点", "label_en": "Markers"},
        {"id": "linestyles", "type": "bool", "default": True, "label_zh": "线型区分", "label_en": "Vary line styles"},
        {"id": "yscale", "type": "enum", "default": "linear", "choices": ["linear", "log"], "label_zh": "纵轴尺度", "label_en": "Y scale"},
        {"id": "legend_cols", "type": "int", "default": 1, "min": 1, "max": 3, "label_zh": "图例列数", "label_en": "Legend columns"},
    ],
    demo={
        "data": {"sample": "growth", "mapping": {"x": "time_h", "y": "od600", "group": "condition"}},
        "style": {"domain": "physics", "journal": "aps"},
        "labels": {"x": "Time (h)", "y": "OD$_{600}$"},
    },
)
def render_multiline(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    show_markers = ctx.flag("markers", True)
    vary = ctx.flag("linestyles", True)
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = item.get("color") or ctx.color(index)
        marker = MARKERS[index % len(MARKERS)] if show_markers else None
        linestyle = LINESTYLES[index % len(LINESTYLES)] if vary else "-"
        ax.plot(
            x,
            y,
            color=colour,
            lw=float(ctx.num("linewidth", ctx.style["line"]["lw"])),
            marker=marker,
            ms=float(ctx.num("markersize", ctx.style["line"]["ms"])) + 0.4,
            mfc="white",
            mec=colour,
            mew=0.8,
            linestyle=linestyle,
            label=item.get("label") or item.get("name"),
            zorder=3,
        )
    yscale = str(ctx.opt("yscale", "linear"))
    ctx.finish(ax, yscale=yscale, legend={"ncol": int(ctx.num("legend_cols", 1))})
    return ctx.fig


@register(
    "step",
    zh="阶梯图",
    en="Step chart",
    category="basic",
    summary_zh="离散事件或状态变化的阶梯曲线，可指定台阶对齐方式。",
    summary_en="Step curve for discrete events or state changes with configurable alignment.",
    tags=["事件", "状态", "event", "state"],
    options=[
        {"id": "where", "type": "enum", "default": "mid", "choices": ["pre", "mid", "post"], "label_zh": "台阶对齐", "label_en": "Step alignment"},
        {"id": "fill", "type": "bool", "default": False, "label_zh": "填充面积", "label_en": "Fill area"},
    ],
    demo={
        "data": {
            "series": [
                {"name": "Cohort A", "x": [0, 1, 2, 3, 4, 5, 6, 7, 8], "y": [0, 0, 1, 1, 2, 3, 4, 5, 5]},
                {"name": "Cohort B", "x": [0, 1, 2, 3, 4, 5, 6, 7, 8], "y": [0, 1, 1, 1, 2, 2, 3, 4, 4]},
            ]
        },
        "style": {"domain": "general"},
        "labels": {"x": "Follow-up (years)", "y": "Events"},
    },
)
def render_step(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    where = str(ctx.opt("where", "mid"))
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = item.get("color") or ctx.color(index)
        ax.step(x, y, where=where, color=colour, lw=float(ctx.num("linewidth", ctx.style["line"]["lw"])), label=item.get("label") or item.get("name"), zorder=3)
        if ctx.flag("fill", False):
            ax.fill_between(x, 0, y, step=where, color=colour, alpha=0.14, lw=0)
    ctx.finish(ax, legend=True if len(series) > 1 else False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Scatter family
# ---------------------------------------------------------------------------

@register(
    "scatter",
    zh="散点图",
    en="Scatter plot",
    category="basic",
    summary_zh="分组散点图，可叠加回归线与 95% 置信带，并标注相关统计量。",
    summary_en="Grouped scatter with optional regression line, 95% CI band and correlation statistics.",
    tags=["相关", "correlation", "回归", "regression"],
    options=[
        {"id": "regression", "type": "bool", "default": False, "label_zh": "叠加回归线", "label_en": "Regression line"},
        {"id": "ci", "type": "bool", "default": True, "label_zh": "95% 置信带", "label_en": "95% CI band"},
        {"id": "alpha", "type": "float", "default": 0.78, "min": 0.05, "max": 1.0, "step": 0.05, "label_zh": "透明度", "label_en": "Opacity"},
        {"id": "marker_size", "type": "float", "default": 18.0, "min": 2.0, "max": 200.0, "step": 1.0, "label_zh": "点大小", "label_en": "Marker size"},
        {"id": "stats", "type": "bool", "default": True, "label_zh": "显示统计量", "label_en": "Show statistics"},
    ],
    demo={
        "data": {"sample": "scatter", "mapping": {"x": "gene_expression", "y": "protein_level", "group": "tissue"}},
        "style": {"domain": "omics", "journal": "nature"},
        "labels": {"x": "Gene expression (log$_2$ TPM)", "y": "Protein abundance (log$_2$)"},
    },
)
def render_scatter(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    alpha = float(ctx.num("alpha", 0.78))
    size = float(ctx.num("marker_size", 18.0))
    do_fit = ctx.flag("regression", False)
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = item.get("color") or ctx.color(index)
        ax.scatter(x, y, s=size, color=colour, alpha=alpha, edgecolors="white", linewidths=0.3, label=item.get("label") or item.get("name"), zorder=3)
        if do_fit and x.size >= 3:
            fit = H.fit_linear(x, y)
            if np.isfinite(fit["slope"]):
                grid = np.linspace(float(x.min()), float(x.max()), 120)
                ax.plot(grid, fit["slope"] * grid + fit["intercept"], color=colour, lw=float(ctx.style["line"]["lw"]) + 0.2, zorder=4)
                if ctx.flag("ci", True):
                    band = H.bootstrap_fit_ci(x, y, seed=ctx._seed + index)
                    if band:
                        ax.fill_between(band["grid"], band["lower"], band["upper"], color=colour, alpha=0.13, lw=0, zorder=2)
                if ctx.flag("stats", True) and len(series) == 1:
                    label = f"$r$ = {fit.get('r2', float('nan')) ** 0.5:.2f}" if np.isfinite(fit.get("r2", float("nan"))) else ""
                    note = label + (f", {H.format_p(fit['p'])}" if np.isfinite(fit.get("p", float("nan"))) else "")
                    if note.strip(", "):
                        H.corner_note(ax, note, loc="upper left", fontsize=ctx.style["rc"]["legend.fontsize"])
    ctx.finish(ax, legend=True if len(series) > 1 else False)
    return ctx.fig


@register(
    "bubble",
    zh="气泡图",
    en="Bubble chart",
    category="basic",
    summary_zh="用点面积编码第三个变量，附尺寸图例。",
    summary_en="Encode a third variable with marker area, with a size legend.",
    tags=["三变量", "three variables"],
    options=[
        {"id": "size_scale", "type": "float", "default": 420.0, "min": 40.0, "max": 2000.0, "step": 10.0, "label_zh": "气泡尺度", "label_en": "Bubble scale"},
        {"id": "alpha", "type": "float", "default": 0.7, "min": 0.05, "max": 1.0, "step": 0.05, "label_zh": "透明度", "label_en": "Opacity"},
        {"id": "size_legend", "type": "bool", "default": True, "label_zh": "尺寸图例", "label_en": "Size legend"},
    ],
    demo={
        "data": {"sample": "scatter", "mapping": {"x": "gene_expression", "y": "protein_level", "group": "tissue", "size": "cell_count"}},
        "style": {"domain": "omics"},
        "labels": {"x": "Gene expression (log$_2$ TPM)", "y": "Protein abundance (log$_2$)"},
    },
)
def render_bubble(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    scale = float(ctx.num("size_scale", 420.0))
    alpha = float(ctx.num("alpha", 0.7))
    all_sizes = np.concatenate([np.asarray(item["size"], dtype=float) for item in series if item.get("size") is not None] or [np.asarray([1.0])])
    finite = all_sizes[np.isfinite(all_sizes)]
    lo = float(np.min(finite)) if finite.size else 1.0
    hi = float(np.max(finite)) if finite.size else 2.0
    if hi == lo:
        hi = lo + 1.0

    def scaled(values):
        values = np.asarray(values, dtype=float)
        return 18.0 + (scale - 18.0) * np.clip((values - lo) / (hi - lo), 0, 1)

    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = item.get("color") or ctx.color(index)
        sizes = np.asarray(item.get("size"), dtype=float)[: x.size] if item.get("size") is not None else np.full(x.size, (lo + hi) / 2)
        ax.scatter(x, y, s=scaled(sizes), color=colour, alpha=alpha, edgecolors="white", linewidths=0.5, label=item.get("label") or item.get("name"), zorder=3)
    ctx.finish(ax, legend=True if len(series) > 1 else False)

    if ctx.flag("size_legend", True) and hi > lo:
        handles = []
        labels = []
        for value in np.linspace(lo, hi, 3):
            handles.append(
                type(ax).__mro__ and __import__("matplotlib.lines", fromlist=["Line2D"]).Line2D([], [], marker="o", linestyle="", color="#555555", markerfacecolor="#555555", markersize=np.sqrt(scaled(value)), alpha=0.55)
            )
            labels.append(f"{value:.0f}")
        legend = ax.legend(handles, labels, loc="lower right", frameon=False, fontsize=ctx.style["rc"]["legend.fontsize"], labelspacing=0.9, borderaxespad=0.6, title="n")
        legend.get_title().set_fontsize(ctx.style["rc"]["legend.title_fontsize"])
    return ctx.fig


# ---------------------------------------------------------------------------
# Bar family
# ---------------------------------------------------------------------------

@register(
    "bar",
    zh="柱状图",
    en="Bar chart",
    category="basic",
    summary_zh="单序列柱状图，支持误差棒、数值标签与自动旋转的类别标签。",
    summary_en="Single-series bars with error bars, value labels and automatic category rotation.",
    tags=["比较", "comparison"],
    options=[
        {"id": "width", "type": "float", "default": 0.64, "min": 0.2, "max": 0.95, "step": 0.02, "label_zh": "柱宽", "label_en": "Bar width"},
        {"id": "show_values", "type": "bool", "default": False, "label_zh": "显示数值", "label_en": "Value labels"},
        {"id": "rotate", "type": "int", "default": -1, "min": -1, "max": 90, "label_zh": "标签旋转", "label_en": "Label rotation"},
        {"id": "yerr", "type": "bool", "default": True, "label_zh": "误差棒", "label_en": "Error bars"},
        {"id": "color_by_category", "type": "bool", "default": False, "label_zh": "按类别着色", "label_en": "Colour by category"},
    ],
    demo={
        "data": {"sample": "bars", "mapping": {"x": "treatment", "y": "relative_viability_pct", "yerr": "sem"}},
        "style": {"domain": "life-science"},
        "labels": {"x": "", "y": "Relative viability (%)"},
    },
)
def render_bar(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    item = series[0]
    categories = _categories(series) or [str(int(value)) for value in item["x"]]
    positions = np.arange(len(categories), dtype=float)
    values = np.asarray(item["y"], dtype=float)[: len(categories)]
    width = float(ctx.num("width", 0.64))
    colour_by_cat = ctx.flag("color_by_category", False)
    colours = ctx.colors(len(categories)) if colour_by_cat else [ctx.color(0)] * len(categories)
    bars = ax.bar(positions, values, width=width, color=colours, edgecolor="white", linewidth=0.4, zorder=2)
    if ctx.flag("yerr", True) and item.get("yerr") is not None:
        err = np.asarray(item["yerr"], dtype=float)[: len(categories)]
        ax.errorbar(positions, values, yerr=err, fmt="none", ecolor="#333333", elinewidth=float(ctx.style["errorbar"]["elinewidth"]), capsize=float(ctx.style["errorbar"]["capsize"]), capthick=float(ctx.style["errorbar"]["capthick"]), zorder=3)
    rotate = int(ctx.num("rotate", -1))
    _category_axis(ax, categories, rotate=None if rotate < 0 else rotate)
    _zero_baseline(ax)
    if ctx.flag("show_values", False):
        H.value_labels(ax, bars, fmt="{:g}")
    ctx.finish(ax, legend=False)
    return ctx.fig


@register(
    "bar_grouped",
    zh="分组柱状图",
    en="Grouped bar chart",
    category="basic",
    summary_zh="按组并列的柱状图，用于多条件比较，支持误差棒与图例。",
    summary_en="Side-by-side grouped bars for multi-condition comparisons with error bars and legend.",
    tags=["多组", "multi-group"],
    options=[
        {"id": "width", "type": "float", "default": 0.82, "min": 0.3, "max": 1.0, "step": 0.02, "label_zh": "组宽", "label_en": "Group width"},
        {"id": "show_values", "type": "bool", "default": False, "label_zh": "显示数值", "label_en": "Value labels"},
        {"id": "rotate", "type": "int", "default": -1, "min": -1, "max": 90, "label_zh": "标签旋转", "label_en": "Label rotation"},
        {"id": "yerr", "type": "bool", "default": True, "label_zh": "误差棒", "label_en": "Error bars"},
    ],
    demo={
        "data": {"sample": "bars_grouped", "mapping": {"x": "treatment", "y": "relative_viability_pct", "group": "sex", "yerr": "sem"}},
        "style": {"domain": "life-science", "journal": "cell"},
        "labels": {"x": "", "y": "Relative viability (%)", "legend": "Sex"},
    },
)
def render_bar_grouped(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    categories = _categories(series) or [str(int(value)) for value in series[0]["x"]]
    n_groups = max(len(series), 1)
    group_width = float(ctx.num("width", 0.82))
    bar_width = group_width / n_groups
    positions = np.arange(len(categories), dtype=float)
    for index, item in enumerate(series):
        values = np.asarray(item["y"], dtype=float)[: len(categories)]
        offsets = positions - group_width / 2 + bar_width * (index + 0.5)
        colour = item.get("color") or ctx.color(index)
        bars = ax.bar(offsets, values, width=bar_width, color=colour, edgecolor="white", linewidth=0.4, label=item.get("label") or item.get("name"), zorder=2)
        if ctx.flag("yerr", True) and item.get("yerr") is not None:
            err = np.asarray(item["yerr"], dtype=float)[: len(categories)]
            ax.errorbar(offsets, values, yerr=err, fmt="none", ecolor="#333333", elinewidth=float(ctx.style["errorbar"]["elinewidth"]), capsize=float(ctx.style["errorbar"]["capsize"]), capthick=float(ctx.style["errorbar"]["capthick"]), zorder=3)
        if ctx.flag("show_values", False):
            H.value_labels(ax, bars, fmt="{:g}")
    rotate = int(ctx.num("rotate", -1))
    _category_axis(ax, categories, rotate=None if rotate < 0 else rotate)
    ax.set_xlim(-0.6, len(categories) - 0.4)
    _zero_baseline(ax)
    ctx.finish(ax, legend=True)
    return ctx.fig


@register(
    "bar_stacked",
    zh="堆叠柱状图",
    en="Stacked bar chart",
    category="basic",
    summary_zh="堆叠或百分比堆叠柱状图，适合组成与占比比较。",
    summary_en="Stacked or 100% stacked bars for composition and share comparisons.",
    tags=["占比", "composition", "百分百堆叠"],
    options=[
        {"id": "width", "type": "float", "default": 0.66, "min": 0.2, "max": 0.95, "step": 0.02, "label_zh": "柱宽", "label_en": "Bar width"},
        {"id": "percent", "type": "bool", "default": False, "label_zh": "百分比堆叠", "label_en": "100% stacked"},
        {"id": "rotate", "type": "int", "default": -1, "min": -1, "max": 90, "label_zh": "标签旋转", "label_en": "Label rotation"},
    ],
    demo={
        "data": {"sample": "bars_grouped", "mapping": {"x": "treatment", "y": "relative_viability_pct", "group": "sex"}},
        "style": {"domain": "social"},
        "labels": {"x": "", "y": "Relative viability (%)", "legend": "Sex"},
    },
)
def render_bar_stacked(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    categories = _categories(series) or [str(int(value)) for value in series[0]["x"]]
    positions = np.arange(len(categories), dtype=float)
    width = float(ctx.num("width", 0.66))
    matrix = []
    for item in series:
        values = np.asarray(item["y"], dtype=float)[: len(categories)]
        matrix.append(values)
    stack = np.vstack(matrix)
    if ctx.flag("percent", False):
        totals = np.sum(stack, axis=0)
        totals[totals == 0] = 1.0
        stack = stack / totals * 100.0
        if not ctx.label("y"):
            ctx.labels["y"] = "Share (%)"
    bottom = np.zeros(len(categories), dtype=float)
    bars_by_series = []
    for index, item in enumerate(series):
        colour = item.get("color") or ctx.color(index)
        bars = ax.bar(positions, stack[index], bottom=bottom, width=width, color=colour, edgecolor="white", linewidth=0.5, label=item.get("label") or item.get("name"), zorder=2)
        bars_by_series.append(bars)
        bottom = bottom + stack[index]
    _category_axis(ax, categories, rotate=None if int(ctx.num("rotate", -1)) < 0 else int(ctx.num("rotate", -1)))
    ax.set_xlim(-0.6, len(categories) - 0.4)
    if not ctx.flag("percent", False):
        _zero_baseline(ax)
    else:
        ax.set_ylim(0, 100)
    ctx.finish(ax, legend=True)
    return ctx.fig


@register(
    "bar_h",
    zh="条形图（横向）",
    en="Horizontal bars",
    category="basic",
    summary_zh="横向条形图，类别名较长时更清晰，可选排序。",
    summary_en="Horizontal bars that stay readable with long category names, with optional sorting.",
    tags=["长标签", "long labels", "排序"],
    options=[
        {"id": "sort", "type": "bool", "default": False, "label_zh": "按数值排序", "label_en": "Sort by value"},
        {"id": "show_values", "type": "bool", "default": True, "label_zh": "显示数值", "label_en": "Value labels"},
        {"id": "height", "type": "float", "default": 0.66, "min": 0.2, "max": 0.95, "step": 0.02, "label_zh": "条宽", "label_en": "Bar thickness"},
    ],
    demo={
        "data": {"sample": "bars", "mapping": {"x": "treatment", "y": "relative_viability_pct"}},
        "style": {"domain": "clinical"},
        "labels": {"x": "Relative viability (%)", "y": ""},
    },
)
def render_bar_h(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    item = series[0]
    categories = _categories(series) or [str(int(value)) for value in item["x"]]
    values = np.asarray(item["y"], dtype=float)[: len(categories)]
    order = np.arange(len(categories))
    if ctx.flag("sort", False):
        order = np.argsort(values)
    positions = np.arange(len(categories), dtype=float)
    height = float(ctx.num("height", 0.66))
    colours = [ctx.color(0)] * len(categories)
    bars = ax.barh(positions, values[order], height=height, color=colours, edgecolor="white", linewidth=0.4, zorder=2)
    ax.set_yticks(positions)
    ax.set_yticklabels([categories[i] for i in order])
    if item.get("yerr") is not None:
        err = np.asarray(item["yerr"], dtype=float)[: len(categories)]
        ax.errorbar(values[order], positions, xerr=err[order], fmt="none", ecolor="#333333", elinewidth=float(ctx.style["errorbar"]["elinewidth"]), capsize=float(ctx.style["errorbar"]["capsize"]), capthick=float(ctx.style["errorbar"]["capthick"]), zorder=3)
    if ctx.flag("show_values", True):
        xmax = float(np.nanmax(values)) if np.isfinite(values).any() else 1.0
        for bar in bars:
            width_value = bar.get_width()
            ax.annotate(f"{width_value:g}", xy=(width_value, bar.get_y() + bar.get_height() / 2), xytext=(3, 0), textcoords="offset points", va="center", fontsize=ctx.style["rc"]["xtick.labelsize"], color="#333333")
        ax.set_xlim(right=xmax * 1.14)
    ax.set_ylim(-0.6, len(categories) - 0.4)
    ctx.finish(ax, legend=False)
    return ctx.fig


@register(
    "lollipop",
    zh="棒棒糖图",
    en="Lollipop chart",
    category="basic",
    summary_zh="低墨量的条形替代方案，适合排序后的类别比较。",
    summary_en="A low-ink alternative to bars for ranked category comparisons.",
    tags=["排序", "rank", "低墨量"],
    options=[
        {"id": "sort", "type": "bool", "default": True, "label_zh": "按数值排序", "label_en": "Sort by value"},
        {"id": "show_values", "type": "bool", "default": False, "label_zh": "显示数值", "label_en": "Value labels"},
    ],
    demo={
        "data": {"sample": "bars", "mapping": {"x": "treatment", "y": "relative_viability_pct"}},
        "style": {"domain": "general"},
        "labels": {"x": "", "y": "Relative viability (%)"},
    },
)
def render_lollipop(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    item = series[0]
    categories = _categories(series) or [str(int(value)) for value in item["x"]]
    values = np.asarray(item["y"], dtype=float)[: len(categories)]
    order = np.argsort(values) if ctx.flag("sort", True) else np.arange(len(categories))
    positions = np.arange(len(categories), dtype=float)
    colour = ctx.color(0)
    ax.vlines(positions, 0, values[order], color=colour, lw=float(ctx.style["line"]["lw"]), alpha=0.85, zorder=2)
    ax.scatter(positions, values[order], s=(float(ctx.style["line"]["ms"]) * 3.0) ** 2 * 0.55, color=colour, edgecolors="white", linewidths=0.5, zorder=3)
    ax.set_xticks(positions)
    ax.set_xticklabels([categories[i] for i in order])
    if _auto_rotate([categories[i] for i in order]):
        ax.tick_params(axis="x", labelrotation=35)
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    if ctx.flag("show_values", False):
        for position, value in zip(positions, values[order]):
            ax.annotate(f"{value:g}", xy=(position, value), xytext=(0, 4), textcoords="offset points", ha="center", va="bottom", fontsize=ctx.style["rc"]["xtick.labelsize"], color="#333333")
    _zero_baseline(ax)
    ctx.finish(ax, legend=False)
    return ctx.fig


@register(
    "errorbar",
    zh="误差棒图",
    en="Error-bar plot",
    category="basic",
    summary_zh="均值±误差的散点/连线图，支持双向误差棒与对数坐标。",
    summary_en="Mean +/- error points and lines with bidirectional error bars and log scales.",
    tags=["误差", "uncertainty", "测量"],
    options=[
        {"id": "xerr", "type": "bool", "default": False, "label_zh": "横向误差", "label_en": "X error bars"},
        {"id": "connect", "type": "bool", "default": True, "label_zh": "连接数据点", "label_en": "Connect points"},
        {"id": "yscale", "type": "enum", "default": "linear", "choices": ["linear", "log"], "label_zh": "纵轴尺度", "label_en": "Y scale"},
        {"id": "xscale", "type": "enum", "default": "linear", "choices": ["linear", "log"], "label_zh": "横轴尺度", "label_en": "X scale"},
    ],
    demo={
        "data": {"sample": "bars_grouped", "mapping": {"x": "treatment", "y": "relative_viability_pct", "group": "sex", "yerr": "sem"}},
        "style": {"domain": "physics"},
        "labels": {"x": "", "y": "Relative viability (%)"},
    },
)
def render_errorbar(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    connect = ctx.flag("connect", True)
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = item.get("color") or ctx.color(index)
        yerr = np.asarray(item.get("yerr"), dtype=float)[: x.size] if item.get("yerr") is not None else None
        xerr = np.asarray(item.get("xerr"), dtype=float)[: x.size] if item.get("xerr") is not None and ctx.flag("xerr", False) else None
        ax.errorbar(
            x,
            y,
            yerr=yerr,
            xerr=xerr,
            fmt=("o-" if connect else "o"),
            color=colour,
            ecolor=colour,
            lw=float(ctx.style["line"]["lw"]),
            ms=float(ctx.style["line"]["ms"]) + 0.6,
            mfc="white",
            mec=colour,
            mew=0.9,
            capsize=float(ctx.style["errorbar"]["capsize"]),
            capthick=float(ctx.style["errorbar"]["capthick"]),
            elinewidth=float(ctx.style["errorbar"]["elinewidth"]),
            label=item.get("label") or item.get("name"),
            zorder=3,
        )
    ctx.finish(ax, xscale=str(ctx.opt("xscale", "linear")), yscale=str(ctx.opt("yscale", "linear")), legend=True if len(series) > 1 else False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Area family
# ---------------------------------------------------------------------------

@register(
    "area",
    zh="面积图",
    en="Area chart",
    category="basic",
    summary_zh="以填充面积强调量级的曲线，可叠加误差带。",
    summary_en="Filled-area curves that emphasise magnitude, with optional error bands.",
    tags=["量级", "magnitude"],
    options=[
        {"id": "alpha", "type": "float", "default": 0.22, "min": 0.03, "max": 0.8, "step": 0.02, "label_zh": "填充透明度", "label_en": "Fill opacity"},
        {"id": "baseline", "type": "float", "default": 0.0, "label_zh": "基线", "label_en": "Baseline"},
    ],
    demo={
        "data": {"sample": "growth", "mapping": {"x": "time_h", "y": "od600", "group": "condition"}},
        "style": {"domain": "life-science"},
        "labels": {"x": "Time (h)", "y": "OD$_{600}$"},
    },
)
def render_area(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    alpha = float(ctx.num("alpha", 0.22))
    baseline = float(ctx.num("baseline", 0.0))
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = item.get("color") or ctx.color(index)
        ax.fill_between(x, baseline, y, color=colour, alpha=alpha, lw=0, zorder=2)
        ax.plot(x, y, color=colour, lw=float(ctx.style["line"]["lw"]), label=item.get("label") or item.get("name"), zorder=3)
    ctx.finish(ax, legend=True if len(series) > 1 else False)
    return ctx.fig


@register(
    "area_stacked",
    zh="堆叠面积图",
    en="Stacked area chart",
    category="basic",
    summary_zh="展示多个组成部分随时间变化的累计贡献。",
    summary_en="Cumulative contribution of several components over a shared x.",
    tags=["累计", "composition", "时间序列"],
    options=[
        {"id": "alpha", "type": "float", "default": 0.82, "min": 0.2, "max": 1.0, "step": 0.02, "label_zh": "填充透明度", "label_en": "Fill opacity"},
        {"id": "percent", "type": "bool", "default": False, "label_zh": "百分比堆叠", "label_en": "100% stacked"},
    ],
    demo={
        "data": {
            "series": [
                {"name": "Industry", "x": [2018, 2019, 2020, 2021, 2022, 2023], "y": [31, 33, 34, 36, 38, 40]},
                {"name": "Transport", "x": [2018, 2019, 2020, 2021, 2022, 2023], "y": [22, 23, 20, 22, 24, 25]},
                {"name": "Buildings", "x": [2018, 2019, 2020, 2021, 2022, 2023], "y": [18, 19, 20, 21, 22, 23]},
                {"name": "Agriculture", "x": [2018, 2019, 2020, 2021, 2022, 2023], "y": [12, 12, 13, 12, 12, 11]},
            ]
        },
        "style": {"domain": "earth"},
        "labels": {"x": "Year", "y": "Emissions (Gt CO$_2$e)", "legend": ""},
    },
)
def render_area_stacked(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    alpha = float(ctx.num("alpha", 0.82))
    matrix = [np.asarray(item["y"], dtype=float) for item in series]
    n = min(len(values) for values in matrix)
    matrix = np.vstack([values[:n] for values in matrix])
    x = np.asarray(series[0]["x"], dtype=float)[:n]
    if ctx.flag("percent", False):
        totals = matrix.sum(axis=0)
        totals[totals == 0] = 1.0
        matrix = matrix / totals * 100.0
    if not np.all(np.isfinite(x)):
        x = np.arange(n, dtype=float)
    ax.stackplot(x, matrix, labels=[item.get("label") or item.get("name") for item in series], colors=ctx.colors(len(series)), alpha=alpha, edgecolor="white", linewidth=0.4)
    ctx.finish(ax, legend=True)
    return ctx.fig


# ---------------------------------------------------------------------------
# Pie / donut
# ---------------------------------------------------------------------------

@register(
    "pie",
    zh="饼图 / 环形图",
    en="Pie / donut",
    category="basic",
    summary_zh="单一时间点的组成占比，可选环形与百分比标注；多类别时优先考虑条形图。",
    summary_en="Composition at a single time point, optional donut and percentage labels; prefer bars for many categories.",
    tags=["占比", "composition"],
    aspect=0.92,
    options=[
        {"id": "donut", "type": "bool", "default": False, "label_zh": "环形", "label_en": "Donut"},
        {"id": "show_pct", "type": "bool", "default": True, "label_zh": "显示百分比", "label_en": "Percent labels"},
        {"id": "start_angle", "type": "int", "default": 90, "min": 0, "max": 360, "label_zh": "起始角度", "label_en": "Start angle"},
        {"id": "legend", "type": "bool", "default": True, "label_zh": "显示图例", "label_en": "Show legend"},
    ],
    demo={
        "data": {
            "series": [
                {
                    "name": "Cell composition",
                    "x": [0, 1, 2, 3, 4],
                    "y": [38, 26, 18, 11, 7],
                    "categories": ["Epithelial", "Immune", "Stromal", "Endothelial", "Other"],
                }
            ]
        },
        "style": {"domain": "clinical"},
        "labels": {"title": ""},
    },
)
def render_pie(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    item = series[0]
    categories = _categories(series) or [f"Group {i + 1}" for i in range(len(item["y"]))]
    values = np.asarray(item["y"], dtype=float)[: len(categories)]
    colours = ctx.colors(len(categories))
    donut = ctx.flag("donut", False)
    pct = ctx.flag("show_pct", True)

    def formatter(percentage):
        if not pct:
            return ""
        return f"{percentage:.1f}%" if percentage >= 3 else ""

    wedges, _texts, autotexts = ax.pie(
        values,
        colors=colours,
        startangle=float(ctx.num("start_angle", 90)),
        counterclock=False,
        wedgeprops={"edgecolor": "white", "linewidth": 0.7, "width": 0.42 if donut else 1.0},
        autopct=formatter,
        pctdistance=0.72 if donut else 0.66,
        textprops={"fontsize": ctx.style["rc"]["xtick.labelsize"], "color": "#ffffff"},
    )
    for wedge, text in zip(wedges, autotexts):
        text.set_fontsize(ctx.style["rc"]["xtick.labelsize"])
        text.set_fontweight("normal")
        try:
            text.set_color(text_color_on(wedge.get_facecolor()))
        except Exception:
            pass
    ax.set_aspect("equal")
    ax.set_axis_off()
    if ctx.flag("legend", True):
        ax.legend(
            wedges,
            [f"{label} ({value:g})" for label, value in zip(categories, values)],
            loc="center left",
            bbox_to_anchor=(1.0, 0.5),
            frameon=False,
            fontsize=ctx.style["rc"]["legend.fontsize"],
            handlelength=0.9,
            handleheight=0.9,
            labelspacing=0.5,
        )
    ctx.add_title()
    return ctx.fig
