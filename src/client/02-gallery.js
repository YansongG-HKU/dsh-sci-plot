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
