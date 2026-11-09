/**
 * Autonomous plotting: one call turns "data + intent" into a publication figure.
 *
 * Pipeline: resolve data → profile (file) / pick a curated demo (sample) →
 * rank kinds from the user intent + data recommendations → choose mapping and
 * style → render → quality-gate (≥90) with one repair retry → return a compact
 * record plus a caption, rationale and alternatives.
 *
 * Everything degrades gracefully: an unusable intent or mapping never throws
 * into the model; the caller gets `{ok:false, ...}` plus a repair hint that points
 * at the manual tool chain (sci_plot_inspect_data → sci_plot_render).
 */
import { readFileSync } from 'node:fs'

import { profileRows, recommend } from './data.js'
import { messageOf } from './util.js'

const CATALOG_URL = new URL('../engine/demo_catalog.json', import.meta.url)

/** Curated demo specs shipped with the engine (30 figures) — the highest-quality path for sample data. */
function loadDemos() {
  try {
    const parsed = JSON.parse(readFileSync(CATALOG_URL, 'utf8'))
    const figures = Array.isArray(parsed?.figures) ? parsed.figures : []
    return figures
      .filter((item) => item && item.spec && typeof item.spec.kind === 'string')
      .map((item) => ({
        ...item.spec,
        titleZh: item.title_zh || '',
        titleEn: item.title_en || '',
        noteZh: item.note_zh || '',
        noteEn: item.note_en || '',
        demoId: item.id || '',
      }))
  } catch {
    return []
  }
}

const DEMOS = loadDemos()

/**
 * Intent keywords → chart kinds. `kinds` is ordered: the first kind that can be
 * mapped against the actual columns wins. Rules are matched on the user's own
 * words (Chinese or English) and only rank candidates; they never override data.
 */
export const INTENT_RULES = [
  { id: 'survival', re: /(生存|随访|kaplan|survival|time.?to.?event|cox|风险比|km\s*曲线)/i, kinds: ['km_survival'], domain: 'clinical', note: '生存/随访数据' },
  { id: 'volcano', re: /(火山|volcano|差异表达|differential\s*expression|fold.?change|log2?fc|上调|下调)/i, kinds: ['volcano', 'ma_plot'], domain: 'omics', note: '差异表达' },
  { id: 'roc', re: /(roc|auc|诊断性能|diagnostic\s*performance|敏感度|特异度)/i, kinds: ['roc'], domain: 'clinical', note: 'ROC/AUC' },
  { id: 'heatmap', re: /(热图|heatmap|表达矩阵|expression\s*matrix)/i, kinds: ['heatmap', 'cluster_heatmap'], domain: 'omics', note: '矩阵热图' },
  { id: 'correlation', re: /(相关|correlation|corr\b|共表达)/i, kinds: ['corr_heatmap'], domain: 'general', note: '相关矩阵' },
  { id: 'spectra', re: /(光谱|spectra|spectrum|吸光|荧光|raman|红外)/i, kinds: ['spectra'], domain: 'chemistry', note: '光谱' },
  { id: 'xrd', re: /(xrd|衍射|diffraction|晶相)/i, kinds: ['xrd'], domain: 'materials', note: 'XRD 衍射' },
  { id: 'cv', re: /(循环伏安|cyclic\s*voltammetry|\bcv\b|电化学)/i, kinds: ['cv'], domain: 'chemistry', note: '循环伏安' },
  { id: 'tga', re: /(热重|tga|失重|热分析)/i, kinds: ['tga'], domain: 'chemistry', note: '热重分析' },
  { id: 'bode', re: /(bode|频响|频率响应|阻抗|impedance|nyquist)/i, kinds: ['bode', 'nyquist'], domain: 'engineering', note: '频响/阻抗' },
  { id: 'learning', re: /(训练曲线|learning\s*curve|loss\s*曲线|epoch|训练过程|收敛)/i, kinds: ['training_curves'], domain: 'ml', note: '训练曲线' },
  { id: 'confusion', re: /(混淆矩阵|confusion\s*matrix|分类结果)/i, kinds: ['confusion_matrix'], domain: 'ml', note: '混淆矩阵' },
  { id: 'time', re: /(时间序列|随时间|趋势|trend|time\s*series|时序)/i, kinds: ['line', 'time_series'], domain: 'general', note: '时间趋势' },
  { id: 'distribution', re: /(分布|distribution|直方图|histogram|密度图|density)/i, kinds: ['histogram', 'density', 'violin'], domain: 'general', note: '分布' },
  { id: 'group', re: /(分组比较|组间|箱线|box\s*plot|violin|小提琴|比较差异)/i, kinds: ['box', 'violin', 'bar_grouped'], domain: 'life-science', note: '组间比较' },
  { id: 'scatter', re: /(散点|scatter|相关性|回归|regression)/i, kinds: ['scatter', 'regression'], domain: 'general', note: '散点/回归' },
  { id: 'bar', re: /(柱状|bar\s*chart|条形图|占比)/i, kinds: ['bar', 'bar_grouped'], domain: 'general', note: '柱状比较' },
  { id: 'forest', re: /(森林图|forest|meta\s*分析|亚组)/i, kinds: ['forest'], domain: 'clinical', note: '森林图' },
  { id: 'dose', re: /(剂量|dose|ic50|ec50|抑制曲线)/i, kinds: ['dose_response'], domain: 'life-science', note: '剂量反应' },
]

