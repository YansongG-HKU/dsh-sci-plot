"""Biomedical figure family: differential expression, GWAS, survival, meta-analysis,
diagnostic performance, agreement, dose-response, omics embeddings and clustered
heatmaps.

Every renderer only describes *what* to draw; geometry, typography and palettes come
from the shared style engine.  Statistical computation (Kaplan-Meier, log-rank,
hierarchical clustering, PCA, 4PL fitting) lives in this module with a NumPy
fallback so SciPy stays optional.
"""
from __future__ import annotations

import math
import textwrap

import numpy as np
from matplotlib.colors import to_hex, to_rgb
from matplotlib.lines import Line2D
from matplotlib.patches import Ellipse, Polygon

from .. import helpers as H
from ..registry import register
from ..spec import SpecError

try:  # SciPy is optional: every algorithm below has a NumPy fallback.
    from scipy import stats as _stats
    from scipy.cluster.hierarchy import leaves_list as _scipy_leaves  # noqa: F401
    from scipy.cluster.hierarchy import linkage as _scipy_linkage
    from scipy.optimize import curve_fit as _scipy_curve_fit
    from scipy.spatial.distance import pdist as _scipy_pdist
except Exception:  # pragma: no cover - degraded environment
    _stats = None
    _scipy_linkage = None
    _scipy_pdist = None
    _scipy_curve_fit = None

REF_COLOR = "#9A9A9A"  # reference / threshold lines (contract section 6.4)
NEUTRAL = "#BFBFBF"    # "not significant" points and other non-data chrome

MARKERS = ("o", "s", "^", "D", "v", "P", "X")
SPEAR = np.array([5.991, 5.991])  # chi-square 95% quantile, 2 dof


# ---------------------------------------------------------------------------
# Private helpers (shared inside this module only)
# ---------------------------------------------------------------------------

def _mapping(ctx) -> dict:
    return dict(getattr(ctx.table, "mapping", {}) or {})


def _mapped(ctx, key) -> str | None:
    value = _mapping(ctx).get(key)
    return value if isinstance(value, str) else None


def _numeric(ctx, key: str, *, required: bool = True):
    name = _mapped(ctx, key)
    if isinstance(name, str) and ctx.table.has(name):
        return ctx.table.numeric(name), name
    if required:
        raise SpecError(
            f'the mapping needs "{key}" pointing at a numeric column (got {name!r})',
            "invalid_mapping",
            "mapping",
        )
    return None, None


def _categorical(ctx, key: str, *, required: bool = True):
    name = _mapped(ctx, key)
    if isinstance(name, str) and ctx.table.has(name):
        return ctx.table.categorical(name), name
    if required:
        raise SpecError(
            f'the mapping needs "{key}" pointing at a column (got {name!r})',
            "invalid_mapping",
            "mapping",
        )
    return None, None


def _xy(ctx):
    """x/y arrays for the two dedicated scatter kinds (series mode supported)."""
    if ctx.table.mode == "series":
        items = ctx.series()
        x = np.concatenate([np.asarray(item["x"], dtype=float) for item in items])
        y = np.concatenate([np.asarray(item["y"], dtype=float) for item in items])
        return x, y
    return _numeric(ctx, "x")[0], _numeric(ctx, "y")[0]


def _point_labels(ctx) -> np.ndarray | None:
    name = _mapped(ctx, "label")
    if isinstance(name, str) and ctx.table.has(name):
        return ctx.table.categorical(name)
    return None


def _fs_tick(ctx, default: float = 6.5) -> float:
    return float(ctx.style.get("rc", {}).get("xtick.labelsize", default))


def _fs_legend(ctx, default: float = 6.5) -> float:
    return float(ctx.style.get("rc", {}).get("legend.fontsize", default))


def _ms(ctx, factor: float = 1.0) -> float:
    try:
        base = float(ctx.style.get("line", {}).get("ms", 2.9))
    except (TypeError, ValueError):
        base = 2.9
    return max(1.2, base * factor)


def _proxy(color: str, marker: str = "o", ms: float = 4.0) -> Line2D:
    return Line2D([], [], linestyle="", marker=marker, color=color, markerfacecolor=color, markeredgecolor=color, markersize=ms)


def _reference(ax, *, x=None, y=None, lw: float = 0.6, ls: str = "--"):
    """Grey dashed threshold / reference line (contract section 6.4)."""
    if x is not None:
        for value in np.atleast_1d(x):
            ax.axvline(float(value), color=REF_COLOR, lw=lw, ls=ls, zorder=1)
    if y is not None:
        for value in np.atleast_1d(y):
            ax.axhline(float(value), color=REF_COLOR, lw=lw, ls=ls, zorder=1)


def _ladder_labels(ctx, ax, xs, ys, texts, color, *, side: str = "right", step: float = 12.5, fontsize: float | None = None):
    """Leader-line labels stacked away from a dense point cloud (no overlap)."""
    fontsize = fontsize or _fs_tick(ctx)
    for index, (x, y, text) in enumerate(zip(xs, ys, texts)):
        if not isinstance(text, str) or not text.strip():
            continue
        shift = 8.0 - index * step
        if side == "right":
            offset = (13.0, shift)
            horizontal = "left"
        else:
            offset = (-13.0, shift)
            horizontal = "right"
        ax.annotate(
            text,
            xy=(float(x), float(y)),
            xytext=offset,
            textcoords="offset points",
            ha=horizontal,
            va="center",
            fontsize=fontsize,
            color=color,
            arrowprops={"arrowstyle": "-", "color": color, "lw": 0.45, "shrinkA": 0.5, "shrinkB": 2.0},
            annotation_clip=False,
            zorder=8,
        )


def _pretty_p(p: float) -> str:
    if p is None or not np.isfinite(p):
        return "P = n.a."
    if p < 0.001:
        return "P < 0.001"
    return f"P = {p:.3f}"


def _trapz(y, x):
    try:
        return float(np.trapezoid(y, x))
    except AttributeError:  # numpy < 2.0
        return float(np.trapz(y, x))


def _curves_from_series(ctx, mapping: dict | None = None):
    """[(name, x, y, extra)] from the table mapping (series mode included)."""
    mapping = mapping if mapping is not None else _mapping(ctx)
    items = ctx.series(mapping)
    out = []
    for index, item in enumerate(items):
        x = np.asarray(item.get("x"), dtype=float)
        y = np.asarray(item.get("y"), dtype=float)
        n = min(x.size, y.size)
        name = str(item.get("name") or f"Series {index + 1}")
        out.append((name, x[:n], y[:n], item))
    return out


def _bh_fdr(p) -> np.ndarray:
    """Benjamini-Hochberg FDR, NumPy only."""
    p = np.asarray(p, dtype=float)
    n = p.size
    if n == 0:
        return p
    order = np.argsort(p)
    ranked = p[order] * n / np.arange(1, n + 1)
    ranked = np.minimum.accumulate(ranked[::-1])[::-1]
    q = np.empty(n, dtype=float)
    q[order] = np.clip(ranked, 0.0, 1.0)
    return q


def _roc_from_scores(score, outcome):
    """Empirical ROC curve from a continuous score and a 0/1 outcome."""
    score = np.asarray(score, dtype=float)
    outcome = (np.asarray(outcome, dtype=float) > 0.5).astype(float)
    order = np.argsort(-score, kind="mergesort")
    score, outcome = score[order], outcome[order]
    tps = np.cumsum(outcome)
    fps = np.cumsum(1.0 - outcome)
    unique = np.concatenate([[True], np.diff(score) != 0])
    idx = np.where(unique)[0]
    if idx.size == 0 or idx[-1] != score.size - 1:
        idx = np.append(idx, score.size - 1)
    tpr = np.concatenate([[0.0], tps[idx] / max(outcome.sum(), 1.0)])
    fpr = np.concatenate([[0.0], fps[idx] / max((1.0 - outcome).sum(), 1.0)])
    return fpr, tpr


def _pr_from_scores(score, outcome):
    """Precision-recall curve plus average precision and prevalence."""
    score = np.asarray(score, dtype=float)
    outcome = (np.asarray(outcome, dtype=float) > 0.5).astype(float)
    order = np.argsort(-score, kind="mergesort")
    score, outcome = score[order], outcome[order]
    tps = np.cumsum(outcome)
    fps = np.cumsum(1.0 - outcome)
    unique = np.concatenate([[True], np.diff(score) != 0])
    idx = np.where(unique)[0]
    if idx.size == 0 or idx[-1] != score.size - 1:
        idx = np.append(idx, score.size - 1)
    positives = max(outcome.sum(), 1.0)
    recall = np.concatenate([[0.0], tps[idx] / positives])
    precision = np.concatenate([[1.0], tps[idx] / np.maximum(tps[idx] + fps[idx], 1.0)])
    ap = float(np.sum(np.diff(recall) * precision[1:]))
    prevalence = float(outcome.mean()) if outcome.size else math.nan
    return recall, precision, ap, prevalence


def _pca_scores(matrix: np.ndarray, standardize: bool = True):
    """PCA via SVD; returns scores, explained-variance percentages, loadings."""
    matrix = np.asarray(matrix, dtype=float)
    mask = np.all(np.isfinite(matrix), axis=0)
    matrix = matrix[:, mask]
    if matrix.shape[1] < 2 or matrix.shape[0] < 2:
        raise SpecError("PCA needs at least two complete numeric feature columns and two rows", "invalid_data", "data")
    centered = matrix - np.nanmean(matrix, axis=0)
    if standardize:
        scale = np.nanstd(centered, axis=0, ddof=1)
        scale[scale == 0] = 1.0
        centered = centered / scale
    u, s, vt = np.linalg.svd(centered, full_matrices=False)
    scores = u * s
    variance = s ** 2
    total = float(variance.sum())
    explained = variance / total * 100.0 if total > 0 else np.zeros_like(variance)
    return scores, explained, vt


def _confidence_ellipse(points: np.ndarray):
    """95% confidence ellipse geometry (chi-square, 2 dof) or None."""
    points = np.asarray(points, dtype=float)
    if points.shape[0] < 5:
        return None
    cov = np.cov(points.T)
    if not np.all(np.isfinite(cov)):
        return None
    values, vectors = np.linalg.eigh(cov)
    order = np.argsort(values)[::-1]
    values, vectors = values[order], vectors[:, order]
    if values[0] <= 0:
        return None
    angle = math.degrees(math.atan2(vectors[1, 0], vectors[0, 0]))
    width = 2.0 * math.sqrt(SPEAR[0] * values[0])
    height = 2.0 * math.sqrt(SPEAR[0] * values[1])
    return points.mean(axis=0), width, height, angle


# --- survival ---------------------------------------------------------------

