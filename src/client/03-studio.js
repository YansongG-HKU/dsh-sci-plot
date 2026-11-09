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
