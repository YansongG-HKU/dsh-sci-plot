/**
 * Loopback HTTP routes for the Scientific plot panel.
 *
 * Security model (same as the other local panels):
 *   - registered through the optional `webServer` service; a headless profile
 *     still activates the tools and the store,
 *   - JSON API requests need this plugin's header, a loopback Host and, when
 *     present, a matching loopback Origin,
 *   - image/file routes are loopback-only and read-only so <img>/<a> work,
 *   - figure ids and gallery names are pattern-validated; file reads stay inside
 *     the store/gallery directories,
 *   - JSON bodies are capped and every response is a `{ok}` envelope or a
 *     structured failure with an HTTP status mapped from its code.
 */
import { createReadStream } from 'node:fs'
import { extname } from 'node:path'
import { LIMITS, PLUGIN_NAME, REQUEST_HEADER, ROUTE_PREFIX } from './config.js'
import { messageOf } from './util.js'

const GET = 'GET'
const POST = 'POST'

export const ROUTES = Object.freeze([
  { route: 'state', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/state$/u },
  { route: 'capabilities', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/capabilities$/u },
  { route: 'figures', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/figures$/u },
  { route: 'figure', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/figures\/([^/]+)$/u },
  { route: 'render', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/render$/u },
  { route: 'export', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/figures\/([^/]+)\/export$/u },
  { route: 'delete', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/figures\/([^/]+)\/delete$/u },
  { route: 'reveal', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/figures\/([^/]+)\/reveal$/u },
  { route: 'figure-file', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/figures\/([^/]+)\/file$/u },
  { route: 'datasets', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/datasets$/u },
  { route: 'dataset-preview', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/datasets\/preview$/u },
  { route: 'validate', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/validate$/u },
  { route: 'settings', methods: [GET, POST], pattern: /^\/dsh-sci-plot\/api\/settings$/u },
  { route: 'engine-refresh', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/engine\/refresh$/u },
  { route: 'diagnostics', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/diagnostics$/u },
  { route: 'gallery', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/gallery$/u },
  { route: 'gallery-asset', methods: [GET], pattern: /^\/dsh-sci-plot\/api\/assets\/gallery\/([^/]+)$/u },
  { route: 'open-data-dir', methods: [POST], pattern: /^\/dsh-sci-plot\/api\/open-data-dir$/u },
])

const LOOPBACK_ONLY = new Set(['figure-file', 'gallery-asset'])

export function statusForCode(code) {
  switch (code) {
    case 'invalid_input':
    case 'invalid_spec':
    case 'invalid_data':
    case 'invalid_mapping':
    case 'unknown_kind':
      return 400
    case 'forbidden':
      return 403
    case 'not_found':
      return 404
    case 'method_not_allowed':
      return 405
    case 'timeout':
      return 504
    case 'no_engine':
    case 'not_ready':
      return 503
    case 'too_large':
      return 413
    default:
      return 500
  }
}

export function serverOrigin(webServer) {
  try {
    const origin = webServer?.getOrigin?.()
    if (typeof origin === 'string' && origin.length > 0) return origin.replace(/\/+$/u, '')
  } catch {
    /* not bound yet */
  }
  const port = Number(webServer?.port)
  if (Number.isFinite(port) && port > 0) return `http://127.0.0.1:${port}`
  return ''
}

function sameLoopbackOrigin(a, b) {
  try {
    const first = new URL(a)
    const second = new URL(b)
    const loopback = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
    return first.protocol === second.protocol && first.port === second.port && loopback.has(first.hostname) && loopback.has(second.hostname)
  } catch {
    return false
  }
}

export function checkLoopbackHost(req) {
  const headers = req?.headers && typeof req.headers === 'object' ? req.headers : {}
  const host = typeof headers.host === 'string' ? headers.host : ''
  if (host.length === 0) return false
  const hostname = host.replace(/:\d+$/u, '').toLowerCase()
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1'
}

export function checkRequestGate(webServer, req) {
  const headers = req?.headers && typeof req.headers === 'object' ? req.headers : {}
  const marker = headers[REQUEST_HEADER]
  const hasMarker = marker === '1' || (Array.isArray(marker) && marker.includes('1'))
  if (!hasMarker) return { ok: false, reason: `missing ${REQUEST_HEADER}: 1 header` }
  if (!checkLoopbackHost(req)) return { ok: false, reason: 'non-loopback Host header' }
  const origin = headers.origin
  if (origin !== undefined) {
    if (typeof origin !== 'string' || origin.length === 0) return { ok: false, reason: 'invalid Origin header' }
    const expected = serverOrigin(webServer)
    if (expected && origin !== expected && !sameLoopbackOrigin(origin, expected)) {
      return { ok: false, reason: 'Origin does not match this server' }
    }
  }
  return { ok: true }
}

