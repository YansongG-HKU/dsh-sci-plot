/**
 * Build the shipped demo gallery + fallback capability catalogue.
 *
 *   1. (optional) regenerate engine/demo_catalog.json via build_demo_catalog.py
 *   2. render every curated figure with the real Python engine
 *   3. flatten the PNGs into assets/gallery/<id>.png and write manifest.json
 *   4. dump engine capabilities into assets/capabilities.json (fallback catalogue)
 *
 * Usage: node scripts/build-gallery.mjs [--skip-catalog] [--only id1,id2]
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const engineDir = join(root, 'engine')
const catalogPath = join(engineDir, 'demo_catalog.json')
const buildDir = join(root, '.tmp', 'gallery-build')
const galleryDir = join(root, 'assets', 'gallery')
const assetsDir = join(root, 'assets')
const python = process.env.SCIPLOT_PYTHON || 'python'
const args = process.argv.slice(2)
const skipCatalog = args.includes('--skip-catalog')
const onlyArg = args.find((item) => item.startsWith('--only='))
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((item) => item.trim()).filter(Boolean)) : null

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    timeout: options.timeoutMs || 600_000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', MPLBACKEND: 'Agg' },
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  return result
}

function fail(message) {
  console.error(`[build-gallery] ${message}`)
  process.exit(1)
}

if (!skipCatalog) {
  const catalog = run(python, ['build_demo_catalog.py'], { cwd: engineDir })
  process.stderr.write(catalog.stderr || '')
  process.stdout.write(catalog.stdout || '')
  if (catalog.status !== 0) fail(`demo catalog generation failed (exit ${catalog.status})`)
}

if (!existsSync(catalogPath)) fail(`missing ${catalogPath}`)

// ---------------------------------------------------------------------------
// 1. Render the curated catalogue
// ---------------------------------------------------------------------------
rmSync(buildDir, { recursive: true, force: true })
mkdirSync(buildDir, { recursive: true })
const gallery = run(python, ['-m', 'sciplot.cli', 'gallery', '--catalog', catalogPath, '--out-dir', buildDir], { cwd: engineDir })
process.stderr.write(gallery.stderr || '')
let payload = null
try {
  payload = JSON.parse(String(gallery.stdout || '').trim())
} catch {
  fail(`gallery render returned invalid JSON (exit ${gallery.status}): ${(gallery.stdout || '').slice(0, 400)}`)
}
if (!payload || !Array.isArray(payload.figures)) fail('gallery render returned no figures')

// ---------------------------------------------------------------------------
// 2. Flatten PNGs and build the manifest
// ---------------------------------------------------------------------------
rmSync(galleryDir, { recursive: true, force: true })
mkdirSync(galleryDir, { recursive: true })
const manifest = []
const failures = []
for (const figure of payload.figures) {
  if (!figure.ok) {
    failures.push({ id: figure.id, error: figure.error })
    continue
  }
  if (only && !only.has(figure.id)) continue
  const png = figure.files && figure.files.png
  if (!png || !existsSync(png)) {
    failures.push({ id: figure.id, error: 'missing PNG output' })
    continue
  }
  const target = join(galleryDir, `${figure.id}.png`)
  copyFileSync(png, target)
  const bytes = statSync(target).size
  manifest.push({
    id: figure.id,
    file: `${figure.id}.png`,
    titleZh: figure.title_zh || '',
    titleEn: figure.title_en || '',
    noteZh: figure.note_zh || '',
    noteEn: figure.note_en || '',
    kind: figure.kind,
    domain: figure.domain,
    journal: figure.journal,
    widthMm: figure.width_mm,
    heightMm: figure.height_mm,
    widthPx: figure.width_px,
    heightPx: figure.height_px,
    bytes,
    quality: figure.quality ? { score: figure.quality.score, grade: figure.quality.grade } : null,
  })
}

writeFileSync(
  join(galleryDir, 'manifest.json'),
  JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), engine: payload.engine || null, figures: manifest }, null, 2),
  'utf8',
)

// Remove stale gallery images that are no longer referenced.
const referenced = new Set(manifest.map((item) => item.file))
for (const name of readdirSync(galleryDir)) {
  if (name === 'manifest.json') continue
  if (!referenced.has(name)) rmSync(join(galleryDir, name), { force: true })
}

// ---------------------------------------------------------------------------
// 3. Fallback capabilities (so the panel can browse styles with Python down)
// ---------------------------------------------------------------------------
const capabilities = run(python, ['-m', 'sciplot.cli', 'capabilities'], { cwd: engineDir })
if (capabilities.status === 0) {
  try {
    const parsed = JSON.parse(String(capabilities.stdout || '').trim())
    writeFileSync(join(assetsDir, 'capabilities.json'), JSON.stringify(parsed, null, 1), 'utf8')
  } catch (error) {
    console.warn(`[build-gallery] capability fallback not written: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// 4. Summary
// ---------------------------------------------------------------------------
const totalBytes = manifest.reduce((sum, item) => sum + item.bytes, 0)
const scores = manifest.map((item) => item.quality?.score).filter((value) => typeof value === 'number')
const minScore = scores.length ? Math.min(...scores) : 0
const avgScore = scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : 0
const readiness = JSON.parse(readFileSync(catalogPath, 'utf8'))
console.log(`[build-gallery] rendered ${manifest.length}/${readiness.figures.length} figures`)
console.log(`[build-gallery] quality min ${minScore}, avg ${avgScore}; gallery ${(totalBytes / 1024 / 1024).toFixed(2)} MB`)
if (failures.length > 0) {
  console.error(`[build-gallery] ${failures.length} figure(s) failed:`)
  for (const item of failures) console.error(`  - ${item.id}: ${item.error}`)
  process.exit(1)
}