/** Column-name hints used to fill a kind's mapping template when no recommendation exists. */
const KEY_HINTS = {
  x: ['time', 'date', 'month', 'year', 'epoch', 'pos', 'position', 'potential', 'temperature', 'wavenumber', 'frequency', 'concentration', 'dose', 'log2fc', 'x', 'cohort', 'cluster', 'stage', 'two_theta', 'direction'],
  y: ['value', 'response', 'expression', 'intensity', 'current', 'weight', 'score', 'loss', 'magnitude', 'tpr', 'survival', 'estimate', 'median', 'delta', 'protein', 'abundance', 'absorbance', 'od600', 'y'],
  group: ['group', 'condition', 'arm', 'cohort', 'split', 'sample', 'tissue', 'model', 'compound', 'cycle', 'genotype', 'treatment', 'batch'],
  label: ['gene', 'label', 'study', 'snp', 'name', 'feature', 'statement', 'id'],
  time: ['time', 'follow', 'month', 'day', 'year', 'duration', 'survival'],
  event: ['event', 'status', 'death', 'relapse', 'censor'],
  row: ['gene', 'row', 'feature', 'item', 'protein'],
  col: ['sample', 'col', 'condition', 'subject', 'cell'],
  value: ['value', 'zscore', 'expression', 'intensity', 'abundance', 'score'],
  size: ['size', 'weight', 'n', 'count', 'cell_count', 'fraction', 'cells'],
  z: ['z', 'value', 'expression', 'energy', 'phase'],
  chr: ['chr', 'chromosome', 'chrom'],
  pos: ['pos', 'position', 'bp', 'base'],
  phase: ['phase', 'deg'],
  height: ['height', 'frequency', 'count'],
  lower: ['lower', 'lo', 'low'],
  upper: ['upper', 'hi', 'high'],
  y2: ['y2', 'secondary', 'heat_flow', 'phase'],
  correlation: ['correlation', 'corr', 'r'],
  std_ratio: ['std_ratio', 'std', 'ratio'],
  rmsd: ['rmsd'],
}

