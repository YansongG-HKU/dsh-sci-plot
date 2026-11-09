"""Publication-readiness checks for one rendered figure.

The score is not cosmetic: every deduction maps to a concrete, fixable property
(vector output, resolution, colour-blind distance, labels, overplotting, ...).
Results are returned in both Chinese and English so tools and panel agree.
"""
from __future__ import annotations

import math

import numpy as np

from . import palettes


FONT_MIN_PT = 6.0
CVD_PASS = 15.0
CVD_OK = 8.0


def _check(checks, cid, status, zh, en, detail=None):
    checks.append({"id": cid, "status": status, "message_zh": zh, "message_en": en, "detail": detail or ""})


def evaluate(fig, ctx, files: dict, formats: list[str], dpi: int, warnings: list[str] | None = None) -> dict:
    checks: list[dict] = []
    warnings = list(warnings or [])

    # 1. Vector output -----------------------------------------------------
    vector = [fmt for fmt in ("svg", "pdf", "eps") if fmt in files]
    if vector:
        _check(checks, "vector", "pass", f"已导出矢量格式：{', '.join(vector).upper()}", f"Vector output: {', '.join(vector).upper()}")
    elif "pdf" in formats or "svg" in formats:
        _check(checks, "vector", "warn", "请求了矢量格式但未写出文件", "Vector formats were requested but no file was written")
    else:
        _check(checks, "vector", "info", "当前只有位图输出；投稿建议同时导出 PDF/SVG", "Raster only; add PDF/SVG for submission")

    # 2. Resolution --------------------------------------------------------
    if dpi >= 600:
        _check(checks, "resolution", "pass", f"位图分辨率 {dpi} dpi（印刷级）", f"Raster resolution {dpi} dpi (print grade)")
    elif dpi >= 300:
        _check(checks, "resolution", "pass", f"位图分辨率 {dpi} dpi（期刊常用下限）", f"Raster resolution {dpi} dpi (journal minimum)")
    elif dpi >= 150:
        _check(checks, "resolution", "warn", f"位图分辨率 {dpi} dpi 偏低", f"Raster resolution {dpi} dpi is low")
    else:
        _check(checks, "resolution", "fail", f"位图分辨率 {dpi} dpi 不满足期刊要求", f"Raster resolution {dpi} dpi is below journal requirements")

    # 3. Font sizes --------------------------------------------------------
    rc = ctx.style.get("rc", {})
    sizes = [float(rc.get(key, 0) or 0) for key in ("font.size", "axes.labelsize", "axes.titlesize", "legend.fontsize", "xtick.labelsize", "ytick.labelsize")]
    sizes = [size for size in sizes if size > 0]
    min_size = min(sizes) if sizes else 0.0
    if min_size >= FONT_MIN_PT:
        _check(checks, "font_size", "pass", f"最小字号 {min_size:.1f} pt，满足印刷可读性", f"Smallest text {min_size:.1f} pt is print readable")
    else:
        _check(checks, "font_size", "warn", f"最小字号 {min_size:.1f} pt 低于 6 pt", f"Smallest text {min_size:.1f} pt is below 6 pt")

    # 4. Font embedding ----------------------------------------------------
    if float(rc.get("pdf.fonttype", 42)) == 42:
        _check(checks, "font_embed", "pass", "PDF/EPS 使用 Type 42 字体（可编辑矢量文字）", "PDF/EPS use Type 42 fonts (editable vector text)")
    else:
        _check(checks, "font_embed", "warn", "字体未使用 Type 42，投稿系统可能拒收", "Fonts are not Type 42; submission systems may reject the file")

    # 5. Colour-blind safety ----------------------------------------------
    used = list(dict.fromkeys(ctx.used_colors or []))
    if len(used) >= 2:
        quality = palettes.palette_quality(used)
        worst = quality["min_delta_e"]
        if worst >= CVD_PASS:
            _check(checks, "colorblind", "pass", f"配色色盲安全（最差色差 ΔE {worst:.1f}）", f"Colour-blind safe (worst ΔE {worst:.1f})", {"min_delta_e": worst, "palette": ctx.style.get("palette")})
        elif worst >= CVD_OK:
            _check(checks, "colorblind", "info", f"配色基本可辨（最差色差 ΔE {worst:.1f}，建议 ≥20）", f"Colour distinction is acceptable (worst ΔE {worst:.1f}, target ≥20)", {"min_delta_e": worst})
        else:
            _check(checks, "colorblind", "warn", f"色盲模拟下部分颜色过近（最差 ΔE {worst:.1f}）", f"Some colours are too close under CVD simulation (worst ΔE {worst:.1f})", {"min_delta_e": worst})
    else:
        _check(checks, "colorblind", "pass", "单色/双色图形，无颜色混淆风险", "Single-colour figure: no colour confusion risk")

    # 6. Legends -----------------------------------------------------------
    axes = [ax for ax in (ctx.axes if ctx.fig is not None else []) if ax.get_visible()]
    labelled_axes = [ax for ax in axes if len(ax.get_legend_handles_labels()[0]) > 1]
    legend_axes = [ax for ax in labelled_axes if ax.get_legend() is not None]
    has_fig_legend = ctx.fig is not None and ctx.fig.legends and any(getattr(leg, "get_visible", lambda: False)() for leg in ctx.fig.legends)
    if not labelled_axes:
        _check(checks, "legend", "pass", "图形无多序列，无需图例", "No multi-series content, no legend needed")
    elif legend_axes or has_fig_legend:
        _check(checks, "legend", "pass", "多序列图形已提供图例", "Legend present for multi-series content")
    else:
        _check(checks, "legend", "warn", "多个序列但没有图例，读者无法区分", "Multiple series without a legend")

    # 7. Axis labels -------------------------------------------------------
    missing = []
    for ax in axes:
        if not ax.get_visible() or not ax.axison:
            continue
        has_artists = bool(ax.get_lines() or ax.patches or ax.collections or ax.images)
        if not has_artists:
            continue
        if not str(ax.get_xlabel()).strip() and not str(ax.get_ylabel()).strip():
            missing.append(ax)
    if axes:
        if not missing:
            _check(checks, "labels", "pass", "所有坐标轴均有变量/单位标签", "Every data axis carries a variable/unit label")
        else:
            _check(checks, "labels", "warn", f"{len(missing)} 个子图缺少坐标轴标签（变量+单位）", f"{len(missing)} axes miss variable/unit labels", {"axes": len(missing)})

    # 8. Empty axes --------------------------------------------------------
    empty = []
    for ax in axes:
        if not ax.get_visible() or not ax.axison:
            continue
        if not (ax.get_lines() or ax.patches or ax.collections or ax.images or ax.get_children() and any(getattr(c, "get_window_extent", None) and type(c).__name__ in ("Text", "Annotation") for c in ax.get_children())):
            empty.append(ax)
    if empty:
        _check(checks, "empty_axes", "fail", f"{len(empty)} 个子图为空", f"{len(empty)} axes are empty")
    else:
        _check(checks, "empty_axes", "pass", "所有子图均含数据图元", "No empty axes")

    # 9. Colorbar ----------------------------------------------------------
    has_image = any(ax.images for ax in axes)
    if has_image:
        _ = any(ax.get_label() and ax.get_label() != "<colorbar>" for ax in axes)
        cbar_ok = False
        for ax in axes:
            if ax.get_label() == "<colorbar>":
                label = str(ax.get_ylabel()).strip()
                cbar_ok = bool(label)
        if cbar_ok:
            _check(checks, "colorbar", "pass", "色标带有物理量/单位标签", "Colour bar carries a quantity/unit label")
        else:
            _check(checks, "colorbar", "warn", "色标缺少物理量标签", "Colour bar misses a quantity label")

    # 10. Tick crowding ----------------------------------------------------
    crowded = []
    for ax in axes:
        if not ax.get_visible() or not ax.axison:
            continue
        try:
            count = len(ax.get_xticklabels())
        except Exception:
            count = 0
        if count > 14:
            crowded.append(count)
    if crowded:
        _check(checks, "tick_density", "warn", f"横轴刻度过多（最多 {max(crowded)} 个），可能拥挤", f"Too many x ticks (max {max(crowded)}); labels may crowd")
    else:
        _check(checks, "tick_density", "pass", "刻度密度适中", "Tick density is reasonable")

    # 11. Overplotting -----------------------------------------------------
    overplot = False
    point_count = 0
    for ax in axes:
        for collection in ax.collections:
            try:
                offsets = collection.get_offsets()
                point_count += int(offsets.shape[0])
            except Exception:
                continue
        for line in ax.get_lines():
            try:
                point_count += int(line.get_xydata().shape[0])
            except Exception:
                continue
    if point_count > 20000:
        overplot = True
    if overplot:
        _check(checks, "overplot", "warn", f"数据点较多（约 {point_count} 个），建议降低透明度或使用密度表示", f"Many points (~{point_count}); consider alpha or density encoding")
    else:
        _check(checks, "overplot", "pass", "无过度绘制风险", "No overplotting risk")

    # 12. Figure usage -----------------------------------------------------
    try:
        if axes:
            total = 0.0
            for ax in axes:
                pos = ax.get_position()
                total += max(0.0, pos.width) * max(0.0, pos.height)
            if total < 0.32:
                _check(checks, "layout", "info", "绘图区占图幅比例偏低，可压缩留白", "Ink-to-figure ratio is low; whitespace could be trimmed")
            else:
                _check(checks, "layout", "pass", "图幅利用率良好", "Good ink-to-figure ratio")
        else:
            _check(checks, "layout", "info", "无法评估图幅利用率", "Could not evaluate ink-to-figure ratio")
    except Exception:
        _check(checks, "layout", "info", "无法评估图幅利用率", "Could not evaluate ink-to-figure ratio")

    # 13. Renderer warnings ------------------------------------------------
    glyph_warnings = [w for w in warnings if "missing from font" in w or "Glyph" in w or "findfont" in w]
    if glyph_warnings:
        _check(checks, "fonts_rendered", "fail", "渲染时出现缺字/字体回退警告：" + "；".join(glyph_warnings[:2]), "Missing-glyph/font-fallback warnings during rendering: " + "; ".join(glyph_warnings[:2]))
    else:
        _check(checks, "fonts_rendered", "pass", "无缺字或字体回退警告", "No missing-glyph or font-fallback warnings")
    other_warnings = [w for w in warnings if w not in glyph_warnings]
    if other_warnings:
        _check(checks, "render_warnings", "info", "渲染提示：" + "；".join(other_warnings[:2]), "Renderer notes: " + "; ".join(other_warnings[:2]))

    # Score ---------------------------------------------------------------
    points = 100.0
    for check in checks:
        status = check["status"]
        if status == "fail":
            points -= 18
        elif status == "warn":
            points -= 7
        elif status == "info":
            points -= 1.5
    score = int(max(0, min(100, round(points))))
    if score >= 92:
        grade = "A"
    elif score >= 82:
        grade = "B"
    elif score >= 70:
        grade = "C"
    else:
        grade = "D"
    counts = {status: sum(1 for c in checks if c["status"] == status) for status in ("pass", "warn", "fail", "info")}
    return {
        "score": score,
        "grade": grade,
        "checks": checks,
        "counts": counts,
        "summary_zh": _summary_zh(score, grade, counts),
        "summary_en": _summary_en(score, grade, counts),
    }


def _summary_zh(score, grade, counts) -> str:
    if grade == "A":
        return f"投稿就绪度 {score}/100：可直接用于期刊投稿或汇报。"
    if grade == "B":
        return f"投稿就绪度 {score}/100：整体可用，建议处理 {counts.get('warn', 0)} 项提示。"
    if grade == "C":
        return f"投稿就绪度 {score}/100：存在 {counts.get('warn', 0)} 项提示与 {counts.get('fail', 0)} 项问题，建议修正后再投稿。"
    return f"投稿就绪度 {score}/100：有多项硬性问题，请查看逐项结果。"


def _summary_en(score, grade, counts) -> str:
    if grade == "A":
        return f"Submission readiness {score}/100: ready for a journal or a talk."
    if grade == "B":
        return f"Submission readiness {score}/100: usable; address {counts.get('warn', 0)} note(s)."
    if grade == "C":
        return f"Submission readiness {score}/100: {counts.get('warn', 0)} note(s) and {counts.get('fail', 0)} issue(s) to fix."
    return f"Submission readiness {score}/100: several blocking issues; review the checklist."
