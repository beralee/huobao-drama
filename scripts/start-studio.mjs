import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontend = path.join(root, 'frontend/.output/public')
if (!fs.existsSync(path.join(frontend, 'index.html'))) {
  console.error('请先运行 npm run build:frontend'); process.exit(1)
}
const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: path.join(root, 'backend'), stdio: 'inherit', windowsHide: true,
  env: { ...process.env, HOST: '127.0.0.1', PORT: process.env.PORT || '5679', FRONTEND_DIST: frontend, HUOBAO_VERSION: 'studio-0.1.0' },
})
child.on('error', error => { console.error(error.message); process.exit(1) })
child.on('exit', code => process.exit(code ?? 1))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
