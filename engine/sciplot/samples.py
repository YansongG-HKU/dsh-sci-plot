"""Sample datasets shipped with dsh-sci-plot.

Each sample is a ``<id>.csv`` plus an optional ``<id>.json`` sidecar with
localised metadata, a default mapping and recommended (kind, style) recipes.
Renderers' demos and the panel's data tab both read from here.
"""
from __future__ import annotations

import csv
import json
import os
from pathlib import Path

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "samples"

_NUMERIC = "numeric"


def _read_json(path: Path) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _read_csv(path: Path):
    with open(path, "r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = [dict(row) for row in reader]
    return fieldnames, rows


def _coerce_columns(fieldnames: list[str], rows: list[dict]) -> tuple[dict, list[dict]]:
    columns: dict[str, list] = {}
    for name in fieldnames:
        values = [row.get(name) for row in rows]
        numeric = []
        ok = 0
        for value in values:
            try:
                number = float(str(value).strip())
                numeric.append(number)
                ok += 1
            except (TypeError, ValueError):
                numeric.append(None)
        if values and ok / max(len(values), 1) >= 0.85:
            columns[name] = {"values": numeric, "kind": _NUMERIC}
        else:
            columns[name] = {"values": ["" if value is None else str(value) for value in values], "kind": "categorical"}
    return columns, rows


def list_samples() -> list[dict]:
    if not SAMPLES_DIR.is_dir():
        return []
    samples = []
    for path in sorted(SAMPLES_DIR.glob("*.csv")):
        sample_id = path.stem
        meta = _read_json(path.with_suffix(".json"))
        try:
            fieldnames, rows = _read_csv(path)
        except Exception:
            continue
        columns, _ = _coerce_columns(fieldnames, rows)
        samples.append(
            {
                "id": sample_id,
                "name_zh": meta.get("name_zh") or sample_id,
                "name_en": meta.get("name_en") or sample_id,
                "domain": meta.get("domain") or "general",
                "description_zh": meta.get("description_zh") or "",
                "description_en": meta.get("description_en") or "",
                "columns": [
                    {"name": name, "kind": info["kind"], "levels": _levels(info["values"]) if info["kind"] != _NUMERIC else None}
                    for name, info in columns.items()
                ],
                "rows": len(rows),
                "mapping": meta.get("mapping") or {},
                "recommended": meta.get("recommended") or [],
                "source": meta.get("source") or "synthetic",
                "file": str(path),
            }
        )
    return samples


def _levels(values) -> int:
    seen = set()
    for value in values:
        seen.add(value)
    return len(seen)


def get_sample(sample_id: str) -> dict | None:
    for sample in list_samples():
        if sample["id"] == sample_id:
            return sample
    return None


def load_sample_data(sample_id: str) -> dict:
    """Return a ``data`` object (rows + columns + mapping) for a sample id."""
    sample = get_sample(sample_id)
    if sample is None:
        raise KeyError(sample_id)
    fieldnames, rows = _read_csv(Path(sample["file"]))
    data = {
        "rows": rows,
        "columns": fieldnames,
        "mapping": dict(sample.get("mapping") or {}),
        "meta": {"sample": sample_id, "name_zh": sample["name_zh"], "name_en": sample["name_en"], "domain": sample["domain"]},
    }
    return data


def resolve_data(raw_data: dict) -> dict:
    """Expand ``{"sample": id, ...}`` into a real rows/columns/matrix object."""
    if not isinstance(raw_data, dict):
        return raw_data
    sample_id = raw_data.get("sample")
    if not isinstance(sample_id, str) or not sample_id:
        return raw_data
    resolved = load_sample_data(sample_id)
    if isinstance(raw_data.get("mapping"), dict) and raw_data["mapping"]:
        resolved["mapping"] = dict(raw_data["mapping"])
    for key in ("matrix", "series"):
        if key in raw_data:
            resolved[key] = raw_data[key]
    return resolved


def preview_rows(sample_id: str, limit: int = 12) -> dict:
    sample = get_sample(sample_id)
    if sample is None:
        raise KeyError(sample_id)
    _fieldnames, rows = _read_csv(Path(sample["file"]))
    return {"columns": list(rows[0].keys()) if rows else [], "rows": rows[: max(1, int(limit))], "total": len(rows)}


def csv_path(sample_id: str) -> str:
    sample = get_sample(sample_id)
    if sample is None:
        raise KeyError(sample_id)
    return sample["file"]
