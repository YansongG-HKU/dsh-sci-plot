/**
 * Bridge to the Python rendering engine (`engine/sciplot`).
 *
 * The engine is a normal Python package driven through one JSON-in/JSON-out CLI.
 * This module owns:
 *   - interpreter discovery (config override, PATH, DSH runtime, common installs),
 *   - a capability probe that proves matplotlib + fonts actually work,
 *   - serialised CLI calls with timeouts, UTF-8 stdio and structured failures,
 *   - a fallback capability catalogue shipped with the plugin (read-only browsing
 *     when Python is unavailable).
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LIMITS } from './config.js'
import { messageOf, safeJsonParse } from './util.js'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const ENGINE_DIR = join(PLUGIN_ROOT, 'engine')
const FALLBACK_CAPABILITIES = join(PLUGIN_ROOT, 'assets', 'capabilities.json')

export function codedError(code, message, field) {
  const error = new Error(message)
  error.code = code
  if (field) error.field = field
  return error
}

function firstLine(text) {
  const value = String(text || '').trim()
  if (!value) return ''
  const line = value.split(/\r?\n/u).find((item) => item.trim().length > 0) || value
  return line.trim().slice(0, 500)
}

function runProcess(command, args, options = {}) {
  const { input = null, timeoutMs = LIMITS.cliTimeoutMs, cwd = ENGINE_DIR, env = {} } = options
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    let child = null
    const finish = (extra = {}) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: extra.code ?? null, stdout, stderr, timedOut, error: extra.error ?? null })
    }
    const timer = setTimeout(() => {
      timedOut = true
      try {
        child?.kill('SIGKILL')
      } catch {
        /* best effort */
      }
    }, timeoutMs)
    try {
      child = spawn(command, args, {
        cwd,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          PYTHONUNBUFFERED: '1',
          MPLBACKEND: 'Agg',
          ...env,
        },
      })
    } catch (error) {
      finish({ error: messageOf(error) })
      return
    }
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => finish({ error: messageOf(error) }))
    child.on('close', (code) => finish({ code }))
    if (input !== null) {
      try {
        child.stdin.write(input)
        child.stdin.end()
      } catch {
        /* the process may have exited already */
      }
    } else {
      try {
        child.stdin.end()
      } catch {
        /* ignore */
      }
    }
  })
}

/** Parse the single JSON object printed by the CLI. */
function parseCliJson(result, fallbackCode = 'render_failed') {
  const text = String(result.stdout || '').trim()
  if (text.length === 0) {
    const detail = firstLine(result.stderr)
    throw codedError(fallbackCode, detail || (result.timedOut ? 'the rendering engine timed out' : 'the rendering engine returned no output'))
  }
  let payload = safeJsonParse(text)
  if (!payload) {
    const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0)
    payload = safeJsonParse(lines[lines.length - 1] || '')
  }
  if (!payload || typeof payload !== 'object') {
    throw codedError('engine_crashed', `the engine returned invalid JSON: ${text.slice(0, 300)}`)
  }
  if (payload.ok === false) {
    throw codedError(payload.code || fallbackCode, payload.error || 'the rendering engine reported a failure', payload.field)
  }
  return payload
}

/** Share equivalent requests and let only the current request populate the cache. */
function cachedRequest(state, force, ttl, load) {
  if (state.pending && (!force || state.pending.force)) return state.pending.promise
  if (!force && state.cached && Date.now() - state.cached.at < ttl) return state.cached.value

  const pending = { force, promise: null }
  pending.promise = load().then((value) => {
    if (state.pending === pending) state.cached = { at: Date.now(), value }
    return value
  }).finally(() => {
    if (state.pending === pending) state.pending = null
  })
  state.pending = pending
  return pending.promise
}

export class PlotEngine {
  #probe = { cached: null, pending: null }
  #capabilities = { cached: null, pending: null }
  #refreshInFlight = null

  constructor({ config, log }) {
    this.config = config
    this.log = log
    this.fallback = null
    this.tail = Promise.resolve()
  }

  engineInfo() {
    return {
      engine: 'dsh-sci-plot',
      version: '1.0.0',
      engineDir: ENGINE_DIR,
      fallback: existsSync(FALLBACK_CAPABILITIES),
    }
  }

