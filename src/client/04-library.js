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
