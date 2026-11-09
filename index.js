/**
 * dsh-sci-plot — Host plugin entry.
 *
 * Owns the figure store under `<DSH_HOME>/sci-plot`, the Python rendering engine
 * bridge, the `sci_plot_*` agent tools, one short system-prompt section and the
 * loopback panel routes. The Client half (declared through `dsh.client`) renders
 * the Scientific plot panel and calls the same Host service — one source of truth.
 */
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveConfig } from './lib/config.js'
import { PlotEngine } from './lib/engine.js'
import { registerPanel } from './lib/panel.js'
import { SciPlotService } from './lib/service.js'
import { FigureStore } from './lib/store.js'
import { createTools } from './lib/tools.js'
import { messageOf } from './lib/util.js'

const PLUGIN_ROOT = dirname(fileURLToPath(import.meta.url))

/** `tools` is required; the web panel and the Python engine are optional. */
export const inject = ['tools']

export const name = 'dsh-sci-plot'

const PROMPT_SECTION = [
  'Scientific plotting (科研绘图) is native here: 70+ publication chart kinds, discipline and journal presets, colour-blind-safe palettes, vector export.',
  'A figure is part of the answer, not a separate task. Decide when a visual materially helps and render it directly; the conversation displays it as an inline figure card (UI only — it never adds image tokens to the context, so do not call read_image to "look" at it).',
  'When to plot — default to ONE hero figure per turn:',
  '(a) data analysis or exploration: the user brings a CSV/TSV/JSON/table and asks what it shows, even without saying "plot";',
  '(b) paper, report, slide or thesis preparation: figures requested or clearly implied;',
  '(c) any explicit chart or graph request.',
  'Do not plot for code/debugging, prose, translation, pure factual questions or number-only answers. No decorative or duplicate figures; never invent data. Produce a set only when the user asks for several.',
  'Preferred call: sci_plot_auto {data:{path or sample}, intent}. It profiles the data, chooses kind + mapping + discipline/journal style, renders and quality-gates in one call, returning figure, quality, chosen, caption and alternatives. Reach for it first, including for bundled samples (e.g. bio_volcano_de).',
  'Manual chain when auto is unsure or fails: sci_plot_capabilities (once per conversation — do not repeat it every turn) → sci_plot_inspect_data → sci_plot_render with an explicit {kind,data,style,labels,options} spec.',
  'Iteration: keep the last figure id. To change only what the user named, read the saved spec with sci_plot_figures {action:"get", id}, edit those fields, re-render with parentId set to that id, and say in one sentence what changed. If the user wants the previous version back, call sci_plot_figures {action:"rewind", figureId}. Do not re-ask for data or switch kind unless asked.',
  'Intent → kind quick guide: differential expression → volcano; survival/time-to-event → km_survival; ROC/AUC → roc; spectroscopy → spectra; XRD → xrd; cyclic voltammetry → cv; TGA → tga; Bode/impedance → bode; learning curves → training_curves; time series → line/time_series; group comparison → box/violin/bar_grouped; two numbers → scatter/regression; matrix → heatmap/corr_heatmap; many numeric columns → corr_heatmap/pca; distributions → histogram/density.',
  'Style and quality: infer the discipline from the data and the words; journal defaults come from the plugin settings (Nature); SI units in labels; use Chinese labels only when the user writes Chinese or asks for them. Quality gate is ≥90 (grade A): if the returned gateMet is false, fix the listed issues or disclose the remaining ones explicitly — never quietly ship a low-quality figure.',
  'Presentation: the tool row carries an interactive inline figure card (image, size, dpi, quality badge, open image/panel), but process details can be folded — so also place the figure once in your reply as a Markdown image using the returned pngUrl, e.g. ![caption](/dsh-sci-plot/api/figures/<id>/file?format=png&variant=full), then one caption line (source, mapping or statistic) and one sentence with the finding or caveat. Do not paste spec JSON, parameter lists or a description of the tool call. The user can open the panel to refine or export manually; mention it only when relevant.',
  'Data: data.path accepts absolute CSV/TSV/JSON and XLSX (the first non-empty sheet; no extra library needed). For a consistent set, pass styleFrom:"<figure id>" to sci_plot_auto so every figure reuses the same domain/journal/palette/size.',
  'Delivery: sci_plot_export takes purpose:"submission"|"slides"|"web" (formats+dpi preset), reveal:true to open the folder, and returns absolute file paths; sci_plot_pack bundles several figures into one ZIP with a manifest. When the user says "以后默认 …" / "from now on use …", persist it with sci_plot_preferences {action:"set", settings:{…}} — never pretend the preference was saved.',
  'Panel handoff: the figure panel has a "在对话中继续 / Continue in chat" button that copies a prompt naming the figure id; when such a message arrives, read that figure with sci_plot_figures {action:"get"} and continue from its spec instead of starting over.',
].join(' ')

function resolveDataDir(config) {
  if (typeof config?.dataDir === 'string' && config.dataDir.trim().length > 0) return config.dataDir.trim()
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'sci-plot')
}

function createLog(ctx) {
  const write = (level, message) => {
    try {
      const logger = ctx?.logger
      if (typeof logger?.[level] === 'function') logger[level](`[dsh-sci-plot] ${message}`)
    } catch {
      /* logging never breaks activation */
    }
  }
  return {
    info: (message) => write('info', message),
    warn: (message) => write('warn', message),
  }
}

export function apply(ctx, rowConfig) {
  const log = createLog(ctx)
  const config = resolveConfig(rowConfig)
  const dataDir = resolveDataDir(config)
  const assetsDir = join(PLUGIN_ROOT, 'assets')
  let store
  let engine
  let service
  let panelDispose = null
  let disposed = false

  try {
    mkdirSync(dataDir, { recursive: true })
    store = new FigureStore({ dir: dataDir, maxFigures: config.maxFigures, log, assetsDir })
    engine = new PlotEngine({ config, log })
    service = new SciPlotService({ config, store, engine, log })
    void store
      .init()
      .then(() => engine.probe())
      .catch((error) => log.warn(`initialisation failed: ${messageOf(error)}`))
  } catch (error) {
    log.warn(`could not initialise the plugin; staying inert: ${messageOf(error)}`)
    return () => {}
  }

  // Agent tools.
  let registered = 0
  try {
    for (const definition of createTools({ service, log })) {
      try {
        ctx.effect(() => ctx.tools.register(definition), `dsh-sci-plot: ${definition.name}`)
        registered += 1
      } catch (error) {
        log.warn(`could not register ${definition.name}: ${messageOf(error)}`)
      }
    }
  } catch (error) {
    log.warn(`could not build the tool definitions: ${messageOf(error)}`)
  }

  // Discoverability prompt section (small, passive).
  try {
    if (typeof ctx.systemPrompt?.section === 'function') {
      ctx.effect(
        () =>
          ctx.systemPrompt.section({
            name: 'dsh-sci-plot',
            order: 9175,
            interpolate: false,
            text: () => PROMPT_SECTION,
          }),
        'dsh-sci-plot: prompt section',
      )
    }
  } catch (error) {
    log.warn(`could not register the prompt section: ${messageOf(error)}`)
  }

  // Panel routes (optional: headless profiles have no web server).
  try {
    panelDispose = registerPanel({ ctx, service, log })
  } catch (error) {
    log.warn(`could not register the panel routes: ${messageOf(error)}`)
  }

  log.info(`active: ${registered} tools, panel ${'/dsh-sci-plot'}, data ${dataDir}`)

  return () => {
    if (disposed) return
    disposed = true
    try {
      panelDispose?.()
    } catch {
      /* best effort */
    }
  }
}