  /** Ordered interpreter candidates (deduplicated). */
  candidates() {
    const list = []
    const seen = new Set()
    const add = (command, args = [], label = '') => {
      if (!command) return
      const key = `${command}\u0000${args.join('\u0000')}`
      if (seen.has(key)) return
      seen.add(key)
      if (command.includes('\\') || command.includes('/')) {
        if (!existsSync(command)) return
      }
      list.push({ command, args, label: label || [command, ...args].join(' ') })
    }

    add(this.config.pythonPath, [], 'config.pythonPath')
    add(process.env.SCIPLOT_PYTHON, [], 'SCIPLOT_PYTHON')
    add(process.env.DSH_SCIPLOT_PYTHON, [], 'DSH_SCIPLOT_PYTHON')
    add('python')
    add('python3')
    add('py', ['-3'])
    add('py')

    // DSH managed runtimes (numpy/pandas preinstalled; matplotlib must be proven).
    const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
    const runtimesDir = join(dshHome, 'dsh-runtimes')
    try {
      for (const name of readdirSync(runtimesDir)) {
        const python = join(runtimesDir, name, 'dependencies', 'python', 'python.exe')
        if (existsSync(python)) add(python, [], `DSH runtime ${name}`)
        const unixPython = join(runtimesDir, name, 'dependencies', 'python', 'bin', 'python3')
        if (existsSync(unixPython)) add(unixPython, [], `DSH runtime ${name}`)
      }
    } catch {
      /* no managed runtimes */
    }

    const home = homedir()
    for (const candidate of [
      join(home, 'miniconda3', 'python.exe'),
      join(home, 'anaconda3', 'python.exe'),
      join(home, 'miniconda3', 'envs', 'base', 'python.exe'),
      'C:\\ProgramData\\miniconda3\\python.exe',
      'C:\\ProgramData\\anaconda3\\python.exe',
      'C:\\Python313\\python.exe',
      'C:\\Python312\\python.exe',
      'C:\\Python311\\python.exe',
      join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'Programs', 'Python', 'Python313', 'python.exe'),
      join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'Programs', 'Python', 'Python312', 'python.exe'),
      '/usr/bin/python3',
      '/usr/local/bin/python3',
    ]) {
      add(candidate)
    }
    return list
  }

  /** Probe interpreters until one can import matplotlib and run the engine CLI. */
  async probe(force = false) {
    return cachedRequest(this.#probe, force, 60_000, () => this.#probeInterpreter())
  }

  async #probeInterpreter() {
    const attempts = []
    let result = {
      available: false,
      error: 'no Python interpreter with matplotlib was found',
      pythonPath: '',
      command: '',
      args: [],
      info: null,
      checkedAt: new Date().toISOString(),
      attempts,
    }
    for (const candidate of this.candidates()) {
      const check = await runProcess(candidate.command, [...candidate.args, '-c', 'import matplotlib, numpy, sys; print(sys.version.split()[0])'], {
        timeoutMs: 20_000,
        cwd: PLUGIN_ROOT,
      })
      if (check.code !== 0) {
        attempts.push({ candidate: candidate.label, ok: false, error: firstLine(check.stderr) || check.error || `exit ${check.code}` })
        continue
      }
      const probe = await runProcess(candidate.command, [...candidate.args, '-m', 'sciplot.cli', 'probe'], {
        timeoutMs: LIMITS.probeTimeoutMs,
        cwd: ENGINE_DIR,
      })
      let info = null
      try {
        info = probe.code === 0 ? parseCliJson(probe, 'engine_crashed') : null
      } catch (error) {
        info = null
      }
      if (info && info.ok !== false) {
        const pythonVersion = String(check.stdout || '').trim() || String(info.python || '')
        result = {
          available: true,
          error: '',
          pythonPath: String(info.executable || candidate.command),
          command: candidate.command,
          args: candidate.args,
          pythonVersion,
          info,
          checkedAt: new Date().toISOString(),
          attempts: [...attempts, { candidate: candidate.label, ok: true, error: '' }],
        }
        break
      }
      attempts.push({ candidate: candidate.label, ok: false, error: firstLine(probe.stderr) || 'the sciplot CLI probe failed' })
    }
    if (result.available) {
      this.log?.info?.(`engine ready: ${result.pythonPath} (matplotlib ${result.info?.matplotlib || '?'})`)
    } else {
      this.log?.warn?.(`engine unavailable: ${result.error}`)
    }
    return result
  }

  status() {
    const probe = this.#probe.cached?.value
    if (!probe) {
      return { available: false, checked: false, error: 'the engine has not been probed yet' }
    }
    return {
      available: probe.available,
      checked: true,
      checkedAt: probe.checkedAt,
      error: probe.error,
      pythonPath: probe.pythonPath,
      pythonVersion: probe.pythonVersion || '',
      matplotlib: probe.info?.matplotlib || '',
      numpy: probe.info?.numpy || '',
      scipy: probe.info?.scipy || null,
      cjk: probe.info?.cjk_available === true,
      cjkFamilies: Array.isArray(probe.info?.cjk_families) ? probe.info.cjk_families.slice(0, 12) : [],
      fonts: Array.isArray(probe.info?.font_presets) ? probe.info.font_presets : [],
      warnings: Array.isArray(probe.info?.warnings) ? probe.info.warnings : [],
      attempts: Array.isArray(probe.attempts) ? probe.attempts : [],
      engineDir: ENGINE_DIR,
    }
  }

  /** Serialise engine work so one render does not starve the next. */
  enqueue(task) {
    const next = this.tail.then(task, task)
    this.tail = next.then(
      () => {},
      () => {},
    )
    return next
  }

  async runCli(args, { input = null, timeoutMs = LIMITS.cliTimeoutMs, parse = true, fallbackCode = 'engine_crashed' } = {}) {
    const probe = await this.probe()
    if (!probe.available) {
      throw codedError(
        'no_engine',
        probe.error || 'Python with matplotlib is required to render figures',
        'Install Python 3.11+ with numpy and matplotlib, then set `pythonPath` in the plugin config or run sci_plot_doctor for diagnostics.',
      )
    }
    const result = await runProcess(probe.command, [...probe.args, '-m', 'sciplot.cli', ...args], { input, timeoutMs })
    if (result.timedOut) {
      throw codedError('timeout', `the rendering engine did not finish within ${Math.round(timeoutMs / 1000)} s`)
    }
    if (!parse) return result
    return parseCliJson(result, fallbackCode)
  }

  async capabilities(force = false) {
    try {
      return await cachedRequest(this.#capabilities, force, 5 * 60_000, async () => {
        const payload = await this.runCli(['capabilities'], { timeoutMs: 90_000 })
        return { ...payload, source: 'engine', engine: { ...this.engineInfo(), ...(payload.engine || {}) } }
      })
    } catch (error) {
      const fallback = this.loadFallback()
      if (fallback) {
        return {
          ...fallback,
          source: 'fallback',
          engine: { ...this.engineInfo(), available: false, error: messageOf(error) },
          probe: { ok: false, warnings: [messageOf(error)] },
        }
      }
      throw error
    }
  }

  loadFallback() {
    if (this.fallback !== null) return this.fallback
    try {
      this.fallback = JSON.parse(readFileSync(FALLBACK_CAPABILITIES, 'utf8'))
    } catch {
      this.fallback = false
    }
    return this.fallback || null
  }

  async render(spec, outDir) {
    return this.enqueue(() => this.runCli(['render', '--spec', '-', '--out-dir', outDir], { input: JSON.stringify(spec), timeoutMs: LIMITS.renderTimeoutMs, fallbackCode: 'render_failed' }))
  }

  async validate(spec) {
    return this.enqueue(() => this.runCli(['validate', '--spec', '-'], { input: JSON.stringify(spec), timeoutMs: 60_000, fallbackCode: 'invalid_spec' }))
  }

  async sampleInfo(sampleId) {
    return this.runCli(['sample', '--get', String(sampleId)], { timeoutMs: 40_000 })
  }

  async sampleList() {
    return this.runCli(['sample', '--list'], { timeoutMs: 40_000 })
  }

  async refresh() {
    if (this.#refreshInFlight) return this.#refreshInFlight
    this.#capabilities.cached = null
    this.#capabilities.pending = null
    this.#refreshInFlight = this.#refreshEngine().finally(() => {
      this.#refreshInFlight = null
    })
    return this.#refreshInFlight
  }

  async #refreshEngine() {
    const probe = await this.probe(true)
    if (probe.available) {
      try {
        await this.capabilities(true)
      } catch (error) {
        this.log?.warn?.(`capability refresh failed: ${messageOf(error)}`)
      }
    }
    return probe
  }
}
