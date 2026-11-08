import { Hono } from 'hono'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest, notFound } from '../utils/response.js'
import { readReview, saveReview, validateReview, mediaPath, sourceVersion, probeMedia } from '../services/shot-review.js'

const app = new Hono()

app.get('/episodes/:id', async c => {
  const episode = db.select().from(schema.episodes).where(and(eq(schema.episodes.id, Number(c.req.param('id'))), isNull(schema.episodes.deletedAt))).get()
  if (!episode) return notFound(c, '剧集不存在')
  const shots = db.select().from(schema.storyboards).where(and(eq(schema.storyboards.episodeId, episode.id), isNull(schema.storyboards.deletedAt)))
    .orderBy(schema.storyboards.storyboardNumber).all()
  const items = []
  for (const shot of shots) {
    const url = shot.videoUrl || shot.composedVideoUrl || ''
    const review = readReview(shot.id, url)
    let duration = 0, error = ''
    if (url) {
      try { duration = (await probeMedia(mediaPath(url))).duration } catch (e: any) { error = e.message }
    }
    items.push({ id: shot.id, number: shot.storyboardNumber, title: shot.title, description: shot.description,
      videoUrl: url ? '/' + url.replace(/^\//, '') : '', imageUrl: shot.firstFrameImage || shot.composedImage,
      duration, error, review: { ...review, outPoint: review.outPoint || duration } })
  }
  return success(c, { episode, shots: items })
})

app.put('/shots/:id', async c => {
  const shot = db.select().from(schema.storyboards).where(and(eq(schema.storyboards.id, Number(c.req.param('id'))), isNull(schema.storyboards.deletedAt))).get()
  if (!shot) return notFound(c, '镜头不存在')
  try {
    const url = shot.videoUrl || shot.composedVideoUrl || ''
    if (!url) return badRequest(c, '请先生成或导入视频')
    const version = sourceVersion(url)
    const { duration } = await probeMedia(mediaPath(url))
    const review = validateReview(await c.req.json(), duration, version)
    if (version !== sourceVersion(url)) return badRequest(c, '素材已变化，请刷新后重新审片')
    saveReview(shot.id, review)
    return success(c, review)
  } catch (e: any) { return badRequest(c, e.message) }
})

export default app
