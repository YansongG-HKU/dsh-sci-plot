"""Command line entry point of the dsh-sci-plot rendering engine.

All commands print exactly one JSON object on stdout so the Node host can parse
the result without scraping logs::

    python -m sciplot.cli render --spec figure.json --out-dir /path/to/fig
    python -m sciplot.cli capabilities
    python -m sciplot.cli probe
    python -m sciplot.cli selftest --out-dir /tmp/selftest
    python -m sciplot.cli gallery --catalog demo.json --out-dir gallery
    python -m sciplot.cli sample --list
    python -m sciplot.cli validate --spec figure.json
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import platform
import sys
import tempfile
import time
import traceback
import warnings
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib as mpl  # noqa: E402
import numpy as np  # noqa: E402

from . import __version__, samples  # noqa: E402
from .context import Ctx  # noqa: E402
from .export import export_figure  # noqa: E402
from .palettes import list_categorical, list_continuous  # noqa: E402
from .quality import evaluate as evaluate_quality  # noqa: E402
from .registry import catalog as kinds_catalog, get as get_renderer, load as load_renderers, KINDS  # noqa: E402
from .spec import ALLOWED_FORMATS, SpecError, load_data, normalize_spec  # noqa: E402
from .themes import catalog as themes_catalog, resolve_style  # noqa: E402

VERSION = __version__


def _engine_info() -> dict:
    return {
        "engine": "dsh-sci-plot",
        "version": VERSION,
        "python": platform.python_version(),
        "executable": sys.executable,
        "matplotlib": mpl.__version__,
        "numpy": np.__version__,
        "platform": platform.platform(),
    }


def _json_print(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False, default=_json_default))
    sys.stdout.write("\n")


def _json_default(value):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, Path):
        return str(value)
    return str(value)


def _failure(error: Exception, code: str = "render_failed") -> dict:
    payload = {"ok": False, "code": getattr(error, "code", code), "error": str(error)}
    field = getattr(error, "field", None)
    if field:
        payload["field"] = field
    payload.update(_engine_info())
    return payload


def _base_rc(style: dict) -> dict:
    rc = dict(style.get("rc") or {})
    rc.update(
        {
            "pdf.fonttype": 42,
            "ps.fonttype": 42,
            "ps.useafm": False,
            "pdf.compression": 6,
            "svg.fonttype": "path",
            "svg.hashsalt": "dsh-sci-plot",
            "figure.constrained_layout.h_pad": 0.02,
            "figure.constrained_layout.w_pad": 0.02,
            "figure.constrained_layout.hspace": 0.02,
            "figure.constrained_layout.wspace": 0.02,
            "savefig.facecolor": style.get("figure_face", "#ffffff"),
        }
    )
    return rc


def _expand_data(spec_data: dict) -> dict:
    try:
        return samples.resolve_data(spec_data)
    except KeyError as error:
        raise SpecError(f"unknown sample dataset: {error}", "invalid_data", "data.sample") from error


def _prepare(raw_spec: dict) -> tuple[dict, dict, dict, object]:
    load_errors = load_renderers()
    spec = normalize_spec(raw_spec)
    renderer = get_renderer(spec["kind"])
    if renderer is None:
        suggestions = difflib.get_close_matches(spec["kind"], list(KINDS.keys()), n=3, cutoff=0.5)
        hint = f" Did you mean: {', '.join(suggestions)}?" if suggestions else ""
        raise SpecError(f"unknown chart kind {spec['kind']!r}.{hint} Call capabilities to list kinds.", "unknown_kind", "kind")
    spec["data"] = _expand_data(spec["data"])
    style = resolve_style(spec["style"], kind_aspect=renderer.aspect)
    data = load_data(spec["data"])
    if load_errors:
        style.setdefault("_load_errors", load_errors)
    return spec, style, data, renderer


def render_one(raw_spec: dict, out_dir: str, *, basename: str | None = None, extra_formats: list[str] | None = None) -> dict:
    started = time.time()
    spec, style, data, renderer = _prepare(raw_spec)
    formats = list(spec["output"]["formats"])
    if extra_formats:
        formats = list(dict.fromkeys(formats + [str(f).lower() for f in extra_formats]))
    os.makedirs(out_dir, exist_ok=True)
    basename = basename or spec["output"]["basename"]
    rc = _base_rc(style)
    warnings_list: list[str] = []
    fig = None
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        with mpl.rc_context(rc):
            ctx = Ctx(spec, style, data, renderer)
            ctx.used_colors.clear()
            try:
                result = renderer.fn(ctx)
            except SpecError:
                raise
            except Exception as error:  # noqa: BLE001 - renderer failure is a user-visible result
                detail = "".join(traceback.format_exception_only(type(error), error)).strip()
                raise SpecError(f"the {renderer.kind} renderer failed: {detail}", "render_failed") from error
            fig = result if isinstance(result, mpl.figure.Figure) else ctx.fig
            if fig is None:
                raise SpecError("the renderer did not create a figure", "render_failed")
            ctx.add_title()
            if ctx.used_colors and style.get("palette"):
                pass
            export = export_figure(
                fig,
                out_dir,
                basename,
                dpi=int(style["dpi"]),
                formats=formats,
                transparent=bool(spec["output"].get("transparent") or style.get("transparent")),
                title=spec["labels"].get("title", ""),
                kind=renderer.kind,
            )
        for item in caught:
            message = str(item.message)
            if message and message not in warnings_list:
                warnings_list.append(message)
    quality = evaluate_quality(fig, ctx, export["files"], formats, int(style["dpi"]), warnings_list)
    duration_ms = int((time.time() - started) * 1000)
    return {
        "ok": True,
        "kind": renderer.kind,
        "name_zh": renderer.zh,
        "name_en": renderer.en,
        "category": renderer.category,
        "files": export["files"],
        "sizes": export["sizes"],
        "formats": export["formats"],
        "width_px": export["width_px"],
        "height_px": export["height_px"],
        "width_mm": style["width_mm"],
        "height_mm": style["height_mm"],
        "width_in": style["width_in"],
        "height_in": style["height_in"],
        "dpi": style["dpi"],
        "style": {
            "domain": style.get("domain"),
            "journal": style.get("journal"),
            "palette": style.get("palette"),
            "cmap": style.get("cmap"),
            "font": style.get("font"),
            "font_family": style.get("font_family"),
            "size": style.get("size"),
            "size_label_zh": style.get("size_label_zh"),
            "size_label_en": style.get("size_label_en"),
            "height_ratio": style.get("height_ratio"),
            "grid": bool((style.get("grid") or {}).get("show")),
            "spines": list(style.get("spines") or []),
        },
        "quality": quality,
        "warnings": warnings_list,
        "data": {"mode": data.mode, "rows": data.rows, "columns": list(data.column_order)},
        "duration_ms": duration_ms,
        "engine": _engine_info(),
    }


def cmd_render(args) -> dict:
    raw = _load_json_arg(args.spec)
    out_dir = args.out_dir or tempfile.mkdtemp(prefix="sciplot-")
    result = render_one(raw, out_dir, basename=args.basename)
    result["out_dir"] = out_dir
    return result


def _load_json_arg(value: str):
    if value == "-":
        text = sys.stdin.read()
    else:
        text = Path(value).read_text(encoding="utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise SpecError(f"invalid JSON spec: {error}", "invalid_spec") from error


def cmd_capabilities(_args) -> dict:
    load_errors = load_renderers()
    probe = probe_environment()
    payload = {
        "ok": True,
        "version": VERSION,
        "engine": _engine_info(),
        "kinds": kinds_catalog(),
        "themes": themes_catalog(),
        "palettes": {"categorical": list_categorical(), "continuous": list_continuous()},
        "samples": samples.list_samples(),
        "spec": {
            "formats": list(ALLOWED_FORMATS),
            "data_modes": ["series", "rows+columns+mapping", "matrix", "sample"],
            "mapping_keys": ["x", "y", "group", "yerr", "xerr", "size", "label", "time", "event", "row", "col", "value", "p", "fc"],
            "style_keys": ["domain", "journal", "palette", "cmap", "font", "size", "width_mm", "height_mm", "height_ratio", "dpi", "grid", "legend", "ticks", "minor", "spines", "line", "errorbar", "font_size", "transparent", "background"],
            "labels": ["x", "y", "y2", "z", "title", "subtitle", "legend", "colorbar"],
            "output_formats": ["png", "svg", "pdf", "eps", "tiff", "jpg"],
        },
        "probe": probe,
        "load_errors": load_errors,
        "quickstart": {
            "zh": "先调用能力清单选择 kind 与 domain/journal 预设，再用 data.sample 或表格数据出图；可选矢量导出。",
            "en": "Pick a kind and a domain/journal preset from capabilities, render from data.sample or tabular rows, export vector formats optionally.",
        },
    }
    return payload


def probe_environment() -> dict:
    from . import fonts

    detected = fonts.detect()
    try:
        import scipy

        scipy_version = scipy.__version__
    except Exception:
        scipy_version = None
    probe = {
        "ok": True,
        "python": platform.python_version(),
        "matplotlib": mpl.__version__,
        "numpy": np.__version__,
        "scipy": scipy_version,
        "backend": matplotlib.get_backend(),
        "cjk_available": detected["cjk_available"],
        "cjk_families": detected["cjk_families"],
        "font_presets": [
            {"id": pid, "available": info["available"], "latin": info["latin"], "cjk": info["cjk"]}
            for pid, info in detected["presets"].items()
        ],
        "samples": len(samples.list_samples()),
        "engine_dir": str(Path(__file__).resolve().parent.parent),
        "warnings": [],
    }
    for preset_id in ("arial", "times"):
        if not detected["presets"].get(preset_id, {}).get("available"):
            probe["warnings"].append(f"font preset {preset_id} is not installed; matplotlib falls back to a default sans/serif font")
    if not detected["cjk_available"]:
        probe["warnings"].append("no CJK font found; Chinese labels may render as boxes")
    return probe


def cmd_probe(_args) -> dict:
    return probe_environment()


def cmd_validate(args) -> dict:
    raw = _load_json_arg(args.spec)
    spec, style, data, renderer = _prepare(raw)
    issues = []
    if data.mode == "table" and not (data.mapping or spec["data"].get("mapping")):
        issues.append({"level": "info", "message_zh": "表格数据没有 mapping，渲染器会尝试自动选择列。", "message_en": "Table data has no mapping; renderers will auto-pick columns."})
    try:
        series = data.build_series() if data.mode == "table" else data.series
        if not series:
            issues.append({"level": "warn", "message_zh": "没有可绘制的序列。", "message_en": "No series could be built."})
    except SpecError as error:
        issues.append({"level": "error", "message_zh": str(error), "message_en": str(error)})
    return {
        "ok": True,
        "kind": renderer.kind,
        "name_zh": renderer.zh,
        "style": {
            "domain": style.get("domain"),
            "journal": style.get("journal"),
            "palette": style.get("palette"),
            "cmap": style.get("cmap"),
            "font_family": style.get("font_family"),
            "width_mm": style["width_mm"],
            "height_mm": style["height_mm"],
            "dpi": style["dpi"],
            "spines": list(style.get("spines") or []),
            "ticks": style.get("ticks"),
        },
        "data": {"mode": data.mode, "rows": data.rows, "columns": data.column_summary() if data.mode == "table" else []},
        "issues": issues,
        "options": renderer.options,
        "engine": _engine_info(),
    }


def cmd_selftest(args) -> dict:
    load_errors = load_renderers()
    out_dir = args.out_dir or tempfile.mkdtemp(prefix="sciplot-selftest-")
    os.makedirs(out_dir, exist_ok=True)
    kinds = [k.strip() for k in (args.kinds or "").split(",") if k.strip()] or list(KINDS.keys())
    themes = [t.strip() for t in (args.themes or "").split(",") if t.strip()]
    results = []
    started = time.time()
    for kind in kinds:
        renderer = get_renderer(kind)
        if renderer is None:
            results.append({"kind": kind, "ok": False, "error": "renderer not registered"})
            continue
        demo = renderer.demo if isinstance(renderer.demo, dict) else {}
        style = dict(demo.get("style") or {})
        if themes:
            style["journal"] = themes[0]
        spec = {
            "kind": renderer.kind,
            "data": demo.get("data"),
            "style": style,
            "labels": demo.get("labels") or {},
            "options": demo.get("options") or {},
            "output": {"formats": ["png", "svg"], "basename": f"selftest-{renderer.kind}"},
        }
        if not spec["data"]:
            results.append({"kind": renderer.kind, "ok": False, "error": "renderer has no demo data"})
            continue
        try:
            rendered = render_one(spec, os.path.join(out_dir, renderer.kind), basename=f"selftest-{renderer.kind}")
            results.append(
                {
                    "kind": renderer.kind,
                    "name_zh": renderer.zh,
                    "ok": True,
                    "duration_ms": rendered["duration_ms"],
                    "quality": rendered["quality"]["score"],
                    "grade": rendered["quality"]["grade"],
                    "warnings": rendered["warnings"],
                    "png": rendered["files"].get("png"),
                }
            )
        except Exception as error:  # noqa: BLE001 - selftest reports every failure
            results.append({"kind": renderer.kind, "ok": False, "error": str(error), "code": getattr(error, "code", "render_failed")})
    passed = sum(1 for row in results if row["ok"])
    return {
        "ok": passed == len(results),
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "duration_ms": int((time.time() - started) * 1000),
        "out_dir": out_dir,
        "results": results,
        "load_errors": load_errors,
        "engine": _engine_info(),
    }


def cmd_gallery(args) -> dict:
    load_renderers()
    catalog_path = Path(args.catalog)
    entries = json.loads(catalog_path.read_text(encoding="utf-8"))
    if isinstance(entries, dict):
        entries = entries.get("figures") or []
    out_dir = args.out_dir or tempfile.mkdtemp(prefix="sciplot-gallery-")
    manifest = []
    for entry in entries:
        figure_id = str(entry.get("id") or entry.get("spec", {}).get("output", {}).get("basename") or "figure")
        spec = entry.get("spec") or {}
        try:
            rendered = render_one(spec, os.path.join(out_dir, figure_id), basename=figure_id)
            manifest.append(
                {
                    "id": figure_id,
                    "ok": True,
                    "title_zh": entry.get("title_zh") or rendered["name_zh"],
                    "title_en": entry.get("title_en") or rendered["name_en"],
                    "note_zh": entry.get("note_zh") or "",
                    "note_en": entry.get("note_en") or "",
                    "kind": rendered["kind"],
                    "domain": rendered["style"]["domain"],
                    "journal": rendered["style"]["journal"],
                    "width_mm": rendered["width_mm"],
                    "height_mm": rendered["height_mm"],
                    "width_px": rendered["width_px"],
                    "height_px": rendered["height_px"],
                    "quality": rendered["quality"],
                    "files": rendered["files"],
                    "duration_ms": rendered["duration_ms"],
                }
            )
        except Exception as error:  # noqa: BLE001
            manifest.append({"id": figure_id, "ok": False, "error": str(error), "code": getattr(error, "code", "render_failed")})
    return {"ok": all(row.get("ok") for row in manifest), "out_dir": out_dir, "figures": manifest, "engine": _engine_info()}


def cmd_sample(args) -> dict:
    if args.list:
        return {"ok": True, "samples": samples.list_samples()}
    if args.csv:
        return {"ok": True, "path": samples.csv_path(args.csv)}
    sample_id = args.get
    if sample_id:
        return {"ok": True, "sample": samples.get_sample(sample_id), "preview": samples.preview_rows(sample_id, args.limit)}
    return {"ok": False, "code": "invalid_input", "error": "pass --list, --get ID or --csv ID"}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sciplot", description="Publication-grade plotting engine for dsh-sci-plot")
    parser.add_argument("--version", action="version", version=f"dsh-sci-plot {VERSION}")
    sub = parser.add_subparsers(dest="command", required=True)

    render = sub.add_parser("render", help="render one figure spec")
    render.add_argument("--spec", required=True, help="path to a JSON spec, or - for stdin")
    render.add_argument("--out-dir", required=True)
    render.add_argument("--basename")
    render.set_defaults(func=cmd_render)

    capabilities = sub.add_parser("capabilities", help="catalog of kinds, themes, palettes, samples")
    capabilities.set_defaults(func=cmd_capabilities)

    probe = sub.add_parser("probe", help="runtime and font probe")
    probe.set_defaults(func=cmd_probe)

    validate = sub.add_parser("validate", help="normalise a spec without drawing")
    validate.add_argument("--spec", required=True)
    validate.set_defaults(func=cmd_validate)

    selftest = sub.add_parser("selftest", help="render every kind with its demo data")
    selftest.add_argument("--out-dir")
    selftest.add_argument("--kinds", help="comma separated kinds (default: all)")
    selftest.add_argument("--themes", help="comma separated journal presets (default: demo style)")
    selftest.set_defaults(func=cmd_selftest)

    gallery = sub.add_parser("gallery", help="render a demo gallery catalog")
    gallery.add_argument("--catalog", required=True)
    gallery.add_argument("--out-dir", required=True)
    gallery.set_defaults(func=cmd_gallery)

    sample = sub.add_parser("sample", help="inspect bundled datasets")
    sample.add_argument("--list", action="store_true")
    sample.add_argument("--get")
    sample.add_argument("--csv")
    sample.add_argument("--limit", type=int, default=12)
    sample.set_defaults(func=cmd_sample)
    return parser


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        raise
    try:
        result = args.func(args)
    except SpecError as error:
        _json_print(_failure(error))
        return 0
    except Exception as error:  # noqa: BLE001 - one JSON error object, never a traceback on stdout
        if os.environ.get("SCIPLOT_DEBUG"):
            traceback.print_exc(file=sys.stderr)
        _json_print(_failure(error))
        return 0
    _json_print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

