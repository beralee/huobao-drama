import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-export-'))
process.env.SQLITE_PATH = path.join(temp, 'test.sqlite3')
process.env.STORAGE_PATH = path.join(temp, 'static')
fs.mkdirSync(process.env.STORAGE_PATH, { recursive: true })
const { db, schema, getInsertId } = await import('../src/db/index.js')
const { ffmpeg } = await import('../src/utils/ffmpeg.js')
const { saveReview, sourceVersion, mediaPath, probeMedia } = await import('../src/services/shot-review.js')
const { mergeEpisodeVideos } = await import('../src/services/ffmpeg-merge.js')

test('export gates review and trims mixed audio/silent sources to fractional cuts', { timeout: 60000 }, async () => {
  const ts = new Date().toISOString()
  const dramaId = getInsertId(db.insert(schema.dramas).values({ title: 'Export fixture', aspectRatio: '9:16', createdAt: ts, updatedAt: ts }).run())
  const episodeId = getInsertId(db.insert(schema.episodes).values({ dramaId, episodeNumber: 1, title: 'Fixture', createdAt: ts, updatedAt: ts }).run())
  const ids: number[] = []
  for (let i = 0; i < 2; i++) {
    const url = `static/clip-${i}.mp4`
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg().input(`color=c=${i ? 'blue' : 'red'}:s=${i ? '128x128' : '320x180'}:r=24:d=3`).inputOptions(['-f', 'lavfi'])
      if (!i) cmd.input('sine=frequency=440:duration=3').inputOptions(['-f', 'lavfi'])
      cmd.outputOptions(['-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac'])
        .output(mediaPath(url)).on('end', () => resolve()).on('error', reject).run()
    })
    ids.push(getInsertId(db.insert(schema.storyboards).values({ episodeId, storyboardNumber: i + 1, videoUrl: url, createdAt: ts, updatedAt: ts }).run()))
  }
  await assert.rejects(mergeEpisodeVideos(episodeId, dramaId, ids), /尚未审片通过/)
  await assert.rejects(mergeEpisodeVideos(episodeId, dramaId, []), /不存在或已删除/)
  for (let i = 0; i < 2; i++) saveReview(ids[i], { status: 'approved', notes: 'Synthetic fixture', inPoint: i ? 0.25 : 0.5, outPoint: i ? 1 : 1.5, sourceVersion: sourceVersion(`static/clip-${i}.mp4`) })
  const id = await mergeEpisodeVideos(episodeId, dramaId, ids)
  await assert.rejects(mergeEpisodeVideos(episodeId, dramaId, ids), /已有导出任务/)
  let result
  for (let n = 0; n < 250; n++) {
    result = db.select().from(schema.videoMerges).all().find(m => m.id === id)
    if (result?.status === 'completed' || result?.status === 'failed') break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(result?.status, 'completed', result?.errorMsg || 'export timed out')
  const meta = await probeMedia(mediaPath(result!.mergedUrl!))
  assert.ok(Math.abs(meta.duration - 1.75) < 0.15, `Expected 1.75 seconds, received ${meta.duration}`)
  assert.equal(meta.hasAudio, true)
  assert.equal(fs.readdirSync(path.join(process.env.STORAGE_PATH!, 'temp')).length, 0)
})
