/**
 * dsh-sci-plot — 00-head
 *
 * Loader wrapper, protocol constants, zh/en dictionaries, HTTP helpers,
 * framework-free pure helpers (exposed through __test__ in 07-apply), host
 * theme detection, the inline SVG mark and icon set.
 *
 * The shipped client is one dependency-free file assembled by
 * scripts/build-client.mjs from the fragments in src/client/ in filename order.
 * React is the only import and it always comes from require("react").
 */
window.__ModuleLoader__.load({
  id: "dsh-sci-plot",
  factory: (require) => {
    const react = require("react")
    const h = react.createElement
    const { useState, useEffect, useRef, useCallback, useMemo } = react

    /* ------------------------------------------------------------------ */
    /* Identity and protocol constants                                    */
    /* ------------------------------------------------------------------ */

    const NS = "dsh-sci-plot"
    const API_BASE = "/dsh-sci-plot"
    const REQ_HEADER = "x-dsh-sci-plot"
    const VERSION = "1.2.0"
    const LANG_KEY = "dsh-sci-plot.lang"

    /** Artwork colours are fixed: they belong to the figure, not the theme. */
    const INK_BLUE = "#2c5f8a"
    const OCHRE = "#b4552f"
    const INK = "#111111"
    const CHART_PAPER = "#ffffff"

    const FORMATS = ["png", "svg", "pdf", "tiff"]
    const FORMAT_LABEL = { png: "PNG", svg: "SVG", pdf: "PDF", tiff: "TIFF" }
    const DEFAULT_FORMATS = ["png", "svg"]
    const DEFAULT_DPI = 300

    const VIEWS = [
      { id: "gallery", icon: "gallery", labelKey: "navGallery" },
      { id: "studio", icon: "sliders", labelKey: "navStudio" },
      { id: "library", icon: "palette", labelKey: "navLibrary" },
      { id: "data", icon: "database", labelKey: "navData" },
      { id: "settings", icon: "settings", labelKey: "navSettings" },
    ]

    const STYLE_KEYS = [
      "domain",
      "journal",
      "palette",
      "cmap",
      "font",
      "size",
      "dpi",
      "grid",
      "legend",
      "transparent",
      "width_mm",
      "height_ratio",
    ]

    const MAPPING_KEYS = ["x", "y", "group", "yerr", "xerr", "size", "label", "time", "event"]
    const MAPPING_LABEL_KEYS = {
      x: "mappingX",
      y: "mappingY",
      group: "mappingGroup",
      yerr: "mappingYerr",
      xerr: "mappingXerr",
      size: "mappingSize",
      label: "mappingLabel",
      time: "mappingTime",
      event: "mappingEvent",
    }

    const QUALITY_STATUS = ["fail", "warn", "pass", "info"]
    const QUALITY_GRADE_TONE = { A: "ok", B: "info", C: "warn", D: "danger" }

    const CATEGORY_LABEL = {
      basic: ["基础图", "Basic"],
      statistics: ["统计", "Statistics"],
      biomedical: ["生物医学", "Biomedical"],
      physical: ["物理化学", "Physical"],
      engineering: ["工程信号", "Engineering"],
      economics: ["经济金融", "Economics"],
      ml: ["机器学习", "Machine learning"],
      composite: ["复合图", "Composite"],
    }

    const REQUEST_TIMEOUT_MS = 45000
    const RENDER_TIMEOUT_MS = 120000
    const EXPORT_TIMEOUT_MS = 180000
    const TOAST_MS = 3400

    /* ------------------------------------------------------------------ */
    /* Dictionary — every row keeps zh/en paired so the two stay in sync   */
    /* ------------------------------------------------------------------ */

    const TEXT_ENTRIES = [
      ["panel", "科研绘图", "Sci Plot"],
      ["appTitle", "科研绘图", "Scientific Plotting"],
      ["tagline", "样本 · 图种 · 期刊风格 · 质检", "Samples · kinds · journal style · QA"],
      ["navGallery", "画廊", "Gallery"],
      ["navStudio", "工作室", "Studio"],
      ["navLibrary", "风格库", "Style library"],
      ["navData", "数据", "Data"],
      ["navSettings", "设置", "Settings"],
      ["loading", "加载中…", "Loading…"],
      ["loadingPanel", "正在读取绘图引擎…", "Reading the plot engine…"],
      ["refresh", "刷新", "Refresh"],
      ["refreshing", "刷新中…", "Refreshing…"],
      ["retry", "重试", "Retry"],
      ["close", "关闭", "Close"],
      ["cancel", "取消", "Cancel"],
      ["copy", "复制", "Copy"],
      ["copied", "已复制", "Copied"],
      ["copyPath", "复制路径", "Copy path"],
      ["pathCopied", "路径已复制", "Path copied"],
      ["open", "打开", "Open"],
      ["download", "下载", "Download"],
      ["none", "无", "None"],
      ["optional", "可选", "optional"],
      ["unknown", "—", "—"],
      ["language", "语言", "Language"],
      ["engineOk", "引擎就绪", "Engine ready"],
      ["engineDown", "引擎不可用", "Engine offline"],
      ["engineUnknown", "引擎状态未知", "Engine status unknown"],
      ["engineChecking", "引擎检测中…", "Detecting engine…"],
      ["errorTitle", "连接渲染引擎失败", "Could not reach the render engine"],
      ["errorHint", "确认 dsh-sci-plot 服务已启动后重试。界面会保留已有数据。", "Check that the dsh-sci-plot service is running, then retry. Cached data stays visible."],
      ["errorApi", "接口返回错误：{message}", "Request failed: {message}"],
      ["errorNetwork", "网络请求失败：{message}", "Network request failed: {message}"],
      ["unknownError", "请求失败", "Request failed"],
      ["noData", "暂无数据", "No data yet"],
      ["toastRefreshed", "已刷新", "Refreshed"],
      ["toastCopyFailed", "复制失败", "Copy failed"],
      ["toastRevealFailed", "打开文件夹失败：{message}", "Could not open the folder: {message}"],
      ["toastRevealCopied", "无法直接打开，已复制路径", "Cannot open directly; path copied"],
      ["justNow", "刚刚", "just now"],
      ["minutesAgo", "{n} 分钟前", "{n} min ago"],
      ["hoursAgo", "{n} 小时前", "{n} h ago"],
      ["daysAgo", "{n} 天前", "{n} d ago"],
      ["today", "今天", "today"],

      /* gallery ------------------------------------------------------- */
      ["galleryTitle", "画廊", "Gallery"],
      ["gallerySubtitle", "引擎最近渲染的作品，按时间倒序排列。", "Figures rendered by the engine, newest first."],
      ["galleryCount", "{n} 张作品", "{n} figures"],
      ["newFigure", "新建绘图", "New figure"],
      ["filterKind", "图种", "Kind"],
      ["filterDomain", "领域", "Domain"],
      ["filterAll", "全部", "All"],
      ["filterClear", "清除筛选", "Clear filters"],
      ["filterCount", "显示 {shown} / {total}", "{shown} of {total}"],
      ["emptyGalleryTitle", "还没有作品", "No figures yet"],
      ["emptyGalleryBody", "在工作室里选一套样本数据与图种，渲染第一张可投稿的图。", "Pick a sample and a kind in the studio to render a journal-ready figure."],
      ["emptyGalleryAction", "去工作室", "Open studio"],
      ["emptyGallerySample", "用内置样本出图", "Render a built-in sample"],
      ["refGalleryTitle", "引擎参考图", "Engine samples"],
      ["refGalleryHint", "随引擎提供的示例资源，可作为风格参考。", "Assets shipped with the engine, useful as style references."],
      ["galleryMine", "我的作品", "My figures"],
      ["gallerySamples", "示例图集", "Sample gallery"],
      ["gallerySamplesCount", "{n} 张示例", "{n} samples"],
      ["gallerySamplesEmpty", "示例图集为空", "No sample figures"],
      ["gallerySamplesEmptyBody", "引擎没有返回示例图；稍后刷新画廊。", "The engine returned no sample figures; refresh the gallery later."],
      ["gallerySamplesHint", "引擎随附的期刊级示例，点击查看大图与风格。", "Journal-grade samples shipped with the engine. Open one for details and style."],
      ["sampleBack", "返回示例图集", "Back to samples"],
      ["sampleNote", "说明", "Note"],
      ["sampleStyle", "风格", "Style"],
      ["sampleQuality", "示例质量", "Sample quality"],
      ["sampleUseStyle", "用该风格新建绘图", "Start a figure with this style"],
      ["sampleStyleApplied", "已应用示例风格", "Sample style applied"],
      ["sampleOpenOriginal", "查看示例原图", "Open sample"],
      ["sampleUseStyleHint", "示例的领域、期刊、色板与画幅会带入工作室；数据与标题保留当前设置。", "The sample's domain, journal, palette and size go into the studio; data and title stay as they are."],
      ["sampleDetailLoading", "读取示例…", "Loading sample…"],
      ["detailBack", "返回画廊", "Back to gallery"],
      ["detailOpenOriginal", "查看原图", "Open original"],
      ["detailFullscreen", "全屏", "Fullscreen"],
      ["zoomIn", "放大", "Zoom in"],
      ["zoomOut", "缩小", "Zoom out"],
      ["zoomFit", "适应", "Fit"],
      ["zoomLabel", "{n}%", "{n}%"],
      ["overviewTitle", "概览", "Overview"],
      ["qualityTitle", "质量", "Quality"],
      ["qualityScore", "评分", "Score"],
      ["qualityGrade", "等级", "Grade"],
      ["qualitySummary", "摘要", "Summary"],
      ["qualityPass", "通过", "pass"],
      ["qualityWarn", "提示", "warn"],
      ["qualityFail", "问题", "fail"],
      ["qualityInfo", "说明", "info"],
      ["qualityCounts", "通过 {pass} · 提示 {warn} · 问题 {fail}", "pass {pass} · warn {warn} · fail {fail}"],
      ["noChecks", "没有质检项", "No checks"],
      ["warningsTitle", "渲染提示", "Render warnings"],
      ["exportTitle", "导出", "Export"],
      ["exportFormatPng", "PNG", "PNG"],
      ["exportFormatSvg", "SVG", "SVG"],
      ["exportFormatPdf", "PDF", "PDF"],
      ["exportFormatTiff", "TIFF", "TIFF"],
      ["exportingFormat", "正在导出 {format}…", "Exporting {format}…"],
      ["exportedFormat", "已导出 {format}", "Exported {format}"],
      ["exportFailed", "导出失败：{message}", "Export failed: {message}"],
      ["exportHint", "导出按期刊规格写入作品目录，完成后可下载。", "Exports are written next to the figure at journal size, then downloadable."],
      ["exportDpi", "DPI", "DPI"],
      ["exportWidth", "宽度 mm", "Width mm"],
      ["exportJournal", "期刊", "Journal"],
      ["filesTitle", "文件", "Files"],
      ["createdAt", "创建于", "Created"],
      ["durationLabel", "耗时", "Took"],
      ["sizeMmLabel", "尺寸", "Size"],
      ["dpiLabel", "DPI", "DPI"],
      ["figureMetaSize", "{w} × {h} mm · {dpi} dpi", "{w} × {h} mm · {dpi} dpi"],
      ["journalLabel", "期刊", "Journal"],
      ["domainLabel", "领域", "Domain"],
      ["domainField", "学科领域", "Domain"],
      ["journalField", "期刊预设", "Journal"],
      ["paletteField", "分类色板", "Palette"],
      ["cmapField", "连续色标", "Colormap"],
      ["fontField", "字体", "Font"],
      ["kindLabel", "图种", "Kind"],
      ["paletteLabel", "色板", "Palette"],
      ["cmapLabel", "色标", "Colormap"],
      ["fontLabel", "字体", "Font"],
      ["sizePresetLabel", "画幅", "Size"],
      ["formatsLabel", "格式", "Formats"],
      ["deleteFigure", "删除作品", "Delete figure"],
      ["deleteConfirm", "确认删除", "Confirm delete"],
      ["deleteConfirmBody", "删除这张图？导出的 PNG/SVG 文件会一起移除。", "Delete this figure? Its exported files are removed too."],
      ["deleting", "删除中…", "Deleting…"],
      ["toastDeleted", "已删除作品", "Figure deleted"],
      ["toastDeleteFailed", "删除失败：{message}", "Delete failed: {message}"],
      ["reveal", "在文件夹中显示", "Show in folder"],
      ["revealDone", "已请求打开文件夹", "Folder opened"],
      ["openStudio", "在工作室继续调参", "Continue in studio"],
      ["handoffChat", "在对话中继续", "Continue in chat"],
      ["handoffCopied", "已复制「继续改图」指令，回到对话粘贴发送即可", "Handoff prompt copied — paste it in the conversation"],
      ["figureLoading", "读取作品…", "Loading figure…"],
      ["figureNotFound", "没有找到这张作品", "Figure not found"],
      ["figureNoImage", "图片加载失败", "Image failed to load"],
      ["imageRetry", "重试", "Retry"],

      /* studio -------------------------------------------------------- */
      ["studioTitle", "工作室", "Studio"],
      ["studioSubtitle", "从数据到可投稿的成品图：选数据、选图种、调风格、渲染。", "From data to a submission-ready figure: data, kind, style, render."],
      ["dataSection", "数据源", "Data"],
      ["dataSample", "内置样本", "Built-in sample"],
      ["dataWorkspace", "工作区 CSV", "Workspace CSV"],
      ["dataPaste", "粘贴数据", "Paste data"],
      ["sampleField", "样本数据集", "Sample dataset"],
      ["workspaceField", "工作区文件", "Workspace file"],
      ["noWorkspaceFiles", "工作区里没有 CSV 文件，刷新数据视图后再试。", "No CSV files in the workspace. Refresh the Data view and retry."],
      ["pasteHint", "粘贴 series / matrix / rows+mapping JSON。", "Paste series / matrix / rows+mapping JSON."],
      ["pastePlaceholder", "{ \"series\": [ { \"name\": \"A\", \"x\": [0, 1, 2], \"y\": [0, 1, 4] } ] }", "{ \"series\": [ { \"name\": \"A\", \"x\": [0, 1, 2], \"y\": [0, 1, 4] } ] }"],
      ["pasteExample", "载入示例结构", "Load an example shape"],
      ["pasteInvalid", "JSON 解析失败：{message}", "Invalid JSON: {message}"],
      ["pasteShape", "结构不支持：需要 series、matrix，或 rows + columns。", "Unsupported shape: provide series, matrix, or rows + columns."],
      ["pasteOk", "数据可渲染", "Data looks renderable"],
      ["mappingTitle", "变量映射", "Mapping"],
      ["mappingX", "X 轴变量", "X variable"],
      ["mappingY", "Y 轴变量", "Y variable"],
      ["mappingGroup", "分组变量", "Group variable"],
      ["mappingYerr", "Y 误差", "Y error"],
      ["mappingXerr", "X 误差", "X error"],
      ["mappingSize", "点大小", "Point size"],
      ["mappingLabel", "标签", "Label"],
      ["mappingTime", "时间", "Time"],
      ["mappingEvent", "事件", "Event"],
      ["mappingNone", "不使用", "Not used"],
      ["mappingEmpty", "选择数据源后即可读取列。", "Choose a data source to read its columns."],
      ["mappingHint", "X 与 Y 必选；分组变量用于拆分多条曲线。", "X and Y are required; the group column splits series."],
      ["validationChecking", "正在预检参数…", "Prechecking the spec…"],
      ["mappingLoading", "读取列…", "Reading columns…"],
      ["kindSection", "图种", "Figure kind"],
      ["kindSearch", "搜索图种、标签或摘要", "Search kinds, tags or summaries"],
      ["kindEmpty", "没有匹配的图种", "No matching kinds"],
      ["kindSummary", "说明", "Summary"],
      ["optionsTitle", "选项", "Options"],
      ["noOptions", "该图种没有额外选项。", "This kind has no extra options."],
      ["styleSection", "风格", "Style"],
      ["journalNone", "无期刊预设", "No journal preset"],
      ["gridField", "网格", "Grid"],
      ["legendField", "图例", "Legend"],
      ["transparentField", "透明背景", "Transparent background"],
      ["labelsSection", "坐标轴与标题", "Labels"],
      ["labelX", "X 轴标签", "X label"],
      ["labelY", "Y 轴标签", "Y label"],
      ["labelTitle", "标题", "Title"],
      ["labelColorbar", "色标标签", "Colorbar label"],
      ["labelPlaceholderX", "例如 Time (h)", "e.g. Time (h)"],
      ["labelPlaceholderY", "例如 OD$_{600}$", "e.g. OD$_{600}$"],
      ["labelPlaceholderTitle", "留空则不写标题", "Leave empty for no title"],
      ["labelPlaceholderColorbar", "例如 -log$_{10}$ $P$", "e.g. -log$_{10}$ $P$"],
      ["outputSection", "输出", "Output"],
      ["basenameField", "文件名", "Basename"],
      ["formatsField", "导出格式", "Formats"],
      ["renderBtn", "渲染", "Render"],
      ["rendering", "渲染中…", "Rendering…"],
      ["renderElapsed", "已用时 {s} 秒", "{s}s elapsed"],
      ["rendered", "已渲染并保存到画廊", "Rendered and saved to the gallery"],
      ["renderFailed", "渲染失败：{message}", "Render failed: {message}"],
      ["previewTitle", "预览", "Preview"],
      ["previewHint", "白底为论文用图背景；预览按期刊尺寸渲染。", "The white area is the artwork; previews render at journal size."],
      ["previewEmptyTitle", "尚未渲染", "Nothing rendered yet"],
      ["previewEmptyBody", "选择数据与图种，按「渲染」生成第一张图。", "Choose data and a kind, then press Render."],
      ["qualityInline", "质量 {score} · {grade}", "Quality {score} · {grade}"],
      ["openInGallery", "在画廊查看", "Open in gallery"],
      ["resetForm", "重置参数", "Reset"],
      ["resetDone", "已恢复默认参数", "Defaults restored"],
      ["validationTitle", "预检", "Precheck"],
      ["validateOk", "参数完整，可以渲染", "Spec looks complete"],
      ["validateIssues", "{n} 条提示", "{n} notes"],
      ["validationFailed", "预检不可用：{message}", "Precheck unavailable: {message}"],
      ["chooseKindFirst", "先选择一个图种", "Choose a kind first"],
      ["chooseDataFirst", "先选择一个数据源", "Choose a data source first"],
      ["workspaceNeedsPath", "先选择一个工作区文件", "Choose a workspace file first"],
      ["sampleNeedsId", "先选择一个内置样本", "Choose a built-in sample first"],
      ["dataPreviewTitle", "数据预览", "Data preview"],
      ["dataPreviewTotal", "共 {n} 行", "{n} rows"],
      ["dataPreviewRows", "前 {n} 行", "first {n} rows"],
      ["renderBlocked", "参数不完整，暂不能渲染", "The spec is incomplete"],
      ["kindGroupBasic", "基础图", "Basic"],
      ["kindGroupStatistics", "统计", "Statistics"],
      ["kindGroupBiomedical", "生物医学", "Biomedical"],
      ["kindGroupPhysical", "物理化学", "Physical"],
      ["kindGroupEngineering", "工程信号", "Engineering"],
      ["kindGroupEconomics", "经济金融", "Economics"],
      ["kindGroupMl", "机器学习", "Machine learning"],
      ["kindGroupComposite", "复合图", "Composite"],
      ["useSampleBtn", "用样本第一张图", "Use this sample"],

      /* library ------------------------------------------------------- */
      ["libraryTitle", "风格库", "Style library"],
      ["librarySubtitle", "领域预设、期刊规格、色盲安全色板与画幅尺寸。", "Domain presets, journal specs, CVD-safe palettes and figure sizes."],
      ["domainsTitle", "学科领域", "Domains"],
      ["journalsTitle", "期刊预设", "Journal presets"],
      ["palettesTitle", "分类色板", "Categorical palettes"],
      ["continuousTitle", "连续色标", "Continuous colormaps"],
      ["sizesTitle", "画幅预设", "Size presets"],
      ["recommendedKinds", "推荐图种", "Recommended"],
      ["journalWidths", "宽度", "Widths"],
      ["journalSingle", "单栏", "Single"],
      ["journalDouble", "双栏", "Double"],
      ["noteLabel", "说明", "Note"],
      ["sourceLabel", "来源", "Source"],
      ["cvdSafe", "色盲安全", "CVD safe"],
      ["cvdCheck", "需检查", "Check CVD"],
      ["cvdDelta", "ΔE {v}", "ΔE {v}"],
      ["paletteColors", "色值", "Colours"],
      ["continuousSequential", "顺序", "Sequential"],
      ["continuousDiverging", "发散", "Diverging"],
      ["continuousCyclic", "循环", "Cyclic"],
      ["applyToStudio", "用于工作室", "Use in studio"],
      ["appliedToStudio", "已应用到工作室", "Applied to the studio"],
      ["libraryEmptyTitle", "风格数据未就绪", "Style data unavailable"],
      ["libraryEmptyBody", "引擎还没有返回领域与色板定义；稍后重新加载。", "The engine has not returned domains and palettes yet; reload in a moment."],
      ["domainDefaultPalette", "默认色板", "Default palette"],
      ["domainCmap", "默认色标", "Default colormap"],
      ["domainFont", "默认字体", "Default font"],
      ["sizeNote", "宽度 {w} mm", "{w} mm wide"],
      ["sizesScaleHint", "宽度按最大 180 mm 等比显示", "Bars scale to a 180 mm maximum"],
      ["palettesEmpty", "没有色板定义", "No palettes defined"],
      ["journalsEmpty", "没有期刊预设", "No journal presets"],
      ["sizesEmpty", "没有画幅预设", "No size presets"],

      /* data ---------------------------------------------------------- */
      ["dataTitle", "数据", "Data"],
      ["dataSubtitle", "引擎内置样本，以及数据目录里的 CSV 文件。", "Samples shipped with the engine, plus CSV files in the data directory."],
      ["samplesTitle", "内置样本", "Built-in samples"],
      ["workspaceTitle", "工作区数据文件", "Workspace files"],
      ["refreshData", "刷新数据", "Refresh data"],
      ["rowsColumns", "{rows} 行 · {cols} 列", "{rows} rows · {cols} columns"],
      ["columnsTitle", "列", "Columns"],
      ["preview", "预览", "Preview"],
      ["hidePreview", "收起预览", "Hide preview"],
      ["previewLoading", "读取预览…", "Loading preview…"],
      ["previewFailed", "预览失败：{message}", "Preview failed: {message}"],
      ["previewNoRows", "接口没有返回行数据。", "The API returned no rows."],
      ["previewSampleHint", "内置样本的行预览由引擎提供；也可以直接在工作室渲染。", "Row previews for built-in samples come from the engine; you can also render directly in the studio."],
      ["plotThis", "用它绘图", "Plot this"],
      ["emptyWorkspaceTitle", "工作区没有数据文件", "No workspace files"],
      ["emptyWorkspaceBody", "把 CSV 放进引擎数据目录，然后点刷新。", "Drop CSV files into the engine data directory, then refresh."],
      ["noSamplesTitle", "没有内置样本", "No built-in samples"],
      ["noSamplesBody", "引擎没有返回样本数据。", "The engine returned no sample datasets."],
      ["dataRefreshDone", "数据已刷新", "Data refreshed"],
      ["columnsCount", "{n} 列", "{n} columns"],
      ["datasetMapping", "默认映射", "Default mapping"],
      ["dataSourceSample", "样本", "sample"],
      ["dataSourceWorkspace", "文件", "file"],

      /* settings ------------------------------------------------------ */
      ["settingsTitle", "设置", "Settings"],
      ["settingsSubtitle", "渲染引擎、默认风格、数据目录与诊断。", "Render engine, default style, data directories and diagnostics."],
      ["engineTitle", "渲染引擎", "Render engine"],
      ["engineAvailable", "可用", "Available"],
      ["engineUnavailable", "不可用", "Unavailable"],
      ["enginePython", "Python", "Python"],
      ["engineVersions", "版本", "Versions"],
      ["engineCjkFonts", "CJK 字体", "CJK fonts"],
      ["engineNoFonts", "未检测到中文字体", "No CJK font detected"],
      ["engineRefreshBtn", "刷新引擎", "Refresh engine"],
      ["engineRefreshing", "刷新中…", "Refreshing…"],
      ["engineRefreshed", "引擎状态已更新", "Engine status refreshed"],
      ["engineRefreshFailed", "引擎刷新失败：{message}", "Engine refresh failed: {message}"],
      ["engineDetails", "引擎信息", "Engine details"],
      ["defaultsTitle", "默认风格", "Default style"],
      ["defaultsHint", "新建图时使用的默认值，也会写回服务端设置。", "Defaults for new figures; saved back to the server."],
      ["saveDefaults", "保存默认值", "Save defaults"],
      ["saving", "保存中…", "Saving…"],
      ["saved", "已保存", "Saved"],
      ["saveFailed", "保存失败：{message}", "Save failed: {message}"],
      ["pathsTitle", "数据与素材", "Data & assets"],
      ["pathsHint", "路径由引擎返回，只读。", "Paths come from the engine and are read-only."],
      ["dataDirLabel", "数据目录", "Data directory"],
      ["galleryDirLabel", "画廊资源", "Gallery assets"],
      ["figuresDirLabel", "作品目录", "Figures"],
      ["assetsDirLabel", "素材目录", "Assets"],
      ["rootDirLabel", "插件目录", "Plugin root"],
      ["workspaceDirLabel", "工作区", "Workspace"],
      ["figuresCountLabel", "作品数", "Figures"],
      ["noPaths", "引擎没有提供路径信息。", "The engine provided no paths."],
      ["diagnosticsTitle", "诊断", "Diagnostics"],
      ["diagnosticsHint", "排查引擎、字体与数据目录问题时使用。", "Use this to debug engine, font and data-directory issues."],
      ["loadDiagnostics", "读取诊断", "Load diagnostics"],
      ["loadingDiagnostics", "读取中…", "Loading…"],
      ["diagnosticsFailed", "诊断读取失败：{message}", "Could not load diagnostics: {message}"],
      ["pythonCandidates", "Python 候选", "Python candidates"],
      ["settingsLoading", "读取设置…", "Loading settings…"],
      ["settingsUnavailable", "设置接口尚未就绪。", "The settings endpoint is not available yet."],
      ["defaultDpi", "默认 DPI", "Default DPI"],

      /* shared -------------------------------------------------------- */
      ["specRequired", "参数不完整", "Incomplete spec"],
      ["apiNotReady", "接口尚未就绪", "Endpoint not ready yet"],
      ["requestTimeout", "请求超时", "Request timed out"],
      ["figureSaved", "已保存到画廊", "Saved to the gallery"],
      ["qualityA", "A 级", "Grade A"],
      ["qualityB", "B 级", "Grade B"],
      ["qualityC", "C 级", "Grade C"],
      ["qualityD", "D 级", "Grade D"],
      ["legendGrid", "网格与图例", "Grid & legend"],
      ["widthHeight", "宽 {w} mm · 高宽比 {r}", "{w} mm wide · ratio {r}"],
      ["heightRatio", "高宽比", "Height ratio"],
      ["chooseFromList", "请选择", "Select"],
      ["search", "搜索", "Search"],
      ["clear", "清空", "Clear"],
      ["backendNotice", "本页面直接读取引擎数据；接口不可用时显示错误与重试。", "This panel reads the engine directly; failures show an error with retry."],
    ]

    const DICTIONARIES = { zh: {}, en: {} }
    for (let i = 0; i < TEXT_ENTRIES.length; i += 1) {
      const row = TEXT_ENTRIES[i]
      DICTIONARIES.zh[row[0]] = row[1]
      DICTIONARIES.en[row[0]] = row[2]
    }

    /* ------------------------------------------------------------------ */
    /* Language helpers                                                   */
    /* ------------------------------------------------------------------ */

    function readLang() {
      try {
        const value = window.localStorage.getItem(LANG_KEY)
        if (value === "zh" || value === "en") return value
      } catch (error) {}
      return ""
    }

    function writeLang(lang) {
      if (lang !== "zh" && lang !== "en") return
      try {
        window.localStorage.setItem(LANG_KEY, lang)
      } catch (error) {}
    }

    function detectLang() {
      const stored = readLang()
      if (stored) return stored
      try {
        const nav = window.navigator && typeof window.navigator.language === "string" ? window.navigator.language : ""
        if (nav && !/^zh/i.test(nav)) return "en"
      } catch (error) {}
      return "zh"
    }

    function makeT(lang) {
      const dictionary = DICTIONARIES[lang] || DICTIONARIES.zh
      return function t(key, vars) {
        let text = dictionary[key] !== undefined ? dictionary[key] : String(key)
        if (vars && typeof text === "string") {
          const names = Object.keys(vars)
          for (let i = 0; i < names.length; i += 1) {
            text = text.split("{" + names[i] + "}").join(String(vars[names[i]]))
          }
        }
        return text
      }
    }

    /** Pick `<base>_zh` / `<base>_en` from an API entity, tolerating gaps. */
    function pickLocalized(entity, lang, base) {
      if (!entity || typeof entity !== "object") return ""
      const key = base || "name"
      const suffix = lang === "en" ? "_en" : "_zh"
      const other = lang === "en" ? "_zh" : "_en"
      let value = entity[key + suffix]
      if (value === undefined || value === null || value === "") value = entity[key + other]
      if (value === undefined || value === null || value === "") value = entity[key]
      if (value === undefined || value === null) return ""
      return String(value)
    }

    function optionLabel(option, lang) {
      return pickLocalized(option, lang, "label")
    }

    /** The Figure model uses camelCase names (`kindNameZh`), unlike themes. */
    function pickCamelLocalized(entity, lang, base) {
      if (!isObject(entity)) return ""
      const key = base || "name"
      const zh = entity[key + "Zh"]
      const en = entity[key + "En"]
      const value = lang === "en" ? en || zh : zh || en
      if (value === undefined || value === null || value === "") return ""
      return String(value)
    }

    function figureTitle(figure, lang) {
      if (!figure) return ""
      const title = typeof figure.title === "string" ? figure.title.trim() : ""
      if (title) return title
      return pickCamelLocalized(figure, lang, "kindName") || (figure.kind ? String(figure.kind) : "")
    }

    /**
     * Ready-to-paste prompt for the panel → conversation handoff: it names the
     * figure id and tells the agent to read the stored spec and iterate in place.
     */
    function handoffPrompt(figure, lang) {
      const id = String((figure && figure.id) || "").trim()
      if (!id) return ""
      const title = figureTitle(figure, lang) || id
      if (lang === "en") {
        return (
          'Continue editing figure "' + id + '" (' + title + ") in this conversation: " +
          'call sci_plot_figures action:"get" for its spec, change only the fields I ask for, then render again with parentId:"' + id + '".'
        )
      }
      return (
        "在对话里继续修改这张图 " + id + "（" + title + "）：" +
        "先调用 sci_plot_figures action:\"get\" 读回 spec，只改我接下来指定的字段，再渲染时带上 parentId:\"" + id + "\"。"
      )
    }

    /* ------------------------------------------------------------------ */
    /* HTTP (§3: same-origin, plugin header, {ok,data} envelope)           */
    /* ------------------------------------------------------------------ */

    async function request(path, options) {
      const opts = options || {}
      const headers = Object.assign({}, opts.headers || {})
      headers[REQ_HEADER] = "1"
      if (opts.body !== undefined) headers["content-type"] = "application/json"
      const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : REQUEST_TIMEOUT_MS
      const controller = typeof AbortController === "function" ? new AbortController() : null
      let timer = null
      if (controller) timer = setTimeout(() => controller.abort(), timeoutMs)
      let response
      try {
        response = await fetch(API_BASE + path, {
          method: opts.method || "GET",
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          cache: "no-store",
          signal: controller ? controller.signal : undefined,
        })
      } catch (error) {
        if (timer) clearTimeout(timer)
        const failure = new Error(messageOf(error))
        failure.code = error && error.name === "AbortError" ? "timeout" : "network"
        throw failure
      }
      if (timer) clearTimeout(timer)
      let payload = null
      try {
        payload = await response.json()
      } catch (error) {}
      if (!response.ok || (payload && payload.ok === false)) {
        const message = payload && payload.error ? String(payload.error) : "HTTP " + response.status
        const failure = new Error(message)
        failure.code = payload && payload.code ? String(payload.code) : "http_" + response.status
        throw failure
      }
      return unwrapEnvelope(payload)
    }

    function unwrapEnvelope(payload) {
      if (payload && typeof payload === "object" && payload.ok === true) {
        return payload.data === undefined ? {} : payload.data
      }
      return payload === null || payload === undefined ? {} : payload
    }

    function apiGet(path, options) {
      return request(path, Object.assign({}, options || {}, { method: "GET" }))
    }

    function apiPost(path, body, options) {
      return request(path, Object.assign({}, options || {}, { method: "POST", body: body === undefined ? {} : body }))
    }

    function messageOf(error) {
      if (!error) return ""
      if (typeof error === "string") return error
      if (error.message) return String(error.message)
      return String(error)
    }

    /* ------------------------------------------------------------------ */
    /* Small generic helpers                                              */
    /* ------------------------------------------------------------------ */

    function safeArray(value) {
      return Array.isArray(value) ? value : []
    }

    function isObject(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    }

    function toNumber(value, fallback) {
      if (value === null || value === undefined || value === "") return fallback
      const n = Number(value)
      return Number.isFinite(n) ? n : fallback
    }

    function clampNumber(value, min, max, fallback) {
      const n = toNumber(value, fallback)
      if (!Number.isFinite(n)) return fallback
      return Math.min(max, Math.max(min, n))
    }

    function uniqueStrings(values) {
      const seen = Object.create(null)
      const out = []
      const list = safeArray(values)
      for (let i = 0; i < list.length; i += 1) {
        const value = list[i]
        if (typeof value !== "string" || value === "" || seen[value]) continue
        seen[value] = true
        out.push(value)
      }
      return out
    }

    function cleanObject(value) {
      const out = {}
      if (!isObject(value)) return out
      const keys = Object.keys(value)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const item = value[key]
        if (item === undefined || item === null || item === "") continue
        out[key] = item
      }
      return out
    }

    function compareText(a, b) {
      const left = String(a || "").toLowerCase()
      const right = String(b || "").toLowerCase()
      if (left < right) return -1
      if (left > right) return 1
      return 0
    }

    function basenameOf(path) {
      const value = String(path || "")
      if (!value) return ""
      const parts = value.split(/[\\/]+/).filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1] : value
    }

    /* ------------------------------------------------------------------ */
    /* Formatting                                                         */
    /* ------------------------------------------------------------------ */

    function fmtInt(value) {
      const n = toNumber(value, null)
      if (n === null) return "—"
      const rounded = Math.round(n)
      try {
        return new Intl.NumberFormat("en-US").format(rounded)
      } catch (error) {
        return String(rounded)
      }
    }

    function fmtNum(value, digits) {
      const n = toNumber(value, null)
      if (n === null) return "—"
      const places = toNumber(digits, 1)
      const factor = Math.pow(10, places)
      const rounded = Math.round(n * factor) / factor
      return String(rounded)
    }

    function fmtMm(value) {
      const n = toNumber(value, null)
      if (n === null) return "—"
      return n % 1 === 0 ? String(n) : n.toFixed(1)
    }

    function fmtFigureSize(figure) {
      if (!figure) return "—"
      const width = toNumber(figure.widthMm, null)
      const height = toNumber(figure.heightMm, null)
      const dpi = toNumber(figure.dpi, null)
      if (width === null && height === null) return "—"
      let text = fmtMm(width) + " × " + fmtMm(height) + " mm"
      if (dpi !== null) text += " · " + fmtInt(dpi) + " dpi"
      return text
    }

    function fmtDurationMs(value) {
      const n = toNumber(value, null)
      if (n === null || n < 0) return "—"
      if (n < 1000) return fmtInt(n) + " ms"
      return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + " s"
    }

    function fmtClock(iso) {
      if (!iso) return ""
      try {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return String(iso)
        const pad = (n) => String(n).padStart(2, "0")
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes())
      } catch (error) {
        return String(iso)
      }
    }

    function fmtTime(iso, t) {
      if (!iso) return ""
      const translate = typeof t === "function" ? t : makeT("zh")
      try {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return String(iso)
        const diff = Date.now() - date.getTime()
        if (diff >= 0 && diff < 60000) return translate("justNow")
        if (diff >= 0 && diff < 3600000) return translate("minutesAgo", { n: Math.max(1, Math.round(diff / 60000)) })
        if (diff >= 0 && diff < 86400000) return translate("hoursAgo", { n: Math.round(diff / 3600000) })
        if (diff >= 0 && diff < 7 * 86400000) return translate("daysAgo", { n: Math.round(diff / 86400000) })
        return fmtClock(iso)
      } catch (error) {
        return String(iso)
      }
    }

    function figureDate(figure, t) {
      if (!figure) return ""
      return fmtTime(figure.createdAt, t)
    }

    /* ------------------------------------------------------------------ */
    /* Quality helpers                                                    */
    /* ------------------------------------------------------------------ */

    function qualityGrade(score) {
      if (score === null || score === undefined || score === "") return ""
      const n = toNumber(score, null)
      if (n === null) return ""
      if (n >= 90) return "A"
      if (n >= 80) return "B"
      if (n >= 70) return "C"
      return "D"
    }

    function qualityTone(gradeOrScore) {
      const value = gradeOrScore
      const grade = typeof value === "number" ? qualityGrade(value) : String(value || "").toUpperCase()
      return QUALITY_GRADE_TONE[grade] || ""
    }

    function qualityScore(quality) {
      const raw = isObject(quality) ? quality.score : quality
      const n = toNumber(raw, null)
      if (n === null) return null
      return Math.max(0, Math.min(100, Math.round(n)))
    }

    function qualityCheckList(quality) {
      const list = safeArray(isObject(quality) ? quality.checks : null)
      const out = []
      for (let i = 0; i < list.length; i += 1) {
        const item = list[i]
        if (!isObject(item)) continue
        out.push({
          id: String(item.id || "check-" + i),
          status: String(item.status || "info").toLowerCase(),
          messageZh: String(item.message_zh || item.message || ""),
          messageEn: String(item.message_en || item.message || ""),
        })
      }
      return out
    }

    function qualityCheckRows(quality, lang) {
      return qualityCheckList(quality).map((item) => ({
        id: item.id,
        status: item.status,
        message: lang === "en" ? item.messageEn || item.messageZh : item.messageZh || item.messageEn,
      }))
    }

    function qualityCounts(quality) {
      const counts = isObject(quality) && isObject(quality.counts) ? quality.counts : null
      if (counts) {
        return {
          pass: toNumber(counts.pass, 0),
          warn: toNumber(counts.warn, 0),
          fail: toNumber(counts.fail, 0),
          info: toNumber(counts.info, 0),
        }
      }
      const result = { pass: 0, warn: 0, fail: 0, info: 0 }
      const checks = qualityCheckList(quality)
      for (let i = 0; i < checks.length; i += 1) {
        const status = checks[i].status
        if (result[status] !== undefined) result[status] += 1
      }
      return result
    }

    function qualitySummary(quality, lang) {
      if (!isObject(quality)) return ""
      return pickLocalized(quality, lang, "summary") || ""
    }

    function normalizeQuality(quality) {
      const score = qualityScore(quality)
      const grade = isObject(quality) && quality.grade ? String(quality.grade).toUpperCase() : qualityGrade(score)
      return { score: score, grade: grade, checks: qualityCheckList(quality), counts: qualityCounts(quality) }
    }

    /* ------------------------------------------------------------------ */
    /* URLs and files                                                     */
    /* ------------------------------------------------------------------ */

    function assetUrl(path) {
      const value = String(path || "").trim()
      if (!value) return ""
      if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value
      if (value.charAt(0) === "/") return value
      return API_BASE + "/" + value.replace(/^\.?\//, "")
    }

    function figureFileUrl(figure, format, variant) {
      if (!figure || !figure.id) return ""
      const fmt = String(format || "png").toLowerCase()
      const mode = variant === "thumb" ? "thumb" : "full"
      if (fmt === "png" && mode === "full" && figure.pngUrl) return assetUrl(figure.pngUrl)
      if (fmt === "png" && mode === "thumb" && figure.thumbUrl) return assetUrl(figure.thumbUrl)
      return API_BASE + "/api/figures/" + encodeURIComponent(figure.id) + "/file?format=" + encodeURIComponent(fmt) + "&variant=" + mode
    }

    function figureThumbUrl(figure) {
      if (!figure) return ""
      if (figure.thumbUrl) return assetUrl(figure.thumbUrl)
      if (figure.pngUrl) return assetUrl(figure.pngUrl)
      return figureFileUrl(figure, "png", "thumb")
    }

    function figureFileEntries(figure) {
      const files = figure && figure.files
      const out = []
      if (isObject(files)) {
        const keys = Object.keys(files)
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i]
          const item = files[key]
          if (typeof item === "string" && item) out.push({ format: key, path: item })
          else if (isObject(item) && item.path) out.push({ format: key, path: String(item.path) })
        }
      } else if (Array.isArray(files)) {
        for (let i = 0; i < files.length; i += 1) {
          const item = files[i]
          if (typeof item === "string" && item) out.push({ format: "", path: item })
          else if (isObject(item) && item.path) out.push({ format: String(item.format || item.kind || ""), path: String(item.path) })
        }
      }
      return out
    }

    function figurePrimaryPath(figure) {
      const entries = figureFileEntries(figure)
      return entries.length > 0 ? entries[0].path : ""
    }

    function galleryAssetUrl(name) {
      if (!name) return ""
      return API_BASE + "/api/assets/gallery/" + encodeURIComponent(String(name))
    }

    function normalizeGalleryItem(item, index) {
      if (typeof item === "string") {
        return {
          name: item,
          title: item,
          titleZh: item,
          titleEn: item,
          noteZh: "",
          noteEn: "",
          kind: "",
          domain: "",
          journal: "",
          quality: null,
          style: null,
          src: galleryAssetUrl(item),
        }
      }
      if (!isObject(item)) return { name: "asset-" + index, title: "", titleZh: "", titleEn: "", noteZh: "", noteEn: "", kind: "", domain: "", journal: "", quality: null, style: null, src: "" }
      const name = String(item.name || item.file || item.id || item.asset || "")
      const titleZh = String(item.titleZh || item.title_zh || item.title || item.label || name || "")
      const titleEn = String(item.titleEn || item.title_en || item.titleZh || item.title_zh || item.title || item.label || name || "")
      return {
        name: name || "asset-" + index,
        title: titleZh || titleEn,
        titleZh: titleZh,
        titleEn: titleEn,
        noteZh: String(item.noteZh || item.note_zh || item.note || item.description || ""),
        noteEn: String(item.noteEn || item.note_en || item.noteZh || item.note_zh || item.note || item.description || ""),
        kind: String(item.kind || item.kindId || ""),
        domain: String(item.domain || ""),
        journal: String(item.journal || ""),
        palette: String(item.palette || ""),
        cmap: String(item.cmap || ""),
        font: String(item.font || ""),
        size: String(item.size || ""),
        dpi: toNumber(item.dpi, null),
        widthMm: toNumber(item.widthMm !== undefined ? item.widthMm : item.width_mm, null),
        heightRatio: toNumber(item.heightRatio !== undefined ? item.heightRatio : item.height_ratio, null),
        quality: item.quality !== undefined ? item.quality : null,
        style: isObject(item.style) ? item.style : null,
        src: item.url ? assetUrl(item.url) : galleryAssetUrl(name),
      }
    }

    function galleryTitle(item, lang) {
      if (!isObject(item)) return ""
      return lang === "en" ? item.titleEn || item.titleZh || item.title || "" : item.titleZh || item.titleEn || item.title || ""
    }

    function galleryNote(item, lang) {
      if (!isObject(item)) return ""
      return lang === "en" ? item.noteEn || item.noteZh || "" : item.noteZh || item.noteEn || ""
    }

    /**
     * A sample-gallery entry only carries style metadata, never data: merge its
     * fields into a studio style patch so "use this style" starts a fresh figure.
     */
    function galleryItemStyle(item, caps) {
      const out = { style: {}, kind: "" }
      if (!isObject(item)) return out
      const source = isObject(item.style) ? item.style : {}
      const pairs = [
        ["domain", item.domain],
        ["journal", item.journal],
        ["palette", item.palette],
        ["cmap", item.cmap],
        ["font", item.font],
        ["size", item.size],
        ["dpi", item.dpi],
        ["width_mm", item.widthMm],
        ["height_ratio", item.heightRatio],
      ]
      for (let i = 0; i < pairs.length; i += 1) {
        const value = pairs[i][1]
        if (value === undefined || value === null || value === "") continue
        out.style[pairs[i][0]] = value
      }
      for (let i = 0; i < STYLE_KEYS.length; i += 1) {
        const key = STYLE_KEYS[i]
        const value = source[key]
        if (value === undefined || value === null || value === "") continue
        out.style[key] = value
      }
      // Never hand the engine a theme id the current capabilities do not know.
      if (isObject(caps) && isObject(caps.themes)) {
        const themes = caps.themes
        const palettes = isObject(caps.palettes) ? caps.palettes : {}
        const allowed = [
          ["domain", safeArray(themes.domains)],
          ["journal", safeArray(themes.journals)],
          ["palette", safeArray(palettes.categorical)],
          ["cmap", safeArray(palettes.continuous)],
          ["font", safeArray(themes.fonts)],
          ["size", safeArray(themes.sizes)],
        ]
        for (let i = 0; i < allowed.length; i += 1) {
          const key = allowed[i][0]
          const list = allowed[i][1]
          if (list.length === 0) continue
          if (out.style[key] !== undefined && !findById(list, out.style[key])) delete out.style[key]
        }
      }
      if (out.style.size !== undefined && out.style.width_mm === undefined && isObject(caps) && isObject(caps.themes)) {
        const width = styleWidthForSize(caps.themes.sizes, out.style.size)
        if (width !== null) out.style.width_mm = width
      }
      out.kind = String(item.kind || "")
      return out
    }

    /* ------------------------------------------------------------------ */
    /* Figures                                                            */
    /* ------------------------------------------------------------------ */

    function sortFigures(figures) {
      const list = safeArray(figures).slice()
      list.sort((a, b) => {
        const left = a && a.createdAt ? new Date(a.createdAt).getTime() : 0
        const right = b && b.createdAt ? new Date(b.createdAt).getTime() : 0
        const safeLeft = Number.isFinite(left) ? left : 0
        const safeRight = Number.isFinite(right) ? right : 0
        return safeRight - safeLeft
      })
      return list
    }

    function figureFacets(figures) {
      const kindMap = Object.create(null)
      const domainMap = Object.create(null)
      const list = safeArray(figures)
      for (let i = 0; i < list.length; i += 1) {
        const figure = list[i] || {}
        const kindId = String(figure.kind || "")
        if (kindId && !kindMap[kindId]) {
          kindMap[kindId] = {
            id: kindId,
            zh: String(figure.kindNameZh || kindId),
            en: String(figure.kindNameEn || figure.kindNameZh || kindId),
            count: 0,
          }
        }
        if (kindId && kindMap[kindId]) kindMap[kindId].count += 1
        const domainId = String(figure.domain || "")
        if (domainId && !domainMap[domainId]) {
          domainMap[domainId] = {
            id: domainId,
            zh: String(figure.domainNameZh || domainId),
            en: String(figure.domainNameEn || figure.domainNameZh || domainId),
            count: 0,
          }
        }
        if (domainId && domainMap[domainId]) domainMap[domainId].count += 1
      }
      const toSorted = (map) => Object.keys(map).map((key) => map[key]).sort((a, b) => compareText(a.zh || a.en, b.zh || b.en))
      return { kinds: toSorted(kindMap), domains: toSorted(domainMap) }
    }

    function filterFigures(figures, filters) {
      const state = filters || {}
      const kind = String(state.kind || "")
      const domain = String(state.domain || "")
      return safeArray(figures).filter((figure) => {
        if (!figure) return false
        if (kind && String(figure.kind || "") !== kind) return false
        if (domain && String(figure.domain || "") !== domain) return false
        return true
      })
    }

    function facetLabel(facet, lang) {
      if (!facet) return ""
      return pickLocalized(facet, lang, "") || (lang === "en" ? facet.en : facet.zh) || facet.id || ""
    }

    /* ------------------------------------------------------------------ */
    /* Datasets                                                           */
    /* ------------------------------------------------------------------ */

    function datasetColumnList(item) {
      const columns = item && item.columns
      if (!Array.isArray(columns)) return []
      const out = []
      for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i]
        if (typeof column === "string") out.push({ name: column, kind: "unknown" })
        else if (isObject(column) && column.name) out.push({ name: String(column.name), kind: String(column.kind || column.type || "unknown") })
      }
      return out
    }

    function datasetColumnCount(item) {
      if (!item) return 0
      const list = datasetColumnList(item)
      if (list.length > 0) return list.length
      const raw = item.columnCount !== undefined ? item.columnCount : item.column_count !== undefined ? item.column_count : item.columns
      return Math.max(0, toNumber(raw, 0))
    }

    function normalizeDatasetItem(item, source, index) {
      const fallbackId = (source || "item") + "-" + index
      if (typeof item === "string") {
        const name = basenameOf(item)
        return {
          id: item || fallbackId,
          path: item,
          name,
          source: source || "",
          rows: null,
          columns: [],
          descriptionZh: "",
          descriptionEn: "",
          mapping: {},
          recommended: [],
          recommendedKind: "",
        }
      }
      const value = isObject(item) ? item : {}
      const path = String(value.path || "")
      const id = String(value.id || path || value.name || fallbackId)
      const name = String(value.name || basenameOf(path) || id)
      const nameZh = String(value.name_zh || value.nameZh || name)
      const nameEn = String(value.name_en || value.nameEn || name)
      return {
        id,
        path,
        name,
        nameZh,
        nameEn,
        source: source || "",
        domain: String(value.domain || ""),
        rows: toNumber(value.rows, null),
        columns: datasetColumnList(value),
        descriptionZh: String(value.description_zh || value.description || ""),
        descriptionEn: String(value.description_en || value.description || ""),
        mapping: isObject(value.mapping) ? value.mapping : {},
        recommended: safeArray(value.recommended),
        recommendedKind: String(value.recommended_kind || (safeArray(value.recommended)[0] && safeArray(value.recommended)[0].kind) || ""),
      }
    }

    function normalizeDatasets(datasets) {
      const value = isObject(datasets) ? datasets : {}
      return {
        samples: safeArray(value.samples).map((item, index) => normalizeDatasetItem(item, "sample", index)),
        workspace: safeArray(value.workspace).map((item, index) => normalizeDatasetItem(item, "workspace", index)),
      }
    }

    function datasetLabel(item, lang) {
      if (!item) return ""
      if (lang === "en") return item.nameEn || item.nameZh || item.name || basenameOf(item.path)
      return item.nameZh || item.nameEn || item.name || basenameOf(item.path)
    }

    function datasetRows(item) {
      const rows = toNumber(item && item.rows, null)
      return rows === null ? "—" : fmtInt(rows)
    }

    function previewRequestFor(item) {
      if (!item) return null
      if (item.path) return { path: item.path }
      if (item.id) return { path: item.id, sample: item.id }
      return null
    }

    function isNumericKind(kind) {
      const value = String(kind || "").toLowerCase()
      if (!value) return false
      return /(numeric|number|integer|int|float|double|decimal|real|continuous|ordinal)/.test(value)
    }

    function isCategoricalKind(kind) {
      const value = String(kind || "").toLowerCase()
      return /(categ|string|text|bool|factor|group|label|date|time|datetime|nominal)/.test(value)
    }

    function mappingDefaultsFromColumns(columns) {
      const list = safeArray(columns)
      const numeric = list.filter((column) => isNumericKind(column && column.kind))
      const xColumn = numeric[0] || list[0] || null
      let yColumn = numeric[1] || numeric[0] || list[1] || null
      if (yColumn && xColumn && yColumn.name === xColumn.name) yColumn = list[1] || null
      const groupColumn =
        list.find((column) => /(group|categ|label|class)/i.test(String((column && column.name) || "")) && column !== xColumn && column !== yColumn) ||
        list.find((column) => isCategoricalKind(column && column.kind) && column !== xColumn && column !== yColumn) ||
        null
      const mapping = {}
      if (xColumn) mapping.x = xColumn.name
      if (yColumn && yColumn.name !== (xColumn && xColumn.name)) mapping.y = yColumn.name
      if (groupColumn) mapping.group = groupColumn.name
      return mapping
    }

    function cleanMapping(mapping) {
      const out = {}
      if (!isObject(mapping)) return out
      for (let i = 0; i < MAPPING_KEYS.length; i += 1) {
        const key = MAPPING_KEYS[i]
        const value = mapping[key]
        if (typeof value === "string" && value.trim()) out[key] = value.trim()
      }
      return out
    }

    /* ------------------------------------------------------------------ */
    /* Studio form ⇄ spec                                                 */
    /* ------------------------------------------------------------------ */

    function resolveFormats(formats) {
      const requested = uniqueStrings(safeArray(formats).map((value) => String(value || "").toLowerCase()))
      const kept = FORMATS.filter((format) => requested.indexOf(format) !== -1)
      return kept.length > 0 ? kept : DEFAULT_FORMATS.slice()
    }

    /**
     * `Option[]` is the contract, but hosts and third-party renderers have been
     * seen serialising an id→option map. Normalize both into an array so the
     * dynamic controls never depend on the exact transport shape.
     */
    function optionList(options) {
      if (Array.isArray(options)) {
        const out = []
        for (let i = 0; i < options.length; i += 1) {
          const option = options[i]
          if (!isObject(option)) continue
          if (option.id) out.push(option)
          else if (option.type) out.push(Object.assign({ id: "option-" + i }, option))
        }
        return out
      }
      if (isObject(options)) {
        const out = []
        const keys = Object.keys(options)
        for (let i = 0; i < keys.length; i += 1) {
          const value = options[keys[i]]
          if (!isObject(value)) continue
          out.push(Object.assign({ id: value.id || keys[i] }, value))
        }
        return out
      }
      return []
    }

    function defaultOptionValues(options) {
      const out = {}
      const list = optionList(options)
      for (let i = 0; i < list.length; i += 1) {
        const option = list[i]
        if (!isObject(option) || !option.id) continue
        out[option.id] = option.default !== undefined ? option.default : defaultOptionValue(option)
      }
      return out
    }

    function defaultOptionValue(option) {
      if (!isObject(option)) return ""
      if (option.type === "bool") return false
      if (option.type === "int" || option.type === "float") return toNumber(option.min, 0)
      if (option.type === "enum") return safeArray(option.choices)[0] || ""
      if (option.type === "color") return "#2c5f8a"
      return ""
    }

    function normalizeOptionValue(option, value) {
      if (!isObject(option)) return value
      if (option.type === "bool") return value === true
      if (option.type === "int") {
        const min = toNumber(option.min, null)
        const max = toNumber(option.max, null)
        let n = toNumber(value, toNumber(option.default, 0))
        n = Math.round(n)
        if (min !== null) n = Math.max(min, n)
        if (max !== null) n = Math.min(max, n)
        return n
      }
      if (option.type === "float") {
        const min = toNumber(option.min, null)
        const max = toNumber(option.max, null)
        let n = toNumber(value, toNumber(option.default, 0))
        if (min !== null) n = Math.max(min, n)
        if (max !== null) n = Math.min(max, n)
        return n
      }
      if (option.type === "enum") {
        const choices = safeArray(option.choices)
        if (choices.length === 0) return String(value)
        return choices.indexOf(value) !== -1 ? value : choices[0]
      }
      return value === null || value === undefined ? "" : String(value)
    }

    function mergeOptionValues(options, current) {
      const list = optionList(options)
      const out = defaultOptionValues(list)
      const known = Object.create(null)
      for (let i = 0; i < list.length; i += 1) {
        const option = list[i]
        if (isObject(option) && option.id) known[option.id] = true
      }
      const source = isObject(current) ? current : {}
      const keys = Object.keys(source)
      for (let i = 0; i < keys.length; i += 1) {
        // Only forward values the selected kind actually declares: a stale
        // value from another kind must never reach the render request.
        if (known[keys[i]]) out[keys[i]] = source[keys[i]]
      }
      for (let i = 0; i < list.length; i += 1) {
        const option = list[i]
        if (!isObject(option) || !option.id) continue
        out[option.id] = normalizeOptionValue(option, out[option.id])
      }
      return out
    }

    function buildOptionsSpec(options) {
      const out = {}
      if (!isObject(options)) return out
      const keys = Object.keys(options)
      for (let i = 0; i < keys.length; i += 1) {
        const value = options[keys[i]]
        if (value === undefined || value === null) continue
        if (typeof value === "number" && !Number.isFinite(value)) continue
        out[keys[i]] = value
      }
      return out
    }

    function buildLabelsSpec(labels) {
      const source = isObject(labels) ? labels : {}
      const out = {}
      const keys = ["x", "y", "title", "colorbar"]
      for (let i = 0; i < keys.length; i += 1) {
        const value = source[keys[i]]
        if (typeof value === "string" && value.trim()) out[keys[i]] = value
      }
      return out
    }

    function buildStyleSpec(style) {
      const source = isObject(style) ? style : {}
      const out = {}
      for (let i = 0; i < STYLE_KEYS.length; i += 1) {
        const key = STYLE_KEYS[i]
        const value = source[key]
        if (value === undefined || value === null || value === "") continue
        if (typeof value === "number" && !Number.isFinite(value)) continue
        out[key] = value
      }
      if (out.journal === "") delete out.journal
      return out
    }

    function parsePastedData(text) {
      const raw = String(text || "").trim()
      if (!raw) return { ok: false, error: "chooseDataFirst" }
      let parsed = null
      try {
        parsed = JSON.parse(raw)
      } catch (error) {
        return { ok: false, error: "pasteInvalid", detail: messageOf(error) }
      }
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return { ok: false, error: "pasteShape" }
        return { ok: true, data: { series: parsed } }
      }
      if (!isObject(parsed)) return { ok: false, error: "pasteShape" }
      if (Array.isArray(parsed.series)) return { ok: true, data: { series: parsed.series } }
      if (Array.isArray(parsed.matrix)) {
        return {
          ok: true,
          data: {
            matrix: parsed.matrix,
            rows: safeArray(parsed.rows),
            columns: safeArray(parsed.columns),
          },
        }
      }
      if (Array.isArray(parsed.rows) && Array.isArray(parsed.columns)) {
        const data = { rows: parsed.rows, columns: parsed.columns }
        if (isObject(parsed.mapping)) data.mapping = parsed.mapping
        return { ok: true, data: data }
      }
      if (isObject(parsed.data)) {
        const inner = parsed.data
        if (Array.isArray(inner.series)) return { ok: true, data: { series: inner.series } }
        if (Array.isArray(inner.matrix)) return { ok: true, data: { matrix: inner.matrix, rows: safeArray(inner.rows), columns: safeArray(inner.columns) } }
        if (Array.isArray(inner.rows) && Array.isArray(inner.columns)) return { ok: true, data: inner }
      }
      return { ok: false, error: "pasteShape" }
    }

    function buildRenderData(form) {
      const source = isObject(form) ? form : {}
      const mode = source.dataMode || "sample"
      if (mode === "paste") {
        const parsed = parsePastedData(source.pasted)
        if (!parsed.ok) return { error: parsed.error, detail: parsed.detail || "" }
        return { data: parsed.data }
      }
      if (mode === "workspace") {
        const path = String(source.workspacePath || "").trim()
        if (!path) return { error: "workspaceNeedsPath" }
        return { data: { path: path, mapping: cleanMapping(source.mapping) } }
      }
      const sampleId = String(source.sampleId || "").trim()
      if (!sampleId) return { error: "sampleNeedsId" }
      return { data: { sample: sampleId, mapping: cleanMapping(source.mapping) } }
    }

    function buildRenderSpec(form) {
      const source = isObject(form) ? form : {}
      const kind = String(source.kind || "").trim()
      if (!kind) return { error: "chooseKindFirst", spec: null }
      const dataResult = buildRenderData(source)
      if (dataResult.error) return { error: dataResult.error, detail: dataResult.detail || "", spec: null }
      const spec = {
        kind: kind,
        data: dataResult.data,
        style: buildStyleSpec(source.style),
        labels: buildLabelsSpec(source.labels),
        options: buildOptionsSpec(source.options),
        output: {
          formats: resolveFormats(source.formats),
          basename: String(source.basename || "fig").trim() || "fig",
        },
      }
      return { error: "", spec: spec }
    }

    function normalizeKindKey(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
    }

    /**
     * Resolve a kind id from capabilities or from a recommendation/URL.
     * Exact id first, then case/normalised forms, then an unambiguous
     * `pr` ↔ `pr_curve` style prefix match (server-side registries can drift).
     */
    function resolveKind(caps, kindId) {
      const id = String(kindId || "").trim()
      if (!id) return null
      const list = flattenKinds(caps)
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].kind === id || list[i].id === id) return list[i]
      }
      const lower = id.toLowerCase()
      for (let i = 0; i < list.length; i += 1) {
        if (String(list[i].kind || "").toLowerCase() === lower || String(list[i].id || "").toLowerCase() === lower) return list[i]
      }
      const key = normalizeKindKey(id)
      if (key) {
        for (let i = 0; i < list.length; i += 1) {
          if (normalizeKindKey(list[i].kind) === key || normalizeKindKey(list[i].id) === key) return list[i]
        }
        const prefixed = list.filter((item) => {
          const itemId = String(item.kind || item.id || "").toLowerCase()
          if (!itemId) return false
          return itemId.indexOf(lower + "_") === 0 || lower.indexOf(itemId + "_") === 0
        })
        if (prefixed.length === 1) return prefixed[0]
      }
      return null
    }

    function findKind(caps, kindId) {
      return resolveKind(caps, kindId)
    }

    function styleWidthForSize(sizes, sizeId) {
      const list = safeArray(sizes)
      for (let i = 0; i < list.length; i += 1) {
        if (list[i] && String(list[i].id) === String(sizeId)) return toNumber(list[i].width_mm, null)
      }
      return null
    }

    function defaultStyleFromSettings(caps, settings) {
      const value = isObject(settings) ? settings : {}
      const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
      const domains = safeArray(themes.domains)
      const journals = safeArray(themes.journals)
      const fonts = safeArray(themes.fonts)
      const sizes = safeArray(themes.sizes)
      const palettes = isObject(caps) && isObject(caps.palettes) ? caps.palettes : {}
      const categorical = safeArray(palettes.categorical)
      const continuous = safeArray(palettes.continuous)
      const domain = domains.find((item) => item && item.id === value.defaultDomain) || domains[0] || {}
      const journal = journals.find((item) => item && item.id === value.defaultJournal) || null
      const font = fonts.find((item) => item && item.id === value.defaultFont) || fonts[0] || {}
      const size = sizes.find((item) => item && item.id === value.defaultSize) || sizes[0] || {}
      const palette = categorical.find((item) => item && item.id === value.defaultPalette) || categorical.find((item) => item && item.id === domain.palette) || categorical[0] || {}
      const cmap = continuous.find((item) => item && item.id === domain.cmap) || continuous[0] || {}
      const width = toNumber(size.width_mm, 89)
      return {
        domain: String(domain.id || "life-science"),
        journal: journal ? String(journal.id) : "",
        palette: String(palette.id || ""),
        cmap: String(cmap.id || ""),
        font: String(font.id || ""),
        size: String(size.id || ""),
        dpi: toNumber(value.defaultDpi, DEFAULT_DPI),
        grid: false,
        legend: true,
        transparent: false,
        width_mm: width,
        height_ratio: 0.75,
      }
    }

    function initialStudioForm(caps, settings) {
      const kinds = flattenKinds(caps)
      const samples = safeArray(isObject(caps) ? caps.samples : [])
      const firstSample = samples[0] || null
      // Prefer the kind the sample itself recommends so labels/options match.
      const recommended = firstSample ? safeArray(firstSample.recommended)[0] : null
      const recommendedKind = recommended ? resolveKind(caps, recommended.kind) : null
      const firstKind = recommendedKind || kinds[0] || { kind: "", options: [], demo: null }
      const style = defaultStyleFromSettings(caps, settings)
      const demoLabels = isObject(firstKind.demo) && isObject(firstKind.demo.labels) ? firstKind.demo.labels : {}
      const mapping = firstSample && isObject(firstSample.mapping) ? firstSample.mapping : {}
      return {
        initialized: true,
        dataMode: "sample",
        sampleId: firstSample ? String(firstSample.id || "") : "",
        workspacePath: "",
        pasted: "",
        mapping: Object.assign({}, mapping),
        kind: String(firstKind.kind || firstKind.id || ""),
        style: style,
        labels: {
          x: String(demoLabels.x || ""),
          y: String(demoLabels.y || ""),
          title: "",
          colorbar: String(demoLabels.colorbar || ""),
        },
        options: mergeOptionValues(firstKind.options, null),
        formats: DEFAULT_FORMATS.slice(),
        basename: "fig1",
      }
    }

    function ensureStudioForm(form, caps, settings) {
      if (!isObject(caps)) return form
      const base = initialStudioForm(caps, settings)
      const source = isObject(form) ? form : {}
      if (source.initialized && source.kind) {
        const kind = findKind(caps, source.kind)
        const next = Object.assign({}, base, source)
        next.style = Object.assign({}, base.style, isObject(source.style) ? source.style : {})
        next.labels = Object.assign({}, base.labels, isObject(source.labels) ? source.labels : {})
        next.options = mergeOptionValues(kind ? kind.options : [], source.options)
        next.mapping = Object.assign({}, isObject(source.mapping) ? source.mapping : {})
        next.formats = resolveFormats(source.formats)
        next.initialized = true
        return next
      }
      return base
    }

    function seedStudioFromSpec(spec, caps) {
      const value = isObject(spec) ? spec : {}
      const data = isObject(value.data) ? value.data : {}
      const style = isObject(value.style) ? value.style : {}
      const labels = isObject(value.labels) ? value.labels : {}
      const options = isObject(value.options) ? value.options : {}
      const output = isObject(value.output) ? value.output : {}
      const patch = {
        initialized: true,
        kind: String(value.kind || ""),
        style: Object.assign({}, isObject(style) ? style : {}),
        labels: {
          x: String(labels.x || ""),
          y: String(labels.y || ""),
          title: String(labels.title || ""),
          colorbar: String(labels.colorbar || ""),
        },
        options: Object.assign({}, options),
        formats: resolveFormats(output.formats),
        basename: String(output.basename || "fig1"),
        mapping: {},
        dataMode: "sample",
        sampleId: "",
        workspacePath: "",
        pasted: "",
      }
      if (data.sample) {
        patch.dataMode = "sample"
        patch.sampleId = String(data.sample)
        patch.mapping = Object.assign({}, isObject(data.mapping) ? data.mapping : {})
      } else if (data.path) {
        patch.dataMode = "workspace"
        patch.workspacePath = String(data.path)
        patch.mapping = Object.assign({}, isObject(data.mapping) ? data.mapping : {})
      } else if (data.series || data.matrix || (data.rows && data.columns)) {
        patch.dataMode = "paste"
        patch.pasted = JSON.stringify(data, null, 2)
      }
      const kind = findKind(caps, patch.kind)
      if (kind) patch.options = mergeOptionValues(kind.options, patch.options)
      return patch
    }

    /* ------------------------------------------------------------------ */
    /* Kinds and samples                                                  */
    /* ------------------------------------------------------------------ */

    function flattenKinds(caps) {
      const groups = safeArray(isObject(caps) ? caps.kinds : null)
      const out = []
      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i]
        if (!isObject(group)) continue
        if (group.kind && !Array.isArray(group.kinds)) {
          out.push(Object.assign({}, group, { groupId: "", groupNameZh: "", groupNameEn: "", options: optionList(group.options) }))
          continue
        }
        const children = safeArray(group.kinds)
        for (let j = 0; j < children.length; j += 1) {
          const child = children[j]
          if (!isObject(child)) continue
          out.push(
            Object.assign({}, child, {
              groupId: String(group.id || ""),
              groupNameZh: String(group.name_zh || ""),
              groupNameEn: String(group.name_en || ""),
              options: optionList(child.options),
            }),
          )
        }
      }
      return out
    }

    function kindCategories(caps) {
      const groups = safeArray(isObject(caps) ? caps.kinds : null)
      const out = []
      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i]
        if (!isObject(group) || !Array.isArray(group.kinds)) continue
        out.push({
          id: String(group.id || ""),
          zh: String(group.name_zh || group.id || ""),
          en: String(group.name_en || group.name_zh || group.id || ""),
          count: group.kinds.length,
        })
      }
      return out
    }

    function categoryLabel(category, lang) {
      const row = CATEGORY_LABEL[String(category || "")]
      if (!row) return String(category || "")
      return lang === "en" ? row[1] : row[0]
    }

    function filterKindList(kinds, query, groupId) {
      const q = String(query || "").trim().toLowerCase()
      const group = String(groupId || "")
      return safeArray(kinds).filter((kind) => {
        if (!kind) return false
        if (group && String(kind.groupId || "") !== group) return false
        if (!q) return true
        const haystack = [
          String(kind.kind || ""),
          String(kind.name_zh || ""),
          String(kind.name_en || ""),
          String(kind.summary_zh || ""),
          String(kind.summary_en || ""),
          safeArray(kind.tags).join(" "),
        ]
          .join(" ")
          .toLowerCase()
        return haystack.indexOf(q) !== -1
      })
    }

    function groupSamplesByDomain(samples, caps, lang) {
      const list = safeArray(samples)
      const domains = safeArray(isObject(caps) && isObject(caps.themes) ? caps.themes.domains : null)
      const groups = []
      const map = Object.create(null)
      for (let i = 0; i < list.length; i += 1) {
        const sample = list[i]
        if (!sample) continue
        const domainId = String(sample.domain || "other")
        if (!map[domainId]) {
          const domain = domains.find((item) => item && String(item.id) === domainId)
          map[domainId] = {
            id: domainId,
            label: domain ? pickLocalized(domain, lang, "name") : domainId,
            samples: [],
          }
          groups.push(map[domainId])
        }
        map[domainId].samples.push(sample)
      }
      return groups
    }

    /* ------------------------------------------------------------------ */
    /* Settings, paths, engine                                            */
    /* ------------------------------------------------------------------ */

    function settingsFormFrom(settings) {
      const value = isObject(settings) ? settings : {}
      return {
        defaultDomain: String(value.defaultDomain || ""),
        defaultJournal: String(value.defaultJournal || ""),
        defaultPalette: String(value.defaultPalette || ""),
        defaultFont: String(value.defaultFont || ""),
        defaultSize: String(value.defaultSize || ""),
        defaultDpi: toNumber(value.defaultDpi, DEFAULT_DPI),
      }
    }

    function buildSettingsPatch(form) {
      const value = isObject(form) ? form : {}
      const patch = {}
      const keys = ["defaultDomain", "defaultJournal", "defaultPalette", "defaultFont", "defaultSize"]
      for (let i = 0; i < keys.length; i += 1) {
        if (typeof value[keys[i]] === "string") patch[keys[i]] = value[keys[i]]
      }
      const dpi = toNumber(value.defaultDpi, null)
      if (dpi !== null && dpi >= 72 && dpi <= 1200) patch.defaultDpi = Math.round(dpi)
      return patch
    }

    function engineStatus(engine) {
      if (!isObject(engine)) return { state: "unknown", labelKey: "engineUnknown", available: null }
      if (engine.available === true || engine.ok === true) return { state: "ok", labelKey: "engineOk", available: true }
      if (engine.available === false || engine.ok === false) return { state: "down", labelKey: "engineDown", available: false }
      return { state: "unknown", labelKey: "engineUnknown", available: null }
    }

    function engineFacts(engine) {
      const facts = []
      if (!isObject(engine)) return facts
      const keys = Object.keys(engine)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        if (key === "available" || key === "ok") continue
        const value = engine[key]
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          facts.push({ label: key, value: String(value) })
        } else if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" || typeof item === "number")) {
          facts.push({ label: key, value: value.slice(0, 8).join(", ") })
        }
      }
      return facts
    }

    function engineFontList(engine) {
      if (!isObject(engine)) return []
      const value = engine.cjkFamilies || engine.cjkFonts || engine.cjk_fonts || engine.fonts || engine.cjk
      const label = (item) => {
        if (typeof item === "string") return item
        if (typeof item === "number") return String(item)
        if (isObject(item)) return item.name_zh || item.name || item.family || item.id || item.name_en || ""
        return ""
      }
      if (Array.isArray(value)) return value.map(label).filter(Boolean)
      if (typeof value === "string") return [value]
      return []
    }

    function pathEntries(paths, diagnostics, settings) {
      const candidates = [
        ["dataDir", "dataDirLabel", paths && paths.dataDir],
        ["galleryDir", "galleryDirLabel", paths && (paths.galleryDir || paths.gallery)],
        ["figuresDir", "figuresDirLabel", paths && (paths.figuresDir || paths.figures)],
        ["assetsDir", "assetsDirLabel", paths && (paths.assetsDir || paths.assets)],
        ["workspace", "workspaceDirLabel", paths && paths.workspace],
        ["root", "rootDirLabel", paths && (paths.root || paths.pluginRoot)],
        ["dataDirDiag", "dataDirLabel", diagnostics && diagnostics.dataDir],
        ["dataDirSettings", "dataDirLabel", settings && settings.dataDir],
      ]
      const seen = Object.create(null)
      const out = []
      for (let i = 0; i < candidates.length; i += 1) {
        const row = candidates[i]
        if (typeof row[2] !== "string" || !row[2]) continue
        if (seen[row[2]]) continue
        seen[row[2]] = true
        out.push({ id: row[0], labelKey: row[1], value: row[2] })
      }
      return out
    }

    /* ------------------------------------------------------------------ */
    /* Export helpers                                                     */
    /* ------------------------------------------------------------------ */

    function buildExportBody(formats, options) {
      const list = uniqueStrings(safeArray(formats).map((value) => String(value || "").toLowerCase())).filter((format) => FORMATS.indexOf(format) !== -1)
      const body = { formats: list.length > 0 ? list : ["png"] }
      const opts = isObject(options) ? options : {}
      const dpi = toNumber(opts.dpi, null)
      if (dpi !== null && dpi > 0) body.dpi = Math.round(dpi)
      const width = toNumber(opts.widthMm, null)
      if (width !== null && width > 0) body.width_mm = width
      if (typeof opts.journal === "string" && opts.journal) body.journal = opts.journal
      return body
    }

    function formatLabel(format) {
      return FORMAT_LABEL[String(format || "").toLowerCase()] || String(format || "").toUpperCase()
    }

    function formatsForFigure(figure, caps) {
      const fromFigure = safeArray(figure && figure.formats).map((value) => String(value || "").toLowerCase()).filter((value) => FORMATS.indexOf(value) !== -1)
      if (fromFigure.length > 0) return FORMATS.filter((format) => fromFigure.indexOf(format) !== -1)
      const spec = isObject(caps) && isObject(caps.spec) ? caps.spec : {}
      const fromCaps = safeArray(spec.formats).map((value) => String(value || "").toLowerCase()).filter((value) => FORMATS.indexOf(value) !== -1)
      if (fromCaps.length > 0) return FORMATS.filter((format) => fromCaps.indexOf(format) !== -1)
      return FORMATS.slice()
    }

    /* ------------------------------------------------------------------ */
    /* Host theme detection                                               */
    /* ------------------------------------------------------------------ */

    function detectDarkTheme() {
      try {
        if (typeof document === "undefined") return false
        const roots = [document.documentElement, document.body]
        const attrs = ["data-theme", "data-ds-dark-theme", "data-color-mode", "data-dsw-theme", "data-mode"]
        for (let i = 0; i < roots.length; i += 1) {
          const root = roots[i]
          if (!root) continue
          for (let j = 0; j < attrs.length; j += 1) {
            const value = root.getAttribute ? root.getAttribute(attrs[j]) : null
            if (value && String(value).toLowerCase().indexOf("dark") !== -1) return true
          }
          const className = typeof root.className === "string" ? root.className : ""
          if (/\bdark\b/i.test(className)) return true
        }
        const token = typeof getComputedStyle === "function" ? getComputedStyle(document.documentElement).getPropertyValue("--dsw-alias-bg-base").trim() : ""
        if (token) {
          const rgb = parseColour(token)
          if (rgb) {
            const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
            return luminance < 0.42
          }
        }
        if (typeof window !== "undefined" && typeof window.matchMedia === "function") return window.matchMedia("(prefers-color-scheme: dark)").matches
      } catch (error) {}
      return false
    }

    function parseColour(value) {
      const text = String(value || "").trim()
      if (!text) return null
      const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
      if (hex) {
        let raw = hex[1]
        if (raw.length === 3) raw = raw.charAt(0) + raw.charAt(0) + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2)
        return {
          r: parseInt(raw.slice(0, 2), 16),
          g: parseInt(raw.slice(2, 4), 16),
          b: parseInt(raw.slice(4, 6), 16),
        }
      }
      const rgb = text.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i)
      if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
      return null
    }

    function useDarkTheme() {
      const [dark, setDark] = useState(() => detectDarkTheme())
      useEffect(() => {
        if (typeof MutationObserver === "undefined" || typeof document === "undefined") return undefined
        let frame = 0
        const update = () => {
          if (frame) return
          frame = window.setTimeout(() => {
            frame = 0
            setDark(detectDarkTheme())
          }, 60)
        }
        update()
        const observer = new MutationObserver(update)
        try {
          if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-ds-dark-theme", "data-color-mode", "class", "style"] })
          if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "data-ds-dark-theme", "class", "style"] })
          const media = window.matchMedia("(prefers-color-scheme: dark)")
          if (media && typeof media.addEventListener === "function") media.addEventListener("change", update)
        } catch (error) {}
        return () => {
          observer.disconnect()
          if (frame) window.clearTimeout(frame)
        }
      }, [])
      return dark
    }

    function useMedia(query) {
      const [matches, setMatches] = useState(() => {
        try {
          return typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false
        } catch (error) {
          return false
        }
      })
      useEffect(() => {
        let media = null
        const onChange = (event) => setMatches(Boolean(event && event.matches))
        try {
          if (typeof window.matchMedia === "function") {
            media = window.matchMedia(query)
            setMatches(media.matches)
            if (typeof media.addEventListener === "function") media.addEventListener("change", onChange)
            else if (typeof media.addListener === "function") media.addListener(onChange)
          }
        } catch (error) {}
        return () => {
          try {
            if (!media) return
            if (typeof media.removeEventListener === "function") media.removeEventListener("change", onChange)
            else if (typeof media.removeListener === "function") media.removeListener(onChange)
          } catch (error) {}
        }
      }, [query])
      return matches
    }

    /* ------------------------------------------------------------------ */
    /* Inline SVG: mark + icon set (single colour, currentColor)           */
    /* ------------------------------------------------------------------ */

    function SciPlotMark(props) {
      const size = props && props.size ? props.size : 20
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M4.2 3.8v16h16", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }),
        h("path", { d: "M7.6 16.6c2.2-1 3.1-6.2 5-6.7 1.5-.4 2.2 3.4 4.1-1.4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
        h("circle", { cx: 12.6, cy: 9.9, r: 1.4, fill: "currentColor" }),
      )
    }

    function Icon(props) {
      const p = props || {}
      const name = p.name || "gallery"
      const size = p.size || 15
      const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: p.strokeWidth || 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        focusable: "false",
      }
      if (name === "gallery") {
        return h(
          "svg",
          common,
          h("rect", { x: 3.5, y: 4.5, width: 17, height: 15, rx: 1.6 }),
          h("path", { d: "M3.5 15l4.5-4 4 3.5 3-2.5 4.5 4" }),
          h("circle", { cx: 9, cy: 9, r: 0.9, fill: "currentColor", stroke: "none" }),
        )
      }
      if (name === "sliders") {
        return h(
          "svg",
          common,
          h("path", { d: "M4 7h9M17 7h3M4 17h4M12 17h8" }),
          h("circle", { cx: 15, cy: 7, r: 2 }),
          h("circle", { cx: 10, cy: 17, r: 2 }),
        )
      }
      if (name === "palette") {
        return h(
          "svg",
          common,
          h("path", { d: "M12 3.2a8.8 8.8 0 0 0 0 17.6c1.5 0 2.1-1 2.1-2.1 0-1-.6-1.9-2.1-1.9h-1a2.9 2.9 0 0 1 0-5.8h4a2.9 2.9 0 0 0 2.9-2.9c0-2.8-2.9-4.9-5.9-4.9z" }),
          h("circle", { cx: 8, cy: 9.2, r: 0.9, fill: "currentColor", stroke: "none" }),
          h("circle", { cx: 12, cy: 6.7, r: 0.9, fill: "currentColor", stroke: "none" }),
          h("circle", { cx: 15.8, cy: 9.2, r: 0.9, fill: "currentColor", stroke: "none" }),
        )
      }
      if (name === "database") {
        return h(
          "svg",
          common,
          h("ellipse", { cx: 12, cy: 5.8, rx: 7.2, ry: 2.6 }),
          h("path", { d: "M4.8 5.8v12.4c0 1.4 3.2 2.6 7.2 2.6s7.2-1.2 7.2-2.6V5.8" }),
          h("path", { d: "M4.8 12c0 1.4 3.2 2.6 7.2 2.6s7.2-1.2 7.2-2.6" }),
        )
      }
      if (name === "settings") {
        return h(
          "svg",
          common,
          h("circle", { cx: 12, cy: 12, r: 3 }),
          h("path", { d: "M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" }),
        )
      }
      if (name === "refresh") return h("svg", common, h("path", { d: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" }))
      if (name === "plus") return h("svg", common, h("path", { d: "M12 5v14M5 12h14" }))
      if (name === "minus") return h("svg", common, h("path", { d: "M5 12h14" }))
      if (name === "play") return h("svg", common, h("path", { d: "M7.5 4.5l11 7.5-11 7.5v-15z" }))
      if (name === "check") return h("svg", common, h("path", { d: "M20 6L9 17l-5-5" }))
      if (name === "x") return h("svg", common, h("path", { d: "M6 6l12 12M18 6L6 18" }))
      if (name === "warning") return h("svg", common, h("path", { d: "M12 3.6L21.5 20H2.5L12 3.6zM12 10v4M12 17h.01" }))
      if (name === "info") return h("svg", common, h("circle", { cx: 12, cy: 12, r: 8.4 }), h("path", { d: "M12 11v5M12 8h.01" }))
      if (name === "chevronRight") return h("svg", common, h("path", { d: "M9 6l6 6-6 6" }))
      if (name === "chevronDown") return h("svg", common, h("path", { d: "M6 9l6 6 6-6" }))
      if (name === "chevronLeft") return h("svg", common, h("path", { d: "M15 6l-6 6 6 6" }))
      if (name === "back") return h("svg", common, h("path", { d: "M10 6l-6 6 6 6M4 12h16" }))
      if (name === "download") return h("svg", common, h("path", { d: "M12 4v11M7.5 11l4.5 4 4.5-4M4 20h16" }))
      if (name === "copy") return h("svg", common, h("path", { d: "M9 9h11v11H9V9zM5 15V4h11" }))
      if (name === "folder") return h("svg", common, h("path", { d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" }))
      if (name === "external") return h("svg", common, h("path", { d: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" }))
      if (name === "trash") return h("svg", common, h("path", { d: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" }))
      if (name === "search") return h("svg", common, h("circle", { cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { d: "M15.5 15.5L21 21" }))
      if (name === "image") return h("svg", common, h("rect", { x: 3.5, y: 4.5, width: 17, height: 15, rx: 1.6 }), h("path", { d: "M3.5 15l4.5-4 4 3.5 3-2.5 4.5 4M9 9h.01" }))
      if (name === "zoomIn") return h("svg", common, h("circle", { cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { d: "M15.5 15.5L21 21M10.5 8v5M8 10.5h5" }))
      if (name === "zoomOut") return h("svg", common, h("circle", { cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { d: "M15.5 15.5L21 21M8 10.5h5" }))
      if (name === "fit") return h("svg", common, h("path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" }))
      if (name === "expand") return h("svg", common, h("path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" }))
      if (name === "file") return h("svg", common, h("path", { d: "M7 3h7l4 4v14H7V3zM14 3v4h4M9.5 12h5M9.5 16h5" }))
      if (name === "grid") return h("svg", common, h("path", { d: "M4 9h16M4 15h16M9 4v16M15 4v16" }))
      if (name === "list") return h("svg", common, h("path", { d: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" }))
      if (name === "font") return h("svg", common, h("path", { d: "M5 6h14M12 6v12M9 18h6" }))
      if (name === "ruler") return h("svg", common, h("path", { d: "M4 15L15 4l5 5L9 20l-5-5zM7.5 11.5l2 2M10.5 8.5l2 2M13.5 5.5l2 2" }))
      if (name === "dot") return h("svg", common, h("circle", { cx: 12, cy: 12, r: 3, fill: "currentColor", stroke: "none" }))
      if (name === "help") return h("svg", common, h("circle", { cx: 12, cy: 12, r: 8.4 }), h("path", { d: "M9.7 9.3a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 1.8-2.3 3.3M12 16.8h.01" }))
      return h("svg", common, h("circle", { cx: 12, cy: 12, r: 8 }), h("path", { d: "M12 8v4l2.5 2.5" }))
    }

/**
 * dsh-sci-plot — 01-primitives
 *
 * Component-level stylesheet (rendered as a <style> element inside the panel so
 * unmounting removes it) plus the shared UI primitives. Only host theme tokens
 * are used for surfaces, borders and labels; fixed artwork colours are reserved
 * for the figure preview and quality badges.
 */

    const STYLES = `
      .scp-root {
        --scp-bg: var(--dsw-alias-bg-base, #fbfbfa);
        --scp-layer1: var(--dsw-alias-bg-layer-1, #ffffff);
        --scp-layer2: var(--dsw-alias-bg-layer-2, #f5f5f2);
        --scp-layer3: var(--dsw-alias-bg-layer-3, #ececea);
        --scp-border: var(--dsw-alias-border-l1, rgba(20, 20, 20, 0.10));
        --scp-border2: var(--dsw-alias-border-l2, rgba(20, 20, 20, 0.16));
        --scp-border3: var(--dsw-alias-border-l3, rgba(20, 20, 20, 0.24));
        --scp-ink: var(--dsw-alias-label-primary, #1a1a1a);
        --scp-ink2: var(--dsw-alias-label-secondary, #4b4b47);
        --scp-ink3: var(--dsw-alias-label-tertiary, #7d7d76);
        --scp-caption: var(--dsw-alias-label-caption, #8b8b84);
        --scp-brand: var(--dsw-alias-brand-primary, #2c5f8a);
        --scp-brand-ink: var(--dsw-alias-label-primary-inverted, #ffffff);
        --scp-hover: var(--dsw-alias-interactive-bg-hover, rgba(20, 20, 20, 0.05));
        --scp-ok: var(--dsw-alias-state-success-primary, #2f7d5b);
        --scp-warn: var(--dsw-alias-state-warn-primary, #9a6a15);
        --scp-danger: var(--dsw-alias-state-error-primary, #b03a2e);
        --scp-info: #2c5f8a;
        --scp-radius: var(--dsw-radius-md, 8px);
        --scp-radius-lg: var(--dsw-radius-lg, 12px);
        --scp-shadow: var(--dsw-shadow-lv1, 0 1px 2px rgba(0, 0, 0, 0.06));
        --scp-font: var(--dsw-alias-font-family-sans, "Segoe UI Variable Text", "Segoe UI", -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif);
        --scp-mono: var(--dsw-alias-font-family-mono, ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace);
        --scp-serif: var(--dsw-alias-font-family-serif, "Iowan Old Style", Georgia, "Songti SC", "Noto Serif SC", serif);
        --scp-inkblue: ${INK_BLUE};
        --scp-ochre: ${OCHRE};
        --scp-paper: ${CHART_PAPER};
        --scp-checker-a: #ffffff;
        --scp-checker-b: #ededeb;
        color-scheme: light;
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        background: var(--scp-bg);
        color: var(--scp-ink);
        font-family: var(--scp-font);
        font-size: 13px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      .scp-root[data-scp-theme="dark"] {
        color-scheme: dark;
        --scp-inkblue: #7fa9c9;
        --scp-ochre: #d08a68;
        --scp-checker-a: #f7f7f5;
        --scp-checker-b: #e4e4e1;
      }
      .scp-root *, .scp-root *::before, .scp-root *::after { box-sizing: border-box; }
      .scp-root button, .scp-root input, .scp-root select, .scp-root textarea { font: inherit; color: inherit; }
      .scp-root ::selection { background: color-mix(in srgb, var(--scp-brand) 24%, transparent); }
      .scp-root ::-webkit-scrollbar { width: 10px; height: 10px; }
      .scp-root ::-webkit-scrollbar-thumb { background: var(--scp-border2); border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
      .scp-root ::-webkit-scrollbar-track { background: transparent; }

      .scp-shell { display: flex; flex-direction: column; flex: 1; min-height: 0; }

      /* topbar ---------------------------------------------------------- */
      .scp-topbar {
        display: flex; align-items: center; gap: 10px;
        height: 48px; flex: none; padding: 0 14px;
        background: var(--scp-layer1);
        border-bottom: 1px solid var(--scp-border);
        min-width: 0;
      }
      .scp-brand { display: flex; align-items: center; gap: 9px; min-width: 0; flex: none; }
      .scp-brand-mark {
        width: 26px; height: 26px; flex: none;
        display: grid; place-items: center;
        border: 1px solid var(--scp-border2);
        border-radius: var(--scp-radius);
        background: var(--scp-layer2);
        color: var(--scp-ink);
      }
      .scp-brand-text { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
      .scp-brand-title { font-size: 13.5px; font-weight: 600; letter-spacing: 0.01em; line-height: 1.25; white-space: nowrap; }
      .scp-brand-sub { font-size: 10.5px; line-height: 1.3; color: var(--scp-ink3); white-space: nowrap; }
      .scp-topbar-mid { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .scp-topbar-sep { width: 1px; height: 18px; background: var(--scp-border); flex: none; }
      .scp-spacer { flex: 1; min-width: 8px; }
      .scp-topbar-actions { display: flex; align-items: center; gap: 6px; flex: none; }
      .scp-status { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--scp-ink3); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .scp-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--scp-ink3); flex: none; }
      .scp-status[data-state="ok"] .scp-status-dot { background: var(--scp-ok); }
      .scp-status[data-state="down"] { color: var(--scp-danger); }
      .scp-status[data-state="down"] .scp-status-dot { background: var(--scp-danger); }

      /* body / rail ----------------------------------------------------- */
      .scp-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
      .scp-rail {
        width: 216px; flex: none;
        display: flex; flex-direction: column; gap: 12px;
        padding: 12px 10px;
        background: var(--scp-layer1);
        border-right: 1px solid var(--scp-border);
        overflow-y: auto;
      }
      .scp-nav { display: flex; flex-direction: column; gap: 2px; }
      .scp-nav-btn {
        display: flex; align-items: center; gap: 9px;
        width: 100%; height: 34px; padding: 0 10px;
        border: 1px solid transparent; border-radius: var(--scp-radius);
        background: transparent; color: var(--scp-ink2);
        font-size: 12.5px; font-weight: 500; text-align: left; cursor: pointer;
        white-space: nowrap;
      }
      .scp-nav-btn:hover { background: var(--scp-hover); color: var(--scp-ink); }
      .scp-nav-btn[aria-current="page"] {
        background: var(--scp-layer2);
        border-color: var(--scp-border2);
        color: var(--scp-ink);
        font-weight: 600;
      }
      .scp-nav-btn[aria-current="page"] .scp-nav-icon { color: var(--scp-inkblue); }
      .scp-nav-icon { display: inline-flex; color: var(--scp-ink3); flex: none; }
      .scp-nav-label { overflow: hidden; text-overflow: ellipsis; }
      .scp-rail-sep { height: 1px; background: var(--scp-border); margin: 2px 0; }
      .scp-rail-group-title {
        font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--scp-caption); padding: 0 10px;
      }
      .scp-rail-foot {
        margin-top: auto; padding: 10px 10px 2px;
        border-top: 1px solid var(--scp-border);
        font-size: 10.5px; color: var(--scp-caption); line-height: 1.6;
      }
      .scp-rail-foot strong { color: var(--scp-ink3); font-weight: 600; }
      .scp-rail-figure-count { font-variant-numeric: tabular-nums; }

      /* main ------------------------------------------------------------ */
      .scp-main { flex: 1; min-width: 0; min-height: 0; overflow: auto; background: var(--scp-bg); }
      .scp-view { padding: 20px 22px 56px; max-width: 1480px; margin: 0 auto; }
      .scp-view-head { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
      .scp-view-heading { min-width: 0; flex: 1 1 320px; }
      .scp-h1 { margin: 0; font-size: 19px; line-height: 1.25; font-weight: 600; letter-spacing: -0.01em; }
      .scp-sub { margin: 3px 0 0; font-size: 12px; line-height: 1.55; color: var(--scp-ink3); max-width: 720px; }
      .scp-kicker { font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--scp-caption); margin: 0 0 4px; }
      .scp-toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: none; }
      .scp-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        height: 28px; padding: 0 10px;
        border: 1px solid var(--scp-border2); border-radius: var(--scp-radius);
        background: var(--scp-layer1); color: var(--scp-ink);
        font-size: 11.5px; font-weight: 500; white-space: nowrap; cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
      }
      .scp-btn:hover:not(:disabled) { background: var(--scp-layer2); border-color: var(--scp-border3); }
      .scp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .scp-btn[data-variant="primary"] { background: var(--scp-inkblue); border-color: var(--scp-inkblue); color: #ffffff; }
      .scp-btn[data-variant="primary"]:hover:not(:disabled) { background: #244f73; border-color: #244f73; }
      .scp-root[data-scp-theme="dark"] .scp-btn[data-variant="primary"] { background: #7fa9c9; border-color: #7fa9c9; color: #10161b; }
      .scp-btn[data-variant="ochre"] { background: var(--scp-ochre); border-color: var(--scp-ochre); color: #ffffff; }
      .scp-btn[data-variant="ghost"] { background: transparent; border-color: transparent; color: var(--scp-ink2); }
      .scp-btn[data-variant="ghost"]:hover:not(:disabled) { background: var(--scp-hover); color: var(--scp-ink); }
      .scp-btn[data-variant="danger"] { background: transparent; border-color: color-mix(in srgb, var(--scp-danger) 34%, transparent); color: var(--scp-danger); }
      .scp-btn[data-variant="danger"]:hover:not(:disabled) { background: color-mix(in srgb, var(--scp-danger) 8%, transparent); }
      .scp-btn[data-size="sm"] { height: 24px; padding: 0 8px; font-size: 11px; border-radius: calc(var(--scp-radius) - 1px); }
      .scp-btn[data-size="lg"] { height: 32px; padding: 0 14px; font-size: 12.5px; }
      .scp-btn[data-active="true"] { border-color: var(--scp-ink3); }
      .scp-icon-btn { width: 28px; padding: 0; }
      .scp-icon-btn[data-size="sm"] { width: 24px; }
      .scp-root button:focus-visible, .scp-root a:focus-visible, .scp-root input:focus-visible,
      .scp-root select:focus-visible, .scp-root textarea:focus-visible, .scp-root [role="button"]:focus-visible {
        outline: 2px solid var(--scp-brand); outline-offset: 2px;
      }

      /* filters --------------------------------------------------------- */
      .scp-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 14px; }
      .scp-filter { display: inline-flex; align-items: center; gap: 6px; }
      .scp-filter-label { font-size: 11px; color: var(--scp-ink3); white-space: nowrap; }
      .scp-select, .scp-input, .scp-textarea {
        border: 1px solid var(--scp-border2); border-radius: calc(var(--scp-radius) - 1px);
        background: var(--scp-layer1); color: var(--scp-ink);
        font-size: 12px; height: 28px; padding: 0 8px; min-width: 0;
      }
      .scp-select { appearance: auto; cursor: pointer; }
      .scp-input:hover, .scp-select:hover, .scp-textarea:hover { border-color: var(--scp-border3); }
      .scp-textarea { height: auto; min-height: 76px; padding: 7px 9px; line-height: 1.5; resize: vertical; font-family: var(--scp-mono); font-size: 11.5px; }
      .scp-input[data-mono="true"] { font-family: var(--scp-mono); font-size: 11.5px; }
      .scp-count { font-size: 11px; color: var(--scp-caption); font-variant-numeric: tabular-nums; margin-left: auto; }
      .scp-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .scp-span-2 { grid-column: 1 / -1; }
      .scp-field-label { font-size: 11px; font-weight: 600; color: var(--scp-ink2); letter-spacing: 0.01em; display: flex; align-items: center; gap: 6px; }
      .scp-field-label .scp-field-optional { font-weight: 400; color: var(--scp-caption); }
      .scp-hint { font-size: 10.5px; line-height: 1.5; color: var(--scp-caption); }
      .scp-row { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
      .scp-grow { flex: 1; min-width: 0; }
      .scp-muted { color: var(--scp-ink3); }
      .scp-dim { color: var(--scp-ink2); }
      .scp-mono { font-family: var(--scp-mono); font-size: 11px; font-variant-numeric: tabular-nums; }
      .scp-tnum { font-variant-numeric: tabular-nums; }
      .scp-sep { height: 1px; background: var(--scp-border); border: 0; margin: 12px 0; }
      .scp-link { color: var(--scp-inkblue); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--scp-inkblue) 35%, transparent); cursor: pointer; }
      .scp-link:hover { border-bottom-color: var(--scp-inkblue); }
      .scp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
      .scp-scroll-x { overflow-x: auto; }

      /* chips / badges -------------------------------------------------- */
      .scp-chip {
        display: inline-flex; align-items: center; gap: 4px;
        border: 1px solid var(--scp-border2); border-radius: 999px;
        padding: 0 7px; height: 18px;
        font-size: 10.5px; line-height: 1; color: var(--scp-ink2);
        white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
      }
      .scp-chip[data-tone="ok"] { color: var(--scp-ok); border-color: color-mix(in srgb, var(--scp-ok) 32%, transparent); background: color-mix(in srgb, var(--scp-ok) 7%, transparent); }
      .scp-chip[data-tone="warn"] { color: var(--scp-warn); border-color: color-mix(in srgb, var(--scp-warn) 32%, transparent); background: color-mix(in srgb, var(--scp-warn) 7%, transparent); }
      .scp-chip[data-tone="danger"] { color: var(--scp-danger); border-color: color-mix(in srgb, var(--scp-danger) 32%, transparent); background: color-mix(in srgb, var(--scp-danger) 7%, transparent); }
      .scp-chip[data-tone="info"] { color: var(--scp-inkblue); border-color: color-mix(in srgb, var(--scp-inkblue) 32%, transparent); background: color-mix(in srgb, var(--scp-inkblue) 7%, transparent); }
      .scp-chip[data-tone="accent"] { color: var(--scp-ochre); border-color: color-mix(in srgb, var(--scp-ochre) 32%, transparent); background: color-mix(in srgb, var(--scp-ochre) 7%, transparent); }
      .scp-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
      .scp-qbadge {
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        min-width: 20px; height: 18px; padding: 0 5px;
        border-radius: 4px; border: 1px solid transparent;
        font-family: var(--scp-mono); font-size: 10.5px; font-weight: 600; line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .scp-qbadge[data-tone="ok"] { color: var(--scp-ok); background: color-mix(in srgb, var(--scp-ok) 10%, transparent); border-color: color-mix(in srgb, var(--scp-ok) 30%, transparent); }
      .scp-qbadge[data-tone="info"] { color: var(--scp-inkblue); background: color-mix(in srgb, var(--scp-inkblue) 9%, transparent); border-color: color-mix(in srgb, var(--scp-inkblue) 30%, transparent); }
      .scp-qbadge[data-tone="warn"] { color: var(--scp-warn); background: color-mix(in srgb, var(--scp-warn) 10%, transparent); border-color: color-mix(in srgb, var(--scp-warn) 30%, transparent); }
      .scp-qbadge[data-tone="danger"] { color: var(--scp-danger); background: color-mix(in srgb, var(--scp-danger) 10%, transparent); border-color: color-mix(in srgb, var(--scp-danger) 30%, transparent); }
      .scp-qscore { font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-ink3); font-variant-numeric: tabular-nums; }
      .scp-cvd { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--scp-ink3); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .scp-cvd-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--scp-warn); }
      .scp-cvd[data-safe="true"] .scp-cvd-dot { background: var(--scp-ok); }

      /* segmented control ---------------------------------------------- */
      .scp-seg {
        display: inline-flex; align-items: center; gap: 2px;
        padding: 2px; border: 1px solid var(--scp-border); border-radius: var(--scp-radius);
        background: var(--scp-layer2); flex: none;
      }
      .scp-seg-btn {
        height: 22px; padding: 0 8px; border: 0; border-radius: calc(var(--scp-radius) - 2px);
        background: transparent; color: var(--scp-ink3);
        font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;
      }
      .scp-seg-btn:hover { color: var(--scp-ink2); }
      .scp-seg-btn[aria-pressed="true"] { background: var(--scp-layer1); color: var(--scp-ink); box-shadow: var(--scp-shadow); }

      /* gallery --------------------------------------------------------- */
      .scp-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); gap: 12px; }
      .scp-card {
        display: flex; flex-direction: column; min-width: 0;
        border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg);
        background: var(--scp-layer1); overflow: hidden;
        cursor: pointer; text-align: left; padding: 0; color: inherit;
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
      }
      .scp-card:hover { transform: translateY(-2px); box-shadow: var(--scp-shadow); border-color: var(--scp-border2); }
      .scp-card-thumb {
        position: relative; display: block; width: 100%;
        aspect-ratio: 5 / 4; overflow: hidden;
        border-bottom: 1px solid var(--scp-border);
        background: var(--scp-checker-a);
      }
      .scp-card-img { display: block; width: 100%; height: 100%; object-fit: contain; padding: 8px; }
      .scp-card-thumb-fallback { position: absolute; inset: 0; display: grid; place-items: center; color: var(--scp-caption); background: var(--scp-layer2); }
      .scp-card-body { padding: 9px 11px 10px; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .scp-card-title { font-size: 12.5px; font-weight: 600; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-card-line { font-size: 11px; color: var(--scp-ink3); line-height: 1.4; display: flex; align-items: center; gap: 5px; min-width: 0; }
      .scp-card-line > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
      .scp-card-meta { font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-caption); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .scp-checker {
        background-color: var(--scp-checker-a);
        background-image: conic-gradient(var(--scp-checker-b) 25%, var(--scp-checker-a) 0 50%, var(--scp-checker-b) 0 75%, var(--scp-checker-a) 0);
        background-size: 12px 12px;
        background-position: 0 0;
      }
      .scp-ref-section { margin-top: 26px; }
      .scp-ref-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
      .scp-ref-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius); overflow: hidden; background: var(--scp-layer1); display: flex; flex-direction: column; }
      .scp-ref-img { width: 100%; aspect-ratio: 4 / 3; object-fit: contain; padding: 6px; display: block; }
      .scp-ref-label { padding: 5px 8px 7px; font-size: 10.5px; color: var(--scp-ink3); border-top: 1px solid var(--scp-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* detail ---------------------------------------------------------- */
      .scp-backbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .scp-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 14px; align-items: start; }
      .scp-detail-main { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
      .scp-figure-panel { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-figure-toolbar { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-bottom: 1px solid var(--scp-border); flex-wrap: wrap; }
      .scp-figure-title { font-size: 12px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 160px; }
      .scp-figure-stage { padding: 14px; background: var(--scp-layer2); display: flex; justify-content: center; min-height: 280px; }
      .scp-figure-scroll { width: 100%; max-height: 62vh; overflow: auto; display: flex; justify-content: center; }
      .scp-figure-shell { background: var(--scp-paper); border: 1px solid var(--scp-border); box-shadow: var(--scp-shadow); display: flex; align-items: center; justify-content: center; flex: none; }
      .scp-figure-img { display: block; max-width: 100%; height: auto; background: var(--scp-paper); }
      .scp-figure-loading { display: flex; align-items: center; justify-content: center; min-height: 280px; color: var(--scp-ink3); }
      .scp-detail-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .scp-panel { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-panel-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--scp-border); }
      .scp-panel-title { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scp-ink3); }
      .scp-panel-body { padding: 10px 12px 12px; }
      .scp-kv { display: grid; grid-template-columns: minmax(64px, auto) minmax(0, 1fr); gap: 4px 12px; margin: 0; }
      .scp-kv dt { font-size: 11px; color: var(--scp-ink3); line-height: 1.6; }
      .scp-kv dd { margin: 0; font-size: 11.5px; color: var(--scp-ink); line-height: 1.6; overflow-wrap: anywhere; text-align: right; font-variant-numeric: tabular-nums; }
      .scp-scoreline { display: flex; align-items: center; gap: 10px; }
      .scp-score-num { font-family: var(--scp-mono); font-size: 30px; font-weight: 600; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
      .scp-score-num[data-tone="ok"] { color: var(--scp-ok); }
      .scp-score-num[data-tone="info"] { color: var(--scp-inkblue); }
      .scp-score-num[data-tone="warn"] { color: var(--scp-warn); }
      .scp-score-num[data-tone="danger"] { color: var(--scp-danger); }
      .scp-score-summary { margin: 7px 0 0; font-size: 11.5px; line-height: 1.55; color: var(--scp-ink2); }
      .scp-quality-counts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .scp-check-list { display: flex; flex-direction: column; gap: 0; margin-top: 10px; max-height: 300px; overflow: auto; }
      .scp-check-row { display: flex; align-items: flex-start; gap: 7px; padding: 5px 0; border-top: 1px solid var(--scp-border); }
      .scp-check-row:first-child { border-top: 0; }
      .scp-check-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex: none; background: var(--scp-caption); }
      .scp-check-row[data-status="pass"] .scp-check-dot { background: var(--scp-ok); }
      .scp-check-row[data-status="warn"] .scp-check-dot { background: var(--scp-warn); }
      .scp-check-row[data-status="fail"] .scp-check-dot { background: var(--scp-danger); }
      .scp-check-row[data-status="info"] .scp-check-dot { background: var(--scp-inkblue); }
      .scp-check-text { font-size: 11.5px; line-height: 1.5; color: var(--scp-ink2); min-width: 0; }
      .scp-export-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .scp-export-btn { justify-content: flex-start; }
      .scp-export-meta { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .scp-file-list { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }
      .scp-file-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .scp-file-format { flex: none; width: 30px; font-family: var(--scp-mono); font-size: 10px; color: var(--scp-ink3); text-transform: uppercase; }
      .scp-file-path { flex: 1; min-width: 0; font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
      .scp-warning-list { margin: 0; padding: 0 0 0 14px; display: flex; flex-direction: column; gap: 4px; }
      .scp-warning-list li { font-size: 11.5px; line-height: 1.5; color: var(--scp-warn); }
      .scp-danger-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .scp-delete-hint { font-size: 11px; color: var(--scp-danger); line-height: 1.5; }

      /* studio ---------------------------------------------------------- */
      .scp-studio-grid { display: grid; grid-template-columns: 372px minmax(0, 1fr); gap: 16px; align-items: start; }
      .scp-form { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
      .scp-form-section { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-form-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--scp-border); background: color-mix(in srgb, var(--scp-layer2) 55%, transparent); }
      .scp-form-title { margin: 0; font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--scp-ink3); }
      .scp-form-body { padding: 11px 12px 13px; display: flex; flex-direction: column; gap: 10px; }
      .scp-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 10px; }
      .scp-form-grid .scp-span-2 { grid-column: 1 / -1; }
      .scp-kind-search-wrap { position: relative; }
      .scp-kind-search-wrap .scp-input { width: 100%; padding-left: 28px; }
      .scp-kind-search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--scp-caption); pointer-events: none; display: inline-flex; }
      .scp-kind-list { display: flex; flex-direction: column; gap: 2px; max-height: 232px; overflow: auto; border: 1px solid var(--scp-border); border-radius: var(--scp-radius); background: var(--scp-bg); padding: 3px; }
      .scp-kind-group { padding: 6px 7px 3px; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--scp-caption); }
      .scp-kind-btn {
        display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
        width: 100%; padding: 5px 7px; border: 1px solid transparent; border-radius: calc(var(--scp-radius) - 2px);
        background: transparent; cursor: pointer; text-align: left;
      }
      .scp-kind-btn:hover { background: var(--scp-hover); }
      .scp-kind-btn[aria-pressed="true"] { background: var(--scp-layer1); border-color: var(--scp-border2); }
      .scp-kind-name { font-size: 12px; font-weight: 600; color: var(--scp-ink); }
      .scp-kind-btn[aria-pressed="true"] .scp-kind-name { color: var(--scp-inkblue); }
      .scp-kind-summary { font-size: 10.5px; line-height: 1.4; color: var(--scp-ink3); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
      .scp-kind-empty { padding: 10px 8px; font-size: 11px; color: var(--scp-caption); }
      .scp-kind-detail { display: flex; flex-direction: column; gap: 6px; padding: 8px 9px; border: 1px dashed var(--scp-border2); border-radius: var(--scp-radius); background: var(--scp-bg); }
      .scp-kind-detail-text { font-size: 11.5px; line-height: 1.55; color: var(--scp-ink2); }
      .scp-tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
      .scp-option-list { display: flex; flex-direction: column; gap: 8px; }
      .scp-option-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 26px; }
      .scp-option-label { font-size: 11.5px; color: var(--scp-ink2); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-option-control { flex: none; display: flex; align-items: center; gap: 6px; }
      .scp-option-control .scp-input, .scp-option-control .scp-select { height: 26px; }
      .scp-number { width: 64px; text-align: right; font-family: var(--scp-mono); font-size: 11px; height: 24px; padding: 0 6px; font-variant-numeric: tabular-nums; }
      .scp-range-wrap { display: flex; align-items: center; gap: 7px; }
      .scp-range { width: 104px; accent-color: var(--scp-inkblue); height: 16px; }
      .scp-switch {
        position: relative; width: 30px; height: 17px; flex: none;
        border: 1px solid var(--scp-border3); border-radius: 999px;
        background: var(--scp-layer2); cursor: pointer; padding: 0; transition: background 0.12s ease, border-color 0.12s ease;
      }
      .scp-switch[aria-checked="true"] { background: var(--scp-inkblue); border-color: var(--scp-inkblue); }
      .scp-switch-thumb {
        position: absolute; top: 1px; left: 1px; width: 13px; height: 13px;
        border-radius: 50%; background: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: transform 0.12s ease;
      }
      .scp-switch[aria-checked="true"] .scp-switch-thumb { transform: translateX(13px); }
      .scp-checkline { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--scp-ink2); cursor: pointer; }
      .scp-checkline input { accent-color: var(--scp-inkblue); }
      .scp-color-wrap { display: flex; align-items: center; gap: 5px; }
      .scp-color-input { width: 26px; height: 24px; padding: 1px; border: 1px solid var(--scp-border2); border-radius: 5px; background: var(--scp-layer1); cursor: pointer; }
      .scp-color-text { width: 74px; font-family: var(--scp-mono); font-size: 10.5px; height: 24px; }
      .scp-style-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 10px; }
      .scp-labels-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 10px; }
      .scp-format-row { display: flex; flex-wrap: wrap; gap: 5px; }
      .scp-format-pill {
        height: 25px; padding: 0 10px;
        border: 1px solid var(--scp-border2); border-radius: 999px;
        background: transparent; color: var(--scp-ink2);
        font-family: var(--scp-mono); font-size: 10.5px; font-weight: 600; cursor: pointer;
        font-variant-numeric: tabular-nums;
      }
      .scp-format-pill:hover { background: var(--scp-hover); }
      .scp-format-pill[aria-pressed="true"] { background: var(--scp-inkblue); border-color: var(--scp-inkblue); color: #ffffff; }
      .scp-form-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .scp-render-btn { flex: 1; min-width: 120px; }
      .scp-mapping-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
      .scp-mapping-grid .scp-span-2 { grid-column: 1 / -1; }
      .scp-paste-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .scp-paste-status { font-size: 10.5px; line-height: 1.5; }
      .scp-paste-status[data-ok="true"] { color: var(--scp-ok); }
      .scp-paste-status[data-ok="false"] { color: var(--scp-danger); }
      .scp-validation { border: 1px solid var(--scp-border); border-radius: var(--scp-radius); padding: 8px 10px; background: var(--scp-layer1); }
      .scp-validation-ok { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--scp-ok); }
      .scp-validation-issues { display: flex; flex-direction: column; gap: 4px; margin-top: 5px; }
      .scp-issue { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; line-height: 1.5; color: var(--scp-warn); }
      .scp-issue-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; margin-top: 6px; flex: none; }

      .scp-preview { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .scp-preview-panel { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-preview-head { display: flex; align-items: center; gap: 8px; padding: 8px 11px; border-bottom: 1px solid var(--scp-border); flex-wrap: wrap; }
      .scp-preview-title { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scp-ink3); }
      .scp-preview-body { padding: 14px; background: var(--scp-layer2); min-height: 320px; display: flex; flex-direction: column; justify-content: center; }
      .scp-preview-stage { display: flex; justify-content: center; align-items: center; width: 100%; }
      .scp-preview-shell { background: var(--scp-paper); border: 1px solid var(--scp-border); box-shadow: var(--scp-shadow); max-width: 100%; display: flex; align-items: center; justify-content: center; }
      .scp-preview-img { display: block; max-width: 100%; max-height: 62vh; height: auto; background: var(--scp-paper); }
      .scp-preview-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 30px 16px; color: var(--scp-ink3); }
      .scp-preview-empty-title { font-size: 13px; font-weight: 600; color: var(--scp-ink2); margin: 0; }
      .scp-preview-empty-body { font-size: 11.5px; line-height: 1.55; margin: 0; max-width: 360px; }
      .scp-preview-quality { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 9px 11px; border-top: 1px solid var(--scp-border); background: var(--scp-layer1); }
      .scp-preview-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-left: auto; }
      .scp-preview-hint { font-size: 10.5px; line-height: 1.5; color: var(--scp-caption); margin: 0; }
      .scp-rendering { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px 16px; color: var(--scp-ink3); font-size: 12px; }

      /* library --------------------------------------------------------- */
      .scp-lib-section { margin-top: 22px; }
      .scp-lib-section:first-of-type { margin-top: 4px; }
      .scp-section-title { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px; }
      .scp-section-title h2 { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
      .scp-section-title .scp-section-note { font-size: 10.5px; color: var(--scp-caption); }
      .scp-lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 10px; }
      .scp-domain-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); padding: 12px 13px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .scp-domain-head { display: flex; align-items: flex-start; gap: 8px; }
      .scp-domain-name { font-size: 13px; font-weight: 600; line-height: 1.35; margin: 0; }
      .scp-domain-desc { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--scp-ink3); }
      .scp-swatch-strip { display: flex; height: 12px; border-radius: 3px; overflow: hidden; border: 1px solid var(--scp-border); }
      .scp-swatch { flex: 1; min-width: 0; }
      .scp-domain-meta { display: flex; flex-wrap: wrap; gap: 5px; }
      .scp-domain-foot { display: flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 2px; flex-wrap: wrap; }
      .scp-table-wrap { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); overflow: hidden; background: var(--scp-layer1); }
      .scp-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      .scp-table th { text-align: left; font-weight: 600; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scp-caption); background: var(--scp-layer2); padding: 7px 10px; border-bottom: 1px solid var(--scp-border); white-space: nowrap; }
      .scp-table td { padding: 7px 10px; border-bottom: 1px solid var(--scp-border); vertical-align: top; line-height: 1.5; }
      .scp-table tr:last-child td { border-bottom: 0; }
      .scp-table tbody tr:hover td { background: color-mix(in srgb, var(--scp-hover) 60%, transparent); }
      .scp-table .scp-num { font-family: var(--scp-mono); font-size: 10.5px; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--scp-ink2); }
      .scp-palette-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .scp-palette-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
      .scp-palette-head { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
      .scp-palette-name { font-size: 12.5px; font-weight: 600; margin: 0; }
      .scp-palette-source { font-size: 10px; color: var(--scp-caption); font-family: var(--scp-mono); }
      .scp-palette-swatches { display: flex; gap: 3px; flex-wrap: wrap; }
      .scp-palette-swatch { width: 22px; height: 22px; border-radius: 3px; border: 1px solid color-mix(in srgb, var(--scp-ink) 12%, transparent); }
      .scp-cmap-list { display: flex; flex-direction: column; gap: 6px; }
      .scp-cmap-row { display: flex; flex-direction: column; gap: 3px; padding: 6px 2px 8px; border-bottom: 1px solid var(--scp-border); }
      .scp-cmap-row:last-child { border-bottom: 0; }
      .scp-cmap-head { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
      .scp-cmap-name { font-size: 11.5px; font-weight: 600; }
      .scp-cmap-kind { font-size: 10px; color: var(--scp-caption); }
      .scp-cmap-bar { height: 14px; border-radius: 3px; border: 1px solid var(--scp-border); }
      .scp-size-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
      .scp-size-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius); background: var(--scp-layer1); padding: 9px 11px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .scp-size-name { font-size: 12px; font-weight: 600; display: flex; align-items: baseline; gap: 6px; }
      .scp-size-mm { font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-caption); font-variant-numeric: tabular-nums; }
      .scp-size-track { height: 6px; border-radius: 2px; background: var(--scp-layer2); border: 1px solid var(--scp-border); overflow: hidden; }
      .scp-size-fill { height: 100%; background: var(--scp-inkblue); opacity: 0.85; }
      .scp-size-note { font-size: 10.5px; line-height: 1.45; color: var(--scp-ink3); margin: 0; }

      /* data ------------------------------------------------------------ */
      .scp-data-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 14px; align-items: start; }
      .scp-data-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .scp-data-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-data-head { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; }
      .scp-data-title { margin: 0; font-size: 12.5px; font-weight: 600; line-height: 1.4; word-break: break-word; }
      .scp-data-meta { margin: 2px 0 0; font-size: 10.5px; color: var(--scp-caption); font-variant-numeric: tabular-nums; }
      .scp-data-body { padding: 0 12px 11px; display: flex; flex-direction: column; gap: 8px; }
      .scp-data-cols { display: flex; flex-wrap: wrap; gap: 4px; }
      .scp-col-chip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--scp-border); border-radius: 4px; padding: 1px 5px; font-family: var(--scp-mono); font-size: 10px; color: var(--scp-ink2); background: var(--scp-bg); }
      .scp-col-kind { color: var(--scp-caption); font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }
      .scp-data-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .scp-preview-wrap { border-top: 1px solid var(--scp-border); background: var(--scp-bg); padding: 8px 10px 10px; }
      .scp-preview-table { width: 100%; border-collapse: collapse; font-family: var(--scp-mono); font-size: 10px; }
      .scp-preview-table th { text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--scp-border2); color: var(--scp-ink3); font-weight: 600; white-space: nowrap; }
      .scp-preview-table td { padding: 2px 6px; border-bottom: 1px solid var(--scp-border); color: var(--scp-ink2); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .scp-preview-table tr:last-child td { border-bottom: 0; }
      .scp-preview-note { margin: 6px 0 0; font-size: 10.5px; color: var(--scp-caption); line-height: 1.5; }

      /* settings -------------------------------------------------------- */
      .scp-settings-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
      .scp-settings-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .scp-engine-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .scp-engine-state { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
      .scp-engine-state .scp-status-dot { width: 7px; height: 7px; }
      .scp-engine-state[data-state="ok"] { color: var(--scp-ok); }
      .scp-engine-state[data-state="down"] { color: var(--scp-danger); }
      .scp-engine-state[data-state="unknown"] { color: var(--scp-ink3); }
      .scp-facts { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 12px; margin-top: 9px; }
      .scp-fact { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .scp-fact-label { font-size: 10px; color: var(--scp-caption); text-transform: lowercase; font-family: var(--scp-mono); }
      .scp-fact-value { font-size: 11px; color: var(--scp-ink2); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
      .scp-font-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      .scp-path-row { display: flex; align-items: center; gap: 6px; padding: 6px 0; border-top: 1px solid var(--scp-border); min-width: 0; }
      .scp-path-row:first-child { border-top: 0; }
      .scp-path-label { flex: none; width: 84px; font-size: 10.5px; color: var(--scp-ink3); }
      .scp-path-value { flex: 1; min-width: 0; font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-pre { margin: 0; padding: 9px 10px; border: 1px solid var(--scp-border); border-radius: var(--scp-radius); background: var(--scp-bg); font-family: var(--scp-mono); font-size: 10.5px; line-height: 1.55; color: var(--scp-ink2); max-height: 260px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
      .scp-form-actions-end { display: flex; align-items: center; gap: 8px; margin-top: 2px; }

      /* empty / loading / error / notice -------------------------------- */
      .scp-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 20px; border: 1px dashed var(--scp-border2); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); }
      .scp-empty-icon { color: var(--scp-ink3); margin-bottom: 10px; }
      .scp-empty-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--scp-ink); }
      .scp-empty-body { margin: 5px 0 0; max-width: 440px; font-size: 11.5px; line-height: 1.6; color: var(--scp-ink3); }
      .scp-empty-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: center; margin-top: 13px; }
      .scp-error { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--scp-danger) 30%, transparent); border-radius: var(--scp-radius-lg); background: color-mix(in srgb, var(--scp-danger) 5%, transparent); }
      .scp-error-title { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--scp-danger); }
      .scp-error-message { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--scp-ink2); overflow-wrap: anywhere; }
      .scp-loading { display: flex; align-items: center; gap: 8px; padding: 26px 6px; color: var(--scp-ink3); font-size: 12px; }
      .scp-spinner {
        width: 14px; height: 14px; flex: none; border-radius: 50%;
        border: 1.5px solid var(--scp-border2); border-top-color: var(--scp-inkblue);
        animation: scp-spin 0.7s linear infinite; display: inline-block;
      }
      .scp-spinner[data-size="sm"] { width: 11px; height: 11px; border-width: 1.2px; }
      @keyframes scp-spin { to { transform: rotate(360deg); } }
      .scp-skeleton { border-radius: 4px; background: linear-gradient(90deg, var(--scp-layer2), color-mix(in srgb, var(--scp-layer2) 55%, var(--scp-layer1)), var(--scp-layer2)); background-size: 200% 100%; animation: scp-shimmer 1.2s ease-in-out infinite; }
      @keyframes scp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      .scp-skeleton-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); overflow: hidden; background: var(--scp-layer1); }
      .scp-notice { display: flex; align-items: flex-start; gap: 7px; padding: 8px 10px; border: 1px solid var(--scp-border2); border-radius: var(--scp-radius); font-size: 11.5px; line-height: 1.5; background: var(--scp-layer1); color: var(--scp-ink2); }
      .scp-notice[data-tone="warn"] { border-color: color-mix(in srgb, var(--scp-warn) 30%, transparent); background: color-mix(in srgb, var(--scp-warn) 6%, transparent); color: var(--scp-warn); }
      .scp-notice[data-tone="err"] { border-color: color-mix(in srgb, var(--scp-danger) 30%, transparent); background: color-mix(in srgb, var(--scp-danger) 6%, transparent); color: var(--scp-danger); }
      .scp-notice[data-tone="ok"] { border-color: color-mix(in srgb, var(--scp-ok) 30%, transparent); background: color-mix(in srgb, var(--scp-ok) 6%, transparent); color: var(--scp-ok); }

      /* toast ----------------------------------------------------------- */
      .scp-toast {
        position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
        z-index: 60; display: flex; align-items: center; gap: 8px;
        max-width: min(560px, calc(100% - 32px));
        padding: 8px 12px; border-radius: var(--scp-radius);
        border: 1px solid var(--scp-border2);
        background: var(--dsw-alias-toast-bg, var(--scp-layer1));
        color: var(--dsw-alias-toast-label, var(--scp-ink));
        box-shadow: var(--dsw-shadow-lv2, 0 6px 24px rgba(0, 0, 0, 0.16));
        font-size: 12px; line-height: 1.45;
      }
      .scp-toast[data-tone="err"] { border-color: color-mix(in srgb, var(--scp-danger) 40%, transparent); color: var(--scp-danger); }
      .scp-toast[data-tone="ok"] .scp-toast-icon { color: var(--scp-ok); }
      .scp-toast-text { min-width: 0; overflow-wrap: anywhere; }
      .scp-toast-close { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0; display: inline-flex; opacity: 0.65; flex: none; }
      .scp-toast-close:hover { opacity: 1; }

      /* lightbox -------------------------------------------------------- */
      .scp-lightbox { position: fixed; inset: 0; z-index: 90; background: rgba(12, 12, 12, 0.9); display: flex; flex-direction: column; }
      .scp-lightbox-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; color: #f4f1ea; border-bottom: 1px solid rgba(255, 255, 255, 0.14); font-size: 12px; }
      .scp-lightbox-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-lightbox-body { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 16px; overflow: auto; }
      .scp-lightbox-img { max-width: 100%; max-height: 100%; object-fit: contain; background: #ffffff; }
      .scp-lightbox .scp-btn { color: #f4f1ea; border-color: rgba(255, 255, 255, 0.28); background: transparent; }
      .scp-lightbox .scp-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
      .scp-confirm-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

      /* stays a light artwork backdrop in both themes */
      .scp-checker.scp-checker {
        background-color: var(--scp-checker-a);
        background-image: conic-gradient(var(--scp-checker-b) 25%, var(--scp-checker-a) 0 50%, var(--scp-checker-b) 0 75%, var(--scp-checker-a) 0);
        background-size: 12px 12px;
        background-position: 0 0;
      }

      /* responsive ------------------------------------------------------ */
      @media (max-width: 1180px) {
        .scp-studio-grid { grid-template-columns: 330px minmax(0, 1fr); }
        .scp-detail-grid { grid-template-columns: minmax(0, 1fr) 320px; }
      }
      @media (max-width: 1024px) {
        .scp-detail-grid { grid-template-columns: 1fr; }
        .scp-detail-side { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); align-items: start; }
        .scp-palette-grid { grid-template-columns: 1fr; }
        .scp-settings-grid { grid-template-columns: 1fr; }
        .scp-data-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 900px) {
        .scp-body { flex-direction: column; }
        .scp-rail {
          width: auto; flex: none; flex-direction: row; align-items: center; gap: 6px;
          padding: 6px 10px; border-right: 0; border-bottom: 1px solid var(--scp-border);
          overflow-x: auto; overflow-y: hidden;
        }
        .scp-nav { flex-direction: row; gap: 2px; }
        .scp-nav-btn { width: auto; height: 30px; padding: 0 9px; flex: 0 0 auto; }
        .scp-rail-sep, .scp-rail-group-title, .scp-rail-foot { display: none; }
        .scp-studio-grid { grid-template-columns: 1fr; }
        .scp-preview-panel { position: static; }
        .scp-view { padding: 16px 16px 44px; }
        .scp-gallery-grid { grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); }
      }
      @media (max-width: 768px) {
        .scp-topbar { height: auto; min-height: 48px; padding: 7px 12px; flex-wrap: wrap; gap: 7px; }
        .scp-topbar-mid { display: none; }
        .scp-brand-sub { display: none; }
        .scp-view { padding: 14px 12px 40px; }
        .scp-view-head { gap: 10px; }
        .scp-view-heading { flex-basis: 100%; }
        .scp-h1 { font-size: 17px; }
        .scp-toolbar { width: 100%; }
        .scp-filters { width: 100%; }
        .scp-filter { flex: 1 1 132px; }
        .scp-filter .scp-select { flex: 1; width: 100%; }
        .scp-count { margin-left: 0; flex-basis: 100%; }
        .scp-form-grid, .scp-style-grid, .scp-labels-grid, .scp-mapping-grid { grid-template-columns: 1fr; }
        .scp-form-grid .scp-span-2, .scp-mapping-grid .scp-span-2 { grid-column: auto; }
        .scp-detail-side { grid-template-columns: 1fr; }
        .scp-figure-stage { padding: 8px; }
        .scp-preview-body { padding: 8px; min-height: 240px; }
        .scp-preview-img { max-height: 48vh; }
        .scp-export-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .scp-facts { grid-template-columns: 1fr; }
        .scp-toolbar .scp-btn { flex: 1 1 auto; }
        .scp-form-actions { display: grid; grid-template-columns: 1fr 1fr; }
        .scp-render-btn { grid-column: 1 / -1; }
        .scp-empty { padding: 32px 14px; }
        .scp-toast { bottom: 10px; }
      }
      @media (max-width: 480px) {
        .scp-gallery-grid { grid-template-columns: 1fr; }
        .scp-ref-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .scp-nav-btn { padding: 0 8px; }
        .scp-nav-label { font-size: 11.5px; }
        .scp-lib-grid { grid-template-columns: 1fr; }
        .scp-detail-side { display: flex; flex-direction: column; }
        .scp-figure-toolbar { gap: 4px; }
        .scp-card-thumb { aspect-ratio: 3 / 2; }
        .scp-settings-grid { gap: 10px; }
        .scp-export-btn { font-size: 11px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .scp-root *, .scp-root *::before, .scp-root *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
      }
    `

    /* ------------------------------------------------------------------ */
    /* Buttons and chips                                                  */
    /* ------------------------------------------------------------------ */

    function Button(props) {
      const p = props || {}
      const attributes = {
        type: p.type || "button",
        className: "scp-btn" + (p.iconOnly ? " scp-icon-btn" : "") + (p.className ? " " + p.className : ""),
        onClick: p.onClick,
        disabled: Boolean(p.disabled),
        title: p.title || undefined,
        "aria-label": p["aria-label"] || (p.iconOnly ? p.title || p.label : undefined) || undefined,
      }
      if (p.variant) attributes["data-variant"] = p.variant
      if (p.size) attributes["data-size"] = p.size
      if (p.active === true) attributes["data-active"] = "true"
      if (p.ariaPressed !== undefined) attributes["aria-pressed"] = p.ariaPressed ? "true" : "false"
      if (p.style) attributes.style = p.style
      const children = []
      if (p.glyph) children.push(h(Icon, { name: p.glyph, size: p.size === "sm" ? 12 : p.size === "lg" ? 15 : 13 }))
      if (!p.iconOnly && p.label !== undefined && p.label !== null) children.push(h("span", { key: "label" }, p.label))
      if (p.children) children.push.apply(children, Array.isArray(p.children) ? p.children : [p.children])
      return h("button", attributes, children)
    }

    function Chip(props) {
      const p = props || {}
      return h("span", { className: "scp-chip", "data-tone": p.tone || undefined, title: p.title || undefined }, p.dot ? h("span", { className: "scp-dot" }) : null, p.label)
    }

    function QualityBadge(props) {
      const p = props || {}
      const normalized = normalizeQuality(p.quality || { score: p.score, grade: p.grade })
      if (normalized.score === null && !normalized.grade) return null
      const grade = normalized.grade || qualityGrade(normalized.score)
      const tone = qualityTone(grade) || "info"
      const text = grade && normalized.score === null ? grade : normalized.score === null ? "—" : String(normalized.score) + (grade ? " " + grade : "")
      const titleKey = grade === "A" ? "qualityA" : grade === "B" ? "qualityB" : grade === "C" ? "qualityC" : grade === "D" ? "qualityD" : ""
      return h("span", {
        className: "scp-qbadge",
        "data-tone": tone,
        title: p.t && titleKey ? p.t(titleKey) : undefined,
      }, normalized.score !== null && grade ? h("span", null, normalized.score) : null, normalized.score !== null && grade ? h("span", { style: { opacity: 0.75, fontWeight: 500 } }, grade) : grade || "—")
    }

    function CvdBadge(props) {
      const p = props || {}
      const safe = p.safe === true
      const label = safe ? p.safeLabel : p.unsafeLabel
      const delta = toNumber(p.delta, null)
      return h(
        "span",
        { className: "scp-cvd", "data-safe": safe ? "true" : "false", title: p.title || label },
        h("span", { className: "scp-cvd-dot" }),
        h("span", null, label),
        delta !== null ? h("span", { style: { opacity: 0.7 } }, "ΔE " + fmtNum(delta, 0)) : null,
      )
    }

    function SectionTitle(props) {
      const p = props || {}
      return h(
        "div",
        { className: "scp-section-title" },
        h("h2", null, p.title),
        p.note ? h("span", { className: "scp-section-note" }, p.note) : null,
        h("span", { className: "scp-grow" }),
        p.right || null,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Form primitives                                                    */
    /* ------------------------------------------------------------------ */

    function Field(props) {
      const p = props || {}
      const label = p.label
      const labelNode = label
        ? h(
            "label",
            { className: "scp-field-label", htmlFor: p.htmlFor || p.id || undefined },
            h("span", null, label),
            p.optional ? h("span", { className: "scp-field-optional" }, "· " + (p.optionalLabel || "optional")) : null,
            p.right || null,
          )
        : null
      return h("div", { className: "scp-field" + (p.full ? " scp-span-2" : "") + (p.className ? " " + p.className : "") }, labelNode, p.children, p.hint ? h("span", { className: "scp-hint" }, p.hint) : null)
    }

    function Select(props) {
      const p = props || {}
      const options = safeArray(p.options)
      const attributes = {
        className: "scp-select" + (p.className ? " " + p.className : ""),
        value: p.value === undefined || p.value === null ? "" : String(p.value),
        onChange: (event) => {
          if (p.onChange) p.onChange(event.target.value)
        },
        disabled: Boolean(p.disabled),
        "aria-label": p["aria-label"] || p.title || undefined,
        title: p.title || undefined,
      }
      if (p.id) attributes.id = p.id
      if (p.style) attributes.style = p.style
      const children = p.children ? (Array.isArray(p.children) ? p.children : [p.children]) : options.map((option, index) => {
        const value = option && option.value !== undefined ? String(option.value) : ""
        return h("option", { key: option && option.value !== undefined ? value : "opt-" + index, value: value }, option && option.label !== undefined ? option.label : value)
      })
      return h("select", attributes, children)
    }

    function TextInput(props) {
      const p = props || {}
      const onChange = (event) => {
        if (p.onChange) p.onChange(event.target.value, event)
      }
      if (p.multiline === true) {
        return h("textarea", {
          id: p.id || undefined,
          className: "scp-textarea" + (p.className ? " " + p.className : ""),
          value: p.value === undefined || p.value === null ? "" : String(p.value),
          onChange: onChange,
          placeholder: p.placeholder || "",
          rows: p.rows || 5,
          disabled: Boolean(p.disabled),
          spellCheck: false,
          "aria-label": p["aria-label"] || p.title || undefined,
        })
      }
      return h("input", {
        id: p.id || undefined,
        type: p.type || "text",
        className: "scp-input" + (p.className ? " " + p.className : ""),
        value: p.value === undefined || p.value === null ? "" : String(p.value),
        onChange: onChange,
        placeholder: p.placeholder || "",
        disabled: Boolean(p.disabled),
        spellCheck: false,
        "data-mono": p.mono ? "true" : undefined,
        "aria-label": p["aria-label"] || p.title || undefined,
        style: p.style,
      })
    }

    function Switch(props) {
      const p = props || {}
      return h(
        "button",
        {
          type: "button",
          role: "switch",
          className: "scp-switch",
          "aria-checked": p.checked ? "true" : "false",
          "aria-label": p["aria-label"] || p.label || undefined,
          title: p.title || p.label || undefined,
          disabled: Boolean(p.disabled),
          onClick: () => {
            if (p.disabled) return
            if (p.onChange) p.onChange(!p.checked)
          },
        },
        h("span", { className: "scp-switch-thumb" }),
      )
    }

    function SliderControl(props) {
      const p = props || {}
      const step = toNumber(p.step, 1)
      const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3
      const min = toNumber(p.min, 0)
      const max = toNumber(p.max, 100)
      const value = clampNumber(p.value, min, max, min)
      const emit = (next) => {
        if (p.onChange) p.onChange(clampNumber(next, min, max, value))
      }
      return h(
        "span",
        { className: "scp-range-wrap" },
        h("input", {
          type: "range",
          className: "scp-range",
          min: min,
          max: max,
          step: step,
          value: value,
          onChange: (event) => emit(event.target.value),
          disabled: Boolean(p.disabled),
          "aria-label": p["aria-label"] || p.label || undefined,
        }),
        h("input", {
          type: "number",
          className: "scp-input scp-number",
          min: min,
          max: max,
          step: step,
          value: fmtNumberInput(value, digits),
          onChange: (event) => {
            const raw = event.target.value
            if (raw === "") return
            const n = Number(raw)
            if (!Number.isFinite(n)) return
            emit(n)
          },
          disabled: Boolean(p.disabled),
          "aria-label": p["aria-label"] || p.label || undefined,
        }),
      )
    }

    function fmtNumberInput(value, digits) {
      const n = toNumber(value, null)
      if (n === null) return ""
      if (digits <= 0) return String(Math.round(n))
      return String(Number(n.toFixed(digits)))
    }

    function ColorControl(props) {
      const p = props || {}
      const value = /^#[0-9a-f]{6}$/i.test(String(p.value || "")) ? String(p.value) : "#2c5f8a"
      return h(
        "span",
        { className: "scp-color-wrap" },
        h("input", {
          type: "color",
          className: "scp-color-input",
          value: value,
          onChange: (event) => p.onChange && p.onChange(event.target.value),
          disabled: Boolean(p.disabled),
          "aria-label": p["aria-label"] || p.label || "colour",
        }),
        h("input", {
          type: "text",
          className: "scp-input scp-color-text",
          value: p.value === undefined || p.value === null ? "" : String(p.value),
          onChange: (event) => p.onChange && p.onChange(event.target.value),
          disabled: Boolean(p.disabled),
          spellCheck: false,
          "aria-label": p["aria-label"] || p.label || "colour value",
        }),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Status primitives                                                  */
    /* ------------------------------------------------------------------ */

    function Spinner(props) {
      const p = props || {}
      return h("span", { className: "scp-spinner", "data-size": p.size || undefined, "aria-hidden": "true" })
    }

    function Loading(props) {
      const p = props || {}
      return h("div", { className: "scp-loading", role: "status" }, h(Spinner, null), h("span", null, p.label || "…"))
    }

    function Skeleton(props) {
      const p = props || {}
      return h("div", { className: "scp-skeleton", style: Object.assign({ height: p.height || 12, width: p.width || "100%" }, p.style || {}) })
    }

    function ErrorState(props) {
      const p = props || {}
      return h(
        "div",
        { className: "scp-error", role: "alert" },
        h("p", { className: "scp-error-title" }, p.title || ""),
        p.message ? h("p", { className: "scp-error-message" }, p.message) : null,
        p.children || null,
        p.onRetry
          ? h("div", { style: { marginTop: 6 } }, h(Button, { size: "sm", glyph: "refresh", label: p.retryLabel || "Retry", onClick: p.onRetry }))
          : null,
      )
    }

    function EmptyState(props) {
      const p = props || {}
      return h(
        "div",
        { className: "scp-empty" },
        p.icon ? h("div", { className: "scp-empty-icon" }, h(Icon, { name: p.icon, size: 24 })) : null,
        h("p", { className: "scp-empty-title" }, p.title || ""),
        p.body ? h("p", { className: "scp-empty-body" }, p.body) : null,
        p.actions ? h("div", { className: "scp-empty-actions" }, p.actions) : null,
      )
    }

    function Notice(props) {
      const p = props || {}
      return h("div", { className: "scp-notice", "data-tone": p.tone || "info", role: p.tone === "err" ? "alert" : "status" }, p.children)
    }

    function Toast(props) {
      const p = props || {}
      const notice = p.notice
      if (!notice) return null
      const tone = notice.tone === "err" ? "err" : "ok"
      return h(
        "div",
        { className: "scp-toast", "data-tone": tone, role: "status", "aria-live": "polite" },
        h("span", { className: "scp-toast-icon", style: { display: "inline-flex" } }, h(Icon, { name: tone === "err" ? "warning" : "check", size: 13 })),
        h("span", { className: "scp-toast-text" }, notice.text),
        p.onClose
          ? h("button", { type: "button", className: "scp-toast-close", onClick: p.onClose, "aria-label": p.closeLabel || "close" }, h(Icon, { name: "x", size: 12 }))
          : null,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Figure image + lightbox                                            */
    /* ------------------------------------------------------------------ */

    function FigureImage(props) {
      const p = props || {}
      const [failed, setFailed] = useState(false)
      const [attempt, setAttempt] = useState(0)
      useEffect(() => {
        setFailed(false)
      }, [p.src])
      if (!p.src) {
        return h("div", { className: "scp-card-thumb-fallback" }, h(Icon, { name: "image", size: 20 }))
      }
      if (failed) {
        const retryable = p.retryable !== false
        return h(
          "div",
          { className: "scp-card-thumb-fallback" },
          h(Icon, { name: "warning", size: 18 }),
          h("span", { style: { fontSize: 10.5, marginLeft: 6 } }, p.failedLabel || "image"),
          retryable
            ? h(
                "button",
                {
                  type: "button",
                  className: "scp-btn",
                  "data-size": "sm",
                  style: { marginLeft: 8 },
                  onClick: () => {
                    setFailed(false)
                    setAttempt((value) => value + 1)
                  },
                },
                p.retryLabel || "Retry",
              )
            : null,
        )
      }
      const src = attempt > 0 ? p.src + (p.src.indexOf("?") === -1 ? "?" : "&") + "retry=" + attempt : p.src
      return h("img", {
        className: p.className || "scp-card-img",
        src: src,
        alt: p.alt || "",
        loading: p.eager ? "eager" : "lazy",
        draggable: false,
        onError: () => setFailed(true),
        onClick: p.onClick,
        style: p.style,
      })
    }

    /** Div-based card that behaves like a button and stays keyboard reachable. */
    function clickableProps(onClick, ariaLabel) {
      return {
        role: "button",
        tabIndex: 0,
        "aria-label": ariaLabel || undefined,
        onClick: (event) => {
          if (onClick) onClick(event)
        },
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
            event.preventDefault()
            if (onClick) onClick(event)
          }
        },
      }
    }

    function Lightbox(props) {
      const p = props || {}
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            if (p.onClose) p.onClose()
          }
        }
        window.addEventListener("keydown", onKey, true)
        return () => window.removeEventListener("keydown", onKey, true)
      }, [p.onClose])
      return h(
        "div",
        { className: "scp-lightbox", role: "dialog", "aria-modal": "true", "aria-label": p.title || "" },
        h(
          "div",
          { className: "scp-lightbox-bar" },
          h(Icon, { name: "image", size: 14 }),
          h("span", { className: "scp-lightbox-title" }, p.title || ""),
          p.href
            ? h(
                "a",
                { className: "scp-btn", "data-size": "sm", href: p.href, target: "_blank", rel: "noreferrer noopener", style: { textDecoration: "none", color: "#f4f1ea", borderColor: "rgba(255,255,255,.28)" } },
                h(Icon, { name: "external", size: 12 }),
                h("span", null, p.openLabel || "open"),
              )
            : null,
          h(Button, { size: "sm", iconOnly: true, glyph: "x", title: p.closeLabel || "close", onClick: p.onClose }),
        ),
        h("div", { className: "scp-lightbox-body", onMouseDown: (event) => { if (event.target === event.currentTarget && p.onClose) p.onClose() } }, h("img", { className: "scp-lightbox-img", src: p.src, alt: p.alt || p.title || "" })),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Small layout helpers                                               */
    /* ------------------------------------------------------------------ */

    function KV(props) {
      const p = props || {}
      const rows = safeArray(p.rows)
      return h(
        "dl",
        { className: "scp-kv" },
        rows.map((row, index) => [
          h("dt", { key: "k" + index }, row.label),
          h("dd", { key: "v" + index, className: row.mono ? "scp-mono" : undefined }, row.value === undefined || row.value === null || row.value === "" ? "—" : row.value),
        ]),
      )
    }

    function StatusLine(props) {
      const p = props || {}
      return h("span", { className: "scp-status", "data-state": p.state || "unknown" }, h("span", { className: "scp-status-dot" }), h("span", null, p.label))
    }

/**
 * dsh-sci-plot — 02-gallery
 *
 * Gallery grid with kind/domain filters, empty/error/loading states, the
 * engine reference strip, and the figure detail view (large checkerboard stage,
 * quality checklist, journal export, delete/reveal/copy, hand-off to studio).
 */

    function styleNameFromCaps(caps, group, id, lang) {
      if (!id) return ""
      const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
      const palettes = isObject(caps) && isObject(caps.palettes) ? caps.palettes : {}
      let list = []
      if (group === "palette") list = safeArray(palettes.categorical)
      else if (group === "cmap") list = safeArray(palettes.continuous)
      else if (group === "journal") list = safeArray(themes.journals)
      else if (group === "font") list = safeArray(themes.fonts)
      else if (group === "size") list = safeArray(themes.sizes)
      else if (group === "domain") list = safeArray(themes.domains)
      const found = list.filter((item) => item && String(item.id) === String(id))[0]
      return found ? pickLocalized(found, lang, "name") : String(id)
    }

    function FigureSkeletonGrid() {
      const cards = []
      for (let i = 0; i < 6; i += 1) {
        cards.push(
          h(
            "div",
            { className: "scp-skeleton-card", key: "sk-" + i },
            h(Skeleton, { height: 0, style: { aspectRatio: "5 / 4", borderRadius: 0 } }),
            h(
              "div",
              { style: { padding: "9px 11px 10px", display: "flex", flexDirection: "column", gap: 7 } },
              h(Skeleton, { height: 12, width: "72%" }),
              h(Skeleton, { height: 9, width: "52%" }),
              h(Skeleton, { height: 9, width: "40%" }),
            ),
          ),
        )
      }
      return h("div", { className: "scp-gallery-grid" }, cards)
    }

    function GalleryCard(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const figure = p.figure || {}
      const kindName = pickCamelLocalized(figure, lang, "kindName") || (figure.kind ? String(figure.kind) : "")
      const domainName = pickCamelLocalized(figure, lang, "domainName") || (figure.domain ? String(figure.domain) : "")
      const quality = normalizeQuality(figure.quality)
      const title = figureTitle(figure, lang)
      return h(
        "div",
        Object.assign(clickableProps(() => p.onOpen && p.onOpen(figure), title + " · " + kindName), { className: "scp-card" }),
        h(
          "div",
          { className: "scp-card-thumb scp-checker" },
          h(FigureImage, {
            className: "scp-card-img",
            src: figureThumbUrl(figure),
            alt: title,
            retryable: false,
            failedLabel: t("figureNoImage"),
            retryLabel: t("imageRetry"),
          }),
        ),
        h(
          "div",
          { className: "scp-card-body" },
          h("span", { className: "scp-card-title", title: title }, title || "—"),
          h("span", { className: "scp-card-line" }, h("span", null, kindName), kindName && domainName ? h("span", { style: { color: "var(--scp-border3)" } }, "·") : null, h("span", null, domainName)),
          h(
            "div",
            { className: "scp-card-foot" },
            h("span", { className: "scp-card-meta", title: fmtFigureSize(figure) }, fmtFigureSize(figure)),
            h(QualityBadge, { quality: quality, t: t }),
          ),
          h("span", { className: "scp-card-line", style: { fontSize: 10.5, color: "var(--scp-caption)" } }, h("span", null, figureDate(figure, t))),
        ),
      )
    }

    function sampleQualityProps(item) {
      const quality = item && item.quality
      if (typeof quality === "string" && quality) return { grade: quality.toUpperCase() }
      if (typeof quality === "number") return { score: quality }
      if (isObject(quality)) return { quality: quality }
      return null
    }

    function SampleCard(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const item = p.item || {}
      const title = galleryTitle(item, lang) || item.name
      const kindName = item.kind ? kindNameById(p.caps, item.kind, lang) : ""
      const domainName = item.domain ? styleNameFromCaps(p.caps, "domain", item.domain, lang) : ""
      const journalName = item.journal ? styleNameFromCaps(p.caps, "journal", item.journal, lang) : ""
      const quality = sampleQualityProps(item)
      return h(
        "div",
        Object.assign(clickableProps(() => p.onOpen && p.onOpen(item), title), { className: "scp-card" }),
        h(
          "div",
          { className: "scp-card-thumb scp-checker" },
          h(FigureImage, { className: "scp-card-img", src: item.src, alt: title, retryable: false, failedLabel: t("figureNoImage"), retryLabel: t("imageRetry") }),
        ),
        h(
          "div",
          { className: "scp-card-body" },
          h("span", { className: "scp-card-title", title: title }, title),
          h(
            "span",
            { className: "scp-card-line" },
            h("span", null, kindName || "—"),
            kindName && domainName ? h("span", { style: { color: "var(--scp-border3)" } }, "·") : null,
            h("span", null, domainName || ""),
          ),
          h(
            "div",
            { className: "scp-card-foot" },
            h("span", { className: "scp-card-meta", title: journalName }, journalName || ""),
            quality ? h(QualityBadge, Object.assign({ t: t }, quality)) : null,
          ),
        ),
      )
    }

    function SampleGalleryDetail(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const caps = p.caps
      const item = p.item || {}
      const title = galleryTitle(item, lang) || item.name
      const note = galleryNote(item, lang)
      const quality = sampleQualityProps(item)
      const rows = [
        { label: t("kindLabel"), value: item.kind ? kindNameById(caps, item.kind, lang) : "—" },
        { label: t("domainLabel"), value: item.domain ? styleNameFromCaps(caps, "domain", item.domain, lang) : "—" },
        { label: t("journalLabel"), value: item.journal ? styleNameFromCaps(caps, "journal", item.journal, lang) : "—" },
      ]
      if (item.palette) rows.push({ label: t("paletteLabel"), value: styleNameFromCaps(caps, "palette", item.palette, lang) })
      if (item.cmap) rows.push({ label: t("cmapLabel"), value: styleNameFromCaps(caps, "cmap", item.cmap, lang) })
      if (item.font) rows.push({ label: t("fontLabel"), value: styleNameFromCaps(caps, "font", item.font, lang) })
      if (item.size) rows.push({ label: t("sizePresetLabel"), value: styleNameFromCaps(caps, "size", item.size, lang) })
      if (item.dpi) rows.push({ label: t("dpiLabel"), value: fmtInt(item.dpi) })
      return h(
        "div",
        { className: "scp-view" },
        h(
          "div",
          { className: "scp-backbar" },
          h(Button, { size: "sm", variant: "ghost", glyph: "back", label: t("sampleBack"), onClick: p.onBack }),
          h("span", { className: "scp-grow" }),
          item.src
            ? h(
                "a",
                { className: "scp-btn", "data-size": "sm", "data-variant": "ghost", href: item.src, target: "_blank", rel: "noreferrer noopener", style: { textDecoration: "none" } },
                h(Icon, { name: "external", size: 12 }),
                h("span", null, t("sampleOpenOriginal")),
              )
            : null,
        ),
        h(
          "div",
          { className: "scp-detail-grid" },
          h(
            "div",
            { className: "scp-detail-main" },
            h(
              "div",
              { className: "scp-figure-panel" },
              h(
                "div",
                { className: "scp-figure-toolbar" },
                h(Icon, { name: "image", size: 13 }),
                h("span", { className: "scp-figure-title", title: title }, title),
                h("span", { className: "scp-grow" }),
                h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "expand", title: t("detailFullscreen"), onClick: () => p.onLightbox && p.onLightbox(item) }),
              ),
              h(
                "div",
                { className: "scp-figure-stage scp-checker" },
                h(
                  "div",
                  { className: "scp-figure-scroll" },
                  h(
                    "div",
                    { className: "scp-figure-shell", style: { width: "min(760px, 100%)", maxWidth: "100%" } },
                    h(FigureImage, { className: "scp-figure-img", src: item.src, alt: title, eager: true, retryable: false, failedLabel: t("figureNoImage"), retryLabel: t("imageRetry") }),
                  ),
                ),
              ),
            ),
          ),
          h(
            "aside",
            { className: "scp-detail-side" },
            h(
              "section",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("sampleStyle")), h("span", { className: "scp-grow" }), quality ? h(QualityBadge, Object.assign({ t: t }, quality)) : null),
              h("div", { className: "scp-panel-body" }, h(KV, { rows: rows })),
            ),
            note
              ? h(
                  "section",
                  { className: "scp-panel" },
                  h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("sampleNote"))),
                  h("div", { className: "scp-panel-body" }, h("p", { className: "scp-score-summary", style: { margin: 0 } }, note)),
                )
              : null,
            h(
              "section",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("newFigure"))),
              h(
                "div",
                { className: "scp-panel-body" },
                h(Button, { variant: "primary", size: "lg", glyph: "plus", label: t("sampleUseStyle"), onClick: () => p.onUseStyle && p.onUseStyle(item) }),
                h("p", { className: "scp-hint", style: { margin: "8px 0 0" } }, t("sampleUseStyleHint")),
              ),
            ),
          ),
        ),
      )
    }

    function GalleryView(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const figures = safeArray(p.figures)
      const galleryItems = safeArray(p.gallery).map(normalizeGalleryItem)
      const filters = p.filters || { kind: "", domain: "" }
      const [mode, setMode] = useState("mine")
      const [sampleItem, setSampleItem] = useState(null)
      const [lightbox, setLightbox] = useState(null)
      const facets = useMemo(() => figureFacets(figures), [figures])
      const visible = useMemo(() => filterFigures(sortFigures(figures), filters), [figures, filters])
      const filtered = Boolean(filters.kind || filters.domain)
      const setFilter = (patch) => {
        if (p.onFilters) p.onFilters(Object.assign({}, filters, patch))
      }
      const lightboxNode = lightbox
        ? h(Lightbox, {
            src: lightbox.src,
            title: galleryTitle(lightbox, lang) || lightbox.title || lightbox.name,
            alt: galleryTitle(lightbox, lang) || lightbox.title || lightbox.name,
            href: lightbox.src,
            openLabel: t("detailOpenOriginal"),
            closeLabel: t("close"),
            onClose: () => setLightbox(null),
          })
        : null
      if (sampleItem) {
        return h(
          "div",
          null,
          h(SampleGalleryDetail, {
            item: sampleItem,
            t: t,
            lang: lang,
            caps: p.caps,
            onBack: () => setSampleItem(null),
            onUseStyle: p.onUseSampleStyle,
            onLightbox: (item) => setLightbox(item),
          }),
          lightboxNode,
        )
      }
      const header = h(
        "div",
        { className: "scp-view-head" },
        h(
          "div",
          { className: "scp-view-heading" },
          h("p", { className: "scp-kicker" }, t("tagline")),
          h("h1", { className: "scp-h1" }, t("galleryTitle")),
          h("p", { className: "scp-sub" }, t("gallerySubtitle")),
        ),
        h(
          "div",
          { className: "scp-toolbar" },
          h(Button, { size: "sm", glyph: "refresh", label: t("refresh"), onClick: p.onRefresh, disabled: p.loading }),
          h(Button, { size: "sm", variant: "primary", glyph: "plus", label: t("newFigure"), onClick: p.onGoStudio }),
        ),
      )

      let body = null
      if (mode === "samples") {
        body =
          galleryItems.length === 0
            ? h(EmptyState, {
                icon: "image",
                title: t("gallerySamplesEmpty"),
                body: t("gallerySamplesEmptyBody"),
                actions: h(Button, { size: "sm", glyph: "refresh", label: t("refresh"), onClick: p.onRefresh }),
              })
            : h("div", { className: "scp-gallery-grid" }, galleryItems.map((item, index) => h(SampleCard, { key: item.name + "-" + index, item: item, t: t, lang: lang, caps: p.caps, onOpen: setSampleItem })))
      } else if (p.loading && figures.length === 0) {
        body = h(FigureSkeletonGrid, null)
      } else if (p.error && figures.length === 0) {
        body = h(ErrorState, {
          title: t("errorTitle"),
          message: p.error,
          retryLabel: t("retry"),
          onRetry: p.onRefresh,
        })
      } else if (figures.length === 0) {
        body = h(EmptyState, {
          icon: "gallery",
          title: t("emptyGalleryTitle"),
          body: t("emptyGalleryBody"),
          actions: [
            h(Button, { key: "studio", variant: "primary", size: "sm", glyph: "sliders", label: t("emptyGalleryAction"), onClick: p.onGoStudio }),
            p.onRenderSample ? h(Button, { key: "sample", size: "sm", glyph: "play", label: t("emptyGallerySample"), onClick: p.onRenderSample }) : null,
            galleryItems.length > 0 ? h(Button, { key: "samples", size: "sm", glyph: "image", label: t("gallerySamples"), onClick: () => setMode("samples") }) : null,
          ],
        })
      } else {
        body = h(
          "div",
          null,
          visible.length === 0
            ? h(EmptyState, {
                icon: "search",
                title: t("kindEmpty"),
                body: t("filterClear"),
                actions: h(Button, { size: "sm", glyph: "x", label: t("filterClear"), onClick: () => p.onFilters && p.onFilters({ kind: "", domain: "" }) }),
              })
            : h("div", { className: "scp-gallery-grid" }, visible.map((figure) => h(GalleryCard, { key: figure.id || figure.pngUrl, figure: figure, t: t, lang: lang, onOpen: p.onOpenFigure }))),
        )
      }

      const modeSwitch = h(
        "div",
        { className: "scp-seg", role: "group", "aria-label": t("galleryTitle") },
        h(
          "button",
          { type: "button", className: "scp-seg-btn", "aria-pressed": mode === "mine" ? "true" : "false", onClick: () => { setSampleItem(null); setMode("mine") } },
          t("galleryMine") + " (" + figures.length + ")",
        ),
        h(
          "button",
          { type: "button", className: "scp-seg-btn", "aria-pressed": mode === "samples" ? "true" : "false", onClick: () => setMode("samples") },
          t("gallerySamples") + " (" + galleryItems.length + ")",
        ),
      )

      let filtersContent = null
      if (mode === "samples") {
        filtersContent = [
          h("span", { className: "scp-hint", key: "hint" }, t("gallerySamplesHint")),
          h("span", { className: "scp-count", key: "count" }, t("gallerySamplesCount", { n: galleryItems.length })),
        ]
      } else if (figures.length > 0) {
        filtersContent = [
          h(
            "span",
            { className: "scp-filter", key: "kind" },
            h("span", { className: "scp-filter-label" }, t("filterKind")),
            h(Select, {
              value: filters.kind,
              "aria-label": t("filterKind"),
              options: [{ value: "", label: t("filterAll") }].concat(facets.kinds.map((facet) => ({ value: facet.id, label: facetLabel(facet, lang) + " (" + facet.count + ")" }))),
              onChange: (value) => setFilter({ kind: value }),
            }),
          ),
          h(
            "span",
            { className: "scp-filter", key: "domain" },
            h("span", { className: "scp-filter-label" }, t("filterDomain")),
            h(Select, {
              value: filters.domain,
              "aria-label": t("filterDomain"),
              options: [{ value: "", label: t("filterAll") }].concat(facets.domains.map((facet) => ({ value: facet.id, label: facetLabel(facet, lang) + " (" + facet.count + ")" }))),
              onChange: (value) => setFilter({ domain: value }),
            }),
          ),
          filtered ? h(Button, { key: "clear", size: "sm", variant: "ghost", glyph: "x", label: t("filterClear"), onClick: () => p.onFilters && p.onFilters({ kind: "", domain: "" }) }) : null,
          h("span", { className: "scp-count", key: "count" }, t("filterCount", { shown: visible.length, total: figures.length })),
        ]
      }
      const filtersRow = h("div", { className: "scp-filters" }, modeSwitch, filtersContent)

      return h(
        "div",
        { className: "scp-view" },
        header,
        filtersRow,
        p.error && figures.length > 0 ? h("div", { style: { marginBottom: 12 } }, h(Notice, { tone: "warn" }, t("errorApi", { message: p.error }))) : null,
        body,
        lightboxNode,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Figure detail                                                      */
    /* ------------------------------------------------------------------ */

    function QualityPanel(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const quality = normalizeQuality(p.quality)
      const checks = qualityCheckRows(p.quality, lang)
      const tone = qualityTone(quality.grade) || ""
      const statusKey = (status) => (status === "pass" ? "qualityPass" : status === "warn" ? "qualityWarn" : status === "fail" ? "qualityFail" : "qualityInfo")
      const statusLabel = (status) => t(statusKey(status))
      return h(
        "section",
        { className: "scp-panel" },
        h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("qualityTitle")), h("span", { className: "scp-grow" }), h(QualityBadge, { quality: quality, t: t })),
        h(
          "div",
          { className: "scp-panel-body" },
          h(
            "div",
            { className: "scp-scoreline" },
            h("span", { className: "scp-score-num", "data-tone": tone }, quality.score === null ? "—" : quality.score),
            h(
              "span",
              { style: { display: "flex", flexDirection: "column", gap: 3 } },
              h("span", { style: { fontSize: 11, color: "var(--scp-ink3)" } }, t("qualityScore")),
              quality.grade ? h(Chip, { label: quality.grade, tone: tone === "ok" ? "ok" : tone === "info" ? "info" : tone === "warn" ? "warn" : "danger" }) : null,
            ),
            h("span", { className: "scp-grow" }),
            h(
              "span",
              { className: "scp-row", style: { gap: 5 } },
              h(Chip, { label: t("qualityPass") + " " + quality.counts.pass, tone: quality.counts.pass > 0 ? "ok" : undefined }),
              h(Chip, { label: t("qualityWarn") + " " + quality.counts.warn, tone: quality.counts.warn > 0 ? "warn" : undefined }),
              h(Chip, { label: t("qualityFail") + " " + quality.counts.fail, tone: quality.counts.fail > 0 ? "danger" : undefined }),
            ),
          ),
          qualitySummary(p.quality, lang) ? h("p", { className: "scp-score-summary" }, qualitySummary(p.quality, lang)) : null,
          checks.length === 0
            ? h("p", { className: "scp-hint", style: { marginTop: 8 } }, t("noChecks"))
            : h(
                "div",
                { className: "scp-check-list" },
                checks.map((check) =>
                  h(
                    "div",
                    { className: "scp-check-row", key: check.id, "data-status": check.status },
                    h("span", { className: "scp-check-dot" }),
                    h(
                      "span",
                      { className: "scp-check-text" },
                      h("span", { className: "scp-sr-only" }, statusLabel(check.status) + ": "),
                      check.message || check.id,
                    ),
                  ),
                ),
              ),
        ),
      )
    }

    function FigureDetailView(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const figure = p.figure || null
      const [zoom, setZoom] = useState(1)
      const [lightbox, setLightbox] = useState(false)
      const [exporting, setExporting] = useState("")
      const [confirmDelete, setConfirmDelete] = useState(false)
      const [deleting, setDeleting] = useState(false)
      const [revealing, setRevealing] = useState(false)
      const [exportDpi, setExportDpi] = useState("")
      const [exportWidth, setExportWidth] = useState("")
      const [downloaded, setDownloaded] = useState({})

      useEffect(() => {
        setZoom(1)
        setLightbox(false)
        setConfirmDelete(false)
        setExporting("")
        setDownloaded({})
        if (figure) {
          setExportDpi(String(toNumber(figure.dpi, DEFAULT_DPI)))
          setExportWidth(String(toNumber(figure.widthMm, "")))
        }
      }, [figure && figure.id])

      useEffect(() => {
        if (!confirmDelete) return undefined
        const timer = setTimeout(() => setConfirmDelete(false), 4500)
        return () => clearTimeout(timer)
      }, [confirmDelete])

      if (!figure) {
        if (p.error) {
          return h(
            "div",
            { className: "scp-view" },
            h(
              "div",
              { className: "scp-backbar" },
              h(Button, { size: "sm", variant: "ghost", glyph: "back", label: t("detailBack"), onClick: p.onBack }),
            ),
            h(ErrorState, { title: t("errorTitle"), message: p.error, retryLabel: t("retry"), onRetry: p.onRefresh }),
          )
        }
        return h(
          "div",
          { className: "scp-view" },
          h(
            "div",
            { className: "scp-backbar" },
            h(Button, { size: "sm", variant: "ghost", glyph: "back", label: t("detailBack"), onClick: p.onBack }),
          ),
          h(
            "div",
            { className: "scp-detail-grid" },
            h(
              "div",
              { className: "scp-figure-panel" },
              h("div", { className: "scp-figure-toolbar" }, h(Skeleton, { height: 14, width: "40%" })),
              h("div", { className: "scp-figure-stage" }, h(Loading, { label: t("figureLoading") })),
            ),
            h(
              "div",
              { className: "scp-detail-side" },
              h("div", { className: "scp-panel" }, h("div", { className: "scp-panel-body" }, h(Skeleton, { height: 60 }))),
              h("div", { className: "scp-panel" }, h("div", { className: "scp-panel-body" }, h(Skeleton, { height: 120 }))),
            ),
          ),
        )
      }

      const title = figureTitle(figure, lang)
      const kindName = pickCamelLocalized(figure, lang, "kindName") || (figure.kind ? String(figure.kind) : "")
      const domainName = pickCamelLocalized(figure, lang, "domainName") || styleNameFromCaps(p.caps, "domain", figure.domain, lang)
      const quality = normalizeQuality(figure.quality)
      const formats = formatsForFigure(figure, p.caps)
      const files = figureFileEntries(figure)
      const primaryPath = figurePrimaryPath(figure)
      const imageSrc = figureFileUrl(figure, "png", "full")
      const widthMm = toNumber(figure.widthMm, 89) || 89
      const baseWidth = Math.max(200, Math.round(widthMm * 3.7795))
      const shellWidth = Math.round(baseWidth * zoom)
      const warnings = safeArray(figure.warnings)
      const style = isObject(figure.spec) && isObject(figure.spec.style) ? figure.spec.style : {}
      const journalLabel = pickCamelLocalized(figure, lang, "journalName") || styleNameFromCaps(p.caps, "journal", figure.journal || style.journal, lang)
      const paletteLabel = pickCamelLocalized(figure, lang, "paletteName") || styleNameFromCaps(p.caps, "palette", figure.palette || style.palette, lang)
      const cmapLabel = pickCamelLocalized(figure, lang, "cmapName") || styleNameFromCaps(p.caps, "cmap", style.cmap, lang)
      const fontLabel = pickCamelLocalized(figure, lang, "fontName") || styleNameFromCaps(p.caps, "font", style.font, lang)
      const sizeLabel = pickCamelLocalized(figure, lang, "sizeName") || styleNameFromCaps(p.caps, "size", style.size, lang)
      const duration = toNumber(figure.durationMs, null)

      const copyText = async (text) => {
        try {
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("no clipboard")
          await navigator.clipboard.writeText(String(text))
          p.notify(t("copied"))
        } catch (error) {
          p.notify(t("toastCopyFailed"), "err")
        }
      }

      const doExport = async (format) => {
        if (exporting) return
        setExporting(format)
        try {
          const body = buildExportBody([format], {
            dpi: toNumber(exportDpi, figure.dpi),
            widthMm: toNumber(exportWidth, figure.widthMm),
            journal: figure.journal || undefined,
          })
          const result = await apiPost("/api/figures/" + encodeURIComponent(figure.id) + "/export", body, { timeoutMs: EXPORT_TIMEOUT_MS })
          const next = result && result.figure ? result.figure : figure
          if (p.onUpdate) p.onUpdate(next)
          setDownloaded((current) => Object.assign({}, current, { [format]: true }))
          p.notify(t("exportedFormat", { format: formatLabel(format) }))
        } catch (error) {
          p.notify(t("exportFailed", { message: messageOf(error) }), "err")
        } finally {
          setExporting("")
        }
      }

      const doDelete = async () => {
        if (deleting) return
        if (!confirmDelete) {
          setConfirmDelete(true)
          return
        }
        setDeleting(true)
        try {
          await apiPost("/api/figures/" + encodeURIComponent(figure.id) + "/delete", {})
          p.notify(t("toastDeleted"))
          if (p.onDeleted) p.onDeleted(figure.id)
        } catch (error) {
          p.notify(t("toastDeleteFailed", { message: messageOf(error) }), "err")
        } finally {
          setDeleting(false)
        }
      }

      const doReveal = async () => {
        if (revealing) return
        setRevealing(true)
        try {
          await apiPost("/api/figures/" + encodeURIComponent(figure.id) + "/reveal", {})
          p.notify(t("revealDone"))
        } catch (error) {
          p.notify(t("toastRevealFailed", { message: messageOf(error) }), "err")
        } finally {
          setRevealing(false)
        }
      }

      const overviewRows = [
        { label: t("kindLabel"), value: kindName },
        { label: t("domainLabel"), value: domainName },
        { label: t("journalLabel"), value: journalLabel },
        { label: t("paletteLabel"), value: paletteLabel },
        cmapLabel ? { label: t("cmapLabel"), value: cmapLabel } : null,
        fontLabel ? { label: t("fontLabel"), value: fontLabel } : null,
        sizeLabel ? { label: t("sizePresetLabel"), value: sizeLabel } : null,
        { label: t("sizeMmLabel"), value: fmtFigureSize(figure), mono: true },
        { label: t("formatsLabel"), value: formats.map(formatLabel).join(" · ") || "—" },
        duration !== null ? { label: t("durationLabel"), value: fmtDurationMs(duration), mono: true } : null,
        { label: t("createdAt"), value: fmtClock(figure.createdAt) || "—", mono: true },
      ].filter(Boolean)

      return h(
        "div",
        { className: "scp-view" },
        h(
          "div",
          { className: "scp-backbar" },
          h(Button, { size: "sm", variant: "ghost", glyph: "back", label: t("detailBack"), onClick: p.onBack }),
          h("span", { className: "scp-grow" }),
          h(Button, { size: "sm", label: t("handoffChat"), onClick: () => p.onHandoff && p.onHandoff(figure) }),
          h(Button, { size: "sm", glyph: "sliders", label: t("openStudio"), onClick: () => p.onOpenStudio && p.onOpenStudio(figure) }),
        ),
        h(
          "div",
          { className: "scp-detail-grid" },
          h(
            "div",
            { className: "scp-detail-main" },
            h(
              "div",
              { className: "scp-figure-panel" },
              h(
                "div",
                { className: "scp-figure-toolbar" },
                h(Icon, { name: "image", size: 13 }),
                h("span", { className: "scp-figure-title", title: title }, title),
                h(
                  "span",
                  { className: "scp-row", style: { gap: 2 } },
                  h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "zoomOut", title: t("zoomOut"), onClick: () => setZoom((value) => Math.max(0.4, Math.round((value - 0.2) * 10) / 10)) }),
                  h("span", { className: "scp-card-meta", style: { minWidth: 38, textAlign: "center" } }, t("zoomLabel", { n: Math.round(zoom * 100) })),
                  h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "zoomIn", title: t("zoomIn"), onClick: () => setZoom((value) => Math.min(3, Math.round((value + 0.2) * 10) / 10)) }),
                  h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "fit", title: t("zoomFit"), onClick: () => setZoom(1) }),
                  h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "expand", title: t("detailFullscreen"), onClick: () => setLightbox(true) }),
                  h(
                    "a",
                    { className: "scp-btn", "data-size": "sm", "data-variant": "ghost", href: imageSrc, target: "_blank", rel: "noreferrer noopener", title: t("detailOpenOriginal"), style: { textDecoration: "none" } },
                    h(Icon, { name: "external", size: 12 }),
                  ),
                ),
              ),
              h(
                "div",
                { className: "scp-figure-stage scp-checker" },
                h(
                  "div",
                  { className: "scp-figure-scroll" },
                  h(
                    "div",
                    { className: "scp-figure-shell", style: { width: shellWidth + "px", maxWidth: zoom <= 1 ? "100%" : "none" } },
                    h(FigureImage, { className: "scp-figure-img", src: imageSrc, alt: title, eager: true, failedLabel: t("figureNoImage"), retryLabel: t("imageRetry") }),
                  ),
                ),
              ),
            ),
            h(
              "div",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("overviewTitle")), h("span", { className: "scp-grow" }), h("span", { className: "scp-card-meta" }, fmtFigureSize(figure))),
              h("div", { className: "scp-panel-body" }, h(KV, { rows: overviewRows })),
            ),
            warnings.length > 0
              ? h(
                  "div",
                  { className: "scp-panel" },
                  h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("warningsTitle"))),
                  h("div", { className: "scp-panel-body" }, h("ul", { className: "scp-warning-list" }, warnings.map((warning, index) => h("li", { key: "warn-" + index }, String(warning))))),
                )
              : null,
          ),
          h(
            "aside",
            { className: "scp-detail-side" },
            h(QualityPanel, { quality: figure.quality, t: t, lang: lang }),
            h(
              "section",
              { className: "scp-panel" },
              h(
                "div",
                { className: "scp-panel-head" },
                h("h3", { className: "scp-panel-title" }, t("exportTitle")),
                h("span", { className: "scp-grow" }),
                h("span", { className: "scp-card-meta" }, fmtFigureSize(figure)),
              ),
              h(
                "div",
                { className: "scp-panel-body" },
                h(
                  "div",
                  { className: "scp-export-grid" },
                  formats.map((format) =>
                    h(
                      "button",
                      {
                        key: format,
                        type: "button",
                        className: "scp-btn scp-export-btn",
                        disabled: Boolean(exporting) || deleting,
                        onClick: () => void doExport(format),
                        title: t("exportingFormat", { format: formatLabel(format) }),
                      },
                      exporting === format ? h(Spinner, { size: "sm" }) : h(Icon, { name: "download", size: 13 }),
                      h("span", null, formatLabel(format)),
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "scp-export-meta" },
                  h(Field, { label: t("exportDpi") }, h(TextInput, { value: exportDpi, onChange: setExportDpi, style: { width: "100%" }, mono: true })),
                  h(Field, { label: t("exportWidth") }, h(TextInput, { value: exportWidth, onChange: setExportWidth, style: { width: "100%" }, mono: true })),
                ),
                h("p", { className: "scp-hint", style: { marginTop: 8 } }, t("exportHint")),
                h(
                  "div",
                  { className: "scp-file-list" },
                  formats.map((format) =>
                    h(
                      "div",
                      { className: "scp-file-row", key: "dl-" + format },
                      h("span", { className: "scp-file-format" }, formatLabel(format)),
                      h("span", { className: "scp-file-path", title: t("exportedFormat", { format: formatLabel(format) }) }, downloaded[format] ? t("exportedFormat", { format: formatLabel(format) }) : t("download")),
                      h(
                        "a",
                        {
                          className: "scp-btn",
                          "data-size": "sm",
                          "data-variant": "ghost",
                          href: figureFileUrl(figure, format, "full"),
                          download: "figure." + format,
                          title: t("download"),
                          style: { textDecoration: "none" },
                        },
                        h(Icon, { name: "download", size: 12 }),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            h(
              "section",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("filesTitle"))),
              h(
                "div",
                { className: "scp-panel-body" },
                files.length === 0
                  ? h("p", { className: "scp-hint" }, t("noData"))
                  : h(
                      "div",
                      { className: "scp-file-list" },
                      files.map((file, index) =>
                        h(
                          "div",
                          { className: "scp-file-row", key: "file-" + index },
                          h("span", { className: "scp-file-format" }, file.format || "file"),
                          h("span", { className: "scp-file-path", title: file.path }, file.path),
                          h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "copy", title: t("copyPath"), onClick: () => void copyText(file.path) }),
                        ),
                      ),
                    ),
                h(
                  "div",
                  { className: "scp-row", style: { marginTop: 10 } },
                  h(Button, { size: "sm", glyph: "folder", label: revealing ? t("loading") : t("reveal"), onClick: () => void doReveal(), disabled: revealing }),
                  h(Button, { size: "sm", glyph: "copy", label: t("copyPath"), onClick: () => void copyText(primaryPath || imageSrc), disabled: !primaryPath && !imageSrc }),
                ),
              ),
            ),
            h(
              "section",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("deleteFigure"))),
              h(
                "div",
                { className: "scp-panel-body" },
                h("p", { className: "scp-hint", style: { margin: 0 } }, t("deleteConfirmBody")),
                h(
                  "div",
                  { className: "scp-confirm-row", style: { marginTop: 9 } },
                  h(Button, {
                    size: "sm",
                    variant: "danger",
                    glyph: "trash",
                    label: deleting ? t("deleting") : confirmDelete ? t("deleteConfirm") : t("deleteFigure"),
                    onClick: () => void doDelete(),
                    disabled: deleting,
                  }),
                  confirmDelete ? h(Button, { size: "sm", variant: "ghost", label: t("cancel"), onClick: () => setConfirmDelete(false), disabled: deleting }) : null,
                  confirmDelete ? h("span", { className: "scp-delete-hint" }, t("deleteConfirmBody")) : null,
                ),
              ),
            ),
          ),
        ),
        lightbox
          ? h(Lightbox, {
              src: imageSrc,
              title: title,
              alt: title,
              href: imageSrc,
              openLabel: t("detailOpenOriginal"),
              closeLabel: t("close"),
              onClose: () => setLightbox(false),
            })
          : null,
      )
    }

