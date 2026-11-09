/**
 * Host unit tests: dataset parsing, figure store, service pipeline and panel routes.
 * The Python engine is replaced by a deterministic fake so these tests stay fast
 * and hermetic; the real engine has its own selftest (python -m sciplot.cli selftest).
 */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  detectDelimiter,
  isInside,
  datasetExists,
  loadDatasetFile,
  parseDelimited,
  parseJsonRows,
  profileRows,
  quickInspect,
  recommend,
} from '../../lib/data.js'
import { FigureStore, writeJsonAtomic } from '../../lib/store.js'
import { SciPlotService } from '../../lib/service.js'
import { autoRender, completeMapping, deriveMappingFromTemplate, humanizeColumn, matchIntent, repairSpec } from '../../lib/auto.js'
import { createTools, agentFigure, shrinkQualityForAgent, shrinkSpecForAgent } from '../../lib/tools.js'
import { readXlsx } from '../../lib/xlsx.js'
import { readZip, writeZip } from '../../lib/zip.js'
import { checkLoopbackHost, checkRequestGate, handleRequest, matchRoute, statusForCode } from '../../lib/panel.js'
import { resolveConfig, defaultSettings } from '../../lib/config.js'
import { newId, truncateUtf8, safeJsonParse } from '../../lib/util.js'

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function tempDir(prefix = 'sciplot-test-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

function fakeEngine(overrides = {}) {
  const calls = { render: [], export: 0, capabilities: 0 }
  const engine = {
    calls,
    async capabilities(force = false) {
      calls.capabilities += 1
      return {
        source: 'engine',
        version: '1.0.0',
        kinds: [
          {
            id: 'basic',
            name_zh: '基础图形',
            name_en: 'Basics',
            kinds: [
              {
                kind: 'line',
                name_zh: '折线图',
                name_en: 'Line chart',
                category: 'basic',
                summary_zh: '折线',
                options: [{ id: 'marker', type: 'bool', default: true, label_zh: '点', label_en: 'markers' }],
                demo: { data: { sample: 'growth' } },
              },
            ],
          },
        ],
        themes: {
          domains: [{ id: 'general', name_zh: '通用科研', name_en: 'General', description_zh: '', description_en: '', palette: 'okabe-ito', cmap: 'viridis', font: 'arial', recommended: ['line'] }],
          journals: [{ id: 'nature', name_zh: 'Nature', name_en: 'Nature', widths: { single: 89, double: 183 }, font: 'arial', palette: 'npg', note_zh: '', note_en: '' }],
          sizes: [{ id: 'single', name_zh: '单栏', name_en: 'Single column', width_mm: 89, note_zh: '', note_en: '' }],
          fonts: [],
        },
        palettes: { categorical: [], continuous: [] },
        samples: [
          {
            id: 'growth',
            name_zh: '生长曲线',
            name_en: 'Growth curves',
            domain: 'life-science',
            rows: 39,
            columns: [],
            mapping: { x: 'time_h', y: 'od600' },
            recommended: [],
          },
        ],
        spec: { formats: ['png', 'svg', 'pdf'] },
        engine: { version: '1.0.0' },
      }
    },
    async probe(force = false) {
      return { available: true, error: '', pythonPath: 'python', info: { matplotlib: '3.11.2' } }
    },
    status() {
      return { available: true, checked: true, pythonPath: 'python', matplotlib: '3.11.2', scipy: '1.18', cjk: true, version: '1.0.0' }
    },
    async render(spec, outDir) {
      calls.render.push({ spec, outDir })
      mkdirSync(outDir, { recursive: true })
      const files = {
        png: join(outDir, 'figure.png'),
        thumb: join(outDir, 'figure.thumb.png'),
        svg: join(outDir, 'figure.svg'),
        pdf: join(outDir, 'figure.pdf'),
      }
      writeFileSync(files.png, PNG_1x1)
      writeFileSync(files.thumb, PNG_1x1)
      writeFileSync(files.svg, '<svg xmlns="http://www.w3.org/2000/svg"/>')
      writeFileSync(files.pdf, '%PDF-1.4\n')
      return {
        ok: true,
        kind: spec.kind,
        name_zh: spec.kind === 'scatter' ? '散点图' : '折线图',
        name_en: 'Line chart',
        category: 'basic',
        files,
        formats: ['png', 'svg', 'pdf'],
        width_px: 1051,
        height_px: 788,
        width_mm: 89,
        height_mm: 66.75,
        dpi: spec.style?.dpi || 300,
        style: { ...(spec.style || {}) },
        quality: { score: 97, grade: 'A', checks: [], counts: { pass: 1, warn: 0, fail: 0, info: 0 } },
        warnings: [],
        duration_ms: 12,
        engine: { version: '1.0.0' },
      }
    },
    async validate(spec) {
      return { ok: true, kind: spec.kind, style: { domain: 'general' }, data: { mode: 'table', rows: 2, columns: [] }, issues: [], options: [] }
    },
    async sampleInfo(id) {
      return {
        ok: true,
        sample: { id, name_zh: '生长曲线', name_en: 'Growth', domain: 'life-science', columns: [], rows: 2, mapping: { x: 'time_h', y: 'od600' } },
        preview: { columns: ['time_h', 'od600'], rows: [{ time_h: 0, od600: 0.1 }], total: 2 },
      }
    },
    async refresh() {
      return { available: true }
    },
    ...overrides,
  }
  return engine
}

async function makeService(options = {}) {
  const dir = options.dir || tempDir()
  const assetsDir = options.assetsDir || tempDir('sciplot-assets-')
  const store = new FigureStore({ dir, maxFigures: options.maxFigures || 10, log: null, assetsDir })
  await store.init()
  const config = resolveConfig({ workspaceDir: options.workspaceDir || dir, dataDir: dir })
  const engine = options.engine || fakeEngine()
  const service = new SciPlotService({ config, store, engine, log: null })
  return { dir, assetsDir, store, engine, service, config }
}

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------

test('util: ids, truncation and safe JSON parsing', () => {
  const id = newId('fig')
  assert.match(id, /^fig-\d{8}-\d{6}-[a-z0-9]{5}$/u)
  const bounded = truncateUtf8('科学绘图', 6)
  assert.equal(bounded.truncated, true)
  assert.ok(Buffer.byteLength(bounded.text, 'utf8') <= 6)
  assert.deepEqual(safeJsonParse('{"a":1}'), { a: 1 })
  assert.equal(safeJsonParse('not json', null), null)
})

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------

test('data: quoted CSV, TSV detection and BOM handling', () => {
  const csv = '\uFEFFname,value,note\n"A, one",1.5,"he said ""hi"""\nB,2.5,plain\n'
  const parsed = parseDelimited(csv)
  assert.deepEqual(parsed.columns, ['name', 'value', 'note'])
  assert.equal(parsed.rows.length, 2)
  assert.equal(parsed.rows[0].name, 'A, one')
  assert.equal(parsed.rows[0].note, 'he said "hi"')
  const tsv = parseDelimited('a\tb\tc\n1\t2\t3\n')
  assert.deepEqual(tsv.columns, ['a', 'b', 'c'])
  assert.equal(tsv.rows[0].c, '3')
  assert.equal(detectDelimiter('a\tb\tc'), '\t')
})

test('data: JSON rows in three accepted shapes', () => {
  assert.deepEqual(parseJsonRows('[{"a":1,"b":2}]').columns, ['a', 'b'])
  assert.equal(parseJsonRows('[[1,2],[3,4]]').columns.length, 2)
  const wrapped = parseJsonRows('{"columns":["x","y"],"rows":[[1,2],[3,4]]}')
  assert.deepEqual(wrapped.columns, ['x', 'y'])
  assert.equal(wrapped.rows.length, 2)
})

test('data: profiling separates numeric and categorical columns', () => {
  const rows = [
    { cohort: 'A', score: '1.5', note: 'x' },
    { cohort: 'B', score: '2.5', note: 'y' },
    { cohort: 'A', score: '3.5', note: 'x' },
  ]
  const profile = profileRows(['cohort', 'score', 'note'], rows)
  const byName = Object.fromEntries(profile.columns.map((column) => [column.name, column]))
  assert.equal(byName.score.kind, 'numeric')
  assert.equal(byName.score.mean, 2.5)
  assert.equal(byName.cohort.kind, 'categorical')
  assert.equal(byName.cohort.levels, 2)
})

test('data: recommendations detect volcano and survival structures', () => {
  const volcanoProfile = profileRows(['gene', 'log2fc', 'neglog10_p'], [
    { gene: 'A', log2fc: '1.2', neglog10_p: '3.1' },
    { gene: 'B', log2fc: '-0.4', neglog10_p: '1.2' },
  ])
  const volcano = recommend(volcanoProfile)
  assert.ok(volcano.some((item) => item.kind === 'volcano'))
  assert.equal(volcano[0].mapping.x, 'log2fc')

  const survivalProfile = profileRows(['time', 'event', 'group'], [
    { time: '12', event: '1', group: 'A' },
    { time: '8', event: '0', group: 'B' },
  ])
  const survival = recommend(survivalProfile)
  assert.ok(survival.some((item) => item.kind === 'km_survival'))
})

test('data: path guards and quick inspection', () => {
  const root = tempDir()
  const file = join(root, 'table.csv')
  writeFileSync(file, 'x,y\n1,2\n3,4\n')
  assert.equal(datasetExists(file), true)
  assert.equal(isInside(root, file), true)
  assert.equal(isInside(join(root, 'sub'), join(root, 'other.csv')), false)
  const inspected = quickInspect(file)
  assert.equal(inspected.columns.length, 2)
  assert.equal(inspected.columns[0].kind, 'numeric')
  const loaded = loadDatasetFile(file)
  assert.equal(loaded.rows.length, 2)
  assert.throws(() => loadDatasetFile(join(root, 'missing.csv')))
})

// ---------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------

test('store: add, list, get, update, delete and prune', async () => {
  const dir = tempDir()
  const assetsDir = tempDir('sciplot-assets-')
  const store = new FigureStore({ dir, maxFigures: 2, log: null, assetsDir })
  await store.init()

  const makeMeta = (id, createdAt) => ({
    id,
    createdAt,
    title: `Figure ${id}`,
    kind: 'line',
    kindNameZh: '折线图',
    domain: 'general',
    files: { png: 'figure.png', thumb: 'figure.png' },
    formats: ['png'],
    quality: { score: 95, grade: 'A', counts: {} },
    spec: { kind: 'line', data: { sample: 'growth' } },
  })
  for (const [index, stamp] of ['2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2026-01-03T00:00:00.000Z'].entries()) {
    const place = join(dir, 'figures', `fig-2026010${index + 1}-120000-abcde`)
    mkdirSync(place, { recursive: true })
    writeFileSync(join(place, 'figure.png'), PNG_1x1)
    await store.addFigure(makeMeta(`fig-2026010${index + 1}-120000-abcde`, stamp))
  }
  const listed = await store.listFigures(10)
  assert.equal(listed.length, 2, 'maxFigures prunes the oldest')
  const newest = listed[0].id
  const detail = await store.getFigure(newest)
  assert.equal(detail.spec.kind, 'line')
  const file = await store.figureFile(newest, 'png', 'thumb')
  assert.ok(file && existsSync(file.path))

  await store.updateFigure(newest, { title: 'Renamed' })
  assert.equal((await store.getFigure(newest)).title, 'Renamed')

  assert.equal(await store.deleteFigure(newest), true)
  assert.equal(await store.getFigure(newest), null)

  const settings = await store.saveSettings({ defaultDomain: 'physics' }, defaultSettings({}))
  assert.equal(settings.defaultDomain, 'physics')
  const reread = await store.getSettings({ defaultDomain: 'general' })
  assert.equal(reread.defaultDomain, 'physics')
})

test('store: gallery manifest is read-only and path-safe', async () => {
  const dir = tempDir()
  const assetsDir = tempDir('sciplot-assets-')
  mkdirSync(join(assetsDir, 'gallery'), { recursive: true })
  writeFileSync(join(assetsDir, 'gallery', 'nature-line.png'), PNG_1x1)
  writeFileSync(join(assetsDir, 'gallery', 'manifest.json'), JSON.stringify({ figures: [{ id: 'g1', file: 'nature-line.png', title_zh: '示例' }] }))
  const store = new FigureStore({ dir, maxFigures: 5, log: null, assetsDir })
  await store.init()
  assert.equal(store.galleryManifest().length, 1)
  assert.ok(store.galleryFile('nature-line.png'))
  assert.equal(store.galleryFile('../secret.png'), null)
})

test('store: atomic JSON write keeps valid content', () => {
  const dir = tempDir()
  const file = join(dir, 'index.json')
  writeJsonAtomic(file, { a: 1 })
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { a: 1 })
})

