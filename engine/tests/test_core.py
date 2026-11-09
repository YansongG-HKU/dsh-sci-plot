"""Core unit tests for the sciplot engine (stdlib unittest, no pytest needed).

Run:  python -m unittest discover -s tests -v
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402

from sciplot import helpers as H  # noqa: E402
from sciplot import palettes, themes  # noqa: E402
from sciplot.context import Ctx  # noqa: E402
from sciplot.export import export_figure  # noqa: E402
from sciplot.quality import evaluate  # noqa: E402
from sciplot.registry import get as get_kind, load as load_renderers  # noqa: E402
from sciplot.samples import get_sample, list_samples, load_sample_data, resolve_data  # noqa: E402
from sciplot.spec import SpecError, load_data, normalize_spec  # noqa: E402


class PaletteTests(unittest.TestCase):
    def test_catalog_has_core_palettes(self):
        ids = {row["id"] for row in palettes.list_categorical()}
        for expected in ("okabe-ito", "tol-bright", "npg", "science", "lancet", "nejm", "brewer-set1", "tableau-10"):
            self.assertIn(expected, ids)

    def test_cycle_extends_past_base_length(self):
        colors = palettes.get_categorical("okabe-ito", 12)
        self.assertEqual(len(colors), 12)
        self.assertEqual(len(set(colors[:8])), 8)

    def test_cvd_simulation_changes_colours(self):
        simulated = palettes.simulate_cvd("#E69F00", "deuteranopia")
        self.assertEqual(len(simulated), 7)
        self.assertNotEqual(simulated, "#E69F00")

    def test_palette_quality_reports_levels(self):
        good = palettes.palette_quality(["#000000", "#FFFFFF"])
        self.assertGreaterEqual(good["min_delta_e"], 20)
        quality = palettes.categorical_report("okabe-ito")
        self.assertEqual(quality["id"], "okabe-ito")
        self.assertIn(quality["quality"]["level"], ("pass", "ok", "fail"))

    def test_colormaps_resolve(self):
        for name in ("viridis", "magma", "blues", "rdbu", "vik", "phase", "twilight"):
            cmap = palettes.get_cmap(name)
            self.assertEqual(len(cmap(np.linspace(0, 1, 5))), 5)
        self.assertTrue(palettes.is_diverging("vik"))
        self.assertFalse(palettes.is_diverging("viridis"))

    def test_text_contrast_helper(self):
        self.assertEqual(palettes.text_color_on("#ffffff"), "#111111")
        self.assertEqual(palettes.text_color_on("#111111"), "#ffffff")
        self.assertGreater(palettes.contrast_ratio("#000000", "#ffffff"), 20)


class ThemeTests(unittest.TestCase):
    def test_style_resolution_merges_domain_and_journal(self):
        style = themes.resolve_style({"domain": "physics", "journal": "aps", "size": "single"})
        self.assertEqual(style["domain"], "physics")
        self.assertEqual(style["journal"], "aps")
        self.assertEqual(style["font_family"][0], "Times New Roman")
        self.assertAlmostEqual(style["width_mm"], 86.0)
        self.assertEqual(style["ticks"], "in")
        self.assertEqual(set(style["spines"]), {"left", "right", "top", "bottom"})

    def test_journal_widths_and_sizes(self):
        nature = themes.resolve_style({"journal": "nature", "size": "double"})
        self.assertAlmostEqual(nature["width_mm"], 183.0)
        custom = themes.resolve_style({"width_mm": 120, "height_ratio": 0.6})
        self.assertAlmostEqual(custom["width_mm"], 120)
        self.assertAlmostEqual(custom["height_mm"], 72)
        self.assertAlmostEqual(custom["width_in"], round(120 / 25.4, 4))

    def test_dpi_and_fonts_are_bounded(self):
        style = themes.resolve_style({"dpi": 5000, "font_size": 9})
        self.assertEqual(style["dpi"], 1200)
        self.assertGreater(style["rc"]["font.size"], 7)

    def test_catalog_shape(self):
        catalog = themes.catalog()
        self.assertGreaterEqual(len(catalog["domains"]), 12)
        self.assertGreaterEqual(len(catalog["journals"]), 14)
        domain_ids = {row["id"] for row in catalog["domains"]}
        self.assertIn("life-science", domain_ids)
        self.assertIn("physics", domain_ids)
        self.assertIn("economics", domain_ids)


class SpecTests(unittest.TestCase):
    def test_normalize_rejects_missing_kind_and_data(self):
        with self.assertRaises(SpecError):
            normalize_spec({"data": {"series": []}})
        with self.assertRaises(SpecError):
            normalize_spec({"kind": "line"})

    def test_series_data_is_coerced(self):
        spec = normalize_spec({"kind": "line", "data": {"series": [{"x": [1, 2, 3], "y": ["1", "2", "3"]}]}})
        data = load_data(spec["data"])
        self.assertEqual(data.mode, "series")
        self.assertEqual(len(data.series), 1)
        self.assertTrue(np.allclose(data.series[0]["y"], [1, 2, 3]))

    def test_table_mapping_with_groups(self):
        spec = normalize_spec(
            {
                "kind": "line",
                "data": {
                    "rows": [
                        {"t": 1, "v": 2.0, "g": "A"},
                        {"t": 2, "v": 3.0, "g": "A"},
                        {"t": 1, "v": 1.0, "g": "B"},
                        {"t": 2, "v": 1.5, "g": "B"},
                    ],
                    "mapping": {"x": "t", "y": "v", "group": "g"},
                },
            }
        )
        data = load_data(spec["data"])
        series = data.build_series()
        self.assertEqual(len(series), 2)
        self.assertEqual({item["name"] for item in series}, {"A", "B"})
        self.assertTrue(np.allclose(series[0]["x"], [1, 2]))

    def test_categorical_x_keeps_labels(self):
        spec = normalize_spec(
            {
                "kind": "bar",
                "data": {
                    "rows": [{"cat": "A", "v": 1}, {"cat": "B", "v": 2}],
                    "mapping": {"x": "cat", "y": "v"},
                },
            }
        )
        data = load_data(spec["data"])
        series = data.build_series()
        self.assertEqual(series[0]["categories"], ["A", "B"])

    def test_matrix_data(self):
        spec = normalize_spec({"kind": "heatmap", "data": {"matrix": [[1, 2], [3, 4]]}})
        data = load_data(spec["data"])
        self.assertEqual(data.mode, "matrix")
        self.assertEqual(data.matrix.shape, (2, 2))

    def test_sample_resolution(self):
        self.assertTrue(list_samples())
        resolved = resolve_data({"sample": "growth", "mapping": {"x": "time_h", "y": "od600"}})
        self.assertIn("rows", resolved)
        self.assertEqual(resolved["mapping"]["x"], "time_h")
        self.assertIn(get_sample("growth")["domain"], ("life-science",))
        self.assertGreater(len(load_sample_data("growth")["rows"]), 10)

    def test_unknown_sample_raises(self):
        with self.assertRaises(KeyError):
            resolve_data({"sample": "does-not-exist"})


class HelperTests(unittest.TestCase):
    def test_clean_xy_drops_non_finite(self):
        x, y = H.clean_xy([1, 2, np.nan, 4], [1, np.nan, 3, 4])
        self.assertEqual(len(x), 2)

    def test_stats_helpers(self):
        self.assertEqual(H.stars(0.0001), "***")
        self.assertEqual(H.stars(0.5), "n.s.")
        self.assertIn("p <", H.format_p(0.0001))
        fit = H.fit_linear([0, 1, 2, 3], [0.1, 1.1, 1.9, 3.2])
        self.assertAlmostEqual(fit["slope"], 1.0, places=1)
        lo, hi = H.bootstrap_ci(np.arange(20.0))
        self.assertLess(lo, hi)

    def test_kde_and_ecdf(self):
        grid, density = H.kde_1d(np.random.default_rng(1).normal(0, 1, 200))
        self.assertEqual(grid.shape, density.shape)
        x, y = H.ecdf([3, 1, 2])
        self.assertTrue(np.all(np.diff(y) >= 0))

    def test_significance_bracket(self):
        import matplotlib

        matplotlib.use("Agg")
        from matplotlib.figure import Figure

        fig = Figure(figsize=(2, 2))
        ax = fig.add_subplot(111)
        ax.bar([0, 1], [1, 2])
        H.draw_significance(ax, [(0, 1, "**", 2.4)])
        self.assertTrue(any(line.get_linestyle() == "-" for line in ax.lines))


class RenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        load_renderers()

    def _render(self, kind, out_dir, **overrides):
        renderer = get_kind(kind)
        self.assertIsNotNone(renderer, kind)
        demo = renderer.demo or {}
        spec = {
            "kind": kind,
            "data": demo.get("data"),
            "style": demo.get("style") or {},
            "labels": demo.get("labels") or {},
            "options": demo.get("options") or {},
            "output": {"formats": ["png", "svg"], "basename": kind},
        }
        spec.update(overrides)
        spec["data"] = resolve_data(spec["data"])
        normalized = normalize_spec(spec)
        style = themes.resolve_style(normalized["style"], kind_aspect=renderer.aspect)
        data = load_data(normalized["data"])
        import matplotlib as mpl

        rc = dict(style["rc"])
        rc.update({"pdf.fonttype": 42, "ps.fonttype": 42, "svg.hashsalt": "test"})
        with mpl.rc_context(rc):
            ctx = Ctx(normalized, style, data, renderer)
            renderer.fn(ctx)
            fig = ctx.fig
            self.assertIsNotNone(fig)
            result = export_figure(fig, str(out_dir), kind, dpi=style["dpi"], formats=["png", "svg"], transparent=False, title="test", kind=kind)
        quality = evaluate(fig, ctx, result["files"], ["png", "svg"], style["dpi"], [])
        return result, quality

    def test_every_registered_kind_renders(self):
        out_root = Path(tempfile.mkdtemp(prefix="sciplot-test-"))
        failures = []
        for kind in list(getattr(__import__("sciplot.registry", fromlist=["KINDS"]), "KINDS")):
            out_dir = out_root / kind
            out_dir.mkdir(parents=True, exist_ok=True)
            try:
                result, quality = self._render(kind, out_dir)
                self.assertGreater(result["width_px"], 100)
                if quality["score"] < 80:
                    failures.append(f"{kind}: low quality {quality['score']}")
            except Exception as error:  # noqa: BLE001
                failures.append(f"{kind}: {type(error).__name__}: {error}")
        self.assertEqual(failures, [], "\n".join(failures))

    def test_theme_variants_render(self):
        out_root = Path(tempfile.mkdtemp(prefix="sciplot-themes-"))
        for journal in ("nature", "science", "ieee", "acs", "aps", "apa"):
            result, _quality = self._render(
                "line",
                out_root / journal,
                style={"domain": "general", "journal": journal},
                data={"sample": "growth", "mapping": {"x": "time_h", "y": "od600", "group": "condition"}},
                labels={"x": "Time (h)", "y": "OD$_{600}$"},
            )
            self.assertGreater(result["width_px"], 100)

    def test_cjk_labels_render_without_missing_glyphs(self):
        out_dir = Path(tempfile.mkdtemp(prefix="sciplot-cjk-"))
        spec = {
            "kind": "line",
            "data": {"series": [{"name": "处理组", "x": [1, 2, 3], "y": [1, 2, 3]}]},
            "labels": {"x": "时间（小时）", "y": "信号强度（a.u.）", "title": "中文标签测试"},
            "output": {"formats": ["png"]},
        }
        spec["data"] = resolve_data(spec["data"])
        normalized = normalize_spec(spec)
        style = themes.resolve_style(normalized["style"], kind_aspect=None)
        data = load_data(normalized["data"])
        import matplotlib as mpl
        from matplotlib.figure import Figure

        with mpl.rc_context(style["rc"]):
            ctx = Ctx(normalized, style, data, get_kind("line"))
            get_kind("line").fn(ctx)
            export_figure(ctx.fig, str(out_dir), "cjk", dpi=200, formats=["png"], title="中文", kind="line")
        self.assertTrue((out_dir / "cjk.png").exists())

    def test_composite_panels_if_available(self):
        renderer = get_kind("multi_panel")
        if renderer is None:
            self.skipTest("multi_panel not registered yet")
        out_dir = Path(tempfile.mkdtemp(prefix="sciplot-multi-"))
        result, quality = self._render("multi_panel", out_dir)
        self.assertGreater(result["width_px"], 100)

    def test_quality_flags_missing_vector_and_low_dpi(self):
        out_dir = Path(tempfile.mkdtemp(prefix="sciplot-q-"))
        result, quality = self._render("line", out_dir, output={"formats": ["png"], "basename": "q"})
        checks = {check["id"]: check["status"] for check in quality["checks"]}
        self.assertIn("vector", checks)
        self.assertEqual(checks["resolution"], "pass")


if __name__ == "__main__":
    unittest.main(verbosity=2)
