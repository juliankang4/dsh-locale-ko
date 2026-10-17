import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const english = JSON.parse(readFileSync(new URL('../source/en.json', import.meta.url), 'utf8'))
const variants = JSON.parse(readFileSync(new URL('../source/en-variants.json', import.meta.url), 'utf8'))
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

const tick = () => new Promise((resolve) => setImmediate(resolve))

/**
 * A locale service that behaves like dsh's: lookup prefers Korean over English,
 * subscribers run synchronously inside register and unregister, and a second
 * registration of one namespace and locale throws.
 */
function localeService() {
  const dicts = new Map()
  const listeners = new Set()
  const publish = () => {
    for (const callback of [...listeners]) callback()
  }
  return {
    korean: (namespace) => dicts.get(namespace)?.get('ko'),
    addLanguage: () => () => {},
    bind:
      (namespace) =>
      (key, params = {}) =>
        (dicts.get(namespace)?.get('ko')?.[key] ?? dicts.get(namespace)?.get('en')?.[key] ?? key).replace(
          /\{(\w+)\}/g,
          (match, name) => params[name] ?? match,
        ),
    subscribe: (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    register: (namespace, locale, dict) => {
      const locales = dicts.get(namespace) ?? new Map()
      dicts.set(namespace, locales)
      if (locales.has(locale)) throw new Error(`locale namespace "${namespace}" already has locale "${locale}"`)
      locales.set(locale, dict)
      publish()
      return () => {
        if (locales.get(locale) !== dict) return
        locales.delete(locale)
        publish()
      }
    },
  }
}

function applyClient(owners = new Map(), core = {}) {
  const service = localeService()
  const registered = []
  const disposers = []
  const register = (namespace, en, locales = new Set(['en'])) => {
    for (const locale of locales) service.register(namespace, locale, locale === 'en' ? en : {})
  }
  for (const [namespace, { en, locales }] of owners) register(namespace, en, locales)
  for (const [namespace, en] of Object.entries(core)) register(namespace, en)
  const apply = () =>
    registration.factory().apply({
      effect: (callback) => disposers.push(callback()),
      locale: {
        ...service,
        register: (namespace, locale, dict) => {
          const dispose = service.register(namespace, locale, dict)
          registered.push([namespace, locale, dict])
          return dispose
        },
      },
    })
  apply()
  return {
    registered,
    service,
    apply,
    register,
    own: (namespace, owner) => register(namespace, owner.en, owner.locales),
    dispose: () => {
      for (const dispose of disposers.splice(0)) dispose()
    },
  }
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

test('Korean values agree with the English source', async (t) => {
  const { service } = applyClient(new Map(), english)
  await tick()
  let translated = 0
  for (const namespace of Object.keys(english)) {
    translated += check(namespace, service.korean(namespace) ?? {}, english[namespace])
  }
  for (const [namespace, locale] of dictionaries) {
    assert.equal(locale, 'ko')
    assert.ok(pluginEnglish.has(namespace) || Object.hasOwn(english, namespace), `unknown namespace ${namespace}`)
  }

  const total = Object.values(english).reduce((count, dict) => count + Object.keys(dict).length, 0)
  t.diagnostic(`translated ${translated}/${total} keys across ${Object.keys(english).length} namespaces`)
})

test('a key with several English texts gets the Korean of the English the running dsh registered', async () => {
  let count = 0
  for (const [namespace, keys] of Object.entries(variants)) {
    for (const [key, texts] of Object.entries(keys)) {
      for (const text of texts) {
        const { service, register } = applyClient()
        assert.equal(
          service.korean(namespace)?.[key],
          undefined,
          `${namespace}.${key} has Korean before core registers`,
        )
        register(namespace, { [key]: text })
        await tick()
        const korean = service.korean(namespace)?.[key]
        assert.equal(typeof korean, 'string', `${namespace}.${key} has no Korean for: ${text}`)
        assert.deepEqual(placeholders(korean), placeholders(text), `placeholder mismatch in ${namespace}.${key}`)
        count += 1
      }
      const unknown = applyClient(new Map(), { [namespace]: { [key]: `${texts[0]} (a newer release)` } })
      await tick()
      assert.equal(unknown.service.korean(namespace)?.[key], undefined, `${namespace}.${key} must stay English`)
    }
  }
  assert.ok(count > 0)
})

test('Korean appears when core English registers late and follows disable and enable', async () => {
  const [namespace, [key, [first, second]]] = Object.entries(variants).map(([name, keys]) => [
    name,
    Object.entries(keys)[0],
  ])[0]
  const { service, register, apply, dispose, registered } = applyClient()
  register(namespace, { [key]: second })
  await tick()
  const korean = service.korean(namespace)[key]
  assert.notEqual(korean, undefined)
  assert.notEqual(first, second)

  dispose()
  assert.equal(service.korean(namespace), undefined, 'disable removes every dictionary')
  const count = registered.length
  await tick()
  assert.equal(registered.length, count, 'a queued update after disable registers nothing')

  apply()
  await tick()
  assert.equal(service.korean(namespace)[key], korean, 're-enable translates again without a second-registration error')
})

test('Korean values agree with the captured third-party dictionaries', (t) => {
  let translated = 0
  for (const [namespace, locale, dict] of dictionaries) {
    assert.equal(locale, 'ko')
    if (!pluginEnglish.has(namespace)) continue
    translated += check(namespace, dict, pluginEnglish.get(namespace))
  }

  const total = [...pluginEnglish.values()].reduce((count, dict) => count + Object.keys(dict).length, 0)
  const missing = [...pluginEnglish.keys()].filter((namespace) => !dictionaries.some(([name]) => name === namespace))
  t.diagnostic(
    `translated ${translated}/${total} third-party keys; ${missing.length} of ${pluginEnglish.size} captured namespaces have no Korean dictionary`,
  )
})

test('third-party dictionaries attach only after their owner registers', { skip: untranslated }, async () => {
  for (const namespace of translated) {
    const harness = applyClient()
    assert.deepEqual(
      harness.registered.filter(([name]) => name === namespace),
      [],
      `nothing attaches before any owner registers (${namespace})`,
    )
    harness.own(namespace, { en: pluginEnglish.get(namespace), locales: new Set(['en', 'zh']) })
    await tick()
    assert.deepEqual(
      harness.registered.filter(([name]) => name === namespace).map(([name, locale]) => [name, locale]),
      [[namespace, 'ko']],
    )
  }

  const { registered } = applyClient(installed)
  await tick()
  const attached = registered.map(([name]) => name).filter((name) => pluginEnglish.has(name))
  assert.deepEqual(
    attached.sort(),
    [...translated].sort(),
    'every translated namespace attaches when its owner registers',
  )
})

test('an owner that ships Korean keeps its own', { skip: untranslated }, async () => {
  const owners = new Map(
    translated.map((namespace) => [
      namespace,
      { en: pluginEnglish.get(namespace), locales: new Set(['en', 'zh', 'ko']) },
    ]),
  )
  const { registered } = applyClient(owners)
  await tick()
  assert.deepEqual(
    registered.filter(([name]) => pluginEnglish.has(name)),
    [],
    'no translated namespace is registered when its owner ships Korean',
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
