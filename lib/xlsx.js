/**
 * Minimal XLSX (SpreadsheetML) reader with no third-party dependency.
 *
 * OOXML workbooks are ZIP packages of XML parts: this module opens the package
 * with `readZip`, reads shared strings / cell styles / the first non-empty
 * worksheet, and returns a plain `{columns, rows, sheet, sheets}` table that the
 * rest of the plugin already understands. Legacy binary `.xls` is rejected with
 * a repair hint (save as .xlsx or CSV).
 *
 * Supported cell shapes: shared strings (t="s"), inline strings (t="inlineStr"),
 * formula results (t="str"), booleans (t="b"), numbers and date-styled numbers.
 * Formulas are not evaluated; their cached `<v>` results are used.
 */
import { statSync } from 'node:fs'

import { LIMITS } from './config.js'
import { readZip } from './zip.js'

const MAX_XLSX_BYTES = 20 * 1024 * 1024

function decodeXml(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&')
}

function textNodes(xml) {
  const out = []
  const pattern = /<t\b[^>]*>([\s\S]*?)<\/t>/gu
  let match
  while ((match = pattern.exec(xml)) !== null) out.push(decodeXml(match[1]))
  return out.join('')
}

function parseSharedStrings(xml) {
  const out = []
  if (!xml) return out
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gu
  let match
  while ((match = pattern.exec(xml)) !== null) out.push(textNodes(match[1]))
  return out
}

const DEFAULT_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

function parseStyles(xml) {
  const cellXfs = []
  const dateFormats = new Set(DEFAULT_DATE_FORMATS)
  if (!xml) return { cellXfs, dateFormats }
  const custom = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"[^>]*\/>/gu
  let match
  while ((match = custom.exec(xml)) !== null) {
    const code = decodeXml(match[2]).toLowerCase()
    if (/[ymd]/u.test(code)) dateFormats.add(Number(match[1]))
  }
  const block = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/u)
  if (block) {
    const xf = /<xf\b[^>]*\/?>/gu
    while ((match = xf.exec(block[1])) !== null) {
      const numFmt = match[0].match(/numFmtId="(\d+)"/u)
      cellXfs.push(numFmt ? Number(numFmt[1]) : 0)
    }
  }
  return { cellXfs, dateFormats }
}

