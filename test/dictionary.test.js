import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const english = JSON.parse(readFileSync(new URL('../source/en.json', import.meta.url), 'utf8'))
const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

let registration
globalThis.window = { __ModuleLoader__: { load: value => { registration = value } } }
await import('../client.js')

const placeholders = text => [...text.matchAll(/\{[^{}]+\}/g)].map(match => match[0]).sort()

test('Korean values agree with the English source', t => {
  const dictionaries = []
  registration.factory().apply({
    effect: callback => callback(),
    locale: {
      addLanguage: () => () => {},
      register: (namespace, locale, dict) => {
        dictionaries.push([namespace, locale, dict])
        return () => {}
      },
    },
  })

  let translated = 0
  for (const [namespace, locale, dict] of dictionaries) {
    assert.equal(locale, 'ko')
    assert.ok(Object.hasOwn(english, namespace), `unknown namespace ${namespace}`)
    for (const [key, value] of Object.entries(dict)) {
      const source = english[namespace][key]
      assert.ok(Object.hasOwn(english[namespace], key), `unknown key ${namespace}.${key}`)
      assert.equal(typeof value, 'string', `${namespace}.${key} must be a string`)
      assert.ok(value !== '' || source === '', `${namespace}.${key} is empty`)
      assert.deepEqual(placeholders(value), placeholders(source), `placeholder mismatch in ${namespace}.${key}`)
      translated += 1
    }
  }

  const total = Object.values(english).reduce((count, dict) => count + Object.keys(dict).length, 0)
  t.diagnostic(`translated ${translated}/${total} keys across ${dictionaries.length} namespaces`)
})

test('dictionaries stay sorted so duplicate keys cannot hide', () => {
  const lines = client.split('\n')
  const start = lines.indexOf('const dictionaries = {')
  assert.ok(start !== -1 || lines.includes('const dictionaries = {}'), 'dictionaries literal not found')
  const body = start === -1 ? [] : lines.slice(start + 1, lines.indexOf('}', start))
  let previousNamespace
  let previousKey
  for (const line of body) {
    assert.match(line, /^ {2}"[^"]+": \{$|^ {4}"[^"]+": "(?:[^"\\]|\\.)*",?$|^ {2}\},?$/, `unexpected line in dictionaries: ${line}`)
    const namespace = /^ {2}"([^"]+)": \{$/.exec(line)
    if (namespace !== null) {
      assert.ok(previousNamespace === undefined || previousNamespace < namespace[1], `namespace ${namespace[1]} is out of order`)
      previousNamespace = namespace[1]
      previousKey = undefined
      continue
    }
    const key = /^ {4}"([^"]+)": /.exec(line)
    if (key !== null) {
      assert.ok(previousKey === undefined || previousKey < key[1], `key ${key[1]} is out of order in ${previousNamespace}`)
      previousKey = key[1]
    }
  }
})
