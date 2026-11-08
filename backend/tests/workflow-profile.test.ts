import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-workflow-'))
process.env.SQLITE_PATH = path.join(temp, 'test.sqlite3')
process.env.STORAGE_PATH = path.join(temp, 'static')
const { db, schema } = await import('../src/db/index.js')
const { getWorkflowProfile, setWorkflowProfile } = await import('../src/services/workflow-profile.js')
const { buildAgentRequestContext, getWorkflowProfileFromRC } = await import('../src/agents/context.js')
const { getAgentSkillPaths, getSkillWorkspace, loadAgentSkills } = await import('../src/agents/skills.js')
const { buildInstructions, agentRegistry } = await import('../src/agents/index.js')
const { scriptTools } = await import('../src/agents/tools/script-tools.js')
const { storyboardTools } = await import('../src/agents/tools/storyboard-tools.js')
const { default: settings } = await import('../src/routes/settings.js')
const { default: agentRoutes } = await import('../src/routes/agent.js')

test('HTTP profile selection persists; invalid input is rejected; in-flight context stays stable', async () => {
  assert.equal(getWorkflowProfile(), 'drama-enhanced')
  const running = buildAgentRequestContext({ episodeId: 1, dramaId: 1 })
  const change = await settings.request('/workflow-profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: 'builtin' }) })
  assert.equal(change.status, 200)
  assert.equal(getWorkflowProfile(), 'builtin')
  assert.equal(getWorkflowProfileFromRC(running), 'drama-enhanced')
  assert.equal(getWorkflowProfileFromRC(buildAgentRequestContext({ episodeId: 1, dramaId: 1 })), 'builtin')
  const bad = await settings.request('/workflow-profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: '../unknown' }) })
  assert.equal(bad.status, 400)
  assert.equal(getWorkflowProfile(), 'builtin')
  setWorkflowProfile('drama-enhanced')
})

test('all four registered agents and diagnostics use the selected instructions AND native skill workspace', async () => {
  for (const type of Object.keys(agentRegistry)) {
    for (const profile of ['drama-enhanced', 'builtin'] as const) {
      const rc = buildAgentRequestContext({ episodeId: 1, dramaId: 1, workflowProfile: profile })
      const actual = await agentRegistry[type].getInstructions({ requestContext: rc })
      assert.equal(actual, await buildInstructions(type)({ requestContext: rc }))
      const workspace = await agentRegistry[type].getWorkspace({ requestContext: rc })
      assert.equal(workspace, getSkillWorkspace(type, profile))
      const paths = getAgentSkillPaths(type, profile)
      assert.ok(paths.length > 0)
      assert.ok(paths.every(p => p.startsWith('drama-enhanced/') === (profile === 'drama-enhanced')))
      const skills = await loadAgentSkills(type, 'zh', profile)
      assert.ok(skills.length > 100)
      const diagnostic = await agentRoutes.request(`/${type}/debug?profile=${profile}`)
      assert.equal(diagnostic.status, 200)
      const { data } = await diagnostic.json()
      assert.equal(data.instructions, actual)
      assert.deepEqual(data.skill_paths, paths)
    }
  }
})

test('current script, fractional shot timing, final state and frozen frame survive the tool pipeline', async () => {
  const timestamp = new Date().toISOString()
  db.insert(schema.dramas).values({ id: 1, title: '合成测试', style: 'realistic', createdAt: timestamp, updatedAt: timestamp }).run()
  db.insert(schema.episodes).values({ id: 1, dramaId: 1, episodeNumber: 1, title: '交接', content: '原始旧稿', scriptContent: '## S1 | 内景 · 门厅 | 日\n甲把信封放到桌上。', createdAt: timestamp, updatedAt: timestamp }).run()
  const requestContext = buildAgentRequestContext({ episodeId: 1, dramaId: 1 })
  const read = await scriptTools.readEpisodeScript.execute!({}, { requestContext } as any) as any
  assert.equal(read.content, '## S1 | 内景 · 门厅 | 日\n甲把信封放到桌上。')
  assert.equal(read.original_content, '原始旧稿')
  const shot = { shot_number: 1, duration: 2.5, description: '起点：信封在手中；唯一动作：把信封放到桌面。', result: '手离开，信封平放在桌面', image_prompt: '手持信封，桌面为空', angle: '平视', movement: '固定观察落点', character_ids: [], prop_ids: [] }
  await storyboardTools.saveStoryboards.execute!({ replace_existing: true, storyboards: [shot] }, { requestContext } as any)
  const context = await storyboardTools.readStoryboardContext.execute!({}, { requestContext } as any) as any
  const saved = context.existing_storyboards[0]
  assert.equal(saved.duration, 2.5)
  assert.equal(saved.result, shot.result)
  assert.equal(saved.image_prompt, shot.image_prompt)
  assert.equal(saved.movement, shot.movement)
  assert.ok(context.project_style)
  await storyboardTools.updateStoryboard.execute!({ storyboard_id: saved.id, video_prompt: '手放下信封后离开，信封保持平放。' }, { requestContext } as any)
  const reread = await storyboardTools.readStoryboardContext.execute!({}, { requestContext } as any) as any
  assert.equal(reread.existing_storyboards[0].result, shot.result)
  assert.equal(reread.existing_storyboards[0].duration, 2.5)
  assert.equal(reread.existing_storyboards[0].video_prompt, '手放下信封后离开，信封保持平放。')
})

test('vendored references match the pinned source manifest', () => {
  const root = fileURLToPath(new URL('../workspace/drama-skills/', import.meta.url))
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  assert.equal(manifest.revision, '3d813c30871b4db5f2387d83bdc3a49db8ce7b2b')
  for (const [file, expected] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), expected, file)
  }
})
