/**
 * Integration tests against the real Python engine.
 *
 * These run on the developer machine (not hermetic). When no interpreter with
 * matplotlib exists the suite skips instead of failing.
 *
 * Run: node --test test/integration/engine.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { PlotEngine } from '../../lib/engine.js'
import { resolveConfig } from '../../lib/config.js'

const config = resolveConfig({})
const engine = new PlotEngine({ config, log: null })
const probe = await engine.probe()
const available = probe.available
const reason = probe.error || 'no engine'

function outDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix))
}

test('engine: probe reports matplotlib and CJK support', { skip: !available && reason }, async () => {
  assert.equal(probe.available, true)
  assert.ok(probe.info.matplotlib)
  assert.ok(probe.info.numpy)
  assert.equal(typeof probe.info.cjk_available, 'boolean')
  assert.ok(probe.pythonPath)
})

test('engine: capabilities expose kinds, themes, palettes and samples', { skip: !available && reason }, async () => {
  const caps = await engine.capabilities()
  assert.ok(caps.kinds.length >= 5, 'expected chart families')
  const kinds = caps.kinds.flatMap((group) => group.kinds)
  assert.ok(kinds.some((kind) => kind.kind === 'line'))
  assert.ok(caps.themes.domains.length >= 10)
  assert.ok(caps.themes.journals.length >= 14)
  assert.ok(caps.palettes.categorical.length >= 10)
  assert.ok(caps.samples.length >= 7)
  const nature = caps.themes.journals.find((journal) => journal.id === 'nature')
  assert.equal(nature.widths.single, 89)
})

test('engine: validate normalises a line spec', { skip: !available && reason }, async () => {
  const result = await engine.validate({
    kind: 'line',
    data: { sample: 'growth', mapping: { x: 'time_h', y: 'od600', group: 'condition' } },
    style: { domain: 'life-science', journal: 'nature' },
    labels: { x: 'Time (h)', y: 'OD$_{600}$' },
  })
  assert.equal(result.kind, 'line')
  assert.equal(result.style.journal, 'nature')
  assert.equal(result.data.mode, 'table')
})

test('engine: render a real figure with quality report and vector files', { skip: !available && reason }, async () => {
  const dir = outDir('sciplot-engine-')
  const result = await engine.render(
    {
      kind: 'line',
      data: { sample: 'growth', mapping: { x: 'time_h', y: 'od600', group: 'condition' } },
      style: { domain: 'life-science', journal: 'nature' },
      labels: { x: 'Time (h)', y: 'OD$_{600}$' },
      output: { formats: ['png', 'svg', 'pdf'], basename: 'engine-line' },
    },
    dir,
  )
  assert.equal(result.ok, true)
  assert.equal(result.kind, 'line')
  assert.ok(result.files.png && existsSync(result.files.png))
  assert.ok(result.files.svg && existsSync(result.files.svg))
  assert.ok(result.files.pdf && existsSync(result.files.pdf))
  const pdfHeader = readFileSync(result.files.pdf).subarray(0, 5).toString('latin1')
  assert.equal(pdfHeader, '%PDF-')
  assert.ok(result.width_px > 500)
  assert.ok(result.dpi >= 300)
  assert.ok(result.quality.score >= 90, `quality ${result.quality.score}`)
  assert.equal(result.quality.grade, 'A')
})

test('engine: CJK labels render without missing glyph warnings', { skip: !available && reason }, async () => {
  const dir = outDir('sciplot-cjk-')
  const result = await engine.render(
    {
      kind: 'bar',
      data: {
        series: [
          {
            name: '处理组',
            x: [0, 1, 2],
            y: [12, 18, 9],
            categories: ['对照', '低剂量', '高剂量'],
          },
        ],
      },
      labels: { x: '处理条件', y: '响应值（a.u.）', title: '中文标签渲染' },
      style: { domain: 'life-science', journal: 'elsevier' },
      output: { formats: ['png'], basename: 'cjk' },
    },
    dir,
  )
  assert.equal(result.ok, true)
  const glyphWarnings = (result.warnings || []).filter((item) => item.includes('Glyph') || item.includes('missing from font'))
  assert.deepEqual(glyphWarnings, [])
  assert.ok(existsSync(result.files.png))
})

test('engine: unknown kind returns a coded failure', { skip: !available && reason }, async () => {
  await assert.rejects(
    engine.render({ kind: 'not_a_real_chart', data: { series: [{ x: [1], y: [1] }] } }, outDir('sciplot-bad-')),
    (error) => error.code === 'unknown_kind',
  )
})

test('engine: sample catalogue is readable', { skip: !available && reason }, async () => {
  const list = await engine.sampleList()
  assert.ok(Array.isArray(list.samples))
  const growth = list.samples.find((sample) => sample.id === 'growth')
  assert.ok(growth)
  assert.equal(growth.domain, 'life-science')
  const info = await engine.sampleInfo('growth')
  assert.ok(Array.isArray(info.preview.rows))
})
