import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { STORAGE_ROOT } from '../utils/paths.js'
import { ffmpeg } from '../utils/ffmpeg.js'
import { now } from '../utils/response.js'

export type Review = {
  status: 'pending' | 'approved' | 'rejected'
  notes: string
  inPoint: number
  outPoint: number
  sourceVersion: string
}

export function mediaPath(url: string): string {
  const relative = url.replace(/^\/?static\//, '')
  const root = path.resolve(STORAGE_ROOT)
  const resolved = path.resolve(root, relative)
  if (!resolved.startsWith(root + path.sep)) throw new Error('视频必须位于本项目素材目录')
  return resolved
}

export function sourceVersion(url: string): string {
  try {
    const stat = fs.statSync(mediaPath(url))
    return createHash('sha256').update(`${url}:${stat.size}:${stat.mtimeMs}`).digest('hex')
  } catch { return '' }
}

export function probeMedia(file: string): Promise<{ duration: number; hasAudio: boolean }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, meta) => {
      if (err) return reject(new Error('无法读取视频，请检查本地素材与 FFprobe'))
      const duration = Number(meta.format.duration)
      if (!Number.isFinite(duration) || duration <= 0) return reject(new Error('视频时长无效'))
      resolve({ duration, hasAudio: meta.streams.some(s => s.codec_type === 'audio') })
    })
  })
}

export function readReview(id: number, url: string): Review {
  const version = sourceVersion(url)
  const row = db.select().from(schema.appSettings).where(eq(schema.appSettings.key, `shot-review:${id}`)).get()
  try {
    const review = JSON.parse(row?.value || 'null')
    if (version && review?.sourceVersion === version) return review
  } catch { /* old or incomplete review */ }
  return { status: 'pending', notes: '', inPoint: 0, outPoint: 0, sourceVersion: version }
}

export function validateReview(body: any, duration: number, version: string): Review {
  if (!version || body?.sourceVersion !== version) throw new Error('素材已变化，请刷新后重新审片')
  if (!['pending', 'approved', 'rejected'].includes(body.status)) throw new Error('审片状态无效')
  if (typeof body.notes !== 'string' || body.notes.length > 4000) throw new Error('审片备注最多 4000 字')
  const { inPoint, outPoint } = body
  if (typeof inPoint !== 'number' || typeof outPoint !== 'number' || !Number.isFinite(inPoint) || !Number.isFinite(outPoint)
    || inPoint < 0 || outPoint <= inPoint || outPoint > duration + 0.001) throw new Error('入点、出点必须位于素材范围内，出点需晚于入点')
  if (body.status === 'rejected' && !body.notes.trim()) throw new Error('请填写退回原因')
  return { status: body.status, notes: body.notes.trim(), inPoint, outPoint: Math.min(outPoint, duration), sourceVersion: version }
}

export function saveReview(id: number, review: Review) {
  db.insert(schema.appSettings).values({ key: `shot-review:${id}`, value: JSON.stringify(review), updatedAt: now() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: JSON.stringify(review), updatedAt: now() } }).run()
}
