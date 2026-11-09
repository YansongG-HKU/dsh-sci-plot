"""Shared statistical and annotation helpers for renderers.

Renderers must not hard-code colours, fonts, spines or sizes: they use
``ctx.color()``, ``ctx.cmap()``, ``ctx.finish()`` and these helpers.
"""
from __future__ import annotations

import math

import numpy as np

try:  # SciPy is optional; every helper degrades to numpy.
    from scipy import stats as _stats
    from scipy.ndimage import gaussian_filter1d as _gaussian1d
except Exception:  # pragma: no cover
    _stats = None
    _gaussian1d = None

STAR_TABLE = ((0.001, "***"), (0.01, "**"), (0.05, "*"), (1.0, "n.s."))


def finite(values) -> np.ndarray:
    arr = np.asarray(values, dtype=float).ravel()
    return arr[np.isfinite(arr)]


def clean_xy(x, y) -> tuple[np.ndarray, np.ndarray]:
    x = np.asarray(x, dtype=float).ravel()
    y = np.asarray(y, dtype=float).ravel()
    n = min(x.size, y.size)
    x, y = x[:n], y[:n]
    mask = np.isfinite(x) & np.isfinite(y)
    return x[mask], y[mask]


def stars(p: float) -> str:
    if p is None or not np.isfinite(p):
        return ""
    for threshold, text in STAR_TABLE:
        if p < threshold:
            return text
    return "n.s."


def format_p(p: float) -> str:
    if p is None or not np.isfinite(p):
        return "p = n.a."
    if p < 0.001:
        return "p < 0.001"
    return f"p = {p:.3f}"


def nice_limits(values, pad: float = 0.06, lo_zero: bool = False, hi_zero: bool = False):
    vals = finite(values)
    if vals.size == 0:
        return (0.0, 1.0)
    lo, hi = float(np.min(vals)), float(np.max(vals))
    if hi == lo:
        delta = abs(hi) * 0.1 or 0.5
        lo, hi = lo - delta, hi + delta
    span = hi - lo
    lo -= span * pad
    hi += span * pad
    if lo_zero:
        lo = 0.0
    if hi_zero:
        hi = 0.0
    return (lo, hi)


def jitter(rng: np.random.Generator, n: int, width: float = 0.18) -> np.ndarray:
    return rng.uniform(-width, width, size=max(int(n), 0))


def squash(values, low: float = 0.0, high: float = 1.0) -> np.ndarray:
    arr = np.asarray(values, dtype=float)
    finite_mask = np.isfinite(arr)
    if not finite_mask.any():
        return np.full_like(arr, low)
    lo, hi = np.min(arr[finite_mask]), np.max(arr[finite_mask])
    if hi == lo:
        return np.full_like(arr, (low + high) / 2)
    return low + (high - low) * (arr - lo) / (hi - lo)


def smooth(y, window: int = 5):
    y = np.asarray(y, dtype=float)
    if window <= 1 or y.size < 3:
        return y
    if _gaussian1d is not None:
        return _gaussian1d(np.nan_to_num(y, nan=0.0), sigma=max(0.8, window / 2.5), mode="nearest")
    win = min(int(window), y.size)
    kernel = np.ones(win) / win
    return np.convolve(y, kernel, mode="same")


def rolling_mean(y, window: int = 5):
    y = np.asarray(y, dtype=float)
    window = max(1, min(int(window), y.size))
    if window == 1:
        return y.copy()
    kernel = np.ones(window) / window
    out = np.convolve(np.nan_to_num(y, nan=0.0), kernel, mode="same")
    edge = window // 2
    if edge:
        out[:edge] = y[:edge]
        out[-edge:] = y[-edge:]
    return out


def kde_1d(x, gridsize: int = 256, bw: float | None = None):
    """Gaussian KDE returning (grid, density) normalised to unit area."""
    x = finite(x)
    if x.size < 2:
        return x, np.ones_like(x)
    std = float(np.std(x))
    if std == 0:
        std = 1.0
    if _stats is not None:
        kde = _stats.gaussian_kde(x, bw_method=bw)
        grid = np.linspace(x.min() - 3 * std, x.max() + 3 * std, gridsize)
        return grid, kde(grid)
    if bw is None:
        bw = std * x.size ** (-1 / 5)
    grid = np.linspace(x.min() - 3 * std, x.max() + 3 * std, gridsize)
    density = np.zeros_like(grid)
    for value in x:
        density += np.exp(-0.5 * ((grid - value) / bw) ** 2)
    density /= density.sum() * (grid[1] - grid[0]) or 1
    return grid, density


