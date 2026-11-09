"""Economics & finance renderers: time series with bands, fan charts, waterfalls,
tornado sensitivity diagrams and funnel plots.

AER-style restraint: horizontal reference lines, Times typography and open axes are
supplied by the ``economics`` domain preset; these renderers only draw content.
"""
from __future__ import annotations

import numpy as np

from matplotlib.lines import Line2D
from matplotlib.patches import Patch

from .. import helpers as H
from ..registry import register
from ..spec import SpecError


# ---------------------------------------------------------------------------
# Local helpers
# ---------------------------------------------------------------------------

def _mapping(ctx) -> dict:
    mapping = getattr(ctx.table, "mapping", None)
    return mapping if isinstance(mapping, dict) else {}


def _column(ctx, key: str, default=None):
    name = _mapping(ctx).get(key)
    if isinstance(name, str) and ctx.table.has(name):
        values = ctx.table.numeric(name)
        if values.size:
            return values
    return default


def _categorical(ctx, key: str):
    name = _mapping(ctx).get(key)
    if isinstance(name, str) and ctx.table.has(name):
        return [str(value) for value in ctx.table.categorical(name)]
    return None


def _valid_series(ctx) -> list[dict]:
    out = []
    for item in ctx.series():
        if np.asarray(item.get("y", []), dtype=float).size >= 2:
            out.append(item)
    return out


def _category_names(ctx, series) -> list[str]:
    for item in series:
        cats = item.get("categories") or item.get("x_labels")
        if cats is not None:
            return [str(value) for value in cats]
    mapped = _categorical(ctx, "x")
    if mapped:
        return mapped
    return [str(index + 1) for index in range(len(series[0]["y"]) if series else 0)]


def _rotate_categories(ax, categories):
    positions = np.arange(len(categories), dtype=float)
    ax.set_xticks(positions)
    ax.set_xticklabels([str(value) for value in categories])
    longest = max((len(str(value)) for value in categories), default=0)
    if longest > 9:
        ax.tick_params(axis="x", labelrotation=35)
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    return positions


def _take(values, count: int):
    if values is None:
        return None
    return np.asarray(values, dtype=float)[:count]


# ---------------------------------------------------------------------------
# Time series with confidence band
# ---------------------------------------------------------------------------