/**
 * dsh-sci-plot — 03-studio
 *
 * Two-column studio: data source, mapping, searchable kind list with dynamic
 * per-kind option controls, style/label/output controls on the left; render
 * status, live preview, quality strip and validation on the right.
 */

    function normalizeValidationIssues(issues, lang) {
      const list = safeArray(issues)
      const out = []
      for (let i = 0; i < list.length; i += 1) {
        const issue = list[i]
        if (typeof issue === "string") {
          out.push({ id: "issue-" + i, level: "warn", message: issue })
          continue
        }
        if (!isObject(issue)) continue
        const message = pickLocalized(issue, lang, "message") || String(issue.message || issue.text || issue.code || "")
        if (!message) continue
        out.push({
          id: String(issue.id || issue.code || "issue-" + i),
          level: String(issue.level || issue.severity || issue.status || "warn").toLowerCase(),
          message: message,
        })
      }
      return out
    }

    function widthForChoice(journal, sizeId, sizes) {
      const widths = isObject(journal) && isObject(journal.widths) ? journal.widths : {}
      const direct = toNumber(widths[sizeId], null)
      if (direct !== null) return direct
      return styleWidthForSize(sizes, sizeId)
    }

    function journalWidthText(journal, t) {
      const widths = isObject(journal) && isObject(journal.widths) ? journal.widths : {}
      const keys = Object.keys(widths)
      const translate = typeof t === "function" ? t : null
      const parts = []
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const value = toNumber(widths[key], null)
        if (value === null) continue
        let label = key
        if (translate) {
          if (key === "single") label = translate("journalSingle")
          else if (key === "double") label = translate("journalDouble")
        }
        parts.push(label + " " + fmtMm(value) + " mm")
      }
      return parts.join(" · ")
    }

    function StudioPreview(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const [elapsed, setElapsed] = useState(0)
      useEffect(() => {
        if (p.status !== "rendering") {
          setElapsed(0)
          return undefined
        }
        const started = Date.now()
        setElapsed(0)
        const timer = setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - started) / 1000))), 500)
        return () => clearInterval(timer)
      }, [p.status])

      if (p.status === "rendering") {
        return h(
          "div",
          { className: "scp-preview-body scp-checker" },
          h("div", { className: "scp-rendering", role: "status" }, h(Spinner, null), h("span", null, t("rendering")), h("span", { className: "scp-mono", style: { color: "var(--scp-caption)" } }, t("renderElapsed", { s: elapsed }))),
        )
      }
      if (p.status === "error" && p.error) {
        return h(
          "div",
          { className: "scp-preview-body" },
          h(ErrorState, { title: t("errorTitle"), message: p.error, retryLabel: t("retry"), onRetry: p.onRender }),
        )
      }
      if (!p.result) {
        return h(
          "div",
          { className: "scp-preview-body" },
          h(
            "div",
            { className: "scp-preview-empty" },
            h(Icon, { name: "sliders", size: 22 }),
            h("p", { className: "scp-preview-empty-title" }, t("previewEmptyTitle")),
            h("p", { className: "scp-preview-empty-body" }, t("previewEmptyBody")),
          ),
        )
      }
      const figure = p.result
      const title = figureTitle(figure, lang)
      const quality = normalizeQuality(figure.quality)
      return h(
        "div",
        null,
        h(
          "div",
          { className: "scp-preview-body scp-checker" },
          h(
            "div",
            { className: "scp-preview-stage" },
            h("div", { className: "scp-preview-shell" }, h(FigureImage, { className: "scp-preview-img", src: figureFileUrl(figure, "png", "full"), alt: title, eager: true, failedLabel: t("figureNoImage"), retryLabel: t("imageRetry") })),
          ),
        ),
        h(
          "div",
          { className: "scp-preview-quality" },
          h(QualityBadge, { quality: quality, t: t }),
          quality.score !== null ? h("span", { className: "scp-card-meta" }, t("qualityInline", { score: quality.score, grade: quality.grade || "—" })) : null,
          h(Chip, { label: t("figureSaved"), tone: "ok" }),
          h(
            "span",
            { className: "scp-preview-actions" },
            h(Button, { size: "sm", glyph: "gallery", label: t("openInGallery"), onClick: () => p.onOpenResult && p.onOpenResult(figure) }),
            h(Button, { size: "sm", variant: "primary", glyph: "external", label: t("detailOpenOriginal"), onClick: () => window.open(figureFileUrl(figure, "png", "full"), "_blank", "noopener") }),
          ),
        ),
      )
    }

    function StudioView(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const caps = p.caps || null
      const datasets = p.datasets || { samples: [], workspace: [] }
      const form = p.form || emptyStudioFormFallback()
      const samples = safeArray(datasets.samples)
      const workspaceFiles = safeArray(datasets.workspace)
      const allKinds = useMemo(() => flattenKinds(caps), [caps])
      const categories = useMemo(() => kindCategories(caps), [caps])
      const [kindQuery, setKindQuery] = useState("")
      const [kindGroup, setKindGroup] = useState("")
      const [workspacePreview, setWorkspacePreview] = useState({ path: "", loading: false, columns: [], rows: [], total: null, error: "" })
      const [validation, setValidation] = useState({ status: "idle", issues: [] })
      const update = (patch) => {
        if (p.onForm) p.onForm((prev) => Object.assign({}, prev, typeof patch === "function" ? patch(prev) : patch))
      }
      const updateStyle = (patch) => {
        if (p.onForm) p.onForm((prev) => Object.assign({}, prev, { style: Object.assign({}, prev.style || {}, patch) }))
      }
      const updateLabels = (patch) => {
        if (p.onForm) p.onForm((prev) => Object.assign({}, prev, { labels: Object.assign({}, prev.labels || {}, patch) }))
      }
      const updateMapping = (patch) => {
        if (p.onForm) p.onForm((prev) => Object.assign({}, prev, { mapping: Object.assign({}, prev.mapping || {}, patch) }))
      }

      const selectedKind = useMemo(() => {
        for (let i = 0; i < allKinds.length; i += 1) {
          if (allKinds[i].kind === form.kind || allKinds[i].id === form.kind) return allKinds[i]
        }
        return null
      }, [allKinds, form.kind])
      const filteredKinds = useMemo(() => filterKindList(allKinds, kindQuery, kindGroup), [allKinds, kindQuery, kindGroup])
      const selectedSample = useMemo(() => {
        for (let i = 0; i < samples.length; i += 1) if (samples[i].id === form.sampleId) return samples[i]
        return null
      }, [samples, form.sampleId])
      const sampleGroups = useMemo(() => groupSamplesByDomain(samples, caps, lang), [samples, caps, lang])
      const selectedWorkspace = useMemo(() => {
        for (let i = 0; i < workspaceFiles.length; i += 1) if (workspaceFiles[i].path === form.workspacePath) return workspaceFiles[i]
        return null
      }, [workspaceFiles, form.workspacePath])
      const sampleColumns = selectedSample ? safeArray(selectedSample.columns) : []
      const mappingColumns = form.dataMode === "workspace" ? safeArray(workspacePreview.columns) : sampleColumns
      const mappingKeys = useMemo(() => {
        const spec = isObject(caps) && isObject(caps.spec) ? caps.spec : {}
        const declared = safeArray(spec.mapping_keys).filter((key) => MAPPING_KEYS.indexOf(key) !== -1)
        const keys = declared.length > 0 ? declared : ["x", "y", "group"]
        if (keys.indexOf("x") === -1) keys.unshift("x")
        if (keys.indexOf("y") === -1) keys.push("y")
        return keys
      }, [caps])
      const paste = useMemo(() => (form.dataMode === "paste" ? parsePastedData(form.pasted) : null), [form.dataMode, form.pasted])
      const specResult = useMemo(() => buildRenderSpec(form), [form])
      const specSignature = specResult.spec ? JSON.stringify(specResult.spec) : ""

      useEffect(() => {
        if (form.dataMode !== "workspace" || !form.workspacePath) {
          setWorkspacePreview({ path: "", loading: false, columns: [], rows: [], total: null, error: "" })
          return undefined
        }
        let cancelled = false
        const path = form.workspacePath
        setWorkspacePreview({ path: path, loading: true, columns: [], rows: [], total: null, error: "" })
        apiPost("/api/datasets/preview", { path: path })
          .then((data) => {
            if (cancelled) return
            const columns = safeArray(data && data.columns)
            setWorkspacePreview({ path: path, loading: false, columns: columns, rows: safeArray(data && data.rows), total: toNumber(data && data.total, null), error: "" })
            if (p.onForm) {
              p.onForm((prev) => {
                if (prev.dataMode !== "workspace" || prev.workspacePath !== path) return prev
                const current = cleanMapping(prev.mapping)
                return Object.assign({}, prev, { mapping: Object.assign(mappingDefaultsFromColumns(columns), current) })
              })
            }
          })
          .catch((error) => {
            if (cancelled) return
            setWorkspacePreview({ path: path, loading: false, columns: [], rows: [], total: null, error: messageOf(error) })
          })
        return () => {
          cancelled = true
        }
      }, [form.dataMode, form.workspacePath])

      useEffect(() => {
        if (!specSignature) {
          setValidation({ status: "idle", issues: [] })
          return undefined
        }
        let cancelled = false
        const timer = setTimeout(() => {
          apiPost("/api/validate", { spec: JSON.parse(specSignature) })
            .then((data) => {
              if (cancelled) return
              setValidation({ status: "ok", issues: normalizeValidationIssues(data && data.issues, lang) })
            })
            .catch(() => {
              if (cancelled) return
              setValidation({ status: "unavailable", issues: [] })
            })
        }, 650)
        return () => {
          cancelled = true
          clearTimeout(timer)
        }
      }, [specSignature, lang])

      const chooseKind = (kind) => {
        if (!kind) return
        const demo = isObject(kind.demo) ? kind.demo : {}
        const demoLabels = isObject(demo.labels) ? demo.labels : {}
        if (p.onForm) {
          p.onForm((prev) => {
            const nextLabels = Object.assign({}, prev.labels || {})
            if (!nextLabels.x && demoLabels.x) nextLabels.x = String(demoLabels.x)
            if (!nextLabels.y && demoLabels.y) nextLabels.y = String(demoLabels.y)
            if (!nextLabels.colorbar && demoLabels.colorbar) nextLabels.colorbar = String(demoLabels.colorbar)
            return Object.assign({}, prev, {
              kind: String(kind.kind || kind.id || ""),
              options: mergeOptionValues(kind.options, prev.options),
              labels: nextLabels,
            })
          })
        }
      }

      const chooseSample = (id) => {
        const sample = samples.filter((item) => item.id === id)[0] || null
        const recommended = sample ? safeArray(sample.recommended)[0] : null
        const kind = recommended ? findKind(caps, recommended.kind) : null
        if (p.onForm) {
          p.onForm((prev) => {
            const demo = kind && isObject(kind.demo) ? kind.demo : {}
            const demoLabels = isObject(demo.labels) ? demo.labels : {}
            const nextLabels = {
              x: demoLabels.x ? String(demoLabels.x) : "",
              y: demoLabels.y ? String(demoLabels.y) : "",
              title: prev.labels && prev.labels.title ? String(prev.labels.title) : "",
              colorbar: demoLabels.colorbar ? String(demoLabels.colorbar) : "",
            }
            const patch = {
              sampleId: id,
              mapping: sample && isObject(sample.mapping) ? Object.assign({}, sample.mapping) : {},
              labels: nextLabels,
            }
            if (kind) {
              patch.kind = String(kind.kind || kind.id)
              patch.options = mergeOptionValues(kind.options, prev.options)
            }
            return Object.assign({}, prev, patch)
          })
        }
      }

      const chooseRecommended = (recommended) => {
        if (!recommended || !recommended.kind) return
        const kind = findKind(caps, recommended.kind)
        if (!kind) return
        chooseKind(kind)
        if (isObject(recommended.style)) {
          updateStyle(Object.assign({}, recommended.style))
        }
      }

      const chooseDomain = (domainId) => {
        const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
        const domains = safeArray(themes.domains)
        const domain = domains.filter((item) => item && item.id === domainId)[0] || null
        if (!domain) {
          updateStyle({ domain: domainId })
          return
        }
        const patch = { domain: domainId }
        if (domain.palette) patch.palette = domain.palette
        if (domain.cmap) patch.cmap = domain.cmap
        if (domain.font) patch.font = domain.font
        updateStyle(patch)
      }

      const chooseJournal = (journalId) => {
        const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
        const journals = safeArray(themes.journals)
        const sizes = safeArray(themes.sizes)
        const journal = journals.filter((item) => item && item.id === journalId)[0] || null
        const patch = { journal: journalId || "" }
        const width = journal ? widthForChoice(journal, form.style && form.style.size, sizes) : null
        if (width !== null) patch.width_mm = width
        updateStyle(patch)
      }

      const chooseSize = (sizeId) => {
        const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
        const journals = safeArray(themes.journals)
        const sizes = safeArray(themes.sizes)
        const journal = journals.filter((item) => item && item.id === form.style.journal)[0] || null
        const patch = { size: sizeId }
        const width = journal ? widthForChoice(journal, sizeId, sizes) : styleWidthForSize(sizes, sizeId)
        if (width !== null) patch.width_mm = width
        updateStyle(patch)
      }

      const toggleFormat = (format) => {
        const current = resolveFormats(form.formats)
        const next = current.indexOf(format) === -1 ? current.concat([format]) : current.filter((item) => item !== format)
        if (next.length === 0) return
        update({ formats: next })
      }

      const setOption = (option, value) => {
        if (p.onForm) p.onForm((prev) => Object.assign({}, prev, { options: Object.assign({}, prev.options || {}, { [option.id]: normalizeOptionValue(option, value) }) }))
      }

      const loadPasteExample = () => {
        update({ pasted: JSON.stringify({ series: [{ name: "A", x: [0, 1, 2], y: [0, 1, 4] }] }, null, 2) })
      }

      const canRender = Boolean(specResult.spec) && p.status !== "rendering"

      const dataSection = h(
        "section",
        { className: "scp-form-section" },
        h(
          "div",
          { className: "scp-form-head" },
          h("h2", { className: "scp-form-title" }, t("dataSection")),
          h("span", { className: "scp-grow" }),
          h(
            "div",
            { className: "scp-seg", role: "group", "aria-label": t("dataSection") },
            [
              ["sample", t("dataSample")],
              ["workspace", t("dataWorkspace")],
              ["paste", t("dataPaste")],
            ].map((row) =>
              h(
                "button",
                {
                  key: row[0],
                  type: "button",
                  className: "scp-seg-btn",
                  "aria-pressed": form.dataMode === row[0] ? "true" : "false",
                  onClick: () => update({ dataMode: row[0] }),
                },
                row[1],
              ),
            ),
          ),
        ),
        h(
          "div",
          { className: "scp-form-body" },
          form.dataMode === "sample"
            ? h(
                "div",
                null,
                samples.length === 0
                  ? h(Notice, { tone: "warn" }, h("span", null, t("noSamplesTitle") + " — " + t("noSamplesBody")))
                  : [
                      h(Field, { key: "sample", label: t("sampleField") }, h(Select, { value: form.sampleId, onChange: (value) => chooseSample(value) }, sampleGroups.map((group) => h("optgroup", { key: group.id, label: group.label }, group.samples.map((sample) => h("option", { key: sample.id, value: sample.id }, datasetLabel(sample, lang))))))),
                      selectedSample && selectedSample.descriptionZh
                        ? h("p", { className: "scp-hint", key: "desc" }, lang === "en" ? selectedSample.descriptionEn || selectedSample.descriptionZh : selectedSample.descriptionZh)
                        : null,
                      selectedSample && safeArray(selectedSample.recommended).length > 0
                        ? h(
                            "div",
                            { className: "scp-row", key: "rec" },
                            h("span", { className: "scp-hint" }, t("recommendedKinds") + ":"),
                            safeArray(selectedSample.recommended).map((recommended, index) => {
                              const kind = findKind(caps, recommended.kind)
                              if (!kind) return h(Chip, { key: "rec-" + index, label: String(recommended.kind) })
                              return h(
                                "button",
                                { key: "rec-" + index, type: "button", className: "scp-format-pill", onClick: () => chooseRecommended(recommended), title: pickLocalized(kind, lang, "summary") },
                                pickLocalized(kind, lang, "name"),
                              )
                            }),
                          )
                        : null,
                      sampleColumns.length > 0
                        ? h(
                            "div",
                            { className: "scp-data-cols", key: "cols" },
                            sampleColumns.slice(0, 12).map((column, index) => h("span", { className: "scp-col-chip", key: "sc-" + index }, h("span", null, column.name), h("span", { className: "scp-col-kind" }, column.kind))),
                          )
                        : null,
                    ],
                  )
              : null,
          form.dataMode === "workspace"
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 9 } },
                workspaceFiles.length === 0
                  ? h(Notice, { tone: "warn" }, h("span", null, t("noWorkspaceFiles")))
                  : h(Field, { label: t("workspaceField") }, h(Select, { value: form.workspacePath, onChange: (value) => update({ workspacePath: value, mapping: {} }) }, h("option", { value: "" }, t("chooseFromList")), workspaceFiles.map((file) => h("option", { key: file.id, value: file.path || file.id }, datasetLabel(file, lang) + " · " + t("rowsColumns", { rows: datasetRows(file), cols: fmtInt(datasetColumnCount(file)) }))))),
                workspacePreview.loading ? h(Loading, { label: t("mappingLoading") }) : null,
                workspacePreview.error ? h(Notice, { tone: "err" }, t("previewFailed", { message: workspacePreview.error })) : null,
                workspacePreview.columns.length > 0
                  ? h(
                      "div",
                      { className: "scp-data-cols" },
                      workspacePreview.columns.slice(0, 14).map((column, index) => h("span", { className: "scp-col-chip", key: "wc-" + index }, h("span", null, column.name), h("span", { className: "scp-col-kind" }, column.kind))),
                    )
                  : null,
                h(Button, { size: "sm", variant: "ghost", glyph: "refresh", label: t("refreshData"), onClick: p.onRefreshDatasets }),
              )
            : null,
          form.dataMode === "paste"
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 7 } },
                h(TextInput, { multiline: true, rows: 7, value: form.pasted, onChange: (value) => update({ pasted: value }), placeholder: t("pastePlaceholder"), "aria-label": t("dataPaste") }),
                h(
                  "div",
                  { className: "scp-paste-actions" },
                  h(Button, { size: "sm", variant: "ghost", glyph: "code", label: t("pasteExample"), onClick: loadPasteExample }),
                  h("span", { className: "scp-grow" }),
                  paste && form.pasted.trim()
                    ? h("span", { className: "scp-paste-status", "data-ok": paste.ok ? "true" : "false" }, paste.ok ? t("pasteOk") : t(paste.error === "pasteInvalid" ? "pasteInvalid" : "pasteShape", { message: paste.detail || "" }))
                    : null,
                ),
                h("p", { className: "scp-hint", style: { margin: 0 } }, t("pasteHint")),
              )
            : null,
        ),
      )

      const mappingSection = form.dataMode !== "paste" && mappingColumns.length > 0
        ? h(
            "section",
            { className: "scp-form-section" },
            h("div", { className: "scp-form-head" }, h("h2", { className: "scp-form-title" }, t("mappingTitle"))),
            h(
              "div",
              { className: "scp-form-body" },
              h(
                "div",
                { className: "scp-mapping-grid" },
                mappingKeys.map((key) => {
                  const current = form.mapping && form.mapping[key] ? String(form.mapping[key]) : ""
                  const options = [{ value: "", label: key === "x" || key === "y" ? t("mappingNone") : t("mappingNone") }].concat(
                    mappingColumns.map((column) => ({ value: column.name, label: column.name + (column.kind ? " · " + column.kind : "") })),
                  )
                  return h(
                    Field,
                    { key: key, label: t(MAPPING_LABEL_KEYS[key] || key) },
                    h(Select, { value: current, options: options, onChange: (value) => updateMapping({ [key]: value }) }),
                  )
                }),
              ),
              h("p", { className: "scp-hint", style: { margin: 0 } }, t("mappingHint")),
            ),
          )
        : null

      const kindSection = h(
        "section",
        { className: "scp-form-section" },
        h("div", { className: "scp-form-head" }, h("h2", { className: "scp-form-title" }, t("kindSection")), h("span", { className: "scp-grow" }), h("span", { className: "scp-card-meta" }, allKinds.length + " kinds")),
        h(
          "div",
          { className: "scp-form-body" },
          h(
            "div",
            { className: "scp-kind-search-wrap" },
            h("span", { className: "scp-kind-search-icon" }, h(Icon, { name: "search", size: 13 })),
            h(TextInput, { value: kindQuery, onChange: setKindQuery, placeholder: t("kindSearch"), "aria-label": t("kindSearch") }),
          ),
          categories.length > 0
            ? h(
                "div",
                { className: "scp-row", style: { gap: 4, marginTop: -2 } },
                h("button", { type: "button", className: "scp-format-pill", "aria-pressed": kindGroup === "" ? "true" : "false", onClick: () => setKindGroup("") }, t("filterAll")),
                categories.map((category) =>
                  h("button", { key: category.id, type: "button", className: "scp-format-pill", "aria-pressed": kindGroup === category.id ? "true" : "false", onClick: () => setKindGroup(category.id), title: (lang === "en" ? category.en : category.zh) + " · " + category.count }, lang === "en" ? category.en : category.zh),
                ),
              )
            : null,
          h(
            "div",
            { className: "scp-kind-list", role: "listbox", "aria-label": t("kindSection") },
            filteredKinds.length === 0
              ? h("div", { className: "scp-kind-empty" }, t("kindEmpty"))
              : filteredKinds.map((kind) =>
                  h(
                    "button",
                    {
                      key: kind.kind || kind.id,
                      type: "button",
                      className: "scp-kind-btn",
                      role: "option",
                      "aria-pressed": form.kind === (kind.kind || kind.id) ? "true" : "false",
                      onClick: () => chooseKind(kind),
                    },
                    h("span", { className: "scp-kind-name" }, pickLocalized(kind, lang, "name")),
                    h("span", { className: "scp-kind-summary" }, pickLocalized(kind, lang, "summary")),
                  ),
                ),
          ),
          selectedKind
            ? h(
                "div",
                { className: "scp-kind-detail" },
                h("span", { className: "scp-kind-detail-text" }, pickLocalized(selectedKind, lang, "summary")),
                h(
                  "div",
                  { className: "scp-tag-list" },
                  h(Chip, { label: categoryLabel(selectedKind.category || selectedKind.groupId, lang) }),
                  safeArray(selectedKind.tags).map((tag, index) => h(Chip, { key: "tag-" + index, label: String(tag) })),
                ),
              )
            : null,
        ),
      )

      const optionSection = selectedKind
        ? h(
            "section",
            { className: "scp-form-section" },
            h("div", { className: "scp-form-head" }, h("h2", { className: "scp-form-title" }, t("optionsTitle")), h("span", { className: "scp-grow" }), h("span", { className: "scp-card-meta" }, String(safeArray(selectedKind.options).length))),
            h(
              "div",
              { className: "scp-form-body" },
              safeArray(selectedKind.options).length === 0
                ? h("p", { className: "scp-hint", style: { margin: 0 } }, t("noOptions"))
                : h(
                    "div",
                    { className: "scp-option-list" },
                    optionList(selectedKind.options).map((option) => {
                      const value = form.options && form.options[option.id] !== undefined ? form.options[option.id] : option.default
                      let control = null
                      if (option.type === "bool") {
                        control = h(Switch, { checked: Boolean(value), onChange: (next) => setOption(option, next), "aria-label": optionLabel(option, lang) })
                      } else if (option.type === "enum") {
                        control = h(Select, {
                          value: value,
                          options: safeArray(option.choices).map((choice) => ({ value: choice, label: String(choice) })),
                          onChange: (next) => setOption(option, next),
                          "aria-label": optionLabel(option, lang),
                        })
                      } else if (option.type === "int" || option.type === "float") {
                        control = h(SliderControl, {
                          value: value,
                          min: toNumber(option.min, 0),
                          max: toNumber(option.max, 100),
                          step: toNumber(option.step, option.type === "int" ? 1 : 0.1),
                          onChange: (next) => setOption(option, next),
                          label: optionLabel(option, lang),
                        })
                      } else if (option.type === "color") {
                        control = h(ColorControl, { value: value, onChange: (next) => setOption(option, next), "aria-label": optionLabel(option, lang) })
                      } else {
                        control = h(TextInput, { value: value, onChange: (next) => setOption(option, next), "aria-label": optionLabel(option, lang), style: { width: 128 } })
                      }
                      return h(
                        "div",
                        { className: "scp-option-row", key: option.id },
                        h("span", { className: "scp-option-label", title: optionLabel(option, lang) + " (" + option.id + ")" }, optionLabel(option, lang)),
                        h("span", { className: "scp-option-control" }, control),
                      )
                    }),
                  ),
            ),
          )
        : null

      const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
      const domains = safeArray(themes.domains)
      const journals = safeArray(themes.journals)
      const fonts = safeArray(themes.fonts)
      const sizes = safeArray(themes.sizes)
      const palettes = isObject(caps) && isObject(caps.palettes) ? caps.palettes : {}
      const categorical = safeArray(palettes.categorical)
      const continuous = safeArray(palettes.continuous)
      const style = form.style || {}

      const styleSection = h(
        "section",
        { className: "scp-form-section" },
        h("div", { className: "scp-form-head" }, h("h2", { className: "scp-form-title" }, t("styleSection"))),
        h(
          "div",
          { className: "scp-form-body" },
          h(
            "div",
            { className: "scp-style-grid" },
            h(Field, { label: t("domainField") }, h(Select, { value: style.domain, options: domains.map((domain) => ({ value: domain.id, label: pickLocalized(domain, lang, "name") })), onChange: chooseDomain, "aria-label": t("domainField") })),
            h(Field, { label: t("journalField") }, h(Select, { value: style.journal || "", options: [{ value: "", label: t("journalNone") }].concat(journals.map((journal) => ({ value: journal.id, label: pickLocalized(journal, lang, "name") }))), onChange: chooseJournal, "aria-label": t("journalField") })),
            h(Field, { label: t("paletteField") }, h(Select, { value: style.palette, options: categorical.map((palette) => ({ value: palette.id, label: pickLocalized(palette, lang, "name") })), onChange: (value) => updateStyle({ palette: value }), "aria-label": t("paletteField") })),
            h(Field, { label: t("cmapField") }, h(Select, { value: style.cmap, options: continuous.map((cmap) => ({ value: cmap.id, label: pickLocalized(cmap, lang, "name") })), onChange: (value) => updateStyle({ cmap: value }), "aria-label": t("cmapField") })),
            h(Field, { label: t("fontField") }, h(Select, { value: style.font, options: fonts.map((font) => ({ value: font.id, label: pickLocalized(font, lang, "name") + (font.available === false ? " · !" : "") })), onChange: (value) => updateStyle({ font: value }), "aria-label": t("fontField") })),
            h(Field, { label: t("sizePresetLabel"), hint: style.width_mm ? t("sizeNote", { w: fmtMm(style.width_mm) }) : null }, h(Select, { value: style.size, options: sizes.map((size) => ({ value: size.id, label: pickLocalized(size, lang, "name") })), onChange: chooseSize, "aria-label": t("sizePresetLabel") })),
            h(Field, { label: t("dpiLabel") }, h(TextInput, { value: style.dpi, onChange: (value) => updateStyle({ dpi: clampNumber(value, 72, 1200, DEFAULT_DPI) }), mono: true, style: { width: "100%" }, "aria-label": t("dpiLabel") })),
          ),
          h("hr", { className: "scp-sep", style: { margin: "2px 0" } }),
          h(
            "div",
            { className: "scp-option-list" },
            h("div", { className: "scp-option-row" }, h("span", { className: "scp-option-label" }, t("gridField")), h(Switch, { checked: Boolean(style.grid), onChange: (value) => updateStyle({ grid: value }), "aria-label": t("gridField") })),
            h("div", { className: "scp-option-row" }, h("span", { className: "scp-option-label" }, t("legendField")), h(Switch, { checked: Boolean(style.legend), onChange: (value) => updateStyle({ legend: value }), "aria-label": t("legendField") })),
            h("div", { className: "scp-option-row" }, h("span", { className: "scp-option-label" }, t("transparentField")), h(Switch, { checked: Boolean(style.transparent), onChange: (value) => updateStyle({ transparent: value }), "aria-label": t("transparentField") })),
          ),
        ),
      )

      const labels = form.labels || {}
      const labelsSection = h(
        "section",
        { className: "scp-form-section" },
        h("div", { className: "scp-form-head" }, h("h2", { className: "scp-form-title" }, t("labelsSection"))),
        h(
          "div",
          { className: "scp-form-body" },
          h(
            "div",
            { className: "scp-labels-grid" },
            h(Field, { label: t("labelX") }, h(TextInput, { value: labels.x, onChange: (value) => updateLabels({ x: value }), placeholder: t("labelPlaceholderX"), mono: true })),
            h(Field, { label: t("labelY") }, h(TextInput, { value: labels.y, onChange: (value) => updateLabels({ y: value }), placeholder: t("labelPlaceholderY"), mono: true })),
            h(Field, { label: t("labelTitle"), full: true }, h(TextInput, { value: labels.title, onChange: (value) => updateLabels({ title: value }), placeholder: t("labelPlaceholderTitle") })),
            h(Field, { label: t("labelColorbar"), full: true }, h(TextInput, { value: labels.colorbar, onChange: (value) => updateLabels({ colorbar: value }), placeholder: t("labelPlaceholderColorbar"), mono: true })),
          ),
        ),
      )

      const formats = resolveFormats(form.formats)
      const outputSection = h(
        "section",
        { className: "scp-form-section" },
        h("div", { className: "scp-form-head" }, h("h2", { className: "scp-form-title" }, t("outputSection"))),
        h(
          "div",
          { className: "scp-form-body" },
          h(Field, { label: t("basenameField") }, h(TextInput, { value: form.basename, onChange: (value) => update({ basename: value }), mono: true })),
          h(Field, { label: t("formatsField") }, h("div", { className: "scp-format-row" }, FORMATS.map((format) => h("button", { key: format, type: "button", className: "scp-format-pill", "aria-pressed": formats.indexOf(format) !== -1 ? "true" : "false", onClick: () => toggleFormat(format), disabled: formats.length === 1 && formats.indexOf(format) !== -1 }, formatLabel(format))))),
        ),
      )

      const specErrorText = (() => {
        const error = specResult.error
        if (error === "pasteInvalid") return t("pasteInvalid", { message: paste && paste.detail ? paste.detail : "" })
        if (error === "pasteShape") return t("pasteShape")
        if (error === "chooseDataFirst") return t("chooseDataFirst")
        if (error === "sampleNeedsId") return t("sampleNeedsId")
        if (error === "workspaceNeedsPath") return t("workspaceNeedsPath")
        if (error === "chooseKindFirst") return t("chooseKindFirst")
        return t(error || "renderBlocked")
      })()

      const validationNode = specResult.spec
        ? h(
            "div",
            { className: "scp-validation" },
            validation.status === "ok" && validation.issues.length === 0 ? h("div", { className: "scp-validation-ok" }, h(Icon, { name: "check", size: 12 }), h("span", null, t("validateOk"))) : null,
            validation.status === "ok" && validation.issues.length > 0
              ? h("div", null, h("span", { className: "scp-hint", style: { color: "var(--scp-warn)" } }, t("validateIssues", { n: validation.issues.length })), h("div", { className: "scp-validation-issues" }, validation.issues.slice(0, 6).map((issue) => h("div", { className: "scp-issue", key: issue.id }, h("span", { className: "scp-issue-dot" }), h("span", null, issue.message)))))
              : null,
            validation.status === "unavailable" ? h("span", { className: "scp-hint" }, t("validationFailed", { message: t("apiNotReady") })) : null,
            validation.status === "idle" ? h("span", { className: "scp-hint" }, t("validationChecking")) : null,
            !specResult.spec ? h("span", { className: "scp-hint" }, specErrorText) : null,
          )
        : h("div", { className: "scp-validation" }, h("span", { className: "scp-hint" }, specErrorText))

      const actions = h(
        "div",
        { className: "scp-form-actions" },
        h(Button, { className: "scp-render-btn", variant: "primary", size: "lg", glyph: p.status === "rendering" ? undefined : "play", label: p.status === "rendering" ? t("rendering") : t("renderBtn"), onClick: p.onRender, disabled: !canRender }),
        h(Button, { size: "lg", glyph: "refresh", label: t("resetForm"), onClick: p.onReset, disabled: p.status === "rendering" }),
      )

      const formNode = h(
        "div",
        { className: "scp-form" },
        p.capsError ? h(Notice, { tone: "warn" }, t("errorApi", { message: p.capsError })) : null,
        dataSection,
        mappingSection,
        kindSection,
        optionSection,
        styleSection,
        labelsSection,
        outputSection,
        validationNode,
        actions,
      )

      return h(
        "div",
        { className: "scp-view" },
        h(
          "div",
          { className: "scp-view-head" },
          h(
            "div",
            { className: "scp-view-heading" },
            h("p", { className: "scp-kicker" }, t("tagline")),
            h("h1", { className: "scp-h1" }, t("studioTitle")),
            h("p", { className: "scp-sub" }, t("studioSubtitle")),
          ),
          h(
            "div",
            { className: "scp-toolbar" },
            h(Button, { size: "sm", glyph: "gallery", label: t("navGallery"), onClick: p.onGoGallery }),
            h(Button, { size: "sm", variant: "ghost", glyph: "refresh", label: t("refreshData"), onClick: p.onRefreshDatasets }),
          ),
        ),
        h(
          "div",
          { className: "scp-studio-grid" },
          formNode,
          h(
            "div",
            { className: "scp-preview" },
            h(
              "section",
              { className: "scp-preview-panel" },
              h(
                "div",
                { className: "scp-preview-head" },
                h("h2", { className: "scp-preview-title" }, t("previewTitle")),
                statusChip(p, t, lang),
                h("span", { className: "scp-grow" }),
                p.result ? h("span", { className: "scp-card-meta" }, fmtFigureSize(p.result)) : null,
              ),
              h(StudioPreview, {
                t: t,
                lang: lang,
                status: p.status,
                error: p.renderError,
                result: p.result,
                onRender: p.onRender,
                onOpenResult: p.onOpenResult,
              }),
              h("p", { className: "scp-preview-hint", style: { padding: "0 11px 9px" } }, t("previewHint")),
            ),
          ),
        ),
      )
    }

    function statusChip(p, t, lang) {
      if (p.status === "rendering") return h("span", { className: "scp-status", "data-state": "unknown" }, h(Spinner, { size: "sm" }), h("span", null, t("rendering")))
      if (p.status === "done" && p.result) {
        const quality = normalizeQuality(p.result.quality)
        return h("span", { className: "scp-status", "data-state": "ok" }, h("span", { className: "scp-status-dot" }), h("span", null, quality.score !== null ? t("qualityInline", { score: quality.score, grade: quality.grade || "—" }) : t("figureSaved")))
      }
      if (p.status === "error") return h("span", { className: "scp-status", "data-state": "down" }, h("span", { className: "scp-status-dot" }), h("span", null, t("errorTitle")))
      return h("span", { className: "scp-status" }, h("span", { className: "scp-status-dot" }), h("span", null, t("previewEmptyTitle")))
    }

    function emptyStudioFormFallback() {
      return {
        initialized: true,
        dataMode: "sample",
        sampleId: "",
        workspacePath: "",
        pasted: "",
        mapping: {},
        kind: "",
        style: { domain: "", journal: "", palette: "", cmap: "", font: "", size: "", dpi: DEFAULT_DPI, grid: false, legend: true, transparent: false, width_mm: 89, height_ratio: 0.75 },
        labels: { x: "", y: "", title: "", colorbar: "" },
        options: {},
        formats: DEFAULT_FORMATS.slice(),
        basename: "fig1",
      }
    }

