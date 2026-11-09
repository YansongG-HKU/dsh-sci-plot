"""Palette registry for scientific figures.

Three families are supported:
  * categorical  - discrete series colours (Okabe-Ito, Tol, journal suites, ColorBrewer, ...)
  * continuous   - sequential / diverging / cyclic colour maps
  * quality      - colour-vision-deficiency simulation and Lab distance so a
                   figure can be checked for colour-blind safety.

Everything is pure numpy + matplotlib; no optional dependency is required.
"""
from __future__ import annotations

import colorsys
import math

import numpy as np
from matplotlib.colors import LinearSegmentedColormap, ListedColormap, to_rgb

# ---------------------------------------------------------------------------
# Categorical palettes
# ---------------------------------------------------------------------------

CATEGORICAL = {
    "okabe-ito": {
        "name_zh": "冈部-伊藤（色盲友好）",
        "name_en": "Okabe-Ito (CVD safe)",
        "colors": ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#000000"],
        "source": "Okabe & Ito, Color Universal Design (2008)",
        "cvd_safe": True,
    },
    "tol-bright": {
        "name_zh": "Tol 明亮",
        "name_en": "Tol bright",
        "colors": ["#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE", "#AA3377", "#BBBBBB"],
        "source": "Paul Tol, SRON technical note",
        "cvd_safe": True,
    },
    "tol-muted": {
        "name_zh": "Tol 柔和",
        "name_en": "Tol muted",
        "colors": ["#332288", "#88CCEE", "#44AA99", "#117733", "#999933", "#DDCC77", "#CC6677", "#882255", "#AA4499"],
        "source": "Paul Tol, SRON technical note",
        "cvd_safe": True,
    },
    "tol-light": {
        "name_zh": "Tol 浅色",
        "name_en": "Tol light",
        "colors": ["#77AADD", "#EE8866", "#EEDD88", "#FFAABB", "#99DDFF", "#44BB99", "#BBCC33", "#AAAA00", "#DDDDDD"],
        "source": "Paul Tol, SRON technical note",
        "cvd_safe": True,
    },
    "npg": {
        "name_zh": "Nature 系列（NPG）",
        "name_en": "Nature (NPG)",
        "colors": ["#E64B35", "#4DBBD5", "#00A087", "#3C5488", "#F39B7F", "#8491B4", "#91D1C2", "#DC0000", "#7E6148", "#B09C85"],
        "source": "ggsci NPG palette (Nature Publishing Group figures)",
        "cvd_safe": False,
    },
    "science": {
        "name_zh": "Science 系列",
        "name_en": "Science",
        "colors": ["#3B4992", "#EE0000", "#008B45", "#631879", "#008280", "#BB0021", "#5F559B", "#A20056", "#808180", "#1B1919"],
        "source": "ggsci AAAS palette",
        "cvd_safe": False,
    },
    "lancet": {
        "name_zh": "Lancet 系列",
        "name_en": "Lancet",
        "colors": ["#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F", "#FDAF91", "#AD002A", "#ADB6B6", "#1B1919"],
        "source": "ggsci Lancet palette",
        "cvd_safe": False,
    },
    "nejm": {
        "name_zh": "NEJM 系列",
        "name_en": "NEJM",
        "colors": ["#BC3C29", "#0072B5", "#E18727", "#20854E", "#7876B1", "#6F99AD", "#FFDC91", "#EE4C97"],
        "source": "ggsci NEJM palette",
        "cvd_safe": False,
    },
    "jama": {
        "name_zh": "JAMA 系列",
        "name_en": "JAMA",
        "colors": ["#374E55", "#DF8F44", "#00A1D5", "#B24745", "#79AF97", "#6A6599", "#80796B"],
        "source": "ggsci JAMA palette",
        "cvd_safe": False,
    },
    "brewer-set1": {
        "name_zh": "Brewer Set1",
        "name_en": "Brewer Set1",
        "colors": ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"],
        "source": "ColorBrewer 2.0 (Cynthia Brewer)",
        "cvd_safe": False,
    },
    "brewer-set2": {
        "name_zh": "Brewer Set2",
        "name_en": "Brewer Set2",
        "colors": ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"],
        "source": "ColorBrewer 2.0 (Cynthia Brewer)",
        "cvd_safe": True,
    },
    "brewer-dark2": {
        "name_zh": "Brewer Dark2",
        "name_en": "Brewer Dark2",
        "colors": ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"],
        "source": "ColorBrewer 2.0 (Cynthia Brewer)",
        "cvd_safe": True,
    },
    "brewer-paired": {
        "name_zh": "Brewer Paired",
        "name_en": "Brewer Paired",
        "colors": ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"],
        "source": "ColorBrewer 2.0 (Cynthia Brewer)",
        "cvd_safe": False,
    },
    "tableau-10": {
        "name_zh": "Tableau 10",
        "name_en": "Tableau 10",
        "colors": ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"],
        "source": "Tableau categorical palette",
        "cvd_safe": False,
    },
    "grayscale": {
        "name_zh": "灰阶（印刷友好）",
        "name_en": "Grayscale (print safe)",
        "colors": ["#111111", "#3D3D3D", "#696969", "#949494", "#BFBFBF", "#E2E2E2"],
        "source": "Neutral grayscale ramp",
        "cvd_safe": True,
    },
    "earth": {
        "name_zh": "大地（地球环境）",
        "name_en": "Earth",
        "colors": ["#2E5A87", "#C08552", "#4C7A5A", "#8C6D46", "#7FA6C9", "#B23A48", "#D9B26F", "#5C5C5C"],
        "source": "dsh-sci-plot earth & environment palette",
        "cvd_safe": False,
    },
}