// ---------------------------------------------------------------------------
// service
// ---------------------------------------------------------------------------

test('service: settings, state and capabilities', async () => {
  const { service } = await makeService()
  const settings = await service.settings()
  assert.equal(settings.defaultDomain, 'life-science')
  const state = await service.getState()
  assert.ok(Array.isArray(state.figures))
  assert.ok(state.capabilities.kinds.length > 0)
  assert.equal(state.engine.available, true)
  assert.ok(Array.isArray(state.gallery))
  assert.ok(state.paths.dataDir)

  const saved = await service.saveSettings({ defaultJournal: 'science' })
  assert.equal(saved.defaultJournal, 'science')
})

test('service: render fills defaults, stores the figure and exposes preview paths', async () => {
  const { service, engine } = await makeService()
  const figure = await service.render({ kind: 'line', data: { sample: 'growth' } })
  assert.match(figure.id, /^fig-/u)
  assert.equal(figure.kind, 'line')
  assert.equal(figure.domain, 'life-science')
  assert.equal(figure.journal, 'nature')
  assert.equal(figure.quality.score, 97)
  assert.ok(figure.pngUrl.includes(figure.id))
  assert.equal(engine.calls.render.length, 1)
  const sent = engine.calls.render[0].spec
  assert.equal(sent.style.domain, 'life-science')
  assert.equal(sent.style.size, 'single')
  assert.deepEqual(sent.output.formats, ['png', 'svg', 'pdf'])

  const previewPath = await service.figureFilePath(figure.id, 'png')
  assert.ok(previewPath && existsSync(previewPath))
  const listed = await service.listFigures(10)
  assert.equal(listed.length, 1)
  const detail = await service.getFigure(figure.id, { detail: true })
  assert.equal(detail.spec.kind, 'line')
  assert.equal(detail.spec.data.sample, 'growth')
})

