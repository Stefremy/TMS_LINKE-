const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Execute the real TypeScript modules with isolated dependency mocks, without Next
// request infrastructure, credentials, package hooks, or any network access.
function createLoader(mocks) {
  const root = path.resolve(__dirname, '../..')
  const cache = new Map()
  function load(filename) {
    const absolute = path.resolve(root, filename)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const loadedModule = { exports: {} }
    cache.set(absolute, loadedModule)
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      fileName: absolute,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    function localRequire(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      // Tests run server modules directly; the Next build enforces this compile-time marker.
      if (id === 'server-only') return {}
      if (!id.startsWith('@/') && !id.startsWith('.')) throw new Error(`Unmocked dependency: ${id}`)
      const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(absolute), id)
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
      if (!resolved) throw new Error(`Module not found: ${id}`)
      if (resolved.endsWith('.css')) return new Proxy({}, { get: (_, prop) => String(prop) })
      return load(resolved)
    }
    const fetch = mocks.fetch || (() => { throw new Error('Network access is forbidden in security tests') })
    const quietConsole = { log() {}, warn() {}, error() {} }
    new Function('require', 'exports', 'module', 'fetch', 'console', source)(
      localRequire, loadedModule.exports, loadedModule, fetch, quietConsole)
    return loadedModule.exports
  }
  return load
}

module.exports = { createLoader }
