#!/usr/bin/env node
/**
 * Extract the zh and en dictionaries dsh ships into source/en.json and
 * source/zh.json, for translation reference. English is the source of truth.
 *
 *   node scripts/extract.mjs <dsh-checkout> <git-tag>
 *
 * The checkout is a read-only dsh git clone; the tag must exist there. Sources
 * are unpacked once under .cache/<tag> (never deleted by this script).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createContext, runInContext } from 'node:vm'

const SOURCE_FILE = /^packages\/[^/]+\/[^/]+\/src\/.*\.tsx?$/
const EXPERIMENTAL_PREFIX = '@deepseek-ai/dsh-experimental-'

// Some locale modules re-export dsh packages for other surfaces; those
// specifiers cannot resolve in this checkout, so drop them before loading.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !url.endsWith('.ts')) return nextLoad(url, context)
    const source = readFileSync(new URL(url), 'utf8').replace(
      /^[ \t]*(?:import|export)\b[^\n]*\bfrom\s*['"](?!\.)[^'"]*['"][^\n]*$|^[ \t]*import\s*['"](?!\.)[^'"]*['"][^\n]*$/gm,
      '',
    )
    return { format: 'module-typescript', source, shortCircuit: true }
  },
})

const [checkoutArg, tag] = process.argv.slice(2)
if (checkoutArg === undefined || tag === undefined) {
  console.error('usage: node scripts/extract.mjs <dsh-checkout> <git-tag>')
  process.exit(2)
}
const checkout = resolve(checkoutArg)
const cacheRoot = fileURLToPath(new URL('../.cache', import.meta.url))
const cacheDir = join(cacheRoot, tag)
const sourceDir = fileURLToPath(new URL('../source', import.meta.url))

if (!existsSync(join(cacheDir, 'packages'))) {
  const archive = execFileSync('git', ['-C', checkout, 'archive', tag, 'packages'], { maxBuffer: 1 << 30 })
  mkdirSync(cacheRoot, { recursive: true })
  const staging = mkdtempSync(join(cacheRoot, 'staging-'))
  const untar = spawnSync('tar', ['-x', '-C', staging], { input: archive })
  if (untar.status !== 0) {
    console.error(`failed to unpack ${tag} from ${checkout}; partial files remain in ${staging}`)
    process.exit(2)
  }
  renameSync(staging, cacheDir)
}

/** Every source file under the cache that can register dictionaries. */
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (SOURCE_FILE.test(relative(cacheDir, path))) yield path
  }
}

/**
 * Directories of the experimental packages this release installs: the CLI's
 * own runtime dependencies (others are published but not shipped) plus the
 * experimental packages those depend on.
 */
function shippedExperimentalDirs() {
  const root = join(cacheDir, 'packages', 'experimental')
  if (!existsSync(root)) return new Set()
  const manifest = JSON.parse(
    execFileSync('git', ['-C', checkout, 'show', `${tag}:apps/cli/package.json`], { encoding: 'utf8' }),
  )
  const byName = new Map()
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(root, entry.name)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    byName.set(pkg.name, { dir, dependencies: Object.keys(pkg.dependencies ?? {}) })
  }
  const shipped = new Set()
  const pending = Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith(EXPERIMENTAL_PREFIX))
  while (pending.length > 0) {
    const name = pending.pop()
    const pkg = byName.get(name)
    if (pkg === undefined || shipped.has(name)) continue
    shipped.add(name)
    pending.push(...pkg.dependencies.filter((dependency) => dependency.startsWith(EXPERIMENTAL_PREFIX)))
  }
  console.log(`experimental packages: ${[...shipped].sort().join(', ')}`)
  return new Set([...shipped].map((name) => relative(cacheDir, byName.get(name).dir)))
}