def hist_density(values, bins=40, range_=None):
    values = finite(values)
    density, edges = np.histogram(values, bins=bins, range=range_, density=True)
    centers = (edges[:-1] + edges[1:]) / 2
    return centers, density, edges


def ecdf(values):
    values = np.sort(finite(values))
    if values.size == 0:
        return values, values
    y = np.arange(1, values.size + 1) / values.size
    return values, y


def fit_linear(x, y):
    x, y = clean_xy(x, y)
    if x.size < 2:
        return {"slope": math.nan, "intercept": math.nan, "r2": math.nan, "p": math.nan, "n": int(x.size)}
    try:
        slope, intercept = np.polyfit(x, y, 1)
    except (np.linalg.LinAlgError, ValueError):
        return {"slope": math.nan, "intercept": math.nan, "r2": math.nan, "p": math.nan, "n": int(x.size)}
    pred = slope * x + intercept
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot else math.nan
    p = math.nan
    if _stats is not None and x.size > 2:
        try:
            result = _stats.linregress(x, y)
            p = float(result.pvalue)
        except Exception:
            pass
    return {"slope": float(slope), "intercept": float(intercept), "r2": r2, "p": p, "n": int(x.size)}


def bootstrap_fit_ci(x, y, n_boot: int = 400, seed: int = 7, confidence: float = 0.95, grid_size: int = 160):
    """Linear fit with bootstrap CI band; returns dict with grid/lower/upper."""
    x, y = clean_xy(x, y)
    if x.size < 3:
        return None
    rng = np.random.default_rng(seed)
    grid = np.linspace(float(x.min()), float(x.max()), grid_size)
    fits = []
    for _ in range(max(60, int(n_boot))):
        idx = rng.integers(0, x.size, x.size)
        xb, yb = x[idx], y[idx]
        if np.ptp(xb) == 0:
            continue
        try:
            slope, intercept = np.polyfit(xb, yb, 1)
        except (np.linalg.LinAlgError, ValueError):
            continue
        fits.append(slope * grid + intercept)
    if len(fits) < 20:
        return None
    fits = np.asarray(fits)
    alpha = (1 - confidence) / 2
    return {
        "grid": grid,
        "lower": np.quantile(fits, alpha, axis=0),
        "upper": np.quantile(fits, 1 - alpha, axis=0),
        "n_boot": len(fits),
    }


def bootstrap_ci(values, statistic=np.mean, n_boot: int = 800, seed: int = 7, confidence: float = 0.95):
    values = finite(values)
    if values.size == 0:
        return math.nan, math.nan
    rng = np.random.default_rng(seed)
    boots = [statistic(rng.choice(values, values.size, replace=True)) for _ in range(max(80, int(n_boot)))]
    alpha = (1 - confidence) / 2
    return float(np.quantile(boots, alpha)), float(np.quantile(boots, 1 - alpha))


def welch_p(a, b) -> float:
    a, b = finite(a), finite(b)
    if a.size < 2 or b.size < 2 or _stats is None:
        return math.nan
    try:
        return float(_stats.ttest_ind(a, b, equal_var=False).pvalue)
    except Exception:
        return math.nan


def mannwhitney_p(a, b) -> float:
    a, b = finite(a), finite(b)
    if a.size < 2 or b.size < 2 or _stats is None:
        return math.nan
    try:
        return float(_stats.mannwhitneyu(a, b, alternative="two-sided").pvalue)
    except Exception:
        return math.nan


def anova_p(groups) -> float:
    groups = [finite(g) for g in groups if finite(g).size >= 2]
    if len(groups) < 2 or _stats is None:
        return math.nan
    try:
        return float(_stats.f_oneway(*groups).pvalue)
    except Exception:
        return math.nan


def pearson(x, y):
    x, y = clean_xy(x, y)
    if x.size < 3:
        return math.nan
    try:
        return float(np.corrcoef(x, y)[0, 1])
    except Exception:
        return math.nan


def corr_matrix(columns: dict, names: list[str]):
    matrix = np.full((len(names), len(names)), np.nan)
    for i, a in enumerate(names):
        for j, b in enumerate(names):
            if i == j:
                matrix[i, j] = 1.0
            else:
                matrix[i, j] = pearson(columns[a], columns[b])
    return matrix


