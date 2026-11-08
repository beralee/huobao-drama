/**
 * FFmpeg 多镜头拼接 — 将所有生成后的镜头视频拼接为一集
 */
import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { db, getInsertId, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../utils/response.js'
import { logTaskError, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { extractVideoPoster } from '../utils/video-poster.js'
import { ffmpeg, checkFfmpegSuite } from '../utils/ffmpeg.js'
import { DATA_ROOT, STORAGE_ROOT } from '../utils/paths.js'
import { mediaPath, probeMedia, readReview, sourceVersion, type Review } from './shot-review.js'

function toAbsPath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath
  if (relativePath.startsWith('static/')) return path.join(DATA_ROOT, relativePath)
  return path.join(STORAGE_ROOT, relativePath)
}

/**
 * 拼接一集的镜头视频。
 * 优先使用视频生成产物，兼容历史的 composedVideoUrl 数据。
 * 传入 storyboardIds 时只拼接所选镜头（仍按镜号顺序）。
 */
let mergeActive = false
export async function mergeEpisodeVideos(episodeId: number, dramaId: number, storyboardIds?: number[]): Promise<number> {
  if (mergeActive) throw new Error('已有导出任务正在运行，请完成后再试')
  mergeActive = true
  try { return await startMerge(episodeId, dramaId, storyboardIds) }
  catch (error) { mergeActive = false; throw error }
}

async function startMerge(episodeId: number, dramaId: number, storyboardIds?: number[]): Promise<number> {
  let storyboards = await db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.episodeId, episodeId))
    .orderBy(schema.storyboards.storyboardNumber)

  storyboards = storyboards.filter(sb => !sb.deletedAt)

  if (storyboardIds?.length) {
    const allow = new Set(storyboardIds.map(Number))
    storyboards = storyboards.filter(sb => allow.has(sb.id))
  }

  // Explicit selections must never silently drop missing or deleted shots.
  if (storyboardIds && (storyboardIds.length === 0 || storyboardIds.some(id => !storyboards.some(sb => sb.id === id)))) {
    throw new Error('所选镜头不存在或已删除，请刷新后重新选择')
  }
  const clips = storyboards
    .map(sb => ({ sb, url: sb.videoUrl || sb.composedVideoUrl }))
    .filter(c => Boolean(c.url)) as { sb: typeof storyboards[number]; url: string }[]

  if (clips.length === 0) throw new Error('所选镜头还没有可拼接的视频')
  if (clips.length !== storyboards.length) throw new Error('所选镜头中有未生成的视频，请先完成生成与审片')

  const reviews = clips.map(c => readReview(c.sb.id, c.url))
  const blocked = clips.filter((_, i) => reviews[i].status !== 'approved')
  if (blocked.length) throw new Error(`镜头 ${blocked.map(c => c.sb.storyboardNumber).join('、')} 尚未审片通过，请先进入逐镜审片`)

  // 拼接前探测 ffmpeg：二进制损坏时 fluent-ffmpeg 的同步 EFTYPE 会崩掉整个进程，
  // 这里提前拦截并给出可操作的修复指引（路由层会作为 400 返回前端）
  const suite = await checkFfmpegSuite()
  if (!suite.ffmpeg || !suite.ffprobe) {
    throw new Error('本机 ffmpeg 不可用，无法拼接视频（常见于 node_modules 跨平台拷贝或 ffmpeg-static 下载损坏）。请删除 node_modules 后在本机重新 npm install，或设置 FFMPEG_BIN 指向有效的 ffmpeg 可执行文件后重启服务')
  }

  // 校验视频文件真实存在:DB 里的 video_url 可能指向已被清理的文件,
  // 直接拼会得到 ffmpeg 的 "No such file or directory" 晦涩报错
  const missing = clips.filter(c => !fs.existsSync(toAbsPath(c.url)))
  if (missing.length > 0) {
    const nums = missing.map(c => `S${c.sb.storyboardNumber}`).join('、')
    throw new Error(`镜头 ${nums} 的视频文件已丢失（本地文件不存在），请重新生成这些镜头的视频，或在拼接时取消勾选`)
  }

  const videos = clips.map(c => c.url)

  logTaskStart('MergeTask', 'episode-merge', { episodeId, dramaId, clips: videos.length })

  // 创建 merge 记录
  const ts = now()
  const res = await db.insert(schema.videoMerges).values({
    episodeId,
    dramaId,
    title: `Episode ${episodeId} Merge`,
    provider: 'ffmpeg',
    model: 'ffmpeg-concat-h264-aac',
    status: 'processing',
    scenes: JSON.stringify(videos),
    createdAt: ts,
  })
  const mergeId = getInsertId(res)

  // 异步执行
  const drama = db.select().from(schema.dramas).where(eq(schema.dramas.id, dramaId)).get()
  doMerge(mergeId, episodeId, videos, reviews, drama?.aspectRatio || '9:16').catch(async err => {
    logTaskError('MergeTask', 'episode-merge', { mergeId, episodeId, error: err.message })
    console.error(`[Merge] Failed:`, err)
    await db.update(schema.videoMerges)
      .set({ status: 'failed', errorMsg: err.message })
      .where(eq(schema.videoMerges.id, mergeId))
  }).finally(() => { mergeActive = false })

  return mergeId
}

