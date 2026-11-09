/**
 * Integration tests against a running DSH web server with dsh-sci-plot installed.
 *
 * Requires the plugin to be installed and the harness web GUI to be up. Set
 * DSH_WEB_URL when the GUI is not on the default loopback port.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

const BASE = (process.env.DSH_WEB_URL || 'http://127.0.0.1:53573').replace(/\/+$/u, '')
const HEADER = { 'x-dsh-sci-plot': '1' }

async function api(path, options = {}) {
  const response = await fetch(`${BASE}/dsh-sci-plot${path}`, {
    ...options,
    headers: { ...HEADER, ...(options.headers || {}) },
  })
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  return { status: response.status, payload }
}

const reachable = await (async () => {
  try {
    const response = await fetch(`${BASE}/dsh-sci-plot/api/state`, { headers: HEADER, signal: AbortSignal.timeout(4000) })
    return response.ok || response.status < 500
  } catch {
    return false
  }
})()
const reason = `plugin API not reachable at ${BASE}`

test('live: state returns figures, capabilities, gallery and engine status', { skip: !reachable && reason }, async () => {
  const { status, payload } = await api('/api/state')
  assert.equal(status, 200)
  assert.equal(payload.ok, true)
  const data = payload.data
  assert.ok(Array.isArray(data.figures))
  assert.ok(data.capabilities.kinds.length > 0)
  assert.ok(Array.isArray(data.gallery))
  assert.equal(typeof data.engine.available, 'boolean')
  assert.ok(data.paths.dataDir)
})

test('live: render endpoint produces a figure that can be fetched as PNG', { skip: !reachable && reason }, async () => {
  const { status, payload } = await api('/api/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      spec: {
        kind: 'line',
        data: { sample: 'growth', mapping: { x: 'time_h', y: 'od600', group: 'condition' } },
        style: { domain: 'life-science', journal: 'nature', size: 'single' },
        labels: { x: 'Time (h)', y: 'OD$_{600}$' },
      },
      title: 'integration line',
    }),
  })
  assert.equal(status, 200)
  assert.equal(payload.ok, true)
  const figure = payload.data.figure
  assert.match(figure.id, /^fig-/u)
  assert.ok(figure.quality.score >= 90)

  const image = await fetch(`${BASE}${figure.pngUrl}`)
  assert.equal(image.status, 200)
  const bytes = Buffer.from(await image.arrayBuffer())
  assert.ok(bytes.length > 2000)
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature')

  const thumb = await fetch(`${BASE}${figure.thumbUrl}`)
  assert.equal(thumb.status, 200)

  const deleted = await api(`/api/figures/${figure.id}/delete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(deleted.payload.ok, true)
})

test('live: bad requests are rejected with structured errors', { skip: !reachable && reason }, async () => {
  const missing = await fetch(`${BASE}/dsh-sci-plot/api/state`)
  const payload = await missing.json()
  assert.equal(payload.ok, false)
  assert.equal(missing.status, 403)

  const invalid = await api('/api/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ spec: { kind: 'line' } }),
  })
  assert.equal(invalid.status, 400)
  assert.equal(invalid.payload.ok, false)
})