def draw_significance(ax, pairs, *, y_span: float | None = None, fontsize: float = 6.0, color: str = "#222222", linewidth: float = 0.7, step: float | None = None):
    """Draw bracket annotations between category positions.

    ``pairs`` items: ``(x1, x2, label)`` or ``(x1, x2, label, y)``.
    """
    if not pairs:
        return
    ylim = ax.get_ylim()
    span = (ylim[1] - ylim[0]) if y_span is None else y_span
    if step is None:
        step = span * 0.055
    max_y = max((item[3] if len(item) > 3 and item[3] is not None else ylim[1] - span * 0.08) for item in pairs)
    current = max_y
    for item in pairs:
        x1, x2 = float(item[0]), float(item[1])
        label = str(item[2]) if len(item) > 2 and item[2] is not None else "*"
        y = float(item[3]) if len(item) > 3 and item[3] is not None else current
        h = step * 0.28
        ax.plot([x1, x1, x2, x2], [y - h, y, y, y - h], color=color, linewidth=linewidth, clip_on=False, solid_capstyle="butt")
        if label:
            ax.text((x1 + x2) / 2, y + h * 0.15, label, ha="center", va="bottom", fontsize=fontsize, color=color)
        current = y + step * 0.9
    ax.set_ylim(ylim[0], max(ylim[1], current + step * 0.2))


def panel_letter(ax, letter: str, *, x: float = -0.14, y: float = 1.05, fontsize: float = 9.0):
    ax.text(x, y, letter, transform=ax.transAxes, fontsize=fontsize, fontweight="bold", va="bottom", ha="left", color="#111111")


def corner_note(ax, text: str, *, loc: str = "upper left", fontsize: float = 6.0, color: str = "#333333", pad: float = 4.0, bold: bool = False):
    positions = {
        "upper left": (0.02, 0.98, "left", "top"),
        "upper right": (0.98, 0.98, "right", "top"),
        "lower left": (0.02, 0.02, "left", "bottom"),
        "lower right": (0.98, 0.02, "right", "bottom"),
    }
    x, y, ha, va = positions.get(loc, positions["upper left"])
    ax.text(
        x,
        y,
        text,
        transform=ax.transAxes,
        ha=ha,
        va=va,
        fontsize=fontsize,
        color=color,
        fontweight="bold" if bold else "normal",
        bbox={"boxstyle": f"round,pad={pad / 100:.2f}", "facecolor": "#ffffff", "edgecolor": "none", "alpha": 0.82},
    )


def break_axis(ax1, ax2, axis: str = "y", d: float = 0.015):
    """Draw diagonal break marks between two aligned axes."""
    import matplotlib.pyplot as plt

    if axis == "y":
        kwargs = dict(transform=ax1.transAxes, color="k", clip_on=False, linewidth=0.8)
        ax1.plot((-d, +d), (-d, +d), **kwargs)
        ax1.plot((-d, +d), (-2 * d, 0), **kwargs)
        kwargs = dict(transform=ax2.transAxes, color="k", clip_on=False, linewidth=0.8)
        ax2.plot((-d, +d), (1 - d, 1 + d), **kwargs)
        ax2.plot((-d, +d), (1 - 2 * d, 1), **kwargs)
    else:
        kwargs = dict(transform=ax1.transAxes, color="k", clip_on=False, linewidth=0.8)
        ax1.plot((-d, +d), (-d, +d), **kwargs)
        ax1.plot((1 - d, 1 + d), (-d, +d), **kwargs)
        kwargs = dict(transform=ax2.transAxes, color="k", clip_on=False, linewidth=0.8)
        ax2.plot((-d, +d), (-d, +d), **kwargs)
        ax2.plot((1 - d, 1 + d), (-d, +d), **kwargs)


def value_labels(ax, bars, fmt: str = "{:.2f}", fontsize: float = 6.0, color: str = "#333333", padding: float = 2.0, rotate: float = 0.0):
    """Write values above bars/points."""
    for bar in bars:
        try:
            height = bar.get_height()
        except AttributeError:
            continue
        if not np.isfinite(height):
            continue
        ax.annotate(
            fmt.format(height),
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, padding),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=fontsize,
            color=color,
            rotation=rotate,
        )


def custom_legend(ax, handles=None, labels=None, **kwargs):
    return ax.legend(handles=handles, labels=labels, **kwargs)


def ensure_positive(values, floor: float = 1e-12):
    return np.clip(np.asarray(values, dtype=float), floor, None)


def distance_point_line(px, py, x1, y1, x2, y2):
    denom = math.hypot(x2 - x1, y2 - y1) or 1e-12
    return abs((x2 - x1) * (y1 - py) - (x1 - px) * (y2 - y1)) / denom


def normalize_rows(matrix):
    matrix = np.asarray(matrix, dtype=float)
    mins = np.nanmin(matrix, axis=1, keepdims=True)
    maxs = np.nanmax(matrix, axis=1, keepdims=True)
    spans = np.where((maxs - mins) == 0, 1.0, maxs - mins)
    return (matrix - mins) / spans