function str(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function lower(value) {
  return String(value || '').toLowerCase()
}

/** Every intent rule matched by the user's words, in declaration order. */
export function matchIntent(intent) {
  const text = str(intent)
  if (!text) return []
  return INTENT_RULES.filter((rule) => rule.re.test(text))
}

/** "time_h" → "Time h"; keeps existing formatting and math when already human. */
export function humanizeColumn(name) {
  const raw = str(name)
  if (!raw) return ''
  const text = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Fill a mapping template (e.g. {x,y,group}) with real column names. */
export function deriveMappingFromTemplate(template, columns) {
  if (!isObject(template) || !Array.isArray(columns)) return null
  const names = columns.map((column) => (isObject(column) ? column.name : column)).filter(Boolean)
  if (names.length === 0) return null
  const used = new Set()
  const mapping = {}
  for (const key of Object.keys(template)) {
    const hints = KEY_HINTS[key] || [key]
    const target = lower(template[key] || '')
    let choice = names.find((name) => lower(name) === target && !used.has(name))
    if (!choice) {
      choice = names.find((name) => !used.has(name) && hints.some((hint) => lower(name).includes(lower(hint))))
    }
    if (!choice) return null
    used.add(choice)
    mapping[key] = choice
  }
  return mapping
}

function validMapping(mapping, columns) {
  if (!isObject(mapping) || Object.keys(mapping).length === 0) return true
  if (!Array.isArray(columns) || columns.length === 0) return false
  const names = new Set(columns.map((column) => (isObject(column) ? column.name : String(column))))
  return Object.values(mapping).every((value) => typeof value !== 'string' || value.length === 0 || names.has(value))
}

/** Fill the remaining template keys of a kind from a mapping when a hint matches. */
export function completeMapping(kind, mapping, columns) {
  const base = isObject(mapping) ? { ...mapping } : {}
  const demo = DEMOS.find((item) => item.kind === kind)
  if (!demo || !isObject(demo.data) || !isObject(demo.data.mapping)) return base
  const names = (Array.isArray(columns) ? columns : []).map((column) => (isObject(column) ? column.name : column)).filter(Boolean)
  const used = new Set(Object.values(base).filter((value) => typeof value === 'string'))
  for (const key of Object.keys(demo.data.mapping)) {
    if (str(base[key])) continue
    const hints = KEY_HINTS[key] || [key]
    const choice = names.find((name) => !used.has(name) && hints.some((hint) => lower(name).includes(lower(hint))))
    if (choice) {
      base[key] = choice
      used.add(choice)
    }
  }
  return base
}

function mappingKeyLabel(key) {
  return humanizeColumn(key)
}

/** Derive axis/colour labels from a mapping so the quality check sees a labelled axis. */
export function labelsFromMapping(mapping, seedLabels) {
  const labels = isObject(seedLabels) ? { ...seedLabels } : {}
  if (!isObject(mapping)) return labels
  const setIfEmpty = (target, source) => {
    if (!str(labels[target]) && str(source)) labels[target] = humanizeColumn(source)
  }
  setIfEmpty('x', mapping.x)
  setIfEmpty('y', mapping.y)
  setIfEmpty('y2', mapping.y2)
  setIfEmpty('colorbar', mapping.value || mapping.z)
  return labels
}

function flattenKinds(caps) {
  const result = []
  for (const group of (caps && Array.isArray(caps.kinds) ? caps.kinds : [])) {
    for (const kind of (group && Array.isArray(group.kinds) ? group.kinds : [])) {
      if (!kind || !kind.kind) continue
      result.push({
        kind: kind.kind,
        nameZh: kind.name_zh || '',
        nameEn: kind.name_en || '',
        category: kind.category || group.id || '',
      })
    }
  }
  return result
}

function kindName(kind, kinds) {
  const found = kinds.find((item) => item.kind === kind)
  return found ? found.nameZh || found.nameEn || kind : kind
}

function candidate(kind, mapping, extra = {}) {
  return {
    kind,
    mapping: isObject(mapping) ? mapping : {},
    domain: extra.domain || '',
    reasonZh: extra.reasonZh || '',
    reasonEn: extra.reasonEn || '',
    confidence: Number(extra.confidence) || 0.6,
    demo: extra.demo || null,
    style: extra.style || null,
    labels: extra.labels || null,
    options: extra.options || null,
  }
}

function dedupe(candidates) {
  const seen = new Set()
  const out = []
  for (const item of candidates) {
    const key = `${item.kind}|${JSON.stringify(item.mapping)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function timeLikeColumn(name) {
  return /(^|[_\s.])(time|date|month|year|week|day|hour|timestamp|epoch)([_\s.]|$)/i.test(String(name || ''))
}

/** Plan candidate figures for a file dataset backed by recommendations. */
function planForFile({ explicitKind, rules, recommendations, columns, providedMapping }) {
  const planned = []
  for (const rule of rules) {
    for (const kind of rule.kinds) {
      if (explicitKind && kind !== explicitKind) continue
      const rec = recommendations.find((item) => item.kind === kind)
      if (rec && validMapping(rec.mapping, columns)) {
        planned.push(candidate(kind, rec.mapping, { domain: rule.domain, reasonZh: rec.reason_zh || rule.note, reasonEn: rec.reason_en || '', confidence: rec.confidence }))
        continue
      }
      const demo = DEMOS.find((item) => item.kind === kind)
      const mapping = demo && demo.data && demo.data.mapping ? deriveMappingFromTemplate(demo.data.mapping, columns) : null
      if (mapping && validMapping(mapping, columns)) {
        planned.push(candidate(kind, mapping, { domain: rule.domain, reasonZh: rule.note, reasonEn: '', confidence: 0.7 }))
      }
    }
  }
  if (explicitKind) {
    const rec = recommendations.find((item) => item.kind === explicitKind)
    const demo = DEMOS.find((item) => item.kind === explicitKind)
    const mapping = providedMapping
      || (rec ? rec.mapping : null)
      || (demo && demo.data && demo.data.mapping ? deriveMappingFromTemplate(demo.data.mapping, columns) : null)
      || {}
    if (validMapping(mapping, columns)) {
      planned.push(candidate(explicitKind, mapping, { reasonZh: '用户指定图种', reasonEn: 'requested by the user', confidence: 1 }))
    }
  }
  if (!explicitKind && planned.length === 0) {
    // With no intent, a time column is a stronger default than the first generic
    // categorical recommendation (e.g. a bar chart using time as the value).
    const timed = recommendations.find((rec) => (rec.kind === 'line' || rec.kind === 'time_series') && timeLikeColumn(rec.mapping && rec.mapping.x))
    if (timed) {
      planned.push(candidate(timed.kind, timed.mapping, { domain: timed.domain, reasonZh: timed.reason_zh, reasonEn: timed.reason_en, confidence: timed.confidence }))
    }
  }
  for (const rec of recommendations) {
    if (explicitKind && rec.kind !== explicitKind) continue
    if (!validMapping(rec.mapping, columns)) continue
    planned.push(candidate(rec.kind, rec.mapping, { domain: rec.domain, reasonZh: rec.reason_zh, reasonEn: rec.reason_en, confidence: rec.confidence }))
  }
  return dedupe(planned)
}

/** Plan candidate figures for a bundled sample using the curated demo specs. */
function planForSample({ sample, explicitKind, rules, kinds }) {
  const demos = DEMOS.filter((item) => isObject(item.data) && item.data.sample === sample)
  if (demos.length === 0) return []
  const ordered = []
  if (explicitKind) {
    const exact = demos.find((item) => item.kind === explicitKind)
    if (exact) ordered.push(exact)
  }
  for (const rule of rules) {
    for (const kind of rule.kinds) {
      const demo = demos.find((item) => item.kind === kind)
      if (demo && !ordered.includes(demo)) ordered.push(demo)
    }
  }
  for (const demo of demos) if (!ordered.includes(demo)) ordered.push(demo)
  return ordered.map((demo) => candidate(demo.kind, (demo.data && demo.data.mapping) || {}, {
    demo,
    style: demo.style || null,
    labels: demo.labels || null,
    options: demo.options || null,
    reasonZh: demo.noteZh || demo.titleZh,
    reasonEn: demo.noteEn || demo.titleEn,
    confidence: demo.kind === explicitKind ? 1 : 0.85,
  }))
}

/** Best-effort mapping for a kind the recommendation engine does not know. */
function fallbackCandidate({ explicitKind, columns, kindList }) {
  const numeric = columns.filter((column) => (isObject(column) ? column.kind : '') === 'numeric')
  const categorical = columns.filter((column) => (isObject(column) ? column.kind : '') === 'categorical')
  const requested = explicitKind || 'line'
  if (numeric.length >= 2) {
    return candidate(requested, { x: numeric[0].name, y: numeric[1].name }, {
      reasonZh: '按前两个数值列自动映射',
      reasonEn: 'mapped the first two numeric columns',
      confidence: 0.4,
    })
  }
  if (categorical.length >= 1 && numeric.length >= 1) {
    return candidate(requested === 'line' ? 'bar' : requested, { x: categorical[0].name, y: numeric[0].name }, {
      reasonZh: '按分组列与数值列自动映射',
      reasonEn: 'mapped the first category and number',
      confidence: 0.4,
    })
  }
  return null
}

/** One repair attempt for a figure below the quality gate. */
export function repairSpec(spec, quality) {
  const checks = quality && Array.isArray(quality.checks) ? quality.checks : []
  const bad = new Set(checks.filter((check) => check && (check.status === 'warn' || check.status === 'fail')).map((check) => check.id))
  if (bad.size === 0) return null
  const patch = clone(spec)
  let changed = false
  if (bad.has('labels')) {
    const mapping = patch?.data?.mapping || {}
    const labels = isObject(patch.labels) ? patch.labels : {}
    const next = labelsFromMapping(mapping, labels)
    if (!labels.x && next.x) { labels.x = next.x; changed = true }
    if (!labels.y && next.y) { labels.y = next.y; changed = true }
    if (!labels.colorbar && next.colorbar) { labels.colorbar = next.colorbar; changed = true }
    patch.labels = labels
  }
  if (bad.has('colorblind')) {
    patch.style = isObject(patch.style) ? patch.style : {}
    if (patch.style.palette !== 'okabe-ito') { patch.style.palette = 'okabe-ito'; changed = true }
  }
  if (bad.has('legend')) {
    patch.options = isObject(patch.options) ? patch.options : {}
    if (patch.options.legend !== true) { patch.options.legend = true; changed = true }
  }
  return changed ? patch : null
}

function qualityIssues(quality, limit = 4) {
  const checks = quality && Array.isArray(quality.checks) ? quality.checks : []
  return checks
    .filter((check) => check && (check.status === 'warn' || check.status === 'fail'))
    .slice(0, limit)
    .map((check) => `${check.status}: ${check.message_zh || check.id}`)
}

export function compactFigure(figure) {
  if (!figure) return null
  return {
    id: figure.id,
    title: figure.title || '',
    kind: figure.kind || '',
    kindNameZh: figure.kindNameZh || '',
    kindNameEn: figure.kindNameEn || '',
    category: figure.category || '',
    domain: figure.domain || '',
    domainNameZh: figure.domainNameZh || '',
    journal: figure.journal || null,
    palette: figure.palette || '',
    size: figure.size || '',
    widthMm: figure.widthMm || 0,
    heightMm: figure.heightMm || 0,
    widthPx: figure.widthPx || 0,
    heightPx: figure.heightPx || 0,
    dpi: figure.dpi || 300,
    formats: Array.isArray(figure.formats) ? figure.formats : [],
    createdAt: figure.createdAt || '',
    durationMs: figure.durationMs || 0,
    pngUrl: figure.pngUrl || '',
    thumbUrl: figure.thumbUrl || '',
    quality: figure.quality ? {
      score: figure.quality.score,
      grade: figure.quality.grade,
      counts: figure.quality.counts || null,
    } : null,
  }
}

function mappingText(mapping) {
  if (!isObject(mapping)) return ''
  return Object.keys(mapping)
    .filter((key) => str(mapping[key]))
    .slice(0, 4)
    .map((key) => `${mappingKeyLabel(key)} = ${mapping[key]}`)
    .join('，')
}

export function captionFor(figure, chosen) {
  if (!figure) return ''
  const bits = []
  if (figure.widthMm) bits.push(`${figure.widthMm} mm`)
  if (figure.dpi) bits.push(`${figure.dpi} dpi`)
  const mapping = chosen && chosen.mapping ? mappingText(chosen.mapping) : ''
  const score = figure.quality && figure.quality.score !== undefined ? `，质检查 ${figure.quality.score}` : ''
  return `图注：${figure.title || figure.kindNameZh || figure.kind}${mapping ? `；映射：${mapping}` : ''}；${figure.domainNameZh || figure.domain || '科研'}风格${figure.journal ? ` / ${figure.journal}` : ''}，${bits.join(' · ')}${score}。`
}

function failure(code, error, detail) {
  return {
    ok: false,
    code,
    error,
    repair: { action: 'manual-chain', label: 'Use the manual tool chain', detail },
    next: 'Call sci_plot_inspect_data on the same data to get recommendations, then sci_plot_render with an explicit spec; or call sci_plot_capabilities and pick a kind.',
  }
}

/**
 * Render one autonomous figure.
 * @param {{service: object, input: object}} args
 */
export async function autoRender({ service, input = {} }) {
  const data = isObject(input.data) ? input.data : {}
  const path = str(data.path)
  const sample = str(data.sample)
  if (!path && !sample) {
    return failure('invalid_input', 'pass data.path (absolute CSV/TSV/JSON/XLSX) or data.sample (a bundled id)', 'sci_plot_auto needs data: {"path":"…"} or data: {"sample":"…"}.')
  }
  const explicitKind = str(input.kind)
  const intent = str(input.intent)
  const rules = matchIntent(intent)
  const settings = await service.settings()
  const caps = await service.capabilities()
  const kinds = flattenKinds(caps)
  const gate = Number.isFinite(Number(input.qualityGate)) ? Math.max(0, Math.min(100, Math.round(Number(input.qualityGate)))) : 90
  const styleFromId = str(input.styleFrom)
  let inheritedStyle = null
  if (styleFromId) {
    const source = await service.getFigure(styleFromId, { detail: true }).catch(() => null)
    if (source && source.spec && isObject(source.spec.style)) inheritedStyle = clone(source.spec.style)
  }

  if (explicitKind && kinds.length > 0 && !kinds.some((item) => item.kind === explicitKind)) {
    return failure('unknown_kind', `unknown kind: ${explicitKind}`, `Call sci_plot_capabilities and use one of the returned kind ids (e.g. line, scatter, volcano, km_survival).`)
  }

  let columns = []
  let sampleMeta = null
  let candidates = []
  if (sample) {
    let payload = null
    try {
      payload = await service.engine.sampleInfo(sample)
    } catch (error) {
      return failure('sample_unavailable', messageOf(error), 'Call sci_plot_doctor to check the Python engine, or pass data.path with a CSV/TSV/JSON/XLSX file instead.')
    }
    sampleMeta = (payload && payload.sample) || null
    candidates = planForSample({ sample, explicitKind, rules, kinds })
    if (candidates.length === 0) {
      return failure('no_candidate', `no curated demo covers sample "${sample}"${explicitKind ? ` as "${explicitKind}"` : ''}`, 'Call sci_plot_capabilities for the sample list, or pass a file path and an explicit spec through sci_plot_render.')
    }
  } else {
    let profile = null
    try {
      service.assertDatasetPath(path, { allowAny: true })
      const dataset = await service.loadTable(path)
      profile = profileRows(dataset.columns, dataset.rows)
    } catch (error) {
      const hint = error && typeof error.detail === 'string' && error.detail.length > 0
        ? error.detail
        : 'Pass an existing absolute .csv/.tsv/.json/.xlsx path, and make sure the file is readable.'
      return failure('invalid_data', messageOf(error), hint)
    }
    columns = profile.columns
    if (profile.columns.filter((column) => column && column.kind === 'numeric').length === 0) {
      return failure('invalid_data', 'the dataset has no numeric column', 'A scientific figure needs at least one numeric column; check that the file is parsed correctly or pass a different file.')
    }
    const recommendations = recommend(profile)
    candidates = planForFile({ explicitKind, rules, recommendations, columns, providedMapping: isObject(input.mapping) ? input.mapping : null })
    if (candidates.length === 0) {
      const fallback = fallbackCandidate({ explicitKind, columns, kindList: kinds })
      if (!fallback) {
        return failure('no_candidate', 'the dataset has no usable chart mapping', 'Check the file: it needs at least one numeric column, or a category plus a number. Call sci_plot_inspect_data to see the profiled columns.')
      }
      candidates = [fallback]
    }
  }

  const failures = []
  let rendered = 0
  let gateRepaired = false
  for (const plan of candidates.slice(0, 4)) {
    const planMapping = completeMapping(plan.kind, plan.mapping, columns)
    const styleOverride = inheritedStyle ? { ...inheritedStyle } : {}
    const domain = str(input.domain) || plan.domain || ''
    if (domain) styleOverride.domain = domain
    if (str(input.journal)) styleOverride.journal = str(input.journal)
    if (str(input.palette)) styleOverride.palette = str(input.palette)
    if (str(input.font)) styleOverride.font = str(input.font)
    if (str(input.size)) styleOverride.size = str(input.size)
    if (Number.isFinite(Number(input.dpi))) styleOverride.dpi = Math.max(72, Math.min(1200, Math.round(Number(input.dpi))))
    const spec = { kind: plan.kind }
    if (sample && plan.demo) {
      spec.data = clone(plan.demo.data)
      spec.data.sample = sample
      if (isObject(plan.demo.data.mapping)) spec.data.mapping = clone(plan.demo.data.mapping)
      if (isObject(plan.demo.style)) Object.assign(spec.style = {}, clone(plan.demo.style))
      if (isObject(plan.demo.labels)) spec.labels = clone(plan.demo.labels)
      if (isObject(plan.demo.options)) spec.options = clone(plan.demo.options)
    } else {
      spec.data = { path, mapping: clone(planMapping) }
    }
    spec.style = { ...(spec.style || {}), ...styleOverride }
    if (!spec.style.domain) spec.style.domain = settings.defaultDomain
    const mapping = isObject(spec.data.mapping) ? spec.data.mapping : {}
    let labels = labelsFromMapping(mapping)
    const templateDemo = DEMOS.find((item) => item.kind === plan.kind)
    const sameColumns = isObject(templateDemo) && isObject(templateDemo.data) && isObject(templateDemo.data.mapping)
      && Object.keys(templateDemo.data.mapping).every((key) => !str(templateDemo.data.mapping[key]) || templateDemo.data.mapping[key] === planMapping[key])
    if (sameColumns && isObject(templateDemo.labels)) labels = { ...labels, ...clone(templateDemo.labels) }
    if (isObject(plan.demo) && isObject(plan.demo.labels)) labels = { ...labels, ...clone(plan.demo.labels) }
    if (isObject(input.labels)) labels = { ...labels, ...clone(input.labels) }
    spec.labels = labels
    if (isObject(input.options)) spec.options = { ...(spec.options || {}), ...clone(input.options) }

    let figure = null
    try {
      figure = await service.render(spec, { allowAnyPath: true, title: str(input.title) })
      rendered += 1
    } catch (error) {
      failures.push({ kind: plan.kind, code: error?.code || 'render_failed', error: String(error?.message || error).slice(0, 220) })
      continue
    }

    const score = Number(figure?.quality?.score)
    if (Number.isFinite(score) && score < gate) {
      const patch = repairSpec(spec, figure.quality)
      if (patch) {
        let repaired = null
        try {
          repaired = await service.render(patch, { allowAnyPath: true, title: str(input.title) })
          rendered += 1
          const repairedScore = Number(repaired?.quality?.score)
          if (Number.isFinite(repairedScore) && repairedScore >= score) {
            await service.deleteFigure(figure.id)
            figure = repaired
            gateRepaired = true
          } else {
            await service.deleteFigure(repaired.id)
          }
        } catch (error) {
          failures.push({ kind: plan.kind, code: error?.code || 'render_failed', error: String(error?.message || error).slice(0, 160) })
        }
      }
    }

    const finalScore = Number(figure?.quality?.score)
    const gateMet = !Number.isFinite(finalScore) || finalScore >= gate
    const alternatives = candidates
      .filter((item) => item.kind !== plan.kind)
      .slice(0, 2)
      .map((item) => ({ kind: item.kind, nameZh: kindName(item.kind, kinds), reasonZh: item.reasonZh || '' }))
    return {
      ok: true,
      figure: compactFigure(figure),
      quality: {
        score: figure.quality?.score,
        grade: figure.quality?.grade,
        gate,
        gateMet,
        repaired: gateRepaired,
        issues: qualityIssues(figure.quality),
      },
      chosen: {
        kind: figure.kind,
        kindNameZh: figure.kindNameZh || kindName(figure.kind, kinds),
        domain: figure.domain,
        domainNameZh: figure.domainNameZh,
        journal: figure.journal,
        mapping: planMapping,
        dataSource: sample ? { sample } : { path },
        reasonZh: plan.reasonZh || '按数据结构自动选型',
        reasonEn: plan.reasonEn || 'chosen from the data profile',
        confidence: plan.confidence,
        requestedKind: explicitKind || null,
        requestedKindMet: !explicitKind || explicitKind === figure.kind,
      },
      caption: captionFor(figure, { mapping: planMapping }),
      alternatives,
      attempts: rendered,
      next: gateMet
        ? `Figure saved. Iterate by fetching its spec with sci_plot_figures {action:"get", id:"${figure.id}"}, change only the requested fields and call sci_plot_render; export with sci_plot_export {figureId:"${figure.id}", formats:["tiff","pdf"]}.`
        : `Quality ${finalScore} is below the ${gate} gate. Fix the listed issues (e.g. width size, labels, palette) or disclose them; sci_plot_figures action:"get" returns the spec to edit.`,
    }
  }

  return {
    ...failure('render_failed', 'every candidate mapping failed to render', 'The automatic mapping did not fit this dataset; use the manual chain with an explicit spec.'),
    attempts: rendered,
    failures: failures.slice(0, 4),
  }
}
