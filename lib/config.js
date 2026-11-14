/** Plugin identity, limits and configuration resolution. */

export const PLUGIN_NAME = 'dsh-sci-plot'
export const VERSION = '1.2.2'
export const ROUTE_PREFIX = '/dsh-sci-plot'
export const REQUEST_HEADER = 'x-dsh-sci-plot'
export const DATA_DIR_NAME = 'sci-plot'
export const ENGINE_VERSION = '1.0.0'

export const LIMITS = Object.freeze({
  maxBodyBytes: 4 * 1024 * 1024,
  maxFigureBytes: 40 * 1024 * 1024,
  maxFigures: 240,
  toolContentBytes: 160 * 1024,
  renderTimeoutMs: 150_000,
  probeTimeoutMs: 25_000,
  cliTimeoutMs: 60_000,
  maxDataRows: 60_000,
  maxListedDatasets: 400,
})

export const FIGURE_FORMATS = Object.freeze(['png', 'svg', 'pdf', 'eps', 'tiff', 'jpg'])

export const DEFAULT_SETTINGS = Object.freeze({
  defaultDomain: 'life-science',
  defaultJournal: 'nature',
  defaultPalette: 'okabe-ito',
  defaultFont: 'arial',
  defaultSize: 'single',
  defaultDpi: 300,
  lang: 'zh',
})

function pickString(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

/** Resolve the loader row config with defaults. */
export function resolveConfig(rowConfig) {
  const raw = rowConfig && typeof rowConfig === 'object' ? rowConfig : {}
  return {
    pythonPath: pickString(raw.pythonPath, ''),
    dataDir: pickString(raw.dataDir, ''),
    workspaceDir: pickString(raw.workspaceDir, ''),
    defaultDomain: pickString(raw.defaultDomain, DEFAULT_SETTINGS.defaultDomain),
    defaultJournal: pickString(raw.defaultJournal, DEFAULT_SETTINGS.defaultJournal),
    defaultPalette: pickString(raw.defaultPalette, DEFAULT_SETTINGS.defaultPalette),
    defaultFont: pickString(raw.defaultFont, DEFAULT_SETTINGS.defaultFont),
    defaultSize: pickString(raw.defaultSize, DEFAULT_SETTINGS.defaultSize),
    defaultDpi: Number.isFinite(Number(raw.defaultDpi)) ? Math.min(1200, Math.max(72, Math.round(Number(raw.defaultDpi)))) : DEFAULT_SETTINGS.defaultDpi,
    maxFigures: Number.isFinite(Number(raw.maxFigures)) ? Math.min(1000, Math.max(10, Math.round(Number(raw.maxFigures)))) : LIMITS.maxFigures,
  }
}

export function defaultSettings(config) {
  return {
    defaultDomain: config?.defaultDomain || DEFAULT_SETTINGS.defaultDomain,
    defaultJournal: config?.defaultJournal || DEFAULT_SETTINGS.defaultJournal,
    defaultPalette: config?.defaultPalette || DEFAULT_SETTINGS.defaultPalette,
    defaultFont: config?.defaultFont || DEFAULT_SETTINGS.defaultFont,
    defaultSize: config?.defaultSize || DEFAULT_SETTINGS.defaultSize,
    defaultDpi: config?.defaultDpi || DEFAULT_SETTINGS.defaultDpi,
    lang: DEFAULT_SETTINGS.lang,
  }
}