export function matchRoute(pathname) {
  for (const descriptor of ROUTES) {
    const match = descriptor.pattern.exec(String(pathname || ''))
    if (!match) continue
    const params = match.slice(1).map((value) => {
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    })
    return { descriptor, params }
  }
  return null
}

export function registerPanel({ ctx, service, log }) {
  if (!ctx || typeof ctx.inject !== 'function') return null
  const warn = (message) => {
    try {
      log?.warn?.(message)
    } catch {
      /* logging never breaks registration */
    }
  }
  try {
    return ctx.inject(['webServer'], (webCtx) => {
      const webServer = webCtx?.webServer
      if (!webServer || typeof webServer.register !== 'function') return null
      const register = () => {
        service.setWebServer?.(webServer)
        return webServer.register({
          kind: 'prefix',
          path: ROUTE_PREFIX,
          handler: (req, res) => {
            void handleRequest(webCtx, service, req, res)
          },
        })
      }
      let dispose = null
      try {
        dispose = typeof webCtx?.effect === 'function' ? webCtx.effect(register, 'dsh-sci-plot: panel routes') : register()
      } catch (error) {
        warn(`could not register the panel routes: ${messageOf(error)}`)
        return null
      }
      return () => {
        try {
          if (typeof dispose === 'function') dispose()
        } catch {
          /* disposal never throws */
        }
        service.setWebServer?.(null)
      }
    })
  } catch (error) {
    warn(`could not attach the panel to the web server: ${messageOf(error)}`)
    return null
  }
}

