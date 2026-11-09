/** Small shared helpers. Kept dependency-free and side-effect free. */

export function messageOf(error) {
  if (error === null || error === undefined) return 'unknown error'
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message.length > 0) return error.message
  return String(error)
}

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

export function newId(prefix = 'f') {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const random = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${stamp}-${random}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value))
}

export function truncateUtf8(text, maxBytes) {
  const value = String(text ?? '')
  const buffer = Buffer.from(value, 'utf8')
  if (buffer.length <= maxBytes) return { text: value, truncated: false }
  let end = maxBytes
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end -= 1
  return { text: buffer.subarray(0, end).toString('utf8'), truncated: true }
}

export function toText(value) {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return String(value)
  }
}

/** Escape a value for inclusion in a JSON response (objects pass through). */
export function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (['true', '1', 'yes', 'on'].includes(value.toLowerCase())) return true
    if (['false', '0', 'no', 'off'].includes(value.toLowerCase())) return false
  }
  return fallback
}

export function num(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