async function doMerge(mergeId: number, episodeId: number, videos: string[], reviews: Review[], aspectRatio: string) {
  // 生成 concat 列表文件
  const listDir = path.join(STORAGE_ROOT, 'temp', uuid())
  fs.mkdirSync(listDir, { recursive: true })
  const listPath = path.join(listDir, `${uuid()}.txt`)
  try {
  const [width, height] = aspectRatio === '16:9' ? [1280, 720] : aspectRatio === '1:1' ? [720, 720] : [720, 1280]
  const normalized: string[] = []
  // Normalize sequentially: trim video AND audio to the reviewed interval,
  // preserve the full frame with padding, and supply silence for silent clips.
  for (let i = 0; i < videos.length; i++) {
    const review = reviews[i]
    if (sourceVersion(videos[i]) !== review.sourceVersion) throw new Error('素材在导出前发生变化，请重新审片')
    const input = mediaPath(videos[i])
    const meta = await probeMedia(input)
    if (review.inPoint < 0 || review.outPoint > meta.duration + 0.001 || review.outPoint <= review.inPoint) throw new Error('剪辑区间超出源素材')
    const output = path.join(listDir, `${i}.mp4`)
    const length = review.outPoint - review.inPoint
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(input).seekInput(review.inPoint)
      if (!meta.hasAudio) command.input('anullsrc=r=48000:cl=stereo').inputOptions(['-f', 'lavfi'])
      command.duration(length).videoFilters(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`)
        .outputOptions(['-map', '0:v:0', '-map', meta.hasAudio ? '0:a:0' : '1:a:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', '-ar', '48000', '-af', 'apad', '-t', String(length)])
        .output(output).on('end', () => resolve()).on('error', reject).run()
    })
    normalized.push(output)
  }
  const listContent = normalized.map(v => `file '${v.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n')
  fs.writeFileSync(listPath, listContent, 'utf-8')

  // 输出文件
  const outputDir = path.join(STORAGE_ROOT, 'merged')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputFilename = `${uuid()}.mp4`
  const outputPath = path.join(outputDir, outputFilename)

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-fflags', '+genpts',
        '-c', 'copy',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()

  })

  // 清理临时文件
  fs.unlinkSync(listPath)

  // 获取时长
  const duration = await getVideoDuration(outputPath)

  const mergedRelative = `static/merged/${outputFilename}`

  // 成片海报帧（导出页封面用）
  await extractVideoPoster(mergedRelative)

  // 更新 merge 记录
  await db.update(schema.videoMerges)
    .set({ status: 'completed', mergedUrl: mergedRelative, duration, completedAt: now() })
    .where(eq(schema.videoMerges.id, mergeId))

  // 更新 episode
  await db.update(schema.episodes)
    .set({ videoUrl: mergedRelative, updatedAt: now() })
    .where(eq(schema.episodes.id, episodeId))

  logTaskSuccess('MergeTask', 'episode-merge', { mergeId, episodeId, output: mergedRelative, duration, clips: videos.length })
  } finally {
    // Only this export's UUID directory is removed, including on failure.
    fs.rmSync(listDir, { recursive: true, force: true })
  }
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) { resolve(0); return }
      resolve(Number(metadata.format.duration || 0))
    })
  })
}
