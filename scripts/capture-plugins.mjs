#!/usr/bin/env node
/**
 * Capture the locale dictionaries third-party client plugins register through
 * `ctx.locale.register`, for translation reference.
 *
 *   node scripts/capture-plugins.mjs [name@version ...]
 *
 * With no arguments the packages pinned below are captured; each file records
 * the exact version it came from. Pass `name@version` (or `name@latest`)
 * arguments to capture something else. Packages are downloaded with `npm
 * pack` into .cache/plugins (never deleted by this script), then their client
 * bundles run in a child `node --permission` process. The stub below stands in
 * for the dsh client module loader; it is not a security boundary, so the
 * child may only read the download cache and write source/plugins. The
 * permission model blocks child_process and filesystem access elsewhere; it
 * does not restrict network access.
 *
 * Every locale a namespace registers is recorded, so a plugin that already
 * ships Korean is visible in its file. Such a namespace cannot be translated
 * here because our registration would collide with the owner's, so the run
 * reports it and exits 1. A package that cannot be captured leaves no file and
 * also exits 1.
 */
import { spawnSync, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/**
 * Packages to capture when no argument is given, pinned to the npm `latest`
 * at capture time. Pass `name@version` arguments to capture other versions.
 */
const PACKAGES = [
  'dshmarket@1.66.8',
  '@michengai/dsh-archive-manager@1.0.11',
  'dsh-plugin-model-proxy@0.1.6',
  '@xmanrui/dsh-im@4.35.1',
  'dsh-pet@0.3.5',
  'dsh-mnemon@0.5.24',
  '@nanmicoder/dsh-agent-teams@0.1.22',
  'dsh-univer-office@0.3.6',
  '@michengai/dsh-skills-manager@1.1.9',
  'dsh-codex-subscription@2.5.2',
]

const cacheDir = fileURLToPath(new URL('../.cache/plugins', import.meta.url))
const sourceDir = fileURLToPath(new URL('../source/plugins', import.meta.url))

/** One file per package; scoped names lose their scope marker. */
function fileName(name) {
  return `${name.replace(/^@/, '').replace('/', '-')}.json`
}

/** A callable stand-in for anything a bundle touches that this script does not model. */
function stub() {
  const target = function () {}
  return new Proxy(target, {
    get(object, property) {
      if (property === 'then') return undefined
      if (property === Symbol.toPrimitive) return () => ''
      if (property === 'toString') return () => ''
      if (property === Symbol.iterator) return function* () {}
      if (property === Symbol.asyncIterator) return undefined
      // Keep the proxy's behavior when the bundle binds a stubbed method.
      if (property === 'bind') return () => stub()
      if (!(property in object)) object[property] = stub()
      return object[property]
    },
    apply: () => stub(),
    construct: () => stub(),
    set: () => true,
  })
}

/**
 * A module namespace: every export resolves, and the internal `__toESM` helper
 * of the bundle's bundler keeps resolving through its prototype chain.
 */
function moduleNamespace() {
  const proto = new Proxy({}, { get: (_target, property) => property === '__esModule' ? true : stub() })
  return new Proxy({}, {
    get: (_target, property) => property === '__esModule' ? true : stub(),
    getPrototypeOf: () => proto,
  })
}

/** Run one client bundle under the stub and return its `locale.register` calls. */
async function captureRegistrations(code, filename) {
  const registrations = []
  const errors = []
  const element = () => ({
    dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: '',
    innerHTML: '', children: [], childNodes: [], firstChild: null, lastChild: null, parentNode: null,
    parentElement: null, previousSibling: null, nextSibling: null, ownerDocument: null, shadowRoot: null,
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, hasAttribute: () => false,
    appendChild: value => value, insertBefore: value => value, replaceChild: value => value, removeChild: value => value,
    append() {}, prepend() {}, remove() {}, replaceChildren() {}, cloneNode: () => element(),
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, matches: () => false,
    contains: () => false, getRootNode: () => null, attachShadow: () => element(),
    focus() {}, blur() {}, click() {}, scrollIntoView() {}, scrollTo() {}, setPointerCapture() {},
    releasePointerCapture() {}, getBoundingClientRect: () => ({}), getClientRects: () => [],
    animate: () => ({ finished: Promise.resolve(), cancel() {}, play() {}, pause() {} }),
    getElementsByClassName: () => [], getElementsByTagName: () => [],
  })
  const locale = {
    register: (ns, localeOrDicts, dict) => {
      registrations.push(dict === undefined ? [ns, localeOrDicts] : [ns, localeOrDicts, dict])
      return () => {}
    },
    bind: () => key => key,
    addLanguage: () => () => {},
    resolveText: text => typeof text === 'string' ? text : text.en,
  }
  const ctx = new Proxy({}, {
    get(_target, property) {
      if (property === 'locale') return locale
      if (property === 'effect') return (callback) => {
        try {
          const result = callback()
          return typeof result === 'function' ? result : () => {}
        } catch (error) {
          errors.push(String(error))
          return () => {}
        }
      }
      if (property === 'inject') return (_dependencies, callback) => {
        try {
          const result = callback(ctx)
          return typeof result === 'function' ? result : () => {}
        } catch (error) {
          errors.push(String(error))
          return () => {}
        }
      }
      if (property === 'on') return () => () => {}
      if (property === 'fiber') return { uid: 1 }
      if (property === 'get') return () => stub()
      return stub()
    },
  })
  const document = {
    createElement: element, createTextNode: element, createComment: element, createDocumentFragment: element,
    head: element(), body: element(), documentElement: element(), readyState: 'complete', hidden: false,
    visibilityState: 'visible', title: '', cookie: '', activeElement: null, fonts: { ready: Promise.resolve() },
    querySelector: () => element(), querySelectorAll: () => [], getElementById: () => element(),
    getElementsByClassName: () => [], getElementsByTagName: () => [], elementFromPoint: () => null,
    elementsFromPoint: () => [], hasFocus: () => true,
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  }
  const navigator = {
    language: 'en', languages: ['en'], userAgent: 'node', platform: 'node', onLine: true, maxTouchPoints: 0,
    clipboard: stub(), getGamepads: () => [], sendBeacon: () => true,
  }
  const globals = {}
  for (const name of ['AbortController', 'AbortSignal', 'EventTarget', 'Event', 'CustomEvent', 'ErrorEvent',
    'MessageEvent', 'MessageChannel', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'Blob', 'File',
    'FormData', 'Headers', 'Request', 'Response', 'WebSocket', 'performance', 'crypto', 'structuredClone',
    'atob', 'btoa']) {
    if (globalThis[name] !== undefined) globals[name] = globalThis[name]
  }
  let registration
  const window = { __ModuleLoader__: { load: value => { registration = value } }, document, navigator }
  const windowProxy = new Proxy(window, {
    get: (target, property) => property in target ? target[property] : property in context ? context[property] : stub(),
  })
  const context = createContext({
    window: windowProxy, document, navigator, console: { log() {}, warn() {}, info() {}, debug() {}, error() {} },
    fetch: () => new Promise(() => {}), setTimeout, clearTimeout, queueMicrotask, setImmediate,
    setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    getComputedStyle: () => ({}), matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    localStorage: {}, sessionStorage: {}, location: { href: 'http://127.0.0.1/' },
    history: { pushState() {}, replaceState() {} },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return [] } },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    customElements: { define() {}, get: () => undefined },
    Image: class { addEventListener() {} }, Audio: class { play() { return Promise.resolve() } pause() {} },
    DOMParser: class { parseFromString() { return document } },
    XMLHttpRequest: class { open() {} send() {} setRequestHeader() {} addEventListener() {} },
    HTMLElement: class {}, HTMLDivElement: class {}, Element: class {}, Node: class {},
    ...globals,
  })
  context.self = windowProxy
  context.globalThis = context

  runInContext(code, context, { filename })
  if (registration === undefined) throw new Error(`${filename}: bundle did not call window.__ModuleLoader__.load`)
  const exports = registration.factory(() => moduleNamespace())
  const apply = typeof exports === 'function' ? exports : exports.apply
  if (typeof apply !== 'function') throw new Error(`${filename}: bundle exports no apply()`)
  let applyError
  try {
    await apply(ctx)
  } catch (error) {
    applyError = error
  }
  return { registrations, errors, applyError }
}

