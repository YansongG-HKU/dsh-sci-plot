"""Composite layout family: ``multi_panel`` figures made of simple sub-plots.

The panel protocol lives here (the renderer is self-contained and never calls back
into the registry)::

    data.layout = {"ncols": 2}
    data.panels = [
        {"label": "A", "kind": "line", "data": {"sample": "growth", "mapping": {...}},
         "labels": {"x": "...", "y": "...", "title": "..."}, "options": {...}},
        ...
    ]

Supported panel kinds: ``line``, ``scatter``, ``bar``, ``box``, ``heatmap``.
"""
from __future__ import annotations

import math
import textwrap

import numpy as np
from matplotlib.patches import Rectangle

from .. import helpers as H
from .. import samples as sample_store
from ..registry import register
from ..spec import SpecError, load_data

PANEL_KINDS = ("line", "scatter", "bar", "box", "heatmap")


# ---------------------------------------------------------------------------
# Panel data plumbing
# ---------------------------------------------------------------------------

def _panel_data(panel: dict):
    """Return ``("series", data)`` or ``("table", Data)`` for one panel."""
    raw = panel.get("data") if isinstance(panel.get("data"), dict) else panel
    if not isinstance(raw, dict):
        raise SpecError("each panel needs a data object", "invalid_data", "panels")
    if isinstance(raw.get("sample"), str):
        try:
            raw = sample_store.resolve_data(raw)
        except KeyError as error:
            raise SpecError(f"unknown panel sample dataset: {error}", "invalid_data", "panels") from error
    if isinstance(raw.get("series"), list):
        if not raw["series"]:
            raise SpecError("a panel series list is empty", "invalid_data", "panels")
        return "series", raw
    return "table", load_data(raw)


def _panel_series(mode: str, payload, mapping: dict | None = None):
    if mode == "series":
        items = []
        for index, item in enumerate(payload.get("series") or []):
            if not isinstance(item, dict):
                continue
            y = np.asarray(item.get("y", item.get("values", [])), dtype=float)
            x_raw = item.get("x")
            x = np.asarray(x_raw, dtype=float) if x_raw is not None else np.arange(y.size, dtype=float)
            n = min(x.size, y.size)
            out = {"name": str(item.get("name") or f"Series {index + 1}"), "x": x[:n], "y": y[:n]}
            if item.get("xerr") is not None:
                out["xerr"] = np.asarray(item["xerr"], dtype=float)[:n]
            if item.get("point_labels") is not None:
                out["point_labels"] = [str(value) for value in item["point_labels"]]
            items.append(out)
        return items
    try:
        return payload.build_series(mapping or payload.mapping or {})
    except Exception as error:  # noqa: BLE001 - surface a clean render error
        raise SpecError(f"could not build panel series: {error}", "invalid_mapping", "panels") from error


def _mapping_of(mode: str, payload) -> dict:
    if mode == "series":
        return {}
    return dict(getattr(payload, "mapping", {}) or {})


def _column_label(mapping: dict, key: str, fallback: str) -> str:
    name = mapping.get(key)
    return str(name) if isinstance(name, str) and name else fallback


def _panel_categories(items: list[dict]) -> list[str] | None:
    for item in items:
        for key in ("categories", "x_labels", "point_labels"):
            values = item.get(key)
            if values is not None:
                return [str(value) for value in values]
    return None


def _rotate_for(labels: list[str]) -> int:
    if not labels:
        return 0
    longest = max(len(str(label)) for label in labels)
    return 30 if longest > 9 else 0


def _apply_category_axis(ax, categories: list[str], rotate: int | None = None):
    positions = np.arange(len(categories), dtype=float)
    ax.set_xticks(positions)
    ax.set_xticklabels(categories)
    rotation = _rotate_for(categories) if rotate is None else int(rotate)
    if rotation:
        ax.tick_params(axis="x", labelrotation=rotation)
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")


