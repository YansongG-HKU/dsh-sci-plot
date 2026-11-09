"""Machine-learning family.

Multi-seed training curves, confusion matrices, permutation feature importance
and latent-space embeddings.  Same contract as every other renderer: this module
decides *what* is drawn; typography, colour and geometry come from the shared
style system.
"""
from __future__ import annotations

import numpy as np
from matplotlib.colors import LogNorm, Normalize, to_rgb
from matplotlib.patches import Patch

from .. import helpers as H
from ..palettes import to_hex
from ..registry import register
from ..spec import SpecError

try:  # SciPy is optional and never required here.
    from scipy import stats as _stats
except Exception:  # pragma: no cover
    _stats = None

REF_COLOR = "#9A9A9A"


# ---------------------------------------------------------------------------
# Local helpers
# ---------------------------------------------------------------------------

def _mapping(ctx) -> dict:
    mapping = getattr(ctx.table, "mapping", None)
    return mapping if isinstance(mapping, dict) else {}


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


def _is_numeric(data, name) -> bool:
    try:
        return bool(data._is_numeric_column(str(name)))
    except Exception:
        return False


def _numeric_columns(data) -> list[str]:
    return [str(name) for name in data.column_order if _is_numeric(data, name)]


def _column(data, candidates, numeric: bool = True):
    for name in candidates:
        if isinstance(name, str) and data.has(name):
            if not numeric or _is_numeric(data, name):
                return name
    return None


def _legend_label(name) -> str:
    text = str(name).replace("_", " ").strip()
    return (text[:1].upper() + text[1:]) if text else text


def _blend(colour: str, other: str, fraction: float) -> str:
    first = np.asarray(to_rgb(colour), dtype=float)
    second = np.asarray(to_rgb(other), dtype=float)
    return to_hex(first * (1.0 - fraction) + second * fraction)


# ---------------------------------------------------------------------------
# Training curves
# ---------------------------------------------------------------------------

