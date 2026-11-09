/**
 * dsh-sci-plot — rebuild `client.js` from `src/client/` fragments.
 *
 * The shipped client artifact must stay a single dependency-free file that the
 * DSH dynamic-client loader can evaluate directly, so the readable sources are
 * concatenated in filename order (00-head … 07-apply; the loader wrapper opens
 * in 00-head and closes in 07-apply).
 *
 * Usage: node scripts/build-client.mjs [--check]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(root, 'src', 'client')
const target = join(root, 'client.js')

const fragments = readdirSync(sourceDir)
  .filter((name) => name.endsWith('.js'))
  .sort()
if (fragments.length === 0) throw new Error('no client fragments found in ' + sourceDir)

const source = fragments.map((name) => readFileSync(join(sourceDir, name), 'utf8')).join('\n')
const current = (() => {
  try {
    return readFileSync(target, 'utf8')
  } catch {
    return ''
  }
})()

const normalize = (text) => String(text).replace(/\r\n/g, '\n').replace(/\n+$/u, '')

if (process.argv.includes('--check')) {
  if (normalize(current) !== normalize(source)) {
    console.error('client.js is stale; run: node scripts/build-client.mjs')
    process.exit(1)
  }
  console.log('client.js is up to date (' + fragments.length + ' fragments, ' + Buffer.byteLength(source) + ' bytes)')
} else {
  writeFileSync(target, source, 'utf8')
  console.log('wrote client.js from ' + fragments.length + ' fragments (' + Buffer.byteLength(source) + ' bytes)')
}
