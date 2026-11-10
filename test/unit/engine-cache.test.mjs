import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PlotEngine } from '../../lib/engine.js'

test('concurrent cold capabilities share interpreter discovery and the capability command', async () => {
  const engine = new PlotEngine({ config: {} })
  let discoveries = 0
  let commands = 0
  const fakeInterpreter = [
    '-e',
    "console.log(process.argv[1] === '-c' ? '3.12' : JSON.stringify({ ok: true }))",
    '--',
  ]
  engine.candidates = () => {
    discoveries += 1
    return [{ command: process.execPath, args: fakeInterpreter, label: 'fixture' }]
  }
  const runCli = engine.runCli.bind(engine)
  engine.runCli = (...args) => {
    commands += 1
    return runCli(...args)
  }

  const results = await Promise.all(Array.from({ length: 8 }, () => engine.capabilities()))
  assert.equal(discoveries, 1)
  assert.equal(commands, 1)
  assert.ok(results.every((result) => result.source === 'engine'))
  assert.strictEqual(await engine.capabilities(), results[0])
})

test('refresh supersedes pending capabilities and concurrent refreshes share the replacement', async () => {
  const engine = new PlotEngine({ config: {} })
  const previous = Promise.withResolvers()
  let probes = 0
  let commands = 0
  engine.probe = async (force) => {
    assert.equal(force, true)
    probes += 1
    return { available: true }
  }
  engine.runCli = async () => {
    commands += 1
    return commands === 1 ? previous.promise : { generation: 'new' }
  }

  const old = engine.capabilities()
  await Promise.all([engine.refresh(), engine.refresh()])
  previous.resolve({ generation: 'old' })
  assert.equal((await old).generation, 'old')
  assert.equal((await engine.capabilities()).generation, 'new')
  assert.equal(probes, 1)
  assert.equal(commands, 2)
})

test('a failed shared capabilities request can be retried', async () => {
  const engine = new PlotEngine({ config: {} })
  let commands = 0
  engine.runCli = async () => {
    commands += 1
    if (commands === 1) throw new Error('temporary engine failure')
    return { ok: true }
  }
  const failure = await Promise.all([engine.capabilities(), engine.capabilities()])
  assert.ok(failure.every(({ source }) => source === 'fallback'))
  assert.equal(commands, 1)
  assert.equal((await engine.capabilities()).source, 'engine')
  assert.equal(commands, 2)
})