/** Split `text` on `sep` separators that sit outside brackets and strings. */
function splitTopLevel(text, sep) {
  const parts = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote !== null) {
      if (char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === "'" || char === '"' || char === '`') quote = char
    else if (char === '(' || char === '[' || char === '{') depth++
    else if (char === ')' || char === ']' || char === '}') depth--
    else if (char === sep && depth === 0) {
      parts.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(text.slice(start).trim())
  return parts.filter((part) => part !== '')
}

/** Read one expression starting at `start`, returning its text and end index. */
function readExpression(src, start) {
  let i = start
  while (/\s/.test(src[i])) i++
  const first = src[i]
  if (first === undefined) return undefined
  if (first === "'" || first === '"' || first === '`') {
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '\\') j++
      else if (src[j] === first) return { text: src.slice(i, j + 1), end: j + 1 }
    }
    return undefined
  }
  if (first === '{' || first === '[' || first === '(') {
    const closing = { '{': '}', '[': ']', '(': ')' }[first]
    let depth = 0
    let quote = null
    for (let j = i; j < src.length; j++) {
      const char = src[j]
      if (quote !== null) {
        if (char === '\\') j++
        else if (char === quote) quote = null
        continue
      }
      if (char === "'" || char === '"' || char === '`') quote = char
      else if (char === first) depth++
      else if (char === closing && --depth === 0) return { text: src.slice(i, j + 1), end: j + 1 }
    }
    return undefined
  }
  let j = i
  while (j < src.length && !/[,;)\n}\]]/.test(src[j])) j++
  return { text: src.slice(i, j).trim(), end: j }
}

const moduleCache = new Map()

/** Import a relative module from the unpacked cache. */
async function loadModule(file, specifier) {
  if (!specifier.startsWith('.')) throw new Error(`${file.path}: cannot resolve package import ${specifier}`)
  const path = resolve(dirname(file.path), specifier)
  if (!moduleCache.has(path)) moduleCache.set(path, await import(pathToFileURL(path).href))
  return moduleCache.get(path)
}

/** Parse `import` declarations: local name -> { exportName, specifier }. */
function parseImports(src) {
  const imports = new Map()
  for (const match of src.matchAll(/import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2/g)) {
    const clause = match[1].trim()
    if (/^type\b/.test(clause)) continue
    const named = clause.match(/\{([\s\S]*)\}/)
    if (named === null) continue
    for (const raw of splitTopLevel(named[1], ',')) {
      const item = raw.replace(/^type\s+/, '').trim()
      if (item === '' || item === 'type') continue
      const alias = item.split(/\s+as\s+/)
      imports.set((alias[1] ?? alias[0]).trim(), { exportName: alias[0].trim(), specifier: match[3] })
    }
  }
  return imports
}

/** The only declaration of `name` in the file; several bindings are ambiguous and fail. */
function declarationOf(file, name) {
  const pattern = new RegExp(`(?:^|[\\s;{}(,])(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*(?::[^=\\n]+)?=`, 'gm')
  const matches = [...file.src.matchAll(pattern)]
  if (matches.length + (file.imports.has(name) ? 1 : 0) > 1)
    throw new Error(`${file.rel}: ${name} is bound more than once`)
  return matches[0]
}

/** Resolve an identifier to a same-file declaration or an imported binding. */
async function resolveIdentifier(file, name) {
  const declaration = declarationOf(file, name)
  if (declaration !== undefined) {
    const expression = readExpression(file.src, declaration.index + declaration[0].length)
    return expression === undefined ? undefined : evaluate(file, expression.text)
  }
  const imported = file.imports.get(name)
  if (imported === undefined) return undefined
  return (await loadModule(file, imported.specifier))[imported.exportName]
}

/** Evaluate an expression, resolving referenced identifiers on demand. */
async function evaluate(file, expr) {
  const scope = {}
  const context = createContext(scope)
  for (;;) {
    try {
      return runInContext(`(${expr})`, context)
    } catch (error) {
      const missing = error.name === 'ReferenceError' ? /^([A-Za-z_$][\w$]*) is not defined$/.exec(error.message) : null
      const name = missing?.[1]
      if (name === undefined || name in scope) return undefined
      const value = await resolveIdentifier(file, name)
      if (value === undefined) return undefined
      scope[name] = value
    }
  }
}