/** `name@version` for a package name that may be scoped. */
function splitSpec(spec) {
  const at = spec.lastIndexOf('@')
  return at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, undefined]
}

/** Download and unpack one package version, keeping the extraction as a cache. */
function fetchPackage(name, version) {
  if (version === undefined || version === 'latest') {
    version = execFileSync('npm', ['view', name, 'version'], { encoding: 'utf8' }).trim()
  }
  const dir = join(cacheDir, `${name.replace(/^@/, '').replace('/', '-')}@${version}`)
  const bundleDir = join(dir, 'package')
  if (!existsSync(join(bundleDir, 'package.json'))) {
    mkdirSync(dir, { recursive: true })
    const packed = JSON.parse(execFileSync('npm', ['pack', `${name}@${version}`, '--json', '--pack-destination', cacheDir], { encoding: 'utf8' }))
    const tarball = (Array.isArray(packed) ? packed[0] : Object.values(packed)[0]).filename
    execFileSync('tar', ['-xzf', join(cacheDir, tarball), '-C', dir])
  }
  return { version, bundleDir }
}

/** The client bundle a package's `exports["./client"]` names. */
function clientBundlePath(bundleDir) {
  const manifest = JSON.parse(readFileSync(join(bundleDir, 'package.json'), 'utf8'))
  const entry = manifest.exports?.['./client']
  const path = typeof entry === 'string' ? entry : entry?.default
  if (typeof path !== 'string') throw new Error(`${manifest.name} declares no exports["./client"]`)
  const bundle = join(bundleDir, path)
  if (!existsSync(bundle)) throw new Error(`${manifest.name} client bundle ${path} does not exist`)
  return { name: manifest.name, bundle }
}

