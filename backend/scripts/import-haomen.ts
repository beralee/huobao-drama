import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { db, getInsertId, schema } from '../src/db/index.js'
import { STORAGE_ROOT } from '../src/utils/paths.js'
import { now } from '../src/utils/response.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const project = path.resolve(process.argv[2] || path.join(root, 'short-drama/haomen-zhuixu'))
const story = JSON.parse(fs.readFileSync(path.join(project, 'story.json'), 'utf8'))
const manifest = JSON.parse(fs.readFileSync(path.join(project, 'generation-manifest.json'), 'utf8'))
const importKey = `local-import:${project}`
const existing = db.select().from(schema.appSettings).where(eq(schema.appSettings.key, importKey)).get()
if (existing) {
  console.log(`Already imported: ${existing.value}. Existing edits preserved.`)
  process.exit(0)
}
const folder = `imports/haomen-${Date.now()}`
const copy = (source: string, filename: string) => {
  if (!fs.existsSync(source)) throw new Error(`Missing source: ${source}`)
  const target = path.join(STORAGE_ROOT, folder, filename)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
  return `static/${folder}/${filename}`
}
// Copy full source frames and clips, without modifying or cropping the originals.
const reference = copy(path.join(project, 'images/cast-reference.png'), 'cast-reference.png')
const assets = story.shots.map((shot: any) => ({ shot,
  image: copy(path.join(project, `images/shot-${shot.id}.png`), `shot-${shot.id}.png`),
  video: copy(manifest.shots[shot.id].file, `shot-${shot.id}.mp4`),
}))
const ts = now()
const result = db.transaction(tx => {
  const dramaId = getInsertId(tx.insert(schema.dramas).values({ title: story.title, description: '从现有本地项目导入。原始完整画幅，全部镜头待重新审片。', style: 'realistic', aspectRatio: '9:16', status: 'draft', createdAt: ts, updatedAt: ts }).run())
  const script = story.shots.map((s: any) => `【${s.name}】\n${s.speaker}：${s.line}`).join('\n\n')
  const episodeId = getInsertId(tx.insert(schema.episodes).values({ dramaId, episodeNumber: 1, title: '摊牌之夜 · 审片版', content: script, scriptContent: script, status: 'draft', createdAt: ts, updatedAt: ts }).run())
  const chars = new Map<string, number>()
  for (const [name, appearance] of Object.entries(story.cast)) {
    const id = getInsertId(tx.insert(schema.characters).values({ dramaId, name, appearance: String(appearance), description: String(appearance), referenceImages: JSON.stringify([reference]), createdAt: ts, updatedAt: ts }).run())
    chars.set(name, id)
    tx.insert(schema.episodeCharacters).values({ episodeId, characterId: id, createdAt: ts }).run()
  }
  const sceneId = getInsertId(tx.insert(schema.scenes).values({ dramaId, location: '豪门宴会厅', time: '夜晚', prompt: '暖金色灯光的宴会厅，水晶吊灯、大理石桌面，保持原项目空间与光线。', createdAt: ts, updatedAt: ts }).run())
  tx.insert(schema.episodeScenes).values({ episodeId, sceneId, createdAt: ts }).run()
  for (const { shot, image, video } of assets) {
    const id = getInsertId(tx.insert(schema.storyboards).values({ episodeId, sceneId, storyboardNumber: Number(shot.id), title: shot.name,
      description: `${shot.speaker}：${shot.line}`, duration: shot.duration, firstFrameImage: image, videoUrl: video,
      videoPrompt: shot.speech_motion || shot.motion, status: 'completed', createdAt: ts, updatedAt: ts }).run())
    // The shared reference includes all actors, so retain all as editable bindings.
    for (const characterId of chars.values()) tx.insert(schema.storyboardCharacters).values({ storyboardId: id, characterId }).run()
  }
  const value = JSON.stringify({ dramaId, episodeId, shots: assets.length })
  tx.insert(schema.appSettings).values({ key: importKey, value, updatedAt: ts }).run()
  return value
})
console.log(`Imported: ${result}`)
