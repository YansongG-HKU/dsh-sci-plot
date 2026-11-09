/**
 * Host service: one place that owns the figure lifecycle, dataset access and
 * engine state. Both the agent tools and the panel routes call these methods.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ENGINE_DIR, codedError } from './engine.js'
import { FIGURE_FORMATS, LIMITS, PLUGIN_NAME, ROUTE_PREFIX, VERSION } from './config.js'
import { discoverDatasets, isInside, loadDatasetFile, makeDatasetId, profileRows, quickInspect, recommend } from './data.js'
import { isLegacyXlsFile, isXlsxFile, readXlsx } from './xlsx.js'
import { messageOf, newId, nowIso } from './util.js'

const DEFAULT_FORMATS = ['png', 'svg', 'pdf']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeFormats(value, fallback = DEFAULT_FORMATS) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const formats = []
  for (const item of list) {
    const format = String(item || '').trim().toLowerCase()
    if (FIGURE_FORMATS.includes(format) && !formats.includes(format)) formats.push(format)
  }
  if (formats.length === 0) return [...fallback]
  if (!formats.includes('png')) formats.unshift('png')
  return formats
}

function filesRelative(resultFiles, dir) {
  const out = {}
  for (const [key, value] of Object.entries(resultFiles || {})) {
    const name = basename(String(value || ''))
    if (!name || name.includes('..')) continue
    if (!existsSync(join(dir, name))) continue
    out[key] = name
  }
  if (out.png && !out.thumb) out.thumb = out.png
  return out
}

export class SciPlotService {
  constructor({ config, store, engine, log }) {
    this.config = config
    this.store = store
    this.engine = engine
    this.log = log
    this.datasetCache = null
    this.domainNames = new Map()
  }

  get workspaceDir() {
    return this.config.workspaceDir || process.cwd()
  }

  // ------------------------------------------------------------------
  // Capabilities / settings / state
  // ------------------------------------------------------------------
  async capabilities(force = false) {
    const payload = await this.engine.capabilities(force)
    try {
      for (const domain of payload?.themes?.domains || []) {
        if (domain?.id) this.domainNames.set(domain.id, domain.name_zh || domain.name_en || domain.id)
      }
    } catch {
      /* ignore */
    }
    return payload
  }

  domainName(id) {
    return this.domainNames.get(String(id || '')) || String(id || '')
  }

  async settings() {
    return this.store.getSettings(this.defaultSettings())
  }

  defaultSettings() {
    return {
      defaultDomain: this.config.defaultDomain,
      defaultJournal: this.config.defaultJournal,
      defaultPalette: this.config.defaultPalette,
      defaultFont: this.config.defaultFont,
      defaultSize: this.config.defaultSize,
      defaultDpi: this.config.defaultDpi,
      lang: 'zh',
    }
  }

  async saveSettings(patch) {
    return this.store.saveSettings(patch, this.defaultSettings())
  }

  async engineStatus(refresh = false) {
    if (refresh) await this.engine.probe(true)
    else await this.engine.probe()
    return this.engine.status()
  }

  async getState() {
    await this.store.init()
    const [settings, capabilities, datasets, gallery] = await Promise.all([
      this.settings().catch(() => this.defaultSettings()),
      this.capabilities().catch((error) => ({ error: messageOf(error), kinds: [], themes: { domains: [], journals: [], sizes: [], fonts: [] }, palettes: { categorical: [], continuous: [] }, samples: [] })),
      this.datasets().catch(() => ({ samples: [], workspace: [] })),
      this.gallery().catch(() => []),
    ])
    const figures = await this.store.listFigures(60)
    return {
      figures: figures.map((item) => this.figureRecord(item)),
      capabilities,
      datasets,
      settings,
      engine: this.engine.status(),
      gallery,
      paths: { dataDir: this.store.dir, galleryDir: this.store.galleryDir, engineDir: ENGINE_DIR },
      version: VERSION,
    }
  }

  // ------------------------------------------------------------------
  // Datasets
  // ------------------------------------------------------------------
  async datasets(refresh = false) {
    if (!refresh && this.datasetCache && Date.now() - this.datasetCache.at < 60_000) return this.datasetCache.value
    const capabilities = await this.capabilities().catch(() => null)
    const samples = Array.isArray(capabilities?.samples) ? capabilities.samples : []
    let workspace = []
    try {
      workspace = discoverDatasets(this.workspaceDir, { budget: 240 }).map((item) => ({ ...item, id: makeDatasetId(item.path) }))
    } catch (error) {
      this.log?.warn?.(`workspace dataset scan failed: ${messageOf(error)}`)
    }
    const value = { samples, workspace }
    this.datasetCache = { at: Date.now(), value }
    return value
  }

  /**
   * Load a table from CSV/TSV/JSON (sync parser) or the first non-empty sheet of
   * an XLSX workbook (built-in OOXML reader). Legacy .xls gets a repair hint.
   */
  async loadTable(target) {
    const path = String(target || '').trim()
    if (isLegacyXlsFile(path)) {
      throw codedError('invalid_data', 'legacy .xls is not supported', 'Open the workbook in Excel/LibreOffice and save it as .xlsx (or CSV), then retry.')
    }
    if (isXlsxFile(path)) {
      let parsed
      try {
        parsed = readXlsx(path)
      } catch (error) {
        throw codedError('invalid_data', `could not read the xlsx workbook: ${messageOf(error)}`, 'Check that it is a valid, unprotected .xlsx file with a header row on the first sheet.')
      }
      if (parsed.rows.length === 0) {
        throw codedError('invalid_data', `sheet "${parsed.sheet || 'Sheet1'}" has no data rows`, 'Check that the first sheet has a header row and at least one data row, or save it as CSV.')
      }
      return { path, columns: parsed.columns, rows: parsed.rows, size: statSync(path).size, sheet: parsed.sheet, sheets: parsed.sheets }
    }
    return loadDatasetFile(path)
  }

  async previewDataset({ path, sample } = {}) {
    if (typeof sample === 'string' && sample.trim().length > 0) {
      const payload = await this.engine.sampleInfo(sample.trim())
      const preview = payload.preview || {}
      return {
        source: 'sample',
        sample: payload.sample || null,
        columns: Array.isArray(preview.columns) ? preview.columns.map((name) => ({ name, kind: 'unknown' })) : [],
        rows: Array.isArray(preview.rows) ? preview.rows : [],
        total: Number(preview.total) || 0,
        profile: [],
        recommendations: Array.isArray(payload.sample?.recommended) ? payload.sample.recommended : [],
      }
    }
    const target = String(path || '').trim()
    if (target.length === 0) throw codedError('invalid_input', 'pass a workspace data path or a sample id')
    this.assertDatasetPath(target, { allowAny: false })
    const dataset = await this.loadTable(target)
    const profile = profileRows(dataset.columns, dataset.rows)
    return {
      source: 'file',
      path: dataset.path,
      name: basename(dataset.path),
      size: dataset.size,
      columns: profile.columns,
      rows: dataset.rows.slice(0, 12),
      total: dataset.rows.length,
      profile: profile.columns,
      recommendations: recommend(profile),
    }
  }

  async inspectData({ path, sample, previewRows = 10 } = {}) {
    if (typeof sample === 'string' && sample.trim().length > 0) {
      const sampleId = sample.trim()
      const payload = await this.engine.sampleInfo(sampleId)
      const sampleMeta = payload.sample || {}
      return {
        ok: true,
        source: 'sample',
        sample: sampleId,
        name_zh: sampleMeta.name_zh || '',
        name_en: sampleMeta.name_en || '',
        domain: sampleMeta.domain || '',
        description_zh: sampleMeta.description_zh || '',
        description_en: sampleMeta.description_en || '',
        mapping: sampleMeta.mapping || {},
        recommended: sampleMeta.recommended || [],
        columns: sampleMeta.columns || [],
        rows: Number(sampleMeta.rows) || 0,
        preview: (payload.preview?.rows || []).slice(0, Math.max(1, Number(previewRows) || 10)),
      }
    }
    const target = String(path || '').trim()
    if (target.length === 0) {
      return {
        ok: false,
        code: 'invalid_input',
        error: 'pass data.path (a CSV/TSV/JSON file) or data.sample (an id from sci_plot_capabilities)',
        next: 'Call sci_plot_capabilities first; it lists the bundled sample datasets and their mappings.',
      }
    }
    this.assertDatasetPath(target, { allowAny: true })
    const dataset = await this.loadTable(target)
    const profile = profileRows(dataset.columns, dataset.rows)
    const recommendations = recommend(profile)
    return {
      ok: true,
      source: 'file',
      path: dataset.path,
      name: basename(dataset.path),
      rows: dataset.rows.length,
      columns: profile.columns,
      preview: dataset.rows.slice(0, Math.max(1, Number(previewRows) || 10)),
      recommendations,
      next: 'Pick one recommendation, call sci_plot_render with data.path + mapping, then sci_plot_export for vector formats.',
    }
  }

  assertDatasetPath(path, { allowAny }) {
    if (allowAny) return
    const roots = [this.workspaceDir, this.store.dir]
    if (!roots.some((root) => isInside(root, path))) {
      throw codedError('forbidden', 'panel data preview is limited to the workspace and the plugin data directory', 'List datasets with /api/datasets, or use the agent tools for arbitrary files.')
    }
  }

  // ------------------------------------------------------------------
  // Spec preparation and rendering
  // ------------------------------------------------------------------
  async prepareSpec(rawSpec, { allowAnyPath = false } = {}) {
    if (!isPlainObject(rawSpec)) throw codedError('invalid_input', 'the figure spec must be a JSON object')
    const kind = typeof rawSpec.kind === 'string' ? rawSpec.kind.trim().toLowerCase() : ''
    if (!kind) throw codedError('invalid_input', 'the spec needs a "kind", e.g. "line" or "bar"')
    if (!isPlainObject(rawSpec.data)) throw codedError('invalid_input', 'the spec needs a "data" object (sample, path, series, rows or matrix)')
    const settings = await this.settings()
    const spec = clone(rawSpec)
    const style = isPlainObject(spec.style) ? spec.style : {}
    // Fill defaults only where the caller left the field out.
    const merged = {
      domain: settings.defaultDomain,
      journal: settings.defaultJournal,
      palette: settings.defaultPalette,
      font: settings.defaultFont,
      size: settings.defaultSize,
      dpi: settings.defaultDpi,
      ...style,
    }
    if (Object.prototype.hasOwnProperty.call(style, 'journal') && (style.journal === null || style.journal === '')) delete merged.journal
    spec.style = merged
    spec.kind = kind
    spec.output = isPlainObject(spec.output) ? spec.output : {}
    spec.output.formats = normalizeFormats(spec.output.formats, DEFAULT_FORMATS)
    spec.output.basename = 'figure'
    spec.labels = isPlainObject(spec.labels) ? spec.labels : {}

    // Resolve data.path on the Host side (panel never ships thousands of rows).
    const data = spec.data
    if (typeof data.sample === 'string' && data.sample.trim().length > 0) {
      spec.data = { sample: data.sample.trim(), mapping: isPlainObject(data.mapping) ? data.mapping : {} }
    } else if (typeof data.path === 'string' && data.path.trim().length > 0) {
      const target = data.path.trim()
      this.assertDatasetPath(target, { allowAny: allowAnyPath })
      const dataset = await this.loadTable(target)
      if (dataset.rows.length > LIMITS.maxDataRows) {
        throw codedError('invalid_input', `dataset has ${dataset.rows.length} rows; the limit is ${LIMITS.maxDataRows}. Aggregate or slice the data first.`)
      }
      spec.data = {
        rows: dataset.rows,
        columns: dataset.columns,
        mapping: isPlainObject(data.mapping) ? data.mapping : {},
        meta: { path: target, name: basename(target) },
      }
    } else if (Array.isArray(data.series) || Array.isArray(data.rows) || Array.isArray(data.matrix) || isPlainObject(data.columns)) {
      spec.data = clone(data)
    } else {
      throw codedError('invalid_data', 'data must contain one of: sample, path, series, rows+columns, or matrix')
    }

    const serialised = JSON.stringify(spec)
    if (serialised.length > LIMITS.maxBodyBytes * 2) {
      throw codedError('too_large', 'the figure spec is too large; reduce the number of rows or pass data.path instead')
    }
    const title = String(spec.labels.title || spec.title || '').trim()
    return { spec, title, domain: merged.domain, journal: merged.journal || null }
  }

  async render(rawSpec, { allowAnyPath = false, title, parentId } = {}) {
    const prepared = await this.prepareSpec(rawSpec, { allowAnyPath })
    const id = newId('fig')
    const dir = this.store.figureDir(id)
    mkdirSync(dir, { recursive: true })
    let result
    try {
      result = await this.engine.render(prepared.spec, dir)
    } catch (error) {
      // A failed render leaves only a temporary directory: clean it up.
      try {
        const { rmSync } = await import('node:fs')
        rmSync(dir, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
      throw error
    }
    const files = filesRelative(result.files, dir)
    if (!files.png) throw codedError('render_failed', 'the engine did not produce a PNG preview')
    const meta = {
      id,
      createdAt: nowIso(),
      parentId: typeof parentId === 'string' && parentId.trim().length > 0 ? parentId.trim() : null,
      title: String(title || prepared.title || '').trim() || `${result.name_zh || result.kind} · ${this.domainName(result.style?.domain)}`,
      kind: result.kind,
      kindNameZh: result.name_zh || '',
      kindNameEn: result.name_en || '',
      category: result.category || '',
      domain: result.style?.domain || prepared.domain,
      domainNameZh: this.domainName(result.style?.domain || prepared.domain),
      journal: result.style?.journal || null,
      palette: result.style?.palette || '',
      font: result.style?.font || '',
      size: result.style?.size || '',
      widthMm: result.width_mm || 0,
      heightMm: result.height_mm || 0,
      widthPx: result.width_px || 0,
      heightPx: result.height_px || 0,
      dpi: result.dpi || 300,
      formats: Array.isArray(result.formats) ? result.formats : ['png'],
      files,
      quality: result.quality || null,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      durationMs: result.duration_ms || 0,
      spec: prepared.spec,
    }
    await this.store.addFigure(meta)
    return this.figureRecord(meta, { detail: true })
  }

  async exportFigure(id, options = {}) {
    const figure = await this.store.getFigure(id)
    if (!figure) throw codedError('not_found', `figure not found: ${id}`)
    const spec = clone(figure.spec || {})
    if (!isPlainObject(spec) || typeof spec.kind !== 'string') throw codedError('render_failed', 'the stored figure has no reusable spec')
    spec.style = isPlainObject(spec.style) ? spec.style : {}
    spec.output = isPlainObject(spec.output) ? spec.output : {}
    if (Array.isArray(options.formats) || typeof options.formats === 'string') {
      spec.output.formats = normalizeFormats(options.formats, spec.output.formats || DEFAULT_FORMATS)
    }
    if (Number.isFinite(Number(options.dpi))) spec.style.dpi = Math.min(1200, Math.max(72, Math.round(Number(options.dpi))))
    if (Number.isFinite(Number(options.widthMm))) spec.style.width_mm = Math.min(600, Math.max(20, Number(options.widthMm)))
    if (typeof options.journal === 'string' && options.journal.trim().length > 0) spec.style.journal = options.journal.trim()
    if (typeof options.palette === 'string' && options.palette.trim().length > 0) spec.style.palette = options.palette.trim()
    spec.output.basename = 'figure'
    const dir = this.store.figureDir(figure.id)
    const result = await this.engine.render(spec, dir)
    const files = filesRelative(result.files, dir)
    const patch = {
      files: { ...(figure.files || {}), ...files },
      formats: Array.isArray(result.formats) ? result.formats : figure.formats,
      widthMm: result.width_mm || figure.widthMm,
      heightMm: result.height_mm || figure.heightMm,
      widthPx: result.width_px || figure.widthPx,
      heightPx: result.height_px || figure.heightPx,
      dpi: result.dpi || figure.dpi,
      quality: result.quality || figure.quality,
      warnings: Array.isArray(result.warnings) ? result.warnings : figure.warnings,
      durationMs: result.duration_ms || figure.durationMs,
      spec,
    }
    const updated = await this.store.updateFigure(figure.id, patch)
    return this.figureRecord(updated || { ...figure, ...patch }, { detail: true })
  }

  async listFigures(limit = 60) {
    const figures = await this.store.listFigures(limit)
    return figures.map((item) => this.figureRecord(item))
  }

  /** Absolute path of one figure artifact (used by agent tools for previews). */
  async figureFilePath(id, format = 'png', variant = 'full') {
    const file = await this.store.figureFile(id, format, variant)
    return file ? file.path : null
  }

  /** Validate a spec without drawing (returns style, data summary, issues). */
  async validateSpec(rawSpec) {
    const prepared = await this.prepareSpec(rawSpec, { allowAnyPath: false })
    const result = await this.engine.validate(prepared.spec)
    return {
      ok: true,
      kind: result.kind,
      style: result.style,
      data: result.data,
      issues: Array.isArray(result.issues) ? result.issues : [],
      options: result.options || [],
    }
  }

  async getFigure(id, { detail = true } = {}) {
    const figure = await this.store.getFigure(id)
    if (!figure) return null
    return this.figureRecord(figure, { detail })
  }

  async deleteFigure(id) {
    const deleted = await this.store.deleteFigure(id)
    if (!deleted) throw codedError('not_found', `figure not found: ${id}`)
    return { deleted: true, id }
  }

  async revealFigure(id) {
    const figure = await this.store.getFigure(id)
    if (!figure) throw codedError('not_found', `figure not found: ${id}`)
    const target = this.store.figureDir(figure.id)
    const png = this.store.figureFile ? await this.store.figureFile(figure.id, 'png', 'full') : null
    return { revealed: await revealPath(target, png?.path), path: target }
  }

  async revealDataDir() {
    return { revealed: await revealPath(this.store.dir), path: this.store.dir }
  }

  async gallery() {
    return this.store.galleryManifest().map((item) => ({
      id: item.id || item.file,
      titleZh: item.titleZh || item.title_zh || '',
      titleEn: item.titleEn || item.title_en || '',
      kind: item.kind || '',
      domain: item.domain || '',
      journal: item.journal || '',
      widthMm: item.widthMm || 0,
      heightMm: item.heightMm || 0,
      quality: item.quality || null,
      url: `${ROUTE_PREFIX}/api/assets/gallery/${encodeURIComponent(item.file)}`,
    }))
  }

  async diagnostics() {
    await this.store.init()
    const status = await this.engineStatus(false)
    const stats = await this.store.stats()
    return {
      plugin: PLUGIN_NAME,
      version: VERSION,
      engine: status,
      store: { dataDir: this.store.dir, figureCount: stats.count, bytes: stats.bytes, galleryDir: this.store.galleryDir },
      config: {
        workspaceDir: this.workspaceDir,
        dataDir: this.config.dataDir || '',
        pythonPath: this.config.pythonPath || '',
        defaults: this.defaultSettings(),
      },
      engineDir: ENGINE_DIR,
      next: status.available
        ? 'Engine ready. Render with sci_plot_render.'
        : 'Python with matplotlib is required. Install Python 3.11+, then run pip install numpy matplotlib scipy pillow; set config.pythonPath if it is not on PATH.',
    }
  }

  // ------------------------------------------------------------------
  // Figure records for API/tools
  // ------------------------------------------------------------------
  figureRecord(meta, { detail = false } = {}) {
    const id = String(meta.id || '')
    const base = {
      id,
      title: meta.title || '',
      kind: meta.kind || '',
      kindNameZh: meta.kindNameZh || '',
      kindNameEn: meta.kindNameEn || '',
      category: meta.category || '',
      domain: meta.domain || '',
      domainNameZh: meta.domainNameZh || this.domainName(meta.domain),
      journal: meta.journal || null,
      palette: meta.palette || '',
      font: meta.font || '',
      size: meta.size || '',
      widthMm: meta.widthMm || 0,
      heightMm: meta.heightMm || 0,
      widthPx: meta.widthPx || 0,
      heightPx: meta.heightPx || 0,
      dpi: meta.dpi || 300,
      formats: Array.isArray(meta.formats) ? meta.formats : [],
      createdAt: meta.createdAt || '',
      quality: meta.quality || null,
      warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
      pngUrl: `${ROUTE_PREFIX}/api/figures/${encodeURIComponent(id)}/file?format=png&variant=full`,
      thumbUrl: `${ROUTE_PREFIX}/api/figures/${encodeURIComponent(id)}/file?format=png&variant=thumb`,
      durationMs: meta.durationMs || 0,
      parentId: meta.parentId || null,
    }
    if (detail) base.spec = meta.spec || null
    return base
  }
}

function revealPath(target, selectPath) {
  return new Promise((resolve) => {
    try {
      const platform = process.platform
      let command
      let args
      if (platform === 'win32') {
        command = 'explorer.exe'
        args = selectPath ? [`/select,${selectPath}`] : [target]
      } else if (platform === 'darwin') {
        command = 'open'
        args = selectPath ? ['-R', selectPath] : [target]
      } else {
        command = 'xdg-open'
        args = [target]
      }
      const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
      child.on('error', () => resolve(false))
      child.on('spawn', () => {
        child.unref()
        resolve(true)
      })
    } catch {
      resolve(false)
    }
  })
}
