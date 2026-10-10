import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('../scripts/extract.mjs', import.meta.url))

const source = (entries) => `const NS = 'demo'
const en = { ${entries.map(([key, text]) => `'${key}': '${text}'`).join(', ')} }
const zh = { ${entries.map(([key, text]) => `'${key}': '译 ${text}'`).join(', ')} }
export function apply(locale) {
  locale.register(NS, { zh, en })
}
`

const fixture = (t) => {
  const checkout = mkdtempSync(join(tmpdir(), 'dsh-locale-ko-checkout-'))
  const runner = mkdtempSync(join(tmpdir(), 'dsh-locale-ko-runner-'))
  t.after(() => {
    rmSync(checkout, { recursive: true, force: true })
    rmSync(runner, { recursive: true, force: true })
  })
  mkdirSync(join(runner, 'scripts'), { recursive: true })
  copyFileSync(script, join(runner, 'scripts/extract.mjs'))
  const file = join(checkout, 'packages/demo/demo/src/index.ts')
  mkdirSync(dirname(file), { recursive: true })
  const git = (...args) =>
    execFileSync('git', [
      '-C',
      checkout,
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ])
  git('init', '-q', '-b', 'main')
  return {
    checkout,
    runner,
    english: () => JSON.parse(readFileSync(join(runner, 'source/en.json'), 'utf8')).demo,
    commit(tag, text) {
      writeFileSync(file, text)
      git('add', '-A')
      git('commit', '-q', '-m', tag)
      git('tag', tag)
    },
    extract: (...tags) =>
      execFileSync(process.execPath, [join(runner, 'scripts/extract.mjs'), checkout, ...tags], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
  }
}

const first = source([
  ['shared', 'First text'],
  ['older-only', 'Older only'],
])
const second = source([
  ['shared', 'Second text'],
  ['newer', 'Newer only'],
])

test('a later tag wins for a changed value and an earlier-only key stays', (t) => {
  const fx = fixture(t)
  fx.commit('v1', first)
  fx.commit('v2', second)

  fx.extract('v1')
  assert.deepEqual(Object.keys(fx.english()).sort(), ['older-only', 'shared'], 'the older tag alone has no newer key')

  fx.extract('v1', 'v2')
  assert.equal(fx.english().shared, 'Second text', 'the later tag wins a changed value')
  assert.equal(fx.english()['older-only'], 'Older only', 'a key only the earlier tag has stays')
  assert.equal(fx.english().newer, 'Newer only', 'the later tag adds its own key')
})

test('a failing tag leaves the previous output untouched', (t) => {
  const fx = fixture(t)
  fx.commit('v1', first)
  fx.commit('v2', second)
  fx.commit(
    'v3',
    "const en = { 'demo.key': 'text' }\nexport function apply(locale) {\n  locale.register(name, { en })\n}\n",
  )

  fx.extract('v1', 'v2')
  const before = readFileSync(join(fx.runner, 'source/en.json'))
  assert.equal(fx.english().shared, 'Second text')

  assert.throws(() => fx.extract('v1', 'no-such-tag'), 'a tag the checkout does not have fails')
  assert.deepEqual(readFileSync(join(fx.runner, 'source/en.json')), before, 'a missing tag writes nothing')

  assert.throws(() => fx.extract('v1', 'v2', 'v3'), 'an unresolved register call fails the run')
  assert.deepEqual(readFileSync(join(fx.runner, 'source/en.json')), before, 'an unresolved call writes nothing')
})