def _km_curve(time, event):
    """Kaplan-Meier estimate as (times, survival, n, n_events)."""
    time = np.asarray(time, dtype=float)
    event = np.asarray(event, dtype=float)
    order = np.argsort(time, kind="mergesort")
    time, event = time[order], event[order]
    survival = 1.0
    xs, ys = [0.0], [1.0]
    for unique_time in np.unique(time):
        at_risk = int(np.sum(time >= unique_time))
        deaths = int(np.sum((time == unique_time) & (event > 0.5)))
        if at_risk <= 0:
            continue
        if deaths > 0:
            survival *= 1.0 - deaths / at_risk
            xs.append(float(unique_time))
            ys.append(survival)
    return np.asarray(xs), np.asarray(ys), int(time.size), int(np.sum(event > 0.5))


def _survival_at(xs, ys, value: float) -> float:
    index = int(np.searchsorted(xs, value, side="right") - 1)
    return float(ys[max(index, 0)])


def _logrank_p(time, event, groups):
    levels = sorted({str(value) for value in groups})
    k = len(levels)
    if k < 2:
        return math.nan
    groups = np.asarray([str(value) for value in groups])
    event = np.asarray(event, dtype=float)
    observed = np.zeros(k)
    expected = np.zeros(k)
    variance = np.zeros((k, k))
    event_times = np.unique(np.asarray(time, dtype=float)[event > 0.5])
    for stamp in event_times:
        at_risk = np.asarray([np.sum((np.asarray(time) >= stamp) & (groups == level)) for level in levels], dtype=float)
        deaths = np.asarray([np.sum((np.asarray(time) == stamp) & (event > 0.5) & (groups == level)) for level in levels], dtype=float)
        total_risk = float(at_risk.sum())
        total_deaths = float(deaths.sum())
        if total_risk <= 1 or total_deaths <= 0:
            continue
        observed += deaths
        expected += total_deaths * at_risk / total_risk
        factor = total_deaths * (total_risk - total_deaths) / (total_risk - 1.0)
        share = at_risk / total_risk
        variance += factor * (np.diag(share) - np.outer(share, share))
    df = k - 1
    diff = observed - expected
    try:
        chi2 = float(diff @ np.linalg.pinv(variance) @ diff)
    except np.linalg.LinAlgError:
        return math.nan
    if _stats is not None:
        try:
            return float(_stats.chi2.sf(max(chi2, 0.0), df))
        except Exception:
            return math.nan
    if df == 1:
        return float(math.erfc(math.sqrt(max(chi2, 0.0) / 2.0)))
    return math.nan


# --- hierarchical clustering ------------------------------------------------

def _leaf_order(linkage_matrix, n_items: int) -> list[int]:
    if n_items <= 1:
        return list(range(n_items))
    if linkage_matrix is None or len(linkage_matrix) < n_items - 1:
        return list(range(n_items))

    def _walk(node):
        node = int(node)
        if node < n_items:
            return [node]
        row = linkage_matrix[node - n_items]
        return _walk(row[0]) + _walk(row[1])

    return _walk(2 * n_items - 2)


def _average_linkage(points: np.ndarray):
    """NumPy UPGMA fallback returning a SciPy-layout linkage matrix."""
    points = np.asarray(points, dtype=float)
    n = points.shape[0]
    if n <= 1:
        return np.zeros((0, 4), dtype=float)
    diff = points[:, None, :] - points[None, :, :]
    distances = np.sqrt(np.sum(diff * diff, axis=-1))
    np.fill_diagonal(distances, np.inf)
    ids = list(range(n))
    sizes = {index: 1 for index in range(n)}
    matrix = distances.copy()
    linkage = []
    next_id = n
    while len(ids) > 1:
        size = matrix.shape[0]
        flat = int(np.argmin(matrix))
        i, j = divmod(flat, size)
        if i > j:
            i, j = j, i
        a, b = ids[i], ids[j]
        height = float(matrix[i, j])
        if not np.isfinite(height):
            height = 0.0
        linkage.append([float(a), float(b), height, float(sizes[a] + sizes[b])])
        new_id = next_id
        next_id += 1
        total = sizes[a] + sizes[b]
        average = (sizes[a] * matrix[i, :] + sizes[b] * matrix[j, :]) / total
        keep = [k for k in range(size) if k not in (i, j)]
        new_matrix = np.full((size - 1, size - 1), np.inf)
        if keep:
            new_matrix[: len(keep), : len(keep)] = matrix[np.ix_(keep, keep)]
            new_matrix[: len(keep), -1] = average[keep]
            new_matrix[-1, : len(keep)] = average[keep]
        matrix = new_matrix
        ids = [ids[k] for k in keep] + [new_id]
        sizes[new_id] = total
    return np.asarray(linkage, dtype=float)


def _linkage_rows(matrix: np.ndarray):
    """Linkage matrix for the rows of ``matrix``."""
    n = matrix.shape[0]
    if n < 2:
        return None
    if _scipy_linkage is not None and _scipy_pdist is not None:
        try:
            condensed = _scipy_pdist(np.asarray(matrix, dtype=float), metric="euclidean")
            if condensed.size and np.all(np.isfinite(condensed)):
                return _scipy_linkage(condensed, method="average")
        except Exception:
            pass
    return _average_linkage(np.asarray(matrix, dtype=float))


def _draw_dendrogram(ctx, ax, linkage_matrix, n_items: int, *, orientation: str, color: str = REF_COLOR, low: float = 0.0, high: float = 1.0):
    """Draw a linkage tree inside pre-allocated normalised coordinates."""
    if linkage_matrix is None or len(linkage_matrix) == 0 or n_items < 2:
        return
    order = _leaf_order(linkage_matrix, n_items)
    position = np.zeros(2 * n_items - 1)
    heights = np.zeros(2 * n_items - 1)
    for leaf_index, leaf in enumerate(order):
        position[leaf] = leaf_index
    max_height = float(np.max(linkage_matrix[:, 2])) or 1.0
    lw = max(0.45, float(ctx.style.get("rc", {}).get("axes.linewidth", 0.6)) * 0.85)

    def _scaled(height: float) -> float:
        return low + (high - low) * float(height) / max_height

    for row_index, row in enumerate(linkage_matrix):
        first, second = int(row[0]), int(row[1])
        height = _scaled(row[2])
        parent = n_items + row_index
        first_x, second_x = position[first], position[second]
        first_h, second_h = heights[first], heights[second]
        if orientation == "left":
            ax.plot([height, first_h], [first_x, first_x], color=color, lw=lw, solid_capstyle="butt", zorder=1)
            ax.plot([height, second_h], [second_x, second_x], color=color, lw=lw, solid_capstyle="butt", zorder=1)
            ax.plot([height, height], [first_x, second_x], color=color, lw=lw, solid_capstyle="butt", zorder=1)
        else:
            ax.plot([first_x, first_x], [height, first_h], color=color, lw=lw, solid_capstyle="butt", zorder=1)
            ax.plot([second_x, second_x], [height, second_h], color=color, lw=lw, solid_capstyle="butt", zorder=1)
            ax.plot([first_x, second_x], [height, height], color=color, lw=lw, solid_capstyle="butt", zorder=1)
        position[parent] = 0.5 * (first_x + second_x)
        heights[parent] = height


# --- dose-response ----------------------------------------------------------

def _four_pl(concentration, bottom, top, log_ec50, hill):
    return bottom + (top - bottom) / (1.0 + np.exp(hill * (np.log(concentration) - log_ec50)))


def _fit_four_pl(concentration, response):
    """Return dict with fitted parameters and covariance (SciPy optional)."""
    x = np.asarray(concentration, dtype=float)
    y = np.asarray(response, dtype=float)
    mask = np.isfinite(x) & np.isfinite(y) & (x > 0)
    x, y = x[mask], y[mask]
    if x.size < 4 or np.ptp(y) <= 0:
        return None
    low, high = float(np.min(y)), float(np.max(y))
    span = max(high - low, 1e-9)
    p0 = [low, high, float(np.median(np.log(x))), 1.0]
    bounds = ([low - span, low, math.log(float(np.min(x))) - 4.0, 0.05], [high, high + span, math.log(float(np.max(x))) + 4.0, 8.0])
    if _scipy_curve_fit is not None:
        try:
            popt, pcov = _scipy_curve_fit(_four_pl, x, y, p0=p0, bounds=bounds, maxfev=40000)
            if np.all(np.isfinite(popt)):
                return {"params": np.asarray(popt, dtype=float), "cov": np.asarray(pcov, dtype=float) if pcov is not None else None}
        except Exception:
            pass
    # NumPy fallback: grid over log EC50 and Hill, linear least squares for bottom/top.
    best = None
    log_values = np.linspace(bounds[0][2], bounds[1][2], 61)
    hill_values = np.linspace(0.15, 4.5, 45)
    for log_ec50 in log_values:
        for hill in hill_values:
            fraction = 1.0 / (1.0 + np.exp(hill * (np.log(x) - log_ec50)))
            design = np.column_stack([1.0 - fraction, fraction])
            try:
                coefficients, *_ = np.linalg.lstsq(design, y, rcond=None)
            except np.linalg.LinAlgError:
                continue
            residual = float(np.sum((design @ coefficients - y) ** 2))
            if best is None or residual < best[0]:
                best = (residual, [coefficients[0], coefficients[1], log_ec50, hill])
    if best is None:
        return None
    return {"params": np.asarray(best[1], dtype=float), "cov": None}


def _profile_band(params, covariance, grid, level: float = 1.96):
    """Delta-method confidence band for a non-linear fit."""
    if covariance is None or not np.all(np.isfinite(covariance)):
        return None
    base = np.asarray(params, dtype=float)
    jacobian = np.zeros((grid.size, base.size))
    for index in range(base.size):
        step = max(abs(base[index]) * 1e-4, 1e-6)
        upper = base.copy()
        lower = base.copy()
        upper[index] += step
        lower[index] -= step
        jacobian[:, index] = (_four_pl(grid, *upper) - _four_pl(grid, *lower)) / (2.0 * step)
    variance = np.einsum("ij,jk,ik->i", jacobian, covariance, jacobian)
    variance = np.clip(variance, 0.0, None)
    centre = _four_pl(grid, *base)
    spread = level * np.sqrt(variance)
    return centre - spread, centre + spread


# ---------------------------------------------------------------------------
# Volcano
# ---------------------------------------------------------------------------