def _panel_matrix(mode: str, payload, mapping: dict):
    """Matrix + row/col labels for a heatmap panel."""
    if mode == "table":
        row_name = mapping.get("row")
        col_name = mapping.get("col")
        value_name = mapping.get("value")
        if isinstance(row_name, str) and isinstance(col_name, str) and isinstance(value_name, str) and payload.has(row_name) and payload.has(col_name):
            rows = payload.categorical(row_name)
            cols = payload.categorical(col_name)
            values = payload.numeric(value_name)
            row_levels = list(dict.fromkeys(str(value) for value in rows))
            col_levels = list(dict.fromkeys(str(value) for value in cols))
            row_index = {name: index for index, name in enumerate(row_levels)}
            col_index = {name: index for index, name in enumerate(col_levels)}
            matrix = np.full((len(row_levels), len(col_levels)), np.nan)
            for row_value, col_value, value in zip(rows, cols, values):
                matrix[row_index[str(row_value)], col_index[str(col_value)]] = value
            matrix = np.nan_to_num(matrix, nan=0.0)
            return matrix, row_levels, col_levels
        if payload.mode == "matrix" and payload.matrix is not None:
            matrix = np.asarray(payload.matrix, dtype=float)
            return matrix, list(payload.row_labels or []), list(payload.col_labels or [])
    else:
        matrix = payload.get("matrix")
        if isinstance(matrix, list):
            values = np.asarray([[float(value) for value in row] for row in matrix], dtype=float)
            rows = payload.get("rows") or payload.get("row_labels") or [f"R{index + 1}" for index in range(values.shape[0])]
            cols = payload.get("columns") or payload.get("col_labels") or [f"C{index + 1}" for index in range(values.shape[1])]
            return values, [str(value) for value in rows], [str(value) for value in cols]
    raise SpecError('a heatmap panel needs row/col/value mappings or a matrix', "invalid_mapping", "panels")


# ---------------------------------------------------------------------------
# Panel painters
# ---------------------------------------------------------------------------

def _draw_line(ctx, ax, mode, payload, mapping, labels, options):
    items = _panel_series(mode, payload, mapping)
    markers = options.get("markers", True)
    for index, item in enumerate(items):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = ctx.color(index)
        ax.plot(
            x,
            y,
            color=colour,
            lw=float(ctx.style["line"]["lw"]),
            marker=("o" if markers else None),
            ms=float(ctx.style["line"]["ms"]) * 0.85,
            mfc=colour,
            mec="white",
            mew=0.35,
            label=item.get("name"),
            zorder=3,
        )
    ax.set_xlabel(labels.get("x") or _column_label(mapping, "x", ""))
    ax.set_ylabel(labels.get("y") or _column_label(mapping, "y", ""))
    if len(items) > 1:
        ctx.legend(ax, loc="best", frameon=True, facecolor="#ffffff", edgecolor="none", framealpha=0.85)


def _draw_scatter(ctx, ax, mode, payload, mapping, labels, options):
    items = _panel_series(mode, payload, mapping)
    alpha = float(options.get("alpha", 0.82))
    size = float(options.get("point_size", float(ctx.style["line"]["ms"]) ** 2 * 1.4))
    for index, item in enumerate(items):
        x, y = H.clean_xy(item["x"], item["y"])
        colour = ctx.color(index)
        ax.scatter(x, y, s=size, color=colour, alpha=alpha, edgecolors="white", linewidths=0.25, label=item.get("name"), zorder=3)
        yerr = item.get("yerr")
        if yerr is not None:
            mask = np.isfinite(x) & np.isfinite(y)
            ax.errorbar(x[mask], y[mask], yerr=np.asarray(yerr, dtype=float)[: x.size][mask], fmt="none", ecolor=colour, elinewidth=float(ctx.style["errorbar"]["elinewidth"]), capsize=float(ctx.style["errorbar"]["capsize"]), alpha=0.7, zorder=2)
    ax.set_xlabel(labels.get("x") or _column_label(mapping, "x", ""))
    ax.set_ylabel(labels.get("y") or _column_label(mapping, "y", ""))
    if len(items) > 1:
        ctx.legend(ax, loc="best", frameon=True, facecolor="#ffffff", edgecolor="none", framealpha=0.85)


