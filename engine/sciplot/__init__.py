"""dsh-sci-plot — publication-grade scientific plotting engine.

Public surface used by the Node host:

    python -m sciplot.cli <command>   # JSON in / JSON out

The Python package is deliberately dependency-light: numpy + matplotlib are
required, while scipy (KDE, clustering, fits) and Pillow (thumbnails, TIFF) are
used only when installed.
"""
from __future__ import annotations

__version__ = "1.0.0"