@register(
    "volcano",
    zh="火山图",
    en="Volcano plot",
    category="biomedical",
    summary_zh="差异表达火山图：log2 倍数变化与 -log10 P 定位显著基因，阈值线、三组配色与 top 基因标注。",
    summary_en="Differential-expression volcano: log2 fold change vs -log10 p with thresholds, three groups and top-gene labels.",
    tags=["差异表达", "DE", "RNA-seq", "transcriptomics"],
    aspect=0.92,
    options=[
        {"id": "fc_cut", "type": "float", "default": 1.0, "min": 0.0, "max": 4.0, "step": 0.1, "label_zh": "|log2FC| 阈值", "label_en": "|log2FC| cutoff"},
        {"id": "p_cut", "type": "float", "default": 0.05, "min": 0.001, "max": 0.2, "step": 0.001, "label_zh": "P 阈值", "label_en": "P cutoff"},
        {"id": "label_top", "type": "int", "default": 4, "min": 0, "max": 10, "label_zh": "每组标注数", "label_en": "Labels per group"},
        {"id": "show_counts", "type": "bool", "default": True, "label_zh": "图例显示计数", "label_en": "Counts in legend"},
    ],
    demo={
        "data": {"sample": "bio_volcano_de", "mapping": {"x": "log2fc", "y": "neglog10_p", "label": "gene"}},
        "style": {"domain": "omics", "journal": "nature"},
        "labels": {
            "x": "log$_2$ fold change",
            "y": "$-$log$_{10}$ $P$",
            "legend": "Differential expression",
        },
    },
)
def render_volcano(ctx):
    ax = ctx.ax()
    x, y = _xy(ctx)
    labels = _point_labels(ctx)
    mask = np.isfinite(x) & np.isfinite(y)
    x, y = x[mask], y[mask]
    if labels is not None:
        labels = labels[mask]
    fc_cut = float(ctx.num("fc_cut", 1.0))
    p_cut = float(max(ctx.num("p_cut", 0.05), 1e-300))
    y_cut = -math.log10(p_cut)
    up = (x >= fc_cut) & (y >= y_cut)
    down = (x <= -fc_cut) & (y >= y_cut)
    rest = ~(up | down)
    colour_up, colour_down = ctx.color(0), ctx.color(1)
    size_ns = _ms(ctx, 1.35) ** 2 * 0.75
    size_sig = _ms(ctx, 1.5) ** 2 * 1.35
    ax.scatter(x[rest], y[rest], s=size_ns, color=NEUTRAL, alpha=0.55, linewidths=0, zorder=2, rasterized=True)
    ax.scatter(x[down], y[down], s=size_sig, color=colour_down, alpha=0.85, linewidths=0, zorder=3, rasterized=True)
    ax.scatter(x[up], y[up], s=size_sig, color=colour_up, alpha=0.85, linewidths=0, zorder=3, rasterized=True)
    _reference(ax, x=[-fc_cut, fc_cut], y=y_cut)
    if ctx.flag("show_counts", True):
        entries = [
            ("Up-regulated", int(up.sum()), colour_up),
            ("Down-regulated", int(down.sum()), colour_down),
            ("Not significant", int(rest.sum()), NEUTRAL),
        ]
        handles = [_proxy(colour, ms=_ms(ctx, 1.7)) for _, _, colour in entries]
        texts = [f"{label} ({count})" for label, count, _ in entries]
    else:
        handles = [_proxy(colour_up, ms=_ms(ctx, 1.7)), _proxy(colour_down, ms=_ms(ctx, 1.7)), _proxy(NEUTRAL, ms=_ms(ctx, 1.7))]
        texts = ["Up-regulated", "Down-regulated", "Not significant"]
    count = max(0, int(ctx.num("label_top", 4)))
    if count and labels is not None:
        for group_mask, side, colour in ((up, "right", colour_up), (down, "left", colour_down)):
            indices = np.where(group_mask)[0]
            if indices.size == 0:
                continue
            chosen = indices[np.argsort(-y[indices])][:count]
            _ladder_labels(ctx, ax, x[chosen], y[chosen], [str(labels[index]) for index in chosen], colour, side=side)
    ax.set_xlim(H.nice_limits(x, pad=0.05))
    ax.set_ylim(0.0, float(np.nanmax(y)) * 1.12 if np.isfinite(np.nanmax(y)) else 1.0)
    ctx.finish(ax, legend=False)
    ctx.legend(ax, handles=handles, labels=texts, loc="upper center", frameon=True, facecolor="#ffffff", edgecolor="none", framealpha=0.9)
    return ctx.fig


# ---------------------------------------------------------------------------
# MA plot
# ---------------------------------------------------------------------------

@register(
    "ma",
    zh="MA 图",
    en="MA plot",
    category="biomedical",
    summary_zh="以平均表达强度为横轴、log2 倍数变化为纵轴的 MA 图，含阈值线与上/下调配色。",
    summary_en="Mean-expression versus log2 fold-change MA plot with thresholds and up/down colours.",
    tags=["差异表达", "MA", "RNA-seq"],
    aspect=0.76,
    options=[
        {"id": "fc_cut", "type": "float", "default": 1.0, "min": 0.0, "max": 4.0, "step": 0.1, "label_zh": "|log2FC| 阈值", "label_en": "|log2FC| cutoff"},
        {"id": "xscale", "type": "enum", "default": "log", "choices": ["log", "linear"], "label_zh": "横轴尺度", "label_en": "X scale"},
        {"id": "show_counts", "type": "bool", "default": True, "label_zh": "图例显示计数", "label_en": "Counts in legend"},
    ],
    demo={
        "data": {"sample": "bio_ma", "mapping": {"x": "base_mean", "y": "log2fc", "label": "gene"}},
        "style": {"domain": "omics", "journal": "nature"},
        "labels": {
            "x": "Mean expression (log$_2$ TPM)",
            "y": "log$_2$ fold change",
            "legend": "Differential expression",
        },
    },
)
def render_ma(ctx):
    ax = ctx.ax()
    x, y = _xy(ctx)
    mask = np.isfinite(x) & np.isfinite(y)
    x, y = x[mask], y[mask]
    fc_cut = float(ctx.num("fc_cut", 1.0))
    use_log = str(ctx.opt("xscale", "log")) == "log" and np.all(x > 0)
    up = y >= fc_cut
    down = y <= -fc_cut
    rest = ~(up | down)
    colour_up, colour_down = ctx.color(0), ctx.color(1)
    ax.scatter(x[rest], y[rest], s=_ms(ctx, 1.35) ** 2 * 0.7, color=NEUTRAL, alpha=0.5, linewidths=0, zorder=2, rasterized=True)
    ax.scatter(x[down], y[down], s=_ms(ctx, 1.5) ** 2 * 1.2, color=colour_down, alpha=0.85, linewidths=0, zorder=3, rasterized=True)
    ax.scatter(x[up], y[up], s=_ms(ctx, 1.5) ** 2 * 1.2, color=colour_up, alpha=0.85, linewidths=0, zorder=3, rasterized=True)
    _reference(ax, y=[-fc_cut, fc_cut])
    ax.axhline(0.0, color=REF_COLOR, lw=0.6, ls="-", zorder=1)
    handles = [
        _proxy(colour_up, ms=_ms(ctx, 1.7)),
        _proxy(colour_down, ms=_ms(ctx, 1.7)),
        _proxy(NEUTRAL, ms=_ms(ctx, 1.7)),
    ]
    if ctx.flag("show_counts", True):
        texts = [f"Up-regulated ({int(up.sum())})", f"Down-regulated ({int(down.sum())})", f"Unchanged ({int(rest.sum())})"]
    else:
        texts = ["Up-regulated", "Down-regulated", "Unchanged"]
    ctx.finish(ax, xscale="log" if use_log else "linear", legend=False)
    ctx.legend(ax, handles=handles, labels=texts, title="", loc="lower left", bbox_to_anchor=(0.0, 1.005), ncol=3, frameon=False, borderaxespad=0.0, handlelength=1.1, handletextpad=0.4, columnspacing=1.0)
    return ctx.fig


# ---------------------------------------------------------------------------
# Manhattan plot
# ---------------------------------------------------------------------------

