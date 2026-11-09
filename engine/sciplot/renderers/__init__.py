"""Renderer modules.

Every module in this package registers chart kinds with
``sciplot.registry.register`` at import time.  A broken module is reported by
``registry.load()`` and never prevents the other charts from rendering.
"""