test('service: data.path resolves inside the workspace and blocks outside files', async () => {
  const workspace = tempDir('sciplot-ws-')
  writeFileSync(join(workspace, 'measure.csv'), 'x,y\n1,2\n3,4\n5,6\n')
  const outside = tempDir('sciplot-outside-')
  writeFileSync(join(outside, 'secret.csv'), 'x,y\n1,2\n')
  const { service, engine } = await makeService({ workspaceDir: workspace })
  const figure = await service.render({
    kind: 'scatter',
    data: { path: join(workspace, 'measure.csv'), mapping: { x: 'x', y: 'y' } },
    labels: { x: 'X (a.u.)', y: 'Y (a.u.)' },
  })
  assert.equal(figure.kind, 'scatter')
  const sent = engine.calls.render[0].spec
  assert.equal(sent.data.rows.length, 3)
  assert.deepEqual(sent.data.columns, ['x', 'y'])
  assert.ok(figure.title.startsWith('散点图'), figure.title)

  await assert.rejects(
    service.render({ kind: 'scatter', data: { path: join(outside, 'secret.csv') } }),
    (error) => error.code === 'forbidden',
  )
})

test('service: export re-renders with overrides and updates files', async () => {
  const { service, engine, store } = await makeService()
  const figure = await service.render({ kind: 'line', data: { sample: 'growth' } })
  const exported = await service.exportFigure(figure.id, { formats: ['svg', 'pdf', 'tiff'], dpi: 600, widthMm: 183, journal: 'science' })
  assert.equal(engine.calls.render.length, 2)
  const sent = engine.calls.render[1].spec
  assert.equal(sent.style.dpi, 600)
  assert.equal(sent.style.width_mm, 183)
  assert.equal(sent.style.journal, 'science')
  assert.deepEqual(sent.output.formats, ['png', 'svg', 'pdf', 'tiff'])
  assert.equal(exported.dpi, 600)
  assert.ok(exported.formats.includes('svg'))
  const meta = await store.getFigure(figure.id)
  assert.equal(meta.dpi, 600)
})

