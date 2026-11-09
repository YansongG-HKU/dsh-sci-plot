/**
 * Dataset handling: tolerant CSV/TSV/JSON parsing, column profiling, chart
 * recommendations and discovery of data files in the workspace.
 *
 * This module is pure Node — no Python required — so the panel can browse and
 * profile data even when the rendering engine is unavailable.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'

const DATA_EXTENSIONS = new Set(['.csv', '.tsv', '.txt', '.json', '.xlsx'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build', 'out', '.next', '.cache', 'target', 'coverage', '__pycache__', '.venv', 'venv'])
const MAX_FILE_BYTES = 25 * 1024 * 1024
const PREVIEW_BYTES = 512 * 1024
const MAX_ROWS = 60000

export function isDataFile(path) {
  return DATA_EXTENSIONS.has(extname(String(path || '')).toLowerCase())
}

/** Detect the delimiter of a delimited text file. */
export function detectDelimiter(sample) {
  const firstLine = sample.split(/\r?\n/u).find((line) => line.trim().length > 0) || ''
  const counts = { ',': 0, '\t': 0, ';': 0 }
  let quoted = false
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted
    else if (!quoted && char in counts) counts[char] += 1
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] > 0) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

/** Split one delimited line honouring double quotes. */
function splitLine(line, delimiter) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true
    } else if (char === delimiter) {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells.map((value) => value.trim())
}

/** Parse delimited text into { columns, rows }. */
export function parseDelimited(text, delimiter) {
  const input = String(text || '').replace(/^\uFEFF/u, '')
  const delim = delimiter || detectDelimiter(input)
  const lines = input.split(/\r?\n/u).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return { columns: [], rows: [], delimiter: delim }
  const columns = splitLine(lines[0], delim).map((name, index) => name || `col${index + 1}`)
  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i], delim)
    const row = {}
    for (let c = 0; c < columns.length; c += 1) {
      row[columns[c]] = cells[c] !== undefined ? cells[c] : ''
    }
    rows.push(row)
    if (rows.length >= MAX_ROWS) break
  }
  return { columns, rows, delimiter: delim }
}

/** Parse JSON rows: an array of objects, or {rows/columns} object. */
export function parseJsonRows(text) {
  const parsed = JSON.parse(String(text || '').replace(/^\uFEFF/u, ''))
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { columns: [], rows: [] }
    if (Array.isArray(parsed[0])) {
      const width = Math.max(...parsed.map((row) => (Array.isArray(row) ? row.length : 0)))
      const columns = Array.from({ length: width }, (_, index) => `col${index + 1}`)
      return { columns, rows: parsed.map((row) => Object.fromEntries(columns.map((name, index) => [name, Array.isArray(row) ? row[index] : '']))) }
    }
    const columns = []
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        for (const key of Object.keys(item)) if (!columns.includes(key)) columns.push(key)
      }
    }
    return { columns, rows: parsed.filter((item) => item && typeof item === 'object').slice(0, MAX_ROWS) }
  }
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.rows)) {
      const rows = parsed.rows
      const columns = Array.isArray(parsed.columns) ? parsed.columns.map(String) : rows[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : []
      return { columns, rows: rows.slice(0, MAX_ROWS) }
    }
    if (parsed.data && Array.isArray(parsed.data)) return parseJsonRows(JSON.stringify(parsed.data))
  }
  throw new Error('JSON data must be an array of rows or { rows: [...] }')
}

/** Read a dataset file from disk (bounded). */
export function loadDatasetFile(path, { maxBytes = MAX_FILE_BYTES } = {}) {
  const resolved = resolve(String(path || ''))
  const info = statSync(resolved)
  if (!info.isFile()) throw new Error(`not a file: ${resolved}`)
  if (info.size > maxBytes) throw new Error(`data file is too large (${Math.round(info.size / 1024 / 1024)} MB), max ${Math.round(maxBytes / 1024 / 1024)} MB`)
  if (!isDataFile(resolved)) throw new Error(`unsupported data type: ${extname(resolved) || '(none)'}; use CSV, TSV or JSON`)
  const text = readFileSync(resolved, 'utf8')
  const ext = extname(resolved).toLowerCase()
  if (ext === '.json') return { ...parseJsonRows(text), path: resolved, size: info.size }
  const parsed = parseDelimited(text, ext === '.tsv' ? '\t' : undefined)
  return { ...parsed, path: resolved, size: info.size }
}

