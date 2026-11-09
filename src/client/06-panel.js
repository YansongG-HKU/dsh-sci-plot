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
