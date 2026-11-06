/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))]
const findings = []
for (const file of files) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue
  if (/^public\/(patches\/|Listagem de Clientes)/i.test(file)) findings.push(`${file}: private material in public assets`)
  if (fs.statSync(file).size > 2 * 1024 * 1024) continue
  const content = fs.readFileSync(file, 'utf8')
  for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1], 'base64url').toString()).role === 'service_role') findings.push(`${file}: embedded administrative JWT`)
    } catch { /* Non-JWT text. */ }
  }
  if (/process\.env\.[A-Z_]*(?:SECRET|PASSWORD|SERVICE_ROLE_KEY)\s*\|\|\s*["'][^"'\r\n]{12,}["']/.test(content)) findings.push(`${file}: embedded secret fallback`)
  if (/\bsb_secret_[A-Za-z0-9_-]{20,}/.test(content)) findings.push(`${file}: embedded Supabase secret key`)
}
if (findings.length) {
  console.error([...new Set(findings)].join('\n'))
  process.exitCode = 1
} else console.log('Release secret and public-file checks passed.')