function toNumber(value) {
  if (value === null || value === undefined) return Number.NaN
  if (typeof value === 'number') return value
  const text = String(value).trim().replace(/,/gu, '')
  if (text.length === 0 || ['na', 'nan', 'null', 'none', '-'].includes(text.toLowerCase())) return Number.NaN
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/** Classify each column and collect descriptive statistics. */
export function profileRows(columns, rows) {
  const items = []
  for (const name of columns) {
    const values = rows.map((row) => row[name])
    const numbers = values.map(toNumber)
    const numericRatio = values.length === 0 ? 0 : numbers.filter((value) => Number.isFinite(value)).length / values.length
    const item = { name, kind: numericRatio >= 0.7 ? 'numeric' : 'categorical' }
    if (item.kind === 'numeric') {
      const finite = numbers.filter((value) => Number.isFinite(value))
      item.missing = numbers.length - finite.length
      if (finite.length > 0) {
        const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length
        const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length
        item.min = round(finite.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY))
        item.max = round(finite.reduce((max, value) => Math.max(max, value), Number.NEGATIVE_INFINITY))
        item.mean = round(mean)
        item.std = round(Math.sqrt(variance))
      }
    } else {
      const levels = []
      for (const value of values) {
        const text = String(value ?? '')
        if (!levels.includes(text)) levels.push(text)
        if (levels.length > 60) break
      }
      item.levels = levels.length
      item.sample = levels.slice(0, 10)
    }
    items.push(item)
  }
  return { columns: items, rows: rows.length }
}

function round(value) {
  return Math.round(value * 1000) / 1000
}

/** Suggest figure kinds + mappings for a profiled table. */
export function recommend(profile) {
  const columns = profile.columns || []
  const numeric = columns.filter((column) => column.kind === 'numeric')
  const categorical = columns.filter((column) => column.kind === 'categorical')
  const names = columns.map((column) => column.name)
  const lower = (name) => String(name).toLowerCase()
  const find = (...hints) => names.find((name) => hints.some((hint) => lower(name).includes(hint)))
  const recs = []
  const add = (kind, mapping, domain, reasonZh, reasonEn, score = 0.8) => {
    if (recs.some((item) => item.kind === kind)) return
    recs.push({ kind, mapping, domain, reason_zh: reasonZh, reason_en: reasonEn, confidence: score })
  }

  const timeColumn = find('time', 'date', 'month', 'year', 'week', 'day', 'hour', 'timestamp', 'epoch', '时间', '日期')
  const pColumn = find('p_value', 'pvalue', 'p_adj', 'fdr', 'padj', 'neglog', '_p')
  const fcColumn = find('log2fc', 'logfc', 'fold_change', 'foldchange')
  const eventColumn = find('event', 'status', 'death', 'relapse')
  const rowColumn = find('row', 'gene', 'feature', 'item')
  const colColumn = find('col', 'sample', 'condition', 'group')
  const valueColumn = find('value', 'zscore', 'expression', 'intensity', 'abundance')

  if (fcColumn && pColumn) {
    add('volcano', { x: fcColumn, y: pColumn }, 'omics', '检测到 log2FC 与显著性列，适合火山图', 'log2FC and p-value columns suggest a volcano plot', 0.95)
  }
  if (timeColumn && eventColumn && categorical.length > 0) {
    add('km_survival', { time: timeColumn, event: eventColumn, group: categorical[0].name }, 'clinical', '检测到随访时间、事件与分组列，适合生存曲线', 'Follow-up time, event and group columns suggest Kaplan-Meier', 0.9)
  }
  if (rowColumn && colColumn && valueColumn && numeric.length === 1) {
    add('heatmap', { row: rowColumn, col: colColumn, value: valueColumn }, 'omics', '长表矩阵结构，适合热图', 'Long-format matrix suggests a heatmap', 0.9)
    add('cluster_heatmap', { row: rowColumn, col: colColumn, value: valueColumn }, 'omics', '可对行列聚类后绘制热图', 'Clustered heatmap is available for the matrix', 0.75)
  }
  const group = categorical.find((column) => (column.levels || 99) <= 8 && (column.levels || 0) >= 2)
  if (numeric.length >= 1 && categorical.length >= 1 && numeric[0] && categorical[0]) {
    const y = numeric[0].name
    const x = categorical[0].name
    if (group && group.name !== x) {
      add('bar_grouped', { x, y, group: group.name }, 'general', '一个分类变量 + 一个分组 + 一个数值，适合分组柱状图', 'Category + group + number suggests grouped bars', 0.85)
      add('box', { x, y, group: group.name }, 'life-science', '分组数值分布，适合箱线图', 'Grouped numeric distributions suggest box plots', 0.8)
    } else {
      add('bar', { x, y }, 'general', '分类 + 数值，适合柱状图', 'Category + number suggests a bar chart', 0.85)
      add('violin', { x, y }, 'life-science', '分类 + 数值，适合小提琴图', 'Category + number suggests a violin plot', 0.72)
    }
  }
  if (timeColumn && numeric.length >= 1) {
    const y = numeric.find((column) => column.name !== timeColumn)?.name || numeric[0].name
    add('line', { x: timeColumn, y }, 'general', '时间列 + 数值列，适合折线/时间序列图', 'Time column + number suggests a line chart', 0.9)
    add('time_series', { x: timeColumn, y }, 'economics', '时间序列带样式预设', 'Time series with a domain preset', 0.72)
  }
  if (numeric.length >= 2) {
    const [x, y] = numeric.filter((column) => column.name !== timeColumn)
    add('scatter', { x: (x || numeric[0]).name, y: (y || numeric[1]).name }, 'general', '两个数值变量，适合散点图/回归', 'Two numeric variables suggest a scatter plot', 0.85)
    add('regression', { x: (x || numeric[0]).name, y: (y || numeric[1]).name }, 'general', '可叠加拟合线与置信带', 'Add a fit with confidence band', 0.65)
  }
  if (numeric.length >= 4) {
    add('corr_heatmap', {}, 'general', '多个数值列，适合相关矩阵', 'Many numeric columns suggest a correlation matrix', 0.8)
    add('pairplot', {}, 'general', '散点矩阵可快速审阅全部数值列', 'A pair plot reviews all numeric columns', 0.6)
  }
  if (numeric.length === 1 && categorical.length === 0) {
    add('histogram', { x: numeric[0].name }, 'general', '单一数值列，适合直方图/密度图', 'One numeric column suggests a histogram', 0.85)
    add('density', { x: numeric[0].name }, 'math', '单一数值列的核密度估计', 'Kernel density of one numeric column', 0.65)
  }
  if (recs.length === 0) {
    add('bar', {}, 'general', '先按默认映射出图，再在工作室里调整字段', 'Render with automatic mapping, then refine fields', 0.4)
  }
  return recs.slice(0, 6)
}

