"""Vector/raster export with journal-safe settings.

PNG is always written (panel preview), plus every requested format. PDF/EPS use
Type 42 TrueType outlines so text stays editable in Illustrator/Inkscape;
TIFF uses LZW compression for journal submission systems.
"""
from __future__ import annotations

import io
import os

from matplotlib.figure import Figure


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def export_figure(
    fig: Figure,
    out_dir: str,
    basename: str,
    *,
    dpi: int = 300,
    formats: list[str] | None = None,
    transparent: bool = False,
    title: str = "",
    kind: str = "",
) -> dict:
    _ensure_dir(out_dir)
    formats = [str(f).lower() for f in (formats or ["png"])]
    files: dict[str, str] = {}
    sizes: dict[str, int] = {}
    doc_title = title or basename
    # Backends disagree about metadata keys: pass only what each one accepts.
    meta_raster = {"Title": doc_title, "Author": "dsh-sci-plot", "Software": "dsh-sci-plot"}
    meta_vector = {"Title": doc_title, "Creator": "dsh-sci-plot", "Producer": "dsh-sci-plot"}
    meta_svg = {"Title": doc_title, "Creator": "dsh-sci-plot"}
    save_kwargs = dict(
        bbox_inches="tight",
        pad_inches=0.02,
        facecolor="none" if transparent else fig.get_facecolor(),
        edgecolor="none",
    )

    # Always produce a PNG: it seeds the preview, the thumbnail and the pixel size.
    png_path = os.path.join(out_dir, f"{basename}.png")
    fig.savefig(png_path, format="png", dpi=dpi, metadata=meta_raster, **save_kwargs)
    files["png"] = png_path
    sizes["png"] = os.path.getsize(png_path)

    # Thumbnail for the gallery (long edge <= 900 px, generous quality).
    thumb_path = os.path.join(out_dir, f"{basename}.thumb.png")
    try:
        from PIL import Image

        with Image.open(png_path) as image:
            image = image.convert("RGBA" if transparent else "RGB")
            image.thumbnail((900, 900), Image.LANCZOS)
            if transparent:
                image.save(thumb_path, "PNG")
            else:
                image.save(thumb_path, "PNG", optimize=True)
        files["thumb"] = thumb_path
    except Exception:
        files["thumb"] = png_path

    if "svg" in formats:
        path = os.path.join(out_dir, f"{basename}.svg")
        fig.savefig(path, format="svg", metadata=meta_svg, **save_kwargs)
        files["svg"] = path
        sizes["svg"] = os.path.getsize(path)
    if "pdf" in formats:
        path = os.path.join(out_dir, f"{basename}.pdf")
        fig.savefig(path, format="pdf", metadata=meta_vector, **save_kwargs)
        files["pdf"] = path
        sizes["pdf"] = os.path.getsize(path)
    if "eps" in formats:
        path = os.path.join(out_dir, f"{basename}.eps")
        fig.savefig(path, format="eps", metadata=meta_vector, **save_kwargs)
        files["eps"] = path
        sizes["eps"] = os.path.getsize(path)
    if "tiff" in formats:
        path = os.path.join(out_dir, f"{basename}.tiff")
        fig.savefig(path, format="tiff", dpi=dpi, pil_kwargs={"compression": "tiff_lzw"}, **save_kwargs)
        files["tiff"] = path
        sizes["tiff"] = os.path.getsize(path)
    if "jpg" in formats:
        path = os.path.join(out_dir, f"{basename}.jpg")
        fig.savefig(path, format="jpg", dpi=dpi, pil_kwargs={"quality": 95, "optimize": True}, **save_kwargs)
        files["jpg"] = path
        sizes["jpg"] = os.path.getsize(path)

    width_px, height_px = _png_size(png_path)
    return {
        "files": files,
        "sizes": sizes,
        "width_px": width_px,
        "height_px": height_px,
        "formats": ["png"] + [f for f in ("svg", "pdf", "eps", "tiff", "jpg") if f in files],
        "transparent": bool(transparent),
    }


def _png_size(path: str) -> tuple[int, int]:
    try:
        from PIL import Image

        with Image.open(path) as image:
            return int(image.width), int(image.height)
    except Exception:
        pass
    try:
        with open(path, "rb") as handle:
            data = handle.read(33)
        if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
            width = int.from_bytes(data[16:20], "big")
            height = int.from_bytes(data[20:24], "big")
            return width, height
    except Exception:
        pass
    return 0, 0


def svg_bytes(fig: Figure, **kwargs) -> bytes:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="svg", bbox_inches="tight", pad_inches=0.02, **kwargs)
    return buffer.getvalue()