/**
 * dsh-sci-plot — 04-library
 *
 * Style library: domain presets, journal specs, categorical / continuous
 * palettes with CVD badges, and figure-size presets. Every card can push its
 * preset into the studio.
 */

    function findById(list, id) {
      const values = safeArray(list)
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] && String(values[i].id) === String(id)) return values[i]
      }
      return null
    }

    function kindNameById(caps, kindId, lang) {
      const kind = resolveKind(caps, kindId)
      if (kind) return pickLocalized(kind, lang, "name")
      // A recommendation can reference an id the registry no longer exposes;
      // showing the raw id is better than an empty chip.
      return String(kindId || "")
    }

    function journalPrimaryWidth(journal) {
      const widths = isObject(journal) && isObject(journal.widths) ? journal.widths : {}
      const direct = toNumber(widths.single, null)
      if (direct !== null) return direct
      const keys = Object.keys(widths)
      for (let i = 0; i < keys.length; i += 1) {
        const value = toNumber(widths[keys[i]], null)
        if (value !== null) return value
      }
      return null
    }

    function paletteSwatches(palette) {
      const colors = safeArray(isObject(palette) ? palette.colors : null)
      return colors.map((color) => String(color)).filter(Boolean)
    }

    function cmapStops(cmap) {
      const stops = safeArray(isObject(cmap) ? cmap.stops : null)
      return stops.map((stop) => String(stop)).filter(Boolean)
    }

    function cmapGradient(cmap) {
      const stops = cmapStops(cmap)
      if (stops.length === 0) return "var(--scp-layer2)"
      if (stops.length === 1) return stops[0]
      return "linear-gradient(90deg, " + stops.join(", ") + ")"
    }

    function continuousKindLabel(cmap, lang, t) {
      const kind = String((cmap && cmap.kind) || "")
      if (kind === "sequential") return t("continuousSequential")
      if (kind === "diverging") return t("continuousDiverging")
      if (kind === "cyclic") return t("continuousCyclic")
      return kind
    }

    function PaletteCard(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const palette = p.palette || {}
      const swatches = paletteSwatches(palette)
      return h(
        "div",
        { className: "scp-palette-card" },
        h(
          "div",
          { className: "scp-palette-head" },
          h("h3", { className: "scp-palette-name" }, pickLocalized(palette, lang, "name")),
          h("span", { className: "scp-palette-source" }, String(palette.source || "")),
          h("span", { className: "scp-grow" }),
          h(CvdBadge, {
            safe: palette.cvd_safe === true,
            delta: palette.cvd_min_delta_e,
            safeLabel: t("cvdSafe"),
            unsafeLabel: t("cvdCheck"),
            title: (palette.cvd_level ? String(palette.cvd_level) : "") + (palette.cvd_min_delta_e !== undefined ? " · ΔE " + fmtNum(palette.cvd_min_delta_e, 1) : ""),
          }),
        ),
        swatches.length > 0
          ? h(
              "div",
              { className: "scp-palette-swatches" },
              swatches.map((color, index) => h("span", { className: "scp-palette-swatch", key: "sw-" + index, style: { background: color }, title: color })),
            )
          : h("span", { className: "scp-hint" }, t("palettesEmpty")),
        h(
          "div",
          { className: "scp-row" },
          h("span", { className: "scp-mono", style: { color: "var(--scp-caption)" } }, swatches.length + " colors"),
          h("span", { className: "scp-grow" }),
          h(Button, { size: "sm", variant: "ghost", label: t("applyToStudio"), onClick: () => p.onApply({ palette: String(palette.id || "") }) }),
        ),
      )
    }

    function LibraryView(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const caps = p.caps || null
      const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
      const palettes = isObject(caps) && isObject(caps.palettes) ? caps.palettes : {}
      const domains = safeArray(themes.domains)
      const journals = safeArray(themes.journals)
      const sizes = safeArray(themes.sizes)
      const fonts = safeArray(themes.fonts)
      const categorical = safeArray(palettes.categorical)
      const continuous = safeArray(palettes.continuous)
      const maxSize = sizes.reduce((acc, size) => Math.max(acc, toNumber(size.width_mm, 0)), 0) || 180
      const allKinds = useMemo(() => flattenKinds(caps), [caps])
      const [lightbox, setLightbox] = useState(null)

      if (p.loading && !caps) {
        return h(
          "div",
          { className: "scp-view" },
          h("div", { className: "scp-view-head" }, h("div", { className: "scp-view-heading" }, h("h1", { className: "scp-h1" }, t("libraryTitle")))),
          h(
            "div",
            { className: "scp-lib-grid" },
            [0, 1, 2, 3].map((index) =>
              h(
                "div",
                { className: "scp-domain-card", key: "lib-sk-" + index },
                h(Skeleton, { height: 14, width: "50%" }),
                h(Skeleton, { height: 10 }),
                h(Skeleton, { height: 10, width: "80%" }),
                h(Skeleton, { height: 12 }),
              ),
            ),
          ),
        )
      }
      if (!caps) {
        return h(
          "div",
          { className: "scp-view" },
          h(
            "div",
            { className: "scp-view-head" },
            h("div", { className: "scp-view-heading" }, h("h1", { className: "scp-h1" }, t("libraryTitle")), h("p", { className: "scp-sub" }, t("librarySubtitle"))),
            h("div", { className: "scp-toolbar" }, h(Button, { size: "sm", glyph: "refresh", label: t("retry"), onClick: p.onRetry })),
          ),
          p.capsError
            ? h(ErrorState, { title: t("errorTitle"), message: p.capsError, retryLabel: t("retry"), onRetry: p.onRetry })
            : h(EmptyState, { icon: "palette", title: t("libraryEmptyTitle"), body: t("libraryEmptyBody"), actions: h(Button, { size: "sm", glyph: "refresh", label: t("retry"), onClick: p.onRetry }) }),
        )
      }

      const domainSection = h(
        "div",
        { className: "scp-lib-section" },
        h(SectionTitle, { title: t("domainsTitle"), note: domains.length + "" }),
        domains.length === 0
          ? h("p", { className: "scp-hint" }, t("noData"))
          : h(
              "div",
              { className: "scp-lib-grid" },
              domains.map((domain) => {
                const palette = findById(categorical, domain.palette)
                const cmap = findById(continuous, domain.cmap)
                const font = findById(fonts, domain.font)
                const swatches = paletteSwatches(palette)
                return h(
                  "div",
                  { className: "scp-domain-card", key: domain.id },
                  h(
                    "div",
                    { className: "scp-domain-head" },
                    h("h3", { className: "scp-domain-name" }, pickLocalized(domain, lang, "name")),
                    h("span", { className: "scp-grow" }),
                    h(Chip, { label: String(domain.id || ""), tone: undefined }),
                  ),
                  h("p", { className: "scp-domain-desc" }, pickLocalized(domain, lang, "description")),
                  swatches.length > 0 ? h("div", { className: "scp-swatch-strip" }, swatches.map((color, index) => h("span", { className: "scp-swatch", key: "dsw-" + index, style: { background: color }, title: color }))) : null,
                  h(
                    "div",
                    { className: "scp-domain-meta" },
                    palette ? h(Chip, { label: t("domainDefaultPalette") + ": " + pickLocalized(palette, lang, "name") }) : null,
                    cmap ? h(Chip, { label: t("domainCmap") + ": " + pickLocalized(cmap, lang, "name") }) : null,
                    font ? h(Chip, { label: t("domainFont") + ": " + pickLocalized(font, lang, "name") }) : null,
                  ),
                  safeArray(domain.recommended).length > 0
                    ? h(
                        "div",
                        { className: "scp-tag-list" },
                        h("span", { className: "scp-hint" }, t("recommendedKinds") + ":"),
                        safeArray(domain.recommended).map((kindId, index) => h(Chip, { key: "rec-" + index, label: kindNameById(caps, kindId, lang) })),
                      )
                    : null,
                  h(
                    "div",
                    { className: "scp-domain-foot" },
                    h(Button, { size: "sm", variant: "ghost", glyph: "sliders", label: t("applyToStudio"), onClick: () => p.onApply({ domain: String(domain.id), palette: String(domain.palette || ""), cmap: String(domain.cmap || ""), font: String(domain.font || "") }) }),
                  ),
                )
              }),
            ),
      )

      const journalSection = h(
        "div",
        { className: "scp-lib-section" },
        h(SectionTitle, { title: t("journalsTitle"), note: journals.length + "" }),
        journals.length === 0
          ? h("p", { className: "scp-hint" }, t("journalsEmpty"))
          : h(
              "div",
              { className: "scp-table-wrap scp-scroll-x" },
              h(
                "table",
                { className: "scp-table" },
                h(
                  "thead",
                  null,
                  h("tr", null, h("th", null, t("journalLabel")), h("th", null, t("journalWidths")), h("th", null, t("fontLabel")), h("th", null, t("noteLabel")), h("th", null, "")),
                ),
                h(
                  "tbody",
                  null,
                  journals.map((journal) =>
                    h(
                      "tr",
                      { key: journal.id },
                      h("td", null, h("strong", null, pickLocalized(journal, lang, "name")), h("div", { className: "scp-mono", style: { color: "var(--scp-caption)", fontSize: 10 } }, String(journal.id || ""))),
                      h("td", { className: "scp-num" }, journalWidthText(journal, t) || "—"),
                      h("td", null, pickLocalized(journal, lang, "font") || String(journal.font || "") || "—"),
                      h("td", { style: { minWidth: 200 } }, pickLocalized(journal, lang, "note") || "—"),
                      h(
                        "td",
                        null,
                        h(Button, {
                          size: "sm",
                          variant: "ghost",
                          label: t("applyToStudio"),
                          onClick: () => p.onApply({ journal: String(journal.id), width_mm: journalPrimaryWidth(journal) || undefined }),
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            ),
      )

      const paletteSection = h(
        "div",
        { className: "scp-lib-section" },
        h(SectionTitle, { title: t("palettesTitle"), note: categorical.length + " / " + continuous.length }),
        h(
          "div",
          { className: "scp-palette-grid" },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 } },
            categorical.length === 0
              ? h("p", { className: "scp-hint" }, t("palettesEmpty"))
              : categorical.map((palette) => h(PaletteCard, { key: palette.id, palette: palette, t: t, lang: lang, onApply: p.onApply })),
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 } },
            continuous.length === 0
              ? h("p", { className: "scp-hint" }, t("palettesEmpty"))
              : h(
                  "div",
                  { className: "scp-palette-card" },
                  h("h3", { className: "scp-palette-name" }, t("continuousTitle")),
                  h(
                    "div",
                    { className: "scp-cmap-list" },
                    continuous.map((cmap) =>
                      h(
                        "div",
                        { className: "scp-cmap-row", key: cmap.id },
                        h(
                          "div",
                          { className: "scp-cmap-head" },
                          h("span", { className: "scp-cmap-name" }, pickLocalized(cmap, lang, "name")),
                          h("span", { className: "scp-cmap-kind" }, continuousKindLabel(cmap, lang, t)),
                          h("span", { className: "scp-grow" }),
                          h(Button, { size: "sm", variant: "ghost", label: t("applyToStudio"), onClick: () => p.onApply({ cmap: String(cmap.id) }) }),
                        ),
                        h("div", { className: "scp-cmap-bar", style: { background: cmapGradient(cmap) }, title: cmapStops(cmap).join(" → ") }),
                      ),
                    ),
                  ),
                ),
          ),
        ),
      )

      const sizeSection = h(
        "div",
        { className: "scp-lib-section" },
        h(SectionTitle, { title: t("sizesTitle"), note: t("sizesScaleHint") }),
        sizes.length === 0
          ? h("p", { className: "scp-hint" }, t("sizesEmpty"))
          : h(
              "div",
              { className: "scp-size-grid" },
              sizes.map((size) => {
                const width = toNumber(size.width_mm, 0)
                const ratio = Math.max(3, Math.min(100, (width / maxSize) * 100))
                return h(
                  "div",
                  { className: "scp-size-card", key: size.id },
                  h("div", { className: "scp-size-name" }, pickLocalized(size, lang, "name"), h("span", { className: "scp-size-mm" }, fmtMm(width) + " mm")),
                  h("div", { className: "scp-size-track" }, h("div", { className: "scp-size-fill", style: { width: ratio + "%" } })),
                  h("p", { className: "scp-size-note" }, pickLocalized(size, lang, "note") || t("sizeNote", { w: fmtMm(width) })),
                  h("div", null, h(Button, { size: "sm", variant: "ghost", label: t("applyToStudio"), onClick: () => p.onApply({ size: String(size.id), width_mm: width }) })),
                )
              }),
            ),
      )

      return h(
        "div",
        { className: "scp-view" },
        h(
          "div",
          { className: "scp-view-head" },
          h(
            "div",
            { className: "scp-view-heading" },
            h("p", { className: "scp-kicker" }, t("tagline")),
            h("h1", { className: "scp-h1" }, t("libraryTitle")),
            h("p", { className: "scp-sub" }, t("librarySubtitle")),
          ),
          h("div", { className: "scp-toolbar" }, h(Button, { size: "sm", glyph: "refresh", label: t("refresh"), onClick: p.onRetry, disabled: p.loading })),
        ),
        p.capsError && caps ? h("div", { style: { marginBottom: 12 } }, h(Notice, { tone: "warn" }, t("errorApi", { message: p.capsError }))) : null,
        domainSection,
        journalSection,
        paletteSection,
        sizeSection,
        lightbox
          ? h(Lightbox, {
              src: lightbox.src,
              title: lightbox.title,
              alt: lightbox.title,
              href: lightbox.src,
              openLabel: t("detailOpenOriginal"),
              closeLabel: t("close"),
              onClose: () => setLightbox(null),
            })
          : null,
      )
    }

/**
 * dsh-sci-plot — 05-data-settings
 *
 * Data view (built-in samples grouped by domain, workspace CSV files with a
 * 5-row preview and "plot this") and the settings view (engine status, default
 * style, data paths, diagnostics).
 */

    function previewCell(row, column, index) {
      if (row === null || row === undefined) return "—"
      if (Array.isArray(row)) {
        const value = row[index]
        return value === null || value === undefined ? "—" : String(value)
      }
      if (isObject(row)) {
        const value = row[column && column.name ? column.name : column]
        if (value === null || value === undefined) return "—"
        if (typeof value === "number") return String(Math.round(value * 1000) / 1000)
        return String(value)
      }
      return String(row)
    }

    function PreviewTable(props) {
      const p = props || {}
      const t = p.t
      const data = p.data || {}
      const columns = safeArray(data.columns)
      const rows = safeArray(data.rows).slice(0, 5)
      const total = toNumber(data.total, null)
      if (columns.length === 0 && rows.length === 0) {
        return h("p", { className: "scp-preview-note" }, t("previewNoRows"))
      }
      return h(
        "div",
        { className: "scp-scroll-x" },
        h(
          "table",
          { className: "scp-preview-table" },
          h("thead", null, h("tr", null, columns.map((column, index) => h("th", { key: "ph-" + index, title: column.kind }, column.name + (column.kind ? " · " + column.kind : ""))))),
          h(
            "tbody",
            null,
            rows.map((row, rowIndex) => h("tr", { key: "pr-" + rowIndex }, columns.map((column, columnIndex) => h("td", { key: "pc-" + columnIndex }, previewCell(row, column, columnIndex))))),
          ),
        ),
        total !== null ? h("p", { className: "scp-preview-note" }, t("dataPreviewTotal", { n: fmtInt(total) })) : null,
      )
    }

    function DatasetCard(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const item = p.item || {}
      const source = p.source || "sample"
      const [open, setOpen] = useState(false)
      const [preview, setPreview] = useState({ loading: false, data: null, error: "" })
      const columns = safeArray(item.columns)
      const description = lang === "en" ? item.descriptionEn || item.descriptionZh : item.descriptionZh || item.descriptionEn
      const togglePreview = async () => {
        if (open) {
          setOpen(false)
          return
        }
        setOpen(true)
        if (preview.data || preview.loading) return
        const request = previewRequestFor(item)
        if (!request) {
          setPreview({ loading: false, data: null, error: "noPath" })
          return
        }
        setPreview({ loading: true, data: null, error: "" })
        try {
          const data = await apiPost("/api/datasets/preview", request)
          setPreview({ loading: false, data: data || null, error: "" })
        } catch (error) {
          setPreview({ loading: false, data: null, error: messageOf(error) })
        }
      }
      return h(
        "div",
        { className: "scp-data-card" },
        h(
          "div",
          { className: "scp-data-head" },
          h(
            "div",
            { className: "scp-grow" },
            h("h3", { className: "scp-data-title" }, datasetLabel(item, lang)),
            h(
              "p",
              { className: "scp-data-meta" },
              source === "workspace" && item.path ? item.path : pickLocalized(item, lang, "name") || item.id,
              " · ",
              t("rowsColumns", { rows: datasetRows(item), cols: fmtInt(datasetColumnCount(item)) }),
            ),
          ),
          source === "sample" && item.domain ? h(Chip, { label: item.domain }) : null,
        ),
        h(
          "div",
          { className: "scp-data-body" },
          description ? h("p", { className: "scp-hint", style: { margin: 0 } }, description) : null,
          columns.length > 0
            ? h(
                "div",
                { className: "scp-data-cols" },
                columns.slice(0, 16).map((column, index) => h("span", { className: "scp-col-chip", key: "dc-" + index }, h("span", null, column.name), h("span", { className: "scp-col-kind" }, column.kind))),
              )
            : null,
          item.mapping && Object.keys(item.mapping).length > 0
            ? h("div", { className: "scp-row" }, h("span", { className: "scp-hint" }, t("datasetMapping") + ":"), Object.keys(item.mapping).map((key) => h(Chip, { key: "mp-" + key, label: key + " → " + String(item.mapping[key]) })))
            : null,
          h(
            "div",
            { className: "scp-data-actions" },
            h(Button, { size: "sm", variant: "primary", glyph: "play", label: t("plotThis"), onClick: () => p.onPlot(item, source) }),
            h(Button, { size: "sm", glyph: open ? "chevronDown" : "chevronRight", label: open ? t("hidePreview") : t("preview"), onClick: () => void togglePreview() }),
          ),
        ),
        open
          ? h(
              "div",
              { className: "scp-preview-wrap" },
              preview.loading ? h(Loading, { label: t("previewLoading") }) : null,
              preview.error
                ? h(
                    "div",
                    null,
                    h(Notice, { tone: "warn" }, t("previewFailed", { message: preview.error })),
                    source === "sample" ? h("p", { className: "scp-preview-note" }, t("previewSampleHint")) : null,
                  )
                : null,
              preview.data ? h(PreviewTable, { t: t, data: preview.data }) : null,
              source === "sample" && preview.data ? h("p", { className: "scp-preview-note" }, t("previewSampleHint")) : null,
            )
          : null,
      )
    }

    function DataView(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const datasets = p.datasets || { samples: [], workspace: [] }
      const samples = safeArray(datasets.samples)
      const workspaceFiles = safeArray(datasets.workspace)
      const sampleGroups = useMemo(() => groupSamplesByDomain(samples, p.caps, lang), [samples, p.caps, lang])

      let body = null
      if (p.loading && samples.length === 0 && workspaceFiles.length === 0) {
        body = h(
          "div",
          { className: "scp-data-grid" },
          [0, 1].map((index) =>
            h(
              "div",
              { className: "scp-data-card", key: "data-sk-" + index },
              h("div", { className: "scp-data-head" }, h("div", { className: "scp-grow" }, h(Skeleton, { height: 13, width: "46%" }), h("div", { style: { height: 6 } }), h(Skeleton, { height: 9, width: "68%" }))),
              h("div", { className: "scp-data-body" }, h(Skeleton, { height: 10 }), h(Skeleton, { height: 10, width: "82%" })),
            ),
          ),
        )
      } else if (p.error && samples.length === 0 && workspaceFiles.length === 0) {
        body = h(ErrorState, { title: t("errorTitle"), message: p.error, retryLabel: t("retry"), onRetry: p.onRefreshData })
      } else {
        body = h(
          "div",
          null,
          h(
            "div",
            { className: "scp-lib-section", style: { marginTop: 0 } },
            h(SectionTitle, { title: t("samplesTitle"), note: samples.length + "" }),
            sampleGroups.length === 0
              ? h(EmptyState, { icon: "database", title: t("noSamplesTitle"), body: t("noSamplesBody") })
              : sampleGroups.map((group) =>
                  h(
                    "div",
                    { key: "group-" + group.id, style: { marginBottom: 12 } },
                    h("div", { className: "scp-row", style: { marginBottom: 6 } }, h("span", { className: "scp-kicker" }, group.label), h("span", { className: "scp-card-meta" }, t("columnsCount", { n: group.samples.length }))),
                    h(
                      "div",
                      { className: "scp-data-grid" },
                      group.samples.map((sample) => h(DatasetCard, { key: sample.id, item: sample, source: "sample", t: t, lang: lang, onPlot: p.onPlotDataset })),
                    ),
                  ),
                ),
          ),
          h(
            "div",
            { className: "scp-lib-section" },
            h(SectionTitle, { title: t("workspaceTitle"), note: workspaceFiles.length + "" }),
            workspaceFiles.length === 0
              ? h(EmptyState, { icon: "folder", title: t("emptyWorkspaceTitle"), body: t("emptyWorkspaceBody"), actions: h(Button, { size: "sm", glyph: "refresh", label: t("refreshData"), onClick: p.onRefreshData }) })
              : h(
                  "div",
                  { className: "scp-data-grid" },
                  workspaceFiles.map((file) => h(DatasetCard, { key: file.id, item: file, source: "workspace", t: t, lang: lang, onPlot: p.onPlotDataset })),
                ),
          ),
        )
      }

      return h(
        "div",
        { className: "scp-view" },
        h(
          "div",
          { className: "scp-view-head" },
          h(
            "div",
            { className: "scp-view-heading" },
            h("p", { className: "scp-kicker" }, t("tagline")),
            h("h1", { className: "scp-h1" }, t("dataTitle")),
            h("p", { className: "scp-sub" }, t("dataSubtitle")),
          ),
          h("div", { className: "scp-toolbar" }, h(Button, { size: "sm", glyph: "refresh", label: t("refreshData"), onClick: p.onRefreshData, disabled: p.loading })),
        ),
        body,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Settings                                                           */
    /* ------------------------------------------------------------------ */

    function EngineCard(props) {
      const p = props || {}
      const t = p.t
      const engine = p.engine || null
      const status = engineStatus(engine)
      const facts = engineFacts(engine)
      const fonts = engineFontList(engine)
      return h(
        "section",
        { className: "scp-panel" },
        h(
          "div",
          { className: "scp-panel-head" },
          h("h3", { className: "scp-panel-title" }, t("engineTitle")),
          h("span", { className: "scp-grow" }),
          h(
            "span",
            { className: "scp-engine-state", "data-state": status.state },
            h("span", { className: "scp-status-dot" }),
            h("span", null, status.state === "ok" ? t("engineAvailable") : status.state === "down" ? t("engineUnavailable") : t("engineUnknown")),
          ),
        ),
        h(
          "div",
          { className: "scp-panel-body" },
          facts.length === 0
            ? h("p", { className: "scp-hint", style: { margin: 0 } }, t("noData"))
            : h(
                "div",
                { className: "scp-facts" },
                facts.slice(0, 12).map((fact, index) =>
                  h(
                    "div",
                    { className: "scp-fact", key: "fact-" + index },
                    h("span", { className: "scp-fact-label" }, fact.label),
                    h("span", { className: "scp-fact-value" }, fact.value),
                  ),
                ),
              ),
          h("div", { className: "scp-row", style: { marginTop: 10 } }, h(Button, { size: "sm", glyph: "refresh", label: p.refreshing ? t("engineRefreshing") : t("engineRefreshBtn"), onClick: p.onRefreshEngine, disabled: p.refreshing })),
          fonts.length > 0
            ? h(
                "div",
                { style: { marginTop: 10 } },
                h("span", { className: "scp-kicker" }, t("engineCjkFonts")),
                h("div", { className: "scp-font-chips" }, fonts.slice(0, 8).map((font, index) => h(Chip, { key: "font-" + index, label: font }))),
              )
            : h("p", { className: "scp-hint", style: { marginTop: 10 } }, t("engineNoFonts")),
        ),
      )
    }

    function SettingsView(props) {
      const p = props || {}
      const t = p.t
      const lang = p.lang
      const caps = p.caps || null
      const settings = p.settings || {}
      const themes = isObject(caps) && isObject(caps.themes) ? caps.themes : {}
      const palettes = isObject(caps) && isObject(caps.palettes) ? caps.palettes : {}
      const domains = safeArray(themes.domains)
      const journals = safeArray(themes.journals)
      const sizes = safeArray(themes.sizes)
      const fonts = safeArray(themes.fonts)
      const categorical = safeArray(palettes.categorical)
      const [form, setForm] = useState(() => settingsFormFrom(settings))
      const [synced, setSynced] = useState("")
      useEffect(() => {
        const signature = JSON.stringify(settingsFormFrom(settings))
        if (signature === synced) return
        setForm(settingsFormFrom(settings))
        setSynced(signature)
      }, [settings, synced])
      const setField = (key, value) => setForm((current) => Object.assign({}, current, { [key]: value }))
      const paths = pathEntries(p.paths, p.diagnostics, settings)
      const pythonCandidates = safeArray(p.diagnostics && p.diagnostics.pythonCandidates)
      const saveDisabled = p.saving === true

      return h(
        "div",
        { className: "scp-view" },
        h(
          "div",
          { className: "scp-view-head" },
          h(
            "div",
            { className: "scp-view-heading" },
            h("p", { className: "scp-kicker" }, t("tagline")),
            h("h1", { className: "scp-h1" }, t("settingsTitle")),
            h("p", { className: "scp-sub" }, t("settingsSubtitle")),
          ),
          h("div", { className: "scp-toolbar" }, h(Button, { size: "sm", glyph: "refresh", label: t("refresh"), onClick: p.onRefresh, disabled: p.loading })),
        ),
        h(
          "div",
          { className: "scp-settings-grid" },
          h(
            "div",
            { className: "scp-settings-col" },
            h(EngineCard, { t: t, engine: p.engine, refreshing: p.engineRefreshing, onRefreshEngine: p.onRefreshEngine }),
            h(
              "section",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("pathsTitle")), h("span", { className: "scp-grow" }), h("span", { className: "scp-card-meta" }, t("figuresCountLabel") + " " + fmtInt(p.figureCount))),
              h(
                "div",
                { className: "scp-panel-body" },
                h("p", { className: "scp-hint", style: { margin: "0 0 6px" } }, t("pathsHint")),
                paths.length === 0
                  ? h("p", { className: "scp-hint", style: { margin: 0 } }, t("noPaths"))
                  : paths.map((entry) =>
                      h(
                        "div",
                        { className: "scp-path-row", key: entry.id },
                        h("span", { className: "scp-path-label" }, t(entry.labelKey)),
                        h("span", { className: "scp-path-value", title: entry.value }, entry.value),
                        h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "copy", title: t("copyPath"), onClick: () => p.onCopyPath(entry.value) }),
                        h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "folder", title: t("reveal"), onClick: () => p.onRevealPath(entry.value) }),
                      ),
                    ),
              ),
            ),
            h(
              "section",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("diagnosticsTitle")), h("span", { className: "scp-grow" }), h(Button, { size: "sm", variant: "ghost", glyph: "refresh", label: p.diagnosticsLoading ? t("loadingDiagnostics") : t("loadDiagnostics"), onClick: p.onLoadDiagnostics, disabled: p.diagnosticsLoading })),
              h(
                "div",
                { className: "scp-panel-body" },
                h("p", { className: "scp-hint", style: { margin: "0 0 6px" } }, t("diagnosticsHint")),
                p.diagnosticsError ? h(Notice, { tone: "warn" }, t("diagnosticsFailed", { message: p.diagnosticsError })) : null,
                pythonCandidates.length > 0
                  ? h(
                      "div",
                      { style: { marginBottom: 8 } },
                      h("span", { className: "scp-kicker" }, t("pythonCandidates")),
                      h("ul", { className: "scp-warning-list", style: { paddingLeft: 16 } }, pythonCandidates.map((candidate, index) => h("li", { key: "py-" + index, style: { color: "var(--scp-ink2)", fontFamily: "var(--scp-mono)", fontSize: 10.5, wordBreak: "break-all" } }, typeof candidate === "string" ? candidate : JSON.stringify(candidate)))),
                    )
                  : null,
                p.diagnostics
                  ? h("pre", { className: "scp-pre" }, JSON.stringify(p.diagnostics, null, 2))
                  : h("p", { className: "scp-hint", style: { margin: 0 } }, t("noData")),
              ),
            ),
          ),
          h(
            "div",
            { className: "scp-settings-col" },
            h(
              "section",
              { className: "scp-panel" },
              h("div", { className: "scp-panel-head" }, h("h3", { className: "scp-panel-title" }, t("defaultsTitle")), h("span", { className: "scp-grow" })),
              h(
                "div",
                { className: "scp-panel-body" },
                h("p", { className: "scp-hint", style: { margin: "0 0 9px" } }, t("defaultsHint")),
                h(
                  "div",
                  { className: "scp-form-grid" },
                  h(Field, { label: t("domainField") }, h(Select, { value: form.defaultDomain, options: domains.map((domain) => ({ value: domain.id, label: pickLocalized(domain, lang, "name") })), onChange: (value) => setField("defaultDomain", value), "aria-label": t("domainField") })),
                  h(Field, { label: t("journalField") }, h(Select, { value: form.defaultJournal, options: [{ value: "", label: t("journalNone") }].concat(journals.map((journal) => ({ value: journal.id, label: pickLocalized(journal, lang, "name") }))), onChange: (value) => setField("defaultJournal", value), "aria-label": t("journalField") })),
                  h(Field, { label: t("paletteField") }, h(Select, { value: form.defaultPalette, options: categorical.map((palette) => ({ value: palette.id, label: pickLocalized(palette, lang, "name") })), onChange: (value) => setField("defaultPalette", value), "aria-label": t("paletteField") })),
                  h(Field, { label: t("fontField") }, h(Select, { value: form.defaultFont, options: fonts.map((font) => ({ value: font.id, label: pickLocalized(font, lang, "name") })), onChange: (value) => setField("defaultFont", value), "aria-label": t("fontField") })),
                  h(Field, { label: t("sizePresetLabel") }, h(Select, { value: form.defaultSize, options: sizes.map((size) => ({ value: size.id, label: pickLocalized(size, lang, "name") })), onChange: (value) => setField("defaultSize", value), "aria-label": t("sizePresetLabel") })),
                  h(Field, { label: t("defaultDpi") }, h(TextInput, { value: form.defaultDpi, onChange: (value) => setField("defaultDpi", clampNumber(value, 72, 1200, DEFAULT_DPI)), mono: true, "aria-label": t("defaultDpi") })),
                ),
                h(
                  "div",
                  { className: "scp-form-actions-end" },
                  h(Button, { size: "sm", variant: "primary", glyph: "check", label: p.saving ? t("saving") : t("saveDefaults"), onClick: () => p.onSaveDefaults(buildSettingsPatch(form)), disabled: saveDisabled }),
                  h("span", { className: "scp-hint" }, t("saved")),
                ),
              ),
            ),
          ),
        ),
      )
    }