function walk(root, depth, output, budget) {
  if (depth > 3 || output.length >= budget) return
  let entries = []
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (output.length >= budget) return
    const name = entry.name
    if (entry.isDirectory()) {
      if (name.startsWith('.') || SKIP_DIRS.has(name.toLowerCase())) continue
      walk(join(root, name), depth + 1, output, budget)
    } else if (entry.isFile() && isDataFile(name)) {
      const full = join(root, name)
      try {
        const info = statSync(full)
        if (info.size > MAX_FILE_BYTES) continue
        output.push({ path: full, name, size: info.size, modifiedAt: info.mtime.toISOString() })
      } catch {
        /* skip unreadable */
      }
    }
  }
}

/** Inspect only the header + first rows so browsing stays fast. */
export function quickInspect(path) {
  const resolved = resolve(String(path || ''))
  const info = statSync(resolved)
  const buffer = readFileSync(resolved)
  const text = buffer.subarray(0, Math.min(buffer.length, PREVIEW_BYTES)).toString('utf8')
  const ext = extname(resolved).toLowerCase()
  let parsed
  if (ext === '.json') {
    parsed = parseJsonRows(text.endsWith(']') || text.endsWith('}') ? text : `${text}`)
  } else {
    const lines = text.split(/\r?\n/u)
    const cut = lines.slice(0, 40).join('\n')
    parsed = parseDelimited(cut, ext === '.tsv' ? '\t' : undefined)
  }
  const profile = profileRows(parsed.columns, parsed.rows)
  return {
    path: resolved,
    name: resolved.split(/[\\/]/u).pop(),
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
    columns: profile.columns,
    sampleRows: parsed.rows.slice(0, 8),
    sampledRows: parsed.rows.length,
  }
}

/** Discover data files in a workspace, bounded and cached by the caller. */
export function discoverDatasets(rootDir, { budget = 300 } = {}) {
  const root = resolve(String(rootDir || '.'))
  const found = []
  walk(root, 0, found, budget)
  const results = []
  for (const file of found) {
    try {
      const inspected = quickInspect(file.path)
      results.push({
        id: makeDatasetId(file.path),
        path: file.path,
        name: file.name,
        ext: extname(file.name).toLowerCase(),
        size: file.size,
        modifiedAt: file.modifiedAt,
        rows: inspected.sampledRows,
        columns: inspected.columns,
        sampleRows: inspected.sampleRows,
      })
    } catch {
      /* unreadable data file: skip */
    }
  }
  return results.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
}

export function makeDatasetId(path) {
  let hash = 0
  const text = String(path || '')
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return `ws-${hash.toString(36)}`
}

/** Restrict an absolute data path to an approved root directory. */
export function isInside(rootDir, candidate) {
  try {
    const root = resolve(String(rootDir)).toLowerCase()
    const target = resolve(String(candidate)).toLowerCase()
    return target === root || target.startsWith(root.endsWith(sep) ? root : root + sep)
  } catch {
    return false
  }
}

export function datasetExists(path) {
  try {
    return existsSync(path) && statSync(path).isFile()
  } catch {
    return false
  }
}
