/**
 * Agent-facing tools of dsh-sci-plot.
 *
 * Workflow: sci_plot_capabilities → sci_plot_inspect_data → sci_plot_render →
 * sci_plot_export. Every tool validates its own arguments, never throws into
 * the model and returns a structured `{ok:false, code, error, repair}` failure
 * so the agent can recover without guessing.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { FIGURE_FORMATS, LIMITS, PLUGIN_NAME, VERSION } from './config.js'
import { autoRender } from './auto.js'
import { messageOf, truncateUtf8 } from './util.js'
import { writeZip } from './zip.js'

/** Export presets for the common delivery targets. */
const EXPORT_PURPOSES = {
  submission: { formats: ['png', 'pdf', 'tiff'], dpi: 600 },
  slides: { formats: ['png', 'pdf'], dpi: 300 },
  web: { formats: ['png', 'svg'], dpi: 150 },
}

/** Persisted defaults the agent may change on the user's behalf. */
const PREFERENCE_KEYS = ['defaultDomain', 'defaultJournal', 'defaultPalette', 'defaultFont', 'defaultSize', 'defaultDpi']

function safeSlug(value, fallback = 'figure') {
  const text = String(value || '')
    .replace(/[\\/:*?"<>|]+/gu, ' ')
    .replace(/\s+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48)
  return text || fallback
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-').slice(0, 19)
}

const OUTPUT = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => {
    const text = JSON.stringify(value ?? null)
    const bounded = truncateUtf8(text, LIMITS.toolContentBytes)
    return [{ type: 'text', text: bounded.truncated ? `${bounded.text}\n… output truncated` : bounded.text }]
  },
}

function repair(action, label, detail) {
  return { action, label, detail }
}

function failure(code, error, hint) {
  return { ok: false, code, error, repair: hint }
}

function codedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function repairForCode(code, detail) {
  switch (code) {
    case 'no_engine':
      return repair('install-python', 'Install Python with matplotlib', 'Install Python 3.11+ and run: python -m pip install numpy matplotlib scipy pillow. Then call sci_plot_doctor to confirm the engine is detected (or set pythonPath in the plugin config).')
    case 'unknown_kind':
      return repair('list-kinds', 'Pick a registered kind', detail || 'Call sci_plot_capabilities and use one of the returned kind ids.')
    case 'invalid_mapping':
    case 'invalid_data':
      return repair('fix-data', 'Fix the data mapping', detail || 'Check data.columns and data.mapping: every mapping value must name an existing column.')
    case 'invalid_input':
      return repair('fix-input', 'Fix the arguments', detail || 'Re-read the parameter descriptions and pass valid values.')
    case 'not_found':
      return repair('list-figures', 'Check the figure id', detail || 'Call sci_plot_figures with action:"list" to see saved figure ids.')
    case 'forbidden':
      return repair('choose-file', 'Use an allowed data file', detail || 'Panel previews are limited to the workspace; agent tools accept any absolute data path.')
    case 'timeout':
      return repair('retry', 'Retry with fewer points', 'Close other heavy Python work, or aggregate the data (e.g. fewer than 20k rows) and render again.')
    case 'too_large':
      return repair('reduce', 'Reduce the payload', 'Pass data.path (a CSV/TSV/JSON file) instead of inline rows, or slice the data.')
    case 'engine_crashed':
      return repair('doctor', 'Run diagnostics', 'Call sci_plot_doctor; the engine returned invalid output.')
    default:
      return repair('retry', 'Retry', 'If it keeps failing, call sci_plot_doctor and check the panel diagnostics.')
  }
}

const guarded = (name, handler) => async (args) => {
  try {
    return await handler(args && typeof args === 'object' ? args : {})
  } catch (error) {
    const code = error && typeof error.code === 'string' ? error.code : 'failed'
    return failure(code, messageOf(error), repairForCode(code, error && error.detail))
  }
}

function str(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/**
 * Keep agent payloads small (token discipline): a render record never needs the
 * inline data rows or the full quality checklist; iteration can reload the data
 * from the stored path instead.
 */
export function shrinkSpecForAgent(spec) {
  if (!spec || typeof spec !== 'object' || !spec.data || typeof spec.data !== 'object') return spec
  const rows = Array.isArray(spec.data.rows) ? spec.data.rows : null
  if (!rows || rows.length <= 20) return spec
  const out = JSON.parse(JSON.stringify(spec))
  const path = spec.data.meta && typeof spec.data.meta.path === 'string' ? spec.data.meta.path : ''
  if (path) {
    out.data = { path, mapping: spec.data.mapping || {} }
  } else {
    out.data = {
      columns: spec.data.columns,
      mapping: spec.data.mapping || {},
      rows: rows.slice(0, 5),
      note: `rows truncated from ${rows.length}; pass the original data.path for the full data`,
    }
  }
  return out
}

/** Compact quality for the model: score/grade + the warnings that need fixing. */
export function shrinkQualityForAgent(quality) {
  if (!quality || typeof quality !== 'object') return null
  const checks = Array.isArray(quality.checks) ? quality.checks : []
  return {
    score: quality.score,
    grade: quality.grade,
    counts: quality.counts || null,
    issues: checks
      .filter((check) => check && (check.status === 'warn' || check.status === 'fail'))
      .slice(0, 4)
      .map((check) => `${check.status}: ${check.message_zh || check.id}`),
  }
}

/** Agent-facing figure record: no inline rows, no full checklist, optional re-renderable spec. */
export function agentFigure(figure, { spec = false } = {}) {
  if (!figure) return null
  const out = { ...figure }
  delete out.spec
  out.quality = shrinkQualityForAgent(figure.quality)
  if (spec && figure.spec) out.spec = shrinkSpecForAgent(figure.spec)
  return out
}

/** Trim the capabilities payload for the model. */function summaryCapabilities(caps) {
  const kinds = []
  for (const group of caps.kinds || []) {
    for (const kind of group.kinds || []) {
      kinds.push({
        kind: kind.kind,
        name_zh: kind.name_zh,
        category: kind.category,
        summary_zh: kind.summary_zh,
        options: (kind.options || []).map((option) => option.id),
      })
    }
  }
  const domains = (caps.themes?.domains || []).map((domain) => ({
    id: domain.id,
    name_zh: domain.name_zh,
    recommended: domain.recommended,
  }))
  const journals = (caps.themes?.journals || []).map((journal) => ({
    id: journal.id,
    name_zh: journal.name_zh,
    widths: journal.widths,
  }))
  const palettes = (caps.palettes?.categorical || []).map((palette) => ({
    id: palette.id,
    name_zh: palette.name_zh,
    cvd_safe: palette.cvd_safe,
  }))
  const cmaps = (caps.palettes?.continuous || []).map((cmap) => ({ id: cmap.id, name_zh: cmap.name_zh, kind: cmap.kind }))
  const samples = (caps.samples || []).map((sample) => ({
    id: sample.id,
    name_zh: sample.name_zh,
    domain: sample.domain,
    rows: sample.rows,
    mapping: sample.mapping,
  }))
  return {
    ok: true,
    source: caps.source || 'engine',
    version: caps.version || VERSION,
    engine: { available: caps.source !== 'fallback', version: caps.engine?.version || VERSION },
    kinds,
    domains,
    journals,
    palettes,
    colormaps: cmaps,
    samples,
    spec: caps.spec,
    next: 'Pick a kind + domain/journal, then call sci_plot_inspect_data (optional) and sci_plot_render with a spec.',
  }
}

export function createTools({ service, log }) {
  const tools = []

  tools.push({
    name: 'sci_plot_capabilities',
    description: [
      'List the scientific plotting studio catalogue: 70+ chart kinds grouped by family, 12 discipline style presets, 16 journal style presets, colour-blind-safe palettes, colour maps and bundled sample datasets.',
      'Call this first whenever the user asks for a scientific/research figure, a publication-quality chart, or a domain-specific plot (life science, clinical, omics, chemistry, materials, physics, engineering, earth, economics, social science, ML, maths).',
      'detail:"full" additionally returns per-kind option schemas and sample mappings (larger). Pass domain to focus recommended kinds for one discipline.',
      'Next: sci_plot_inspect_data → sci_plot_render → sci_plot_export. The user can also open the Scientific plot panel to browse and tweak the same figures.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        detail: { type: 'string', enum: ['summary', 'full'], description: 'summary (default) or full catalogue with options/demos.' },
        domain: { type: 'string', description: 'Optional domain id to annotate which kinds that discipline recommends.' },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 60_000,
    isConcurrencySafe: () => true,
    execute: guarded('sci_plot_capabilities', async (args) => {
      const caps = await service.capabilities()
      const detail = str(args.detail) === 'full'
      if (!detail) {
        const result = summaryCapabilities(caps)
        if (str(args.domain)) {
          const domain = (caps.themes?.domains || []).find((item) => item.id === args.domain)
          result.domain = domain || null
        }
        return result
      }
      const payload = {
        ok: true,
        source: caps.source || 'engine',
        version: caps.version || VERSION,
        kinds: caps.kinds || [],
        themes: caps.themes || {},
        palettes: caps.palettes || {},
        samples: caps.samples || [],
        spec: caps.spec || {},
        quickstart: caps.quickstart || null,
        engine: { available: caps.source !== 'fallback', ...(caps.engine || {}) },
        next: 'Pick a kind + domain/journal, then call sci_plot_inspect_data (optional) and sci_plot_render with a spec.',
      }
      if (str(args.domain)) payload.domain = (caps.themes?.domains || []).find((item) => item.id === args.domain) || null
      return payload
    }),
  })

  tools.push({
    name: 'sci_plot_inspect_data',
    description: [
      'Profile a dataset and get chart recommendations before drawing.',
      'Accepts data.path (absolute CSV/TSV/JSON) or data.sample (a bundled dataset id from sci_plot_capabilities).',
      'Returns column types/statistics, a bounded preview, and ranked kind recommendations with mappings and a domain hint.',
      'Use it when the user brings a data file or asks "what chart fits this data". Next: sci_plot_render with data.path + mapping.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to a CSV, TSV or JSON data file.' },
        sample: { type: 'string', description: 'Bundled sample dataset id (e.g. "growth", "volcano_de").' },
        previewRows: { type: 'integer', description: 'Rows to preview (1–30, default 10).' },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 60_000,
    isConcurrencySafe: () => true,
    execute: guarded('sci_plot_inspect_data', async (args) => {
      if (!str(args.path) && !str(args.sample)) {
        return failure('invalid_input', 'pass path or sample', repair('list-samples', 'List bundled datasets', 'Call sci_plot_capabilities; its samples array contains ids and mappings.'))
      }
      return service.inspectData({
        path: str(args.path),
        sample: str(args.sample),
        previewRows: boundedNumber(args.previewRows, 10, 1, 30),
      })
    }),
  })

  tools.push({
    name: 'sci_plot_render',
    description: [
      'Render one publication-grade scientific figure from a JSON spec and save it to the figure gallery.',
      'Spec: { kind, data, style, labels, options, output }. data = { sample|path|series|rows+columns|matrix, mapping }; style = { domain, journal, palette, cmap, font, size("single"|"double"|... or width_mm), dpi, grid, legend, ... }; labels = { x, y, title, colorbar }.',
      'Returns the figure record (id, preview URL, absolute PNG path, measured size, quality checklist with score/grade, warnings).',
      'Use the bundled samples or the user data file; prefer a domain preset + journal preset so typography and palette follow real author guidelines. Next: sci_plot_export for SVG/PDF/TIFF, or iterate by rendering again.',
      'When this render continues an earlier figure, pass parentId (from sci_plot_figures get) so sci_plot_figures action:"rewind" can undo one step.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        spec: { type: 'object', additionalProperties: true, description: 'Figure spec: kind, data, style, labels, options, output.' },
        title: { type: 'string', description: 'Optional gallery title (defaults to labels.title or "kind · domain").' },
        parentId: { type: 'string', description: 'Optional id of the figure this render iterates from (enables rewind).' },
      },
      required: ['spec'],
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 180_000,
    isConcurrencySafe: () => false,
    execute: guarded('sci_plot_render', async (args) => {
      if (!args.spec || typeof args.spec !== 'object' || Array.isArray(args.spec)) {
        return failure('invalid_input', 'spec must be a JSON object', repair('fix-spec', 'Pass a complete spec', 'Minimum: {"kind":"line","data":{"sample":"growth"}}.'))
      }
      const figure = await service.render(args.spec, { allowAnyPath: true, title: str(args.title), parentId: str(args.parentId) || undefined })
      const pngPath = await service.figureFilePath(figure.id, 'png')
      return {
        ok: true,
        figure: agentFigure(figure),
        previewPath: pngPath,
        quality: shrinkQualityForAgent(figure.quality),
        next: `Figure saved. Open the Scientific plot panel (gallery), or call sci_plot_export with figureId:"${figure.id}" to write SVG/PDF/TIFF at a journal size. To iterate, call sci_plot_figures action:"get" for this id, edit the returned spec, and render again.`,
      }
    }),
  })

  tools.push({
    name: 'sci_plot_auto',
    description: [
      'One-shot autonomous scientific figure: pass the data and what the user wants, and this profiles the dataset, chooses the chart kind, mapping and discipline/journal style, renders it and runs the publication quality gate — one call instead of chaining capabilities → inspect → render.',
      'Use it by default for every figure request, including implicit ones ("look at this data", "make a figure for the paper/report").',
      'data: {path:"/abs/file.csv|tsv|json|xlsx"} or {sample:"bundled id"} (XLSX reads the first non-empty sheet). intent is the user\'s own wording (Chinese or English) and drives chart choice (volcano, survival, ROC, spectra, XRD, learning curves, time series, distributions, …).',
      'styleFrom: pass an earlier figure id to reuse its domain/journal/palette/font/size/dpi — use it to keep a multi-figure set consistent.',
      'Returns {figure, quality:{score,grade,gateMet,issues}, chosen:{kind,mapping,domain,journal,reason}, caption, alternatives}. When ok:false, fall back to sci_plot_inspect_data → sci_plot_render with an explicit spec.',
      'Iterate by reading the saved spec (sci_plot_figures action:"get") and changing only the requested fields, then sci_plot_render / sci_plot_export.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          additionalProperties: true,
          description: 'Data source: {"path":"/abs/data.csv|tsv|json|xlsx"} or {"sample":"bio_volcano_de"}.',
        },
        intent: { type: 'string', description: 'What the user wants to see, in their own words (drives kind + style).' },
        styleFrom: { type: 'string', description: 'Optional earlier figure id whose style is reused (consistent figure sets).' },
        kind: { type: 'string', description: 'Optional explicit kind id (e.g. volcano, km_survival, line) — overrides the automatic choice.' },
        mapping: { type: 'object', additionalProperties: true, description: 'Optional explicit column mapping for the file data.' },
        domain: { type: 'string', description: 'Optional discipline preset id (e.g. omics, clinical, chemistry, materials, engineering, ml, economics).' },
        journal: { type: 'string', description: 'Optional journal preset id (nature/science/cell/nejm/ieee/acs/rsc/aps/…).' },
        palette: { type: 'string', description: 'Optional categorical palette id.' },
        font: { type: 'string', description: 'Optional font family id.' },
        size: { type: 'string', description: 'Optional size preset (single, double, …) or a width in mm via widthMm in the manual tools.' },
        dpi: { type: 'integer', description: 'Optional raster resolution 72–1200 (default from plugin settings, 300).' },
        labels: { type: 'object', additionalProperties: true, description: 'Optional label overrides: {x, y, title, colorbar, legend}.' },
        options: { type: 'object', additionalProperties: true, description: 'Optional kind options merged over the defaults.' },
        qualityGate: { type: 'integer', description: 'Minimum quality score to accept (default 90; one repair retry if below).' },
        title: { type: 'string', description: 'Optional gallery title.' },
      },
      required: ['data'],
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 180_000,
    isConcurrencySafe: () => false,
    execute: guarded('sci_plot_auto', async (args) => autoRender({ service, input: args })),
  })

  tools.push({
    name: 'sci_plot_export',
    description: [
      'Re-render a saved figure at explicit export settings, return the final artifact paths and optionally reveal the folder.',
      'formats: png (always), svg, pdf (editable vector text), eps (Type 42), tiff (LZW, journal submissions), jpg.',
      'purpose is a delivery preset: submission → PNG+PDF+TIFF at 600 dpi; slides → PNG+PDF at 300 dpi; web → PNG+SVG at 150 dpi. Explicit formats/dpi override the preset.',
      'journal overrides the typography preset; widthMm sets a custom physical width; reveal:true opens the figure folder.',
      'Use it when the user needs a submission/slides/web file. Next: sci_plot_pack for several figures in one ZIP.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        figureId: { type: 'string', description: 'Figure id from sci_plot_render, sci_plot_auto or sci_plot_figures.' },
        purpose: { type: 'string', enum: ['submission', 'slides', 'web'], description: 'Delivery preset for formats + dpi.' },
        formats: { type: 'array', items: { type: 'string', enum: ['png', 'svg', 'pdf', 'eps', 'tiff', 'jpg'] }, description: 'Requested formats (PNG is always produced).' },
        dpi: { type: 'integer', description: 'Raster resolution 72–1200.' },
        widthMm: { type: 'number', description: 'Physical width in millimetres (20–600).' },
        journal: { type: 'string', description: 'Journal preset id, e.g. nature/science/cell/nejm/ieee/acs/rsc/aps/agu/elsevier/springer/apa/neurips.' },
        palette: { type: 'string', description: 'Categorical palette id override.' },
        reveal: { type: 'boolean', description: 'Open the figure folder after exporting.' },
      },
      required: ['figureId'],
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 180_000,
    isConcurrencySafe: () => false,
    execute: guarded('sci_plot_export', async (args) => {
      const figureId = str(args.figureId)
      if (!figureId) return failure('invalid_input', 'figureId is required', repairForCode('invalid_input'))
      const purpose = str(args.purpose)
      const preset = EXPORT_PURPOSES[purpose] || null
      if (purpose && !preset) return failure('invalid_input', `unknown purpose: ${purpose}`, repair('choose-purpose', 'Use a delivery preset', 'purpose must be submission, slides or web — or pass formats/dpi explicitly.'))
      const figure = await service.exportFigure(figureId, {
        formats: Array.isArray(args.formats) ? args.formats : preset ? preset.formats : undefined,
        dpi: Number.isFinite(Number(args.dpi)) ? boundedNumber(args.dpi, undefined, 72, 1200) : preset ? preset.dpi : undefined,
        widthMm: Number.isFinite(Number(args.widthMm)) ? Number(args.widthMm) : undefined,
        journal: str(args.journal),
        palette: str(args.palette),
      })
      const files = {}
      for (const format of figure.formats || []) {
        const filePath = await service.figureFilePath(figure.id, format)
        if (filePath) files[format] = filePath
      }
      let revealed = false
      let folder = null
      if (args.reveal === true) {
        const info = await service.revealFigure(figure.id).catch(() => null)
        revealed = Boolean(info && info.revealed)
        folder = info ? info.path : null
      }
      return {
        ok: true,
        figure: agentFigure(figure),
        files,
        folder,
        revealed,
        next: `Exported ${Object.keys(files).join('/') || 'files'}. Give the user the absolute paths; for several figures use sci_plot_pack to build one ZIP.`,
      }
    }),
  })

  tools.push({
    name: 'sci_plot_figures',
    description: [
      'List, inspect, rewind or delete saved figures from the scientific plotting gallery.',
      'action:"list" returns recent figures (id, kind, domain, journal, size, quality, parentId); action:"get" returns the record plus the reusable spec; action:"rewind" moves back to the previous version of a figure (its parentId, else the previous figure of the same kind); action:"delete" removes the figure and its files.',
      'Use it to continue tweaking an earlier figure: get its spec, edit labels/style/options, then sci_plot_render again with parentId set to that id.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'rewind', 'delete'], description: 'What to do (default list).' },
        figureId: { type: 'string', description: 'Figure id for get/rewind/delete.' },
        limit: { type: 'integer', description: 'Max figures for list (1–60, default 20).' },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 60_000,
    isConcurrencySafe: () => true,
    execute: guarded('sci_plot_figures', async (args) => {
      const action = str(args.action) || 'list'
      if (action === 'list') {
        const figures = await service.listFigures(boundedNumber(args.limit, 20, 1, 60))
        return {
          ok: true,
          action,
          count: figures.length,
          figures: figures.map((figure) => ({
            id: figure.id,
            title: figure.title,
            kind: figure.kind,
            kindNameZh: figure.kindNameZh,
            domain: figure.domain,
            journal: figure.journal,
            widthMm: figure.widthMm,
            heightMm: figure.heightMm,
            dpi: figure.dpi,
            formats: figure.formats,
            quality: figure.quality ? { score: figure.quality.score, grade: figure.quality.grade } : null,
            parentId: figure.parentId || null,
            createdAt: figure.createdAt,
          })),
          next: 'Use action:"get" with an id to read its spec, or check the panel gallery.',
        }
      }
      const figureId = str(args.figureId)
      if (!figureId) return failure('invalid_input', `figureId is required for action:"${action}"`, repairForCode('invalid_input'))
      if (action === 'delete') {
        const result = await service.deleteFigure(figureId)
        return { ok: true, action, figureId, deleted: result.deleted === true, next: 'The figure and its files are gone. Call action:"list" to see the remaining figures.' }
      }
      if (action === 'rewind') {
        const figure = await service.getFigure(figureId, { detail: true })
        if (!figure) return failure('not_found', `figure not found: ${figureId}`, repairForCode('not_found'))
        let target = figure.parentId ? await service.getFigure(figure.parentId, { detail: true }) : null
        if (!target) {
          const recent = await service.listFigures(60)
          const index = recent.findIndex((item) => item.id === figureId)
          const older = index >= 0 ? recent.slice(index + 1) : recent
          const sameKind = older.find((item) => item.kind === figure.kind)
          const candidate = sameKind || older[0] || null
          if (candidate) target = await service.getFigure(candidate.id, { detail: true })
        }
        if (!target) return failure('not_found', 'there is no earlier figure to rewind to', repair('list-figures', 'List saved figures', 'This is the first saved figure; ask the user what to change instead of rewinding.'))
        return {
          ok: true,
          action,
          from: figureId,
          figure: agentFigure(target, { spec: true }),
          next: 'This is the previous version. To continue from it, edit its spec and call sci_plot_render with parentId set to this id.',
        }
      }
      const figure = await service.getFigure(figureId, { detail: true })
      if (!figure) return failure('not_found', `figure not found: ${figureId}`, repairForCode('not_found'))
      return {
        ok: true,
        action,
        figure: agentFigure(figure, { spec: true }),
        next: 'Edit style/labels/options in the returned spec, then call sci_plot_render with it again (data.path is reloaded by the Host) and pass parentId:' + figureId + ' to keep rewind working.',
      }
    }),
  })

  tools.push({
    name: 'sci_plot_preferences',
    description: [
      'Read or change the persistent plotting defaults shared by every render and by the panel.',
      'Use action:"set" when the user says "以后默认 IEEE 双栏 600dpi" / "from now on use Nature double column": pass only the fields that change, e.g. {"settings":{"defaultJournal":"ieee","defaultSize":"double","defaultDpi":600}}.',
      'action:"get" returns the current defaults; action:"reset" restores the plugin defaults. Saved values apply to new renders immediately (the panel reads the same settings).',
      'Keys: defaultDomain, defaultJournal, defaultPalette, defaultFont, defaultSize, defaultDpi.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'reset'], description: 'What to do (default get).' },
        settings: { type: 'object', additionalProperties: true, description: 'For set: partial defaults to persist.' },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    execute: guarded('sci_plot_preferences', async (args) => {
      const action = str(args.action) || 'get'
      if (action === 'get') {
        return { ok: true, action, settings: await service.settings(), next: 'Defaults apply to new renders and to the panel.' }
      }
      if (action === 'reset') {
        const defaults = service.defaultSettings()
        const patch = {}
        for (const key of PREFERENCE_KEYS) patch[key] = defaults[key]
        const settings = await service.saveSettings(patch)
        return { ok: true, action, settings, next: 'Defaults restored from the plugin configuration.' }
      }
      if (action !== 'set') return failure('invalid_input', `unknown action: ${action}`, repair('fix-input', 'Use get, set or reset', 'action must be get, set or reset.'))
      const input = args.settings && typeof args.settings === 'object' && !Array.isArray(args.settings) ? args.settings : null
      if (!input) return failure('invalid_input', 'settings object is required for action:"set"', repair('fix-input', 'Pass the defaults to change', 'Example: {"action":"set","settings":{"defaultJournal":"ieee","defaultSize":"double","defaultDpi":600}}.'))
      const patch = {}
      const ignored = []
      for (const [key, value] of Object.entries(input)) {
        if (!PREFERENCE_KEYS.includes(key)) {
          ignored.push(key)
          continue
        }
        if (key === 'defaultDpi') {
          const number = Number(value)
          if (!Number.isFinite(number)) return failure('invalid_input', 'defaultDpi must be a number', repairForCode('invalid_input', 'defaultDpi is between 72 and 1200.'))
          patch[key] = Math.min(1200, Math.max(72, Math.round(number)))
          continue
        }
        if (typeof value !== 'string' || value.trim().length === 0) return failure('invalid_input', `${key} must be a non-empty string`, repairForCode('invalid_input', `Pass a preset id for ${key}, e.g. "nature", "double", "okabe-ito".`))
        patch[key] = value.trim()
      }
      if (Object.keys(patch).length === 0) return failure('invalid_input', 'no valid preference keys were supplied', repair('fix-input', 'Use the documented keys', `Valid keys: ${PREFERENCE_KEYS.join(', ')}.`))
      const settings = await service.saveSettings(patch)
      const result = {
        ok: true,
        action: 'set',
        changed: patch,
        settings,
        next: 'Saved. New renders use these defaults; the panel shows the same settings.',
      }
      if (ignored.length > 0) result.ignored = ignored
      return result
    }),
  })

  tools.push({
    name: 'sci_plot_pack',
    description: [
      'Bundle several saved figures into one ZIP for delivery (paper figure set, report appendix, slide pack).',
      'Select explicit figureIds, or pass recent:N for the N newest figures. formats default to png+pdf; include submission formats by passing formats:["png","pdf","tiff"].',
      'Writes figures/<title>-<id>.<fmt> plus manifest.json and README.txt, returns the absolute ZIP path and file count. Use it after several sci_plot_auto / sci_plot_render calls.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        figureIds: { type: 'array', items: { type: 'string' }, description: 'Figure ids to include (any order).' },
        recent: { type: 'integer', description: 'Include the N newest figures when figureIds is omitted (1–40, default 3).' },
        formats: { type: 'array', items: { type: 'string', enum: ['png', 'svg', 'pdf', 'eps', 'tiff', 'jpg'] }, description: 'Formats to pack (default: png, pdf).' },
        name: { type: 'string', description: 'Base name for the ZIP file (default sci-plot-pack).' },
        outputPath: { type: 'string', description: 'Optional absolute ZIP path; defaults to <data dir>/exports/.' },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    timeoutMs: 120_000,
    isConcurrencySafe: () => false,
    execute: guarded('sci_plot_pack', async (args) => {
      const requested = Array.isArray(args.figureIds) ? args.figureIds.map((item) => str(item)).filter(Boolean) : []
      let ids = requested
      if (ids.length === 0) {
        const recent = boundedNumber(args.recent, 3, 1, 40)
        const list = await service.listFigures(recent)
        ids = list.map((item) => item.id).reverse()
      }
      if (ids.length === 0) return failure('not_found', 'no saved figures to pack', 'Render at least one figure first (sci_plot_auto or sci_plot_render).')
      const wanted = Array.isArray(args.formats) ? args.formats : ['png', 'pdf']
      const formats = []
      for (const value of wanted) {
        const format = String(value || '').toLowerCase()
        if (FIGURE_FORMATS.includes(format) && !formats.includes(format)) formats.push(format)
      }
      if (formats.length === 0) formats.push('png', 'pdf')
      if (!formats.includes('png')) formats.unshift('png')
      const entries = []
      const manifest = { createdAt: new Date().toISOString(), plugin: PLUGIN_NAME, version: VERSION, formats, figures: [] }
      for (const id of ids) {
        const figure = await service.getFigure(id, { detail: false })
        if (!figure) continue
        const files = []
        for (const format of formats) {
          const filePath = await service.figureFilePath(id, format)
          if (!filePath || !existsSync(filePath)) continue
          const data = readFileSync(filePath)
          const entryName = `figures/${safeSlug(figure.title || id)}-${id}.${format}`
          entries.push({ name: entryName, data })
          files.push({ format, entry: entryName, bytes: data.length })
        }
        if (files.length === 0) continue
        manifest.figures.push({
          id,
          title: figure.title,
          kind: figure.kind,
          domain: figure.domain,
          journal: figure.journal,
          widthMm: figure.widthMm,
          dpi: figure.dpi,
          quality: figure.quality ? { score: figure.quality.score, grade: figure.quality.grade } : null,
          files,
        })
      }
      if (entries.length === 0) {
        return failure('not_found', 'none of the selected figures has a file in the requested formats', 'Render or export the figures first, or request PNG (always produced).')
      }
      const name = safeSlug(str(args.name) || 'sci-plot-pack')
      const outputPath = str(args.outputPath) || join(service.store.dir, 'exports', `${name}-${stamp()}.zip`)
      mkdirSync(dirname(outputPath), { recursive: true })
      entries.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) })
      entries.push({ name: 'README.txt', data: `Scientific Plot delivery pack\nCreated: ${manifest.createdAt}\nFigures: ${manifest.figures.length}\nFormats: ${formats.join(', ')}\n\nSee manifest.json for per-figure metadata and quality scores.\n` })
      const info = writeZip(outputPath, entries)
      return {
        ok: true,
        pack: { path: outputPath, bytes: info.bytes, figures: manifest.figures.length, files: entries.length, formats },
        next: `Give the user the absolute ZIP path (${outputPath}) and mention the figure count; the archive contains manifest.json with quality scores.`,
      }
    }),
  })

  tools.push({
    name: 'sci_plot_doctor',
    description: [
      'Diagnose the plotting engine: Python interpreter, matplotlib/numpy/scipy versions, CJK font support, figure store and plugin paths.',
      'Call it when a render fails with no_engine/engine_crashed, when Chinese labels render as boxes, or when the user asks whether the plugin is ready.',
      'Returns concrete repair steps when the engine is unavailable.',
    ].join(' '),
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: OUTPUT,
    timeoutMs: 60_000,
    isConcurrencySafe: () => true,
    execute: guarded('sci_plot_doctor', async () => service.diagnostics()),
  })

  return tools
}
