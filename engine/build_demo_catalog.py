"""Build `engine/demo_catalog.json` — the curated hero-figure gallery.

The catalog is explicit (not auto-generated from demos) so every gallery figure
shows a deliberate domain/journal pairing. Run this after renderers change, then
render with `python -m sciplot.cli gallery --catalog engine/demo_catalog.json`.

Usage: python engine/build_demo_catalog.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from sciplot.registry import get as get_kind, load as load_renderers  # noqa: E402

load_renderers()

# id, kind, sample, style, labels, options, title_zh/en, note_zh/en
FIGURES = [
    (
        "nature-growth",
        "line",
        "growth",
        {"domain": "life-science", "journal": "nature"},
        {"x": "Time (h)", "y": "OD$_{600}$"},
        {"marker": True, "band": False},
        "生长曲线（Nature 单栏）",
        "Growth curves (Nature single column)",
        "三组条件的生长动力学，开放式坐标轴与 NPG 配色。",
        "Growth kinetics of three conditions with open axes and the NPG palette.",
    ),
    (
        "aps-multiline",
        "multiline",
        "growth",
        {"domain": "physics", "journal": "aps"},
        {"x": "Time (h)", "y": "OD$_{600}$"},
        {"markers": True, "linestyles": True},
        "APS 多序列折线",
        "Multi-series lines (APS)",
        "Times 字体、内向主次刻度与线型/标记双重编码。",
        "Times text, inward major/minor ticks, marker + line-style encoding.",
    ),
    (
        "nature-volcano",
        "volcano",
        "bio_volcano_de",
        {"domain": "omics", "journal": "nature"},
        {"x": "log$_2$ fold change", "y": "$-$log$_{10}$ $P$", "legend": "Differential expression"},
        {"label_top": 5},
        "差异表达火山图",
        "Differential-expression volcano",
        "阈值线、上调/下调/不显著配色与 top 基因标注。",
        "Threshold guides, up/down/NS colours and top-gene labels.",
    ),
    (
        "nejm-km",
        "km_survival",
        "bio_survival",
        {"domain": "clinical", "journal": "nejm"},
        {"x": "Time since randomisation (months)", "y": "Overall survival (%)"},
        {"risk_interval": 6},
        "Kaplan-Meier 生存曲线",
        "Kaplan-Meier survival curve",
        "删失刻度、风险人数表与 log-rank 检验。",
        "Censoring marks, number-at-risk table and log-rank test.",
    ),
    (
        "lancet-forest",
        "forest",
        "bio_forest",
        {"domain": "clinical", "journal": "lancet"},
        {"x": "Hazard ratio (95% CI)", "y": "Study"},
        {"logx": True, "show_overall": True},
        "森林图（Lancet）",
        "Forest plot (Lancet)",
        "研究名/HR 文本列、权重方块、无效线与合并菱形。",
        "Study labels, HR text column, weighted squares, null line and pooled diamond.",
    ),
    (
        "nature-dose",
        "dose_response",
        "bio_dose",
        {"domain": "life-science", "journal": "nature"},
        {"x": "Concentration (µM)", "y": "Normalised viability (%)"},
        {"logx": True, "show_band": True, "show_ec50": True},
        "剂量-反应曲线",
        "Dose-response curves",
        "4PL 拟合、95% 置信带与 EC50 标注。",
        "4PL fits with 95% confidence bands and EC50 annotations.",
    ),
    (
        "nejm-roc",
        "roc",
        "bio_roc",
        {"domain": "clinical", "journal": "nejm"},
        {"x": "1 − specificity", "y": "Sensitivity"},
        {},
        "ROC 曲线",
        "ROC curves",
        "多模型 ROC、机会对角线与 AUC。",
        "Multi-model ROC with chance diagonal and AUC.",
    ),
    (
        "cell-multipanel",
        "multi_panel",
        None,
        {"domain": "life-science", "journal": "cell"},
        {},
        {"ncols": 2, "panel_letters": True},
        "六面板复合图（Cell）",
        "Six-panel composite (Cell)",
        "生长、相关、柱状、箱线、热图、分组柱的 A–F 排版。",
        "A-F layout of growth, correlation, bars, box, heatmap and grouped bars.",
    ),
    (
        "nature-cluster",
        "cluster_heatmap",
        "omics_expression",
        {"domain": "omics", "journal": "nature"},
        {"colorbar": "Row z-score", "x": "Sample", "y": "Gene"},
        {"zscore": True, "cluster": True, "show_dendrogram": True},
        "聚类热图",
        "Clustered heatmap",
        "双向树状图、行 z-score 与发散色标。",
        "Two-way dendrograms, row z-scores and a diverging map.",
    ),
    (
        "nature-corr",
        "corr_heatmap",
        "correlation",
        {"domain": "clinical", "journal": "nature"},
        {"x": "Metabolic marker", "colorbar": "Pearson r"},
        {"method": "pearson", "triangle": True, "annot": True},
        "代谢指标相关矩阵",
        "Metabolic correlation matrix",
        "下三角系数、0 居中的发散色标。",
        "Lower-triangle coefficients on a zero-centred diverging map.",
    ),
    (
        "apa-likert",
        "likert",
        "stats_likert",
        {"domain": "social", "journal": "apa"},
        {"x": "Share of respondents (%)"},
        {"percent": True, "wrap": 30},
        "李克特量表（APA）",
        "Likert scale (APA)",
        "发散堆叠条、中性段 0 对齐与图级图例。",
        "Diverging stacked bars with a neutral zero and a figure-level legend.",
    ),
    (
        "acs-spectra",
        "spectra",
        "phys_spectra",
        {"domain": "chemistry", "journal": "acs"},
        {"x": "Wavenumber (cm$^{-1}$)", "y": "Absorbance (a.u.)"},
        {"normalize": True, "offset": 0.24, "peaks": True, "peak_count": 3, "xreversed": True},
        "红外/拉曼光谱",
        "IR / Raman spectra",
        "多曲线堆叠、峰位标注与反向波数轴。",
        "Stacked spectra, peak labels and a reversed wavenumber axis.",
    ),
    (
        "rsc-xrd",
        "xrd",
        "phys_xrd",
        {"domain": "materials", "journal": "rsc"},
        {"x": "2$\\theta$ (deg)", "y": "Intensity (a.u.)"},
        {"stack": 1, "annotate": True, "refs": "anatase"},
        "X 射线衍射谱",
        "X-ray diffraction patterns",
        "堆叠谱线、峰位与参考卡片。",
        "Stacked patterns with peak labels and a reference card.",
    ),
    (
        "acs-cv",
        "cv",
        "phys_cv",
        {"domain": "chemistry", "journal": "acs"},
        {"x": "Potential (V vs Ag/AgCl)", "y": "Current (µA)"},
        {"arrows": True, "peaks": True},
        "循环伏安曲线",
        "Cyclic voltammetry",
        "闭合回线、扫描方向与 Epa/Epc 标注。",
        "Closed loops, scan direction and Epa/Epc annotations.",
    ),
    (
        "springer-tga",
        "tga",
        "phys_tga",
        {"domain": "chemistry", "journal": "springer"},
        {"x": "Temperature (°C)", "y": "Weight (%)", "y2": "Heat flow (mW mg$^{-1}$)"},
        {"annotate": True, "smooth": 7},
        "热重-热流联用",
        "TGA with heat flow",
        "双轴颜色对应、分解温度与残余量标注。",
        "Colour-matched dual axes with decomposition and residue annotations.",
    ),
    (
        "agu-windrose",
        "windrose",
        "phys_wind",
        {"domain": "earth", "journal": "agu"},
        {"x": "Direction", "y": "Frequency (%)", "legend": "Wind speed (m s$^{-1}$)"},
        {"nbins": 16, "calm": 0.5},
        "风玫瑰图",
        "Wind rose",
        "16 方位频率、风速分层与样本量注释。",
        "16-sector frequencies stacked by wind speed with sample-size notes.",
    ),
    (
        "elsevier-contour",
        "contour",
        "phys_contour",
        {"domain": "materials", "journal": "elsevier"},
        {"x": "x (mm)", "y": "y (mm)", "colorbar": "Energy (eV)"},
        {"filled": True, "labels": True, "levels": 14},
        "能量等值线场",
        "Energy contour field",
        "填充等值线、等高线标签与色标。",
        "Filled contours, inline labels and a colour bar.",
    ),
    (
        "materials-surface3d",
        "surface3d",
        "phys_contour",
        {"domain": "materials", "journal": "springer"},
        {"x": "x (mm)", "y": "y (mm)", "colorbar": "Energy (eV)"},
        {"elev": 32, "azim": -58},
        "三维势能面",
        "3D potential surface",
        "视角、色标与坐标单位完整的三维曲面。",
        "A 3D surface with a deliberate camera, colour bar and units.",
    ),
    (
        "ieee-bode",
        "bode",
        "eng_bode",
        {"domain": "engineering", "journal": "ieee"},
        {"x": "Frequency (Hz)", "y": "Magnitude (dB)", "y2": "Phase (deg)"},
        {"annotate": True, "grid": True},
        "Bode 幅频/相频图",
        "Bode magnitude and phase",
        "对数频率轴、双面板与 fc/PM 注释。",
        "Log-frequency axes, stacked panels, fc/PM annotations.",
    ),
    (
        "neurips-training",
        "training_curves",
        "ml_training",
        {"domain": "ml", "journal": "neurips"},
        {"x": "Epoch", "y": "Cross-entropy loss", "legend": "Split"},
        {"yscale": "log", "band": True, "markers": True},
        "训练曲线（NeurIPS）",
        "Training curves (NeurIPS)",
        "多 seed 均值±标准差带、对数损失轴。",
        "Multi-seed mean±SD bands on a log-loss axis.",
    ),
    (
        "nature-pca",
        "pca",
        "omics_pca",
        {"domain": "omics", "journal": "nature"},
        {"x": "PC1", "y": "PC2"},
        {"standardize": True, "ellipse": True, "centroid": True},
        "主成分分析双标图",
        "PCA score plot",
        "分组散点、95% 置信椭圆与解释方差轴。",
        "Grouped scores, 95% ellipses and variance-explained axes.",
    ),
    (
        "elsevier-fan",
        "fan_chart",
        "econ_fan",
        {"domain": "economics", "journal": "elsevier"},
        {"x": "Month", "y": "CPI inflation (%)"},
        {"legend": True},
        "扇形预测区间",
        "Fan chart",
        "50/80/95% 分层区间与中位数路径。",
        "Layered 50/80/95% intervals around the median path.",
    ),
    (
        "elsevier-waterfall",
        "waterfall",
        "econ_waterfall",
        {"domain": "economics", "journal": "elsevier"},
        {"x": "", "y": "USD millions", "total": "Net income"},
        {"show_total": True, "value_labels": True},
        "瀑布图",
        "Waterfall chart",
        "累计连接、正负配色与总值。",
        "Cumulative connectors, signed colours and a total bar.",
    ),
    (
        "nature-manhattan",
        "manhattan",
        "bio_manhattan",
        {"domain": "omics", "journal": "nature"},
        {"x": "Chromosome", "y": "$-$log$_{10}$ $P$"},
        {"label_top": 4},
        "曼哈顿图",
        "Manhattan plot",
        "染色体交替配色、显著性阈值与 lead SNP。",
        "Alternating chromosome colours, significance threshold and lead SNPs.",
    ),
    (
        "nature-raincloud",
        "raincloud",
        "distributions",
        {"domain": "life-science", "journal": "nature"},
        {"x": "Genotype", "y": "Effect size (a.u.)"},
        {"cloud_width": 0.34, "rain_alpha": 0.55},
        "雨云图",
        "Raincloud plot",
        "半小提琴 + 箱线 + 抖动散点的组合分布图。",
        "Half-violin, box and jittered points in one distribution view.",
    ),
    (
        "apa-box",
        "box",
        "distributions",
        {"domain": "social", "journal": "apa"},
        {"x": "Genotype", "y": "Effect size (a.u.)"},
        {"points": True, "stats": True},
        "箱线图（APA）",
        "Box plot (APA)",
        "箱体、离群点、抖动点与样本量。",
        "Boxes, outliers, jittered points and sample sizes.",
    ),
    (
        "nature-scatter",
        "scatter",
        "scatter",
        {"domain": "omics", "journal": "nature"},
        {"x": "Gene expression (log$_2$ TPM)", "y": "Protein abundance (log$_2$)"},
        {"regression": True, "ci": True, "stats": True},
        "相关散点与回归带",
        "Correlation scatter with fit",
        "分组散点、95% 置信带与相关统计量。",
        "Grouped scatter, 95% CI band and correlation statistics.",
    ),
    (
        "cell-dot",
        "dot_plot",
        "omics_dot",
        {"domain": "omics", "journal": "cell"},
        {"x": "Cluster", "y": "Gene", "colorbar": "Mean expression"},
        {},
        "单细胞标记点图",
        "Single-cell dot plot",
        "点大小=表达比例、颜色=平均表达的双编码。",
        "Dot size for fraction and colour for mean expression.",
    ),
    (
        "agu-heatmap",
        "heatmap",
        "phys_heatmap",
        {"domain": "earth", "journal": "agu"},
        {"x": "x (µm)", "y": "y (µm)", "colorbar": "Phase fraction"},
        {},
        "空间相分数热图",
        "Spatial phase-fraction heatmap",
        "网格化空间场与物理量色标。",
        "Gridded spatial field with a physical colour bar.",
    ),
    (
        "aps-taylor",
        "taylor",
        "phys_taylor",
        {"domain": "physics", "journal": "aps"},
        {"x": "Normalised standard deviation", "y": "Correlation"},
        {},
        "Taylor 图（APS）",
        "Taylor diagram (APS)",
        "相关角、RMSD 同心圆与模型点。",
        "Correlation angle, RMSD arcs and model points.",
    ),
]


def main() -> int:
    entries = []
    missing = []
    for fid, kind, sample, style, labels, options, title_zh, title_en, note_zh, note_en in FIGURES:
        renderer = get_kind(kind)
        if renderer is None:
            missing.append(kind)
            continue
        demo = renderer.demo if isinstance(renderer.demo, dict) else {}
        if sample is None:
            data = json.loads(json.dumps(demo.get("data") or {}))
            data.setdefault("sample", demo.get("data", {}).get("sample"))
        else:
            data = {"sample": sample}
            mapping = (demo.get("data") or {}).get("mapping") if isinstance(demo.get("data"), dict) else None
            if isinstance(mapping, dict) and mapping:
                data["mapping"] = json.loads(json.dumps(mapping))
            sample_meta = None
            try:
                from sciplot.samples import get_sample

                sample_meta = get_sample(sample)
            except Exception:
                sample_meta = None
            if sample_meta and sample_meta.get("mapping"):
                merged = dict(sample_meta["mapping"])
                merged.update(data.get("mapping") or {})
                data["mapping"] = merged
        merged_style = dict(demo.get("style") or {})
        merged_style.update(style)
        merged_labels = dict(demo.get("labels") or {})
        merged_labels.update(labels)
        merged_options = dict(demo.get("options") or {})
        merged_options.update(options)
        entries.append(
            {
                "id": fid,
                "title_zh": title_zh,
                "title_en": title_en,
                "note_zh": note_zh,
                "note_en": note_en,
                "spec": {
                    "kind": kind,
                    "data": data,
                    "style": merged_style,
                    "labels": merged_labels,
                    "options": merged_options,
                    "output": {"formats": ["png", "svg", "pdf"], "basename": fid},
                },
            }
        )
    payload = {"version": 1, "figures": entries}
    target = ROOT / "demo_catalog.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {target} with {len(entries)} figures; missing kinds: {missing or 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
