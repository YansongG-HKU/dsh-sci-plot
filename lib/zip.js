/**
 * Minimal ZIP reader/writer (no third-party dependency).
 *
 * Writer: deflate (method 8) entries with UTF-8 names, used for the multi-figure
 * delivery pack. Reader: central-directory walk with stored/deflate support, used
 * by the XLSX reader. Enough for OOXML packages and our own archives; it is not a
 * general-purpose ZIP64/encryption implementation.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const UTF8_FLAG = 0x0800

let crcTable = null

function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f)
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f)
  return { time: time & 0xffff, day: day & 0xffff }
}

/**
 * Write a ZIP archive.
 * @param {string} target absolute output path
 * @param {{name: string, data: Buffer|string}[]} entries
 */
export function writeZip(target, entries) {
  const chunks = []
  const central = []
  let offset = 0
  const stamp = dosDateTime()
  for (const entry of entries) {
    const name = String(entry.name || '').replace(/\\/gu, '/').replace(/^\/+/u, '')
    if (!name || name.split('/').includes('..')) throw new Error(`invalid zip entry name: ${entry.name}`)
    const nameBuffer = Buffer.from(name, 'utf8')
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ''), 'utf8')
    const deflated = deflateRawSync(raw)
    const useDeflate = deflated.length < raw.length
    const payload = useDeflate ? deflated : raw
    const method = useDeflate ? 8 : 0
    const checksum = crc32(raw)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(SIG_LOCAL, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(UTF8_FLAG, 6)
    header.writeUInt16LE(method, 8)
    header.writeUInt16LE(stamp.time, 10)
    header.writeUInt16LE(stamp.day, 12)
    header.writeUInt32LE(checksum, 14)
    header.writeUInt32LE(payload.length, 18)
    header.writeUInt32LE(raw.length, 22)
    header.writeUInt16LE(nameBuffer.length, 26)
    header.writeUInt16LE(0, 28)
    chunks.push(header, nameBuffer, payload)
    central.push({ nameBuffer, method, checksum, csize: payload.length, usize: raw.length, offset })
    offset += header.length + nameBuffer.length + payload.length
  }
  const centralStart = offset
  for (const item of central) {
    const header = Buffer.alloc(46)
    header.writeUInt32LE(SIG_CENTRAL, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(UTF8_FLAG, 8)
    header.writeUInt16LE(item.method, 10)
    header.writeUInt16LE(stamp.time, 12)
    header.writeUInt16LE(stamp.day, 14)
    header.writeUInt32LE(item.checksum, 16)
    header.writeUInt32LE(item.csize, 20)
    header.writeUInt32LE(item.usize, 24)
    header.writeUInt16LE(item.nameBuffer.length, 28)
    header.writeUInt16LE(0, 30)
    header.writeUInt16LE(0, 32)
    header.writeUInt16LE(0, 34)
    header.writeUInt16LE(0, 36)
    header.writeUInt32LE(0, 38)
    header.writeUInt32LE(item.offset, 42)
    chunks.push(header, item.nameBuffer)
  }
  const centralSize = offset - centralStart
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(SIG_EOCD, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(central.length, 8)
  eocd.writeUInt16LE(central.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(centralStart, 16)
  eocd.writeUInt16LE(0, 20)
  chunks.push(eocd)
  const buffer = Buffer.concat(chunks)
  writeFileSync(target, buffer)
  return { path: target, entries: central.length, bytes: buffer.length }
}

/**
 * Read a ZIP archive into an ordered map name → Buffer.
 * @param {string|Buffer} source path or archive bytes
 */
export function readZip(source) {
  const buffer = Buffer.isBuffer(source) ? source : readFileSync(source)
  let eocd = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a ZIP archive: end of central directory not found')
  const count = buffer.readUInt16LE(eocd + 10)
  const start = buffer.readUInt32LE(eocd + 16)
  const entries = new Map()
  let cursor = start
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIG_CENTRAL) throw new Error('invalid ZIP central directory')
    const method = buffer.readUInt16LE(cursor + 10)
    const csize = buffer.readUInt32LE(cursor + 20)
    const usize = buffer.readUInt32LE(cursor + 24)
    const nameLen = buffer.readUInt16LE(cursor + 28)
    const extraLen = buffer.readUInt16LE(cursor + 30)
    const commentLen = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLen)
    cursor += 46 + nameLen + extraLen + commentLen
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== SIG_LOCAL) throw new Error(`invalid ZIP local header for ${name}`)
    const localNameLen = buffer.readUInt16LE(localOffset + 26)
    const localExtraLen = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const payload = buffer.subarray(dataStart, dataStart + csize)
    if (dataStart + csize > buffer.length) throw new Error(`truncated ZIP entry: ${name}`)
    let data
    if (method === 0) data = Buffer.from(payload)
    else if (method === 8) data = inflateRawSync(payload)
    else throw new Error(`unsupported ZIP compression method ${method} for ${name}`)
    if (data.length !== usize) throw new Error(`ZIP size mismatch for ${name}`)
    entries.set(name, data)
  }
  return entries
}

/** Read one entry from a ZIP source as UTF-8 text. */
export function readZipText(source, name) {
  const entries = Buffer.isBuffer(source) ? readZip(source) : readZip(source)
  const data = entries.get(name)
  return data === undefined ? null : data.toString('utf8')
}
