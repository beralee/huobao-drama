import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from '../utils/response.js'

export const WORKFLOW_PROFILES = ['drama-enhanced', 'builtin'] as const
export type WorkflowProfile = typeof WORKFLOW_PROFILES[number]
export const DRAMA_SKILLS_SOURCE = {
  repository: 'https://github.com/zenstory-ai/drama-skills',
  revision: '3d813c30871b4db5f2387d83bdc3a49db8ce7b2b',
  version: '0.11.2',
  license: 'MIT',
}
export function isWorkflowProfile(value: unknown): value is WorkflowProfile {
  return WORKFLOW_PROFILES.includes(value as WorkflowProfile)
}
export function getWorkflowProfile(): WorkflowProfile {
  const row = db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'workflow_profile')).get()
  return isWorkflowProfile(row?.value) ? row.value : 'drama-enhanced'
}
export function setWorkflowProfile(profile: WorkflowProfile): WorkflowProfile {
  if (!isWorkflowProfile(profile)) throw new Error('未知创作方案')
  db.insert(schema.appSettings).values({ key: 'workflow_profile', value: profile, updatedAt: now() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: profile, updatedAt: now() } }).run()
  return profile
}