test('service: inspectData and previewDataset work for files and samples', async () => {
  const workspace = tempDir('sciplot-ws-')
  writeFileSync(join(workspace, 'gene.csv'), 'gene,log2fc,neglog10_p\nA,1.2,3.1\nB,-0.5,1.1\n')
  const { service } = await makeService({ workspaceDir: workspace })
  const inspected = await service.inspectData({ path: join(workspace, 'gene.csv') })
  assert.equal(inspected.ok, true)
  assert.ok(inspected.recommendations.some((item) => item.kind === 'volcano'))

  const sample = await service.inspectData({ sample: 'growth' })
  assert.equal(sample.source, 'sample')
  assert.equal(sample.name_zh, '生长曲线')

  const preview = await service.previewDataset({ path: join(workspace, 'gene.csv') })
  assert.equal(preview.source, 'file')
  assert.equal(preview.total, 2)
  assert.ok(preview.recommendations.length > 0)
})

test('service: delete and gallery', async () => {
  const { service, dir, assetsDir } = await makeService()
  mkdirSync(join(assetsDir, 'gallery'), { recursive: true })
  writeFileSync(join(assetsDir, 'gallery', 'g.png'), PNG_1x1)
  writeFileSync(join(assetsDir, 'gallery', 'manifest.json'), JSON.stringify([{ id: 'g', file: 'g.png', titleZh: '示例' }]))
  const gallery = await service.gallery()
  assert.equal(gallery.length, 1)
  assert.ok(gallery[0].url.includes('/dsh-sci-plot/api/assets/gallery/g.png'))

  const figure = await service.render({ kind: 'line', data: { sample: 'growth' } })
  const removed = await service.deleteFigure(figure.id)
  assert.equal(removed.deleted, true)
  assert.equal(await service.getFigure(figure.id), null)
  assert.equal(existsSync(join(dir, 'figures', figure.id)), false)
})

// ---------------------------------------------------------------------------
// panel routes
// ---------------------------------------------------------------------------

test('panel: route matching and status mapping', () => {
  assert.equal(matchRoute('/dsh-sci-plot/api/state').descriptor.route, 'state')
  const figure = matchRoute('/dsh-sci-plot/api/figures/fig-1/file')
  assert.equal(figure.descriptor.route, 'figure-file')
  assert.equal(figure.params[0], 'fig-1')
  assert.equal(matchRoute('/nope'), null)
  assert.equal(statusForCode('invalid_input'), 400)
  assert.equal(statusForCode('no_engine'), 503)
  assert.equal(statusForCode('timeout'), 504)
  assert.equal(statusForCode('weird'), 500)
})

test('panel: loopback host and request gate', () => {
  assert.equal(checkLoopbackHost({ headers: { host: '127.0.0.1:53573' } }), true)
  assert.equal(checkLoopbackHost({ headers: { host: 'example.com' } }), false)
  const webServer = { getOrigin: () => 'http://127.0.0.1:53573' }
  assert.equal(checkRequestGate(webServer, { headers: { host: '127.0.0.1:53573', 'x-dsh-sci-plot': '1' } }).ok, true)
  assert.equal(checkRequestGate(webServer, { headers: { host: '127.0.0.1:53573' } }).ok, false)
  assert.equal(checkRequestGate(webServer, { headers: { host: '127.0.0.1:53573', 'x-dsh-sci-plot': '1', origin: 'http://evil.test' } }).ok, false)
})