/** Resolve `register(ns, locale, dict)` when locale and dict come from a for-of loop. */
async function resolveLoopDictionaries(file, call, localeName, dictName) {
  const header = /for\s*\(\s*const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*of\s*/g
  let last
  for (const match of file.src.matchAll(header)) {
    if (match.index > call.index) break
    if (match[1] === localeName && match[2] === dictName) last = match
  }
  if (last === undefined) return undefined
  const iterable = readExpression(file.src, last.index + last[0].length)
  const tuples = iterable === undefined ? undefined : await evaluate(file, iterable.text)
  if (!Array.isArray(tuples)) return undefined
  const entries = []
  for (const tuple of tuples) {
    if (
      !Array.isArray(tuple) ||
      tuple.length !== 2 ||
      typeof tuple[0] !== 'string' ||
      typeof tuple[1] !== 'object' ||
      tuple[1] === null
    )
      return undefined
    entries.push([tuple[0], tuple[1]])
  }
  return entries
}

/** Locate every `locale.register(...)` call with its split arguments. */
function findCalls(src) {
  const calls = []
  for (const match of src.matchAll(/locale\??\.register\s*\(/g)) {
    const open = match.index + match[0].length - 1
    let depth = 0
    let quote = null
    let close = -1
    for (let i = open; i < src.length; i++) {
      const char = src[i]
      if (quote !== null) {
        if (char === '\\') i++
        else if (char === quote) quote = null
        continue
      }
      if (char === "'" || char === '"' || char === '`') quote = char
      else if (char === '(') depth++
      else if (char === ')' && --depth === 0) {
        close = i
        break
      }
    }
    if (close < 0) continue
    calls.push({
      index: match.index,
      line: src.slice(0, match.index).split('\n').length,
      args: splitTopLevel(src.slice(open + 1, close), ','),
    })
  }
  return calls
}

/** Resolve one call into (namespace, locale, dictionary) contributions. */
async function extractCall(file, call) {
  const namespace = await evaluate(file, call.args[0] ?? '')
  if (typeof namespace !== 'string') return undefined
  const rest = call.args.slice(1)
  if (rest.length === 1) {
    const dict = await evaluate(file, rest[0])
    if (typeof dict !== 'object' || dict === null) return undefined
    const entries = Object.entries(dict).filter(([locale]) => locale === 'en' || locale === 'zh')
    return entries.length === 0 ? undefined : { namespace, entries }
  }
  if (rest.length === 2) {
    const locale = await evaluate(file, rest[0])
    if (typeof locale === 'string') {
      const dict = await evaluate(file, rest[1])
      return typeof dict === 'object' && dict !== null ? { namespace, entries: [[locale, dict]] } : undefined
    }
    const entries = await resolveLoopDictionaries(file, call, rest[0].trim(), rest[1].trim())
    if (entries !== undefined) return { namespace, entries }
  }
  return undefined
}

const tables = { en: new Map(), zh: new Map() }
const unresolved = []
const experimentalDirs = shippedExperimentalDirs()

for (const path of [...walk(join(cacheDir, 'packages'))].sort()) {
  const rel = relative(cacheDir, path)
  if (rel.startsWith('packages/experimental/') && !experimentalDirs.has(rel.split('/').slice(0, 3).join('/'))) continue
  const file = { path, rel, src: readFileSync(path, 'utf8') }
  file.imports = parseImports(file.src)
  for (const call of findCalls(file.src)) {
    const result = await extractCall(file, call)
    if (result === undefined) {
      unresolved.push(`${rel}:${call.line}`)
      continue
    }
    for (const [locale, dict] of result.entries) {
      if (tables[locale] === undefined) continue
      const namespace = tables[locale].get(result.namespace) ?? new Map()
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value !== 'string')
          throw new Error(`${rel}:${call.line}: ${result.namespace}.${key} is not a string`)
        const existing = namespace.get(key)
        if (existing !== undefined && existing !== value) {
          throw new Error(
            `${rel}:${call.line}: conflicting values for ${result.namespace}.${key}: ${JSON.stringify(existing)} vs ${JSON.stringify(value)}`,
          )
        }
        namespace.set(key, value)
      }
      tables[locale].set(result.namespace, namespace)
    }
  }
}

if (unresolved.length > 0) {
  console.error(`unresolved register calls (${unresolved.length}):`)
  for (const site of unresolved) console.error(`  ${site}`)
  process.exit(1)
}

/** Sort namespaces and keys so translation diffs stay readable. */
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const sorted = (table) =>
  Object.fromEntries(
    [...table]
      .sort(([a], [b]) => compare(a, b))
      .map(([namespace, keys]) => [namespace, Object.fromEntries([...keys].sort(([a], [b]) => compare(a, b)))]),
  )

mkdirSync(sourceDir, { recursive: true })
for (const [locale, table] of Object.entries(tables)) {
  const data = sorted(table)
  const keys = Object.values(data).reduce((total, dict) => total + Object.keys(dict).length, 0)
  writeFileSync(join(sourceDir, `${locale}.json`), `${JSON.stringify(data, null, 2)}\n`)
  console.log(`source/${locale}.json: ${Object.keys(data).length} namespaces, ${keys} keys`)
}