function queryValue(url, key) {
  try {
    const value = url.searchParams.get(key)
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

export async function handleRequest(webCtx, service, req, res) {
  try {
    let url
    try {
      url = new URL(String(req?.url ?? '/'), 'http://localhost')
    } catch {
      sendJson(res, 400, { ok: false, code: 'invalid_input', error: 'invalid request URL' })
      return
    }
    const match = matchRoute(url.pathname)
    if (!match) {
      sendJson(res, 404, { ok: false, code: 'not_found', error: 'unknown route' })
      return
    }
    const descriptor = match.descriptor
    const method = String(req?.method ?? 'GET').toUpperCase()
    const allowed = descriptor.methods.includes(method) || (method === 'HEAD' && descriptor.methods.includes(GET))
    const headOnly = method === 'HEAD'

    if (LOOPBACK_ONLY.has(descriptor.route)) {
      if (!checkLoopbackHost(req)) {
        sendJson(res, 403, { ok: false, code: 'forbidden', error: 'loopback request required' })
        return
      }
      if (!allowed) {
        sendJson(res, 405, { ok: false, code: 'method_not_allowed', error: `${method} is not allowed on this route` }, { allow: 'GET, HEAD' })
        return
      }
      await serveBinary(descriptor.route, service, req, res, url, match.params, headOnly)
      return
    }

    const gate = checkRequestGate(webCtx?.webServer, req)
    if (!gate.ok) {
      sendJson(res, 403, { ok: false, code: 'forbidden', error: gate.reason || 'request rejected' })
      return
    }
    if (!allowed) {
      const allow = descriptor.methods.join(', ')
      sendJson(res, 405, { ok: false, code: 'method_not_allowed', error: `${method} is not allowed on this route` }, { allow })
      return
    }

    let body = {}
    if (method === 'POST') {
      try {
        body = await readJsonBody(req)
      } catch (error) {
        sendJson(res, statusForCode(error.code || 'invalid_input'), { ok: false, code: error.code || 'invalid_input', error: messageOf(error) })
        return
      }
    }

    const result = await dispatch(descriptor.route, service, match.params, url, body, method)
    sendJson(res, 200, { ok: true, data: result })
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'failed'
    try {
      sendJson(res, statusForCode(code), { ok: false, code, error: messageOf(error), repair: error?.repair ?? null })
    } catch {
      /* response is gone */
    }
  }
}

async function dispatch(route, service, params, url, body, method) {
  switch (route) {
    case 'state':
      return service.getState()
    case 'capabilities':
      return service.capabilities()
    case 'figures':
      return { figures: await service.listFigures(Number(queryValue(url, 'limit')) || 60) }
    case 'figure': {
      const figure = await service.getFigure(params[0], { detail: true })
      if (!figure) throw codedError('not_found', `figure not found: ${params[0]}`)
      return { figure }
    }
    case 'render': {
      if (!body || typeof body !== 'object' || !body.spec) throw codedError('invalid_input', 'body.spec is required')
      const figure = await service.render(body.spec, { allowAnyPath: false, title: typeof body.title === 'string' ? body.title : '' })
      return { figure }
    }
    case 'export': {
      const figure = await service.exportFigure(params[0], {
        formats: body.formats,
        dpi: Number(body.dpi) || undefined,
        widthMm: Number(body.widthMm) || Number(body.width_mm) || undefined,
        journal: typeof body.journal === 'string' ? body.journal : undefined,
        palette: typeof body.palette === 'string' ? body.palette : undefined,
      })
      return { figure }
    }
    case 'delete':
      return service.deleteFigure(params[0])
    case 'reveal':
      return service.revealFigure(params[0])
    case 'datasets':
      return service.datasets(queryValue(url, 'refresh') === '1')
    case 'dataset-preview':
      return service.previewDataset({ path: body.path, sample: body.sample })
    case 'validate':
      return service.validateSpec(body.spec)
    case 'settings':
      if (method === 'POST') return service.saveSettings(body.patch && typeof body.patch === 'object' ? body.patch : body)
      return service.settings()
    case 'engine-refresh':
      return { engine: await service.engineStatus(true) }
    case 'diagnostics':
      return service.diagnostics()
    case 'gallery':
      return { gallery: await service.gallery() }
    case 'open-data-dir':
      return service.revealDataDir()
    default:
      throw codedError('not_found', `unknown route: ${route}`)
  }
}

async function serveBinary(route, service, req, res, url, params, headOnly) {
  if (route === 'figure-file') {
    const format = (queryValue(url, 'format') || 'png').toLowerCase()
    const variant = queryValue(url, 'variant') === 'thumb' ? 'thumb' : 'full'
    const file = await service.store.figureFile(params[0], format, variant)
    if (!file) {
      sendJson(res, 404, { ok: false, code: 'not_found', error: 'figure file not found' })
      return
    }
    writeBinary(res, 200, {
      'content-type': file.mime,
      'content-length': String(file.size),
      'cache-control': 'private, max-age=60',
      'x-content-type-options': 'nosniff',
      'content-disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
    })
    if (headOnly) {
      res.end()
      return
    }
    streamFile(res, file.path)
    return
  }
  if (route === 'gallery-asset') {
    const file = service.store.galleryFile(params[0])
    if (!file) {
      sendJson(res, 404, { ok: false, code: 'not_found', error: 'gallery asset not found' })
      return
    }
    const mime = extname(file.path).toLowerCase() === '.svg' ? 'image/svg+xml' : 'image/png'
    writeBinary(res, 200, {
      'content-type': mime,
      'content-length': String(file.size),
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    })
    if (headOnly) {
      res.end()
      return
    }
    streamFile(res, file.path)
    return
  }
  sendJson(res, 404, { ok: false, code: 'not_found', error: 'unknown asset' })
}

function codedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function writeBinary(res, status, headers) {
  try {
    if (!res || res.headersSent || res.writableEnded) return
    res.writeHead(status, headers)
  } catch {
    /* dead responses are fine */
  }
}

function streamFile(res, path) {
  try {
    const stream = createReadStream(path)
    stream.on('error', () => {
      try {
        res.destroy()
      } catch {
        /* already gone */
      }
    })
    stream.pipe(res)
  } catch {
    try {
      res.end()
    } catch {
      /* already gone */
    }
  }
}

export async function readJsonBody(req, maxBytes = LIMITS.maxBodyBytes) {
  const chunks = []
  let total = 0
  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buffer.length
      if (total > maxBytes) {
        const error = new Error(`request body exceeds ${maxBytes} bytes`)
        error.code = 'too_large'
        throw error
      }
      chunks.push(buffer)
    }
  }
  if (total === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text.length === 0) return {}
  try {
    return JSON.parse(text)
  } catch {
    const error = new Error('request body must be valid JSON')
    error.code = 'invalid_input'
    throw error
  }
}

export function sendJson(res, status, value, extraHeaders) {
  try {
    if (!res || res.headersSent || res.writableEnded) return
    const payload = JSON.stringify(value === undefined ? {} : value)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-length': String(Buffer.byteLength(payload, 'utf8')),
      ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {}),
    })
    res.end(payload)
  } catch {
    /* dead responses are fine */
  }
}

export { PLUGIN_NAME }
