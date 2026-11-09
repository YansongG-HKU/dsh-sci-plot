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