/** Every locale a namespace registers, in a stable shape. */
function localesOf(registrations) {
  const namespaces = new Map()
  for (const [ns, localeOrDicts, dict] of registrations) {
    const entries = dict === undefined ? Object.entries(localeOrDicts) : [[localeOrDicts, dict]]
    if (entries.length === 0) continue
    const locales = namespaces.get(ns) ?? new Map()
    for (const [locale, values] of entries) {
      if (locales.has(locale)) throw new Error(`namespace ${ns} registers locale ${locale} twice`)
      locales.set(locale, values)
    }
    namespaces.set(ns, locales)
  }
  for (const [ns, locales] of namespaces) {
    if (!locales.has('en')) throw new Error(`namespace ${ns} has no English dictionary`)
  }
  return namespaces
}

/** Capture mode, run in the permission-restricted child. */
async function capturePackages(entries) {
  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  const capturedNamespaces = new Map()
  const failures = []
  const shippedKorean = []
  for (const { name, version, bundle } of entries) {
    try {
      const code = readFileSync(bundle, 'utf8')
      const { registrations, errors, applyError } = await captureRegistrations(code, bundle)
      for (const error of errors) console.error(`${name}: effect() error: ${error}`)
      const calls = (code.match(/locale\??\.register\s*\(/g) ?? []).length
      if (registrations.length < calls) {
        console.error(`${name}: ${calls} locale.register calls in the bundle, ${registrations.length} ran`)
      }
      const namespaces = localesOf(registrations)
      if (namespaces.size === 0) {
        if (applyError?.stack !== undefined) console.error(applyError.stack)
        throw new Error(`captured no dictionaries${applyError === undefined ? '' : ` (apply: ${applyError})`}`)
      }
      if (applyError !== undefined) console.error(`${name}: apply() stopped early after capture: ${applyError}`)

      const sorted = {}
      for (const [ns, locales] of [...namespaces].sort(([a], [b]) => compare(a, b))) {
        if (capturedNamespaces.has(ns)) throw new Error(`namespace ${ns} is already registered by ${capturedNamespaces.get(ns)}`)
        const korean = [...locales.keys()].filter(locale => /^ko(-|$)/i.test(locale))
        if (korean.length > 0) shippedKorean.push(`${name}@${version}: ${ns} (${korean.join(', ')})`)
        sorted[ns] = Object.fromEntries([...locales].sort(([a], [b]) => compare(a, b)).map(([locale, dict]) => [
          locale, Object.fromEntries([...Object.entries(dict)].sort(([a], [b]) => compare(a, b))),
        ]))
      }
      for (const ns of Object.keys(sorted)) capturedNamespaces.set(ns, `${name}@${version}`)

      const file = fileName(name)
      writeFileSync(join(sourceDir, file), `${JSON.stringify({ package: name, version, namespaces: sorted }, null, 2)}\n`)
      const keys = Object.values(sorted).map(dict => Object.keys(dict.en).length).join(' + ')
      console.log(`source/plugins/${file}: ${Object.keys(sorted).join(', ')} (${keys} en keys)`)
    } catch (error) {
      failures.push(`${name}@${version}`)
      console.error(`${name}@${version}: capture failed: ${error instanceof Error ? error.message : error}`)
    }
  }
  if (failures.length > 0) console.error(`${failures.length} of ${entries.length} packages failed: ${failures.join(', ')}`)
  if (shippedKorean.length > 0) {
    console.error('these namespaces already ship Korean and must not be translated:')
    for (const namespace of shippedKorean) console.error(`  ${namespace}`)
  }
  if (failures.length > 0 || shippedKorean.length > 0) process.exitCode = 1
}

/** Driver mode: download the packages, then capture them in the child process. */
async function captureAll(specs) {
  const selected = specs.length > 0 ? specs : PACKAGES
  mkdirSync(sourceDir, { recursive: true })

  const entries = []
  const downloadFailures = []
  for (const spec of selected) {
    try {
      const { version, bundleDir } = fetchPackage(...splitSpec(spec))
      const { name, bundle } = clientBundlePath(bundleDir)
      entries.push({ name, version, bundle })
    } catch (error) {
      downloadFailures.push(spec)
      console.error(`${spec}: download failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  let captureFailed = false
  if (entries.length > 0) {
    const status = spawnSync(process.execPath, [
      '--permission',
      `--allow-fs-read=${cacheDir}`,
      `--allow-fs-read=${fileURLToPath(import.meta.url)}`,
      `--allow-fs-write=${sourceDir}`,
      fileURLToPath(import.meta.url),
      '--capture',
      JSON.stringify(entries),
    ], { stdio: 'inherit' })
    captureFailed = status.status !== 0
    if (status.error !== undefined) console.error(`capture child failed: ${status.error.message}`)
  }

  const selectedNames = new Set(selected.map(spec => splitSpec(spec)[0]))
  const stale = readdirSync(sourceDir)
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(readFileSync(join(sourceDir, file), 'utf8')))
    .filter(data => !selectedNames.has(data.package))
  if (stale.length > 0) {
    const list = stale.map(data => `source/plugins/${fileName(data.package)} (${data.package}@${data.version})`).join(', ')
    console.error(`not in this run: ${list}; move them to the Trash if no longer wanted`)
  }

  if (downloadFailures.length > 0) console.error(`${downloadFailures.length} of ${selected.length} packages failed to download: ${downloadFailures.join(', ')}`)
  if (downloadFailures.length > 0 || captureFailed) process.exitCode = 1
}

if (process.argv[2] === '--capture') await capturePackages(JSON.parse(process.argv[3]))
else await captureAll(process.argv.slice(2))