@register(
    "time_series",
    zh="时间序列（含置信带）",
    en="Time series with band",
    category="economics",
    summary_zh="折线 + 置信带：mapping y_lower/y_upper 给出不对称区间，可选零线参考与末点数值标注。",
    summary_en="Line chart with a confidence band from mapping y_lower/y_upper, an optional reference line and an end-value label.",
    tags=["时间序列", "置信带", "宏观", "band"],
    aspect=0.68,
    options=[
        {"id": "band", "type": "bool", "default": True, "label_zh": "置信带", "label_en": "Confidence band"},
        {"id": "show_ref", "type": "bool", "default": True, "label_zh": "参考线", "label_en": "Reference line"},
        {"id": "ref_value", "type": "float", "default": 0.0, "min": -1.0e6, "max": 1.0e6, "step": 0.5, "label_zh": "参考值", "label_en": "Reference value"},
        {"id": "annotate_last", "type": "bool", "default": True, "label_zh": "标注末点", "label_en": "Label last point"},
    ],
    demo={
        "data": {
            "sample": "econ_series",
            "mapping": {"x": "month", "y": "gdp_growth_pct", "y_lower": "ci_low", "y_upper": "ci_high"},
        },
        "style": {"domain": "economics"},
        "labels": {"x": "Month", "y": "GDP growth (%)"},
    },
)
def render_time_series(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("time_series needs a numeric series", "invalid_data")
    item = series[0]
    x, y = H.clean_xy(item["x"], item["y"])
    colour = ctx.color(0)
    if ctx.flag("band", True):
        lower = _column(ctx, "y_lower")
        upper = _column(ctx, "y_upper")
        if lower is not None and upper is not None:
            n = min(x.size, lower.size, upper.size)
            lower, upper = lower[:n], upper[:n]
            mask = np.isfinite(x[:n]) & np.isfinite(y[:n]) & np.isfinite(lower) & np.isfinite(upper)
            if mask.any():
                ax.fill_between(
                    x[:n][mask],
                    lower[mask],
                    upper[mask],
                    color=colour,
                    alpha=0.18,
                    lw=0,
                    zorder=2,
                )
        elif lower is None and upper is None:
            ctx.warn("time_series: mapping has no y_lower / y_upper columns, band skipped")
    ax.plot(x, y, color=colour, lw=float(ctx.style["line"]["lw"]), zorder=3, label=None)

    if ctx.flag("show_ref", True):
        ref = float(ctx.num("ref_value", 0.0))
        ax.axhline(ref, color="#9A9A9A", lw=0.6, ls="--", zorder=2)

    x_span = float(np.max(x) - np.min(x)) or 1.0
    if ctx.flag("annotate_last", True):
        fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.3
        ax.annotate(
            f"{y[-1]:.2f}",
            xy=(x[-1], y[-1]),
            xytext=(4, 2),
            textcoords="offset points",
            ha="left",
            va="bottom",
            fontsize=fontsize,
            color=colour,
            zorder=5,
        )
        ax.set_xlim(float(np.min(x)), float(np.max(x)) + 0.06 * x_span)
    ctx.finish(ax, legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Fan chart
# ---------------------------------------------------------------------------

@register(
    "fan_chart",
    zh="扇形预测图",
    en="Fan chart",
    category="economics",
    summary_zh="多层置信带预测扇形图：50/80/95% 区间逐层加深、中位线实虚线区分历史与预测、预测起点竖线。",
    summary_en="Forecast fan chart with nested 50/80/95% bands, a median line that switches from solid history to dashed forecast and a forecast-origin rule.",
    tags=["fan chart", "预测", "置信区间", "宏观"],
    aspect=0.7,
    options=[
        {"id": "forecast_start", "type": "int", "default": -1, "min": -1, "max": 500, "step": 1, "label_zh": "预测起点（-1 自动）", "label_en": "Forecast start (-1 auto)"},
        {"id": "legend", "type": "bool", "default": True, "label_zh": "区间图例", "label_en": "Band legend"},
    ],
    demo={
        "data": {
            "sample": "econ_fan",
            "mapping": {
                "x": "month",
                "y": "median",
                "lower50": "lo50",
                "upper50": "hi50",
                "lower80": "lo80",
                "upper80": "hi80",
                "lower95": "lo95",
                "upper95": "hi95",
            },
        },
        "style": {"domain": "economics"},
        "labels": {"x": "Month", "y": "CPI inflation (%)"},
    },
)
def render_fan_chart(ctx):
    ax = ctx.ax()
    x = _column(ctx, "x")
    median = _column(ctx, "y")
    if median is None:
        median = _column(ctx, "median")
    if x is None or median is None:
        raise SpecError("fan_chart needs month and median columns", "invalid_mapping", "mapping")
    n = min(x.size, median.size)
    x, median = x[:n], median[:n]
    mask = np.isfinite(x) & np.isfinite(median)
    x, median = x[mask], median[mask]
    n = x.size
    if n < 4:
        raise SpecError("fan_chart needs at least four time points", "invalid_data")

    band_specs = (
        (50, "lower50", "upper50", 0.14),
        (80, "lower80", "upper80", 0.20),
        (95, "lower95", "upper95", 0.26),
    )
    bands = []
    for level, low_key, high_key, alpha in band_specs:
        low = _column(ctx, low_key)
        high = _column(ctx, high_key)
        if low is None or high is None:
            continue
        low = np.asarray(low, dtype=float)[:n][mask]
        high = np.asarray(high, dtype=float)[:n][mask]
        if low.size == n and high.size == n and np.isfinite(low).any() and np.isfinite(high).any():
            bands.append((level, low, high, alpha))
    if not bands:
        fallback_low = _column(ctx, "y_lower")
        fallback_high = _column(ctx, "y_upper")
        if fallback_low is not None and fallback_high is not None:
            low = np.asarray(fallback_low, dtype=float)[:n][mask]
            high = np.asarray(fallback_high, dtype=float)[:n][mask]
            bands.append((95, low, high, 0.20))

    forecast_start = int(ctx.num("forecast_start", -1))
    if forecast_start < 0:
        forecast_start = 0
        if bands:
            widest = bands[-1][1]  # widest band lower edge (50/80/95 order)
            width = np.abs(bands[-1][2] - bands[-1][1])
            valid = np.where(width > 1.0e-9)[0]
            if valid.size:
                forecast_start = int(valid[0])
        else:
            forecast_start = n

    colour = ctx.color(0)
    band_handles = []
    for level, low, high, alpha in bands:
        start = min(forecast_start, n - 1)
        ax.fill_between(x[start:], low[start:], high[start:], color=colour, alpha=alpha, lw=0, zorder=2)
        band_handles.append(Patch(facecolor=colour, alpha=alpha, edgecolor="none", label=f"{level}%"))
    origin = min(max(forecast_start, 1), n - 1)
    ax.plot(x[: origin + 1], median[: origin + 1], color=colour, lw=float(ctx.style["line"]["lw"]) + 0.15, zorder=4)
    if origin < n - 1:
        ax.plot(
            x[origin:],
            median[origin:],
            color=colour,
            lw=float(ctx.style["line"]["lw"]) + 0.15,
            ls="--",
            zorder=4,
        )
        ax.axvline(x[origin], color="#9A9A9A", lw=0.6, ls="--", zorder=1, ymax=0.90)
    if band_handles:
        band_handles.append(Line2D([0], [0], color=colour, lw=float(ctx.style["line"]["lw"]), label="Median"))
    ctx.finish(ax, legend=False)
    ax.margins(y=0.10, x=0.01)
    if ctx.flag("legend", True) and band_handles:
        ctx.legend(
            ax,
            handles=band_handles,
            labels=[handle.get_label() for handle in band_handles],
            loc="upper left",
            ncol=4,
        )
    return ctx.fig


# ---------------------------------------------------------------------------
# Waterfall
# ---------------------------------------------------------------------------

@register(
    "waterfall",
    zh="瀑布图",
    en="Waterfall chart",
    category="economics",
    summary_zh="累计桥接瀑布图：增量柱首尾相连、正负配色、阶段标签与可选合计柱，适合利润桥与预算分解。",
    summary_en="Cumulative bridge waterfall with connected deltas, signed colours, stage labels and an optional total bar for profit bridges and budget walks.",
    tags=["瀑布", "bridge", "利润桥", "分解"],
    aspect=0.72,
    options=[
        {"id": "show_total", "type": "bool", "default": True, "label_zh": "合计柱", "label_en": "Total bar"},
        {"id": "value_labels", "type": "bool", "default": True, "label_zh": "数值标签", "label_en": "Value labels"},
    ],
    demo={
        "data": {"sample": "econ_waterfall", "mapping": {"x": "stage", "y": "delta"}},
        "style": {"domain": "economics"},
        "labels": {"x": "", "y": "USD millions", "total": "Net income"},
    },
)
def render_waterfall(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("waterfall needs stage and delta columns", "invalid_data")
    item = series[0]
    categories = _category_names(ctx, series)
    deltas = np.asarray(item["y"], dtype=float)
    n = min(len(categories), deltas.size)
    categories, deltas = categories[:n], deltas[:n]
    mask = np.isfinite(deltas)
    categories = [name for name, keep in zip(categories, mask.tolist()) if keep]
    deltas = deltas[mask]
    n = deltas.size
    if n < 2:
        raise SpecError("waterfall needs at least two stages", "invalid_data")

    cumulative = np.cumsum(deltas)
    positive_colour = ctx.color(3)
    negative_colour = ctx.color(6)
    colours = [positive_colour if value >= 0 else negative_colour for value in deltas]
    positions = np.arange(n, dtype=float)
    bottoms = np.concatenate([[0.0], cumulative[:-1]])
    ax.bar(positions, deltas, bottom=bottoms, width=0.62, color=colours, edgecolor="white", linewidth=0.4, zorder=3)
    for index in range(n - 1):
        ax.plot(
            [positions[index] + 0.31, positions[index + 1] - 0.31],
            [cumulative[index], cumulative[index]],
            color="#9A9A9A",
            lw=0.6,
            zorder=2,
        )
    ax.axhline(0.0, color="#333333", lw=0.6, zorder=2)

    show_total = ctx.flag("show_total", True)
    labels = list(categories)
    if show_total:
        total = float(cumulative[-1])
        ax.bar(n, total, bottom=0.0, width=0.62, color="#4D4D4D", edgecolor="white", linewidth=0.4, zorder=3)
        total_label = ctx.label("total") or "Total"
        labels.append(total_label)

    fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.5
    if ctx.flag("value_labels", True):
        for index, delta in enumerate(deltas):
            top = max(bottoms[index], cumulative[index])
            bottom = min(bottoms[index], cumulative[index])
            if delta >= 0:
                ax.annotate(
                    f"{delta:+.0f}",
                    xy=(positions[index], top),
                    xytext=(0, 2),
                    textcoords="offset points",
                    ha="center",
                    va="bottom",
                    fontsize=fontsize,
                    color="#333333",
                )
            else:
                ax.annotate(
                    f"{delta:+.0f}",
                    xy=(positions[index], bottom),
                    xytext=(0, -2),
                    textcoords="offset points",
                    ha="center",
                    va="top",
                    fontsize=fontsize,
                    color="#333333",
                )
        if show_total:
            ax.annotate(
                f"{cumulative[-1]:.0f}",
                xy=(n, cumulative[-1]),
                xytext=(0, 2),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=fontsize,
                color="#333333",
            )

    positions_all = np.arange(len(labels), dtype=float)
    _rotate_categories(ax, labels)
    ax.set_xlim(-0.65, len(labels) - 0.35)
    ax.set_ylim(min(0.0, float(np.min(np.minimum(bottoms, cumulative)))) * 1.06, float(np.max(np.maximum(bottoms, cumulative))) * 1.16)
    ctx.finish(ax, legend=False, ylim=None)

    handles = [
        Patch(facecolor=positive_colour, edgecolor="none", label="Increase"),
        Patch(facecolor=negative_colour, edgecolor="none", label="Decrease"),
    ]
    if show_total:
        handles.append(Patch(facecolor="#4D4D4D", edgecolor="none", label=ctx.label("total") or "Total"))
    ctx.legend(ax, handles=handles, labels=[handle.get_label() for handle in handles], loc="upper right")
    return ctx.fig


# ---------------------------------------------------------------------------
# Tornado sensitivity diagram
# ---------------------------------------------------------------------------

@register(
    "tornado",
    zh="龙卷风敏感性图",
    en="Tornado sensitivity chart",
    category="economics",
    summary_zh="双向水平条敏感性图：按影响幅度排序、正负配色、中心零线，适合 NPV / 估值假设敏感性。",
    summary_en="Two-sided horizontal sensitivity bars sorted by swing, with signed colours and a zero centre line for NPV or valuation assumptions.",
    tags=["敏感性", "tornado", "NPV", "假设"],
    aspect=0.72,
    options=[
        {"id": "sort", "type": "bool", "default": True, "label_zh": "按幅度排序", "label_en": "Sort by swing"},
        {"id": "value_labels", "type": "bool", "default": True, "label_zh": "数值标签", "label_en": "Value labels"},
    ],
    demo={
        "data": {"sample": "econ_tornado", "mapping": {"x": "variable", "low": "low", "high": "high"}},
        "style": {"domain": "economics"},
        "labels": {"x": "Change in NPV (USD million)", "y": ""},
    },
)
def render_tornado(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    categories = _category_names(ctx, series)
    low = _column(ctx, "low")
    high = _column(ctx, "high")
    if low is None or high is None:
        raise SpecError("tornado needs mapping for low and high scenario values", "invalid_mapping", "mapping")
    n = min(len(categories), low.size, high.size)
    categories, low, high = categories[:n], low[:n], high[:n]
    mask = np.isfinite(low) & np.isfinite(high)
    categories = [name for name, keep in zip(categories, mask.tolist()) if keep]
    low, high = low[mask], high[mask]
    n = low.size
    if n < 2:
        raise SpecError("tornado needs at least two variables", "invalid_data")

    swing = high - low
    order = np.argsort(swing)[::-1] if ctx.flag("sort", True) else np.arange(n)
    categories = [categories[i] for i in order]
    low, high = low[order], high[order]
    y_positions = np.arange(n, dtype=float)
    low_delta = low
    high_delta = high

    negative_colour = ctx.color(6)
    positive_colour = ctx.color(3)
    ax.barh(y_positions, low_delta, height=0.62, color=negative_colour, edgecolor="white", linewidth=0.4, zorder=3)
    ax.barh(y_positions, high_delta, height=0.62, color=positive_colour, edgecolor="white", linewidth=0.4, zorder=3)
    ax.axvline(0.0, color="#333333", lw=0.8, zorder=4)

    fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.5
    if ctx.flag("value_labels", True):
        for index in range(n):
            ax.annotate(
                f"{low[index]:+.0f}",
                xy=(low_delta[index], y_positions[index]),
                xytext=(-3, 0) if low_delta[index] < 0 else (3, 0),
                textcoords="offset points",
                ha="right" if low_delta[index] < 0 else "left",
                va="center",
                fontsize=fontsize,
                color="#333333",
            )
            ax.annotate(
                f"{high[index]:+.0f}",
                xy=(high_delta[index], y_positions[index]),
                xytext=(3, 0) if high_delta[index] >= 0 else (-3, 0),
                textcoords="offset points",
                ha="left" if high_delta[index] >= 0 else "right",
                va="center",
                fontsize=fontsize,
                color="#333333",
            )

    ax.set_yticks(y_positions)
    ax.set_yticklabels(categories)
    ax.invert_yaxis()
    span = float(np.max(np.abs(np.concatenate([low_delta, high_delta])))) or 1.0
    ax.set_xlim(-1.22 * span, 1.22 * span)
    ctx.finish(ax, legend=False)

    handles = [
        Patch(facecolor=negative_colour, edgecolor="none", label="Low scenario"),
        Patch(facecolor=positive_colour, edgecolor="none", label="High scenario"),
    ]
    ctx.legend(ax, handles=handles, labels=[handle.get_label() for handle in handles], loc="lower right")
    return ctx.fig


# ---------------------------------------------------------------------------
# Funnel plot (rate vs sample size)
# ---------------------------------------------------------------------------

@register(
    "funnel",
    zh="漏斗图（率 vs 样本量）",
    en="Funnel plot",
    category="economics",
    summary_zh="转化率–样本量漏斗图：合并期望率水平线、±2 SE 置信边界、显著偏离渠道高亮标注，适合渠道与 A/B 分析。",
    summary_en="Conversion-rate funnel against sample size with a pooled expectation, +/-2 SE limits and labelled outlying channels for channel and A/B analysis.",
    tags=["漏斗", "funnel", "转化率", "A/B"],
    aspect=0.72,
    options=[
        {"id": "sigma", "type": "float", "default": 2.0, "min": 1.0, "max": 3.0, "step": 0.1, "label_zh": "置信带宽（SE 倍数）", "label_en": "Limit width (SE multiples)"},
        {"id": "labels", "type": "bool", "default": True, "label_zh": "异常渠道标签", "label_en": "Outlier labels"},
    ],
    demo={
        "data": {"sample": "econ_funnel", "mapping": {"x": "n", "y": "conversion_pct", "label": "channel"}},
        "style": {"domain": "economics"},
        "labels": {"x": "Sample size $n$", "y": "Conversion rate (%)"},
    },
)
def render_funnel(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("funnel needs sample-size and conversion columns", "invalid_data")
    item = series[0]
    sample_size = np.asarray(item["x"], dtype=float)
    rate = np.asarray(item["y"], dtype=float)
    names = item.get("point_labels") or _category_names(ctx, series)
    n = min(sample_size.size, rate.size)
    sample_size, rate = sample_size[:n], rate[:n]
    if names is not None:
        names = [str(value) for value in names[:n]]
    mask = np.isfinite(sample_size) & np.isfinite(rate) & (sample_size > 0)
    sample_size, rate = sample_size[mask], rate[mask]
    if names is not None:
        names = [name for name, keep in zip(names, mask.tolist()) if keep]
    if sample_size.size < 6:
        raise SpecError("funnel needs at least six channels", "invalid_data")

    pooled = float(np.sum(rate * sample_size) / np.sum(sample_size)) / 100.0
    pooled = min(max(pooled, 1.0e-6), 1.0 - 1.0e-6)
    sigma = float(ctx.num("sigma", 2.0))
    grid = np.logspace(np.log10(float(np.min(sample_size))), np.log10(float(np.max(sample_size))), 240)
    standard_error = np.sqrt(pooled * (1.0 - pooled) / grid)
    expected = pooled * 100.0
    upper = (pooled + sigma * standard_error) * 100.0
    lower = (pooled - sigma * standard_error) * 100.0

    colour = ctx.color(0)
    limits_line, = ax.plot(grid, upper, color="#9A9A9A", lw=0.6, ls="--", zorder=2)
    ax.plot(grid, lower, color="#9A9A9A", lw=0.6, ls="--", zorder=2)
    expected_line = ax.axhline(expected, color="#333333", lw=0.8, zorder=2)
    channels = ax.scatter(sample_size, rate, s=24.0, color=colour, edgecolors="white", linewidths=0.45, zorder=4)

    channel_se = np.sqrt(pooled * (1.0 - pooled) / sample_size) * 100.0
    outside = (rate > expected + sigma * channel_se) | (rate < expected - sigma * channel_se)
    highlight = ctx.color(6)
    if outside.any():
        ax.scatter(sample_size[outside], rate[outside], s=34.0, color=highlight, edgecolors="white", linewidths=0.5, zorder=5)
    if ctx.flag("labels", True) and names is not None:
        fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.7
        for index in range(sample_size.size):
            if not outside[index]:
                continue
            ax.annotate(
                names[index],
                xy=(sample_size[index], rate[index]),
                xytext=(4, 4),
                textcoords="offset points",
                ha="left",
                va="bottom",
                fontsize=fontsize,
                color=highlight,
                zorder=6,
            )

    ax.set_xscale("log")
    ax.margins(x=0.10, y=0.10)
    ctx.finish(ax, xscale="log", legend=False)
    ctx.legend(
        ax,
        handles=[channels, expected_line, limits_line],
        labels=["Channels", f"Expected {expected:.2f}%", f"{sigma:g} SE limits"],
        loc="upper right",
    )
    return ctx.fig
