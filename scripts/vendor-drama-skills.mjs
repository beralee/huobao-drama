// Refresh only from the reviewed, pinned Git checkout. No network or runtime install.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const revision = '3d813c30871b4db5f2387d83bdc3a49db8ce7b2b'
const source = path.resolve(process.argv[2] || '../.cache/drama-skills-upstream')
if (execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw new Error('Upstream revision does not match reviewed pin')
if (execFileSync('git', ['-C', source, 'status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Upstream checkout must be clean')
const destination = fileURLToPath(new URL('../backend/workspace/drama-skills/', import.meta.url))
const skills = ['short-drama-write', 'short-drama-assets', 'short-drama-image-prompts', 'short-drama-storyboard', 'short-drama-video-prompts', 'short-drama-edit', 'short-drama-review']
fs.mkdirSync(destination, { recursive: true })
for (const name of skills) fs.cpSync(path.join(source, 'skills', name), path.join(destination, name), { recursive: true })
for (const name of ['LICENSE', 'VERSION']) fs.copyFileSync(path.join(source, name), path.join(destination, name))
const files = {}
function visit(dir, prefix = '') {
  for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix + item.name
    if (item.isDirectory()) visit(path.join(dir, item.name), relative + '/')
    else if (item.name !== 'manifest.json') files[relative] = createHash('sha256').update(fs.readFileSync(path.join(dir, item.name))).digest('hex')
  }
}
visit(destination)
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ repository: 'https://github.com/zenstory-ai/drama-skills', revision, version: '0.11.2', license: 'MIT', skills, files }, null, 2) + '\n')
console.log(`Pinned ${skills.length} skills, ${Object.keys(files).length} files at ${revision}`)
