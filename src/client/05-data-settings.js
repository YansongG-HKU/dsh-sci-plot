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
