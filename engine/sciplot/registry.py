"""Chart-kind registry.

A renderer module calls::

    @register("line", zh="折线图", en="Line chart", category="basic",
              summary_zh="...", demo={...}, options=[...])
    def render_line(ctx): ...

The registry is populated by :func:`load` which imports every module in
``sciplot.renderers``. Missing or broken modules are recorded but never make the
whole engine fail.
"""
from __future__ import annotations

from dataclasses import dataclass, field

CATEGORIES = {
    "basic": {"name_zh": "基础图形", "name_en": "Basics"},
    "statistics": {"name_zh": "统计分布", "name_en": "Statistics & distributions"},
    "biomedical": {"name_zh": "生物医学", "name_en": "Biomedical"},
    "physical": {"name_zh": "物理化学", "name_en": "Physical sciences"},
    "engineering": {"name_zh": "工程信号", "name_en": "Engineering & signals"},
    "economics": {"name_zh": "经济金融", "name_en": "Economics & finance"},
    "ml": {"name_zh": "机器学习", "name_en": "Machine learning"},
    "composite": {"name_zh": "复合排版", "name_en": "Composites"},
}

# Modules are imported in this order; unknown modules are skipped.
MODULES = (
    "basic",
    "statistics",
    "biomedical",
    "physical",
    "engineering",
    "economics",
    "ml",
    "composite",
)


@dataclass
class Renderer:
    kind: str
    zh: str
    en: str
    category: str
    fn: object
    summary_zh: str = ""
    summary_en: str = ""
    options: list = field(default_factory=list)
    aspect: float | None = None
    demo: dict | None = None
    tags: list = field(default_factory=list)
    aliases: list = field(default_factory=list)
    notes_zh: str = ""
    notes_en: str = ""

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "name_zh": self.zh,
            "name_en": self.en,
            "category": self.category,
            "summary_zh": self.summary_zh,
            "summary_en": self.summary_en,
            "options": self.options,
            "aspect": self.aspect,
            "demo": self.demo,
            "tags": self.tags,
            "aliases": self.aliases,
            "notes_zh": self.notes_zh,
            "notes_en": self.notes_en,
        }


KINDS: dict[str, Renderer] = {}
ALIASES: dict[str, str] = {}
LOAD_ERRORS: list[str] = []


def register(
    kind: str,
    *,
    zh: str,
    en: str,
    category: str,
    summary_zh: str = "",
    summary_en: str = "",
    options: list | None = None,
    aspect: float | None = None,
    demo: dict | None = None,
    tags: list | None = None,
    aliases: list | None = None,
    notes_zh: str = "",
    notes_en: str = "",
):
    if category not in CATEGORIES:
        category = "basic"

    def decorator(fn):
        renderer = Renderer(
            kind=kind,
            zh=zh,
            en=en,
            category=category,
            fn=fn,
            summary_zh=summary_zh,
            summary_en=summary_en,
            options=list(options or []),
            aspect=aspect,
            demo=demo,
            tags=list(tags or []),
            aliases=list(aliases or []),
            notes_zh=notes_zh,
            notes_en=notes_en,
        )
        KINDS[kind] = renderer
        for alias in renderer.aliases:
            ALIASES[str(alias)] = kind
        return fn

    return decorator


def get(kind: str) -> Renderer | None:
    if kind in KINDS:
        return KINDS[kind]
    canonical = ALIASES.get(kind)
    if canonical:
        return KINDS.get(canonical)
    return None


def load() -> list[str]:
    """Import every renderer module; returns a list of errors (empty = fine)."""
    if KINDS:
        return list(LOAD_ERRORS)
    LOAD_ERRORS.clear()
    import importlib

    from . import renderers as package

    for name in MODULES:
        try:
            importlib.import_module(f"{package.__name__}.{name}")
        except Exception as error:  # pragma: no cover - protective
            LOAD_ERRORS.append(f"{name}: {type(error).__name__}: {error}")
    if not KINDS:
        LOAD_ERRORS.append("no renderer modules were found")
    return list(LOAD_ERRORS)


def catalog() -> list[dict]:
    """Grouped catalogue for tools and the panel."""
    groups = []
    for cid, meta in CATEGORIES.items():
        kinds = [renderer.to_dict() for renderer in KINDS.values() if renderer.category == cid]
        if not kinds:
            continue
        groups.append({"id": cid, "name_zh": meta["name_zh"], "name_en": meta["name_en"], "kinds": kinds})
    return groups


def kind_list() -> list[str]:
    return list(KINDS.keys())
