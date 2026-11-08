import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-review-'))
process.env.SQLITE_PATH = path.join(temp, 'test.sqlite3')
process.env.STORAGE_PATH = path.join(temp, 'static')
const { validateReview, sourceVersion, readReview, saveReview, mediaPath } = await import('../src/services/shot-review.js')
const valid = { status: 'approved', notes: '表演通过', inPoint: 0.5, outPoint: 2.25, sourceVersion: 'v1' }

test('fractional editorial range is preserved', () => {
  assert.equal(validateReview(valid, 5, 'v1').outPoint, 2.25)
})
test('reject stale approval, invalid intervals, empty rejection reason', () => {
  assert.throws(() => validateReview(valid, 5, 'v2'), /素材已变化/)
  for (const range of [{ inPoint: -1 }, { outPoint: 6 }, { outPoint: 0.5 }, { inPoint: NaN }, { inPoint: '0' }])
    assert.throws(() => validateReview({ ...valid, ...range }, 5, 'v1'), /入点/)
  assert.throws(() => validateReview({ ...valid, status: 'rejected', notes: '' }, 5, 'v1'), /退回原因/)
})
test('replacing media invalidates saved acceptance', () => {
  fs.mkdirSync(process.env.STORAGE_PATH!, { recursive: true })
  const file = mediaPath('static/take.mp4')
  fs.writeFileSync(file, 'first take')
  const version = sourceVersion('static/take.mp4')
  saveReview(1, { ...valid, status: 'approved', sourceVersion: version })
  assert.equal(readReview(1, 'static/take.mp4').status, 'approved')
  fs.writeFileSync(file, 'a different second take')
  assert.equal(readReview(1, 'static/take.mp4').status, 'pending')
})
test('media paths cannot escape project storage', () => {
  assert.throws(() => mediaPath('../secret.mp4'), /本项目素材/)
})
