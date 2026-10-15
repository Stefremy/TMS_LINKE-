const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pkgPath = path.join(root, 'package.json')
const versionPath = path.join(root, 'lib', 'config', 'version.ts')

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const currentVersion = pkg.version || '2.8.5'
const parts = currentVersion.split('.').map(Number)
if (parts.length === 3 && !parts.some(isNaN)) {
  parts[2] += 1
  pkg.version = parts.join('.')
} else {
  pkg.version = '2.8.5'
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const content = `// This file is auto-generated. Do not edit directly.\nexport const APP_VERSION = "v${pkg.version}"\n`
fs.writeFileSync(versionPath, content)

console.log(`[version] Bumped version to v${pkg.version}`)
