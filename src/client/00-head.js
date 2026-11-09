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
