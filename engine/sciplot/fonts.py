"""Font discovery and manuscript-safe font stacks.

A style names a *font preset*; this module resolves it to a concrete ordered
family list understood by matplotlib's per-glyph fallback (>= 3.6), so Latin
text uses Arial while Chinese labels fall through to Microsoft YaHei / SimHei.
"""
from __future__ import annotations

from matplotlib import font_manager

# preset -> (latin candidates, CJK candidates, mathtext fontset, label zh, label en)
FONT_PRESETS = {
    "arial": (["Arial", "Helvetica", "Liberation Sans"], ["Microsoft YaHei", "Noto Sans CJK SC", "SimHei"], "stixsans", "Arial（默认）", "Arial"),
    "helvetica": (["Helvetica", "Arial", "Liberation Sans"], ["Microsoft YaHei", "Noto Sans CJK SC", "SimHei"], "stixsans", "Helvetica", "Helvetica"),
    "times": (["Times New Roman", "Nimbus Roman", "Liberation Serif"], ["SimSun", "Songti SC", "Noto Serif CJK SC"], "stix", "Times New Roman", "Times"),
    "stix": (["STIXGeneral"], ["SimSun", "Songti SC", "Noto Serif CJK SC"], "stix", "STIX（公式友好）", "STIX"),
    "dejavu": (["DejaVu Sans"], ["Microsoft YaHei", "Noto Sans CJK SC", "SimHei"], "dejavusans", "DejaVu Sans", "DejaVu Sans"),
    "cjk-sans": (["Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "SimHei"], ["Microsoft YaHei", "Noto Sans CJK SC", "SimHei"], "stixsans", "中文字体（黑体）", "CJK sans"),
    "cjk-serif": (["SimSun", "Songti SC", "Noto Serif CJK SC"], ["SimSun", "Songti SC", "Noto Serif CJK SC"], "stix", "中文字体（宋体）", "CJK serif"),
}

_CJK_HINT = ("yahei", "simhei", "simsun", "songti", "noto sans cjk", "noto serif cjk", "source han", "pingfang", "heiti", "fangsong", "kaiti", "stsong", "msjh", "mingliu")

_CACHE: dict | None = None


def available_families() -> set[str]:
    names: set[str] = set()
    try:
        for entry in font_manager.fontManager.ttflist:
            names.add(entry.name)
    except Exception:
        pass
    return names


def detect() -> dict:
    """Report the fonts this machine can actually use for publication figures."""
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    available = available_families()
    latin = {}
    for preset, (latin_c, cjk_c, mathset, _zh, _en) in FONT_PRESETS.items():
        resolved_latin = [name for name in latin_c if name in available]
        resolved_cjk = [name for name in cjk_c if name in available]
        latin[preset] = {
            "latin": resolved_latin,
            "cjk": resolved_cjk,
            "math": mathset,
            "available": bool(resolved_latin),
        }
    cjk_found = sorted({name for name in available if any(hint in name.lower() for hint in _CJK_HINT)})
    _CACHE = {
        "presets": latin,
        "cjk_families": cjk_found,
        "cjk_available": bool(cjk_found),
        "font_count": len(available),
    }
    return _CACHE


def resolve_family(preset: str = "arial") -> tuple[list[str], str]:
    """Return (font.family list, mathtext.fontset) for a preset."""
    info = FONT_PRESETS.get(preset) or FONT_PRESETS["arial"]
    latin_c, cjk_c, mathset, _zh, _en = info
    available = available_families()

    families: list[str] = []
    for name in latin_c:
        if name in available and name not in families:
            families.append(name)
    for name in cjk_c:
        if name in available and name not in families:
            families.append(name)
    if not families:
        families = ["DejaVu Sans"]
    return families, mathset


def family_label(preset: str) -> tuple[str, str]:
    info = FONT_PRESETS.get(preset) or FONT_PRESETS["arial"]
    return info[3], info[4]


def list_presets() -> list[dict]:
    detected = detect()
    rows = []
    for preset, (_latin, _cjk, _math, zh, en) in FONT_PRESETS.items():
        info = detected["presets"][preset]
        rows.append(
            {
                "id": preset,
                "name_zh": zh,
                "name_en": en,
                "latin": info["latin"],
                "cjk": info["cjk"],
                "math": info["math"],
                "available": info["available"],
            }
        )
    return rows