/**
 * dsh-sci-plot — 06-panel
 *
 * Panel root: one data flow for /api/state + /api/capabilities, view routing,
 * language persistence, theme, topbar, left navigation rail, gallery filters,
 * studio render/seed handlers, settings, diagnostics and the toast.
 */

    function NavRail(props) {
      const p = props || {}
      const t = p.t
      const active = p.active || "gallery"
      const figures = safeArray(p.figures)
      return h(
        "nav",
        { className: "scp-rail", "aria-label": t("appTitle") },
        h("div", { className: "scp-rail-group-title" }, t("appTitle")),
        h(
          "div",
          { className: "scp-nav" },
          VIEWS.map((view) =>
            h(
              "button",
              {
                key: view.id,
                type: "button",
                className: "scp-nav-btn",
                "aria-current": active === view.id ? "page" : undefined,
                onClick: () => p.onNavigate(view.id),
                title: t(view.labelKey),
              },
              h("span", { className: "scp-nav-icon" }, h(Icon, { name: view.icon, size: 15 })),
              h("span", { className: "scp-nav-label" }, t(view.labelKey)),
              view.id === "gallery" && figures.length > 0 ? h("span", { className: "scp-count", style: { marginLeft: "auto" } }, fmtInt(figures.length)) : null,
            ),
          ),
        ),
        h("div", { className: "scp-rail-foot" },
          h("div", null, h("strong", null, t("appTitle")), " " + VERSION),
          h("div", { className: "scp-rail-figure-count" }, t("galleryCount", { n: figures.length })),
          p.engineVersion ? h("div", { className: "scp-mono", style: { fontSize: 10, marginTop: 3 } }, "engine " + p.engineVersion) : null,
        ),
      )
    }

    function SciPlotPanel(props) {
      const p = props || {}
      const outerT = typeof p.t === "function" ? p.t : makeT("zh")
      const layout = p.layout && typeof p.layout === "object" ? p.layout : null
      const [lang, setLangState] = useState(() => detectLang())
      const t = useMemo(() => makeT(lang), [lang])
      const dark = useDarkTheme()
      const [view, setView] = useState("gallery")
      const [figures, setFigures] = useState([])
      const [stateData, setStateData] = useState(null)
      const [caps, setCaps] = useState(null)
      const [datasets, setDatasets] = useState({ samples: [], workspace: [] })
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState("")
      const [capsError, setCapsError] = useState("")
      const [notice, setNotice] = useState(null)
      const [figure, setFigure] = useState(null)
      const [figureError, setFigureError] = useState("")
      const [filters, setFilters] = useState({ kind: "", domain: "" })
      const [studioForm, setStudioForm] = useState(() => emptyStudioFormFallback())
      const [studioStatus, setStudioStatus] = useState("idle")
      const [studioResult, setStudioResult] = useState(null)
      const [studioError, setStudioError] = useState("")
      const [engineRefreshing, setEngineRefreshing] = useState(false)
      const [diagnostics, setDiagnostics] = useState(null)
      const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
      const [diagnosticsError, setDiagnosticsError] = useState("")
      const [savingSettings, setSavingSettings] = useState(false)
      const loadedRef = useRef(false)
      const langTouchedRef = useRef(false)
      const figureTokenRef = useRef(0)

      const settings = stateData && isObject(stateData.settings) ? stateData.settings : {}
      const engine = stateData && isObject(stateData.engine) ? stateData.engine : null
      const capsVersion = caps && caps.version ? String(caps.version) : ""
      const activeView = figure ? "gallery" : view

      const notify = useCallback((text, tone) => {
        const value = String(text || "")
        if (!value) return
        setNotice({ id: Date.now() + Math.random(), text: value, tone: tone === "err" ? "err" : "ok" })
      }, [])

      useEffect(() => {
        if (!notice) return undefined
        const timer = setTimeout(() => setNotice(null), TOAST_MS)
        return () => clearTimeout(timer)
      }, [notice])

      const loadAll = useCallback(async (options) => {
        const quiet = Boolean(options && options.quiet)
        if (!quiet) setLoading(true)
        const results = await Promise.allSettled([apiGet("/api/state"), apiGet("/api/capabilities")])
        let nextState = null
        let nextCaps = null
        let stateMessage = ""
        let capsMessage = ""
        if (results[0].status === "fulfilled") nextState = isObject(results[0].value) ? results[0].value : {}
        else stateMessage = messageOf(results[0].reason)
        if (results[1].status === "fulfilled") nextCaps = isObject(results[1].value) ? results[1].value : {}
        else capsMessage = messageOf(results[1].reason)
        if ((!nextCaps || (!nextCaps.kinds && !nextCaps.themes)) && nextState && isObject(nextState.capabilities)) {
          nextCaps = nextState.capabilities
        }
        if (nextState) {
          setStateData(nextState)
          setFigures(sortFigures(nextState.figures))
          setDatasets(normalizeDatasets(nextState.datasets))
        }
        if (nextCaps && (nextCaps.kinds || nextCaps.themes || nextCaps.palettes)) {
          setCaps(nextCaps)
          setCapsError(capsMessage)
        } else if (capsMessage) {
          setCapsError(capsMessage)
        }
        setError(stateMessage)
        setLoading(false)
        if (nextCaps) {
          const nextSettings = nextState && isObject(nextState.settings) ? nextState.settings : {}
          setStudioForm((current) => ensureStudioForm(current, nextCaps, nextSettings))
        }
        return { state: nextState, caps: nextCaps, stateError: stateMessage, capsError: capsMessage }
      }, [])

      useEffect(() => {
        if (loadedRef.current) return
        loadedRef.current = true
        void loadAll()
      }, [loadAll])

      useEffect(() => {
        const stored = readLang()
        const settingsLang = stateData && stateData.settings ? stateData.settings.lang : ""
        if (!stored && !langTouchedRef.current && (settingsLang === "zh" || settingsLang === "en")) {
          setLangState((current) => (current === settingsLang ? current : settingsLang))
        }
      }, [stateData])

      const loadDiagnostics = useCallback(async () => {
        setDiagnosticsLoading(true)
        setDiagnosticsError("")
        try {
          const data = await apiGet("/api/diagnostics")
          setDiagnostics(isObject(data) ? data : {})
        } catch (failure) {
          setDiagnosticsError(messageOf(failure))
        } finally {
          setDiagnosticsLoading(false)
        }
      }, [])

      useEffect(() => {
        if (view !== "settings") return
        if (diagnostics || diagnosticsLoading) return
        void loadDiagnostics()
      }, [view, diagnostics, diagnosticsLoading, loadDiagnostics])

      const chooseLang = (next) => {
        if (next !== "zh" && next !== "en") return
        if (next === lang) return
        langTouchedRef.current = true
        writeLang(next)
        setLangState(next)
        apiPost("/api/settings", { patch: { lang: next } }).catch(() => {})
      }

      const copyText = async (text) => {
        try {
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("no clipboard")
          await navigator.clipboard.writeText(String(text))
          notify(t("pathCopied"))
        } catch (failure) {
          notify(t("toastCopyFailed"), "err")
        }
      }

      const refreshAll = async () => {
        const result = await loadAll({ quiet: false })
        if (!result || (result.stateError && !result.caps)) {
          notify(t("errorTitle"), "err")
          return
        }
        notify(t("toastRefreshed"))
      }

      const reloadFigures = async () => {
        try {
          const data = await apiGet("/api/figures")
          setFigures(sortFigures(data && data.figures))
        } catch (failure) {
          /* keep the last good list; the gallery surfaces load errors on refresh */
        }
      }

      const reloadDatasets = async () => {
        try {
          const data = await apiGet("/api/datasets")
          setDatasets(normalizeDatasets(data))
          notify(t("dataRefreshDone"))
        } catch (failure) {
          notify(t("errorApi", { message: messageOf(failure) }), "err")
        }
      }

      const openFigure = async (raw) => {
        if (!raw || !raw.id) return
        const token = (figureTokenRef.current += 1)
        setFigure(raw)
        setFigureError("")
        try {
          const data = await apiGet("/api/figures/" + encodeURIComponent(raw.id))
          if (token !== figureTokenRef.current) return
          if (data && isObject(data.figure)) setFigure(data.figure)
        } catch (failure) {
          if (token !== figureTokenRef.current) return
          setFigureError(messageOf(failure))
        }
      }

      const navigate = (nextView) => {
        figureTokenRef.current += 1
        setFigure(null)
        setFigureError("")
        setView(nextView)
        if (nextView === "gallery") void reloadFigures()
      }

      const doRender = async () => {
        const built = buildRenderSpec(studioForm)
        if (!built.spec) {
          notify(t(built.error || "specRequired"), "err")
          return
        }
        const kind = findKind(caps, studioForm.kind)
        const title = built.spec.labels && built.spec.labels.title ? built.spec.labels.title : pickLocalized(kind || {}, lang, "name")
        setStudioStatus("rendering")
        setStudioError("")
        try {
          const data = await apiPost("/api/render", { spec: built.spec, title: title || undefined }, { timeoutMs: RENDER_TIMEOUT_MS })
          const rendered = data && isObject(data.figure) ? data.figure : null
          if (!rendered || !rendered.id) throw new Error(t("unknownError"))
          setStudioResult(rendered)
          setStudioStatus("done")
          notify(t("rendered"))
          void reloadFigures()
        } catch (failure) {
          setStudioStatus("error")
          setStudioError(messageOf(failure))
          notify(t("renderFailed", { message: messageOf(failure) }), "err")
        }
      }

      const handoffToChat = (sourceFigure) => {
        if (!sourceFigure || !sourceFigure.id) return
        const text = handoffPrompt(sourceFigure, lang)
        const goChat = () => {
          try {
            if (layout && typeof layout.selectPanel === "function") layout.selectPanel(null)
          } catch {
            /* layout may be unavailable in a non-web composition */
          }
        }
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard
              .writeText(text)
              .then(() => {
                notify(t("handoffCopied"))
                goChat()
              })
              .catch(() => {
                notify(t("toastCopyFailed"), "err")
                goChat()
              })
            return
          }
        } catch {
          /* fall through to the notification */
        }
        notify(t("toastCopyFailed"), "err")
        goChat()
      }

      const openStudioFromFigure = (sourceFigure) => {
        if (!sourceFigure) return
        const spec = isObject(sourceFigure.spec) ? sourceFigure.spec : {}
        const patch = seedStudioFromSpec(spec, caps)
        setStudioForm((current) => ensureStudioForm(Object.assign({}, current, patch), caps, settings))
        setStudioResult(sourceFigure)
        setStudioStatus("done")
        setStudioError("")
        figureTokenRef.current += 1
        setFigure(null)
        setView("studio")
      }

      const startSampleStudio = () => {        if (!caps) {
          notify(t("errorTitle"), "err")
          return
        }
        let next = initialStudioForm(caps, settings)
        const firstSample = safeArray(caps.samples)[0]
        if (firstSample) {
          next = Object.assign({}, next, {
            sampleId: String(firstSample.id || ""),
            mapping: isObject(firstSample.mapping) ? Object.assign({}, firstSample.mapping) : {},
          })
          const recommended = safeArray(firstSample.recommended)[0]
          if (recommended && recommended.kind) {
            const kind = findKind(caps, recommended.kind)
            if (kind) next = Object.assign({}, next, { kind: String(kind.kind || kind.id), options: mergeOptionValues(kind.options, next.options) })
          }
        }
        setStudioForm(next)
        setStudioStatus("idle")
        setStudioResult(null)
        setStudioError("")
        setView("studio")
      }

      const useSampleStyle = (item) => {
        if (!item) return
        const patch = galleryItemStyle(item, caps)
        const resolvedKind = patch.kind ? findKind(caps, patch.kind) : null
        setStudioForm((current) => {
          let next = Object.assign({}, current, { style: Object.assign({}, current.style || {}, patch.style) })
          if (resolvedKind) {
            const demo = isObject(resolvedKind.demo) ? resolvedKind.demo : {}
            const demoLabels = isObject(demo.labels) ? demo.labels : {}
            next = Object.assign({}, next, {
              kind: String(resolvedKind.kind || resolvedKind.id),
              options: mergeOptionValues(resolvedKind.options, next.options),
              labels: {
                x: demoLabels.x ? String(demoLabels.x) : "",
                y: demoLabels.y ? String(demoLabels.y) : "",
                title: current.labels && current.labels.title ? String(current.labels.title) : "",
                colorbar: demoLabels.colorbar ? String(demoLabels.colorbar) : "",
              },
            })
          }
          return ensureStudioForm(next, caps, settings)
        })
        setStudioStatus("idle")
        setStudioResult(null)
        setStudioError("")
        figureTokenRef.current += 1
        setFigure(null)
        setView("studio")
        notify(t("sampleStyleApplied"))
      }

      const resetStudio = () => {
        if (caps) setStudioForm(initialStudioForm(caps, settings))
        setStudioStatus("idle")
        setStudioResult(null)
        setStudioError("")
        notify(t("resetDone"))
      }

      const plotDataset = (item, source) => {
        if (!item) return
        const patch = {
          dataMode: source === "workspace" ? "workspace" : "sample",
          sampleId: source === "workspace" ? "" : String(item.id || ""),
          workspacePath: source === "workspace" ? String(item.path || item.id || "") : "",
          mapping: isObject(item.mapping) ? Object.assign({}, item.mapping) : {},
        }
        setStudioForm((current) => {
          let next = Object.assign({}, current, patch)
          if (item.recommendedKind) {
            const kind = findKind(caps, item.recommendedKind)
            if (kind) next = Object.assign({}, next, { kind: String(kind.kind || kind.id), options: mergeOptionValues(kind.options, next.options) })
          }
          return ensureStudioForm(next, caps, settings)
        })
        setStudioStatus("idle")
        setStudioResult(null)
        setStudioError("")
        setView("studio")
      }

      const applyStyle = (patch) => {
        if (!isObject(patch)) return
        setStudioForm((current) => Object.assign({}, current, { style: Object.assign({}, current.style || {}, patch) }))
        notify(t("appliedToStudio"))
      }

      const saveSettings = async (patch) => {
        if (savingSettings) return
        setSavingSettings(true)
        try {
          const data = await apiPost("/api/settings", { patch: patch || {} })
          const nextSettings = Object.assign({}, settings, data && isObject(data.settings) ? data.settings : patch || {})
          setStateData((current) => Object.assign({}, current || {}, { settings: nextSettings }))
          notify(t("saved"))
        } catch (failure) {
          notify(t("saveFailed", { message: messageOf(failure) }), "err")
        } finally {
          setSavingSettings(false)
        }
      }

      const refreshEngine = async () => {
        if (engineRefreshing) return
        setEngineRefreshing(true)
        try {
          const data = await apiPost("/api/engine/refresh", {})
          if (data && isObject(data.engine)) {
            setStateData((current) => Object.assign({}, current || {}, { engine: data.engine }))
          }
          notify(t("engineRefreshed"))
        } catch (failure) {
          notify(t("engineRefreshFailed", { message: messageOf(failure) }), "err")
        } finally {
          setEngineRefreshing(false)
        }
      }

      const revealPath = async (path) => {
        if (!path) return
        try {
          await apiPost("/api/reveal", { path: path })
          notify(t("revealDone"))
        } catch (failure) {
          try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
              await navigator.clipboard.writeText(String(path))
              notify(t("toastRevealCopied"))
              return
            }
          } catch (copyFailure) {}
          notify(t("toastRevealFailed", { message: messageOf(failure) }), "err")
        }
      }

      const closeFigure = () => {
        figureTokenRef.current += 1
        setFigure(null)
        setFigureError("")
        void reloadFigures()
      }

      const deleteFigure = (figureId) => {
        figureTokenRef.current += 1
        setFigures((current) => current.filter((item) => item.id !== figureId))
        setFigure(null)
        setFigureError("")
        setView("gallery")
        void reloadFigures()
      }

      const updateFigure = (nextFigure) => {
        if (!nextFigure || !nextFigure.id) return
        setFigure(nextFigure)
        setFigures((current) => current.map((item) => (item.id === nextFigure.id ? Object.assign({}, item, nextFigure) : item)))
      }

      const topbarStatus = engineStatus(engine)

      let content = null
      if (figure) {
        content = h(FigureDetailView, {
          t: t,
          lang: lang,
          figure: figure,
          caps: caps,
          error: figureError,
          onBack: closeFigure,
          onRefresh: () => void openFigure(figure),
          onUpdate: updateFigure,
          onDeleted: deleteFigure,
          onOpenStudio: openStudioFromFigure,
          onHandoff: handoffToChat,
          notify: notify,
        })
      } else if (view === "studio") {
        content =
          !caps && loading && !capsError
            ? h("div", { className: "scp-view" }, h(Loading, { label: t("loadingPanel") }))
            : h(StudioView, {
                t: t,
                lang: lang,
                caps: caps,
                capsError: capsError,
                datasets: datasets,
                form: studioForm,
                onForm: setStudioForm,
                status: studioStatus,
                result: studioResult,
                renderError: studioError,
                onRender: () => void doRender(),
                onReset: resetStudio,
                onGoGallery: () => navigate("gallery"),
                onOpenResult: (rendered) => {
                  setView("gallery")
                  void openFigure(rendered)
                },
                onRefreshDatasets: () => void reloadDatasets(),
              })
      } else if (view === "library") {
        content = h(LibraryView, {
          t: t,
          lang: lang,
          caps: caps,
          capsError: capsError,
          loading: loading && !caps,
          onRetry: () => void refreshAll(),
          onApply: applyStyle,
        })
      } else if (view === "data") {
        content = h(DataView, {
          t: t,
          lang: lang,
          caps: caps,
          datasets: datasets,
          loading: loading,
          error: error,
          onRefreshData: () => void reloadDatasets(),
          onPlotDataset: plotDataset,
        })
      } else if (view === "settings") {
        content = h(SettingsView, {
          t: t,
          lang: lang,
          caps: caps,
          loading: loading,
          settings: settings,
          engine: engine,
          engineRefreshing: engineRefreshing,
          onRefresh: () => void refreshAll(),
          onRefreshEngine: () => void refreshEngine(),
          figureCount: figures.length,
          paths: stateData && isObject(stateData.paths) ? stateData.paths : null,
          diagnostics: diagnostics,
          diagnosticsLoading: diagnosticsLoading,
          diagnosticsError: diagnosticsError,
          onLoadDiagnostics: () => void loadDiagnostics(),
          onSaveDefaults: (patch) => void saveSettings(patch),
          saving: savingSettings,
          onCopyPath: (value) => void copyText(value),
          onRevealPath: (value) => void revealPath(value),
        })
      } else {
        content = h(GalleryView, {
          t: t,
          lang: lang,
          caps: caps,
          figures: figures,
          gallery: stateData ? stateData.gallery : null,
          loading: loading,
          error: error,
          filters: filters,
          onFilters: setFilters,
          onRefresh: () => void refreshAll(),
          onOpenFigure: (item) => void openFigure(item),
          onGoStudio: () => navigate("studio"),
          onRenderSample: caps ? startSampleStudio : null,
          onUseSampleStyle: useSampleStyle,
        })
      }

      return h(
        "div",
        { className: "scp-root", "data-scp-theme": dark ? "dark" : "light", "data-view": activeView },
        h("style", null, STYLES),
        h(
          "div",
          { className: "scp-shell" },
          h(
            "header",
            { className: "scp-topbar" },
            h(
              "div",
              { className: "scp-brand" },
              h("div", { className: "scp-brand-mark" }, h(SciPlotMark, { size: 17 })),
              h(
                "div",
                { className: "scp-brand-text" },
                h("span", { className: "scp-brand-title" }, t("appTitle")),
                h("span", { className: "scp-brand-sub" }, t("tagline")),
              ),
            ),
            h(
              "div",
              { className: "scp-topbar-mid" },
              h("span", { className: "scp-topbar-sep" }),
              loading && !stateData
                ? h("span", { className: "scp-status", "data-state": "unknown", role: "status" }, h(Spinner, { size: "sm" }), h("span", null, t("engineChecking")))
                : h(StatusLine, { state: topbarStatus.state, label: t(topbarStatus.labelKey) }),
              capsVersion ? h("span", { className: "scp-mono", style: { fontSize: 10.5, color: "var(--scp-caption)" } }, "v" + capsVersion) : null,
            ),
            h("span", { className: "scp-spacer" }),
            h(
              "div",
              { className: "scp-topbar-actions" },
              h(
                "div",
                { className: "scp-seg", role: "group", "aria-label": t("language") },
                h("button", { type: "button", className: "scp-seg-btn", "aria-pressed": lang === "zh" ? "true" : "false", onClick: () => chooseLang("zh"), title: "中文" }, "中"),
                h("button", { type: "button", className: "scp-seg-btn", "aria-pressed": lang === "en" ? "true" : "false", onClick: () => chooseLang("en"), title: "English" }, "EN"),
              ),
              h(Button, { size: "sm", variant: "ghost", iconOnly: true, glyph: "refresh", title: t("refresh"), onClick: () => void refreshAll(), disabled: loading }),
            ),
          ),
          h(
            "div",
            { className: "scp-body" },
            h(NavRail, {
              t: t,
              active: activeView,
              figures: figures,
              engineVersion: capsVersion,
              onNavigate: (nextView) => navigate(nextView),
            }),
            h("main", { className: "scp-main", id: "dsh-sci-plot-main" }, content),
          ),
        ),
        h(Toast, { notice: notice, onClose: () => setNotice(null), closeLabel: t("close") }),
      )
    }

