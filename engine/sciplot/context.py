"""Rendering context: figure creation, style application, legends and colourbars.

Every renderer receives one :class:`Ctx`.  The context owns the figure, the
resolved style, the data, the label dictionary and the quality bookkeeping, so a
renderer only describes *what* to draw.
"""
from __future__ import annotations

import numpy as np
from matplotlib.figure import Figure

from . import helpers as H
from .palettes import get_cmap, get_categorical, is_diverging, text_color_on
from .spec import Data, SpecError, as_bool, as_float, option


class Ctx:
    def __init__(self, spec: dict, style: dict, data: Data, renderer=None):
        self.spec = spec
        self.style = style
        self.data = data
        self.renderer = renderer
        self.labels = dict(spec.get("labels") or {})
        self.options = dict(spec.get("options") or {})
        self.warnings: list[str] = []
        self.used_colors: list[str] = []
        self.used_cmap: str | None = None
        self.fig: Figure | None = None
        self._axes: list = []
        self._title_done = False
        self._seed = int(as_float(self.options.get("seed"), 7))
        self.rng = np.random.default_rng(self._seed)
        self.kind = spec.get("kind", "line")
        self._aspect = getattr(renderer, "aspect", None) if renderer is not None else None

    # ------------------------------------------------------------------
    # Figure / axes
    # ------------------------------------------------------------------
    def figure(self, nrows: int = 1, ncols: int = 1, *, height_ratios=None, width_ratios=None, sharex=False, sharey=False, squeeze: bool = True, aspect: float | None = None):
        """Create the (single) figure with the resolved physical size."""
        width_in = self.style["width_in"]
        height_in = self.style["height_in"]
        if aspect is not None and aspect > 0:
            height_in = width_in * float(aspect)
        fig = Figure(figsize=(width_in, height_in), dpi=min(int(self.style["dpi"]), 300))
        fig.set_facecolor(self.style.get("figure_face", "#ffffff"))
        fig.set_layout_engine("constrained")
        from matplotlib.gridspec import GridSpec

        gs = GridSpec(
            int(nrows),
            int(ncols),
            figure=fig,
            height_ratios=height_ratios,
            width_ratios=width_ratios,
            hspace=0.0,
            wspace=0.0,
        )
        axes = []
        for r in range(int(nrows)):
            for c in range(int(ncols)):
                ax = fig.add_subplot(gs[r, c], sharex=None, sharey=None)
                ax.set_facecolor(self.style.get("axes_face", "#ffffff"))
                axes.append(ax)
        if sharex:
            for i in range(1, len(axes)):
                axes[i].sharex(axes[0])
        if sharey:
            for i in range(1, len(axes)):
                axes[i].sharey(axes[0])
        if squeeze and len(axes) == 1:
            self.fig = fig
            self._axes = axes
            return fig, axes[0]
        self.fig = fig
        self._axes = axes
        return fig, axes

    def _ensure_figure(self):
        if self.fig is None:
            if self._aspect is not None:
                self.figure(1, 1, aspect=self._aspect)
            else:
                self.figure(1, 1)
        return self.fig

    def ax(self, index: int = 0):
        self._ensure_figure()
        if not self._axes:
            raise SpecError("no axes were created", "render_failed")
        index = int(index)
        if index < 0 or index >= len(self._axes):
            raise SpecError(f"axes index {index} is out of range", "render_failed")
        return self._axes[index]

    @property
    def axes(self):
        self._ensure_figure()
        return list(self._axes)

    def subplots(self, nrows: int = 1, ncols: int = 1, **kwargs):
        return self.figure(nrows, ncols, squeeze=False, **kwargs)

    # ------------------------------------------------------------------
    # Colour access
    # ------------------------------------------------------------------
    def color(self, index: int = 0) -> str:
        palette = get_categorical(self.style.get("palette", "okabe-ito"), max(int(index) + 1, 1))
        colour = palette[int(index) % len(palette)]
        if colour not in self.used_colors:
            self.used_colors.append(colour)
        return colour

    def colors(self, n: int) -> list[str]:
        return [self.color(i) for i in range(max(int(n), 1))]

    def cmap(self, name: str | None = None):
        name = name or self.style.get("cmap", "viridis")
        self.used_cmap = name
        return get_cmap(name)

    def diverging_cmap(self):
        name = self.style.get("diverging_cmap") or "RdBu"
        self.used_cmap = name
        return get_cmap(name)

    def series_colors(self, series: list[dict]) -> list[str]:
        return [item.get("color") or self.color(i) for i, item in enumerate(series)]

    # ------------------------------------------------------------------
    # Data access
    # ------------------------------------------------------------------
    def series(self, mapping: dict | None = None) -> list[dict]:
        if self.data.mode == "series":
            return list(self.data.series)
        mapping = mapping or self.options.get("mapping") or self.data.mapping
        return self.data.build_series(mapping)

    @property
    def table(self) -> Data:
        return self.data

    def opt(self, key: str, default=None):
        return option(self.options, key, default)

    def flag(self, key: str, default: bool = False) -> bool:
        return as_bool(self.options.get(key), default)

    def num(self, key: str, default: float) -> float:
        return as_float(self.options.get(key), default)

    def label(self, key: str, default: str = "") -> str:
        value = self.labels.get(key)
        return value if isinstance(value, str) else default

    def warn(self, message: str):
        if message not in self.warnings:
            self.warnings.append(str(message))

    # ------------------------------------------------------------------
    # Styling
    # ------------------------------------------------------------------
    def style_axes(self, ax, *, grid=None, spines=None, ticks=None, minor=None):
        style = self.style
        spines = style.get("spines", ("left", "bottom")) if spines is None else spines
        ticks = style.get("ticks", "out") if ticks is None else ticks
        minor = style.get("minor", False) if minor is None else minor
        for name in ("left", "right", "top", "bottom"):
            try:
                ax.spines[name].set_visible(name in spines)
                ax.spines[name].set_linewidth(style["rc"].get("axes.linewidth", 0.6))
            except KeyError:
                continue
        ax.tick_params(
            which="major",
            direction=ticks,
            top="top" in spines,
            right="right" in spines,
            length=style["rc"].get("xtick.major.size", 3.0),
            width=style["rc"].get("xtick.major.width", 0.6),
            color=style.get("text", "#111111"),
        )
        ax.tick_params(
            which="minor",
            direction=ticks,
            top="top" in spines,
            right="right" in spines,
            length=style["rc"].get("xtick.minor.size", 1.6),
            width=style["rc"].get("xtick.minor.width", 0.5),
            color=style.get("text", "#111111"),
        )
        if minor:
            ax.minorticks_on()
        else:
            ax.minorticks_off()
        grid_cfg = style.get("grid", {}) if grid is None else {"show": bool(grid)}
        show = bool(grid_cfg.get("show"))
        if show:
            ax.grid(
                True,
                which=grid_cfg.get("which", "major"),
                axis=grid_cfg.get("axis", "both"),
                linestyle=grid_cfg.get("linestyle", "-"),
                color=grid_cfg.get("color", "#E4E4E4"),
                linewidth=grid_cfg.get("linewidth", 0.5),
                alpha=grid_cfg.get("alpha", 1.0),
            )
        else:
            ax.grid(False)
        ax.set_axisbelow(True)

    def apply_scales(self, ax, *, xscale=None, yscale=None, xlim=None, ylim=None, xreversed=None, yreversed=None):
        xscale = xscale or self.opt("xscale")
        yscale = yscale or self.opt("yscale")
        if xscale in ("log", "symlog", "linear", "logit"):
            ax.set_xscale(xscale)
        if yscale in ("log", "symlog", "linear", "logit"):
            ax.set_yscale(yscale)
        xlim = xlim if xlim is not None else self.opt("xlim")
        ylim = ylim if ylim is not None else self.opt("ylim")
        if isinstance(xlim, (list, tuple)) and len(xlim) >= 2:
            try:
                ax.set_xlim(float(xlim[0]), float(xlim[1]))
            except (TypeError, ValueError):
                pass
        if isinstance(ylim, (list, tuple)) and len(ylim) >= 2:
            try:
                ax.set_ylim(float(ylim[0]), float(ylim[1]))
            except (TypeError, ValueError):
                pass
        if xreversed is None:
            xreversed = self.flag("xreversed") or self.flag("invert_x")
        if xreversed:
            ax.invert_xaxis()
        if yreversed is None:
            yreversed = self.flag("yreversed") or self.flag("invert_y")
        if yreversed:
            ax.invert_yaxis()

    def legend(self, ax, *, handles=None, labels=None, title=None, loc=None, ncol=None, outside=False, **kwargs):
        style_legend = self.style.get("legend", {})
        params = {
            "frameon": style_legend.get("frameon", False),
            "fontsize": self.style["rc"].get("legend.fontsize", 6.5),
            "handlelength": self.style["rc"].get("legend.handlelength", 1.7),
            "handletextpad": self.style["rc"].get("legend.handletextpad", 0.45),
            "labelspacing": self.style["rc"].get("legend.labelspacing", 0.32),
            "borderaxespad": self.style["rc"].get("legend.borderaxespad", 0.25),
            "columnspacing": self.style["rc"].get("legend.columnspacing", 0.9),
        }
        if title is None:
            title = self.label("legend")
        if title:
            params["title"] = title
            params["title_fontsize"] = self.style["rc"].get("legend.title_fontsize", 7.0)
        if loc:
            params["loc"] = loc
        if ncol:
            params["ncol"] = int(ncol)
        params.update({k: v for k, v in kwargs.items() if v is not None})
        if outside:
            params.setdefault("loc", "upper left")
            params.setdefault("bbox_to_anchor", (1.01, 1.0))
            params["borderaxespad"] = 0.0
        if handles is not None:
            return ax.legend(handles, labels, **params)
        return ax.legend(**params)

    def colorbar(self, mappable, ax=None, *, label=None, orientation: str = "vertical", fraction: float = 0.05, pad: float = 0.03, aspect: int = 20, **kwargs):
        ax = ax or self.ax()
        cbar = self.fig.colorbar(mappable, ax=ax, orientation=orientation, fraction=fraction, pad=pad, aspect=aspect, **kwargs)
        cbar.outline.set_linewidth(self.style["rc"].get("axes.linewidth", 0.6))
        cbar.ax.tick_params(labelsize=self.style["rc"].get("xtick.labelsize", 6.5), width=0.5, length=2.2, direction=self.style.get("ticks", "out"))
        if label is None:
            label = self.label("colorbar")
        if label:
            cbar.set_label(label, fontsize=self.style["rc"].get("axes.labelsize", 7.5), labelpad=3)
        return cbar

    def panel_label(self, ax, letter: str, **kwargs):
        H.panel_letter(ax, letter, fontsize=float(self.style["rc"].get("axes.titlesize", 8.0)) + 0.5, **kwargs)

    def text_on(self, facecolor: str) -> str:
        return text_color_on(facecolor)

    # ------------------------------------------------------------------
    # Titles / finish
    # ------------------------------------------------------------------
    def add_title(self):
        if self._title_done:
            return
        title = self.label("title") or (self.spec.get("meta", {}) or {}).get("title") or ""
        subtitle = self.label("subtitle") or (self.spec.get("meta", {}) or {}).get("subtitle") or ""
        if not title and not subtitle:
            self._title_done = True
            return
        text = title
        if subtitle:
            text = f"{title}\n{subtitle}" if title else subtitle
        fig = self._ensure_figure()
        fig.suptitle(
            text,
            x=0.01,
            y=0.995,
            ha="left",
            va="top",
            fontsize=self.style["rc"].get("axes.titlesize", 8.0),
            color=self.style.get("text", "#111111"),
            fontweight="normal",
        )
        self._title_done = True

    def finish(
        self,
        ax,
        *,
        xlabel=None,
        ylabel=None,
        legend=None,
        grid=None,
        xlim=None,
        ylim=None,
        xscale=None,
        yscale=None,
        xreversed=None,
        yreversed=None,
        colorbar_label=None,
        style: bool = True,
        title=True,
        x_rotate=None,
    ):
        self.apply_scales(ax, xscale=xscale, yscale=yscale, xlim=xlim, ylim=ylim, xreversed=xreversed, yreversed=yreversed)
        if style:
            self.style_axes(ax, grid=grid)
        if xlabel is None:
            xlabel = self.label("x")
        if ylabel is None:
            ylabel = self.label("y")
        if xlabel:
            ax.set_xlabel(xlabel)
        if ylabel:
            ax.set_ylabel(ylabel)
        if x_rotate is not None:
            ax.tick_params(axis="x", labelrotation=float(x_rotate))
        if legend is True:
            if ax.get_legend_handles_labels()[0]:
                self.legend(ax)
        elif isinstance(legend, str) and legend == "auto":
            if len(ax.get_legend_handles_labels()[0]) > 1:
                self.legend(ax)
        elif isinstance(legend, dict):
            self.legend(ax, **legend)
        if title:
            self.add_title()
        return ax

    # ------------------------------------------------------------------
    # Composite helpers
    # ------------------------------------------------------------------
    def share_legend(self, axes, **kwargs):
        handles, labels = [], []
        for ax in axes:
            h, l = ax.get_legend_handles_labels()
            for handle, label in zip(h, l):
                if label and label not in labels:
                    handles.append(handle)
                    labels.append(label)
        if handles:
            return self.fig.legend(handles, labels, **{**{"frameon": False, "fontsize": self.style["rc"].get("legend.fontsize", 6.5)}, **kwargs})
        return None

    def aspect_ratio(self) -> float:
        return self.style["height_ratio"]

    def blank_axes(self, ax):
        ax.set_xticks([])
        ax.set_yticks([])
        for spine in ax.spines.values():
            spine.set_visible(False)
