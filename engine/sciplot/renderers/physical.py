"""Physical-sciences renderers: vibrational spectra, XRD, CV, thermal analysis,
2-D/3-D fields, polar patterns, wind roses and Taylor diagrams.

Every renderer only decides *what* to draw; fonts, sizes, spines, palettes and
figure geometry come from :mod:`sciplot.themes` through :class:`Ctx`.
"""
from __future__ import annotations

import math

import numpy as np

from .. import helpers as H
from ..palettes import text_color_on, to_hex
from ..registry import register
from ..spec import SpecError

try:  # SciPy is optional: peak picking degrades to local maxima.
    from scipy.signal import find_peaks as _scipy_find_peaks
except Exception:  # pragma: no cover
    _scipy_find_peaks = None


# ---------------------------------------------------------------------------
# Private helpers (kept local: shared helpers.py is read-only for this module)
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
        return np.asarray([str(value) for value in ctx.table.categorical(name)], dtype=object)
    return None


def _valid_series(ctx) -> list[dict]:
    out = []
    for item in ctx.series():
        if np.asarray(item.get("y", []), dtype=float).size >= 2:
            out.append(item)
    return out


def _category_names(series: list[dict]) -> list[str] | None:
    for item in series:
        cats = item.get("categories") or item.get("x_labels")
        if cats is not None:
            return [str(value) for value in cats]
    return None


def _projection_axes(ctx, projection: str):
    """Replace the context's single axes with a polar / 3-D projection.

    ``ctx.figure`` always creates rectilinear axes, so the (only) axes is removed
    and re-created on the same ``SubplotSpec``; the context keeps the new axes so
    quality checks, colour bookkeeping and ``finish`` see a single real axes.
    """
    base = ctx.ax()
    fig = ctx.fig
    spec = base.get_subplotspec()
    base.remove()
    ax = fig.add_subplot(spec, projection=projection)
    ax.set_facecolor(ctx.style.get("axes_face", "#ffffff"))
    try:
        ctx._axes[ctx._axes.index(base)] = ax
    except ValueError:  # pragma: no cover - defensive
        ctx._axes.append(ax)
    return ax


def _pivot_grid(ctx):
    x = _column(ctx, "x")
    y = _column(ctx, "y")
    z = _column(ctx, "z")
    if x is None or y is None or z is None:
        raise SpecError("this chart needs data mapping for x, y and z columns", "invalid_mapping", "mapping")
    n = min(x.size, y.size, z.size)
    x, y, z = x[:n], y[:n], z[:n]
    mask = np.isfinite(x) & np.isfinite(y) & np.isfinite(z)
    if mask.sum() < 6:
        raise SpecError("not enough finite (x, y, z) rows to build a grid", "invalid_data")
    xu = np.unique(x[mask])
    yu = np.unique(y[mask])
    if xu.size < 2 or yu.size < 2:
        raise SpecError("x and y need at least two distinct values each", "invalid_data")
    grid = np.full((yu.size, xu.size), np.nan)
    ix = np.searchsorted(xu, x[mask])
    iy = np.searchsorted(yu, y[mask])
    grid[iy, ix] = z[mask]
    if np.isnan(grid).any():
        ctx.warn("the (x, y, z) grid is incomplete; missing cells stay blank")
    return xu, yu, grid


def _find_peaks(y, prominence: float = 0.08, distance: int = 5):
    y = np.asarray(y, dtype=float)
    if y.size < 5:
        return np.asarray([], dtype=int), np.asarray([], dtype=float)
    if _scipy_find_peaks is not None:
        idx, props = _scipy_find_peaks(y, prominence=float(prominence), distance=int(max(1, distance)))
        return idx, np.asarray(props.get("prominences", []), dtype=float)
    idx = np.where((y[1:-1] > y[:-2]) & (y[1:-1] >= y[2:]))[0] + 1
    if idx.size == 0:
        return idx, np.asarray([], dtype=float)
    prom = np.asarray([y[i] - float(np.min(y)) for i in idx], dtype=float)
    keep = prom >= prominence
    return idx[keep], prom[keep]


def _peak_xy(x, y, prominence: float, count: int, distance_frac: float = 1.0 / 90.0, min_sep: float = 0.0):
    """Pick the ``count`` most prominent peaks while keeping them separated."""
    if x.size < 5:
        return []
    idx, _prom = _find_peaks(y, prominence=prominence, distance=max(2, int(x.size * distance_frac)))
    if idx.size == 0:
        return []
    candidates = sorted(((float(y[i]), float(x[i])) for i in idx), reverse=True)
    chosen: list[tuple[float, float]] = []
    for height, px in candidates:
        if min_sep > 0 and any(abs(px - cx) < min_sep for cx, _ in chosen):
            continue
        chosen.append((px, height))
        if len(chosen) >= count:
            break
    return sorted(chosen)


def _label_peaks(ax, peaks, colour: str, fontsize: float, *, offset: float = 6.0, rotation: float = 90.0, va: str = "bottom"):
    for peak_i, (px, py) in enumerate(peaks):
        ax.annotate(
            f"{px:.0f}",
            xy=(px, py),
            xytext=(0.0, offset + 8.0 * (peak_i % 2)),
            textcoords="offset points",
            rotation=rotation,
            ha="center",
            va=va,
            fontsize=fontsize,
            color=colour,
            zorder=6,
        )


def _three_d_tidy(ax, ctx):
    """White panes and a restrained frame for 3-D axes."""
    try:
        for axis in (ax.xaxis, ax.yaxis, ax.zaxis):
            axis.pane.set_facecolor((1.0, 1.0, 1.0, 1.0))
            axis.pane.set_edgecolor("#D9D9D9")
        ax.grid(False)
    except Exception:  # pragma: no cover - defensive for non-3D axes
        pass


# ---------------------------------------------------------------------------
# Vibrational spectra
# ---------------------------------------------------------------------------