def _draw_bar(ctx, ax, mode, payload, mapping, labels, options):
    items = _panel_series(mode, payload, mapping)
    categories = _panel_categories(items) or [str(value) for value in range(len(items[0]["y"]))]
    positions = np.arange(len(categories), dtype=float)
    show_error = options.get("yerr", True)
    if len(items) == 1:
        item = items[0]
        values = np.asarray(item["y"], dtype=float)[: len(categories)]
        ax.bar(positions, values, width=0.64, color=ctx.color(0), edgecolor="white", linewidth=0.4, zorder=3)
        yerr = item.get("yerr")
        if show_error and yerr is not None:
            ax.errorbar(positions, values, yerr=np.asarray(yerr, dtype=float)[: len(categories)], fmt="none", ecolor="#333333", elinewidth=float(ctx.style["errorbar"]["elinewidth"]), capsize=float(ctx.style["errorbar"]["capsize"]), capthick=float(ctx.style["errorbar"]["capthick"]), zorder=4)
        _apply_category_axis(ax, categories)
    else:
        group_width = 0.82
        bar_width = group_width / len(items)
        for index, item in enumerate(items):
            values = np.asarray(item["y"], dtype=float)[: len(categories)]
            offsets = positions - group_width / 2.0 + bar_width * (index + 0.5)
            colour = ctx.color(index)
            ax.bar(offsets, values, width=bar_width, color=colour, edgecolor="white", linewidth=0.35, label=item.get("name"), zorder=3)
            yerr = item.get("yerr")
            if show_error and yerr is not None:
                ax.errorbar(offsets, values, yerr=np.asarray(yerr, dtype=float)[: len(categories)], fmt="none", ecolor="#333333", elinewidth=float(ctx.style["errorbar"]["elinewidth"]), capsize=float(ctx.style["errorbar"]["capsize"]), capthick=float(ctx.style["errorbar"]["capthick"]), zorder=4)
        _apply_category_axis(ax, categories)
        ax.set_xlim(-0.6, len(categories) - 0.4)
        ctx.legend(ax, loc="lower right", bbox_to_anchor=(1.0, 1.005), ncol=len(items), frameon=False, borderaxespad=0.0, handlelength=1.0, handletextpad=0.4)
    ax.set_xlabel(labels.get("x") or "")
    ax.set_ylabel(labels.get("y") or _column_label(mapping, "y", ""))
    if np.all(np.asarray(items[0]["y"], dtype=float) >= 0):
        ax.set_ylim(bottom=0.0)


def _draw_box(ctx, ax, mode, payload, mapping, labels, options):
    if mode == "series":
        groups_raw = np.concatenate([np.full(len(np.asarray(item["y"], dtype=float)), str(item.get("name") or index)) for index, item in enumerate(payload.get("series") or [])])
        values = np.concatenate([np.asarray(item.get("y", []), dtype=float) for item in payload.get("series") or []])
    else:
        group_column = mapping.get("x")
        value_column = mapping.get("y")
        if not isinstance(group_column, str) or not isinstance(value_column, str) or not payload.has(group_column) or not payload.has(value_column):
            raise SpecError('a box panel needs "x" (group) and "y" (value) mappings', "invalid_mapping", "panels")
        groups_raw = payload.categorical(group_column)
        values = payload.numeric(value_column)
    levels = list(dict.fromkeys(str(value) for value in groups_raw))
    positions = np.arange(len(levels), dtype=float)
    colour = ctx.color(0)
    line_width = float(ctx.style["rc"].get("axes.linewidth", 0.6))
    for position, level in zip(positions, levels):
        selected = np.asarray([str(value) == level for value in groups_raw]) & np.isfinite(values)
        sample_values = values[selected]
        if sample_values.size == 0:
            continue
        q1, median, q3 = np.percentile(sample_values, [25.0, 50.0, 75.0])
        iqr = q3 - q1
        low_gate = q1 - 1.5 * iqr
        high_gate = q3 + 1.5 * iqr
        inside = sample_values[(sample_values >= low_gate) & (sample_values <= high_gate)]
        low, high = (float(np.min(inside)), float(np.max(inside))) if inside.size else (float(q1), float(q3))
        ax.add_patch(Rectangle((position - 0.27, q1), 0.54, max(q3 - q1, 1e-9), facecolor=colour, alpha=0.55, edgecolor=colour, linewidth=line_width, zorder=3))
        ax.plot([position, position], [high, q3], color=colour, lw=line_width, zorder=4)
        ax.plot([position, position], [q1, low], color=colour, lw=line_width, zorder=4)
        ax.plot([position - 0.18, position + 0.18], [high, high], color=colour, lw=line_width, zorder=4)
        ax.plot([position - 0.18, position + 0.18], [low, low], color=colour, lw=line_width, zorder=4)
        ax.plot([position - 0.27, position + 0.27], [median, median], color="#222222", lw=line_width, zorder=5)
        spread = H.jitter(ctx.rng, sample_values.size, width=0.13)
        ax.scatter(position + spread, sample_values, s=float(ctx.style["line"]["ms"]) ** 2 * 0.7, color=colour, alpha=0.45, linewidths=0, zorder=2)
    rotation = _rotate_for(levels)
    if rotation == 0 and len(levels) >= 4 and max(len(str(level)) for level in levels) > 6:
        rotation = 30
    _apply_category_axis(ax, levels, rotate=rotation)
    ax.set_xlabel(labels.get("x") or "")
    ax.set_ylabel(labels.get("y") or _column_label(mapping, "y", ""))
    ax.set_xlim(-0.6, len(levels) - 0.4)


