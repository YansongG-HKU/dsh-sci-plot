/**
 * dsh-sci-plot — headless unit tests for the client half.
 *
 * client.js is a browser artifact: it calls window.__ModuleLoader__.load() and
 * requires React. The test evaluates it inside a vm with a minimal module loader
 * and a fake `react`, then exercises the pure helpers exposed as __test__.
 *
 * Run: node --test test/unit/client.test.mjs
 */
// Loose deepEqual on purpose: values come from a separate vm realm, so their
// prototypes differ from the test realm while the data is identical.
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const CLIENT_URL = new URL('../../client.js', import.meta.url)

function loadClient() {
  const source = readFileSync(CLIENT_URL, 'utf8')
  const calls = []
  const storage = new Map()
  const window = {
    __ModuleLoader__: {
      load(config) {
        calls.push(config)
      },
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, String(value))
      },
    },
    navigator: { language: 'zh-CN' },
    matchMedia() {
      return { matches: false, addEventListener() {}, removeEventListener() {} }
    },
    setTimeout,
    clearTimeout,
  }
  const sandbox = {
    window,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: () => Promise.reject(new Error('no network in unit tests')),
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'client.js' })
  assert.equal(calls.length, 1, 'client.js must register exactly one module')
  const config = calls[0]
  assert.equal(config.id, 'dsh-sci-plot')
  const fakeReact = {
    createElement: (...args) => ({ type: 'fake', args }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect() {},
    useRef: () => ({ current: null }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  }
  const module = config.factory((id) => {
    if (id === 'react') return fakeReact
    throw new Error('unexpected require: ' + id)
  })
  return { module, window, source }
}

const { module, window: fakeWindow, source } = loadClient()
const api = module.__test__

test('module shape: slot registration contract + __test__ export', () => {
  assert.deepEqual(module.inject, ['slots', 'locale', 'layout'])
  assert.equal(typeof module.apply, 'function')
  assert.equal(typeof api, 'object')
  assert.equal(api.NS, 'dsh-sci-plot')
  assert.equal(api.API_BASE, '/dsh-sci-plot')
  assert.ok(Object.keys(api).length > 60)
})

test('dictionaries: zh/en parity and every literal t("key") exists', () => {
  const zh = Object.keys(api.DICTIONARIES.zh).sort()
  const en = Object.keys(api.DICTIONARIES.en).sort()
  assert.deepEqual(zh, en)
  assert.ok(zh.length > 200)

  const literalKeys = new Set()
  for (const match of source.matchAll(/\bt\("([A-Za-z0-9_]+)"/g)) literalKeys.add(match[1])
  const missing = [...literalKeys].filter((key) => api.DICTIONARIES.zh[key] === undefined)
  assert.deepEqual(missing, [], 'missing zh dictionary keys: ' + missing.join(', '))
})

test('makeT: interpolation, fallback and language switching', () => {
  const zh = api.makeT('zh')
  const en = api.makeT('en')
  assert.equal(zh('navGallery'), '画廊')
  assert.equal(en('navGallery'), 'Gallery')
  assert.equal(zh('galleryCount', { n: 3 }), '3 张作品')
  assert.equal(en('galleryCount', { n: 3 }), '3 figures')
  assert.equal(zh('does_not_exist'), 'does_not_exist')
})

test('lang persistence helpers use localStorage', () => {
  assert.equal(api.readLang(), '')
  assert.equal(api.detectLang(), 'zh')
  api.writeLang('en')
  assert.equal(api.readLang(), 'en')
  assert.equal(fakeWindow.localStorage.getItem('dsh-sci-plot.lang'), 'en')
  api.writeLang('fr')
  assert.equal(api.readLang(), 'en')
})

test('response envelope unwrapping and error messages', () => {
  assert.deepEqual(api.unwrapEnvelope({ ok: true, data: { value: 1 } }), { value: 1 })
  assert.deepEqual(api.unwrapEnvelope({ ok: true }), {})
  assert.deepEqual(api.unwrapEnvelope({ ok: false, code: 'no_engine' }), { ok: false, code: 'no_engine' })
  assert.deepEqual(api.unwrapEnvelope(null), {})
  assert.equal(api.messageOf(new Error('boom')), 'boom')
  assert.equal(api.messageOf('boom'), 'boom')
})

test('quality: grade thresholds, tone and checklist normalization', () => {
  assert.equal(api.qualityGrade(96), 'A')
  assert.equal(api.qualityGrade(90), 'A')
  assert.equal(api.qualityGrade(89), 'B')
  assert.equal(api.qualityGrade(80), 'B')
  assert.equal(api.qualityGrade(70), 'C')
  assert.equal(api.qualityGrade(12), 'D')
  assert.equal(api.qualityGrade(null), '')
  assert.equal(api.qualityTone('A'), 'ok')
  assert.equal(api.qualityTone('B'), 'info')
  assert.equal(api.qualityTone('C'), 'warn')
  assert.equal(api.qualityTone('D'), 'danger')
  const normalized = api.normalizeQuality({
    score: 88.6,
    checks: [
      { id: 'colors', status: 'pass', message_zh: '配色可区分', message_en: 'Colours distinguishable' },
      { id: 'font', status: 'warn', message_zh: '字号偏小', message_en: 'Font too small' },
    ],
  })
  assert.equal(normalized.score, 89)
  assert.equal(normalized.grade, 'B')
  assert.equal(normalized.checks.length, 2)
  assert.deepEqual(normalized.counts, { pass: 1, warn: 1, fail: 0, info: 0 })
  assert.equal(api.qualityCheckRows({ checks: [{ status: 'warn', message_zh: '小', message_en: 'small' }] }, 'en')[0].message, 'small')
})

test('buildRenderSpec: sample mode matches the host contract', () => {
  const form = {
    kind: 'line',
    dataMode: 'sample',
    sampleId: 'growth',
    mapping: { x: 'time_h', y: 'od600', group: 'condition', ignored: '' },
    style: { domain: 'life-science', journal: 'nature', palette: 'okabe-ito', grid: false, legend: true, dpi: 300, width_mm: 89, height_ratio: 0.75 },
    labels: { x: 'Time (h)', y: 'OD$_{600}$', title: '', colorbar: '' },
    options: { marker: true, smooth: 0, skip: undefined },
    formats: ['svg', 'png'],
    basename: 'fig1',
  }
  const built = api.buildRenderSpec(form)
  assert.equal(built.error, '')
  const spec = built.spec
  assert.equal(spec.kind, 'line')
  assert.deepEqual(spec.data, { sample: 'growth', mapping: { x: 'time_h', y: 'od600', group: 'condition' } })
  assert.equal(spec.style.journal, 'nature')
  assert.equal(spec.style.grid, false)
  assert.deepEqual(spec.labels, { x: 'Time (h)', y: 'OD$_{600}$' })
  assert.deepEqual(spec.options, { marker: true, smooth: 0 })
  assert.deepEqual(spec.output, { formats: ['png', 'svg'], basename: 'fig1' })
})

test('buildRenderSpec: validation errors for missing kind/data', () => {
  assert.equal(api.buildRenderSpec({}).error, 'chooseKindFirst')
  assert.equal(api.buildRenderSpec({ kind: 'line', dataMode: 'sample' }).error, 'sampleNeedsId')
  assert.equal(api.buildRenderSpec({ kind: 'line', dataMode: 'workspace' }).error, 'workspaceNeedsPath')
  const badPaste = api.buildRenderSpec({ kind: 'line', dataMode: 'paste', pasted: 'not json' })
  assert.equal(badPaste.error, 'pasteInvalid')
})

test('buildRenderSpec: workspace + paste data shapes', () => {
  const ws = api.buildRenderSpec({ kind: 'line', dataMode: 'workspace', workspacePath: 'F:/data.csv', mapping: { x: 't', y: 'v' }, formats: ['pdf'] })
  assert.deepEqual(ws.spec.data, { path: 'F:/data.csv', mapping: { x: 't', y: 'v' } })
  assert.deepEqual(ws.spec.output.formats, ['pdf'])

  const series = api.buildRenderSpec({ kind: 'scatter', dataMode: 'paste', pasted: JSON.stringify({ series: [{ name: 'A', x: [0, 1], y: [1, 2] }] }) })
  assert.equal(series.error, '')
  assert.equal(series.spec.data.series.length, 1)

  const matrix = api.buildRenderSpec({ kind: 'heatmap', dataMode: 'paste', pasted: JSON.stringify({ matrix: [[1, 2], [3, 4]], rows: ['a', 'b'], columns: ['x', 'y'] }) })
  assert.deepEqual(matrix.spec.data, { matrix: [[1, 2], [3, 4]], rows: ['a', 'b'], columns: ['x', 'y'] })
})

test('parsePastedData: accepted shapes, rejected shapes and JSON errors', () => {
  assert.equal(api.parsePastedData('').error, 'chooseDataFirst')
  assert.equal(api.parsePastedData('{oops').error, 'pasteInvalid')
  assert.equal(api.parsePastedData('42').error, 'pasteShape')
  assert.equal(api.parsePastedData('{"foo":1}').error, 'pasteShape')
  assert.equal(api.parsePastedData('[{"name":"A","x":[1],"y":[2]}]').data.series.length, 1)
  const rows = api.parsePastedData('{"rows":[[1,2]],"columns":["x","y"],"mapping":{"x":"x"}}')
  assert.deepEqual(rows.data, { rows: [[1, 2]], columns: ['x', 'y'], mapping: { x: 'x' } })
})

const CAPS = {
  version: '1.0.0',
  kinds: [
    {
      id: 'basic',
      name_zh: '基础图',
      name_en: 'Basic',
      kinds: [
        {
          kind: 'line',
          name_zh: '折线图',
          name_en: 'Line plot',
          category: 'basic',
          summary_zh: '时间序列折线。',
          summary_en: 'Line over time.',
          tags: ['time', 'trend'],
          options: [
            { id: 'marker', type: 'bool', default: true, label_zh: '数据点', label_en: 'Markers' },
            { id: 'smooth', type: 'int', default: 0, min: 0, max: 10, step: 1, label_zh: '平滑', label_en: 'Smoothing' },
            { id: 'mode', type: 'enum', default: 'linear', choices: ['linear', 'step'], label_zh: '模式', label_en: 'Mode' },
            { id: 'width', type: 'float', default: 1.5, min: 0.5, max: 4, step: 0.1, label_zh: '线宽', label_en: 'Width' },
            { id: 'colour', type: 'color', default: '#2c5f8a', label_zh: '颜色', label_en: 'Colour' },
            { id: 'note', type: 'string', default: '', label_zh: '备注', label_en: 'Note' },
          ],
          demo: { labels: { x: 'Time (h)', y: 'OD$_{600}$' } },
        },
        {
          kind: 'scatter',
          name_zh: '散点图',
          name_en: 'Scatter',
          category: 'basic',
          summary_zh: '两组连续变量。',
          summary_en: 'Two continuous variables.',
          tags: ['correlation'],
          options: [],
        },
      ],
    },
    {
      id: 'statistics',
      name_zh: '统计',
      name_en: 'Statistics',
      kinds: [{ kind: 'box', name_zh: '箱线图', name_en: 'Box plot', category: 'statistics', summary_zh: '分布。', summary_en: 'Distribution.', tags: [], options: [] }],
    },
  ],
  themes: {
    domains: [{ id: 'life-science', name_zh: '生命科学', name_en: 'Life science', description_zh: '生物医学', description_en: 'Biomedical', palette: 'okabe-ito', cmap: 'viridis', font: 'arial', recommended: ['line'] }],
    journals: [{ id: 'nature', name_zh: 'Nature', name_en: 'Nature', widths: { single: 89, double: 183 }, font: 'arial', palette: 'okabe-ito', note_zh: '单栏 89 mm', note_en: 'Single column 89 mm' }],
    sizes: [{ id: 'single', name_zh: '单栏', name_en: 'Single column', width_mm: 89, note_zh: '单栏', note_en: 'Single column' }],
    fonts: [{ id: 'arial', name_zh: 'Arial', name_en: 'Arial', latin: ['Arial'], cjk: ['Noto Sans SC'], available: true }],
  },
  palettes: {
    categorical: [{ id: 'okabe-ito', name_zh: 'Okabe–Ito', name_en: 'Okabe–Ito', colors: ['#000000', '#E69F00', '#56B4E9'], source: 'Okabe 2008', cvd_safe: true, cvd_min_delta_e: 12.4, cvd_level: 'safe' }],
    continuous: [{ id: 'viridis', name_zh: 'Viridis', name_en: 'Viridis', kind: 'sequential', stops: ['#440154', '#21918c', '#fde725'], source: 'matplotlib' }],
  },
  samples: [
    {
      id: 'growth',
      name_zh: '生长曲线',
      name_en: 'Growth curve',
      domain: 'life-science',
      rows: 48,
      columns: [
        { name: 'time_h', kind: 'numeric' },
        { name: 'od600', kind: 'numeric' },
        { name: 'condition', kind: 'categorical' },
      ],
      description_zh: '大肠杆菌生长。',
      description_en: 'E. coli growth.',
      mapping: { x: 'time_h', y: 'od600', group: 'condition' },
      recommended: [{ kind: 'line' }],
    },
  ],
  spec: { formats: ['png', 'svg', 'pdf'], data_modes: ['sample', 'workspace', 'series'], mapping_keys: ['x', 'y', 'group'], style_keys: [] },
}

test('flattenKinds / kindCategories / filterKindList keep the grouping contract', () => {
  const flat = api.flattenKinds(CAPS)
  assert.equal(flat.length, 3)
  assert.equal(flat[0].groupId, 'basic')
  assert.equal(flat[0].groupNameZh, '基础图')
  assert.equal(api.kindCategories(CAPS).length, 2)
  assert.deepEqual(api.filterKindList(flat, '散点', '').map((k) => k.kind), ['scatter'])
  assert.deepEqual(api.filterKindList(flat, 'correlation', '').map((k) => k.kind), ['scatter'])
  assert.equal(api.filterKindList(flat, '', 'statistics').length, 1)
  assert.equal(api.categoryLabel('ml', 'en'), 'Machine learning')
  assert.equal(api.findKind(CAPS, 'line').name_zh, '折线图')
})

test('initialStudioForm / ensureStudioForm apply settings-aware defaults', () => {
  const form = api.initialStudioForm(CAPS, { defaultDomain: 'life-science', defaultJournal: 'nature', defaultPalette: 'okabe-ito', defaultFont: 'arial', defaultSize: 'single', defaultDpi: 600 })
  assert.equal(form.initialized, true)
  assert.equal(form.kind, 'line')
  assert.equal(form.sampleId, 'growth')
  assert.deepEqual(form.mapping, { x: 'time_h', y: 'od600', group: 'condition' })
  assert.equal(form.style.domain, 'life-science')
  assert.equal(form.style.journal, 'nature')
  assert.equal(form.style.dpi, 600)
  assert.equal(form.style.width_mm, 89)
  assert.equal(form.labels.x, 'Time (h)')
  assert.deepEqual(form.options, { marker: true, smooth: 0, mode: 'linear', width: 1.5, colour: '#2c5f8a', note: '' })
  assert.deepEqual(form.formats, ['png', 'svg'])

  const merged = api.ensureStudioForm({ initialized: true, kind: 'scatter', style: { dpi: 1200, domain: 'life-science' }, options: { marker: false } }, CAPS, {})
  assert.equal(merged.kind, 'scatter')
  assert.equal(merged.style.dpi, 1200)
  assert.deepEqual(merged.options, {})
})

test('option value normalization follows Option.type', () => {
  assert.equal(api.normalizeOptionValue({ type: 'bool' }, 'x'), false)
  assert.equal(api.normalizeOptionValue({ type: 'int', min: 0, max: 10 }, '7.6'), 8)
  assert.equal(api.normalizeOptionValue({ type: 'int', min: 0, max: 10 }, 42), 10)
  assert.equal(api.normalizeOptionValue({ type: 'float', min: 0, max: 1 }, 0.25), 0.25)
  assert.equal(api.normalizeOptionValue({ type: 'enum', choices: ['a', 'b'] }, 'c'), 'a')
  assert.equal(api.normalizeOptionValue({ type: 'string' }, 5), '5')
  assert.deepEqual(api.defaultOptionValues([{ id: 'a', type: 'bool' }, { id: 'b', type: 'int', default: 4 }]), { a: false, b: 4 })
})

test('seedStudioFromSpec restores sample / workspace / paste forms', () => {
  const seeded = api.seedStudioFromSpec(
    {
      kind: 'line',
      data: { sample: 'growth', mapping: { x: 'time_h', y: 'od600' } },
      style: { domain: 'life-science', dpi: 300 },
      labels: { x: 'Time (h)', y: 'OD' },
      options: { marker: true },
      output: { formats: ['svg'], basename: 'figure-2' },
    },
    CAPS,
  )
  assert.equal(seeded.dataMode, 'sample')
  assert.equal(seeded.sampleId, 'growth')
  assert.equal(seeded.basename, 'figure-2')
  assert.deepEqual(seeded.formats, ['svg'])
  assert.equal(seeded.options.marker, true)

  const ws = api.seedStudioFromSpec({ kind: 'line', data: { path: 'F:/a.csv', mapping: { x: 'a' } } }, CAPS)
  assert.equal(ws.dataMode, 'workspace')
  assert.equal(ws.workspacePath, 'F:/a.csv')

  const paste = api.seedStudioFromSpec({ kind: 'line', data: { series: [{ name: 'A', x: [1], y: [2] }] } }, CAPS)
  assert.equal(paste.dataMode, 'paste')
  assert.equal(JSON.parse(paste.pasted).series.length, 1)

  const roundTrip = api.buildRenderSpec(api.ensureStudioForm(seeded, CAPS, {}))
  assert.equal(roundTrip.spec.kind, 'line')
  assert.equal(roundTrip.spec.data.sample, 'growth')
})

test('mappingDefaultsFromColumns picks numeric x/y and a group', () => {
  const columns = CAPS.samples[0].columns
  assert.deepEqual(api.mappingDefaultsFromColumns(columns), { x: 'time_h', y: 'od600', group: 'condition' })
  assert.deepEqual(api.cleanMapping({ x: 'a', y: '', z: 1 }), { x: 'a' })
  assert.equal(api.isNumericKind('numeric'), true)
  assert.equal(api.isNumericKind('categorical'), false)
  assert.equal(api.isCategoricalKind('categorical'), true)
})

test('URL builders point at the documented figure endpoints', () => {
  assert.equal(api.assetUrl('/dsh-sci-plot/api/state'), '/dsh-sci-plot/api/state')
  assert.equal(api.assetUrl('api/state'), '/dsh-sci-plot/api/state')
  assert.equal(api.assetUrl('https://example.com/a.png'), 'https://example.com/a.png')
  const figure = { id: 'fig 1', pngUrl: '/dsh-sci-plot/api/figures/fig%201/file?format=png&variant=full' }
  assert.equal(api.figureFileUrl(figure, 'png', 'full'), figure.pngUrl)
  assert.equal(api.figureFileUrl(figure, 'svg', 'full'), '/dsh-sci-plot/api/figures/fig%201/file?format=svg&variant=full')
  assert.equal(api.figureThumbUrl({ id: 'abc' }), '/dsh-sci-plot/api/figures/abc/file?format=png&variant=thumb')
  assert.equal(api.galleryAssetUrl('nature/fig1.png'), '/dsh-sci-plot/api/assets/gallery/nature%2Ffig1.png')
  assert.deepEqual(api.figureFileEntries({ files: { png: 'a.png', svg: { path: 'a.svg' } } }), [
    { format: 'png', path: 'a.png' },
    { format: 'svg', path: 'a.svg' },
  ])
  assert.equal(api.figurePrimaryPath({ files: { png: 'a.png' } }), 'a.png')
})

test('gallery sorting, facets and filtering', () => {
  const figures = [
    { id: 'b', kind: 'line', kindNameZh: '折线图', kindNameEn: 'Line', domain: 'life-science', domainNameZh: '生命科学', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'a', kind: 'line', kindNameZh: '折线图', kindNameEn: 'Line', domain: 'omics', domainNameZh: '组学', createdAt: '2026-01-03T00:00:00Z' },
    { id: 'c', kind: 'box', kindNameZh: '箱线图', kindNameEn: 'Box', domain: 'life-science', domainNameZh: '生命科学', createdAt: '2026-01-01T00:00:00Z' },
  ]
  assert.deepEqual(api.sortFigures(figures).map((f) => f.id), ['a', 'b', 'c'])
  assert.equal(api.filterFigures(figures, { kind: 'line' }).length, 2)
  assert.equal(api.filterFigures(figures, { kind: 'line', domain: 'omics' }).length, 1)
  const facets = api.figureFacets(figures)
  assert.deepEqual(facets.kinds.map((facet) => facet.id).sort(), ['box', 'line'])
  assert.equal(facets.domains.length, 2)
  assert.equal(facets.kinds.filter((facet) => facet.id === 'line')[0].count, 2)
  assert.equal(api.facetLabel(facets.kinds.filter((facet) => facet.id === 'line')[0], 'en'), 'Line')
})

test('export body + figure formats follow the contract', () => {
  assert.deepEqual(api.buildExportBody(['png', 'PNG', 'bogus']), { formats: ['png'] })
  assert.deepEqual(api.buildExportBody(['svg', 'pdf'], { dpi: 600, widthMm: 89, journal: 'nature' }), { formats: ['svg', 'pdf'], dpi: 600, width_mm: 89, journal: 'nature' })
  assert.deepEqual(api.formatsForFigure({ formats: ['pdf', 'png'] }, CAPS), ['png', 'pdf'])
  assert.deepEqual(api.formatsForFigure({}, CAPS), ['png', 'svg', 'pdf'])
  assert.equal(api.formatLabel('tiff'), 'TIFF')
  assert.equal(api.widthForChoice(CAPS.themes.journals[0], 'double', CAPS.themes.sizes), 183)
  assert.equal(api.widthForChoice(CAPS.themes.journals[0], 'single', CAPS.themes.sizes), 89)
  assert.match(api.journalWidthText(CAPS.themes.journals[0], api.makeT('en')), /Single 89 mm/)
})

test('datasets: normalize samples and workspace entries', () => {
  const datasets = api.normalizeDatasets({ samples: CAPS.samples, workspace: ['F:/data/exp.csv', { path: 'F:/data/other.csv', rows: 12, columns: ['a', 'b'] }] })
  assert.equal(datasets.samples[0].id, 'growth')
  assert.equal(datasets.samples[0].recommendedKind, 'line')
  assert.equal(datasets.workspace.length, 2)
  assert.equal(datasets.workspace[0].name, 'exp.csv')
  assert.equal(datasets.workspace[1].name, 'other.csv')
  assert.equal(api.datasetLabel(datasets.samples[0], 'en'), 'Growth curve')
  assert.equal(api.datasetLabel(datasets.samples[0], 'zh'), '生长曲线')
  assert.equal(api.datasetColumnCount(datasets.workspace[1]), 2)
  assert.deepEqual(api.previewRequestFor(datasets.workspace[0]), { path: 'F:/data/exp.csv' })
  assert.deepEqual(api.previewRequestFor({ id: 'growth' }), { path: 'growth', sample: 'growth' })
  assert.equal(api.previewCell({ a: 1, b: null }, { name: 'a' }, 0), '1')
  assert.equal(api.previewCell({ a: 1, b: null }, { name: 'b' }, 1), '—')
})

test('settings, engine and path helpers', () => {
  assert.equal(api.engineStatus({ available: true }).state, 'ok')
  assert.equal(api.engineStatus({ ok: false }).state, 'down')
  assert.equal(api.engineStatus(null).state, 'unknown')
  assert.deepEqual(api.engineStatus({ available: false }).labelKey, 'engineDown')
  assert.deepEqual(api.settingsFormFrom({ defaultDpi: 600, defaultDomain: 'x' }), {
    defaultDomain: 'x',
    defaultJournal: '',
    defaultPalette: '',
    defaultFont: '',
    defaultSize: '',
    defaultDpi: 600,
  })
  assert.deepEqual(api.buildSettingsPatch({ defaultDomain: 'omics', defaultJournal: '', defaultDpi: 600 }), { defaultDomain: 'omics', defaultJournal: '', defaultDpi: 600 })
  const paths = api.pathEntries({ dataDir: 'F:/data', galleryDir: 'F:/gallery' }, { dataDir: 'F:/other' }, null)
  assert.equal(paths.length, 3)
  assert.equal(paths[0].labelKey, 'dataDirLabel')
  const deduped = api.pathEntries({ dataDir: 'F:/data' }, { dataDir: 'F:/data' }, null)
  assert.equal(deduped.length, 1)
  assert.deepEqual(api.engineFontList({ cjkFonts: ['Noto Sans SC'] }), ['Noto Sans SC'])
  assert.ok(api.engineFacts({ available: true, python: '3.13', matplotlib: '3.11' }).length >= 2)
})

test('formatting helpers stay deterministic', () => {
  assert.equal(api.fmtInt(12345), '12,345')
  assert.equal(api.fmtInt(null), '—')
  assert.equal(api.fmtMm(89), '89')
  assert.equal(api.fmtMm(89.5), '89.5')
  assert.equal(api.fmtDurationMs(1800), '1.8 s')
  assert.equal(api.fmtDurationMs(30), '30 ms')
  assert.equal(api.fmtDurationMs(null), '—')
  assert.equal(api.fmtFigureSize({ widthMm: 89, heightMm: 67, dpi: 300 }), '89 × 67 mm · 300 dpi')
  assert.equal(api.fmtClock('2026-01-02T03:04:05Z').length, 16)
})

test('theme detection understands host attributes and colour tokens', () => {
  assert.equal(api.parseColour('#1e1e1e').r, 30)
  assert.equal(api.parseColour('rgb(10, 20, 30)').b, 30)
  assert.equal(api.parseColour('not a colour'), null)
  assert.equal(api.detectDarkTheme(), false, 'no document in the vm sandbox')
})

test('optionList tolerates array and id→option map transports', () => {
  assert.equal(api.optionList([{ id: 'a', type: 'bool' }]).length, 1)
  assert.deepEqual(api.optionList({ smooth: { type: 'int', min: 0, max: 5 } }), [{ id: 'smooth', type: 'int', min: 0, max: 5 }])
  assert.deepEqual(api.optionList(null), [])
  assert.deepEqual(api.defaultOptionValues({ a: { type: 'bool' }, b: { type: 'int', default: 3 } }), { a: false, b: 3 })
})

test('camelCase localisation reads Figure kindNameZh / kindNameEn', () => {
  assert.equal(api.pickCamelLocalized({ kindNameZh: '折线图', kindNameEn: 'Line' }, 'en', 'kindName'), 'Line')
  assert.equal(api.pickCamelLocalized({ kindNameZh: '折线图', kindNameEn: 'Line' }, 'zh', 'kindName'), '折线图')
  assert.equal(api.pickCamelLocalized({ kindNameZh: '折线图' }, 'en', 'kindName'), '折线图')
  assert.equal(api.pickCamelLocalized(null, 'en', 'kindName'), '')
  assert.equal(api.figureTitle({ kind: 'line', kindNameZh: '折线图' }, 'en'), '折线图')
  assert.equal(api.styleNameFromCaps(CAPS, 'journal', 'nature', 'en'), 'Nature')
  assert.equal(api.styleNameFromCaps(CAPS, 'palette', 'okabe-ito', 'en'), 'Okabe–Ito')
  assert.equal(api.styleNameFromCaps(CAPS, 'cmap', 'missing', 'en'), 'missing')
})

test('resolveKind tolerates recommendation drift and picks sample-recommended kinds', () => {
  const mini = {
    kinds: [
      {
        id: 'biomedical',
        name_zh: '生物医学',
        name_en: 'Biomedical',
        kinds: [
          { kind: 'pr_curve', name_zh: 'PR 曲线', name_en: 'PR curve', category: 'biomedical', options: [], demo: { labels: { x: 'Recall', y: 'Precision' } } },
          { kind: 'roc', name_zh: 'ROC', name_en: 'ROC', category: 'biomedical', options: [] },
        ],
      },
    ],
    samples: [{ id: 's1', name_zh: '样本', name_en: 'Sample', mapping: { x: 'a', y: 'b' }, recommended: [{ kind: 'pr' }] }],
  }
  assert.equal(api.resolveKind(mini, 'pr').kind, 'pr_curve')
  assert.equal(api.resolveKind(mini, 'PR_CURVE').kind, 'pr_curve')
  assert.equal(api.resolveKind(mini, 'prcurve').kind, 'pr_curve')
  assert.equal(api.resolveKind(mini, 'nope'), null)
  assert.equal(api.findKind(mini, 'pr_curve').kind, 'pr_curve')
  const form = api.initialStudioForm(mini, {})
  assert.equal(form.kind, 'pr_curve')
  assert.equal(form.labels.x, 'Recall')
  assert.equal(form.labels.y, 'Precision')
  assert.equal(form.sampleId, 's1')
  assert.deepEqual(form.mapping, { x: 'a', y: 'b' })
})

test('sample gallery entries normalize url/title/note and style patches', () => {
  const item = api.normalizeGalleryItem(
    {
      url: '/dsh-sci-plot/api/assets/gallery/a.png',
      titleZh: '示例图',
      titleEn: 'Sample figure',
      noteZh: '单栏示例',
      noteEn: 'Single column sample',
      kind: 'line',
      domain: 'life-science',
      journal: 'nature',
      palette: 'okabe-ito',
      size: 'single',
      dpi: 300,
      quality: { score: 98, grade: 'A' },
    },
    0,
  )
  assert.equal(item.src, '/dsh-sci-plot/api/assets/gallery/a.png')
  assert.equal(item.kind, 'line')
  assert.equal(item.domain, 'life-science')
  assert.equal(api.galleryTitle(item, 'zh'), '示例图')
  assert.equal(api.galleryTitle(item, 'en'), 'Sample figure')
  assert.equal(api.galleryNote(item, 'zh'), '单栏示例')
  assert.equal(api.galleryNote(item, 'en'), 'Single column sample')
  assert.equal(item.title, '示例图')
  const patch = api.galleryItemStyle(item, CAPS)
  assert.equal(patch.kind, 'line')
  assert.equal(patch.style.domain, 'life-science')
  assert.equal(patch.style.journal, 'nature')
  assert.equal(patch.style.palette, 'okabe-ito')
  assert.equal(patch.style.size, 'single')
  assert.equal(patch.style.dpi, 300)
  assert.equal(patch.style.width_mm, 89)
  const withStyle = api.galleryItemStyle({ kind: 'line', style: { cmap: 'viridis', grid: true }, domain: 'life-science' }, CAPS)
  assert.equal(withStyle.style.cmap, 'viridis')
  assert.equal(withStyle.style.grid, true)
  assert.equal(withStyle.style.domain, 'life-science')
  const sanitized = api.galleryItemStyle({ kind: 'line', domain: 'unknown-domain', journal: 'nature' }, CAPS)
  assert.equal(sanitized.style.domain, undefined)
  assert.equal(sanitized.style.journal, 'nature')
  assert.deepEqual(api.sampleQualityProps({ quality: 'A' }), { grade: 'A' })
  assert.deepEqual(api.sampleQualityProps({ quality: 97 }), { score: 97 })
  assert.equal(api.sampleQualityProps({}), null)
})

test('seedStudioFromSpec always writes x/y/colorbar (empty strings clear stale labels)', () => {
  const seeded = api.seedStudioFromSpec({ kind: 'line', data: { sample: 'growth' }, labels: { x: 'Only X' } }, CAPS)
  assert.deepEqual(seeded.labels, { x: 'Only X', y: '', title: '', colorbar: '' })
  const full = api.seedStudioFromSpec({ kind: 'line', data: { sample: 'growth' }, labels: { x: 'A', y: 'B', title: 'T', colorbar: 'C' } }, CAPS)
  assert.deepEqual(full.labels, { x: 'A', y: 'B', title: 'T', colorbar: 'C' })
})

test('studio empty fallback is a valid starting form', () => {
  const form = api.emptyStudioFormFallback()
  assert.equal(form.initialized, true)
  assert.equal(form.dataMode, 'sample')
  assert.equal(form.basename, 'fig1')
  assert.equal(form.style.dpi, 300)
  assert.deepEqual(form.formats, ['png', 'svg'])
  assert.equal(api.buildRenderSpec(form).error, 'chooseKindFirst')
})

test('toolview: extracts the tool text across content-block dialects', () => {
  const text = JSON.stringify({ ok: true, figure: { id: 'fig-1' } })
  assert.equal(api.toolViewText({ content: [{ type: 'text', text }] }), text)
  assert.equal(api.toolViewText({ result: { content: [{ type: 'text', text }] } }), text)
  assert.equal(api.toolViewText({ output: { content: [{ type: 'text', text }] } }), text)
  assert.equal(api.toolViewText({ text }), text)
  assert.equal(api.toolViewText({ content: [] }), '')
  assert.equal(api.toolViewPayload({ content: [{ type: 'text', text: 'prefix ' + text + ' suffix' }] }).figure.id, 'fig-1')
  assert.equal(api.toolViewPayload({ content: [{ type: 'text', text: 'not json' }] }), null)
})

test('toolview: renders ready, auto, error and empty states', () => {
  const renderPayload = {
    ok: true,
    figure: {
      id: 'fig-2',
      kind: 'km_survival',
      kindNameZh: '生存曲线',
      domainNameZh: '临床医学',
      journal: 'nature',
      widthMm: 89,
      heightMm: 66,
      dpi: 300,
      formats: ['png', 'svg'],
      quality: { score: 93, grade: 'A', checks: [{ id: 'tick_density', status: 'warn', message_zh: '刻度较多' }] },
    },
  }
  const ready = api.figureCardModel({ content: [{ type: 'text', text: JSON.stringify(renderPayload) }] })
  assert.equal(ready.state, 'ready')
  assert.equal(ready.quality.score, 93)
  assert.equal(ready.quality.gateMet, true)
  assert.deepEqual(ready.quality.issues, ['刻度较多'])
  assert.ok(api.figureCardChips(ready).length >= 4)
  assert.equal(api.figureCardTitle(ready), '生存曲线')
  assert.equal(api.figureCardCaption(ready), '生存曲线')

  const autoPayload = {
    ok: true,
    figure: { id: 'fig-3', kind: 'volcano', kindNameZh: '火山图' },
    quality: { score: 88, grade: 'B', gate: 90, gateMet: false, issues: ['warn: 标签缺失'] },
    caption: '图注：火山图',
    alternatives: [{ kind: 'bar', nameZh: '柱状图' }],
  }
  const auto = api.figureCardModel({ content: [{ type: 'text', text: JSON.stringify(autoPayload) }] })
  assert.equal(auto.state, 'ready')
  assert.equal(auto.quality.gateMet, false)
  assert.deepEqual(auto.quality.issues, ['warn: 标签缺失'])
  assert.deepEqual(auto.alternatives, ['柱状图'])
  assert.equal(api.figureCardTitle(auto), '火山图')
  assert.equal(api.figureCardCaption(auto), '图注：火山图')

  const failed = api.figureCardModel({ content: [{ type: 'text', text: JSON.stringify({ ok: false, code: 'invalid_data', error: 'no file', repair: { detail: 'fix the path' } }) }] })
  assert.equal(failed.state, 'error')
  assert.equal(failed.code, 'invalid_data')
  assert.ok(failed.repair.includes('fix the path'))

  assert.equal(api.figureCardModel({ content: [] }).state, 'empty')
  assert.equal(api.figureCardModel({ content: [{ type: 'text', text: 'no payload' }] }).state, 'empty')
})

test('toolview: phase labels and the registered tool list', () => {
  assert.ok(api.toolViewPhaseLabel('running', 'zh').includes('正在'))
  assert.equal(api.toolViewPhaseLabel('error', 'en'), 'Figure failed')
  assert.deepEqual(api.TOOLVIEW_TOOLS, ['sci_plot_render', 'sci_plot_auto'])
})

test('toolview: panel handoff prompt names the figure and the iteration contract', () => {
  const zh = api.handoffPrompt({ id: 'fig-20261109-1', title: '火山图' }, 'zh')
  assert.ok(zh.includes('fig-20261109-1'))
  assert.ok(zh.includes('sci_plot_figures'))
  assert.ok(zh.includes('parentId'))
  const en = api.handoffPrompt({ id: 'fig-20261109-1', title: 'Volcano' }, 'en')
  assert.ok(en.includes('Continue editing figure'))
  assert.ok(en.includes('fig-20261109-1'))
  assert.equal(api.handoffPrompt(null, 'zh'), '')
})

test('__test__ exports are all functions or plain data (no throw on access)', () => {
  for (const key of Object.keys(api)) {
    const value = api[key]
    assert.notEqual(value, undefined, '__test__.' + key + ' must be defined')
    if (typeof value !== 'object' && typeof value !== 'function') {
      assert.ok(['string', 'number', 'boolean'].includes(typeof value), 'unexpected __test__ type for ' + key)
    }
  }
})