function columnIndex(ref) {
  const letters = String(ref || '').match(/^([A-Z]+)/iu)
  if (!letters) return -1
  let index = 0
  for (const char of letters[1].toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function serialToDate(serial) {
  const days = Number(serial)
  if (!Number.isFinite(days)) return null
  const ms = Date.UTC(1899, 11, 30) + days * 86400000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  const iso = date.toISOString()
  return Math.abs(days - Math.floor(days)) < 1e-6 ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ')
}

function cellValue(attrs, inner, shared, styles) {
  const type = (attrs.match(/t="([^"]+)"/u) || [])[1] || ''
  const styleIndex = Number((attrs.match(/s="(\d+)"/u) || [])[1] || 0)
  if (type === 'inlineStr') return decodeXml(textNodes(inner || ''))
  const raw = (inner || '').match(/<v\b[^>]*>([\s\S]*?)<\/v>/u)
  if (!raw) return null
  const text = decodeXml(raw[1]).trim()
  if (type === 's') return shared[Number(text)] ?? ''
  if (type === 'str' || type === 'e') return text
  if (type === 'b') return text === '1' ? 1 : 0
  if (text.length === 0) return null
  const numfmt = styles.cellXfs[styleIndex]
  if (numfmt !== undefined && styles.dateFormats.has(numfmt)) {
    const asDate = serialToDate(text)
    if (asDate) return asDate
  }
  const number = Number(text)
  return Number.isFinite(number) ? number : text
}

function parseSheet(xml, shared, styles) {
  const rows = []
  if (!xml) return rows
  const rowPattern = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/gu
  let match
  while ((match = rowPattern.exec(xml)) !== null) {
    const inner = match[2] || ''
    const cells = []
    let cursor = 0
    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu
    let cell
    while ((cell = cellPattern.exec(inner)) !== null) {
      const attrs = cell[1] || ''
      const refMatch = attrs.match(/r="([A-Z]+\d+)"/iu)
      let index = refMatch ? columnIndex(refMatch[1]) : cells.length
      if (index < 0) index = cells.length
      while (cells.length < index) cells.push(null)
      cells.push(cellValue(attrs, cell[2], shared, styles))
      cursor = index + 1
    }
    void cursor
    while (cells.length > 0 && cells[cells.length - 1] === null) cells.pop()
    rows.push(cells)
  }
  return rows
}

function uniqueHeaders(values) {
  const headers = []
  const seen = new Map()
  for (let i = 0; i < values.length; i += 1) {
    let base = values[i] === null || values[i] === undefined ? '' : String(values[i]).trim()
    if (!base) base = `Column${i + 1}`
    const count = seen.get(base) || 0
    seen.set(base, count + 1)
    headers.push(count === 0 ? base : `${base}_${count + 1}`)
  }
  return headers
}

function tableFromRows(rows) {
  let headerIndex = rows.findIndex((row) => Array.isArray(row) && row.some((value) => value !== null && String(value).trim() !== ''))
  if (headerIndex < 0) return { columns: [], rows: [] }
  const headers = uniqueHeaders(rows[headerIndex])
  const records = []
  for (let i = headerIndex + 1; i < rows.length && records.length < LIMITS.maxDataRows; i += 1) {
    const row = rows[i]
    if (!Array.isArray(row) || row.every((value) => value === null || String(value).trim() === '')) continue
    const record = {}
    for (let col = 0; col < headers.length; col += 1) record[headers[col]] = row[col] === undefined ? null : row[col]
    records.push(record)
  }
  return { columns: headers, rows: records }
}

function workbookSheets(entries) {
  const sheets = []
  const rels = entries.get('xl/_rels/workbook.xml.rels')
  const targets = new Map()
  if (rels) {
    const pattern = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/gu
    let match
    while ((match = pattern.exec(rels.toString('utf8'))) !== null) targets.set(match[1], match[2])
  }
  const workbook = entries.get('xl/workbook.xml')
  if (workbook) {
    const pattern = /<sheet\b([^>]*)\/?>/gu
    let match
    while ((match = pattern.exec(workbook.toString('utf8'))) !== null) {
      const attrs = match[1] || ''
      const name = decodeXml((attrs.match(/name="([^"]*)"/u) || [])[1] || '')
      const relId = (attrs.match(/r:id="([^"]+)"/u) || [])[1] || ''
      let target = targets.get(relId) || ''
      target = target.replace(/^\/+/u, '').replace(/^xl\//u, '')
      if (!target) {
        const fallback = entries.get('xl/workbook.xml')
        void fallback
      }
      sheets.push({ name: name || `Sheet${sheets.length + 1}`, path: target ? `xl/${target}` : '' })
    }
  }
  if (sheets.length === 0) {
    const files = [...entries.keys()]
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(name))
      .sort((a, b) => Number(a.match(/(\d+)\.xml/u)[1]) - Number(b.match(/(\d+)\.xml/u)[1]))
    for (const file of files) sheets.push({ name: file.replace(/^xl\/worksheets\//u, '').replace(/\.xml$/u, ''), path: file })
  }
  return sheets
}

/**
 * Read the first non-empty worksheet of an XLSX workbook.
 * @param {string} path absolute path
 * @returns {{columns: string[], rows: object[], sheet: string, sheets: string[]}}
 */
export function readXlsx(path) {
  const info = statSync(path)
  if (info.size > MAX_XLSX_BYTES) throw new Error(`xlsx file is too large (${info.size} bytes)`)
  const entries = readZip(path)
  const shared = parseSharedStrings(entries.get('xl/sharedStrings.xml')?.toString('utf8') || '')
  const styles = parseStyles(entries.get('xl/styles.xml')?.toString('utf8') || '')
  const sheets = workbookSheets(entries)
  const names = sheets.map((sheet) => sheet.name)
  for (const sheet of sheets) {
    const xml = entries.get(sheet.path || '')?.toString('utf8') || ''
    if (!xml) continue
    const table = tableFromRows(parseSheet(xml, shared, styles))
    if (table.columns.length > 0) return { ...table, sheet: sheet.name, sheets: names }
  }
  return { columns: [], rows: [], sheet: names[0] || '', sheets: names }
}

/** True when the file name looks like an OOXML workbook. */
export function isXlsxFile(path) {
  return /\.xlsx$/iu.test(String(path || ''))
}

/** True when the file name looks like a legacy binary workbook. */
export function isLegacyXlsFile(path) {
  return /\.xls$/iu.test(String(path || ''))
}