function requestJson({ path, method = 'GET', body, headers = {} }) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  const chunks = payload.length > 0 ? [Buffer.from(payload, 'utf8')] : []
  return {
    method,
    url: path,
    headers: { host: '127.0.0.1:53573', 'x-dsh-sci-plot': '1', ...headers },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

function responseCapture() {
  const capture = { status: 0, headers: null, body: '' }
  return {
    capture,
    headersSent: false,
    writableEnded: false,
    writeHead(status, headers) {
      capture.status = status
      capture.headers = headers
      this.headersSent = true
    },
    end(chunk) {
      if (chunk) capture.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
      this.writableEnded = true
    },
    destroy() {
      this.writableEnded = true
    },
  }
}

test('panel: HTTP dispatch for state, capabilities and render', async () => {
  const { service } = await makeService()
  const webCtx = { webServer: { getOrigin: () => 'http://127.0.0.1:53573' } }

  const stateRes = responseCapture()
  await handleRequest(webCtx, service, requestJson({ path: '/dsh-sci-plot/api/state' }), stateRes)
  const state = JSON.parse(stateRes.capture.body)
  assert.equal(state.ok, true)
  assert.equal(state.data.capabilities.kinds.length, 1)

  const capsRes = responseCapture()
  await handleRequest(webCtx, service, requestJson({ path: '/dsh-sci-plot/api/capabilities' }), capsRes)
  assert.equal(JSON.parse(capsRes.capture.body).ok, true)

  const renderRes = responseCapture()
  await handleRequest(
    webCtx,
    service,
    requestJson({ path: '/dsh-sci-plot/api/render', method: 'POST', body: { spec: { kind: 'line', data: { sample: 'growth' } } } }),
    renderRes,
  )
  const rendered = JSON.parse(renderRes.capture.body)
  assert.equal(rendered.ok, true)
  assert.match(rendered.data.figure.id, /^fig-/u)

  const denied = responseCapture()
  await handleRequest(webCtx, service, requestJson({ path: '/dsh-sci-plot/api/state', headers: { 'x-dsh-sci-plot': '0' } }), denied)
  assert.equal(denied.capture.status, 403)

  const bad = responseCapture()
  await handleRequest(webCtx, service, requestJson({ path: '/dsh-sci-plot/api/nope' }), bad)
  assert.equal(bad.capture.status, 404)
})

test('panel: settings POST persists and errors map to status codes', async () => {
  const { service } = await makeService()
  const webCtx = { webServer: { getOrigin: () => 'http://127.0.0.1:53573' } }
  const res = responseCapture()
  await handleRequest(
    webCtx,
    service,
    requestJson({ path: '/dsh-sci-plot/api/settings', method: 'POST', body: { defaultDomain: 'ml', defaultDpi: 600 } }),
    res,
  )
  const payload = JSON.parse(res.capture.body)
  assert.equal(payload.ok, true)
  assert.equal(payload.data.defaultDomain, 'ml')
  assert.equal(payload.data.defaultDpi, 600)

  const invalid = responseCapture()
  await handleRequest(
    webCtx,
    service,
    requestJson({ path: '/dsh-sci-plot/api/render', method: 'POST', body: { spec: 'not-an-object' } }),
    invalid,
  )
  assert.equal(invalid.capture.status, 400)
})

// ---------------------------------------------------------------------------
// autonomous plotting (sci_plot_auto)
// ---------------------------------------------------------------------------

test('auto: intent matching, label humanizing and mapping completion', () => {
  assert.ok(matchIntent('做一张生存曲线').some((rule) => rule.id === 'survival'))
  assert.ok(matchIntent('Draw a volcano plot for the DEGs').some((rule) => rule.id === 'volcano'))
  assert.equal(matchIntent('').length, 0)
  assert.equal(humanizeColumn('time_h'), 'Time h')
  assert.equal(humanizeColumn('od600'), 'Od600')
  assert.deepEqual(
    deriveMappingFromTemplate({ x: 'time_h', y: 'od600' }, [{ name: 'time_h' }, { name: 'od600' }]),
    { x: 'time_h', y: 'od600' },
  )
  assert.equal(deriveMappingFromTemplate({ x: 'a', y: 'b' }, [{ name: 'other' }]), null)
  assert.deepEqual(
    completeMapping('km_survival', { time: 'time', event: 'event' }, [{ name: 'time' }, { name: 'event' }, { name: 'arm' }]),
    { time: 'time', event: 'event', group: 'arm' },
  )
})

test('auto: a quality failure is repaired by a palette patch', () => {
  const spec = { kind: 'line', data: { sample: 'growth' }, style: { palette: 'npg' }, labels: {} }
  assert.equal(repairSpec(spec, { checks: [] }), null)
  const patch = repairSpec(spec, { checks: [{ id: 'colorblind', status: 'warn' }] })
  assert.equal(patch.style.palette, 'okabe-ito')
  const labels = repairSpec({ kind: 'bar', data: { mapping: { x: 'group', y: 'value' } }, labels: {} }, { checks: [{ id: 'labels', status: 'warn' }] })
  assert.equal(labels.labels.x, 'Group')
  assert.equal(labels.labels.y, 'Value')
})

test('auto: file + survival intent renders a quality-gated KM figure in one call', async () => {
  const { dir, service, store } = await makeService()
  const csv = join(dir, 'survival.csv')
  writeFileSync(csv, 'time,event,arm\n1,1,A\n2,0,A\n3,1,B\n4,0,B\n5,1,A\n6,0,B\n')
  const result = await autoRender({ service, input: { data: { path: csv }, intent: '做一张生存曲线' } })
  assert.equal(result.ok, true)
  assert.equal(result.chosen.kind, 'km_survival')
  assert.equal(result.chosen.mapping.time, 'time')
  assert.equal(result.chosen.mapping.event, 'event')
  assert.equal(result.chosen.mapping.group, 'arm')
  assert.equal(result.quality.gateMet, true)
  assert.ok(result.figure.id.startsWith('fig-'))
  assert.ok(result.caption.includes('图注'))
  assert.equal(result.attempts, 1)
  const stats = await store.stats()
  assert.equal(stats.count, 1)
})

test('auto: an empty intent follows the data and prefers a time series over a bar of time', async () => {
  const { dir, service } = await makeService()
  const csv = join(dir, 'time.csv')
  writeFileSync(csv, 'time_h,od600,condition\n0,0.10,A\n1,0.25,A\n2,0.50,B\n3,0.80,B\n4,1.10,A\n')
  const result = await autoRender({ service, input: { data: { path: csv } } })
  assert.equal(result.ok, true)
  assert.equal(result.chosen.kind, 'line')
  assert.equal(result.chosen.mapping.x, 'time_h')
  assert.equal(result.quality.gateMet, true)
})

test('auto: a curated sample uses its demo spec', async () => {
  const { service } = await makeService()
  const result = await autoRender({ service, input: { data: { sample: 'bio_volcano_de' }, intent: '火山图 Nature 风格' } })
  assert.equal(result.ok, true)
  assert.equal(result.chosen.kind, 'volcano')
  assert.equal(result.chosen.mapping.x, 'log2fc')
  assert.equal(result.quality.gateMet, true)
  assert.ok(result.alternatives.length <= 2)
})

test('auto: one repair retry replaces a below-gate render and reaches the gate', async () => {
  const engine = fakeEngine()
  const baseRender = engine.render
  let renders = 0
  engine.render = async (spec, outDir) => {
    renders += 1
    const result = await baseRender(spec, outDir)
    if (renders === 1) {
      return {
        ...result,
        quality: { score: 82, grade: 'B', checks: [{ id: 'colorblind', status: 'warn', message_zh: '颜色过近' }], counts: { pass: 11, warn: 1, fail: 0, info: 0 } },
      }
    }
    return result
  }
  const { dir, service, store } = await makeService({ engine })
  const csv = join(dir, 'trend.csv')
  writeFileSync(csv, 'time_h,value\n0,1\n1,2\n2,3\n3,4\n')
  const result = await autoRender({ service, input: { data: { path: csv }, intent: '趋势' } })
  assert.equal(result.ok, true)
  assert.equal(renders, 2)
  assert.equal(result.attempts, 2)
  assert.equal(result.quality.repaired, true)
  assert.equal(result.quality.gateMet, true)
  const stats = await store.stats()
  assert.equal(stats.count, 1)
})

test('auto: unusable inputs fail gracefully with a manual-chain hint', async () => {
  const { dir, service } = await makeService()
  const missing = await autoRender({ service, input: { data: { path: join(dir, 'nope.csv') } } })
  assert.equal(missing.ok, false)
  assert.equal(missing.code, 'invalid_data')
  assert.ok(missing.next.includes('sci_plot_inspect_data'))
  writeFileSync(join(dir, 'strings.csv'), 'name,label\na,b\nc,d\n')
  const strings = await autoRender({ service, input: { data: { path: join(dir, 'strings.csv') } } })
  assert.equal(strings.ok, false)
  assert.equal(strings.code, 'invalid_data')
  const unknown = await autoRender({ service, input: { data: { sample: 'bio_volcano_de' }, kind: 'not_a_kind' } })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.code, 'unknown_kind')
  assert.ok(unknown.repair.detail.includes('kind'))
})

