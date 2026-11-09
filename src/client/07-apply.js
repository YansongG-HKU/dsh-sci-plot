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
