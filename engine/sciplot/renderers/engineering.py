"""Engineering & signal renderers: Bode, Nyquist, PSD, multi-channel waveform,
Pareto and control charts.

Colours, typography, spines and geometry come from the shared style engine; these
renderers only describe what to draw.
"""
from __future__ import annotations

import numpy as np

from .. import helpers as H
from ..palettes import text_color_on  # noqa: F401  (kept for symmetry / future fills)
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
    return mapped or [str(index + 1) for index in range(len(series[0]["y"]) if series else 0)]


def _category_axis(ax, categories, rotate=None):
    positions = np.arange(len(categories), dtype=float)
    ax.set_xticks(positions)
    ax.set_xticklabels([str(value) for value in categories])
    if rotate is None:
        longest = max((len(str(value)) for value in categories), default=0)
        rotate = 35 if longest > 9 else 0
    if rotate:
        ax.tick_params(axis="x", labelrotation=float(rotate))
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    return positions


def _nice_floor(values) -> float:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values) & (values > 0)]
    if values.size == 0:
        return 1.0
    return float(np.nanpercentile(values, 45))


def _crossover(freq, magnitude):
    """First descending 0-dB crossing, interpolated in log-frequency."""
    freq = np.asarray(freq, dtype=float)
    magnitude = np.asarray(magnitude, dtype=float)
    order = np.argsort(freq)
    freq, magnitude = freq[order], magnitude[order]
    mask = np.isfinite(freq) & np.isfinite(magnitude) & (freq > 0)
    freq, magnitude = freq[mask], magnitude[mask]
    if freq.size < 3:
        return None
    log_freq = np.log10(freq)
    for index in range(1, magnitude.size):
        if magnitude[index - 1] >= 0.0 > magnitude[index]:
            span = magnitude[index - 1] - magnitude[index]
            fraction = magnitude[index - 1] / span if span else 0.5
            return float(10.0 ** (log_freq[index - 1] + fraction * (log_freq[index] - log_freq[index - 1])))
    return None


# ---------------------------------------------------------------------------
# Bode plot
# ---------------------------------------------------------------------------

