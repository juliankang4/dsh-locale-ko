import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const english = JSON.parse(readFileSync(new URL('../source/en.json', import.meta.url), 'utf8'))
const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/** English dictionary of every captured third-party plugin namespace. */
const pluginEnglish = new Map()
for (const file of readdirSync(new URL('../source/plugins', import.meta.url))) {
  if (!file.endsWith('.json')) continue
  const captured = JSON.parse(readFileSync(new URL(`../source/plugins/${file}`, import.meta.url), 'utf8'))
  for (const [namespace, locales] of Object.entries(captured.namespaces)) {
    assert.ok(!pluginEnglish.has(namespace), `namespace ${namespace} is captured in more than one file`)
    assert.ok(!Object.hasOwn(english, namespace), `namespace ${namespace} is both a core and a third-party namespace`)
    const korean = Object.keys(locales).filter((locale) => /^ko(-|$)/i.test(locale))
    assert.deepEqual(korean, [], `namespace ${namespace} already ships Korean as ${korean.join(', ')}`)
    pluginEnglish.set(namespace, locales.en)
  }
}

let registration
globalThis.window = {
  __ModuleLoader__: {
    load: (value) => {
      registration = value
    },
  },
}
await import('../client.js')

/**
 * Run the client's apply once against a locale service fake. `owners` is what
 * installed plugins have registered: a namespace's English dictionary and the
 * locales it occupies. Returns the registrations our client made.
 */
function applyClient(owners = new Map()) {
  const registered = []
  let subscribed = () => {}
  registration.factory().apply({
    effect: (callback) => callback(),
    locale: {
      addLanguage: () => () => {},
      bind: (namespace) => (key) => owners.get(namespace)?.en?.[key] ?? key,
      subscribe: (callback) => {
        subscribed = callback
        return () => {}
      },
      register: (namespace, locale, dict) => {
        if (owners.get(namespace)?.locales.has(locale)) {
          throw new Error(`locale namespace "${namespace}" already has locale "${locale}"`)
        }
        registered.push([namespace, locale, dict])
        return () => {}
      },
    },
  })
  return { registered, notify: () => subscribed() }
}

/** Every captured namespace as an installed plugin that registers English and Chinese. */
const installed = new Map(
  [...pluginEnglish].map(([namespace, en]) => [namespace, { en, locales: new Set(['en', 'zh']) }]),
)
const { registered: dictionaries } = applyClient(installed)

/** Namespaces the client translates today; empty before the first translation commit. */
const translated = [...pluginEnglish.keys()].filter((namespace) => dictionaries.some(([name]) => name === namespace))
const untranslated = translated.length === 0 && 'no third-party dictionary is translated yet'