test('tools: sci_plot_auto is registered with a data-driven schema', () => {
  const tools = createTools({ service: {}, log: null })
  const auto = tools.find((tool) => tool.name === 'sci_plot_auto')
  assert.ok(auto)
  assert.deepEqual(auto.parameters.required, ['data'])
  assert.equal(auto.parameters.properties.data.type, 'object')
  assert.equal(tools.filter((tool) => tool.name.startsWith('sci_plot_')).length, 9)
})

test('tools: agent payloads drop inline rows and the full quality checklist', () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({ x: index, y: index * 2 }))
  const spec = { kind: 'line', data: { rows, columns: ['x', 'y'], mapping: { x: 'x', y: 'y' }, meta: { path: 'C:/data.csv' } }, style: {}, labels: {} }
  const shrunk = shrinkSpecForAgent(spec)
  assert.equal(shrunk.data.path, 'C:/data.csv')
  assert.equal(shrunk.data.rows, undefined)
  assert.deepEqual(shrunk.data.mapping, { x: 'x', y: 'y' })
  const inline = shrinkSpecForAgent({ kind: 'line', data: { rows, columns: ['x', 'y'], mapping: {} } })
  assert.equal(inline.data.rows.length, 5)
  assert.ok(inline.data.note.includes('truncated'))
  assert.equal(shrinkSpecForAgent({ kind: 'line', data: { sample: 'growth' } }).data.sample, 'growth')
  const quality = shrinkQualityForAgent({
    score: 100,
    grade: 'A',
    checks: [{ id: 'resolution', status: 'pass' }, { id: 'labels', status: 'warn', message_zh: '缺少标签' }],
    counts: { warn: 1 },
  })
  assert.equal(quality.score, 100)
  assert.deepEqual(quality.issues, ['warn: 缺少标签'])
  const figure = agentFigure({ id: 'fig-x', quality: { score: 100, checks: [] }, spec })
  assert.equal(figure.spec, undefined)
  assert.equal(figure.quality.checks, undefined)
  const fetched = agentFigure({ id: 'fig-x', quality: { score: 100, checks: [] }, spec }, { spec: true })
  assert.equal(fetched.spec.data.path, 'C:/data.csv')
})

