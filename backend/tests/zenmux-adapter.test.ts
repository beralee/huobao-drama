import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { OpenAIImageAdapter } from '../src/services/adapters/openai-image.js'
import { requestLogger } from '../src/middleware/logger.js'
import { resolveProxySettings } from '../src/utils/network.js'

const adapter = new OpenAIImageAdapter()
const config = { provider: 'openai', baseUrl: 'https://zenmux.ai/api/v1', apiKey: 'synthetic-test-secret', model: 'openai/gpt-image-2.6-sunburst' }

test('Windows system proxy is used only when no explicit proxy exists; local requests bypass it', () => {
  const fromWindows = resolveProxySettings({}, '127.0.0.1:7897')
  assert.equal(fromWindows.httpsProxy, 'http://127.0.0.1:7897')
  assert.ok(fromWindows.noProxy.split(',').includes('127.0.0.1'))
  const explicit = resolveProxySettings({ HTTPS_PROXY: 'http://proxy.example:8080', NO_PROXY: 'internal.example' }, 'ignored:7897')
  assert.equal(explicit.httpsProxy, 'http://proxy.example:8080')
  assert.ok(explicit.noProxy.split(',').includes('internal.example'))
  const split = resolveProxySettings({}, 'http=localhost:7890;https=localhost:7891')
  assert.equal(split.httpsProxy, 'http://localhost:7891')
})

test('namespaced image models keep their routing ID and omit DALL-E-only parameters', () => {
  const request = adapter.buildGenerateRequest(config, { id: 1, prompt: 'Synthetic scene', size: '720x1280' })
  assert.equal(request.url, 'https://zenmux.ai/api/v1/images/generations')
  assert.equal(request.body.model, config.model)
  assert.equal(request.body.size, '720x1280')
  assert.equal(request.body.response_format, undefined)
})

test('namespaced reference editing sends image bytes with the same model and size', async () => {
  const request = adapter.buildGenerateRequest(config, { id: 1, prompt: 'Change the envelope to blue', size: '1024x1536', referenceImages: JSON.stringify(['data:image/png;base64,aGVsbG8=']) })
  assert.equal(request.url, 'https://zenmux.ai/api/v1/images/edits')
  assert.equal(request.body.get('model'), config.model)
  assert.equal(request.body.get('size'), '1024x1536')
  assert.equal(await request.body.get('image[]').text(), 'hello')
  assert.equal(request.headers['Content-Type'], undefined)
})

test('API credential create, edit and probe requests do not put credentials in logs', async () => {
  const messages: string[] = []
  const previous = console.log
  console.log = (...args) => messages.push(args.join(' '))
  try {
    const app = new Hono()
    app.use('*', requestLogger)
    app.all('*', c => c.json({ ok: true }))
    for (const [method, route] of [['POST', '/api/v1/ai-configs'], ['PUT', '/api/v1/ai-configs/1'], ['POST', '/api/v1/ai-configs/test']]) {
      const res = await app.request(route, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: config.apiKey }) })
      assert.equal(res.status, 200)
    }
  } finally { console.log = previous }
  assert.ok(messages.length >= 6)
  assert.ok(messages.every(message => !message.includes(config.apiKey)))
})