def _draw_heatmap(ctx, ax, mode, payload, mapping, labels, options):
    matrix, row_labels, col_labels = _panel_matrix(mode, payload, mapping)
    if matrix.size == 0:
        raise SpecError("the heatmap panel matrix is empty", "invalid_data", "panels")
    if not row_labels:
        row_labels = [f"R{index + 1}" for index in range(matrix.shape[0])]
    if not col_labels:
        col_labels = [f"C{index + 1}" for index in range(matrix.shape[1])]
    centered = float(np.nanmin(matrix)) < 0.0 < float(np.nanmax(matrix))
    if centered:
        vmax = float(np.nanmax(np.abs(matrix))) or 1.0
        colour_map = ctx.diverging_cmap()
        vmin = -vmax
    else:
        vmin, vmax = float(np.nanmin(matrix)), float(np.nanmax(matrix))
        if vmax == vmin:
            vmax = vmin + 1.0
        colour_map = ctx.cmap()
    image = ax.pcolormesh(
        np.arange(matrix.shape[1] + 1) - 0.5,
        np.arange(matrix.shape[0] + 1) - 0.5,
        matrix,
        cmap=colour_map,
        vmin=vmin,
        vmax=vmax,
        shading="flat",
        rasterized=True,
    )
    ax.set_xlim(-0.5, matrix.shape[1] - 0.5)
    ax.set_ylim(matrix.shape[0] - 0.5, -0.5)
    ax.set_yticks(np.arange(matrix.shape[0]))
    ax.set_yticklabels(row_labels, fontsize=float(ctx.style["rc"].get("ytick.labelsize", 6.5)) - 0.5)
    ax.set_xticks(np.arange(matrix.shape[1]))
    ax.set_xticklabels(col_labels, fontsize=float(ctx.style["rc"].get("xtick.labelsize", 6.5)) - 0.5)
    if any(len(str(label)) > 4 for label in col_labels):
        ax.tick_params(axis="x", labelrotation=90)
    ax.tick_params(axis="both", length=0.0)
    ax.set_xlabel(labels.get("x") or _column_label(mapping, "col", "Column"))
    ax.set_ylabel(labels.get("y") or _column_label(mapping, "row", "Row"))
    ctx.colorbar(image, ax=ax, label=labels.get("colorbar") or "Value", fraction=0.05, pad=0.03)


PAINTERS = {
    "line": _draw_line,
    "scatter": _draw_scatter,
    "bar": _draw_bar,
    "box": _draw_box,
    "heatmap": _draw_heatmap,
}


# ---------------------------------------------------------------------------
# multi_panel
# ---------------------------------------------------------------------------

