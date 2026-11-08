/** Store credentials only in the local ignored database; never print them. */
import fs from 'node:fs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import { now } from '../src/utils/response.js'

const keyFile = process.argv[2]
const key = (keyFile ? fs.readFileSync(keyFile, 'utf8') : process.env.ZENMUX_API_KEY || '').trim()
if (!key || /\s/.test(key)) throw new Error('Provide a key file containing one token, or set ZENMUX_API_KEY')

const definitions = [
  { serviceType: 'text', name: 'ZenMux · Claude Sonnet 5.5', model: ['anthropic/claude-sonnet-5.5'] },
  { serviceType: 'image', name: 'ZenMux · GPT Image 2.6 Sunburst', model: ['openai/gpt-image-2.6-sunburst'] },
]
for (const definition of definitions) {
  const existing = db.select().from(schema.aiServiceConfigs).all().find(row =>
    row.serviceType === definition.serviceType && row.baseUrl.replace(/\/$/, '') === 'https://zenmux.ai/api/v1')
  const values = { ...definition, provider: 'openai', baseUrl: 'https://zenmux.ai/api/v1', apiKey: key,
    model: JSON.stringify(definition.model), priority: 100, isActive: true, isDefault: true, updatedAt: now() }
  if (existing) db.update(schema.aiServiceConfigs).set(values).where(eq(schema.aiServiceConfigs.id, existing.id)).run()
  else db.insert(schema.aiServiceConfigs).values({ ...values, createdAt: now() }).run()
}
console.log(JSON.stringify({ configured: definitions, credentials: 'saved locally; omitted from output' }))