# ---------------------------------------------------------------------------
# Continuous colour maps
# ---------------------------------------------------------------------------

_SEQ = {
    "blues": ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
    "greens": ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
    "greys": ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525", "#000000"],
    "oranges": ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"],
    "purples": ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d"],
    "reds": ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
    "ylgnbu": ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"],
    "ylorrd": ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
    "bugn": ["#f7fcfd", "#e5f5f9", "#ccece6", "#99d8c9", "#66c2a4", "#41ae76", "#238b45", "#006d2c", "#00441b"],
    "bupu": ["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#810f7c", "#4d004b"],
    "purd": ["#f7f4f9", "#e7e1ef", "#d4b9da", "#c994c7", "#df65b0", "#e7298a", "#ce1256", "#980043", "#67001f"],
    "ylgn": ["#ffffe5", "#f7fcb9", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#006837", "#004529"],
    "spectral": ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
}

_DIV = {
    "rdbu": ["#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac"],
    "rdylbu": ["#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4"],
    "rdylgn": ["#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850"],
    "piyg": ["#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#f7f7f7", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221"],
    "prgn": ["#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837"],
    "brbg": ["#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e"],
    "puor": ["#7f3b08", "#b35806", "#e08214", "#fdb863", "#fee0b6", "#f7f7f7", "#d8daeb", "#b2abd2", "#8073ac"],
    "vik": ["#001261", "#023fa3", "#3c70ff", "#7b9ff9", "#c6c9f3", "#f2f2f2", "#f7c3bb", "#f28e7f", "#c2433a", "#7f0d0e"],
    "berlin": ["#1a1a6e", "#2b5a9e", "#4e93c7", "#9fc4dd", "#e8e8e8", "#e8c0ac", "#d18562", "#a63f2e", "#6b1414"],
}

_BUILTIN = {
    # name -> (name_zh, name_en, kind, note)
    "viridis": ("翠绿（感知均匀）", "Viridis (perceptually uniform)", "sequential", "matplotlib"),
    "magma": ("岩浆", "Magma", "sequential", "matplotlib"),
    "plasma": ("等离子", "Plasma", "sequential", "matplotlib"),
    "inferno": ("炼狱", "Inferno", "sequential", "matplotlib"),
    "cividis": ("色盲友好 Cividis", "Cividis (CVD safe)", "sequential", "matplotlib"),
    "coolwarm": ("冷暖", "Coolwarm", "diverging", "matplotlib"),
    "seismic": ("地震", "Seismic", "diverging", "matplotlib"),
    "twilight": ("暮光（循环）", "Twilight (cyclic)", "cyclic", "matplotlib"),
    "hsv": ("HSV（循环）", "HSV (cyclic)", "cyclic", "matplotlib"),
}

_CUSTOM_PHASE = ["#3B4992", "#008B45", "#EDC948", "#E15759", "#925E9F", "#3B4992"]


def _make_cmap(name: str):
    key = str(name or "").lower()
    if key in _SEQ:
        data = _SEQ[key]
        kind = "sequential"
    elif key in _DIV:
        data = _DIV[name]
        kind = "diverging"
    elif key == "phase":
        data = _CUSTOM_PHASE
        kind = "cyclic"
    else:
        cmap = _mpl_cmap(key)
        return cmap, _BUILTIN.get(key, ("", "", "sequential", ""))[2]
    cmap = LinearSegmentedColormap.from_list(f"sciplot-{name}", data, N=256)
    return cmap, kind


def _mpl_cmap(name: str):
    import matplotlib

    try:
        return matplotlib.colormaps[name]
    except (KeyError, ValueError):
        return matplotlib.colormaps["viridis"]


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def list_categorical() -> list[dict]:
    rows = []
    for pid, meta in CATEGORICAL.items():
        quality = palette_quality(meta["colors"])
        rows.append(
            {
                "id": pid,
                "name_zh": meta["name_zh"],
                "name_en": meta["name_en"],
                "colors": list(meta["colors"]),
                "source": meta["source"],
                "cvd_safe": bool(meta["cvd_safe"]),
                "cvd_min_delta_e": quality["min_delta_e"],
                "cvd_level": quality["level"],
            }
        )
    return rows


def list_continuous() -> list[dict]:
    rows = []
    for name, info in _BUILTIN.items():
        cmap = _mpl_cmap(name)
        stops = [to_hex(cmap(v)) for v in (0.0, 0.25, 0.5, 0.75, 1.0)]
        rows.append(
            {
                "id": name,
                "name_zh": info[0],
                "name_en": info[1],
                "kind": info[2],
                "stops": stops,
                "source": "matplotlib",
            }
        )
    for name, data in list(_SEQ.items()) + list(_DIV.items()):
        if name == "spectral":
            continue
        cmap, kind = _make_cmap(name)
        stops = [to_hex(cmap(v)) for v in (0.0, 0.25, 0.5, 0.75, 1.0)]
        zh = {
            "blues": "蓝色渐变", "greens": "绿色渐变", "greys": "灰色渐变", "oranges": "橙色渐变",
            "purples": "紫色渐变", "reds": "红色渐变", "ylgnbu": "黄绿蓝", "ylorrd": "黄橙红",
            "bugn": "蓝绿", "bupu": "蓝紫", "purd": "紫红", "ylgn": "黄绿",
            "rdbu": "红蓝发散", "rdylbu": "红黄蓝发散", "rdylgn": "红黄绿发散",
            "piyg": "粉绿发散", "prgn": "紫绿发散", "brbg": "棕绿发散", "puor": "橙紫发散",
            "vik": "Vik 发散", "berlin": "Berlin 发散",
        }.get(name, name)
        en = name.capitalize()
        rows.append(
            {
                "id": name,
                "name_zh": zh,
                "name_en": en,
                "kind": kind,
                "stops": stops,
                "source": "ColorBrewer / scientific colour maps" if kind != "cyclic" else "custom",
            }
        )
    row = {
        "id": "spectral",
        "name_zh": "光谱（慎用）",
        "name_en": "Spectral",
        "kind": "diverging",
        "stops": [to_hex(_make_cmap("spectral")[0](v)) for v in (0.0, 0.25, 0.5, 0.75, 1.0)],
        "source": "ColorBrewer 2.0",
    }
    rows.append(row)
    return rows


def get_categorical(pid: str = "okabe-ito", n: int = 1) -> list[str]:
    """Return ``n`` colours, cycling and, past the base length, varying lightness."""
    palette = CATEGORICAL.get(pid) or CATEGORICAL["okabe-ito"]
    base = list(palette["colors"])
    out: list[str] = []
    for i in range(max(int(n), 1)):
        if i < len(base):
            out.append(base[i])
        else:
            cycle = i // len(base)
            colour = base[i % len(base)]
            h, l, s = colorsys.rgb_to_hls(*to_rgb(colour))
            l = max(0.18, min(0.86, l + (0.16 if cycle % 2 else -0.16) * ((cycle + 1) // 2)))
            s = max(0.35, min(1.0, s * (1.0 - 0.12 * (cycle // 2))))
            out.append(to_hex(colorsys.hls_to_rgb(h, l, s)))
    return out


def get_cmap(name: str = "viridis"):
    key = str(name or "viridis").lower()
    if key in _BUILTIN or key == "phase" or key in _SEQ or key in _DIV:
        return _make_cmap(key)[0]
    # Accept matplotlib's own casing (e.g. "RdBu") and any registered colormap.
    try:
        import matplotlib

        if str(name) in matplotlib.colormaps or key in matplotlib.colormaps:
            return matplotlib.colormaps[str(name) if str(name) in matplotlib.colormaps else key]
    except Exception:
        pass
    return _mpl_cmap("viridis")


def is_diverging(name: str) -> bool:
    key = str(name or "").lower()
    if key in _DIV:
        return True
    if key in _BUILTIN:
        return _BUILTIN[key][2] == "diverging"
    return False


def cyclic_cmap(name: str = "twilight"):
    return _mpl_cmap(name) if name in ("twilight", "hsv") else _make_cmap("phase")[0]


# ---------------------------------------------------------------------------
# Colour math: sRGB <-> Lab, CVD simulation, quality report
# ---------------------------------------------------------------------------

_MACHADO = {
    "protanopia": np.array(
        [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]
    ),
    "deuteranopia": np.array(
        [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]]
    ),
    "tritanopia": np.array(
        [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
    ),
}
_RGB_TO_XYZ = np.array(
    [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]]
)
_WHITE = np.array([0.95047, 1.0, 1.08883])


def to_hex(rgb) -> str:
    arr = np.clip(np.asarray(rgb, dtype=float), 0.0, 1.0)
    return "#" + "".join(f"{int(round(c * 255)):02x}" for c in arr[:3])


def srgb_to_linear(rgb: np.ndarray) -> np.ndarray:
    rgb = np.asarray(rgb, dtype=float)
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(rgb: np.ndarray) -> np.ndarray:
    rgb = np.clip(np.asarray(rgb, dtype=float), 0.0, 1.0)
    return np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - 0.055)


def _lab(rgb01: np.ndarray) -> np.ndarray:
    lin = srgb_to_linear(rgb01)
    xyz = lin @ _RGB_TO_XYZ.T / _WHITE
    eps = 216 / 24389
    kappa = 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kappa * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def delta_e_76(c1: str, c2: str) -> float:
    lab1 = _lab(np.asarray(to_rgb(c1)))
    lab2 = _lab(np.asarray(to_rgb(c2)))
    return float(np.linalg.norm(lab1 - lab2))


def simulate_cvd(hex_color: str, kind: str = "deuteranopia") -> str:
    matrix = _MACHADO.get(kind)
    if matrix is None:
        return hex_color
    lin = srgb_to_linear(np.asarray(to_rgb(hex_color)))
    sim = linear_to_srgb(lin @ matrix.T)
    return to_hex(sim)


def min_pair_distance(colors: list[str], kind: str | None = None) -> float:
    if len(colors) < 2:
        return 100.0
    converted = [simulate_cvd(c, kind) if kind else c for c in colors]
    best = 1e9
    for i in range(len(converted)):
        for j in range(i + 1, len(converted)):
            best = min(best, delta_e_76(converted[i], converted[j]))
    return round(float(best), 1)


def palette_quality(colors: list[str]) -> dict:
    """Worst-case pairwise Lab distance across normal / simulated vision."""
    if len(colors) < 2:
        return {"min_delta_e": 100.0, "level": "pass", "detail": "single colour"}
    normal = min_pair_distance(colors)
    protan = min_pair_distance(colors, "protanopia")
    deutan = min_pair_distance(colors, "deuteranopia")
    tritan = min_pair_distance(colors, "tritanopia")
    worst = min(normal, protan, deutan, tritan)
    if worst >= 20:
        level = "pass"
    elif worst >= 10:
        level = "ok"
    else:
        level = "fail"
    return {
        "min_delta_e": round(worst, 1),
        "normal": normal,
        "protanopia": protan,
        "deuteranopia": deutan,
        "tritanopia": tritan,
        "level": level,
    }


def categorical_report(pid: str) -> dict:
    meta = CATEGORICAL.get(pid)
    if meta is None:
        meta = CATEGORICAL["okabe-ito"]
    quality = palette_quality(list(meta["colors"]))
    return {"id": pid, "quality": quality, "colors": list(meta["colors"])}


# ---------------------------------------------------------------------------
# Text colour on top of a filled cell
# ---------------------------------------------------------------------------

def text_color_on(hex_color: str) -> str:
    r, g, b = to_rgb(hex_color)
    lum = 0.2126 * _srgb_channel(r) + 0.7152 * _srgb_channel(g) + 0.0722 * _srgb_channel(b)
    return "#111111" if lum > 0.42 else "#ffffff"


def _srgb_channel(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(hex_color: str) -> float:
    r, g, b = to_rgb(hex_color)
    return 0.2126 * _srgb_channel(r) + 0.7152 * _srgb_channel(g) + 0.0722 * _srgb_channel(b)


def contrast_ratio(fg: str, bg: str = "#ffffff") -> float:
    l1 = relative_luminance(fg)
    l2 = relative_luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return round((hi + 0.05) / (lo + 0.05), 2)