test('auto: explicit kind, mapping and style overrides win', async () => {
  const engine = fakeEngine()
  const baseCapabilities = engine.capabilities.bind(engine)
  engine.capabilities = async (force = false) => {
    const caps = await baseCapabilities(force)
    caps.kinds[0].kinds.push({ kind: 'box', name_zh: '箱线图', name_en: 'Box plot', category: 'statistics', options: [], demo: { data: { sample: 'distributions' } } })
    return caps
  }
  const { dir, service } = await makeService({ engine })
  const csv = join(dir, 'groups.csv')
  writeFileSync(csv, 'group,value\nA,1\nA,2\nB,3\nB,4\nC,5\nC,6\n')
  const result = await autoRender({
    service,
    input: { data: { path: csv }, kind: 'box', mapping: { x: 'group', y: 'value' }, journal: 'nature', dpi: 600 },
  })
  assert.equal(result.ok, true)
  assert.equal(result.chosen.kind, 'box')
  assert.equal(result.chosen.requestedKindMet, true)
  const rendered = engine.calls.render[engine.calls.render.length - 1]
  assert.equal(rendered.spec.style.journal, 'nature')
  assert.equal(rendered.spec.style.dpi, 600)
})

test('auto: a JSON row file is supported', async () => {
  const { dir, service } = await makeService()
  const json = join(dir, 'points.json')
  writeFileSync(json, JSON.stringify([
    { height_cm: 150, weight_kg: 45 },
    { height_cm: 160, weight_kg: 55 },
    { height_cm: 170, weight_kg: 65 },
    { height_cm: 180, weight_kg: 78 },
  ]))
  const result = await autoRender({ service, input: { data: { path: json }, intent: '散点图' } })
  assert.equal(result.ok, true)
  assert.equal(result.chosen.kind, 'scatter')
  assert.equal(result.chosen.mapping.x, 'height_cm')
  assert.equal(result.quality.gateMet, true)
})

// ---------------------------------------------------------------------------
// v1.2 / v1.3: xlsx, zip pack, preferences, rewind, style lock
// ---------------------------------------------------------------------------