const placeholders = (text) => [...text.matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort()

const check = (namespace, dict, source) => {
  let translated = 0
  for (const [key, value] of Object.entries(dict)) {
    assert.ok(Object.hasOwn(source, key), `unknown key ${namespace}.${key}`)
    assert.equal(typeof value, 'string', `${namespace}.${key} must be a string`)
    assert.ok(value !== '' || source[key] === '', `${namespace}.${key} is empty`)
    assert.deepEqual(placeholders(value), placeholders(source[key]), `placeholder mismatch in ${namespace}.${key}`)
    translated += 1
  }
  return translated
}

test('Korean values agree with the English source', (t) => {
  let translated = 0
  for (const [namespace, locale, dict] of dictionaries) {
    assert.equal(locale, 'ko')
    if (pluginEnglish.has(namespace)) continue
    assert.ok(Object.hasOwn(english, namespace), `unknown namespace ${namespace}`)
    translated += check(namespace, dict, english[namespace])
  }

  const total = Object.values(english).reduce((count, dict) => count + Object.keys(dict).length, 0)
  t.diagnostic(`translated ${translated}/${total} keys across ${dictionaries.length} namespaces`)
})

test('Korean values agree with the captured third-party dictionaries', (t) => {
  let translated = 0
  for (const [namespace, locale, dict] of dictionaries) {
    assert.equal(locale, 'ko')
    if (!pluginEnglish.has(namespace)) continue
    translated += check(namespace, dict, pluginEnglish.get(namespace))
  }
  // A namespace the client translates but no capture declares would be stale.
  for (const [namespace] of dictionaries) {
    assert.ok(pluginEnglish.has(namespace) || Object.hasOwn(english, namespace), `unknown namespace ${namespace}`)
  }

  const total = [...pluginEnglish.values()].reduce((count, dict) => count + Object.keys(dict).length, 0)
  const missing = [...pluginEnglish.keys()].filter((namespace) => !dictionaries.some(([name]) => name === namespace))
  t.diagnostic(
    `translated ${translated}/${total} third-party keys; ${missing.length} of ${pluginEnglish.size} captured namespaces have no Korean dictionary`,
  )
})

test('third-party dictionaries attach only after their owner registers', { skip: untranslated }, async () => {
  for (const namespace of translated) {
    const owners = new Map()
    const { registered, notify } = applyClient(owners)
    assert.deepEqual(
      registered.filter(([name]) => name === namespace),
      [],
      `nothing attaches before any owner registers (${namespace})`,
    )
    owners.set(namespace, { en: pluginEnglish.get(namespace), locales: new Set(['en', 'zh']) })
    notify()
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(
      registered.filter(([name]) => name === namespace).map(([name, locale]) => [name, locale]),
      [[namespace, 'ko']],
    )
  }

  const owners = new Map(
    translated.map((namespace) => [namespace, { en: pluginEnglish.get(namespace), locales: new Set(['en', 'zh']) }]),
  )
  const { registered, notify } = applyClient(owners)
  notify()
  await new Promise((resolve) => setImmediate(resolve))
  const attached = registered.map(([name]) => name).filter((name) => pluginEnglish.has(name))
  assert.deepEqual(
    attached.sort(),
    [...translated].sort(),
    'every translated namespace attaches when its owner registers',
  )
})

test('an owner that ships Korean keeps its own', { skip: untranslated }, () => {
  for (const namespace of translated) {
    const owners = new Map([[namespace, { en: pluginEnglish.get(namespace), locales: new Set(['en', 'zh', 'ko']) }]])
    const { registered } = applyClient(owners)
    assert.deepEqual(
      registered.filter(([name]) => name === namespace),
      [],
      `${namespace} keeps its own Korean`,
    )
  }

  const owners = new Map(
    translated.map((namespace) => [
      namespace,
      { en: pluginEnglish.get(namespace), locales: new Set(['en', 'zh', 'ko']) },
    ]),
  )
  const { registered } = applyClient(owners)
  assert.deepEqual(
    registered.filter(([name]) => pluginEnglish.has(name)),
    [],
    'no translated namespace is registered when every owner ships Korean',
  )
})

/** Every line of the literal is a namespace, a key or a closing brace, in order. */
function assertSorted(name) {
  const lines = client.split('\n')
  const start = lines.findIndex((line) => line.trim() === `const ${name} = {`)
  assert.ok(start !== -1 || lines.some((line) => line.trim() === `const ${name} = {}`), `${name} literal not found`)
  const indent = start === -1 ? '' : lines[start].match(/^\s*/)[0]
  const end = lines.indexOf(`${indent}}`, start)
  assert.ok(start === -1 || end > start, `${name} literal is not closed`)
  const body = start === -1 ? [] : lines.slice(start + 1, end).map((line) => line.slice(indent.length))
  let previousNamespace
  let previousKey
  const normalized = body
    .join('\n')
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (literal) =>
      literal.startsWith('"')
        ? literal
        : `"${literal.slice(1, -1).replace(/\\.|"/g, (escaped) => (escaped === "\\'" ? "'" : escaped === '"' ? '\\"' : escaped))}"`,
    )
    .replace(/:\n\s*"/g, ': "')
  for (const line of normalized === '' ? [] : normalized.split('\n')) {
    assert.match(
      line,
      /^ {2}"(?:[^"\\]|\\.)+": \{$|^ {4}"(?:[^"\\]|\\.)+": "(?:[^"\\]|\\.)*",?$|^ {2}\},?$/,
      `unexpected line in ${name}: ${line}`,
    )
    const namespace = /^ {2}"([^"]+)": \{$/.exec(line)
    if (namespace !== null) {
      assert.ok(
        previousNamespace === undefined || previousNamespace < namespace[1],
        `namespace ${namespace[1]} is out of order`,
      )
      previousNamespace = namespace[1]
      previousKey = undefined
      continue
    }
    // Some plugins key their strings by the source text, which can hold escaped quotes.
    const match = /^ {4}("(?:[^"\\]|\\.)+"): /.exec(line)
    if (match !== null) {
      const key = JSON.parse(match[1])
      assert.ok(previousKey === undefined || previousKey < key, `key ${key} is out of order in ${previousNamespace}`)
      previousKey = key
    }
  }
}

test('dictionaries stay sorted so duplicate keys cannot hide', () => {
  assertSorted('dictionaries')
})

test('plugin dictionaries stay sorted so duplicate keys cannot hide', () => {
  assertSorted('pluginDictionaries')
})
