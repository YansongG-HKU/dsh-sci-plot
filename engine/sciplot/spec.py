"""Spec normalisation, tabular data loading and mapping extraction.

A figure spec is the single contract shared by the agent tools, the panel and
the Python renderers::

    {
      "kind": "line",
      "data": { "series": [...] }            # inline series
           |  { "rows": [...], "columns": [...], "mapping": {...} }
           |  { "matrix": [[...]], "rows": [...], "columns": [...] },
      "style": { "domain": "life-science", "journal": "nature", "palette": "okabe-ito",
                 "size": "single", "dpi": 300, ... },
      "labels": { "x": "Time (h)", "y": "Signal (a.u.)", "title": "...", "legend": "..." },
      "options": { "xscale": "log", "bins": 40, ... },
      "output": { "formats": ["png", "svg", "pdf"], "basename": "figure1" }
    }
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np


class SpecError(Exception):
    """A user-fixable spec problem with a stable machine code."""

    def __init__(self, message: str, code: str = "invalid_spec", field: str | None = None):
        super().__init__(message)
        self.code = code
        self.field = field


ALLOWED_FORMATS = ("png", "svg", "pdf", "eps", "tiff", "jpg")


def _is_number(value) -> bool:
    if isinstance(value, (int, float, np.integer, np.floating)) and not isinstance(value, bool):
        return True
    return False


def _to_float(value) -> float:
    if value is None:
        return math.nan
    if _is_number(value):
        return float(value)
    if isinstance(value, str):
        text = value.strip().replace(",", "").replace("−", "-")
        if text == "" or text.lower() in ("na", "nan", "null", "none", "-"):
            return math.nan
        try:
            return float(text)
        except ValueError:
            return math.nan
    try:
        return float(value)
    except (TypeError, ValueError):
        return math.nan


def _numeric_array(values) -> np.ndarray:
    return np.asarray([_to_float(v) for v in values], dtype=float)


def _string_array(values) -> np.ndarray:
    return np.asarray(["" if v is None else str(v) for v in values], dtype=object)


def normalize_spec(raw) -> dict:
    """Validate the outer shape and return a normalised spec dict."""
    if not isinstance(raw, dict):
        raise SpecError("the figure spec must be a JSON object", "invalid_spec")
    kind = raw.get("kind")
    if not isinstance(kind, str) or not kind.strip():
        raise SpecError('the spec needs a "kind" such as "line" or "bar"', "invalid_spec", "kind")
    kind = kind.strip().lower().replace(" ", "_")

    data = raw.get("data")
    if data is None:
        raise SpecError('the spec needs "data" (series, rows or matrix)', "invalid_data", "data")
    if not isinstance(data, dict):
        raise SpecError('"data" must be an object', "invalid_data", "data")

    style = raw.get("style") if isinstance(raw.get("style"), dict) else {}
    labels = raw.get("labels") if isinstance(raw.get("labels"), dict) else {}
    options = raw.get("options") if isinstance(raw.get("options"), dict) else {}
    output = raw.get("output") if isinstance(raw.get("output"), dict) else {}

    formats = output.get("formats") or ["png", "svg", "pdf"]
    if isinstance(formats, str):
        formats = [part.strip().lower() for part in formats.split(",") if part.strip()]
    formats = [str(item).lower() for item in formats if str(item).lower() in ALLOWED_FORMATS] or ["png", "svg", "pdf"]

    title = raw.get("title") if isinstance(raw.get("title"), str) else labels.get("title")
    subtitle = raw.get("subtitle") if isinstance(raw.get("subtitle"), str) else labels.get("subtitle")

    # Normalise labels.
    clean_labels = {}
    for key in ("x", "y", "y2", "z", "title", "subtitle", "legend", "colorbar", "caption", "x2"):
        value = labels.get(key)
        if value is None and key == "title":
            value = title
        if value is None and key == "subtitle":
            value = subtitle
        if isinstance(value, (int, float)) and key not in ("title", "subtitle"):
            value = str(value)
        if isinstance(value, str):
            clean_labels[key] = value
    if isinstance(title, str):
        clean_labels["title"] = title
    if isinstance(subtitle, str):
        clean_labels["subtitle"] = subtitle

    panels = raw.get("panels")
    if panels is not None and not isinstance(panels, list):
        raise SpecError('"panels" must be a list', "invalid_spec", "panels")

    return {
        "kind": kind,
        "data": data,
        "style": style,
        "labels": clean_labels,
        "options": options,
        "output": {
            "formats": formats,
            "basename": _safe_basename(output.get("basename") or raw.get("name") or kind),
            "transparent": bool(output.get("transparent", style.get("transparent", False))),
        },
        "panels": panels,
        "meta": {
            "title": title if isinstance(title, str) else "",
            "subtitle": subtitle if isinstance(subtitle, str) else "",
        },
    }


def _safe_basename(value) -> str:
    text = str(value or "figure").strip()
    keep = [ch if (ch.isalnum() or ch in "-_") else "-" for ch in text]
    cleaned = "".join(keep).strip("-") or "figure"
    return cleaned[:60]


# ---------------------------------------------------------------------------
# Data container
# ---------------------------------------------------------------------------

@dataclass
class Data:
    series: list[dict] = field(default_factory=list)
    columns: dict = field(default_factory=dict)
    column_order: list[str] = field(default_factory=list)
    rows: int = 0
    mapping: dict = field(default_factory=dict)
    matrix: np.ndarray | None = None
    row_labels: list | None = None
    col_labels: list | None = None
    mode: str = "series"
    meta: dict = field(default_factory=dict)

    # -- column access -----------------------------------------------------
    def has(self, name) -> bool:
        return isinstance(name, str) and name in self.columns

    def numeric(self, name) -> np.ndarray:
        if not self.has(name):
            raise SpecError(f'mapping references a column that does not exist: {name!r}', "invalid_mapping", "mapping")
        col = self.columns[name]
        arr = np.asarray(col, dtype=float)
        if np.all(np.isnan(arr)):
            arr = _numeric_array(list(col))
        return arr

    def categorical(self, name) -> np.ndarray:
        if not self.has(name):
            raise SpecError(f'mapping references a column that does not exist: {name!r}', "invalid_mapping", "mapping")
        col = self.columns[name]
        return np.asarray([str(v) for v in col], dtype=object)

    def unique(self, name) -> list:
        values = self.categorical(name)
        seen = []
        for value in values:
            if value not in seen:
                seen.append(value)
        return seen

    def indices_for(self, name, group) -> np.ndarray:
        values = self.categorical(name)
        return np.asarray([str(v) == str(group) for v in values], dtype=bool)

    def column_summary(self) -> list[dict]:
        rows = []
        for name in self.column_order:
            col = np.asarray(self.columns.get(name, []))
            numeric = np.asarray([_to_float(v) for v in col], dtype=float)
            numeric_ratio = float(np.mean(~np.isnan(numeric))) if len(numeric) else 0.0
            item = {
                "name": str(name),
                "kind": "numeric" if numeric_ratio >= 0.7 else "categorical",
                "missing": int(np.sum(np.isnan(numeric))) if numeric_ratio >= 0.7 else 0,
            }
            if item["kind"] == "numeric":
                finite = numeric[~np.isnan(numeric)]
                if finite.size:
                    item.update(
                        {
                            "min": round(float(np.min(finite)), 6),
                            "max": round(float(np.max(finite)), 6),
                            "mean": round(float(np.mean(finite)), 6),
                            "std": round(float(np.std(finite)), 6),
                        }
                    )
            else:
                uniques = self.unique(name)
                item["levels"] = len(uniques)
                item["sample"] = uniques[:8]
            rows.append(item)
        return rows

    # -- series builder ----------------------------------------------------
    def build_series(self, mapping: dict | None = None) -> list[dict]:
        """Turn a table + mapping into the generic series list.

        Supported mapping keys: ``x``, ``y`` (string or list), ``group``,
        ``yerr``, ``xerr``, ``label``. A list of ``y`` columns produces one
        series per column; a ``group`` column splits every y column by level.
        """
        if self.mode == "series":
            return list(self.series)
        mapping = mapping or self.mapping or {}
        if not isinstance(mapping, dict):
            raise SpecError('"mapping" must be an object', "invalid_mapping", "mapping")

        y_spec = mapping.get("y")
        y_names = [y_spec] if isinstance(y_spec, str) else list(y_spec or [])
        if not y_names:
            numeric_cols = [name for name in self.column_order if self._is_numeric_column(name)]
            if not numeric_cols:
                raise SpecError("no numeric column to plot; pass data.mapping.y", "invalid_mapping", "mapping")
            y_names = [numeric_cols[0]]
        x_name = mapping.get("x")
        if isinstance(x_name, (list, tuple)):
            x_name = x_name[0] if x_name else None
        group_name = mapping.get("group")
        yerr_name = mapping.get("yerr")
        xerr_name = mapping.get("xerr")
        label_name = mapping.get("label")

        base_x = self.numeric(x_name) if isinstance(x_name, str) and self._is_numeric_column(x_name) else np.arange(self.rows, dtype=float)
        categories = None
        if isinstance(x_name, str) and self.has(x_name) and not self._is_numeric_column(x_name):
            categories = self.categorical(x_name)
        groups = None
        if isinstance(group_name, str) and self.has(group_name):
            groups = self.categorical(group_name)
            group_levels = self.unique(group_name)
        else:
            group_levels = [None]

        out: list[dict] = []
        for y_name in y_names:
            y = self.numeric(y_name)
            for level in group_levels:
                mask = None if level is None else np.asarray([str(v) == str(level) for v in groups], dtype=bool)
                x = base_x if mask is None else base_x[mask]
                yy = y if mask is None else y[mask]
                single_y = len(y_names) == 1
                display = str(level) if (single_y and level is not None) else (str(y_name) if level is None else f"{y_name} — {level}")
                item = {
                    "name": display,
                    "x": np.asarray(x, dtype=float),
                    "y": np.asarray(yy, dtype=float),
                    "meta": {"y": str(y_name), "group": level},
                }
                if categories is not None:
                    item["categories"] = [str(v) for v in (categories if mask is None else categories[mask])]
                    item["x_labels"] = item["categories"]
                if isinstance(yerr_name, str) and self.has(yerr_name):
                    err = self.numeric(yerr_name)
                    item["yerr"] = np.asarray(err if mask is None else err[mask], dtype=float)
                if isinstance(xerr_name, str) and self.has(xerr_name):
                    err = self.numeric(xerr_name)
                    item["xerr"] = np.asarray(err if mask is None else err[mask], dtype=float)
                if isinstance(label_name, str) and self.has(label_name):
                    labels = self.categorical(label_name)
                    item["point_labels"] = [str(v) for v in (labels if mask is None else labels[mask])]
                out.append(item)
        return out

    def _is_numeric_column(self, name: str) -> bool:
        col = np.asarray(self.columns.get(name, []))
        if not len(col):
            return False
        numeric = np.asarray([_to_float(v) for v in col], dtype=float)
        return float(np.mean(~np.isnan(numeric))) >= 0.7


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def _coerce_series_item(item, index: int) -> dict:
    if not isinstance(item, dict):
        raise SpecError(f"data.series[{index}] must be an object", "invalid_data", "data.series")
    y = item.get("y", item.get("values"))
    if y is None and isinstance(item.get("data"), (list, tuple)):
        y = item["data"]
    if y is None:
        raise SpecError(f'data.series[{index}] needs "y" (and usually "x")', "invalid_data", "data.series")
    y_arr = _numeric_array(y)
    x_raw = item.get("x")
    x_arr = _numeric_array(x_raw) if x_raw is not None else np.arange(y_arr.size, dtype=float)
    if x_arr.size != y_arr.size:
        raise SpecError(f"data.series[{index}]: x and y have different lengths ({x_arr.size} vs {y_arr.size})", "invalid_data", "data.series")
    name = item.get("name") or item.get("label") or item.get("label_text") or f"series {index + 1}"
    out = {
        "name": str(name),
        "label": str(item.get("label") or name),
        "x": x_arr,
        "y": y_arr,
        "meta": item.get("meta") if isinstance(item.get("meta"), dict) else {},
    }
    for key in ("yerr", "xerr"):
        if item.get(key) is not None:
            err = _numeric_array(item[key])
            if err.size == 1:
                err = np.full(y_arr.size, float(err[0]))
            if err.size != y_arr.size:
                raise SpecError(f"data.series[{index}]: {key} length mismatch", "invalid_data", "data.series")
            out[key] = err
    if item.get("size") is not None:
        size = _numeric_array(item["size"])
        if size.size == 1:
            size = np.full(y_arr.size, float(size[0]))
        out["size"] = size
    if isinstance(item.get("color"), str):
        out["color"] = item["color"]
    if isinstance(item.get("marker"), str):
        out["marker"] = item["marker"]
    if isinstance(item.get("linestyle"), str):
        out["linestyle"] = item["linestyle"]
    if isinstance(item.get("categories"), (list, tuple)):
        out["categories"] = [str(v) for v in item["categories"]]
    if item.get("point_labels") is not None:
        out["point_labels"] = [str(v) for v in item["point_labels"]]
    if isinstance(item.get("filled"), bool):
        out["filled"] = item["filled"]
    return out


def load_data(spec_data: dict) -> Data:
    """Build a :class:`Data` from the normalised ``data`` object."""
    if not isinstance(spec_data, dict):
        raise SpecError('"data" must be an object', "invalid_data", "data")
    mapping = spec_data.get("mapping") if isinstance(spec_data.get("mapping"), dict) else {}

    # Matrix form (heatmaps, correlation matrices).
    if isinstance(spec_data.get("matrix"), list):
        matrix = np.asarray([[_to_float(v) for v in row] for row in spec_data["matrix"]], dtype=float)
        rows = spec_data.get("rows") or spec_data.get("row_labels")
        cols = spec_data.get("columns") or spec_data.get("col_labels")
        if rows is not None and not isinstance(rows, list):
            raise SpecError('data.rows for a matrix must be a list', "invalid_data", "data.rows")
        if cols is not None and not isinstance(cols, list):
            raise SpecError('data.columns for a matrix must be a list', "invalid_data", "data.columns")
        return Data(
            matrix=matrix,
            row_labels=[str(v) for v in rows] if rows else [str(i + 1) for i in range(matrix.shape[0])],
            col_labels=[str(v) for v in cols] if cols else [str(i + 1) for i in range(matrix.shape[1])],
            rows=int(matrix.shape[0]),
            mapping=mapping,
            mode="matrix",
            meta=spec_data.get("meta") if isinstance(spec_data.get("meta"), dict) else {},
        )

    # Inline series form.
    if isinstance(spec_data.get("series"), list):
        series = [_coerce_series_item(item, i) for i, item in enumerate(spec_data["series"])]
        if not series:
            raise SpecError("data.series is empty", "invalid_data", "data.series")
        return Data(series=series, rows=int(max(s["x"].size for s in series)), mapping=mapping, mode="series")

    # Tabular form.
    raw_rows = spec_data.get("rows")
    columns_in = spec_data.get("columns")
    if isinstance(columns_in, dict) and not isinstance(raw_rows, list):
        names = [str(name) for name in columns_in.keys()]
        length = max((len(v) for v in columns_in.values() if isinstance(v, (list, tuple, np.ndarray))), default=0)
        columns = {}
        for name in names:
            values = columns_in.get(name)
            if not isinstance(values, (list, tuple, np.ndarray)):
                values = [values] * length
            columns[name] = list(values)
        rows = length
        if rows == 0:
            raise SpecError("data.columns are empty", "invalid_data", "data.columns")
        return Data(columns=columns, column_order=names, rows=rows, mapping=mapping, mode="table", meta=spec_data.get("meta") or {})

    if isinstance(raw_rows, list):
        if not raw_rows:
            raise SpecError("data.rows is empty", "invalid_data", "data.rows")
        first = raw_rows[0]
        if isinstance(first, dict):
            names = []
            for row in raw_rows:
                if isinstance(row, dict):
                    for key in row.keys():
                        if str(key) not in names:
                            names.append(str(key))
            columns = {name: [row.get(name) for row in raw_rows if isinstance(row, dict)] for name in names}
        elif isinstance(first, (list, tuple)):
            names = [str(v) for v in (spec_data.get("columns") if isinstance(spec_data.get("columns"), list) else [])]
            if not names:
                names = [f"col{i + 1}" for i in range(len(first))]
            columns = {name: [] for name in names}
            for row in raw_rows:
                if not isinstance(row, (list, tuple)):
                    continue
                for i, name in enumerate(names):
                    columns[name].append(row[i] if i < len(row) else None)
        else:
            raise SpecError("data.rows must contain objects or arrays", "invalid_data", "data.rows")
        rows = len(raw_rows)
        return Data(columns=columns, column_order=list(columns.keys()), rows=rows, mapping=mapping, mode="table", meta=spec_data.get("meta") or {})

    raise SpecError('data needs "series", "rows" or "matrix"', "invalid_data", "data")


# ---------------------------------------------------------------------------
# Small helpers used by renderers
# ---------------------------------------------------------------------------

def clean_xy(x, y) -> tuple[np.ndarray, np.ndarray]:
    """Drop non-finite pairs, keeping order."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    n = min(x.size, y.size)
    x, y = x[:n], y[:n]
    mask = np.isfinite(x) & np.isfinite(y)
    return x[mask], y[mask]


def finite(values) -> np.ndarray:
    arr = np.asarray(values, dtype=float)
    return arr[np.isfinite(arr)]


def option(options: dict, key: str, default=None):
    value = options.get(key)
    return default if value is None else value


def as_bool(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if value.lower() in ("true", "1", "yes", "on"):
            return True
        if value.lower() in ("false", "0", "no", "off"):
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def as_float(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