@register(
    "manhattan",
    zh="曼哈顿图",
    en="Manhattan plot",
    category="biomedical",
    summary_zh="GWAS 曼哈顿图：染色体交替双色、全基因组显著性阈值、top 位点标注与稀疏染色体刻度。",
    summary_en="GWAS Manhattan plot with alternating chromosome colours, genome-wide threshold, lead-SNP labels and sparse chromosome ticks.",
    tags=["GWAS", "SNP", "genetics"],
    aspect=0.58,
    options=[
        {"id": "p_genome", "type": "float", "default": 5e-08, "min": 1e-12, "max": 0.01, "step": 1e-09, "label_zh": "显著性 P 阈值", "label_en": "Significance P"},
        {"id": "label_top", "type": "int", "default": 4, "min": 0, "max": 10, "label_zh": "标注位点数", "label_en": "Labelled loci"},
        {"id": "chr_gap", "type": "float", "default": 0.012, "min": 0.0, "max": 0.05, "step": 0.002, "label_zh": "染色体间距", "label_en": "Chromosome gap"},
    ],
    demo={
        "data": {"sample": "bio_manhattan", "mapping": {"x": "pos", "y": "neglog10_p", "label": "snp", "chr": "chr"}},
        "style": {"domain": "omics", "journal": "nature"},
        "labels": {"x": "Chromosome", "y": "$-$log$_{10}$ $P$"},
    },
)
def render_manhattan(ctx):
    ax = ctx.ax()
    y = _numeric(ctx, "y")[0]
    chr_name = _mapped(ctx, "chr")
    if chr_name and ctx.table.has(chr_name):
        chromosomes = ctx.table.numeric(chr_name)
    else:
        chromosomes, _ = _numeric(ctx, "chr", required=False)
        if chromosomes is None:
            raise SpecError('the mapping needs "chr" pointing at a chromosome column', "invalid_mapping", "mapping")
    positions, _ = _numeric(ctx, "x", required=False)
    if positions is None:
        positions = np.arange(y.size, dtype=float)
    labels = _point_labels(ctx)
    mask = np.isfinite(y) & np.isfinite(chromosomes) & np.isfinite(positions)
    y, chromosomes, positions = y[mask], chromosomes[mask], positions[mask].astype(float)
    if labels is not None:
        labels = labels[mask]
    levels = sorted({int(value) for value in chromosomes})
    gap = float(ctx.num("chr_gap", 0.012)) * 1e6
    offset = 0.0
    plot_x = np.zeros(y.size)
    ticks, tick_labels = [], []
    for level in levels:
        selected = chromosomes == level
        local = positions[selected]
        maximum = float(local.max()) if local.size else 0.0
        plot_x[selected] = offset + local
        ticks.append(offset + maximum / 2.0)
        tick_labels.append(str(level))
        offset += maximum + gap
    base = ctx.color(0)
    base_rgb = np.asarray(to_rgb(base), dtype=float)
    light = to_hex(np.clip(base_rgb + (1.0 - base_rgb) * 0.55, 0.0, 1.0))
    colours = np.where((chromosomes.astype(int) % 2) == 0, light, base)
    ax.scatter(plot_x, y, s=_ms(ctx, 1.2) ** 2 * 0.6, color=colours, alpha=0.8, linewidths=0, zorder=2, rasterized=True)
    threshold = -math.log10(float(max(ctx.num("p_genome", 5e-8), 1e-300)))
    _reference(ax, y=threshold)
    significant = y >= threshold
    highlight = ctx.color(1)
    if significant.any():
        ax.scatter(plot_x[significant], y[significant], s=_ms(ctx, 1.5) ** 2 * 1.1, color=highlight, alpha=0.95, linewidths=0, zorder=4, rasterized=True)
    x_right = float(np.max(plot_x)) if plot_x.size else 1.0
    ax.text(x_right, threshold, " $P = 5\\times10^{-8}$", ha="right", va="bottom", fontsize=_fs_tick(ctx) - 0.3, color=REF_COLOR, zorder=5)
    count = max(0, int(ctx.num("label_top", 4)))
    if count and labels is not None:
        chrom_max = {level: float(np.max(y[chromosomes == level])) for level in levels}
        chosen = []
        for level in sorted(levels, key=lambda value: -chrom_max[value]):
            if chrom_max[level] < threshold:
                break
            indices = np.where(chromosomes == level)[0]
            if indices.size == 0:
                continue
            chosen.append(int(indices[np.argmax(y[indices])]))
            if len(chosen) >= count:
                break
        if chosen:
            _ladder_labels(ctx, ax, plot_x[chosen], y[chosen], [str(labels[index]) for index in chosen], "#333333", side="right", step=11.0)
    if len(ticks) > 12:
        keep = np.unique(np.linspace(0, len(ticks) - 1, 11).astype(int))
        ticks = [ticks[index] for index in keep]
        tick_labels = [tick_labels[index] for index in keep]
    ax.set_xticks(ticks)
    ax.set_xticklabels(tick_labels)
    ax.set_xlim(-x_right * 0.005, x_right * 1.01)
    ax.set_ylim(0.0, float(np.nanmax(y)) * 1.16 if y.size else 1.0)
    ctx.finish(ax, legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Kaplan-Meier survival with risk table
# ---------------------------------------------------------------------------

@register(
    "km_survival",
    zh="Kaplan-Meier 生存曲线",
    en="Kaplan-Meier survival",
    category="biomedical",
    summary_zh="阶梯生存曲线、删失刻度、log-rank P，主图下方附对齐的风险人数表。",
    summary_en="Step survival curves with censor ticks, log-rank P and an aligned number-at-risk table underneath.",
    tags=["survival", "KM", "clinical", "oncology"],
    aspect=0.98,
    options=[
        {"id": "risk_interval", "type": "float", "default": 6.0, "min": 1.0, "max": 24.0, "step": 1.0, "label_zh": "风险表间隔（月）", "label_en": "Risk-table interval (months)"},
        {"id": "show_risk", "type": "bool", "default": True, "label_zh": "显示风险人数表", "label_en": "Show risk table"},
        {"id": "xmax", "type": "float", "default": 0.0, "min": 0.0, "max": 1000.0, "step": 1.0, "label_zh": "横轴上限（0=自动）", "label_en": "X max (0 = auto)"},
    ],
    demo={
        "data": {"sample": "bio_survival", "mapping": {"time": "time", "event": "event", "group": "arm"}},
        "style": {"domain": "clinical", "journal": "nejm"},
        "labels": {"x": "Time since randomisation (months)", "y": "Overall survival (%)"},
    },
)
def render_km_survival(ctx):
    time, _ = _numeric(ctx, "time")
    event, _ = _numeric(ctx, "event")
    groups, _ = _categorical(ctx, "group")
    time = np.asarray(time, dtype=float)
    event = np.asarray(event, dtype=float)
    groups = np.asarray([str(value) for value in groups])
    mask = np.isfinite(time) & np.isfinite(event)
    time, event, groups = time[mask], event[mask], groups[mask]
    levels = list(dict.fromkeys(groups.tolist()))
    if not levels:
        raise SpecError("no survival groups were found", "invalid_data", "data")
    show_risk = ctx.flag("show_risk", True)
    if show_risk:
        fig, axes = ctx.figure(2, 1, height_ratios=[3.4, 1.05], sharex=True)
        ax, ax_risk = axes[0], axes[1]
    else:
        ax = ctx.ax()
        ax_risk = None
    x_max = float(ctx.num("xmax", 0.0))
    if x_max <= 0:
        x_max = float(np.nanmax(time)) * 1.02
    handles, texts = [], []
    for index, level in enumerate(levels):
        selected = groups == level
        curve_x, curve_y, n_total, n_events = _km_curve(time[selected], event[selected])
        colour = ctx.color(index)
        label = f"{level} (n = {n_total})"
        ax.step(curve_x, curve_y * 100.0, where="post", color=colour, lw=float(ctx.style["line"]["lw"]) + 0.05, label=label, zorder=3)
        censor = selected & (event <= 0.5)
        if censor.any():
            censor_times = time[censor]
            censor_survival = np.asarray([_survival_at(curve_x, curve_y, value) for value in censor_times])
            ax.plot(censor_times, censor_survival * 100.0, ls="", marker="+", ms=_ms(ctx, 1.5), mew=0.9, color=colour, zorder=4)
        handles.append(Line2D([], [], color=colour, lw=float(ctx.style["line"]["lw"]) + 0.05))
        texts.append(label)
    survival_p = _logrank_p(time, event, groups)
    ax.set_ylim(-2.0, 103.0)
    ax.set_xlim(-0.035 * x_max, 1.02 * x_max)
    ax.tick_params(axis="x", labelbottom=False)
    ctx.finish(ax, xlabel="", legend=False)
    H.corner_note(ax, f"Log-rank {_pretty_p(survival_p)}", loc="lower left", fontsize=_fs_tick(ctx))
    ctx.legend(ax, handles=handles, labels=texts, loc="upper right")
    if ax_risk is not None:
        interval = max(float(ctx.num("risk_interval", 6.0)), 1e-6)
        risk_times = np.arange(0.0, x_max + 1e-9, interval)
        if risk_times.size == 0:
            risk_times = np.asarray([0.0])
        positions = np.arange(len(levels))[::-1]
        for index, level in enumerate(levels):
            selected = groups == level
            for stamp in risk_times:
                at_risk = int(np.sum(time[selected] >= stamp))
                ax_risk.text(float(stamp), float(positions[index]), str(at_risk), ha="center", va="center", fontsize=_fs_tick(ctx), color="#222222")
        ax_risk.set_yticks(positions)
        ax_risk.set_yticklabels([textwrap.fill(str(level), 14) for level in levels])
        ax_risk.set_ylim(-0.65, len(levels) - 0.35)
        ax_risk.set_title("Number at risk", loc="left", fontsize=_fs_legend(ctx), fontweight="normal", pad=2.0)
        ctx.finish(ax_risk, xlabel=ctx.label("x"), ylabel="", legend=False, grid=False)
        for spine in ax_risk.spines.values():
            spine.set_visible(False)
        ax_risk.tick_params(axis="y", length=0.0, pad=2.0)
        ax_risk.tick_params(axis="x", length=float(ctx.style["rc"].get("xtick.major.size", 3.0)), pad=2.0)
        ax_risk.set_xticks(np.round(risk_times, 6))
        ax_risk.set_xticklabels([f"{value:g}" for value in risk_times])
    return ctx.fig


# ---------------------------------------------------------------------------
# Forest plot
# ---------------------------------------------------------------------------

@register(
    "forest",
    zh="森林图",
    en="Forest plot",
    category="biomedical",
    summary_zh="meta 分析森林图：点估计 + 95% CI、权重映射方块大小、无效线、右侧数值列与合并菱形。",
    summary_en="Meta-analysis forest plot with point estimates, 95% CI, weight-sized squares, null line, estimate column and pooled diamond.",
    tags=["meta-analysis", "HR", "OR", "clinical"],
    aspect=0.94,
    options=[
        {"id": "logx", "type": "bool", "default": True, "label_zh": "对数横轴", "label_en": "Log x axis"},
        {"id": "show_overall", "type": "bool", "default": True, "label_zh": "显示合并效应", "label_en": "Show pooled estimate"},
        {"id": "wrap_width", "type": "int", "default": 14, "min": 8, "max": 32, "label_zh": "研究名换行宽度", "label_en": "Label wrap width"},
    ],
    demo={
        "data": {
            "sample": "bio_forest",
            "mapping": {"label": "study", "x": "estimate", "ci_low": "ci_low", "ci_high": "ci_high", "size": "weight"},
        },
        "style": {"domain": "clinical", "journal": "lancet"},
        "labels": {"x": "Hazard ratio (95% CI)", "y": "Study"},
    },
)
def render_forest(ctx):
    estimate, _ = _numeric(ctx, "x")
    low, _ = _numeric(ctx, "ci_low")
    high, _ = _numeric(ctx, "ci_high")
    weight, _ = _numeric(ctx, "size", required=False)
    names, _ = _categorical(ctx, "label")
    names = [str(value) for value in names]
    estimate = np.asarray(estimate, dtype=float)
    low = np.asarray(low, dtype=float)
    high = np.asarray(high, dtype=float)
    if weight is None:
        weight = np.ones(estimate.size)
    weight = np.asarray(weight, dtype=float)
    mask = np.isfinite(estimate) & np.isfinite(low) & np.isfinite(high)
    overall_mask = np.asarray([name.lower().startswith(("overall", "summary", "pooled estimate")) for name in names])
    keep = mask & ~(overall_mask & (not ctx.flag("show_overall", True)))
    rows = np.where(keep)[0]
    use_log = ctx.flag("logx", True) and np.all(low[rows] > 0) and np.all(high[rows] > 0) and np.all(estimate[rows] > 0)
    fig, axes = ctx.figure(1, 2, width_ratios=[3.5, 1.25])
    ax, ax_text = axes[0], axes[1]
    n_rows = rows.size
    y_positions = np.arange(n_rows)[::-1].astype(float)
    colour_point = ctx.color(0)
    colour_overall = ctx.color(1)
    weights = weight[rows]
    finite_weights = weights[np.isfinite(weights) & ~overall_mask[rows]]
    max_weight = float(np.max(finite_weights)) if finite_weights.size else 1.0
    max_weight = max_weight if max_weight > 0 else 1.0
    for row_index, data_index in enumerate(rows):
        y = y_positions[row_index]
        if overall_mask[data_index]:
            half = 0.26
            polygon = Polygon(
                [(low[data_index], y), (estimate[data_index], y + half), (high[data_index], y), (estimate[data_index], y - half)],
                closed=True,
                facecolor=colour_overall,
                edgecolor="white",
                lw=0.5,
                zorder=5,
            )
            ax.add_patch(polygon)
        else:
            ax.hlines(y, low[data_index], high[data_index], color=colour_point, lw=0.9, alpha=0.8, zorder=3)
            normalised = float(weights[row_index] / max_weight) if np.isfinite(weights[row_index]) else 0.5
            normalised = min(max(normalised, 0.12), 1.0)
            side = 2.4 + 3.4 * normalised
            ax.scatter([estimate[data_index]], [y], s=side ** 2, marker="s", color=colour_point, edgecolors="white", linewidths=0.45, zorder=5)
    null_value = 1.0 if np.all(estimate[rows] > 0) else 0.0
    _reference(ax, x=null_value)
    ax.set_yticks(y_positions)
    labels = [textwrap.fill(names[index], int(ctx.num("wrap_width", 16))) for index in rows]
    ax.set_yticklabels(labels)
    for tick, data_index in zip(ax.get_yticklabels(), rows):
        if overall_mask[data_index]:
            tick.set_fontweight("bold")
    lo = float(np.nanmin(low[rows]))
    hi = float(np.nanmax(high[rows]))
    if use_log:
        lo = min(lo, 1.0)
        hi = max(hi, 1.0)
        span = math.log(hi) - math.log(lo)
        xlim = (math.exp(math.log(lo) - 0.06 * span), math.exp(math.log(hi) + 0.06 * span))
    else:
        span = hi - lo or 1.0
        xlim = (lo - 0.08 * span, hi + 0.08 * span)
    ax.set_ylim(-1.35, n_rows - 0.35)
    footer = ax.get_yaxis_transform()
    ax.text(0.02, -1.02, "Favours intervention", transform=footer, ha="left", va="center", fontsize=_fs_tick(ctx) - 0.4, color="#444444")
    ax.text(0.98, -1.02, "Favours control", transform=footer, ha="right", va="center", fontsize=_fs_tick(ctx) - 0.4, color="#444444")
    ctx.finish(ax, xscale="log" if use_log else "linear", legend=False)
    ax.set_xlim(*xlim)
    ax.set_ylim(-1.35, n_rows - 0.35)
    if use_log:
        candidates = np.asarray([0.4, 0.5, 0.6, 0.75, 1.0, 1.25, 1.5, 2.0])
        inside = candidates[(candidates >= xlim[0]) & (candidates <= xlim[1])]
        if inside.size:
            ax.set_xticks(inside)
            ax.set_xticklabels([f"{value:g}" for value in inside])
    ax_text.set_axis_off()
    ax_text.set_xlim(0.0, 1.0)
    ax_text.set_ylim(-1.35, n_rows - 0.35)
    ax_text.text(0.0, n_rows - 0.62, "HR (95% CI)", ha="left", va="center", fontsize=_fs_tick(ctx), fontweight="bold", color="#222222")
    for row_index, data_index in enumerate(rows):
        y = y_positions[row_index]
        text = f"{estimate[data_index]:.2f} ({low[data_index]:.2f}\u2013{high[data_index]:.2f})"
        ax_text.text(
            0.0,
            y,
            text,
            ha="left",
            va="center",
            fontsize=_fs_tick(ctx),
            fontweight="bold" if overall_mask[data_index] else "normal",
            color="#222222",
        )
    ctx.add_title()
    return ctx.fig


# ---------------------------------------------------------------------------
# ROC
# ---------------------------------------------------------------------------

@register(
    "roc",
    zh="ROC 曲线",
    en="ROC curve",
    category="biomedical",
    summary_zh="诊断性能 ROC：对角线基准、阶梯曲线、AUC 图例，支持原始评分+结局或预算 FPR/TPR。",
    summary_en="Diagnostic ROC with chance diagonal, step curves and AUC legend; accepts raw scores+outcomes or precomputed FPR/TPR.",
    tags=["ROC", "AUC", "diagnostic", "clinical"],
    aspect=1.0,
    options=[
        {"id": "show_chance", "type": "bool", "default": True, "label_zh": "显示对角线", "label_en": "Show chance line"},
    ],
    demo={
        "data": {"sample": "bio_roc", "mapping": {"x": "fpr", "y": "tpr", "group": "model"}},
        "style": {"domain": "clinical", "journal": "nejm"},
        "labels": {"x": "1 $-$ Specificity", "y": "Sensitivity", "legend": "Model"},
    },
)
def render_roc(ctx):
    ax = ctx.ax()
    mapping = _mapping(ctx)
    curves = []
    if "score" in mapping and "outcome" in mapping and ctx.table.has(mapping["score"]):
        score = ctx.table.numeric(mapping["score"])
        outcome = ctx.table.numeric(mapping["outcome"])
        if isinstance(mapping.get("group"), str) and ctx.table.has(mapping["group"]):
            groups = ctx.table.categorical(mapping["group"])
        else:
            groups = np.asarray(["Model"] * score.size)
        for name in dict.fromkeys(groups.tolist()):
            selected = groups == name
            fpr, tpr = _roc_from_scores(score[selected], outcome[selected])
            curves.append((str(name), fpr, tpr))
    else:
        for name, x, y, _item in _curves_from_series(ctx, mapping):
            x = np.asarray(x, dtype=float)
            y = np.asarray(y, dtype=float)
            order = np.argsort(x, kind="mergesort")
            curves.append((name, x[order], y[order]))
    if not curves:
        raise SpecError("no ROC curves could be built", "invalid_data", "data")
    if ctx.flag("show_chance", True):
        ax.plot([0.0, 1.0], [0.0, 1.0], color=REF_COLOR, lw=0.6, ls="--", zorder=1, label="Chance")
    for index, (name, fpr, tpr) in enumerate(curves):
        auc = _trapz(tpr, fpr)
        ax.plot(fpr, tpr, color=ctx.color(index), lw=float(ctx.style["line"]["lw"]) + 0.15, drawstyle="steps-post", label=f"{name} (AUC = {auc:.2f})", zorder=3)
    ax.set_xlim(0.0, 1.02)
    ax.set_ylim(0.0, 1.02)
    ctx.finish(ax, legend=False)
    ctx.legend(ax, loc="lower right")
    return ctx.fig


# ---------------------------------------------------------------------------
# Precision-recall
# ---------------------------------------------------------------------------

@register(
    "pr_curve",
    zh="Precision-Recall 曲线",
    en="Precision-recall curve",
    category="biomedical",
    summary_zh="PR 曲线：预算曲线或原始评分计算，阳性率基线虚线、平均精度（AP）图例、最佳 F1 工作点。",
    summary_en="Precision-recall curves from scores or precomputed values with prevalence baseline, AP legend and best-F1 operating point.",
    tags=["PR", "average precision", "imbalanced", "diagnostic"],
    aspect=1.0,
    options=[
        {"id": "show_baseline", "type": "bool", "default": True, "label_zh": "显示阳性率基线", "label_en": "Show prevalence baseline"},
        {"id": "mark_best", "type": "bool", "default": True, "label_zh": "标注最佳 F1 点", "label_en": "Mark best F1 point"},
        {"id": "baseline", "type": "float", "default": -1.0, "min": -1.0, "max": 1.0, "step": 0.01, "label_zh": "自定义基线（-1=自动）", "label_en": "Baseline (-1 = auto)"},
    ],
    demo={
        "data": {"sample": "bio_pr", "mapping": {"score": "score", "outcome": "outcome", "group": "model"}},
        "style": {"domain": "clinical", "journal": "nejm"},
        "labels": {"x": "Recall (sensitivity)", "y": "Precision (positive predictive value)", "legend": "Model"},
    },
)
def render_pr_curve(ctx):
    ax = ctx.ax()
    mapping = _mapping(ctx)
    curves = []
    prevalence = None
    if "score" in mapping and "outcome" in mapping and ctx.table.has(mapping["score"]):
        score = ctx.table.numeric(mapping["score"])
        outcome = ctx.table.numeric(mapping["outcome"])
        if isinstance(mapping.get("group"), str) and ctx.table.has(mapping["group"]):
            groups = ctx.table.categorical(mapping["group"])
        else:
            groups = np.asarray(["Model"] * score.size)
        for name in dict.fromkeys(groups.tolist()):
            selected = groups == name
            recall, precision, ap, local_prevalence = _pr_from_scores(score[selected], outcome[selected])
            curves.append((str(name), recall, precision, ap))
            prevalence = local_prevalence if prevalence is None else prevalence
    else:
        for name, x, y, _item in _curves_from_series(ctx, mapping):
            recall = np.asarray(x, dtype=float)
            precision = np.asarray(y, dtype=float)
            order = np.argsort(recall, kind="mergesort")
            recall, precision = recall[order], precision[order]
            ap = float(np.sum(np.diff(recall) * precision[1:])) if recall.size > 1 else math.nan
            curves.append((name, recall, precision, ap))
    if not curves:
        raise SpecError("no PR curves could be built", "invalid_data", "data")
    show_baseline = ctx.flag("show_baseline", True)
    baseline_option = float(ctx.num("baseline", -1.0))
    if show_baseline:
        if baseline_option >= 0:
            baseline = baseline_option
        elif prevalence is not None and np.isfinite(prevalence):
            baseline = prevalence
        else:
            baseline = None
        if baseline is not None:
            ax.axhline(baseline, color=REF_COLOR, lw=0.6, ls="--", zorder=1, label=f"Baseline (prevalence = {baseline:.2f})")
    for index, (name, recall, precision, ap) in enumerate(curves):
        colour = ctx.color(index)
        ax.plot(recall, precision, color=colour, lw=float(ctx.style["line"]["lw"]) + 0.15, drawstyle="steps-post", label=f"{name} (AP = {ap:.2f})", zorder=3)
        if ctx.flag("mark_best", True) and recall.size > 2:
            denominator = np.clip(recall + precision, 1e-12, None)
            f1 = 2.0 * recall * precision / denominator
            best = int(np.argmax(f1))
            if recall[best] > 0:
                ax.scatter([recall[best]], [precision[best]], s=_ms(ctx, 2.4) ** 2, facecolors="none", edgecolors=colour, linewidths=0.7, zorder=4)
    ax.set_xlim(0.0, 1.02)
    ax.set_ylim(0.0, 1.02)
    ctx.finish(ax, legend=False)
    ctx.legend(ax, loc="lower right")
    return ctx.fig


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------

@register(
    "calibration",
    zh="校准曲线",
    en="Calibration curve",
    category="biomedical",
    summary_zh="预测概率 vs 观察比例：理想线 y=x、分组折线与误差棒，评估模型校准度。",
    summary_en="Predicted probability versus observed proportion with identity line, per-group curves and error bars.",
    tags=["calibration", "prediction", "clinical"],
    aspect=1.0,
    options=[
        {"id": "show_ideal", "type": "bool", "default": True, "label_zh": "显示理想线", "label_en": "Show identity line"},
        {"id": "show_errorbars", "type": "bool", "default": True, "label_zh": "显示误差棒", "label_en": "Show error bars"},
        {"id": "connect", "type": "bool", "default": True, "label_zh": "连接分箱点", "label_en": "Connect bins"},
    ],
    demo={
        "data": {"sample": "bio_calibration", "mapping": {"x": "predicted", "y": "observed", "yerr": "se", "group": "group"}},
        "style": {"domain": "clinical", "journal": "jama"},
        "labels": {"x": "Predicted probability", "y": "Observed proportion", "legend": "Cohort"},
    },
)
def render_calibration(ctx):
    ax = ctx.ax()
    series = _curves_from_series(ctx)
    if not series:
        raise SpecError("no calibration series were found", "invalid_data", "data")
    if ctx.flag("show_ideal", True):
        ax.plot([0.0, 1.0], [0.0, 1.0], color=REF_COLOR, lw=0.6, ls="--", zorder=1, label="Perfect calibration")
    connect = ctx.flag("connect", True)
    for index, (name, x, y, item) in enumerate(series):
        colour = ctx.color(index)
        yerr = item.get("yerr") if isinstance(item, dict) else None
        if yerr is not None and ctx.flag("show_errorbars", True):
            err = np.asarray(yerr, dtype=float)[: x.size]
            ax.errorbar(
                x,
                y,
                yerr=err,
                fmt="o-" if connect else "o",
                color=colour,
                ecolor=colour,
                lw=float(ctx.style["line"]["lw"]),
                ms=_ms(ctx, 1.25),
                capsize=float(ctx.style["errorbar"]["capsize"]),
                capthick=float(ctx.style["errorbar"]["capthick"]),
                elinewidth=float(ctx.style["errorbar"]["elinewidth"]),
                label=name,
                zorder=3,
            )
        else:
            ax.plot(x, y, "o-" if connect else "o", color=colour, lw=float(ctx.style["line"]["lw"]), ms=_ms(ctx, 1.25), label=name, zorder=3)
    ax.set_xlim(0.0, 1.0)
    ax.set_ylim(0.0, 1.0)
    ctx.finish(ax, legend=False)
    ctx.legend(ax, loc="upper left")
    return ctx.fig


# ---------------------------------------------------------------------------
# Bland-Altman
# ---------------------------------------------------------------------------

@register(
    "bland_altman",
    zh="Bland-Altman 一致性图",
    en="Bland-Altman agreement",
    category="biomedical",
    summary_zh="两种测量方法的一致性：均值差横线、±1.96 SD 界限、散点与统计注释。",
    summary_en="Method-agreement plot with bias line, 95% limits of agreement, scatter and summary note.",
    tags=["agreement", "method comparison", "clinical"],
    aspect=0.86,
    options=[
        {"id": "show_loa", "type": "bool", "default": True, "label_zh": "显示 95% 一致性界限", "label_en": "Show 95% LoA"},
        {"id": "show_stats", "type": "bool", "default": True, "label_zh": "显示统计注释", "label_en": "Show statistics"},
        {"id": "show_band", "type": "bool", "default": True, "label_zh": "阴影一致性带", "label_en": "Shade LoA band"},
    ],
    demo={
        "data": {"sample": "bio_bland", "mapping": {"x": "method_a", "y": "method_b"}},
        "style": {"domain": "clinical", "journal": "jama"},
        "labels": {"x": "Mean of NGS and ctDNA VAF", "y": "Difference (NGS $-$ ctDNA)"},
    },
)
def render_bland_altman(ctx):
    ax = ctx.ax()
    method_a, method_b = _xy(ctx)
    mask = np.isfinite(method_a) & np.isfinite(method_b)
    method_a, method_b = method_a[mask], method_b[mask]
    mean = 0.5 * (method_a + method_b)
    difference = method_a - method_b
    bias = float(np.mean(difference))
    spread = float(np.std(difference, ddof=1)) if difference.size > 1 else 0.0
    low, high = bias - 1.96 * spread, bias + 1.96 * spread
    colour = ctx.color(0)
    if ctx.flag("show_band", True):
        ax.axhspan(low, high, color=NEUTRAL, alpha=0.10, lw=0, zorder=0)
    ax.scatter(mean, difference, s=_ms(ctx, 1.55) ** 2, color=colour, alpha=0.78, edgecolors="white", linewidths=0.3, zorder=3)
    ax.axhline(bias, color="#333333", lw=float(ctx.style["line"]["lw"]), zorder=4)
    if ctx.flag("show_loa", True):
        _reference(ax, y=[low, high])
        ax.text(float(np.nanmax(mean)) * 0.995, high, " +1.96 SD", ha="right", va="bottom", fontsize=_fs_tick(ctx) - 0.5, color=REF_COLOR)
        ax.text(float(np.nanmax(mean)) * 0.995, low, " $-$1.96 SD", ha="right", va="top", fontsize=_fs_tick(ctx) - 0.5, color=REF_COLOR)
    ax.set_xlim(H.nice_limits(mean, pad=0.05))
    y_low = min(float(np.min(difference)), low)
    y_high = max(float(np.max(difference)), high)
    pad = (y_high - y_low or 1.0) * 0.10
    ax.set_ylim(y_low - pad, y_high + pad)
    ctx.finish(ax, legend=False)
    if ctx.flag("show_stats", True):
        note = f"Bias = {bias:+.3f}\n95% LoA = {low:+.3f} to {high:+.3f}"
        H.corner_note(ax, note, loc="lower right", fontsize=_fs_tick(ctx) - 0.4)
    return ctx.fig


# ---------------------------------------------------------------------------
# Dose-response
# ---------------------------------------------------------------------------

@register(
    "dose_response",
    zh="剂量-反应曲线",
    en="Dose-response curve",
    category="biomedical",
    summary_zh="对数浓度轴、实测点与 4PL 拟合曲线、95% 置信带、EC50 虚线与标注，SciPy 不可用时 NumPy 降级拟合。",
    summary_en="Log-concentration axis with measured points, 4PL curve, 95% band and EC50 annotation; NumPy fallback when SciPy is absent.",
    tags=["IC50", "EC50", "pharmacology", "4PL"],
    aspect=0.86,
    options=[
        {"id": "logx", "type": "bool", "default": True, "label_zh": "对数浓度轴", "label_en": "Log concentration axis"},
        {"id": "show_band", "type": "bool", "default": True, "label_zh": "95% 置信带", "label_en": "95% confidence band"},
        {"id": "show_ec50", "type": "bool", "default": True, "label_zh": "标注 EC50", "label_en": "Annotate EC50"},
    ],
    demo={
        "data": {"sample": "bio_dose", "mapping": {"x": "concentration", "y": "response", "group": "compound"}},
        "style": {"domain": "life-science", "journal": "nature"},
        "labels": {"x": "Concentration ($\\mu$M)", "y": "Normalised viability (%)", "legend": "Compound"},
    },
)
def render_dose_response(ctx):
    ax = ctx.ax()
    concentration, _ = _numeric(ctx, "x")
    response, _ = _numeric(ctx, "y")
    groups, _ = _categorical(ctx, "group", required=False)
    if groups is None:
        groups = np.asarray(["All"] * concentration.size)
    groups = np.asarray([str(value) for value in groups])
    concentration = np.asarray(concentration, dtype=float)
    response = np.asarray(response, dtype=float)
    mask = np.isfinite(concentration) & np.isfinite(response) & (concentration > 0)
    concentration, response, groups = concentration[mask], response[mask], groups[mask]
    use_log = ctx.flag("logx", True)
    if use_log:
        dense = np.geomspace(float(concentration.min()), float(concentration.max()), 240)
    else:
        dense = np.linspace(float(concentration.min()), float(concentration.max()), 240)
    show_band = ctx.flag("show_band", True)
    show_ec50 = ctx.flag("show_ec50", True)
    all_extremes = []
    for index, level in enumerate(dict.fromkeys(groups.tolist())):
        selected = groups == level
        x_values = concentration[selected]
        y_values = response[selected]
        unique = np.unique(x_values)
        means = np.asarray([float(np.mean(y_values[x_values == value])) for value in unique])
        sems = np.asarray([float(np.std(y_values[x_values == value], ddof=1) / math.sqrt(max(np.sum(x_values == value), 1))) if np.sum(x_values == value) > 1 else 0.0 for value in unique])
        colour = ctx.color(index)
        ax.errorbar(
            unique,
            means,
            yerr=sems,
            fmt="o",
            color=colour,
            ecolor=colour,
            ms=_ms(ctx, 1.35),
            capsize=float(ctx.style["errorbar"]["capsize"]),
            capthick=float(ctx.style["errorbar"]["capthick"]),
            elinewidth=float(ctx.style["errorbar"]["elinewidth"]),
            label=str(level),
            zorder=4,
        )
        fit = _fit_four_pl(unique, means)
        if fit is not None:
            params = fit["params"]
            ax.plot(dense, _four_pl(dense, *params), color=colour, lw=float(ctx.style["line"]["lw"]) + 0.2, zorder=3)
            if show_band and ctx.flag("show_band", True):
                band = _profile_band(params, fit.get("cov"), dense)
                if band is not None:
                    ax.fill_between(dense, band[0], band[1], color=colour, alpha=0.13, lw=0, zorder=2)
            if show_ec50:
                ec50 = float(math.exp(params[2]))
                half = float(params[0] + (params[1] - params[0]) / 2.0)
                ax.vlines(ec50, 0.0, half, color=colour, lw=0.6, ls=":")
                ax.hlines(half, float(concentration.min()), ec50, color=colour, lw=0.6, ls=":")
                ax.annotate(
                    f"EC$_{{50}}$ = {ec50:.2g} $\\mu$M",
                    xy=(ec50, half),
                    xytext=(4, 12 + 10 * (index % 2)),
                    textcoords="offset points",
                    fontsize=_fs_tick(ctx) - 0.4,
                    color=colour,
                    ha="left",
                    va="bottom",
                    bbox={"boxstyle": "round,pad=0.18", "facecolor": "#ffffff", "edgecolor": "none", "alpha": 0.75},
                    zorder=6,
                )
        all_extremes.extend([float(np.nanmin(means)), float(np.nanmax(means))])
    ax.set_ylim(min(0.0, min(all_extremes or [0.0]) - 5.0), max(all_extremes or [100.0]) + 8.0)
    ctx.finish(ax, xscale="log" if use_log else "linear", legend=False)
    ctx.legend(ax, loc="lower left")
    return ctx.fig


# ---------------------------------------------------------------------------
# Clustered heatmap
# ---------------------------------------------------------------------------

def _matrix_from_table(ctx):
    row_name = _mapped(ctx, "row")
    col_name = _mapped(ctx, "col")
    value_name = _mapped(ctx, "value")
    if row_name and col_name and value_name and ctx.table.has(row_name) and ctx.table.has(col_name):
        rows = ctx.table.categorical(row_name)
        cols = ctx.table.categorical(col_name)
        values = ctx.table.numeric(value_name)
        row_levels = list(dict.fromkeys(rows.tolist()))
        col_levels = list(dict.fromkeys(cols.tolist()))
        row_index = {name: index for index, name in enumerate(row_levels)}
        col_index = {name: index for index, name in enumerate(col_levels)}
        matrix = np.full((len(row_levels), len(col_levels)), np.nan)
        for row_value, col_value, value in zip(rows, cols, values):
            matrix[row_index[str(row_value)], col_index[str(col_value)]] = value
        if np.any(np.isnan(matrix)):
            matrix = np.nan_to_num(matrix, nan=0.0)
        return matrix, [str(value) for value in row_levels], [str(value) for value in col_levels]
    if ctx.table.mode == "matrix" and ctx.table.matrix is not None:
        return np.asarray(ctx.table.matrix, dtype=float), list(ctx.table.row_labels or []), list(ctx.table.col_labels or [])
    raise SpecError('the mapping needs "row", "col" and "value" (or a matrix)', "invalid_mapping", "mapping")


@register(
    "cluster_heatmap",
    zh="聚类热图",
    en="Clustered heatmap",
    category="biomedical",
    summary_zh="行列层次聚类热图：双向树状图、可选行 z-score、0 居中发散色标、色标与行列标签。",
    summary_en="Clustered heatmap with row/column dendrograms, optional row z-score, zero-centred diverging map and labels.",
    tags=["heatmap", "clustering", "omics", "RNA-seq"],
    aspect=1.0,
    options=[
        {"id": "zscore", "type": "bool", "default": True, "label_zh": "行 z-score 标准化", "label_en": "Row z-score"},
        {"id": "cluster", "type": "bool", "default": True, "label_zh": "层次聚类", "label_en": "Hierarchical clustering"},
        {"id": "show_dendrogram", "type": "bool", "default": True, "label_zh": "显示树状图", "label_en": "Show dendrograms"},
        {"id": "max_col_labels", "type": "int", "default": 12, "min": 4, "max": 40, "label_zh": "最多列标签数", "label_en": "Max column labels"},
    ],
    demo={
        "data": {"sample": "omics_expression", "mapping": {"row": "gene", "col": "sample", "value": "value"}},
        "style": {"domain": "omics", "journal": "cell"},
        "labels": {"x": "Sample", "y": "Gene", "colorbar": "Row z-score"},
    },
)
def render_cluster_heatmap(ctx):
    matrix, row_labels, col_labels = _matrix_from_table(ctx)
    if matrix.size == 0:
        raise SpecError("the heatmap matrix is empty", "invalid_data", "data")
    if not row_labels:
        row_labels = [f"R{index + 1}" for index in range(matrix.shape[0])]
    if not col_labels:
        col_labels = [f"C{index + 1}" for index in range(matrix.shape[1])]
    do_zscore = ctx.flag("zscore", True)
    data = np.asarray(matrix, dtype=float)
    if do_zscore:
        means = np.nanmean(data, axis=1, keepdims=True)
        scales = np.nanstd(data, axis=1, ddof=1, keepdims=True)
        scales[np.isnan(scales) | (scales == 0)] = 1.0
        data = (data - means) / scales
    do_cluster = ctx.flag("cluster", True)
    row_linkage = col_linkage = None
    row_order = np.arange(data.shape[0])
    col_order = np.arange(data.shape[1])
    if do_cluster:
        row_linkage = _linkage_rows(data)
        row_order = np.asarray(_leaf_order(row_linkage, data.shape[0]))
        col_linkage = _linkage_rows(data.T)
        col_order = np.asarray(_leaf_order(col_linkage, data.shape[1]))
    ordered = data[np.ix_(row_order, col_order)]
    ordered_rows = [row_labels[index] for index in row_order]
    ordered_cols = [col_labels[index] for index in col_order]
    n_rows, n_cols = ordered.shape
    show_dendrogram = do_cluster and ctx.flag("show_dendrogram", True)
    span_row = 0.30 * n_cols if show_dendrogram else 0.0
    span_col = 0.30 * n_rows if show_dendrogram else 0.0
    ax = ctx.ax()
    vmax = float(np.nanmax(np.abs(ordered))) or 1.0
    colour_map = ctx.diverging_cmap()
    image = ax.pcolormesh(
        np.arange(n_cols + 1) - 0.5,
        np.arange(n_rows + 1) - 0.5,
        ordered,
        cmap=colour_map,
        vmin=-vmax,
        vmax=vmax,
        shading="flat",
        rasterized=True,
    )
    if show_dendrogram:
        _draw_dendrogram(ctx, ax, row_linkage, n_rows, orientation="left", low=-0.5, high=-0.5 - span_row)
        _draw_dendrogram(ctx, ax, col_linkage, n_cols, orientation="top", low=-0.5, high=-0.5 - span_col)
    ax.set_xlim(-0.5 - span_row, n_cols - 0.5 + 0.02)
    ax.set_ylim(n_rows - 0.5, -0.5 - span_col)
    step = max(1, int(math.ceil(n_rows / 42.0)))
    y_positions = np.arange(0, n_rows, step)
    y_labels = [ordered_rows[index] for index in y_positions]
    ax.set_yticks(y_positions + 0.0)
    ax.set_yticklabels(y_labels, fontsize=_fs_tick(ctx) - 0.4)
    ax.yaxis.tick_right()
    max_labels = max(2, int(ctx.num("max_col_labels", 12)))
    if n_cols > max_labels:
        step_cols = int(math.ceil(n_cols / float(max_labels)))
        x_positions = np.arange(0, n_cols, step_cols)
    else:
        x_positions = np.arange(n_cols)
    ax.set_xticks(x_positions)
    ax.set_xticklabels([ordered_cols[index] for index in x_positions], fontsize=_fs_tick(ctx) - 0.4)
    if n_cols > 4 or any(len(label) > 6 for label in ordered_cols):
        ax.tick_params(axis="x", labelrotation=90)
    ctx.finish(ax, xlabel=ctx.label("x"), ylabel="", legend=False, grid=False)
    ax.tick_params(axis="both", length=0.0, pad=2.0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    label = ctx.label("colorbar") or ("Row z-score" if do_zscore else "Value")
    ctx.colorbar(image, ax=ax, label=label, fraction=0.05, pad=0.10)
    return ctx.fig


# ---------------------------------------------------------------------------
# PCA
# ---------------------------------------------------------------------------

def _feature_matrix(ctx):
    mapping = _mapping(ctx)
    group_name = mapping.get("group") if isinstance(mapping.get("group"), str) else None
    requested = mapping.get("features")
    if isinstance(requested, (list, tuple)):
        names = [str(name) for name in requested if ctx.table.has(str(name))]
    else:
        names = [
            name
            for name in ctx.table.column_order
            if name != group_name and ctx.table._is_numeric_column(name)  # noqa: SLF001 - shared read-only helper
        ]
    if len(names) < 2:
        raise SpecError("PCA needs at least two numeric feature columns", "invalid_data", "data")
    matrix = np.column_stack([ctx.table.numeric(name) for name in names])
    return matrix, names


@register(
    "pca",
    zh="主成分分析图",
    en="PCA score plot",
    category="biomedical",
    summary_zh="分组 PCA 散点：95% 置信椭圆、质心与轴解释方差百分比，自动从数值特征列计算主成分。",
    summary_en="Grouped PCA scores with 95% confidence ellipses, centroids and explained-variance axis labels.",
    tags=["PCA", "dimension reduction", "omics"],
    aspect=1.0,
    options=[
        {"id": "standardize", "type": "bool", "default": True, "label_zh": "标准化特征", "label_en": "Standardise features"},
        {"id": "ellipse", "type": "bool", "default": True, "label_zh": "95% 置信椭圆", "label_en": "95% ellipses"},
        {"id": "centroid", "type": "bool", "default": True, "label_zh": "显示质心", "label_en": "Mark centroids"},
    ],
    demo={
        "data": {"sample": "omics_pca", "mapping": {"group": "group"}},
        "style": {"domain": "omics", "journal": "nature", "palette": "jama"},
        "labels": {"x": "PC1", "y": "PC2", "legend": "Group"},
    },
)
def render_pca(ctx):
    matrix, _names = _feature_matrix(ctx)
    scores, explained, _loadings = _pca_scores(matrix, standardize=ctx.flag("standardize", True))
    groups, _ = _categorical(ctx, "group", required=False)
    if groups is None:
        groups = np.asarray(["All"] * scores.shape[0])
    groups = np.asarray([str(value) for value in groups])
    ax = ctx.ax()
    levels = list(dict.fromkeys(groups.tolist()))
    labels_x, labels_y = ctx.label("x") or "PC1", ctx.label("y") or "PC2"
    x_label = f"{labels_x} ({explained[0]:.1f}%)" if explained.size > 0 else labels_x
    y_label = f"{labels_y} ({explained[1]:.1f}%)" if explained.size > 1 else labels_y
    for index, level in enumerate(levels):
        selected = groups == level
        points = scores[selected, :2]
        colour = ctx.color(index)
        ax.scatter(points[:, 0], points[:, 1], s=_ms(ctx, 1.5) ** 2, color=colour, alpha=0.8, edgecolors="white", linewidths=0.3, label=level, zorder=3)
        if ctx.flag("ellipse", True):
            geometry = _confidence_ellipse(points)
            if geometry is not None:
                centre, width, height, angle = geometry
                ax.add_patch(Ellipse(centre, width, height, angle=angle, facecolor="none", edgecolor=colour, lw=0.9, alpha=0.9, zorder=2))
        if ctx.flag("centroid", True):
            ax.scatter([points[:, 0].mean()], [points[:, 1].mean()], s=_ms(ctx, 2.0) ** 2, marker="X", color=colour, edgecolors="white", linewidths=0.5, zorder=4)
    ax.axhline(0.0, color=REF_COLOR, lw=0.5, ls=":", zorder=1)
    ax.axvline(0.0, color=REF_COLOR, lw=0.5, ls=":", zorder=1)
    ax.set_xlim(H.nice_limits(scores[:, 0], pad=0.08))
    ax.set_ylim(H.nice_limits(scores[:, 1], pad=0.08))
    ctx.finish(ax, xlabel=x_label, ylabel=y_label, legend=False)
    H.corner_note(ax, f"n = {scores.shape[0]}", loc="lower left", fontsize=_fs_tick(ctx) - 0.5)
    ctx.legend(ax, loc="lower left", bbox_to_anchor=(0.0, 1.01), ncol=min(3, len(levels)), frameon=False, borderaxespad=0.0, handletextpad=0.4, columnspacing=1.0)
    return ctx.fig


# ---------------------------------------------------------------------------
# t-SNE
# ---------------------------------------------------------------------------

@register(
    "tsne",
    zh="t-SNE 降维图",
    en="t-SNE embedding",
    category="biomedical",
    summary_zh="二维 t-SNE 嵌入分组散点，图例标注细胞谱系，点大小可调。",
    summary_en="Two-dimensional t-SNE embedding coloured by cluster with legend and adjustable point size.",
    tags=["t-SNE", "embedding", "single-cell"],
    aspect=0.96,
    options=[
        {"id": "point_size", "type": "float", "default": 9.0, "min": 2.0, "max": 80.0, "step": 1.0, "label_zh": "点大小", "label_en": "Point size"},
        {"id": "alpha", "type": "float", "default": 0.82, "min": 0.1, "max": 1.0, "step": 0.02, "label_zh": "透明度", "label_en": "Opacity"},
        {"id": "show_centroid", "type": "bool", "default": False, "label_zh": "标注簇质心", "label_en": "Label centroids"},
    ],
    demo={
        "data": {"sample": "omics_tsne", "mapping": {"x": "x", "y": "y", "group": "cluster"}},
        "style": {"domain": "omics", "journal": "nature", "palette": "jama"},
        "labels": {"x": "t-SNE 1", "y": "t-SNE 2", "legend": "Cell type"},
    },
)
def render_tsne(ctx):
    ax = ctx.ax()
    series = _curves_from_series(ctx)
    if not series:
        raise SpecError("no embedding series were found", "invalid_data", "data")
    size = float(ctx.num("point_size", 9.0))
    alpha = float(ctx.num("alpha", 0.82))
    for index, (name, x, y, _item) in enumerate(series):
        colour = ctx.color(index)
        ax.scatter(x, y, s=size, color=colour, alpha=alpha, edgecolors="white", linewidths=0.25, label=name, zorder=3)
        if ctx.flag("show_centroid", False) and x.size:
            ax.annotate(name, xy=(float(np.mean(x)), float(np.mean(y))), ha="center", va="center", fontsize=_fs_tick(ctx) - 0.6, color="#222222", bbox={"boxstyle": "round,pad=0.15", "facecolor": "#ffffff", "edgecolor": "none", "alpha": 0.75}, zorder=6)
    values_x = np.concatenate([item[1] for item in series])
    values_y = np.concatenate([item[2] for item in series])
    ax.set_xlim(H.nice_limits(values_x, pad=0.07))
    ax.set_ylim(H.nice_limits(values_y, pad=0.07))
    ctx.finish(ax, legend=False)
    ctx.legend(ax, loc="best")
    return ctx.fig


# ---------------------------------------------------------------------------
# Dot plot
# ---------------------------------------------------------------------------

@register(
    "dot_plot",
    zh="标志基因点图",
    en="Dot plot",
    category="biomedical",
    summary_zh="基因 × 簇点图：点大小为阳性比例、颜色为平均表达，附色标与尺寸图例。",
    summary_en="Gene-by-cluster dot plot with detection fraction as size and mean expression as colour, plus colorbar and size legend.",
    tags=["dot plot", "marker genes", "single-cell"],
    aspect=0.92,
    options=[
        {"id": "size_scale", "type": "float", "default": 62.0, "min": 10.0, "max": 220.0, "step": 2.0, "label_zh": "点大小尺度", "label_en": "Dot scale"},
        {"id": "show_colorbar", "type": "bool", "default": True, "label_zh": "显示色标", "label_en": "Show colorbar"},
        {"id": "show_size_legend", "type": "bool", "default": True, "label_zh": "显示尺寸图例", "label_en": "Show size legend"},
    ],
    demo={
        "data": {
            "sample": "omics_dot",
            "mapping": {"x": "cluster", "y": "gene", "size": "fraction", "value": "mean_expression"},
        },
        "style": {"domain": "omics", "journal": "cell"},
        "labels": {"x": "Cell cluster", "y": "Marker gene", "colorbar": "Mean expression"},
    },
)
def render_dot_plot(ctx):
    x_values, _ = _categorical(ctx, "x")
    y_values, _ = _categorical(ctx, "y")
    size_values, _ = _numeric(ctx, "size", required=False)
    colour_values, _ = _numeric(ctx, "value", required=False)
    if size_values is None or colour_values is None:
        raise SpecError('the dot plot needs "size" and "value" numeric columns', "invalid_mapping", "mapping")
    clusters = list(dict.fromkeys(str(value) for value in x_values))
    genes = list(dict.fromkeys(str(value) for value in y_values))
    cluster_index = {name: index for index, name in enumerate(clusters)}
    gene_index = {name: index for index, name in enumerate(genes)}
    fractions = np.zeros((len(genes), len(clusters)))
    expression = np.full((len(genes), len(clusters)), np.nan)
    for x_value, y_value, fraction, value in zip(x_values, y_values, size_values, colour_values):
        row, column = gene_index[str(y_value)], cluster_index[str(x_value)]
        fractions[row, column] = float(fraction)
        expression[row, column] = float(value)
    finite_expression = expression[np.isfinite(expression)]
    if finite_expression.size == 0:
        raise SpecError("no finite expression values were found", "invalid_data", "data")
    low, high = float(np.min(finite_expression)), float(np.max(finite_expression))
    if high == low:
        high = low + 1.0
    scale = float(ctx.num("size_scale", 62.0))
    xx, yy = np.meshgrid(np.arange(len(clusters)), np.arange(len(genes)))
    colours = np.nan_to_num(expression, nan=low)
    ax = ctx.ax()
    image = ax.scatter(
        xx.ravel(),
        yy.ravel(),
        s=4.0 + scale * np.clip(fractions.ravel(), 0.0, 1.0),
        c=colours.ravel(),
        cmap=ctx.cmap(),
        vmin=low,
        vmax=high,
        edgecolors="#6E6E6E",
        linewidths=0.25,
        zorder=3,
    )
    ax.set_xticks(np.arange(len(clusters)))
    ax.set_xticklabels(clusters)
    ax.set_yticks(np.arange(len(genes)))
    ax.set_yticklabels(genes)
    if any(len(name) > 9 for name in clusters):
        ax.tick_params(axis="x", labelrotation=30)
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    ax.set_xlim(-0.6, len(clusters) - 0.4)
    ax.set_ylim(len(genes) - 0.5, -0.5)
    ctx.finish(ax, legend=False, grid=False)
    ax.tick_params(axis="both", length=0.0)
    if ctx.flag("show_colorbar", True):
        ctx.colorbar(image, ax=ax, label=ctx.label("colorbar") or "Mean expression", fraction=0.05, pad=0.06)
    if ctx.flag("show_size_legend", True):
        fractions_legend = [0.25, 0.5, 0.75, 1.0]
        handles = [Line2D([], [], linestyle="", marker="o", color="none", markerfacecolor="#8C8C8C", markeredgecolor="#6E6E6E", markeredgewidth=0.3, markersize=math.sqrt(4.0 + scale * value)) for value in fractions_legend]
        handles_labels = [f"{value:.2f}" for value in fractions_legend]
        legend = ax.legend(
            handles,
            handles_labels,
            title="Fraction of cells",
            loc="lower left",
            bbox_to_anchor=(0.0, 1.01),
            ncol=4,
            frameon=False,
            fontsize=_fs_legend(ctx),
            title_fontsize=_fs_legend(ctx),
            columnspacing=1.0,
            handletextpad=0.4,
            borderaxespad=0.0,
        )
        legend._legend_box.align = "left"
    return ctx.fig


# ---------------------------------------------------------------------------
# GSEA bar
# ---------------------------------------------------------------------------

@register(
    "gsea_bar",
    zh="GSEA 富集棒图",
    en="GSEA enrichment bars",
    category="biomedical",
    summary_zh="按富集分数排序的横向棒图，正负效应双色、通路标签与 BH-FDR 显著性星标。",
    summary_en="Horizontally ranked enrichment-score bars coloured by direction with pathway labels and BH-FDR stars.",
    tags=["GSEA", "pathway", "enrichment", "omics"],
    aspect=0.74,
    options=[
        {"id": "show_fdr", "type": "bool", "default": True, "label_zh": "显示 FDR 标记", "label_en": "Show FDR markers"},
        {"id": "fdr_cut", "type": "float", "default": 0.05, "min": 0.001, "max": 0.5, "step": 0.005, "label_zh": "FDR 阈值", "label_en": "FDR cutoff"},
        {"id": "wrap_width", "type": "int", "default": 26, "min": 10, "max": 46, "label_zh": "通路名换行宽度", "label_en": "Label wrap width"},
    ],
    demo={
        "data": {"sample": "omics_gsea", "mapping": {"label": "pathway", "x": "es", "p": "p"}},
        "style": {"domain": "omics", "journal": "cell"},
        "labels": {"x": "Normalised enrichment score (NES)", "y": ""},
    },
)
def render_gsea_bar(ctx):
    scores, _ = _numeric(ctx, "x")
    names, _ = _categorical(ctx, "label", required=False)
    if names is None:
        names = np.asarray([f"Pathway {index + 1}" for index in range(scores.size)])
    p_values, _ = _numeric(ctx, "p", required=False)
    q_values = _bh_fdr(p_values) if p_values is not None else None
    order = np.argsort(scores, kind="mergesort")
    scores = np.asarray(scores, dtype=float)[order]
    names = [str(names[index]) for index in order]
    q = q_values[order] if q_values is not None else None
    positions = np.arange(scores.size, dtype=float)
    colour_positive = ctx.color(0)
    colour_negative = ctx.color(1)
    colours = [colour_positive if value >= 0 else colour_negative for value in scores]
    ax = ctx.ax()
    ax.barh(positions, scores, height=0.62, color=colours, edgecolor="white", linewidth=0.4, zorder=3)
    ax.axvline(0.0, color="#333333", lw=0.7, zorder=4)
    ax.set_yticks(positions)
    ax.set_yticklabels([textwrap.fill(name, int(ctx.num("wrap_width", 26))) for name in names], fontsize=_fs_tick(ctx) - 0.3)
    cut = float(ctx.num("fdr_cut", 0.05))
    if ctx.flag("show_fdr", True) and q is not None:
        span = float(np.nanmax(np.abs(scores))) or 1.0
        for position, value, local_q in zip(positions, scores, q):
            if local_q < cut:
                stars = "***" if local_q < 0.001 else ("**" if local_q < 0.01 else "*")
                ax.text(value + (span * 0.03 if value >= 0 else -span * 0.03), position, stars, ha="left" if value >= 0 else "right", va="center", fontsize=_fs_tick(ctx) - 0.4, color="#222222", zorder=5)
        ax.text(0.0, 1.015, f"* Benjamini-Hochberg FDR < {cut:g}", transform=ax.transAxes, ha="left", va="bottom", fontsize=max(6.0, _fs_tick(ctx) - 0.8), color="#555555")
    span = float(np.nanmax(np.abs(scores))) or 1.0
    ax.set_xlim(-span * 1.22, span * 1.22)
    ax.set_ylim(-0.65, scores.size - 0.35)
    ctx.finish(ax, legend=False, grid=False)
    return ctx.fig