@register(
    "training_curves",
    zh="训练曲线",
    en="Training curves",
    category="ml",
    summary_zh="多随机种子训练/验证曲线：均值实线 + ±1 SD 阴影，可对数纵轴，图例区分数据划分。",
    summary_en="Multi-seed train/validation curves: mean line with +/-1 SD band and an optional log y axis.",
    tags=["训练", "loss", "seed", "深度学习"],
    aspect=0.7,
    options=[
        {"id": "yscale", "type": "enum", "default": "log", "choices": ["linear", "log"], "label_zh": "纵轴尺度", "label_en": "Y scale"},
        {"id": "band", "type": "bool", "default": True, "label_zh": "±1 SD 阴影", "label_en": "+/-1 SD band"},
        {"id": "markers", "type": "bool", "default": True, "label_zh": "标记点", "label_en": "Markers"},
    ],
    demo={
        "data": {
            "sample": "ml_training",
            "mapping": {"x": "epoch", "y": "loss", "group": "split", "seed": "seed"},
        },
        "style": {"domain": "ml", "journal": "neurips"},
        "labels": {"x": "Epoch", "y": "Cross-entropy loss", "legend": "Split"},
    },
    aliases=["training_curve", "loss_curves"],
)
def render_training_curves(ctx):
    ax = ctx.ax()
    data = ctx.table
    mapping = _mapping(ctx)
    lw = _lw(ctx)
    ms = _ms(ctx)
    bands = ctx.flag("band", True)
    markers = ctx.flag("markers", True)
    yscale = str(ctx.opt("yscale", "log"))

    curves = []
    if data.mode == "series":
        for index, item in enumerate(data.series):
            x, y = H.clean_xy(item.get("x", []), item.get("y", []))
            if x.size:
                curves.append({"name": str(item.get("name") or f"Series {index + 1}"), "epochs": x, "mean": y, "std": np.zeros_like(y)})
    else:
        numeric = _numeric_columns(data)
        x_name = _column(data, [mapping.get("x")], numeric=True) or (numeric[0] if numeric else None)
        y_name = _column(data, [mapping.get("y")], numeric=True) or (numeric[1] if len(numeric) > 1 else None)
        if x_name is None or y_name is None:
            raise SpecError('training curves need numeric "epoch" and "loss" columns', "invalid_mapping", "mapping")
        split_name = _column(data, [mapping.get("group")], numeric=False)
        seed_name = _column(data, [mapping.get("seed")], numeric=True) or (data.has("seed") and _is_numeric(data, "seed") and "seed" or None)
        epochs = data.numeric(str(x_name))
        losses = data.numeric(str(y_name))
        if isinstance(split_name, str):
            splits = data.categorical(split_name)
            levels = data.unique(split_name)
        else:
            splits = np.asarray(["Loss"] * epochs.size, dtype=object)
            levels = ["Loss"]
        seeds = data.numeric(str(seed_name)) if isinstance(seed_name, str) else np.zeros(epochs.size)
        for level in levels:
            mask = np.asarray([str(value) == str(level) for value in splits], dtype=bool)
            epoch_values = np.unique(epochs[mask])
            means, deviations = [], []
            for epoch in epoch_values:
                sample = losses[mask & (epochs == epoch)]
                sample = sample[np.isfinite(sample)]
                if sample.size == 0:
                    means.append(np.nan)
                    deviations.append(np.nan)
                    continue
                means.append(float(np.mean(sample)))
                deviations.append(float(np.std(sample, ddof=1)) if sample.size > 1 else 0.0)
            curves.append(
                {
                    "name": _legend_label(level),
                    "epochs": np.asarray(epoch_values, dtype=float),
                    "mean": np.asarray(means, dtype=float),
                    "std": np.asarray(deviations, dtype=float),
                }
            )
        seed_count = int(np.unique(seeds[np.isfinite(seeds)]).size) if np.isfinite(seeds).any() else 1
    if not curves:
        raise SpecError("no training data to plot", "invalid_data")
    if data.mode == "series":
        seed_count = 1

    for index, curve in enumerate(curves):
        colour = ctx.color(index)
        epochs, mean, deviation = curve["epochs"], curve["mean"], curve["std"]
        if bands and np.any(deviation > 0):
            ax.fill_between(epochs, mean - deviation, mean + deviation, color=colour, alpha=0.18, linewidth=0, zorder=2)
        markevery = max(1, len(epochs) // 8) if markers else None
        ax.plot(
            epochs, mean, color=colour, lw=lw * 1.15,
            marker="o" if markers else None, ms=ms * 0.85, mfc=colour, mec="white", mew=0.4,
            markevery=markevery, label=curve["name"], zorder=3,
        )
    H.corner_note(
        ax, f"mean ± SD, $n$ = {seed_count} seeds" if seed_count > 1 else "single run",
        loc="upper right", fontsize=_font(ctx, "legend.fontsize"),
    )
    lower = float(min(np.nanmin(curve["mean"] - curve["std"]) for curve in curves if np.isfinite(curve["mean"]).any()))
    upper = float(max(np.nanmax(curve["mean"] + curve["std"]) for curve in curves if np.isfinite(curve["mean"]).any()))
    if np.isfinite(lower) and np.isfinite(upper) and upper > lower:
        if yscale == "log" and lower > 0:
            ax.set_ylim(lower / 1.3, upper * 1.35)
        else:
            pad = 0.06 * (upper - lower)
            ax.set_ylim(lower - pad, upper + pad)
    ctx.finish(
        ax,
        xlabel=_axis_label(ctx, "x", "Epoch"),
        ylabel=_axis_label(ctx, "y", "Loss"),
        legend=len(curves) > 1,
        yscale=yscale,
    )
    return ctx.fig


# ---------------------------------------------------------------------------
# Confusion matrix
# ---------------------------------------------------------------------------

@register(
    "confusion_matrix",
    zh="混淆矩阵",
    en="Confusion matrix",
    category="ml",
    summary_zh="分类混淆矩阵热图：行列类别标签、格内数值（按底色自动黑/白字）、色标与行归一化选项。",
    summary_en="Confusion-matrix heat map with class labels, contrast-aware cell values, colour bar and row normalisation.",
    tags=["分类", "classification", "matrix", "归一化"],
    aspect=0.95,
    options=[
        {"id": "normalize", "type": "enum", "default": "none", "choices": ["none", "row", "col"], "label_zh": "归一化", "label_en": "Normalisation"},
        {"id": "annot", "type": "bool", "default": True, "label_zh": "格内数值", "label_en": "Cell values"},
        {"id": "accuracy", "type": "bool", "default": True, "label_zh": "总体准确率", "label_en": "Overall accuracy"},
    ],
    demo={
        "data": {
            "sample": "ml_confusion",
            "mapping": {"row": "true_label", "col": "predicted_label", "value": "count"},
        },
        "style": {"domain": "ml", "journal": "neurips"},
        "labels": {"x": "Predicted label", "y": "True label", "colorbar": "Count"},
    },
    aliases=["confusion", "cm"],
)
def render_confusion_matrix(ctx):
    ax = ctx.ax()
    data = ctx.table
    mapping = _mapping(ctx)
    if data.mode == "matrix":
        matrix = np.asarray(data.matrix, dtype=float)
        row_labels = [str(value) for value in (data.row_labels or [])]
        col_labels = [str(value) for value in (data.col_labels or [])]
    else:
        row_name = _column(data, [mapping.get("row"), mapping.get("true"), "true_label", "true"], numeric=False)
        col_name = _column(data, [mapping.get("col"), mapping.get("predicted"), "predicted_label", "predicted"], numeric=False)
        value_name = _column(data, [mapping.get("value"), mapping.get("count"), "count"], numeric=True)
        if row_name is None or col_name is None or value_name is None:
            raise SpecError('the confusion matrix needs "row", "col" and "value" columns', "invalid_mapping", "mapping")
        true_labels = [str(value) for value in data.categorical(row_name)]
        predicted_labels = [str(value) for value in data.categorical(col_name)]
        counts = data.numeric(value_name)
        row_order = data.unique(row_name)
        col_order = [str(level) for level in row_order]
        for level in data.unique(col_name):
            if str(level) not in col_order:
                col_order.append(str(level))
        row_index = {label: index for index, label in enumerate(row_order)}
        col_index = {label: index for index, label in enumerate(col_order)}
        matrix = np.zeros((len(row_order), len(col_order)), dtype=float)
        for true_label, predicted_label, count in zip(true_labels, predicted_labels, counts):
            if np.isfinite(count):
                matrix[row_index[true_label], col_index[predicted_label]] += count
        row_labels = [str(label) for label in row_order]
        col_labels = [str(label) for label in col_order]
    if matrix.size == 0 or matrix.shape[0] < 2:
        raise SpecError("the confusion matrix needs at least two classes", "invalid_data")
    mode = str(ctx.opt("normalize", "none")).lower()
    if mode in ("row", "true", "recall"):
        totals = matrix.sum(axis=1, keepdims=True)
        totals[totals == 0] = 1.0
        display = matrix / totals
        colour_label = "Fraction of true class"
        mode = "row"
    elif mode in ("col", "predicted", "precision"):
        totals = matrix.sum(axis=0, keepdims=True)
        totals[totals == 0] = 1.0
        display = matrix / totals
        colour_label = "Fraction of predicted class"
        mode = "col"
    else:
        display = matrix
        colour_label = "Count"
        mode = "none"
    labels = len(col_labels)
    cmap = ctx.cmap()
    top = float(np.nanmax(display)) if np.isfinite(np.nanmax(display)) else 1.0
    norm = Normalize(vmin=0.0, vmax=top if top > 0 else 1.0)
    ax.pcolormesh(
        np.arange(labels + 1), np.arange(labels + 1), display,
        cmap=cmap, norm=norm, edgecolors="white", linewidth=0.8, zorder=2,
    )
    if ctx.flag("annot", True):
        base_size = _font(ctx, "xtick.labelsize")
        fontsize = max(4.0, base_size - max(0, labels - 5) * 0.25)
        for row in range(matrix.shape[0]):
            for col in range(labels):
                value = display[row, col]
                face = to_hex(cmap(norm(value)))
                text_colour = ctx.text_on(face)
                if mode == "none":
                    text = f"{int(round(value))}"
                else:
                    text = f"{100.0 * value:.0f}%"
                ax.text(col + 0.5, row + 0.5, text, ha="center", va="center",
                        fontsize=fontsize, color=text_colour, zorder=3)
    ax.set_xticks(np.arange(labels) + 0.5)
    ax.set_yticks(np.arange(labels) + 0.5)
    ax.set_xticklabels(col_labels)
    ax.set_yticklabels(row_labels)
    if max((len(label) for label in col_labels), default=0) > 7:
        ax.tick_params(axis="x", labelrotation=35)
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
    ax.set_ylim(labels, 0.0)
    ax.set_xlim(0, labels)
    mesh = ax.collections[-1] if ax.collections else None
    if mesh is not None:
        ctx.colorbar(mesh, ax, label=_axis_label(ctx, "colorbar", colour_label), fraction=0.046, pad=0.03)
    total = float(matrix.sum())
    accuracy = float(np.trace(matrix) / total) if total > 0 else float("nan")
    if ctx.flag("accuracy", True) and np.isfinite(accuracy):
        ax.text(1.0, 1.035, f"Accuracy = {accuracy:.2f}", transform=ax.transAxes,
                ha="right", va="bottom", fontsize=_font(ctx, "legend.fontsize"), color=_dark(ctx))
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", "Predicted label"), ylabel=_axis_label(ctx, "y", "True label"), legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Feature importance
# ---------------------------------------------------------------------------

@register(
    "feature_importance",
    zh="特征重要性",
    en="Feature importance",
    category="ml",
    summary_zh="排序横向棒图：点估计 + 95% 置信区间误差棒 + 数值标签，突出最有信息量的特征。",
    summary_en="Sorted horizontal importance bars with 95% CI error bars and value labels.",
    tags=["特征", "importance", "排序", "解释性"],
    aspect=0.88,
    options=[
        {"id": "values", "type": "bool", "default": True, "label_zh": "数值标签", "label_en": "Value labels"},
        {"id": "ci", "type": "bool", "default": True, "label_zh": "95% 置信区间", "label_en": "95% CI"},
    ],
    demo={
        "data": {
            "sample": "ml_features",
            "mapping": {"x": "feature", "y": "importance", "low": "ci_low", "high": "ci_high"},
        },
        "style": {"domain": "ml", "journal": "neurips"},
        "labels": {"x": "Permutation importance (mean $\\Delta$ accuracy)", "y": ""},
    },
    aliases=["importance", "feature_importance_plot"],
)
def render_feature_importance(ctx):
    ax = ctx.ax()
    data = ctx.table
    mapping = _mapping(ctx)
    feature_name = _column(data, [mapping.get("x"), "feature"], numeric=False)
    value_name = _column(data, [mapping.get("y"), mapping.get("value"), "importance"], numeric=True)
    low_name = _column(data, [mapping.get("low"), "ci_low", "lower"], numeric=True)
    high_name = _column(data, [mapping.get("high"), "ci_high", "upper"], numeric=True)
    error_name = _column(data, [mapping.get("yerr"), "error", "sd"], numeric=True)
    if feature_name is None or value_name is None:
        raise SpecError('feature importance needs a label column and a numeric importance column', "invalid_mapping", "mapping")
    values = data.numeric(value_name)
    if low_name is not None and high_name is not None:
        low = data.numeric(low_name)
        high = data.numeric(high_name)
        lower_error = np.clip(values - low, 0, None)
        upper_error = np.clip(high - values, 0, None)
    elif error_name is not None:
        error = data.numeric(error_name)
        lower_error = upper_error = error
    else:
        lower_error = upper_error = None
    names = [str(value) for value in data.categorical(feature_name)]
    keep = np.isfinite(values) & np.isfinite(lower_error if lower_error is not None else values)
    names = [name for name, ok in zip(names, keep) if ok]
    values = values[keep]
    if lower_error is not None:
        lower_error = lower_error[keep]
        upper_error = upper_error[keep]
    if values.size == 0:
        raise SpecError("no finite importance values", "invalid_data")
    order = np.argsort(values)  # smallest at the bottom
    positions = np.arange(values.size, dtype=float)
    colour = ctx.color(0)
    dark = _dark(ctx)
    lw = _lw(ctx)
    ax.barh(positions, values[order], height=0.66, color=colour, edgecolor="white", linewidth=0.4, zorder=2)
    if ctx.flag("ci", True) and lower_error is not None:
        ax.errorbar(
            values[order], positions,
            xerr=[lower_error[order], upper_error[order]], fmt="none",
            ecolor=dark, elinewidth=ctx.style["errorbar"]["elinewidth"], capsize=ctx.style["errorbar"]["capsize"],
            capthick=ctx.style["errorbar"]["capthick"], zorder=3,
        )
    ax.set_yticks(positions)
    ax.set_yticklabels([names[index] for index in order])
    ax.set_ylim(-0.6, values.size - 0.4)
    if lower_error is not None:
        high = np.asarray(values + upper_error, dtype=float)
        limit = float(np.max(high)) if high.size else float(np.max(values))
    else:
        limit = float(np.max(values))
    limit = limit if limit > 0 else 1.0
    if ctx.flag("values", True):
        offset = limit * 0.012
        for position, index in zip(positions, order):
            reference = float((values + (upper_error if upper_error is not None else 0))[index])
            ax.annotate(
                f"{values[index]:.3f}", xy=(reference, position), xytext=(4, 0),
                textcoords="offset points", va="center", ha="left",
                fontsize=_font(ctx, "xtick.labelsize") - 0.4, color=dark,
            )
        limit = limit * 1.16 + offset
    ax.set_xlim(0.0, limit)
    H.corner_note(
        ax, "Error bars: 95% CI" if ctx.flag("ci", True) and lower_error is not None else f"$n$ = {values.size} features",
        loc="lower right", fontsize=_font(ctx, "legend.fontsize"),
    )
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", "Importance"), ylabel=_axis_label(ctx, "y", ""), legend=False)
    return ctx.fig


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

@register(
    "embedding",
    zh="嵌入散点图",
    en="Embedding scatter",
    category="ml",
    summary_zh="降维/潜在空间二维嵌入：按类别着色散点、图例、轴标签与样本量注释（如 t-SNE 1/2）。",
    summary_en="Two-dimensional latent-space embedding coloured by class with legend, axis labels and n.",
    tags=["t-SNE", "UMAP", "latent space", "降维"],
    aspect=0.95,
    options=[
        {"id": "alpha", "type": "float", "default": 0.72, "min": 0.1, "max": 1.0, "step": 0.02, "label_zh": "点透明度", "label_en": "Point opacity"},
        {"id": "point_size", "type": "float", "default": 0.8, "min": 0.1, "max": 3.0, "step": 0.1, "label_zh": "点大小倍数", "label_en": "Point size"},
    ],
    demo={
        "data": {"sample": "ml_embedding", "mapping": {"x": "x", "y": "y", "group": "cluster"}},
        "style": {"domain": "ml", "journal": "neurips"},
        "labels": {"x": "t-SNE 1", "y": "t-SNE 2", "legend": "Tissue class"},
    },
    aliases=["embedding_plot", "latent_space"],
)
def render_embedding(ctx):
    ax = ctx.ax()
    data = ctx.table
    mapping = _mapping(ctx)
    x_name = _column(data, [mapping.get("x"), "x"], numeric=True)
    y_name = _column(data, [mapping.get("y"), "y"], numeric=True)
    if x_name is None or y_name is None:
        raise SpecError('the embedding needs numeric "x" and "y" columns', "invalid_mapping", "mapping")
    x = data.numeric(x_name)
    y = data.numeric(y_name)
    group_name = _column(data, [mapping.get("group"), "cluster", "label"], numeric=False)
    alpha = float(ctx.num("alpha", 0.72))
    scale = float(ctx.num("point_size", 0.8))
    if isinstance(group_name, str) and data.has(group_name):
        labels = [str(value) for value in data.categorical(group_name)]
        levels = data.unique(group_name)
        for index, level in enumerate(levels):
            mask = np.asarray([label == str(level) for label in labels], dtype=bool)
            xx, yy = H.clean_xy(x[mask], y[mask])
            if xx.size == 0:
                continue
            ax.scatter(
                xx, yy, s=_ms(ctx) ** 2 * scale, color=ctx.color(index), alpha=alpha,
                edgecolors="white", linewidths=0.22, label=_legend_label(level), zorder=3,
            )
    else:
        xx, yy = H.clean_xy(x, y)
        ax.scatter(xx, yy, s=_ms(ctx) ** 2 * scale, color=ctx.color(0), alpha=alpha,
                   edgecolors="white", linewidths=0.22, zorder=3)
    total = int(np.isfinite(x).sum() if np.isfinite(x).any() else 0)
    H.corner_note(ax, f"$n$ = {total:,}", loc="lower left", fontsize=_font(ctx, "legend.fontsize"))
    legend = False
    if isinstance(group_name, str):
        legend = {
            "title": ctx.label("legend") or None,
            "ncol": 1 if len(data.unique(group_name)) <= 4 else 2,
            "loc": "lower right",
        }
    ctx.finish(ax, xlabel=_axis_label(ctx, "x", "Dimension 1"), ylabel=_axis_label(ctx, "y", "Dimension 2"), legend=legend)
    return ctx.fig