/**
 * dsh-sci-plot — 06-toolview
 *
 * Inline figure card for the scientific-plot tool calls.
 *
 * `sci_plot_render` and `sci_plot_auto` results are registered into the
 * session-scoped `tool.call.toolview` slot (keyed by the tool wire name), so the
 * figure appears in the conversation itself: thumbnail, kind/domain/journal,
 * physical size, dpi and the quality badge, plus "open full image" / "open panel".
 *
 * The card is pure UI: the image is fetched from the existing loopback panel
 * route, so no image bytes ever enter the model context. The helpers below are
 * framework-free and exposed through __test__ in 07-apply.
 */

    const TOOLVIEW_TOOLS = ["sci_plot_render", "sci_plot_auto"]

    /** Collect candidate content block arrays from a tool-call phase block. */
    function toolViewContentCandidates(block) {
      const lists = []
      const push = (value) => {
        if (Array.isArray(value)) lists.push(value)
      }
      if (!isObject(block)) return lists
      push(block.content)
      push(block.blocks)
      if (isObject(block.result)) {
        push(block.result.content)
        push(block.result.blocks)
      }
      if (isObject(block.output)) {
        push(block.output.content)
        push(block.output.blocks)
      }
      if (isObject(block.data)) push(block.data.content)
      if (isObject(block.call) && isObject(block.call.result)) push(block.call.result.content)
      if (isObject(block.toolResult)) push(block.toolResult.content)
      if (typeof block.text === "string" && block.text.trim()) lists.push([{ type: "text", text: block.text }])
      if (typeof block.result === "string" && block.result.trim()) lists.push([{ type: "text", text: block.result }])
      return lists
    }

    /** Plain text of a tool result block (any content-block dialect). */
    function toolViewText(block) {
      const lists = toolViewContentCandidates(block)
      for (let i = 0; i < lists.length; i += 1) {
        let text = ""
        for (const item of lists[i]) {
          if (!item) continue
          if (typeof item === "string") text += item
          else if (typeof item.text === "string") text += item.text
          else if (typeof item.content === "string") text += item.content
        }
        if (text.trim()) return text
      }
      return ""
    }

    /** Parse the JSON payload our tools return as one text content block. */
    function toolViewPayload(blockOrText) {
      const text = typeof blockOrText === "string" ? blockOrText : toolViewText(blockOrText)
      const trimmed = String(text || "").trim()
      if (!trimmed) return null
      try {
        const direct = JSON.parse(trimmed)
        if (isObject(direct)) return direct
      } catch {
        /* fall through to a bounded slice */
      }
      const start = trimmed.indexOf("{")
      const end = trimmed.lastIndexOf("}")
      if (start >= 0 && end > start) {
        try {
          const sliced = JSON.parse(trimmed.slice(start, end + 1))
          if (isObject(sliced)) return sliced
        } catch {
          /* not JSON */
        }
      }
      return null
    }

    function toolViewIssues(quality, lang) {
      if (!isObject(quality)) return []
      const direct = safeArray(quality.issues)
      if (direct.length > 0) return direct.map((item) => String(item || "")).filter(Boolean).slice(0, 3)
      return qualityCheckList(quality)
        .filter((check) => check.status === "warn" || check.status === "fail")
        .slice(0, 3)
        .map((check) => (lang === "en" ? check.messageEn || check.messageZh : check.messageZh || check.messageEn))
    }

    /**
     * Normalize one tool result into the figure-card model.
     * States: "ready" | "error" | "empty".
     */
    function figureCardModel(block, lang) {
      const locale = lang === "en" ? "en" : "zh"
      const payload = isObject(block) && isObject(block.figure) ? block : toolViewPayload(block)
      if (!isObject(payload)) {
        const raw = toolViewText(block)
        if (raw) return { state: "empty", raw: raw.slice(0, 400) }
        return { state: "empty" }
      }
      const isError = payload.ok === false || (isObject(block) && block.isError === true)
      if (isError) {
        const repair = isObject(payload.repair) ? payload.repair.detail || payload.repair.label || "" : payload.repair || ""
        return {
          state: "error",
          code: String(payload.code || "failed"),
          error: String(payload.error || payload.message || "The figure call failed."),
          repair: String(repair || payload.next || ""),
        }
      }
      const figure = isObject(payload.figure) ? payload.figure : payload
      if (!isObject(figure) || !figure.id) return { state: "empty", raw: toolViewText(block).slice(0, 300) }
      const quality = isObject(payload.quality) ? payload.quality : isObject(figure.quality) ? figure.quality : null
      const score = qualityScore(quality)
      const grade = (isObject(quality) && quality.grade ? String(quality.grade).toUpperCase() : "") || qualityGrade(score)
      const chosen = isObject(payload.chosen) ? payload.chosen : null
      const gateMet = isObject(quality) && typeof quality.gateMet === "boolean" ? quality.gateMet : true
      return {
        state: "ready",
        figure,
        quality: {
          score,
          grade,
          gateMet,
          issues: toolViewIssues(quality, locale),
          gate: isObject(quality) && Number.isFinite(Number(quality.gate)) ? Number(quality.gate) : null,
        },
        chosen,
        caption: typeof payload.caption === "string" ? payload.caption : "",
        alternatives: safeArray(payload.alternatives)
          .map((item) => (isObject(item) ? item.nameZh || item.kind || "" : String(item || "")))
          .filter(Boolean)
          .slice(0, 3),
      }
    }

    /** Compact metadata chips shown under the figure. */
    function figureCardChips(model) {
      const figure = model && model.figure ? model.figure : null
      if (!figure) return []
      const chips = []
      if (figure.kindNameZh || figure.kind) chips.push(figure.kindNameZh || figure.kind)
      if (figure.domainNameZh || figure.domain) chips.push(figure.domainNameZh || figure.domain)
      if (figure.journal) chips.push(String(figure.journal))
      if (figure.widthMm) chips.push(fmtMm(figure.widthMm) + " × " + fmtMm(figure.heightMm) + " mm")
      if (figure.dpi) chips.push(fmtInt(figure.dpi) + " dpi")
      if (Array.isArray(figure.formats) && figure.formats.length > 0) chips.push(figure.formats.join("/").toUpperCase())
      return chips
    }

    function figureCardTitle(model) {
      const figure = model && model.figure ? model.figure : {}
      return String(figure.title || figure.kindNameZh || figure.kind || "")
    }

    function figureCardCaption(model) {
      const figure = model && model.figure ? model.figure : {}
      return String(model?.caption || figure.title || figure.kindNameZh || figure.kind || "")
    }

    function toolViewPhaseLabel(phase, lang) {
      const zh = lang !== "en"
      if (phase === "error") return zh ? "绘图失败" : "Figure failed"
      if (phase === "ready") return zh ? "科研绘图" : "Scientific figure"
      return zh ? "正在绘制科研图…" : "Rendering scientific figure…"
    }

    const TOOLVIEW_STYLE = {
      card: {
        margin: "10px 0",
        border: "1px solid var(--dsw-alias-border-l1, rgba(20,20,20,0.10))",
        borderRadius: 12,
        background: "var(--dsw-alias-bg-layer-1, #ffffff)",
        padding: 12,
        maxWidth: 640,
        boxSizing: "border-box",
        fontFamily: "inherit",
      },
      frame: {
        borderRadius: 8,
        background: "var(--dsw-alias-bg-layer-2, #f5f5f2)",
        padding: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
      },
      image: {
        display: "block",
        width: "100%",
        maxHeight: 320,
        objectFit: "contain",
      },
      titleRow: {
        marginTop: 10,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
      },
      title: {
        fontSize: 13,
        fontWeight: 600,
        color: "var(--dsw-alias-label-primary, #1a1a1a)",
        lineHeight: 1.4,
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
      badge: {
        flex: "none",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "18px",
        padding: "0 8px",
        borderRadius: 9,
        border: "1px solid var(--dsw-alias-border-l2, rgba(20,20,20,0.16))",
        color: "var(--dsw-alias-label-secondary, #52525b)",
        whiteSpace: "nowrap",
      },
      chips: {
        marginTop: 6,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
      },
      chip: {
        fontSize: 11,
        lineHeight: "18px",
        padding: "0 7px",
        borderRadius: 5,
        background: "var(--dsw-alias-bg-layer-2, #f5f5f2)",
        color: "var(--dsw-alias-label-secondary, #52525b)",
        whiteSpace: "nowrap",
      },
      caption: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 1.6,
        color: "var(--dsw-alias-label-secondary, #52525b)",
      },
      warning: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 1.6,
        color: "var(--dsw-alias-label-warning, #a15c00)",
      },
      error: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 1.6,
        color: "var(--dsw-alias-label-danger, #b42318)",
      },
      actions: {
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      },
      link: {
        fontSize: 12,
        lineHeight: "26px",
        padding: "0 10px",
        borderRadius: 6,
        border: "1px solid var(--dsw-alias-border-l2, rgba(20,20,20,0.16))",
        color: "var(--dsw-alias-label-primary, #1a1a1a)",
        textDecoration: "none",
        background: "transparent",
        cursor: "pointer",
      },
      hint: {
        fontSize: 11,
        color: "var(--dsw-alias-label-tertiary, #8a8a8f)",
      },
      loading: {
        margin: "10px 0",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px dashed var(--dsw-alias-border-l2, rgba(20,20,20,0.16))",
        color: "var(--dsw-alias-label-secondary, #52525b)",
        fontSize: 12,
        maxWidth: 640,
      },
    }

    /** Inline figure card. Receives the toolview owner props plus onOpenPanel. */
    function SciFigureCard(props) {
      const phase = props && props.phase === "result" ? "result" : "running"
      const lang = detectLang()
      const zh = lang !== "en"
      const model = useMemo(() => (phase === "result" ? figureCardModel(props.block, lang) : null), [phase, props.block, lang])
      const [imageFailed, setImageFailed] = useState(false)

      if (phase !== "result") {
        return h("div", { style: TOOLVIEW_STYLE.loading }, h(SciPlotMark, { size: 16 }), toolViewPhaseLabel("running", lang))
      }
      if (!model || model.state === "empty") {
        const text = model && model.raw ? model.raw : zh ? "绘图完成，但没有可展示的图卡数据。" : "The figure finished without a card payload."
        return h("div", { style: TOOLVIEW_STYLE.loading }, h(SciPlotMark, { size: 16 }), text)
      }
      if (model.state === "error") {
        return h(
          "div",
          { style: { ...TOOLVIEW_STYLE.card, borderColor: "var(--dsw-alias-border-danger, rgba(180,35,24,0.35))" } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, h(SciPlotMark, { size: 16 }), h("strong", { style: { fontSize: 13 } }, toolViewPhaseLabel("error", lang))),
          h("div", { style: TOOLVIEW_STYLE.error }, model.error),
          model.repair ? h("div", { style: TOOLVIEW_STYLE.caption }, zh ? "修复建议：" : "Repair: ", model.repair) : null,
          h("div", { style: TOOLVIEW_STYLE.hint }, zh ? "已回退到手动工具链：先 sci_plot_inspect_data，再 sci_plot_render。" : "Fell back to the manual chain: sci_plot_inspect_data, then sci_plot_render."),
        )
      }

      const figure = model.figure
      const chips = figureCardChips(model)
      const badgeText = model.quality && model.quality.score !== null && model.quality.score !== undefined
        ? (zh ? "质检 " : "Quality ") + model.quality.score + (model.quality.grade ? " · " + model.quality.grade : "")
        : ""
      const imageUrl = figureThumbUrl(figure)
      const fullUrl = figureFileUrl(figure, "png", "full")
      const issues = (model.quality && model.quality.issues) || []
      const cardTitle = figureCardTitle(model)
      return h(
        "div",
        { style: TOOLVIEW_STYLE.card },
        h(
          "div",
          { style: TOOLVIEW_STYLE.frame },
          imageFailed || !imageUrl
            ? h("div", { style: TOOLVIEW_STYLE.hint }, zh ? "图片加载失败，请打开面板查看。" : "Image failed to load; open the panel.")
            : h("img", {
                style: TOOLVIEW_STYLE.image,
                src: imageUrl,
                alt: cardTitle,
                loading: "lazy",
                onError: () => setImageFailed(true),
              }),
        ),
        h(
          "div",
          { style: TOOLVIEW_STYLE.titleRow },
          h("div", { style: TOOLVIEW_STYLE.title, title: cardTitle }, cardTitle),
          badgeText ? h("div", { style: TOOLVIEW_STYLE.badge }, badgeText) : null,
        ),
        chips.length > 0 ? h("div", { style: TOOLVIEW_STYLE.chips }, chips.map((chip, index) => h("span", { style: TOOLVIEW_STYLE.chip, key: "chip-" + index }, chip))) : null,
        model.chosen && model.chosen.reasonZh && zh ? h("div", { style: TOOLVIEW_STYLE.caption }, "选型理由：" + model.chosen.reasonZh) : null,
        model.caption && model.caption !== cardTitle ? h("div", { style: TOOLVIEW_STYLE.caption }, model.caption) : null,
        model.quality && model.quality.gateMet === false
          ? h("div", { style: TOOLVIEW_STYLE.warning }, zh ? "质量门未通过" : "Quality gate not met", model.quality.gate ? "（< " + model.quality.gate + "）" : "", issues.length > 0 ? "：" + issues.join("；") : zh ? "。" : ".")
          : null,
        model.alternatives && model.alternatives.length > 0
          ? h("div", { style: TOOLVIEW_STYLE.caption }, zh ? "备选图种：" : "Alternatives: ", model.alternatives.join("、"))
          : null,
        h(
          "div",
          { style: TOOLVIEW_STYLE.actions },
          h("a", { style: TOOLVIEW_STYLE.link, href: fullUrl, target: "_blank", rel: "noreferrer" }, zh ? "查看大图" : "Open image"),
          props.onOpenPanel ? h("button", { type: "button", style: TOOLVIEW_STYLE.link, onClick: props.onOpenPanel }, zh ? "在面板中打开" : "Open panel") : null,
          h("span", { style: TOOLVIEW_STYLE.hint }, zh ? "想改图：直接说「换双栏 / 色盲友好 / 标题中文」" : "To change it, say “double column / colour-blind / Chinese title”"),
        ),
      )
    }