function writeTestXlsx(path, { includeDate = true } = {}) {
  const rows = [
    '<row r="1"><c r="A1" t="inlineStr"><is><t>group</t></is></c><c r="B1" t="inlineStr"><is><t>value</t></is></c>' +
      (includeDate ? '<c r="C1" t="inlineStr"><is><t>measured_on</t></is></c>' : '') + '</row>',
    '<row r="2"><c r="A2" t="inlineStr"><is><t>A</t></is></c><c r="B2"><v>1.5</v></c>' + (includeDate ? '<c r="C2" s="1"><v>45000</v></c>' : '') + '</row>',
    '<row r="3"><c r="A3" t="inlineStr"><is><t>B</t></is></c><c r="B3"><v>2.5</v></c>' + (includeDate ? '<c r="C3" s="1"><v>45001</v></c>' : '') + '</row>',
  ]
  const entries = [
    { name: 'xl/workbook.xml', data: '<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: `<worksheet><sheetData>${rows.join('')}</sheetData></worksheet>` },
  ]
  if (includeDate) {
    entries.push({
      name: 'xl/styles.xml',
      data: '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    })
  }
  writeZip(path, entries)
  return path
}

test('zip: writer and reader round-trip text and binary entries', () => {
  const dir = tempDir()
  const target = join(dir, 'pack.zip')
  writeZip(target, [
    { name: 'figures/a.png', data: PNG_1x1 },
    { name: 'manifest.json', data: JSON.stringify({ ok: true }) },
    { name: 'README.txt', data: 'hello 科研绘图' },
  ])
  const entries = readZip(target)
  assert.equal(entries.size, 3)
  assert.equal(entries.get('figures/a.png').subarray(0, 4).toString('hex'), '89504e47')
  assert.deepEqual(JSON.parse(entries.get('manifest.json').toString('utf8')), { ok: true })
  assert.ok(entries.get('README.txt').toString('utf8').includes('科研绘图'))
  assert.throws(() => readZip(Buffer.from('definitely not a zip')), /ZIP/u)
})

test('xlsx: reads inline strings, numbers and date-styled cells without dependencies', async () => {
  const dir = tempDir()
  const path = writeTestXlsx(join(dir, 'data.xlsx'))
  const parsed = readXlsx(path)
  assert.deepEqual(parsed.columns, ['group', 'value', 'measured_on'])
  assert.equal(parsed.rows.length, 2)
  assert.equal(parsed.rows[0].group, 'A')
  assert.equal(parsed.rows[0].value, 1.5)
  assert.equal(parsed.rows[0].measured_on, '2023-03-15')
  assert.equal(parsed.sheet, 'Data')
  assert.deepEqual(parsed.sheets, ['Data'])

  const { service } = await makeService()
  const inspected = await service.inspectData({ path })
  assert.equal(inspected.ok, true)
  assert.ok(inspected.columns.some((column) => column.name === 'value' && column.kind === 'numeric'))
})

test('xlsx: auto renders from a workbook and legacy .xls fails with a repair hint', async () => {
  const dir = tempDir()
  const path = writeTestXlsx(join(dir, 'groups.xlsx'), { includeDate: false })
  const { service } = await makeService()
  const result = await autoRender({ service, input: { data: { path }, intent: '分组柱状图' } })
  assert.equal(result.ok, true)
  assert.equal(result.chosen.mapping.x, 'group')
  assert.equal(result.chosen.mapping.y, 'value')

  const legacy = join(dir, 'old.xls')
  writeFileSync(legacy, Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))
  const failed = await autoRender({ service, input: { data: { path: legacy }, intent: '分组柱状图' } })
  assert.equal(failed.ok, false)
  assert.equal(failed.code, 'invalid_data')
  assert.ok(failed.repair.detail.includes('.xlsx'))
})

test('preferences: agent can persist and reset plotting defaults', async () => {
  const { service } = await makeService()
  const tools = createTools({ service, log: null })
  const preferences = tools.find((tool) => tool.name === 'sci_plot_preferences')
  const before = await preferences.execute({ action: 'get' })
  assert.equal(before.ok, true)
  assert.equal(before.settings.defaultJournal, 'nature')

  const saved = await preferences.execute({ action: 'set', settings: { defaultJournal: 'ieee', defaultSize: 'double', defaultDpi: 600 } })
  assert.equal(saved.ok, true)
  assert.equal(saved.settings.defaultJournal, 'ieee')
  assert.equal(saved.settings.defaultSize, 'double')
  assert.equal(saved.settings.defaultDpi, 600)
  const persisted = await service.settings()
  assert.equal(persisted.defaultJournal, 'ieee')

  const bad = await preferences.execute({ action: 'set', settings: { defaultDpi: 'many' } })
  assert.equal(bad.ok, false)
  assert.equal(bad.code, 'invalid_input')
  const reset = await preferences.execute({ action: 'reset' })
  assert.equal(reset.ok, true)
  assert.equal(reset.settings.defaultJournal, 'nature')
  assert.equal(reset.settings.defaultDpi, 300)
})

test('render: parentId is stored and figures rewind returns the previous version', async () => {
  const { service } = await makeService()
  const first = await service.render({ kind: 'line', data: { sample: 'growth', mapping: { x: 'time_h', y: 'od600', group: 'condition' } } })
  const second = await service.render({ kind: 'line', data: { sample: 'growth', mapping: { x: 'time_h', y: 'od600', group: 'condition' } } }, { parentId: first.id })
  assert.equal(second.parentId, first.id)

  const tools = createTools({ service, log: null })
  const figures = tools.find((tool) => tool.name === 'sci_plot_figures')
  const listed = await figures.execute({ action: 'list' })
  assert.ok(listed.figures.find((item) => item.id === second.id).parentId === first.id)
  const rewound = await figures.execute({ action: 'rewind', figureId: second.id })
  assert.equal(rewound.ok, true)
  assert.equal(rewound.figure.id, first.id)
  assert.equal(rewound.figure.spec.kind, 'line')
})

test('auto: styleFrom locks a multi-figure set to the same journal/size', async () => {
  const { dir, service, engine } = await makeService()
  const first = await autoRender({ service, input: { data: { sample: 'bio_volcano_de' }, intent: '火山图', journal: 'ieee', size: 'double', dpi: 600 } })
  assert.equal(first.ok, true)
  const csv = join(dir, 'groups.csv')
  writeFileSync(csv, 'group,value\nA,1\nA,2\nB,3\nB,4\n')
  const second = await autoRender({ service, input: { data: { path: csv }, intent: '分组比较', styleFrom: first.figure.id } })
  assert.equal(second.ok, true)
  const rendered = engine.calls.render[engine.calls.render.length - 1]
  assert.equal(rendered.spec.style.journal, 'ieee')
  assert.equal(rendered.spec.style.size, 'double')
  assert.equal(rendered.spec.style.dpi, 600)
})

test('export and pack: delivery presets and one ZIP for several figures', async () => {
  const { service } = await makeService()
  const tools = createTools({ service, log: null })
  const exportTool = tools.find((tool) => tool.name === 'sci_plot_export')
  const packTool = tools.find((tool) => tool.name === 'sci_plot_pack')

  const one = await service.render({ kind: 'line', data: { sample: 'growth', mapping: { x: 'time_h', y: 'od600', group: 'condition' } } })
  const two = await service.render({ kind: 'bar', data: { sample: 'growth', mapping: { x: 'condition', y: 'od600' } } })

  const exported = await exportTool.execute({ figureId: one.id, purpose: 'submission' })
  assert.equal(exported.ok, true)
  assert.ok(Object.keys(exported.files).includes('png'))
  assert.ok(Object.keys(exported.files).some((format) => format === 'pdf' || format === 'tiff'))

  const packed = await packTool.execute({ figureIds: [one.id, two.id], formats: ['png', 'pdf'] })
  assert.equal(packed.ok, true)
  assert.ok(existsSync(packed.pack.path))
  assert.ok(packed.pack.bytes > 1000)
  const entries = readZip(packed.pack.path)
  assert.equal(entries.get('manifest.json') !== undefined, true)
  const manifest = JSON.parse(entries.get('manifest.json').toString('utf8'))
  assert.equal(manifest.figures.length, 2)
  assert.ok(manifest.figures[0].files.length >= 1)
  assert.ok([...entries.keys()].some((name) => name.startsWith('figures/') && name.endsWith('.png')))

  const missing = await packTool.execute({ figureIds: ['fig-does-not-exist'] })
  assert.equal(missing.ok, false)
  assert.equal(missing.code, 'not_found')
})

// Clean-up helper left for callers who want to reuse the directory.
export function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