@register(
    "bode",
    zh="Bode 图",
    en="Bode plot",
    category="engineering",
    summary_zh="上下双面板幅频（dB）与相频（deg）图：共享对数频率轴、浅色网格，可选增益穿越频率与相位裕度标注。",
    summary_en="Magnitude (dB) and phase (deg) panels sharing a log frequency axis with a light grid and optional gain-crossover / phase-margin annotation.",
    tags=["Bode", "频响", "控制", "log"],
    aspect=1.14,
    options=[
        {"id": "annotate", "type": "bool", "default": True, "label_zh": "标注穿越频率", "label_en": "Mark crossover"},
        {"id": "grid", "type": "bool", "default": True, "label_zh": "网格", "label_en": "Grid"},
    ],
    demo={
        "data": {"sample": "eng_bode", "mapping": {"x": "frequency_hz", "y": "magnitude_db", "phase": "phase_deg"}},
        "style": {"domain": "engineering", "journal": "ieee"},
        "labels": {"x": "Frequency (Hz)", "y": "Magnitude (dB)", "y2": "Phase (deg)"},
    },
)
def render_bode(ctx):
    series = _valid_series(ctx)
    freq = _column(ctx, "x")
    magnitude = _column(ctx, "y")
    phase = _column(ctx, "phase")
    if freq is None and series:
        freq = np.asarray(series[0]["x"], dtype=float)
    if magnitude is None and series:
        magnitude = np.asarray(series[0]["y"], dtype=float)
    if freq is None or magnitude is None:
        raise SpecError("bode needs a frequency column and a magnitude column", "invalid_mapping", "mapping")
    n = min(freq.size, magnitude.size)
    freq, magnitude = freq[:n], magnitude[:n]
    if phase is not None:
        phase = np.asarray(phase, dtype=float)[:n]

    if phase is not None and np.isfinite(phase).any():
        fig, axes = ctx.figure(2, 1, height_ratios=[1.0, 0.58], sharex=True, aspect=1.14)
        ax_mag, ax_phase = axes[0], axes[1]
        show_phase = True
    else:
        fig, ax_mag = ctx.figure(1, 1)
        ax_phase = None
        show_phase = False

    colour = ctx.color(0)
    line_width = float(ctx.style["line"]["lw"]) + 0.1
    ax_mag.plot(freq, magnitude, color=colour, lw=line_width, zorder=3)
    if show_phase:
        ax_phase.plot(freq, phase, color=colour, lw=line_width, zorder=3)

    grid_on = bool(ctx.flag("grid", True))
    ctx.finish(ax_mag, xlabel="", ylabel=ctx.label("y") or "Magnitude (dB)", legend=False, grid=grid_on)
    ax_mag.tick_params(labelbottom=False)
    if show_phase:
        ctx.finish(
            ax_phase,
            xlabel=ctx.label("x") or "Frequency (Hz)",
            ylabel=ctx.label("y2") or "Phase (deg)",
            legend=False,
            grid=grid_on,
            xscale="log",
        )
    else:
        ax_mag.set_xlabel(ctx.label("x") or "Frequency (Hz)")

    if ctx.flag("annotate", True) and show_phase:
        crossover = _crossover(freq, magnitude)
        if crossover is not None:
            order = np.argsort(freq)
            phase_at = float(np.interp(np.log10(crossover), np.log10(freq[order]), phase[order]))
            margin = 180.0 + phase_at
            for axis in (ax_mag, ax_phase):
                axis.axvline(crossover, color="#9A9A9A", lw=0.6, ls="--", zorder=2)
            ax_mag.axhline(0.0, color="#9A9A9A", lw=0.6, ls="--", zorder=2)
            H.corner_note(
                ax_mag,
                f"$f_c$ = {crossover:.4g} Hz\nPM = {margin:.0f}$^{{\\circ}}$",
                loc="upper right",
                fontsize=float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.4,
            )
    return ctx.fig


# ---------------------------------------------------------------------------
# Nyquist plot
# ---------------------------------------------------------------------------