/**
 * dsh-sci-plot — 07-apply
 *
 * Slot + locale registration and the pure helpers exposed as __test__ (the
 * headless unit tests evaluate this file in a vm with a fake module loader, so
 * the list must only reference framework-free functions).
 */

    return {
      inject: ["slots", "locale", "layout"],
      apply(ctx) {
        ctx.effect(function () {
          return ctx.locale.register(NS, DICTIONARIES)
        }, "dsh-sci-plot: dictionaries")
        const t = ctx.locale.bind(NS)

        // Inline figure card in the conversation for the two plotting tools.
        const openSciPlotPanel = function () {
          try {
            ctx.layout.selectPanel(NS)
          } catch {
            /* the panel may be unavailable in a headless composition */
          }
        }
        for (const toolName of TOOLVIEW_TOOLS) {
          ctx.slots.inject("tool.call.toolview", function () {
            return ctx.slots.register(
              {
                name: "tool.call.toolview",
                key: toolName,
                locale: NS,
              },
              function (slotProps) {
                return h(
                  SciFigureCard,
                  Object.assign({}, slotProps || {}, {
                    onOpenPanel: openSciPlotPanel,
                  }),
                )
              },
            )
          })
        }

        ctx.slots.inject("sidebar.panellist", function () {
          return ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: NS,
              order: 25,
              label: function () {
                return t("panel")
              },
              locale: NS,
            },
            function (slotProps) {
              const size = slotProps && typeof slotProps.size === "number" ? slotProps.size : 20
              return h(SciPlotMark, { size: size })
            },
          )
        })

        ctx.slots.inject("main", function () {
          return ctx.slots.register(
            {
              name: "main",
              key: NS,
              locale: NS,
            },
            function (slotProps) {
              const props = slotProps || {}
              return h(SciPlotPanel, {
                t: typeof props.t === "function" ? props.t : t,
                layout: ctx.layout,
              })
            },
          )
        })
      },

      /** Pure helpers for the headless unit tests; harmless at runtime. */
      __test__: {
        NS,
        VERSION,
        API_BASE,
        FORMATS,
        DEFAULT_FORMATS,
        DEFAULT_DPI,
        TEXT_ENTRIES,
        DICTIONARIES,
        VIEWS,
        MAPPING_KEYS,
        /* conversation toolview */
        TOOLVIEW_TOOLS,
        toolViewText,
        toolViewPayload,
        toolViewIssues,
        figureCardModel,
        figureCardChips,
        figureCardCaption,
        figureCardTitle,
        toolViewPhaseLabel,
        /* language */
        makeT,
        readLang,
        writeLang,
        detectLang,
        pickLocalized,
        pickCamelLocalized,
        optionLabel,
        figureTitle,
        handoffPrompt,
        /* generic + formatting */
        safeArray,
        isObject,
        toNumber,
        clampNumber,
        uniqueStrings,
        cleanObject,
        basenameOf,
        unwrapEnvelope,
        messageOf,
        parseColour,
        fmtInt,
        fmtNum,
        fmtMm,
        fmtFigureSize,
        fmtDurationMs,
        fmtClock,
        fmtTime,
        /* quality */
        qualityGrade,
        qualityTone,
        qualityScore,
        qualityCheckList,
        qualityCheckRows,
        qualityCounts,
        qualitySummary,
        normalizeQuality,
        /* urls + files */
        assetUrl,
        figureFileUrl,
        figureThumbUrl,
        figureFileEntries,
        figurePrimaryPath,
        galleryAssetUrl,
        normalizeGalleryItem,
        galleryTitle,
        galleryNote,
        galleryItemStyle,
        sampleQualityProps,
        styleNameFromCaps,
        clickableProps,
        /* figures */
        sortFigures,
        figureFacets,
        filterFigures,
        facetLabel,
        /* datasets */
        datasetColumnList,
        datasetColumnCount,
        normalizeDatasetItem,
        normalizeDatasets,
        datasetLabel,
        datasetRows,
        previewRequestFor,
        previewCell,
        isNumericKind,
        isCategoricalKind,
        mappingDefaultsFromColumns,
        cleanMapping,
        /* studio form ⇄ spec */
        resolveFormats,
        optionList,
        defaultOptionValues,
        defaultOptionValue,
        normalizeOptionValue,
        mergeOptionValues,
        buildOptionsSpec,
        buildLabelsSpec,
        buildStyleSpec,
        parsePastedData,
        buildRenderData,
        buildRenderSpec,
        findKind,
        resolveKind,
        normalizeKindKey,
        styleWidthForSize,
        defaultStyleFromSettings,
        initialStudioForm,
        ensureStudioForm,
        seedStudioFromSpec,
        emptyStudioFormFallback,
        buildExportBody,
        formatLabel,
        formatsForFigure,
        widthForChoice,
        journalWidthText,
        journalPrimaryWidth,
        normalizeValidationIssues,
        /* kinds + samples */
        flattenKinds,
        kindCategories,
        categoryLabel,
        filterKindList,
        groupSamplesByDomain,
        findById,
        kindNameById,
        paletteSwatches,
        cmapStops,
        cmapGradient,
        continuousKindLabel,
        /* settings + engine + theme */
        settingsFormFrom,
        buildSettingsPatch,
        engineStatus,
        engineFacts,
        engineFontList,
        pathEntries,
        detectDarkTheme,
        /* theme tokens available to the panel (documents the contract) */
      },
    }
  },
})