@register(
    "spectra",
    zh="红外 / 拉曼光谱",
    en="IR / Raman spectra",
    category="physical",
    summary_zh="多曲线叠加的振动光谱（FTIR/Raman/UV-Vis）：逐条归一化、垂直偏移、峰位标注与反向波数轴。",
    summary_en="Overlaid vibrational spectra with per-trace normalisation, vertical offsets, peak labels and a reversed wavenumber axis.",
    tags=["FTIR", "Raman", "UV-Vis", "光谱", "峰位"],
    aspect=0.78,
    options=[
        {"id": "normalize", "type": "bool", "default": True, "label_zh": "逐条归一化", "label_en": "Normalise each trace"},
        {"id": "offset", "type": "float", "default": 0.24, "min": 0.0, "max": 1.0, "step": 0.02, "label_zh": "垂直偏移", "label_en": "Vertical offset"},
        {"id": "peaks", "type": "bool", "default": True, "label_zh": "标注峰位", "label_en": "Label peaks"},
        {"id": "peak_count", "type": "int", "default": 3, "min": 1, "max": 6, "step": 1, "label_zh": "每条曲线峰数", "label_en": "Peaks per trace"},
        {"id": "xreversed", "type": "bool", "default": True, "label_zh": "反向波数轴", "label_en": "Reversed wavenumber axis"},
    ],
    demo={
        "data": {"sample": "phys_spectra", "mapping": {"x": "wavenumber", "y": "absorbance", "group": "sample"}},
        "style": {"domain": "chemistry", "journal": "acs"},
        "labels": {"x": "Wavenumber (cm$^{-1}$)", "y": "Absorbance (a.u.)"},
    },
)
def render_spectra(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("spectra needs at least one numeric series", "invalid_data")
    normalize = ctx.flag("normalize", True)
    offset = float(ctx.num("offset", 0.24))
    show_peaks = ctx.flag("peaks", True)
    n_peaks = int(max(1, ctx.num("peak_count", 3)))
    fontsize = float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 0.6
    line_width = float(ctx.style["line"]["lw"]) * 0.95
    x_span = 0.0
    candidates: list[tuple[float, float, str]] = []

    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        if x.size < 4:
            continue
        order = np.argsort(x)
        x, y = x[order], y[order]
        y = H.smooth(y, 3)
        if normalize:
            lo, hi = float(np.min(y)), float(np.max(y))
            y = (y - lo) / (hi - lo) if hi > lo else np.zeros_like(y)
        y = y + offset * index
        colour = item.get("color") or ctx.color(index)
        ax.plot(
            x,
            y,
            color=colour,
            lw=line_width,
            label=item.get("label") or item.get("name"),
            zorder=3,
        )
        x_span = max(x_span, float(np.max(x) - np.min(x)))
        if show_peaks:
            local_span = float(np.max(x) - np.min(x)) or 1.0
            peaks = _peak_xy(x, y, prominence=0.10, count=n_peaks, distance_frac=1.0 / 90.0, min_sep=0.055 * local_span)
            candidates.extend((float(py), float(px), colour) for px, py in peaks)
    ax.margins(y=0.12)

    # Place peak labels tallest-first and skip near-duplicate x positions so the
    # rotated labels of different traces never collide.
    placed: list[float] = []
    for py, px, colour in sorted(candidates, key=lambda entry: entry[0], reverse=True):
        if any(abs(px - other) < 0.020 * x_span for other in placed):
            continue
        placed.append(px)
        _label_peaks(ax, [(px, py)], colour, fontsize, offset=4.0 + 8.0 * (len(placed) % 2))
    ctx.finish(ax, xreversed=ctx.flag("xreversed", True), legend={"loc": "upper right"})
    return ctx.fig


# ---------------------------------------------------------------------------
# Powder XRD
# ---------------------------------------------------------------------------

_XRD_REFERENCES = {
    "anatase": (
        "Anatase (JCPDS 21-1272)",
        [(25.28, 100), (36.95, 10), (37.80, 20), (38.58, 8), (48.05, 30), (53.89, 20),
         (55.06, 20), (62.69, 14), (68.76, 6), (70.31, 6), (75.03, 10), (76.02, 4), (82.66, 4)],
    ),
    "rutile": (
        "Rutile (JCPDS 21-1276)",
        [(27.45, 100), (36.09, 8), (39.19, 6), (41.23, 30), (44.05, 6), (54.32, 60),
         (56.64, 20), (62.75, 10), (64.04, 12), (69.01, 8), (72.44, 4), (76.54, 4)],
    ),
}


@register(
    "xrd",
    zh="X 射线衍射谱",
    en="XRD patterns",
    category="physical",
    summary_zh="按样品垂直堆叠的粉末 XRD：2θ 轴、特征峰位标注与可选参考卡片竖线。",
    summary_en="Powder XRD patterns stacked per sample with a 2-theta axis, characteristic-peak labels and optional reference sticks.",
    tags=["XRD", "衍射", "2theta", "materials"],
    aspect=0.8,
    options=[
        {"id": "stack", "type": "float", "default": 1.0, "min": 0.2, "max": 2.0, "step": 0.05, "label_zh": "堆叠间距", "label_en": "Stack spacing"},
        {"id": "annotate", "type": "bool", "default": True, "label_zh": "标注特征峰", "label_en": "Label characteristic peaks"},
        {"id": "refs", "type": "enum", "default": "none", "choices": ["none", "anatase", "rutile"], "label_zh": "参考卡片", "label_en": "Reference card"},
    ],
    demo={
        "data": {"sample": "phys_xrd", "mapping": {"x": "two_theta", "y": "intensity", "group": "sample"}},
        "style": {"domain": "materials", "journal": "acs"},
        "labels": {"x": "2$\\theta$ (deg)", "y": "Intensity (a.u.)"},
        "options": {"refs": "anatase"},
    },
)
def render_xrd(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("xrd needs at least one numeric series", "invalid_data")
    stack_factor = float(ctx.num("stack", 1.0)) or 1.0
    annotate = ctx.flag("annotate", True)
    spacing = stack_factor * (1.45 if annotate else 1.0)
    ref = str(ctx.opt("refs", "none"))
    fontsize = 6.0
    line_width = float(ctx.style["line"]["lw"]) * 0.95
    x_lo, x_hi = math.inf, -math.inf

    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        if x.size < 4:
            continue
        order = np.argsort(x)
        x, y = x[order], y[order]
        y = H.smooth(y, 3)
        top = float(np.max(y)) if float(np.max(y)) > 0 else 1.0
        y = y / top
        base = spacing * index
        colour = item.get("color") or ctx.color(index)
        ax.plot(x, y + base, color=colour, lw=line_width, label=item.get("label") or item.get("name"), zorder=3)
        x_lo, x_hi = min(x_lo, float(x.min())), max(x_hi, float(x.max()))
        if annotate:
            # Strongest peaks only; closer than 2 deg apart keep the strongest one.
            peaks = _peak_xy(x, y, prominence=0.06, count=3, distance_frac=1.0 / 120.0, min_sep=2.0)
            for px, py in peaks:
                ax.annotate(
                    f"{px:.1f}",
                    xy=(px, py + base),
                    xytext=(0.0, 2.5),
                    textcoords="offset points",
                    rotation=90,
                    ha="center",
                    va="bottom",
                    fontsize=fontsize,
                    color=colour,
                    zorder=6,
                )

    n = len(series)
    top_limit = spacing * max(n - 1, 0) + (1.55 if annotate else 1.15)
    y_bottom = -0.05
    if ref in _XRD_REFERENCES:
        caption, sticks = _XRD_REFERENCES[ref]
        y_base = -0.56
        positions = [pos for pos, _rel in sticks]
        heights = [0.40 * rel / 100.0 for _pos, rel in sticks]
        ax.vlines(positions, y_base, np.asarray(heights) + y_base, color="#8C8C8C", lw=0.7, zorder=2)
        ax.text(x_lo + 0.4, y_base - 0.13, caption, fontsize=fontsize - 0.5, color="#666666", ha="left", va="top")
        y_bottom = y_base - 0.30
    ax.set_ylim(y_bottom, top_limit)
    ax.set_yticks([])
    ax.tick_params(axis="y", left=False)
    ctx.finish(ax, legend={"loc": "upper right"})
    return ctx.fig


# ---------------------------------------------------------------------------
# Cyclic voltammetry
# ---------------------------------------------------------------------------

@register(
    "cv",
    zh="循环伏安曲线",
    en="Cyclic voltammetry",
    category="physical",
    summary_zh="闭合 CV 回线：多圈叠加、扫描方向箭头、氧化/还原峰位标注与电位-电流轴。",
    summary_en="Closed cyclic-voltammetry loops with multiple cycles, scan-direction arrows and anodic/cathodic peak labels.",
    tags=["CV", "电化学", "伏安", "scan rate"],
    aspect=0.85,
    options=[
        {"id": "arrows", "type": "bool", "default": True, "label_zh": "扫描方向箭头", "label_en": "Scan-direction arrows"},
        {"id": "peaks", "type": "bool", "default": True, "label_zh": "标注峰位", "label_en": "Label peak potentials"},
    ],
    demo={
        "data": {"sample": "phys_cv", "mapping": {"x": "potential", "y": "current", "group": "cycle"}},
        "style": {"domain": "chemistry", "journal": "acs"},
        "labels": {"x": "Potential (V vs Ag/AgCl)", "y": "Current ($\\mu$A)"},
    },
)
def render_cv(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("cv needs at least one numeric series", "invalid_data")
    arrows = ctx.flag("arrows", True)
    show_peaks = ctx.flag("peaks", True)
    fontsize = float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 0.4
    line_width = float(ctx.style["line"]["lw"])

    clean = []
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        if x.size < 8:
            continue
        x = np.append(x, x[0])
        y = np.append(y, y[0])
        clean.append((x, y))
        colour = item.get("color") or ctx.color(index)
        ax.plot(x, y, color=colour, lw=line_width, label=item.get("label") or item.get("name"), zorder=3)
        if arrows:
            for frac in (0.20, 0.70):
                j = int(frac * (x.size - 1))
                if 3 <= j <= x.size - 4:
                    ax.annotate(
                        "",
                        xy=(x[j + 3], y[j + 3]),
                        xytext=(x[j - 3], y[j - 3]),
                        arrowprops={
                            "arrowstyle": "-|>",
                            "color": colour,
                            "lw": 0.9,
                            "mutation_scale": 9.5,
                            "shrinkA": 0.0,
                            "shrinkB": 0.0,
                        },
                        zorder=5,
                    )

    if show_peaks and clean:
        x, y = clean[0]
        i_max = int(np.argmax(y))
        i_min = int(np.argmin(y))
        ax.annotate(
            f"$E_{{pa}}$ = {x[i_max]:.2f} V",
            xy=(x[i_max], y[i_max]),
            xytext=(6, 3),
            textcoords="offset points",
            ha="left",
            va="bottom",
            fontsize=fontsize,
            color="#333333",
        )
        ax.annotate(
            f"$E_{{pc}}$ = {x[i_min]:.2f} V",
            xy=(x[i_min], y[i_min]),
            xytext=(6, -3),
            textcoords="offset points",
            ha="left",
            va="top",
            fontsize=fontsize,
            color="#333333",
        )

    ctx.finish(ax, legend={"loc": "upper left"})
    return ctx.fig


# ---------------------------------------------------------------------------
# TGA / DSC
# ---------------------------------------------------------------------------

@register(
    "tga",
    zh="热重分析（TGA/DSC）",
    en="Thermogravimetric analysis",
    category="physical",
    summary_zh="双 y 轴热分析：左轴失重百分比、右轴热流，温度轴与分解温度/拐点标注，两轴颜色区分。",
    summary_en="Dual-axis thermal analysis: weight loss on the left, heat flow on the right, with decomposition temperatures and colour-matched axes.",
    tags=["TGA", "DSC", "热分析", "双轴"],
    aspect=0.76,
    options=[
        {"id": "annotate", "type": "bool", "default": True, "label_zh": "标注分解温度", "label_en": "Label decomposition temperatures"},
        {"id": "smooth", "type": "int", "default": 7, "min": 1, "max": 31, "step": 2, "label_zh": "平滑窗口", "label_en": "Smoothing window"},
    ],
    demo={
        "data": {"sample": "phys_tga", "mapping": {"x": "temperature", "y": "weight_pct", "y2": "heat_flow"}},
        "style": {"domain": "chemistry", "journal": "acs"},
        "labels": {"x": "Temperature ($^{\\circ}$C)", "y": "Weight (%)", "y2": "Heat flow (mW mg$^{-1}$)"},
    },
)
def render_tga(ctx):
    ax = ctx.ax()
    series = _valid_series(ctx)
    if not series:
        raise SpecError("tga needs a weight column and a temperature column", "invalid_data")
    item = series[0]
    temperature, weight = H.clean_xy(item["x"], item["y"])
    heat = _column(ctx, "y2")
    if heat is not None:
        heat = np.asarray(heat, dtype=float)[: temperature.size]
        if heat.size != temperature.size:
            heat = None
    elif item.get("y2") is not None:
        heat = np.asarray(item["y2"], dtype=float)[: temperature.size]

    order = np.argsort(temperature)
    temperature, weight = temperature[order], weight[order]
    if heat is not None:
        heat = heat[order]

    weight_colour = ctx.color(0)
    heat_colour = ctx.color(6)
    fontsize = float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 0.5
    line_width = float(ctx.style["line"]["lw"])

    ax.plot(temperature, weight, color=weight_colour, lw=line_width + 0.1, label=ctx.label("y") or "Weight", zorder=4)
    ax.set_ylabel(ctx.label("y") or "Weight (%)")
    ctx.finish(ax, xlabel=None, ylabel=None, legend=False)
    ax.yaxis.label.set_color(weight_colour)
    ax.tick_params(axis="y", colors=weight_colour)

    if heat is not None and np.isfinite(heat).any():
        heat = H.smooth(heat, 5)
        twin = ax.twinx()
        twin.plot(temperature, heat, color=heat_colour, lw=line_width, zorder=3)
        twin.set_ylabel(ctx.label("y2") or "Heat flow (a.u.)")
        twin.yaxis.label.set_color(heat_colour)
        twin.tick_params(axis="y", right=True, labelright=True, colors=heat_colour)
        twin.tick_params(axis="x", bottom=False, labelbottom=False)
        ctx.style_axes(twin, grid=False)
        twin.tick_params(axis="y", right=True, labelright=True, colors=heat_colour)
        twin.yaxis.label.set_color(heat_colour)
        if ctx.style.get("ticks") == "in":
            twin.tick_params(axis="y", direction="in", right=True, labelright=True)

    if ctx.flag("annotate", True):
        smooth = H.smooth(weight, max(3, int(ctx.num("smooth", 7))))
        derivative = np.gradient(smooth, temperature)
        idx, prom = _find_peaks(-derivative, prominence=0.12, distance=max(3, int(temperature.size / 24)))
        if idx.size:
            order_idx = np.argsort(prom)[::-1][:2] if prom.size else np.arange(idx.size)[:2]
            temperatures = sorted(float(temperature[idx[i]]) for i in order_idx)
            for t_dec in temperatures:
                k = int(np.argmin(np.abs(temperature - t_dec)))
                ax.annotate(
                    f"$T_{{d}}$ = {temperature[k]:.0f} $^{{\\circ}}$C",
                    xy=(temperature[k], weight[k]),
                    xytext=(8, 12),
                    textcoords="offset points",
                    ha="left",
                    va="bottom",
                    fontsize=fontsize,
                    color="#333333",
                    arrowprops={"arrowstyle": "-", "color": "#9A9A9A", "lw": 0.6, "shrinkA": 1.0, "shrinkB": 2.5},
                )
        ax.annotate(
            f"Residue {weight[-1]:.1f}%",
            xy=(temperature[-1], weight[-1]),
            xytext=(-4, 6),
            textcoords="offset points",
            ha="right",
            va="bottom",
            fontsize=fontsize,
            color=weight_colour,
        )
    return ctx.fig


# ---------------------------------------------------------------------------
# Contour field
# ---------------------------------------------------------------------------

@register(
    "contour",
    zh="等高线场图",
    en="Filled contour field",
    category="physical",
    summary_zh="二维标量的填充等高线：等高线标注、感知均匀色标与物理量标签。",
    summary_en="Filled contours of a 2-D scalar field with inline level labels and a labelled, perceptually uniform colour bar.",
    tags=["contour", "场分布", "2D", "色标"],
    aspect=0.82,
    options=[
        {"id": "filled", "type": "bool", "default": True, "label_zh": "填充色块", "label_en": "Filled contours"},
        {"id": "labels", "type": "bool", "default": True, "label_zh": "等高线数值", "label_en": "Contour labels"},
        {"id": "levels", "type": "int", "default": 14, "min": 5, "max": 28, "step": 1, "label_zh": "层数", "label_en": "Level count"},
    ],
    demo={
        "data": {"sample": "phys_contour", "mapping": {"x": "x", "y": "y", "z": "z"}},
        "style": {"domain": "materials", "journal": "acs"},
        "labels": {"x": "x (mm)", "y": "y (mm)", "colorbar": "Energy (eV)"},
    },
)
def render_contour(ctx):
    ax = ctx.ax()
    xu, yu, grid = _pivot_grid(ctx)
    finite = grid[np.isfinite(grid)]
    if finite.size < 6:
        raise SpecError("contour grid has too few finite cells", "invalid_data")
    n_levels = int(max(5, ctx.num("levels", 14)))
    z_min, z_max = float(np.nanmin(grid)), float(np.nanmax(grid))
    from matplotlib.ticker import MaxNLocator

    locator = MaxNLocator(nbins=n_levels, steps=[1, 2, 2.5, 5, 10])
    nice = np.asarray(locator.tick_values(z_min, z_max), dtype=float)
    levels = nice[(nice >= z_min - 1e-12) & (nice <= z_max + 1e-12)]
    if levels.size < 4:
        levels = np.linspace(z_min, z_max, n_levels)
    cmap = ctx.cmap()
    fill_levels = np.unique(np.concatenate([[z_min], levels, [z_max]]))
    if ctx.flag("filled", True):
        filled = ax.contourf(xu, yu, grid, levels=fill_levels, cmap=cmap)
    else:
        filled = ax.contour(xu, yu, grid, levels=levels, cmap=cmap, linewidths=0.8)
    lines = ax.contour(
        xu,
        yu,
        grid,
        levels=levels,
        colors="#3A3A3A",
        linewidths=0.32,
        alpha=0.45,
        negative_linestyles="solid",
    )
    if ctx.flag("labels", True):
        label_levels = [float(value) for value in levels[::2]]
        if len(label_levels) >= 2:
            try:
                import matplotlib.patheffects as path_effects

                contour_labels = ax.clabel(
                    lines,
                    levels=label_levels,
                    inline=True,
                    fontsize=float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 1.2,
                    fmt="%.2f",
                )
                for text in contour_labels:
                    text.set_path_effects([path_effects.withStroke(linewidth=1.1, foreground="white")])
            except Exception:  # pragma: no cover - defensive
                pass
    colorbar = ctx.colorbar(filled, ax=ax, label=ctx.label("colorbar") or "z", fraction=0.055, pad=0.025, format="%.2f")
    try:
        colorbar.set_ticks(levels)
    except Exception:  # pragma: no cover - defensive
        pass
    ctx.finish(ax, grid=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Heatmap
# ---------------------------------------------------------------------------

@register(
    "heatmap",
    zh="热图（矩阵 / 场）",
    en="Heatmap",
    category="physical",
    summary_zh="矩阵或二维长表热图：pcolormesh/imshow、色标物理量标签，小矩阵可选逐格数值标注。",
    summary_en="Matrix or long-form heatmap with a labelled colour bar and optional in-cell values for small matrices.",
    tags=["heatmap", "矩阵", "场", "色标"],
    aspect=0.9,
    options=[
        {"id": "values", "type": "bool", "default": True, "label_zh": "显示数值", "label_en": "Show cell values"},
        {"id": "grid", "type": "bool", "default": False, "label_zh": "网格线", "label_en": "Cell grid"},
    ],
    demo={
        "data": {"sample": "phys_heatmap", "mapping": {"x": "x_um", "y": "y_um", "z": "phase_fraction"}},
        "style": {"domain": "materials", "journal": "acs"},
        "labels": {"x": "x ($\\mu$m)", "y": "y ($\\mu$m)", "colorbar": "Phase fraction (a.u.)"},
    },
)
def render_heatmap(ctx):
    ax = ctx.ax()
    cmap = ctx.cmap()
    x_values = y_values = None
    if ctx.data.mode == "matrix" and ctx.data.matrix is not None:
        grid = np.asarray(ctx.data.matrix, dtype=float)
        row_labels = ctx.data.row_labels or [str(i + 1) for i in range(grid.shape[0])]
        col_labels = ctx.data.col_labels or [str(i + 1) for i in range(grid.shape[1])]
        x_values = np.arange(grid.shape[1], dtype=float)
        y_values = np.arange(grid.shape[0], dtype=float)
        x_mesh, y_mesh = np.meshgrid(x_values, y_values)
        image = ax.pcolormesh(x_mesh, y_mesh, grid, shading="nearest", cmap=cmap)
        ax.set_xticks(x_values)
        ax.set_xticklabels([str(v) for v in col_labels])
        ax.set_yticks(y_values)
        ax.set_yticklabels([str(v) for v in row_labels])
    else:
        x_values, y_values, grid = _pivot_grid(ctx)
        x_mesh, y_mesh = np.meshgrid(x_values, y_values)
        image = ax.pcolormesh(x_mesh, y_mesh, grid, shading="nearest", cmap=cmap)

    if ctx.flag("grid", False):
        if x_values.size > 1:
            dx = float(np.median(np.diff(x_values)))
        else:
            dx = 1.0
        if y_values.size > 1:
            dy = float(np.median(np.diff(y_values)))
        else:
            dy = 1.0
        ax.set_xticks(np.concatenate([[x_values[0] - dx / 2.0], x_values + dx / 2.0]), minor=True)
        ax.set_yticks(np.concatenate([[y_values[0] - dy / 2.0], y_values + dy / 2.0]), minor=True)
        ax.grid(which="minor", color="#F0F0F0", lw=0.5, ls="-")

    if ctx.flag("values", True) and grid.size <= 120:
        fontsize = float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 1.4
        for row in range(grid.shape[0]):
            for col in range(grid.shape[1]):
                value = grid[row, col]
                if not np.isfinite(value):
                    continue
                rgba = cmap(image.norm(value))
                ax.text(
                    col if x_values is None else x_values[col],
                    row if y_values is None else y_values[row],
                    f"{value:.2f}",
                    ha="center",
                    va="center",
                    fontsize=fontsize,
                    color=text_color_on(to_hex(rgba)),
                    zorder=4,
                )

    ctx.colorbar(image, ax=ax, label=ctx.label("colorbar") or "value", fraction=0.055, pad=0.025, format="%.2f")
    ctx.finish(ax, grid=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# 3-D surface
# ---------------------------------------------------------------------------

@register(
    "surface3d",
    zh="三维曲面",
    en="3-D surface",
    category="physical",
    summary_zh="带色标的 3-D 曲面：可调视角、块状长宽比、白底面板与感知均匀色标（避免彩虹色）。",
    summary_en="3-D surface with a colour bar, adjustable view, sensible box aspect and a perceptually uniform map (no rainbow).",
    tags=["3D", "surface", "曲面", "视角"],
    aspect=0.95,
    options=[
        {"id": "elev", "type": "float", "default": 32.0, "min": 5.0, "max": 85.0, "step": 1.0, "label_zh": "俯仰角", "label_en": "Elevation"},
        {"id": "azim", "type": "float", "default": -58.0, "min": -180.0, "max": 180.0, "step": 2.0, "label_zh": "方位角", "label_en": "Azimuth"},
    ],
    demo={
        "data": {"sample": "phys_contour", "mapping": {"x": "x", "y": "y", "z": "z"}},
        "style": {"domain": "materials", "journal": "acs"},
        "labels": {"x": "x (mm)", "y": "y (mm)", "colorbar": "Energy (eV)"},
    },
)
def render_surface3d(ctx):
    ax = _projection_axes(ctx, "3d")
    xu, yu, grid = _pivot_grid(ctx)
    x_mesh, y_mesh = np.meshgrid(xu, yu)
    cmap = ctx.cmap()
    surface = ax.plot_surface(
        x_mesh,
        y_mesh,
        grid,
        cmap=cmap,
        linewidth=0.0,
        antialiased=False,
        rcount=min(grid.shape[0], 80),
        ccount=min(grid.shape[1], 80),
        vmin=float(np.nanmin(grid)),
        vmax=float(np.nanmax(grid)),
    )
    _three_d_tidy(ax, ctx)
    ax.view_init(elev=float(ctx.num("elev", 32.0)), azim=float(ctx.num("azim", -58.0)))
    try:
        ax.set_box_aspect((1.0, 0.82, 0.62))
    except Exception:  # pragma: no cover - older matplotlib
        pass
    ctx.finish(ax, xlabel=None, ylabel=None, legend=False)
    ctx.colorbar(surface, ax=ax, label=ctx.label("colorbar") or "z", fraction=0.048, pad=0.10)
    return ctx.fig


# ---------------------------------------------------------------------------
# 3-D scatter
# ---------------------------------------------------------------------------

@register(
    "scatter3d",
    zh="三维散点",
    en="3-D scatter",
    category="physical",
    summary_zh="3-D 分组散点：分组配色与图例、白底面板、可调视角，适合三变量结构-性能关系。",
    summary_en="Grouped 3-D scatter with group colours, a legend, white panes and an adjustable view for three-variable structure-property relations.",
    tags=["3D", "scatter", "分组", "structure-property"],
    aspect=0.92,
    options=[
        {"id": "marker_size", "type": "float", "default": 16.0, "min": 4.0, "max": 120.0, "step": 2.0, "label_zh": "点大小", "label_en": "Marker size"},
        {"id": "elev", "type": "float", "default": 20.0, "min": 5.0, "max": 85.0, "step": 1.0, "label_zh": "俯仰角", "label_en": "Elevation"},
        {"id": "azim", "type": "float", "default": -55.0, "min": -180.0, "max": 180.0, "step": 2.0, "label_zh": "方位角", "label_en": "Azimuth"},
    ],
    demo={
        "data": {"sample": "phys_scatter3d", "mapping": {"x": "size_nm", "y": "zeta_mv", "z": "uptake_rate", "group": "group"}},
        "style": {"domain": "physics", "journal": "aps"},
        "labels": {"x": "Particle size (nm)", "y": "Zeta potential (mV)", "colorbar": "Uptake rate (h$^{-1}$)"},
    },
)
def render_scatter3d(ctx):
    ax = _projection_axes(ctx, "3d")
    x = _column(ctx, "x")
    y = _column(ctx, "y")
    z = _column(ctx, "z")
    if x is None or y is None or z is None:
        raise SpecError("scatter3d needs data mapping for x, y and z columns", "invalid_mapping", "mapping")
    groups = _categorical(ctx, "group")
    size = float(ctx.num("marker_size", 16.0))
    if groups is None:
        groups = np.asarray([""] * min(x.size, y.size, z.size), dtype=object)
    n = min(x.size, y.size, z.size, groups.size)
    x, y, z, groups = x[:n], y[:n], z[:n], groups[:n]
    order = np.argsort(groups, kind="stable")
    x, y, z, groups = x[order], y[order], z[order], groups[order]
    levels = list(dict.fromkeys(groups.tolist()))
    for index, level in enumerate(levels):
        mask = groups == level
        colour = ctx.color(index)
        ax.scatter(
            x[mask],
            y[mask],
            z[mask],
            s=size,
            color=colour,
            alpha=0.86,
            edgecolors="white",
            linewidths=0.28,
            depthshade=True,
            label=str(level) if str(level) else None,
            zorder=3,
        )
    _three_d_tidy(ax, ctx)
    ax.view_init(elev=float(ctx.num("elev", 20.0)), azim=float(ctx.num("azim", -55.0)))
    try:
        ax.set_box_aspect((1.0, 0.9, 0.75))
    except Exception:  # pragma: no cover
        pass
    legend = {"loc": "upper left"} if len(levels) > 1 else False
    ctx.finish(ax, legend=False)
    if len(levels) > 1:
        ctx.legend(ax, loc="upper left", bbox_to_anchor=(0.0, 0.92))
    ax.set_zlabel("Uptake rate (h$^{-1}$)")
    return ctx.fig


# ---------------------------------------------------------------------------
# Polar pattern
# ---------------------------------------------------------------------------

@register(
    "polar",
    zh="极坐标曲线",
    en="Polar plot",
    category="physical",
    summary_zh="极坐标方向图：角度刻度（45° 间隔）、径向 dB 刻度与多平面曲线，适合天线/散射方向图。",
    summary_en="Polar pattern with 45-degree azimuth ticks, radial dB grid and multiple planes for antenna or scattering patterns.",
    tags=["polar", "方向图", "天线", "azimuth"],
    aspect=1.0,
    options=[
        {"id": "db_scale", "type": "bool", "default": True, "label_zh": "dB 映射径向", "label_en": "Map radial axis in dB"},
        {"id": "theta_step", "type": "enum", "default": "45", "choices": ["30", "45", "60"], "label_zh": "角度刻度间隔", "label_en": "Azimuth tick step"},
    ],
    demo={
        "data": {"sample": "phys_polar", "mapping": {"x": "angle_deg", "y": "gain_db", "group": "plane"}},
        "style": {"domain": "physics", "journal": "aps"},
        "labels": {"x": "Azimuth ($^{\\circ}$)"},
    },
)
def render_polar(ctx):
    ax = _projection_axes(ctx, "polar")
    series = _valid_series(ctx)
    if not series:
        raise SpecError("polar needs at least one numeric series", "invalid_data")
    db_scale = ctx.flag("db_scale", True)
    line_width = float(ctx.style["line"]["lw"])
    for index, item in enumerate(series):
        x, y = H.clean_xy(item["x"], item["y"])
        if x.size < 4:
            continue
        theta = np.deg2rad(np.mod(x, 360.0))
        theta = np.append(theta, theta[0])
        if db_scale:
            radius = np.power(10.0, np.clip(y, -60.0, 6.0) / 20.0)
        else:
            radius = np.asarray(y, dtype=float)
        radius = np.append(radius, radius[0])
        colour = item.get("color") or ctx.color(index)
        ax.plot(theta, radius, color=colour, lw=line_width, label=item.get("label") or item.get("name"), zorder=3)

    step = float(str(ctx.opt("theta_step", "45")))
    ticks = np.arange(0.0, 360.0, step)
    labels = [f"{int(round(value))}$^{{\\circ}}$" for value in ticks]
    ax.set_thetagrids(ticks, labels)
    if db_scale:
        db_ticks = [0.0, -3.0, -6.0, -10.0, -20.0, -30.0]
        radii = np.power(10.0, np.asarray(db_ticks) / 20.0)
        ax.set_rgrids(radii, labels=[f"{value:g}" for value in db_ticks])
        ax.set_ylim(0.0, 1.0)
    else:
        values = np.asarray(series[0]["y"], dtype=float)
        finite = values[np.isfinite(values)]
        top = float(np.max(finite)) if finite.size else 1.0
        ax.set_ylim(0.0, top * 1.02 if top > 0 else 1.0)
    ax.set_rlabel_position(112.5)
    ctx.finish(ax, legend=False)
    if len(series) > 1:
        ctx.legend(ax, loc="lower left")
    H.corner_note(
        ax,
        "Normalized gain (dB)",
        loc="lower right",
        fontsize=float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 0.8,
    )
    ax.grid(True, color="#E8E8E8", linewidth=0.5, linestyle="-")
    return ctx.fig


# ---------------------------------------------------------------------------
# Wind rose
# ---------------------------------------------------------------------------

@register(
    "windrose",
    zh="风玫瑰图",
    en="Wind rose",
    category="physical",
    summary_zh="16 方位风向频率堆叠极坐标柱：风速分级、北向 0°、顺时针方位、径向频率刻度与顺序色标。",
    summary_en="16-sector stacked polar wind rose: speed classes, north-up 0-degree clockwise azimuth, radial frequency ticks and a sequential colour ramp.",
    tags=["wind rose", "风玫瑰", "方向统计", "polar"],
    aspect=1.0,
    options=[
        {"id": "nbins", "type": "enum", "default": "16", "choices": ["8", "12", "16", "24"], "label_zh": "方位分箱", "label_en": "Direction bins"},
        {"id": "calm", "type": "float", "default": 0.5, "min": 0.0, "max": 2.0, "step": 0.1, "label_zh": "静风阈值 (m/s)", "label_en": "Calm threshold (m/s)"},
    ],
    demo={
        "data": {"sample": "phys_wind", "mapping": {"x": "direction_deg", "y": "speed_ms"}},
        "style": {"domain": "earth", "journal": "agu"},
        "labels": {"x": "Direction", "y": "Frequency (%)", "legend": "Wind speed (m s$^{-1}$)"},
    },
)
def render_windrose(ctx):
    ax = _projection_axes(ctx, "polar")
    series = _valid_series(ctx)
    if not series:
        raise SpecError("windrose needs direction and speed columns", "invalid_data")
    item = series[0]
    direction = np.mod(np.asarray(item["x"], dtype=float), 360.0)
    speed = np.asarray(item["y"], dtype=float)
    n = min(direction.size, speed.size)
    direction, speed = direction[:n], speed[:n]
    mask = np.isfinite(direction) & np.isfinite(speed)
    direction, speed = direction[mask], speed[mask]
    if direction.size < 12:
        raise SpecError("windrose needs at least 12 finite observations", "invalid_data")

    nbins = int(float(str(ctx.opt("nbins", "16"))))
    nbins = max(4, min(nbins, 36))
    edges = np.linspace(0.0, 360.0, nbins + 1)
    sector = np.clip(np.digitize(direction, edges) - 1, 0, nbins - 1)
    centre = np.deg2rad((edges[:-1] + edges[1:]) / 2.0)
    width = np.deg2rad(360.0 / nbins * 0.84)

    calm_limit = float(ctx.num("calm", 0.5))
    total = float(direction.size)
    speed_edges = [calm_limit, 2.0, 4.0, 6.0, 8.0, 10.0, 1.0e9]
    speed_edges = sorted(set(round(value, 2) for value in speed_edges))
    while len(speed_edges) < 3:
        speed_edges = [0.0, 2.0, 1.0e9]
    classes = []
    for lo, hi in zip(speed_edges[:-1], speed_edges[1:]):
        if hi >= 1.0e9:
            classes.append((lo, hi, f"$\\geq$ {lo:g}"))
        else:
            classes.append((lo, hi, f"{lo:g}–{hi:g}"))
    cmap = ctx.cmap()
    colours = [cmap(0.24 + 0.68 * (index / max(len(classes) - 1, 1))) for index in range(len(classes))]

    bottom = np.zeros(nbins, dtype=float)
    for (lo, hi, _label), colour in zip(classes, colours):
        selected = (speed >= lo) & (speed < hi)
        counts = np.bincount(sector[selected], minlength=nbins).astype(float)
        frequencies = counts / total * 100.0
        if not np.any(frequencies > 0):
            continue
        ax.bar(centre, frequencies, width=width, bottom=bottom, color=colour, edgecolor="white", linewidth=0.35, zorder=3)
        bottom = bottom + frequencies

    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)
    ax.set_thetagrids(np.arange(0.0, 360.0, 45.0), ["N", "NE", "E", "SE", "S", "SW", "W", "NW"])
    top = float(np.max(bottom)) if bottom.size else 1.0
    step = 5.0 if top <= 20 else 10.0
    ticks = np.arange(0.0, math.floor(top / step + 1.0) * step + 0.1, step)
    if ticks.size < 2:
        ticks = np.asarray([0.0, max(top, 1.0)])
    ax.set_ylim(0.0, float(ticks[-1]))
    inner_ticks = [value for value in ticks if value < float(ticks[-1]) - 1e-9]
    ax.set_yticks(inner_ticks if inner_ticks else ticks)
    ax.set_yticklabels([f"{value:g}" for value in (inner_ticks if inner_ticks else ticks)])
    ax.set_rlabel_position(22.5)
    mean_speed = float(np.mean(speed))
    H.corner_note(ax, f"n = {int(total)}\nmean {mean_speed:.1f} m s$^{{-1}}$", loc="lower left", fontsize=float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 0.8)
    ctx.finish(ax, legend=False)

    # Discrete colour scale for the speed classes (outside the rose, no overlap).
    finite_speed = speed[np.isfinite(speed)]
    top_speed = float(np.max(finite_speed)) if finite_speed.size else 10.0
    bounds = [float(speed_edges[0])]
    bounds.extend(float(edge) for edge in speed_edges[1:-1])
    bounds.append(max(float(np.ceil(top_speed)), float(speed_edges[-2]) + 1.0))
    bounds = sorted(set(round(value, 3) for value in bounds))
    from matplotlib.cm import ScalarMappable
    from matplotlib.colors import BoundaryNorm, ListedColormap

    listed = ListedColormap(colours)
    norm = BoundaryNorm(bounds, listed.N)
    scalar = ScalarMappable(norm=norm, cmap=listed)
    colorbar = ctx.colorbar(
        scalar,
        ax=ax,
        label=ctx.label("legend") or "Wind speed (m s$^{-1}$)",
        fraction=0.045,
        pad=0.055,
    )
    try:
        colorbar.set_ticks(bounds)
        colorbar.set_ticklabels([f"{value:g}" for value in bounds])
    except Exception:  # pragma: no cover - defensive
        pass
    return ctx.fig


# ---------------------------------------------------------------------------
# Taylor diagram
# ---------------------------------------------------------------------------

@register(
    "taylor",
    zh="Taylor 图",
    en="Taylor diagram",
    category="physical",
    summary_zh="Quarter-circle Taylor 图：相关角射线、RMSD 同心圆、参考点与模型点标注。",
    summary_en="Quarter-circle Taylor diagram with correlation rays, RMSD circles centred on the reference and labelled model points.",
    tags=["Taylor", "模式评估", "correlation", "RMSD"],
    aspect=1.0,
    options=[
        {"id": "rmsd", "type": "bool", "default": True, "label_zh": "RMSD 同心弧", "label_en": "RMSD arcs"},
        {"id": "corr_ticks", "type": "string", "default": "1,0.99,0.95,0.9,0.8,0.7,0.6,0.4,0.2,0", "label_zh": "相关角刻度", "label_en": "Correlation ticks"},
    ],
    demo={
        "data": {
            "sample": "phys_taylor",
            "mapping": {"label": "model", "correlation": "correlation", "std_ratio": "std_ratio"},
        },
        "style": {"domain": "physics", "journal": "aps"},
        "labels": {"y": "Normalized standard deviation"},
    },
)
def render_taylor(ctx):
    """Taylor diagram drawn in Cartesian coordinates.

    A restricted-theta polar axes misplaces radial tick labels, so the quarter
    circle, correlation rays, standard-deviation circles and RMSD arcs are drawn
    explicitly on a square, open-framed Cartesian axes.
    """
    ax = ctx.ax()
    correlation = _column(ctx, "correlation")
    std_ratio = _column(ctx, "std_ratio")
    if correlation is None or std_ratio is None:
        raise SpecError("taylor needs data mapping for correlation and std_ratio", "invalid_mapping", "mapping")
    models = _categorical(ctx, "label")
    if models is None:
        models = _categorical(ctx, "model")
    n = min(correlation.size, std_ratio.size)
    correlation = np.clip(correlation[:n], -1.0, 1.0)
    std_ratio = np.maximum(std_ratio[:n], 1e-3)
    if models is not None:
        models = [str(value) for value in models[:n]]
    mask = np.isfinite(correlation) & np.isfinite(std_ratio)
    correlation, std_ratio = correlation[mask], std_ratio[mask]
    if models is not None:
        models = [name for name, keep in zip(models, mask.tolist()) if keep]
    if correlation.size < 1:
        raise SpecError("taylor needs at least one finite model record", "invalid_data")

    theta = np.arccos(np.clip(correlation, -1.0, 1.0))
    radius = std_ratio
    point_x = radius * np.cos(theta)
    point_y = radius * np.sin(theta)
    r_max = max(2.10, float(np.max(radius)) * 1.12 if radius.size else 2.10)
    fontsize = float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 0.8
    grid_colour = "#E6E6E6"

    tick_text = str(ctx.opt("corr_ticks", "1,0.99,0.95,0.9,0.8,0.7,0.6,0.4,0.2,0"))
    values = []
    for token in tick_text.split(","):
        try:
            values.append(min(1.0, max(0.0, float(token))))
        except ValueError:
            continue
    values = sorted(set(values), reverse=True) or [1.0, 0.9, 0.8, 0.6, 0.4, 0.2, 0.0]

    arc = np.linspace(0.0, math.pi / 2.0, 241)
    radial_ticks = [value for value in (0.5, 1.0, 1.5, 2.0, 2.5) if value <= r_max - 0.02]
    if not radial_ticks:
        radial_ticks = [r_max / 2.0]

    # Standard-deviation circles and correlation rays.
    for value in radial_ticks:
        ax.plot(value * np.cos(arc), value * np.sin(arc), color=grid_colour, lw=0.5, zorder=1)
    for value in values:
        angle = math.acos(value)
        ax.plot([0.0, r_max * math.cos(angle)], [0.0, r_max * math.sin(angle)], color=grid_colour, lw=0.5, zorder=1)
        ax.text(
            1.03 * r_max * math.cos(angle),
            1.03 * r_max * math.sin(angle),
            f"{value:g}",
            fontsize=fontsize,
            color="#333333",
            ha="center",
            va="center",
            zorder=5,
        )
    ax.plot(r_max * np.cos(arc), r_max * np.sin(arc), color="#333333", lw=0.8, zorder=3)

    # Radial (sigma) ticks along a quiet ray.
    radial_angle = math.radians(68.0)
    for value in radial_ticks:
        ax.text(
            value * math.cos(radial_angle),
            value * math.sin(radial_angle),
            f"{value:g}",
            fontsize=fontsize - 0.2,
            color="#6A6A6A",
            ha="center",
            va="center",
            zorder=6,
            bbox={"boxstyle": "round,pad=0.08", "facecolor": "white", "edgecolor": "none", "alpha": 0.85},
        )

    # RMSD circles centred on the reference point (sigma = 1, rho = 1).
    if ctx.flag("rmsd", True):
        circle = np.linspace(0.0, math.pi, 241)
        for spread in (0.25, 0.50, 0.75, 1.00, 1.25):
            ring_x = 1.0 + spread * np.cos(circle)
            ring_y = spread * np.sin(circle)
            inside = (ring_x >= -1e-9) & (ring_y >= -1e-9) & (np.hypot(ring_x, ring_y) <= r_max * 1.002)
            if not np.any(inside):
                continue
            ax.plot(ring_x[inside], ring_y[inside], color="#9A9A9A", lw=0.5, ls="--", zorder=2)
            label_x = 1.0 + spread
            if label_x <= 1.10 * r_max:
                ax.text(
                    label_x,
                    0.028 * r_max,
                    f"{spread:.2f}",
                    fontsize=fontsize - 0.2,
                    color="#6A6A6A",
                    ha="center",
                    va="bottom",
                    zorder=4,
                    bbox={"boxstyle": "round,pad=0.06", "facecolor": "white", "edgecolor": "none", "alpha": 0.82},
                )

    ax.plot([1.0], [0.0], marker="*", ms=8.5, color="#111111", ls="none", zorder=6)
    ax.annotate(
        "Reference",
        xy=(1.0, 0.0),
        xytext=(0, -10),
        textcoords="offset points",
        ha="center",
        va="top",
        fontsize=fontsize,
        color="#333333",
        zorder=6,
    )

    leftmost = int(np.argmin(point_x))
    bottom = int(np.argmin(point_y))
    for index in range(correlation.size):
        colour = ctx.color(index)
        ax.plot(point_x[index], point_y[index], marker="o", ms=4.6, color=colour, mec="white", mew=0.5, ls="none", zorder=5)
        if models is None:
            continue
        if index == leftmost and point_x[index] < float(np.median(point_x)) * 0.92:
            offset, ha, va = (-5, 2), "right", "center"
        elif index == bottom:
            offset, ha, va = (5, -8), "left", "top"
        else:
            offset, ha, va = (5, 3), "left", "bottom"
        ax.annotate(
            models[index],
            xy=(point_x[index], point_y[index]),
            xytext=offset,
            textcoords="offset points",
            ha=ha,
            va=va,
            fontsize=fontsize,
            color=colour,
            zorder=6,
            bbox={"boxstyle": "round,pad=0.08", "facecolor": "white", "edgecolor": "none", "alpha": 0.78},
        )

    ctx.finish(ax, legend=False)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_aspect("equal", adjustable="box")
    ax.set_xlim(-0.03 * r_max, 1.11 * r_max)
    ax.set_ylim(-0.10 * r_max, 1.13 * r_max)
    H.corner_note(
        ax,
        "Dashed rings: RMSD\nRays: correlation",
        loc="lower right",
        fontsize=fontsize - 0.3,
    )
    return ctx.fig