@register(
    "nyquist",
    zh="Nyquist 阻抗图",
    en="Nyquist impedance",
    category="engineering",
    summary_zh="复阻抗 Nyquist 图：等比例坐标轴、测量点标记、沿曲线递增频率箭头，适合电化学阻抗谱。",
    summary_en="Complex-impedance Nyquist plot with equal-aspect axes, measured-point markers and along-curve frequency arrows.",
    tags=["Nyquist", "EIS", "阻抗", "equal aspect"],
    aspect=0.52,
    options=[
        {"id": "arrows", "type": "bool", "default": True, "label_zh": "频率方向箭头", "label_en": "Frequency arrows"},
        {"id": "positive_imag", "type": "bool", "default": True, "label_zh": "翻转容性虚部", "label_en": "Flip capacitive imaginary part"},
    ],
    demo={
        "data": {"sample": "eng_nyquist", "mapping": {"x": "real", "y": "imag", "frequency": "frequency"}},
        "style": {"domain": "engineering", "journal": "ieee"},
        "labels": {"x": "$Z'$ ($\\Omega$ cm$^2$)", "y": "$-Z''$ ($\\Omega$ cm$^2$)"},
    },
)
def render_nyquist(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("nyquist needs real and imaginary impedance columns", "invalid_data")
    item = series[0]
    x, y = H.clean_xy(item["x"], item["y"])
    if x.size < 3:
        raise SpecError("nyquist needs at least three impedance points", "invalid_data")
    flip = ctx.flag("positive_imag", True) and float(np.nanmean(y)) < 0.0
    plotted = -y if flip else y
    colour = ctx.color(0)
    mark_every = max(1, x.size // 24)
    ax.plot(
        x,
        plotted,
        color=colour,
        lw=float(ctx.style["line"]["lw"]),
        marker="o",
        ms=float(ctx.style["line"]["ms"]) - 0.6,
        markevery=mark_every,
        mfc="white",
        mew=0.55,
        mec=colour,
        zorder=3,
    )
    # Frequency increases from the last sampled point back to the first one.
    if ctx.flag("arrows", True) and x.size > 12:
        for fraction in (0.30, 0.62, 0.86):
            index = int(fraction * (x.size - 1))
            if 4 <= index <= x.size - 5:
                ax.annotate(
                    "",
                    xy=(x[index - 3], plotted[index - 3]),
                    xytext=(x[index + 3], plotted[index + 3]),
                    arrowprops={
                        "arrowstyle": "-|>",
                        "color": colour,
                        "lw": 0.85,
                        "mutation_scale": 8.0,
                        "shrinkA": 0.0,
                        "shrinkB": 0.0,
                    },
                    zorder=4,
                )
    ax.set_aspect("equal", adjustable="datalim")
    ctx.finish(ax, legend=False)
    ax.set_aspect("equal", adjustable="datalim")
    return ctx.fig


# ---------------------------------------------------------------------------
# Power spectral density
# ---------------------------------------------------------------------------

@register(
    "psd",
    zh="功率谱密度",
    en="Power spectral density",
    category="engineering",
    summary_zh="log-log 功率谱密度：1/f 参考斜率、噪声基底虚线与工频峰，适合噪声与振动分析。",
    summary_en="Log-log PSD with a 1/f reference slope, a dashed noise floor and mains peaks for noise and vibration analysis.",
    tags=["PSD", "频谱", "log-log", "噪声"],
    aspect=0.76,
    options=[
        {"id": "reference", "type": "bool", "default": True, "label_zh": "1/f 参考斜率", "label_en": "1/f reference slope"},
        {"id": "floor", "type": "bool", "default": True, "label_zh": "噪声基底", "label_en": "Noise floor"},
    ],
    demo={
        "data": {"sample": "eng_psd", "mapping": {"x": "frequency_hz", "y": "psd"}},
        "style": {"domain": "engineering", "journal": "ieee"},
        "labels": {"x": "Frequency (Hz)", "y": "PSD (V$^2$ Hz$^{-1}$)"},
    },
)
def render_psd(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("psd needs frequency and PSD columns", "invalid_data")
    item = series[0]
    freq, psd = H.clean_xy(item["x"], item["y"])
    mask = (freq > 0) & (psd > 0)
    freq, psd = freq[mask], psd[mask]
    if freq.size < 4:
        raise SpecError("psd needs at least four positive (frequency, PSD) pairs", "invalid_data")
    colour = ctx.color(0)
    ax.plot(freq, psd, color=colour, lw=float(ctx.style["line"]["lw"]), zorder=3)
    ctx.finish(ax, xscale="log", yscale="log", legend=False)
    ax.grid(True, which="major", axis="both", color="#E4E4E4", linewidth=0.5)
    fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.4
    notes = []
    low_mask = freq < max(freq.min() * 12.0, 2.0)
    if ctx.flag("reference", True) and low_mask.sum() >= 4:
        try:
            slope, intercept = np.polyfit(np.log10(freq[low_mask]), np.log10(psd[low_mask]), 1)
            grid = np.logspace(np.log10(freq.min()), np.log10(freq[low_mask].max() * 1.6), 60)
            ax.plot(grid, 10.0 ** (intercept + slope * np.log10(grid)), color="#9A9A9A", lw=0.6, ls="--", zorder=2)
            notes.append(f"slope $\\propto f^{{{slope:.2f}}}$")
        except (np.linalg.LinAlgError, ValueError):
            pass
    if ctx.flag("floor", True):
        tail = psd[freq >= freq.max() * 0.5]
        if tail.size >= 3:
            floor = float(np.median(tail))
            ax.axhline(floor, color="#9A9A9A", lw=0.6, ls="--", zorder=2)
            notes.append(f"floor {floor:.1e}")
    if notes:
        H.corner_note(ax, "\n".join(notes), loc="upper right", fontsize=fontsize)
    return ctx.fig


# ---------------------------------------------------------------------------
# Multi-channel waveform
# ---------------------------------------------------------------------------

@register(
    "waveform",
    zh="多通道波形",
    en="Multi-channel waveform",
    category="engineering",
    summary_zh="多通道示波器波形：逐通道垂直偏移、左端通道标签、稀疏时间刻度，适合信号对比。",
    summary_en="Oscilloscope-style stacked channels with vertical offsets, left-edge channel labels and sparse time ticks.",
    tags=["波形", "示波器", "多通道", "信号"],
    aspect=0.7,
    options=[
        {"id": "spacing", "type": "float", "default": 1.15, "min": 0.5, "max": 3.0, "step": 0.05, "label_zh": "通道间距", "label_en": "Channel spacing"},
        {"id": "labels", "type": "bool", "default": True, "label_zh": "通道标签", "label_en": "Channel labels"},
        {"id": "grid_lines", "type": "bool", "default": True, "label_zh": "通道基线", "label_en": "Channel baselines"},
    ],
    demo={
        "data": {"sample": "eng_signal", "mapping": {"x": "time", "y": "amplitude", "group": "channel"}},
        "style": {"domain": "engineering", "journal": "ieee", "palette": "okabe-ito"},
        "labels": {"x": "Time (ms)", "y": "Amplitude (a.u.)"},
    },
)
def render_waveform(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("waveform needs at least one channel", "invalid_data")
    spacing_factor = float(ctx.num("spacing", 1.15))
    show_labels = ctx.flag("labels", True)
    show_baselines = ctx.flag("grid_lines", True)

    cleaned = []
    for item in series:
        x, y = H.clean_xy(item["x"], item["y"])
        if x.size >= 3:
            cleaned.append((str(item.get("label") or item.get("name") or ""), x, y))
    if not cleaned:
        raise SpecError("waveform channels have too few points", "invalid_data")
    amplitude_span = max(float(np.max(y) - np.min(y)) for _name, _x, y in cleaned) or 1.0
    spacing = spacing_factor * amplitude_span
    total = len(cleaned)
    x_min = min(float(np.min(x)) for _name, x, _y in cleaned)
    x_max = max(float(np.max(x)) for _name, x, _y in cleaned)
    x_span = (x_max - x_min) or 1.0
    longest = max((len(name) for name, _x, _y in cleaned), default=3)
    gutter = min(0.35, max(0.09, 0.027 * longest)) * x_span
    fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.1
    for index, (name, x, y) in enumerate(cleaned):
        colour = ctx.color(index)
        offset = (total - 1 - index) * spacing
        if show_baselines:
            ax.axhline(offset, color="#DCDCDC", lw=0.45, ls=":", zorder=1)
        ax.plot(x, y + offset, color=colour, lw=float(ctx.style["line"]["lw"]), zorder=3)
    ax.set_yticks([])
    ax.tick_params(axis="y", left=False)
    ctx.finish(ax, legend=False)
    ax.set_yticks([])
    ax.tick_params(axis="y", left=False)
    ax.set_xlim(x_min - gutter, x_max)
    ax.set_ylim(-0.55 * spacing, (total - 1) * spacing + 0.55 * spacing)
    if show_labels:
        for index, (name, _x, _y) in enumerate(cleaned):
            colour = ctx.color(index)
            ax.text(
                x_min - gutter + 0.015 * x_span,
                (total - 1 - index) * spacing,
                name,
                ha="left",
                va="center",
                fontsize=fontsize,
                color=colour,
                zorder=5,
            )
    return ctx.fig


# ---------------------------------------------------------------------------
# Pareto chart
# ---------------------------------------------------------------------------

@register(
    "pareto",
    zh="帕累托图",
    en="Pareto chart",
    category="engineering",
    summary_zh="降序柱 + 累计贡献折线：右侧百分比轴、80% 参考线与关键少数类别注释。",
    summary_en="Descending bars with a cumulative-contribution line, a right percentage axis, an 80% reference and a key-few annotation.",
    tags=["Pareto", "80/20", "质量", "累计"],
    aspect=0.8,
    options=[
        {"id": "threshold", "type": "float", "default": 80.0, "min": 50.0, "max": 95.0, "step": 1.0, "label_zh": "累计阈值 (%)", "label_en": "Cumulative threshold (%)"},
        {"id": "rotate", "type": "int", "default": -1, "min": -1, "max": 90, "step": 5, "label_zh": "标签旋转", "label_en": "Label rotation"},
    ],
    demo={
        "data": {"sample": "eng_pareto", "mapping": {"x": "defect", "y": "count"}},
        "style": {"domain": "engineering", "journal": "ieee"},
        "labels": {"x": "", "y": "Defect count (n)"},
    },
)
def render_pareto(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("pareto needs categorical counts", "invalid_data")
    item = series[0]
    categories = _category_names(ctx, series)
    values = np.asarray(item["y"], dtype=float)
    n = min(len(categories), values.size)
    categories, values = categories[:n], values[:n]
    order = np.argsort(values)[::-1]
    categories = [categories[i] for i in order]
    values = values[order]
    positions = np.arange(n, dtype=float)
    total = float(np.sum(values)) or 1.0
    cumulative = np.cumsum(values) / total * 100.0

    bar_colour = ctx.color(0)
    line_colour = ctx.color(1)
    bars = ax.bar(positions, values, width=0.62, color=bar_colour, edgecolor="white", linewidth=0.4, zorder=2)
    rotate = int(ctx.num("rotate", -1))
    _category_axis(ax, categories, rotate=None if rotate < 0 else rotate)
    ax.set_xlim(-0.65, n - 0.35)
    ax.set_ylabel(ctx.label("y") or "Count (n)", color=bar_colour)
    ctx.finish(ax, legend=False)
    ax.yaxis.label.set_color(bar_colour)
    ax.tick_params(axis="y", colors=bar_colour)

    twin = ax.twinx()
    twin.plot(
        positions,
        cumulative,
        color=line_colour,
        lw=float(ctx.style["line"]["lw"]),
        marker="o",
        ms=float(ctx.style["line"]["ms"]) - 0.4,
        mfc="white",
        mew=0.6,
        mec=line_colour,
        zorder=4,
    )
    threshold = float(ctx.num("threshold", 80.0))
    twin.axhline(threshold, color="#9A9A9A", lw=0.6, ls="--", zorder=2)
    twin.set_ylim(0.0, 105.0)
    twin.set_yticks([0.0, 20.0, 40.0, 60.0, 80.0, 100.0])
    twin.set_ylabel("Cumulative share (%)", color=line_colour)
    twin.tick_params(axis="y", right=True, labelright=True, colors=line_colour)
    twin.tick_params(axis="x", bottom=False, labelbottom=False)
    ctx.style_axes(twin, grid=False)
    twin.tick_params(axis="y", right=True, labelright=True, colors=line_colour)
    twin.yaxis.label.set_color(line_colour)
    if ctx.style.get("ticks") == "in":
        twin.tick_params(axis="y", direction="in", right=True, labelright=True)

    fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.4
    reached = int(np.searchsorted(cumulative, threshold) + 1)
    H.corner_note(
        ax,
        f"{min(reached, n)} of {n} categories = {threshold:.0f}%",
        loc="upper left",
        fontsize=fontsize,
    )
    return ctx.fig


# ---------------------------------------------------------------------------
# Control chart
# ---------------------------------------------------------------------------

@register(
    "control_chart",
    zh="控制图",
    en="Control chart",
    category="engineering",
    summary_zh="X̄ 控制图：数据点 + 中心线 + UCL/LCL 虚线，超限点高亮并标注样本编号，适合 SPC 过程监控。",
    summary_en="X-bar control chart with centre line, dashed UCL/LCL limits and highlighted out-of-control points labelled by sample.",
    tags=["SPC", "控制图", "UCL", "过程监控"],
    aspect=0.68,
    options=[
        {"id": "connect", "type": "bool", "default": True, "label_zh": "连接数据点", "label_en": "Connect points"},
        {"id": "limits", "type": "bool", "default": True, "label_zh": "UCL/LCL 标签", "label_en": "UCL/LCL labels"},
    ],
    demo={
        "data": {"sample": "eng_control", "mapping": {"x": "sample_index", "y": "value", "ucl": "ucl", "lcl": "lcl", "center": "center"}},
        "style": {"domain": "engineering", "journal": "ieee"},
        "labels": {"x": "Sample index", "y": "Diameter (mm)"},
    },
)
def render_control_chart(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("control_chart needs a value column", "invalid_data")
    item = series[0]
    x, y = H.clean_xy(item["x"], item["y"])
    if x.size < 3:
        raise SpecError("control_chart needs at least three samples", "invalid_data")
    ucl = _column(ctx, "ucl")
    lcl = _column(ctx, "lcl")
    center = _column(ctx, "center")
    derived = False
    if center is None:
        center = np.full(x.size, float(np.mean(y)))
    if ucl is None or lcl is None:
        sigma = float(np.std(y, ddof=1)) if y.size > 2 else 0.0
        center_value = float(np.asarray(center, dtype=float).ravel()[0])
        ucl = np.full(x.size, center_value + 3.0 * sigma)
        lcl = np.full(x.size, center_value - 3.0 * sigma)
        derived = True
    ucl_value = float(np.asarray(ucl, dtype=float).ravel()[0])
    lcl_value = float(np.asarray(lcl, dtype=float).ravel()[0])
    center_value = float(np.asarray(center, dtype=float).ravel()[0])

    colour = ctx.color(0)
    if ctx.flag("connect", True):
        ax.plot(x, y, color=colour, lw=float(ctx.style["line"]["lw"]), zorder=3)
    ax.plot(
        x,
        y,
        linestyle="none",
        marker="o",
        ms=float(ctx.style["line"]["ms"]) - 0.3,
        mfc="white",
        mew=0.6,
        mec=colour,
        zorder=3,
    )
    ax.axhline(center_value, color="#333333", lw=0.8, zorder=2)
    ax.axhline(ucl_value, color="#9A9A9A", lw=0.6, ls="--", zorder=2)
    ax.axhline(lcl_value, color="#9A9A9A", lw=0.6, ls="--", zorder=2)

    outside = (y > ucl_value) | (y < lcl_value)
    fontsize = float(ctx.style["rc"].get("legend.fontsize", 6.5)) - 0.4
    if outside.any():
        highlight = ctx.color(1)
        ax.scatter(x[outside], y[outside], s=24.0, color=highlight, edgecolors="white", linewidths=0.45, zorder=4)
        for x_value, y_value in zip(x[outside], y[outside]):
            ax.annotate(
                f"#{int(round(x_value))}",
                xy=(x_value, y_value),
                xytext=(0, 5),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=fontsize,
                color=highlight,
                zorder=5,
            )
    span = float(np.max(y) - np.min(y)) or 1.0
    x_pad = (float(np.max(x)) - float(np.min(x))) or 1.0
    ax.set_xlim(float(np.min(x)) - 0.02 * x_pad, float(np.max(x)) + 0.10 * x_pad)
    if ctx.flag("limits", True):
        for value, name in ((ucl_value, "UCL"), (lcl_value, "LCL"), (center_value, "CL")):
            ax.annotate(
                name,
                xy=(float(np.max(x)), value),
                xytext=(4, 0),
                textcoords="offset points",
                ha="left",
                va="center",
                fontsize=fontsize,
                color="#555555" if name != "CL" else "#333333",
            )
    ctx.finish(ax, legend=False, ylim=(min(lcl_value, float(np.min(y))) - 0.12 * span, max(ucl_value, float(np.max(y))) + 0.12 * span))
    note = "Control limits: CL $\\pm$ 3$\\sigma$"
    if not derived:
        note = f"Out of control: {int(outside.sum())} of {x.size} samples"
    H.corner_note(ax, note, loc="upper left", fontsize=fontsize)
    return ctx.fig