@register(
    "multi_panel",
    zh="多面板复合图",
    en="Multi-panel figure",
    category="composite",
    summary_zh="按 ncols 网格排布 A/B/C 子图：每格可选 line / scatter / bar / box / heatmap，自带粗体面板编号与独立标签。",
    summary_en="Grid of lettered panels built from line/scatter/bar/box/heatmap specs with per-panel data, labels and bold panel letters.",
    tags=["复合图", "多面板", "figure assembly", "panels"],
    aspect=1.16,
    options=[
        {"id": "ncols", "type": "int", "default": 2, "min": 1, "max": 4, "label_zh": "列数", "label_en": "Columns"},
        {"id": "titles", "type": "bool", "default": True, "label_zh": "显示面板标题", "label_en": "Panel titles"},
        {"id": "panel_letters", "type": "bool", "default": True, "label_zh": "显示 A/B/C 编号", "label_en": "Panel letters"},
    ],
    demo={
        "data": {
            "panels": [
                {
                    "label": "A",
                    "kind": "line",
                    "data": {"sample": "growth"},
                    "labels": {"x": "Time (h)", "y": "OD$_{600}$", "title": "Growth"},
                },
                {
                    "label": "B",
                    "kind": "scatter",
                    "data": {"sample": "scatter"},
                    "labels": {"x": "Expression (log$_2$ TPM)", "y": "Protein (log$_2$)", "title": "Gene vs protein"},
                },
                {
                    "label": "C",
                    "kind": "bar",
                    "data": {"sample": "bars"},
                    "labels": {"x": "", "y": "Relative viability (%)", "title": "Viability"},
                },
                {
                    "label": "D",
                    "kind": "box",
                    "data": {"sample": "distributions"},
                    "labels": {"x": "", "y": "Effect size (score)", "title": "Cohorts"},
                },
                {
                    "label": "E",
                    "kind": "heatmap",
                    "data": {"sample": "matrix_heatmap"},
                    "labels": {"x": "Sample", "y": "Gene", "colorbar": "z-score", "title": "Expression"},
                },
                {
                    "label": "F",
                    "kind": "bar",
                    "data": {"sample": "bars_grouped"},
                    "labels": {"x": "", "y": "Relative viability (%)", "title": "By sex"},
                },
            ],
            "layout": {"ncols": 2},
            "matrix": [[0.0]],
            "rows": ["placeholder"],
            "columns": ["placeholder"],
        },
        "style": {"domain": "life-science", "journal": "nature", "palette": "jama"},
        "labels": {},
    },
)
def render_multi_panel(ctx):
    data = ctx.spec.get("data") if isinstance(ctx.spec.get("data"), dict) else {}
    panels = data.get("panels")
    if not isinstance(panels, list) or not panels:
        top = ctx.spec.get("panels")
        panels = top if isinstance(top, list) else []
    if not panels:
        raise SpecError('multi_panel needs data.panels = [{label, kind, data, labels}, ...]', "invalid_data", "panels")
    layout = data.get("layout") if isinstance(data.get("layout"), dict) else {}
    ncols = int(layout.get("ncols") or ctx.num("ncols", 2))
    ncols = max(1, min(4, ncols))
    nrows = max(1, int(math.ceil(len(panels) / float(ncols))))
    created = ctx.figure(nrows, ncols)
    fig = created[0]
    axes = created[1]
    if not isinstance(axes, (list, tuple)):
        axes = [axes]
    axis_list = list(axes)
    show_titles = ctx.flag("titles", True)
    show_letters = ctx.flag("panel_letters", True)
    for index, panel in enumerate(panels):
        if index >= len(axis_list):
            break
        if not isinstance(panel, dict):
            continue
        ax = axis_list[index]
        kind = str(panel.get("kind") or "line").strip().lower()
        labels = panel.get("labels") if isinstance(panel.get("labels"), dict) else {}
        options = panel.get("options") if isinstance(panel.get("options"), dict) else {}
        mode, payload = _panel_data(panel)
        mapping = _mapping_of(mode, payload)
        painter = PAINTERS.get(kind)
        if painter is None:
            ax.set_visible(False)
            ctx.warn(f"multi_panel: unsupported panel kind {kind!r} (supported: {', '.join(PANEL_KINDS)})")
            continue
        painter(ctx, ax, mode, payload, mapping, labels, options)
        title = labels.get("title")
        if show_titles and isinstance(title, str) and title.strip():
            ax.set_title(title.strip(), loc="left", fontsize=float(ctx.style["rc"].get("legend.fontsize", 6.5)), pad=2.0)
        ctx.style_axes(ax)
        if kind == "heatmap":
            ax.tick_params(axis="both", length=0.0)
        letter = str(panel.get("label") or chr(ord("A") + index))
        if show_letters:
            ctx.panel_label(ax, letter)
    for extra in axis_list[len(panels):]:
        extra.set_visible(False)
    ctx.add_title()
    return fig
