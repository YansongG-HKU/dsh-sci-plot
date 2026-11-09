/**
 * Figure store: one directory per rendered figure plus a compact JSON index.
 *
 * Layout under `<DSH_HOME>/sci-plot`:
 *   figures/<figureId>/figure.png|svg|pdf|thumb.png + spec.json + meta.json
 *   figures/<figureId>/ (only files produced by the engine)
 *   index.json      fast list for the panel
 *   settings.json   panel defaults
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { FIGURE_FORMATS } from './config.js'
import { messageOf, newId, nowIso, safeJsonParse } from './util.js'

const INDEX_VERSION = 1

export const FILE_NAMES = Object.freeze({
  png: 'figure.png',
  svg: 'figure.svg',
  pdf: 'figure.pdf',
  eps: 'figure.eps',
  tiff: 'figure.tiff',
  jpg: 'figure.jpg',
  thumb: 'figure.thumb.png',
})

export const MIME_BY_EXT = Object.freeze({
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.eps': 'application/postscript',
  '.tiff': 'image/tiff',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
})

export function mimeOf(path) {
  return MIME_BY_EXT[String(extname(String(path || ''))).toLowerCase()] || 'application/octet-stream'
}

export class FigureStore {
  constructor({ dir, maxFigures = 240, log, assetsDir }) {
    this.dir = dir
    this.maxFigures = maxFigures
    this.log = log
    this.assetsDir = assetsDir
    this.index = { version: INDEX_VERSION, figures: [] }
    this.ready = false
  }

  get figuresDir() {
    return join(this.dir, 'figures')
  }

  get indexPath() {
    return join(this.dir, 'index.json')
  }

  get settingsPath() {
    return join(this.dir, 'settings.json')
  }

  get galleryDir() {
    return join(this.assetsDir, 'gallery')
  }

  async init() {
    if (this.ready) return
    mkdirSync(this.figuresDir, { recursive: true })
    if (existsSync(this.indexPath)) {
      const parsed = safeJsonParse(readFileSync(this.indexPath, 'utf8'), null)
      if (parsed && Array.isArray(parsed.figures)) {
        this.index = { version: INDEX_VERSION, figures: parsed.figures.filter((item) => item && typeof item.id === 'string') }
      }
    }
    // Rebuild missing entries from meta.json files (e.g. index lost or hand-edited).
    const known = new Set(this.index.figures.map((item) => item.id))
    try {
      for (const entry of readdirSync(this.figuresDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || known.has(entry.name)) continue
        const meta = this.readMeta(entry.name)
        if (meta) {
          this.index.figures.push(summaryOf(meta))
          known.add(entry.name)
        }
      }
    } catch {
      /* empty store */
    }
    this.index.figures.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    this.ready = true
    await this.writeIndex()
  }

  readMeta(id) {
    try {
      const raw = JSON.parse(readFileSync(join(this.figuresDir, id, 'meta.json'), 'utf8'))
      if (raw && typeof raw.id === 'string') return raw
    } catch {
      /* missing */
    }
    return null
  }

  async writeIndex() {
    writeJsonAtomic(this.indexPath, this.index)
  }

  figureDir(id) {
    return join(this.figuresDir, id)
  }

  async listFigures(limit = 60) {
    await this.init()
    const count = Math.max(1, Math.min(200, Number(limit) || 60))
    return this.index.figures.slice(0, count).map((item) => ({ ...item }))
  }

  async getFigure(id) {
    await this.init()
    const key = String(id || '')
    if (!/^fig-[A-Za-z0-9-]{6,64}$/u.test(key)) return null
    const meta = this.readMeta(key)
    if (!meta) return null
    let spec = null
    try {
      spec = JSON.parse(readFileSync(join(this.figuresDir, key, 'spec.json'), 'utf8'))
    } catch {
      spec = null
    }
    return { ...meta, spec }
  }

  async addFigure(meta) {
    await this.init()
    const id = meta.id || newId('fig')
    const dir = this.figureDir(id)
    mkdirSync(dir, { recursive: true })
    const record = { ...meta, id, createdAt: meta.createdAt || nowIso() }
    writeJsonAtomic(join(dir, 'meta.json'), record)
    if (record.spec) writeJsonAtomic(join(dir, 'spec.json'), record.spec)
    this.index.figures.unshift(summaryOf(record))
    await this.prune()
    await this.writeIndex()
    return record
  }

  async updateFigure(id, patch) {
    await this.init()
    const meta = this.readMeta(id)
    if (!meta) return null
    const next = { ...meta, ...patch, id }
    if (patch.spec) writeJsonAtomic(join(this.figureDir(id), 'spec.json'), patch.spec)
    writeJsonAtomic(join(this.figureDir(id), 'meta.json'), next)
    const entry = summaryOf(next)
    const index = this.index.figures.findIndex((item) => item.id === id)
    if (index >= 0) this.index.figures[index] = entry
    else this.index.figures.unshift(entry)
    await this.writeIndex()
    return next
  }

  async deleteFigure(id) {
    await this.init()
    const key = String(id || '')
    if (!/^fig-[A-Za-z0-9-]{6,64}$/u.test(key)) return false
    const dir = this.figureDir(key)
    if (!existsSync(dir)) return false
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (error) {
      this.log?.warn?.(`could not delete figure ${key}: ${messageOf(error)}`)
      return false
    }
    this.index.figures = this.index.figures.filter((item) => item.id !== key)
    await this.writeIndex()
    return true
  }

  async prune() {
    if (this.index.figures.length <= this.maxFigures) return
    const keep = this.index.figures.slice(0, this.maxFigures)
    const drop = this.index.figures.slice(this.maxFigures)
    for (const item of drop) {
      try {
        rmSync(this.figureDir(item.id), { recursive: true, force: true })
      } catch {
        /* best effort */
      }
    }
    this.index.figures = keep
  }

  /** Absolute path of one figure artifact, or null when it does not exist. */
  async figureFile(id, format, variant = 'full') {
    await this.init()
    const meta = this.readMeta(String(id || ''))
    if (!meta) return null
    const files = meta.files && typeof meta.files === 'object' ? meta.files : {}
    const key = variant === 'thumb' ? 'thumb' : String(format || 'png').toLowerCase()
    const name = files[key]
    if (typeof name !== 'string' || name.includes('/') || name.includes('\\') || name.includes('..')) return null
    const path = join(this.figureDir(meta.id), name)
    try {
      const info = statSync(path)
      if (!info.isFile()) return null
      return { path, mime: mimeOf(path), size: info.size, name }
    } catch {
      return null
    }
  }

  async stats() {
    await this.init()
    let bytes = 0
    try {
      for (const item of this.index.figures) {
        const dir = this.figureDir(item.id)
        for (const name of Object.values(item.files || {})) {
          try {
            bytes += statSync(join(dir, String(name))).size
          } catch {
            /* file gone */
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { count: this.index.figures.length, bytes }
  }

  async getSettings(defaults) {
    await this.init()
    let saved = {}
    try {
      const parsed = JSON.parse(readFileSync(this.settingsPath, 'utf8'))
      if (parsed && typeof parsed === 'object') saved = parsed
    } catch {
      saved = {}
    }
    return { ...defaults, ...pickSettings(saved) }
  }

  async saveSettings(patch, defaults) {
    await this.init()
    const current = await this.getSettings(defaults)
    const next = { ...current, ...pickSettings(patch && typeof patch === 'object' ? patch : {}) }
    writeJsonAtomic(this.settingsPath, next)
    return next
  }

  /** Demo gallery shipped in assets/gallery (read-only). */
  galleryManifest() {
    const manifestPath = join(this.galleryDir, 'manifest.json')
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const figures = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.figures) ? parsed.figures : []
      return figures.filter((item) => item && typeof item.file === 'string' && !item.file.includes('..'))
    } catch {
      return []
    }
  }

  galleryFile(name) {
    const safe = String(name || '')
    if (!/^[A-Za-z0-9._-]{1,120}$/u.test(safe) || safe.includes('..')) return null
    const path = join(this.galleryDir, safe)
    try {
      const info = statSync(path)
      if (!info.isFile()) return null
      return { path, mime: mimeOf(path), size: info.size }
    } catch {
      return null
    }
  }
}

function pickSettings(value) {
  const out = {}
  const strings = ['defaultDomain', 'defaultJournal', 'defaultPalette', 'defaultFont', 'defaultSize', 'lang']
  for (const key of strings) {
    if (typeof value[key] === 'string' && value[key].trim().length > 0) out[key] = value[key].trim()
  }
  if (Number.isFinite(Number(value.defaultDpi))) {
    out.defaultDpi = Math.min(1200, Math.max(72, Math.round(Number(value.defaultDpi))))
  }
  return out
}

function summaryOf(meta) {
  return {
    id: meta.id,
    createdAt: meta.createdAt,
    title: meta.title || '',
    kind: meta.kind || '',
    kindNameZh: meta.kindNameZh || '',
    kindNameEn: meta.kindNameEn || '',
    domain: meta.domain || '',
    domainNameZh: meta.domainNameZh || '',
    journal: meta.journal || null,
    palette: meta.palette || '',
    widthMm: meta.widthMm || 0,
    heightMm: meta.heightMm || 0,
    widthPx: meta.widthPx || 0,
    heightPx: meta.heightPx || 0,
    dpi: meta.dpi || 300,
    formats: Array.isArray(meta.formats) ? meta.formats : [],
    files: meta.files && typeof meta.files === 'object' ? meta.files : {},
    quality: meta.quality ? { score: meta.quality.score, grade: meta.quality.grade, counts: meta.quality.counts } : null,
    durationMs: meta.durationMs || 0,
    parentId: meta.parentId || null,
  }
}

export function writeJsonAtomic(path, value) {
  const tmp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  try {
    renameSync(tmp, path)
  } catch {
    // Windows can fail to rename over an open file; fall back to a direct write.
    try {
      writeFileSync(path, JSON.stringify(value, null, 2), 'utf8')
    } finally {
      try {
        rmSync(tmp, { force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

export function copyInto(dir, sourcePath, targetName) {
  const target = join(dir, targetName)
  if (sourcePath !== target) copyFileSync(sourcePath, target)
  return target
}
