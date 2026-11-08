<template>
  <div class="review-page">
    <header class="review-head">
      <div><NuxtLink v-if="data" :to="`/drama/${data.episode.dramaId}/episode/${data.episode.episodeNumber}`">← 返回制作</NuxtLink>
        <h1>逐镜审片 <small>{{ data?.episode.title }}</small></h1>
        <p>检查人物、表演、口型和画面，再选择实际进入成片的片段。</p></div>
      <div class="head-actions"><span>{{ approved.length }} / {{ data?.shots.length || 0 }} 镜通过</span>
        <button class="btn" :disabled="loading || saving" @click="load">刷新素材</button>
        <button class="btn btn-primary" :disabled="!approved.length || exporting || dirty" @click="exportApproved">{{ exporting ? '正在导出…' : '导出已通过镜头' }}</button></div>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="exportResult" class="export-result">{{ exportResult }} <a v-if="exportUrl" :href="exportUrl" target="_blank">播放成片</a></p>
    <div v-if="data?.shots.length" class="review-body">
      <aside class="shot-list">
        <button v-for="shot in data.shots" :key="shot.id" :class="['shot-item', { active: current?.id === shot.id }]" @click="select(shot)">
          <b>{{ String(shot.number).padStart(2, '0') }} · {{ shot.title || '未命名镜头' }}</b>
          <span :class="shot.review.status">{{ labels[shot.review.status] }} · {{ shot.duration.toFixed(2) }} 秒</span>
        </button>
      </aside>
      <main v-if="current" class="viewer">
        <video v-if="current.videoUrl && !current.error" ref="player" :key="current.videoUrl" :src="current.videoUrl" controls preload="metadata" @timeupdate="onTime" />
        <div v-else class="no-video">{{ current.error || '此镜头还没有视频' }}</div>
        <p>{{ current.description }}</p>
      </main>
      <aside v-if="current" class="review-form">
        <h2>剪辑与审片</h2><p class="dim">源素材 {{ current.duration.toFixed(2) }} 秒；保留 {{ Math.max(0, draft.outPoint - draft.inPoint).toFixed(2) }} 秒</p>
        <label>入点（秒）<input v-model.number="draft.inPoint" type="number" min="0" :max="current.duration" step="0.04" class="input" /></label>
        <button class="btn btn-sm" @click="draft.inPoint = time">用当前播放位置</button>
        <label>出点（秒）<input v-model.number="draft.outPoint" type="number" min="0" :max="current.duration" step="0.04" class="input" /></label>
        <button class="btn btn-sm" @click="draft.outPoint = time">用当前播放位置</button>
        <button class="btn" :disabled="!current.duration" @click="preview">预览选中片段</button>
        <label>结论<select v-model="draft.status" class="input"><option value="pending">待审</option><option value="approved">通过</option><option value="rejected">退回重做</option></select></label>
        <label>备注／退回原因<textarea v-model="draft.notes" rows="5" maxlength="4000" class="input" placeholder="例如：说话人错误、脸变形、字幕污染、表情与台词不符…" /></label>
        <button class="btn btn-primary" :disabled="saving || !current.duration" @click="save">{{ saving ? '保存中…' : '保存审片结果' }}</button>
        <span v-if="dirty" class="dim">有未保存的修改</span>
        <p class="dim">换掉视频后会自动回到待审。导出按镜号排列，使用保存的入出点和源片声音。</p>
      </aside>
    </div>
    <p v-else-if="!loading" class="empty">还没有分镜，请先返回制作页创建。</p>
  </div>
</template>

<script setup>
import { api } from '~/composables/useApi'
const route = useRoute()
const data = ref(null), current = ref(null), player = ref(null), loading = ref(false), saving = ref(false)
const error = ref(''), time = ref(0), exporting = ref(false), exportResult = ref(''), exportUrl = ref('')
const draft = reactive({ status: 'pending', notes: '', inPoint: 0, outPoint: 0, sourceVersion: '' })
const labels = { pending: '待审', approved: '通过', rejected: '退回' }
const approved = computed(() => (data.value?.shots || []).filter(s => s.review.status === 'approved'))
const dirty = computed(() => current.value && JSON.stringify(draft) !== JSON.stringify(current.value.review))
let previewing = false, pollTimer
function select(shot) {
  if (dirty.value && !window.confirm('当前镜头有未保存修改，放弃后切换？')) return
  current.value = shot
  Object.assign(draft, shot.review)
  previewing = false
  time.value = 0
}
async function load() {
  if (dirty.value && !window.confirm('刷新会放弃未保存的修改，继续？')) return
  loading.value = true; error.value = ''
  try {
    const result = await api.get(`/review/episodes/${Number(route.query.episode)}`)
    const selected = result.shots.find(s => s.id === current.value?.id) || result.shots[0]
    current.value = null; data.value = result
    if (selected) select(selected)
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
function onTime() {
  time.value = Math.round((player.value?.currentTime || 0) * 1000) / 1000
  if (previewing && time.value >= draft.outPoint) { player.value.pause(); previewing = false }
}
async function preview() {
  if (!player.value || draft.outPoint <= draft.inPoint) return
  player.value.currentTime = draft.inPoint; previewing = true
  try { await player.value.play() } catch (e) { error.value = e.message }
}
async function save() {
  saving.value = true; error.value = ''
  try {
    const review = await api.put(`/review/shots/${current.value.id}`, { ...draft })
    current.value.review = review; Object.assign(draft, review)
  } catch (e) { error.value = e.message } finally { saving.value = false }
}
async function exportApproved() {
  exporting.value = true; error.value = ''; exportUrl.value = ''; exportResult.value = '开始导出已通过的镜头…'
  try {
    const result = await api.post(`/merge/episodes/${data.value.episode.id}/merge`, { storyboard_ids: approved.value.map(s => s.id) })
    const poll = async () => {
      try {
        const merges = await api.get(`/merge/episodes/${data.value.episode.id}/merges`)
        const job = merges.find(m => m.id === result.merge_id)
        if (job?.status === 'failed') throw new Error(job.error_msg || '导出失败')
        if (job?.status === 'completed') {
          exporting.value = false; exportResult.value = '导出完成。'; exportUrl.value = '/' + job.merged_url.replace(/^\//, ''); return
        }
        pollTimer = setTimeout(poll, 1500)
      } catch (e) { error.value = e.message; exporting.value = false; exportResult.value = '' }
    }
    await poll()
  } catch (e) { error.value = e.message; exporting.value = false; exportResult.value = '' }
}
onMounted(load)
onBeforeUnmount(() => clearTimeout(pollTimer))
onBeforeRouteLeave(() => !dirty.value || window.confirm('有未保存的审片修改，仍然离开？'))
</script>

<style scoped>
.review-page{padding:24px;display:flex;flex-direction:column;min-height:0;flex:1;gap:16px}.review-head{display:flex;justify-content:space-between;gap:20px;align-items:center}.review-head h1{font-size:23px;margin:10px 0}.review-head small{font-size:14px;color:var(--text-2);font-weight:400}.review-head p,.review-form p{color:var(--text-2);font-size:13px;line-height:1.6}.head-actions{display:flex;align-items:center;gap:10px}.review-body{display:grid;grid-template-columns:220px minmax(260px,1fr) 290px;gap:20px;min-height:0;flex:1}.shot-list,.review-form,.viewer{overflow:auto}.shot-list{display:flex;flex-direction:column;gap:8px}.shot-item{padding:14px;text-align:left;border:1px solid var(--border);border-radius:10px;background:var(--bg-surface);color:var(--text-0);cursor:pointer;display:flex;flex-direction:column;gap:9px}.shot-item.active{border-color:var(--accent)}.shot-item span{font-size:12px;color:var(--text-2)}.shot-item .approved{color:#16894d}.shot-item .rejected,.error{color:#c94b4b}.viewer{display:flex;align-items:center;flex-direction:column;gap:12px;background:#111;border-radius:12px;padding:12px;color:#ddd}.viewer video{width:100%;height:calc(100% - 70px);min-height:250px;object-fit:contain}.viewer p{font-size:13px;line-height:1.6}.review-form{display:flex;flex-direction:column;align-items:stretch;gap:12px}.review-form h2{font-size:17px}.review-form label{font-size:13px;display:flex;flex-direction:column;gap:8px}.review-form textarea{resize:vertical}.no-video{margin:auto}.empty{padding:40px}.export-result{padding:10px;background:var(--bg-hover);border-radius:8px}@media(max-width:1000px){.review-body{grid-template-columns:160px 1fr}.review-form{grid-column:1/-1;max-height:450px}.review-head{align-items:flex-start;flex-direction:column}.review-page{overflow:auto}.viewer video{height:420px}}
</style>
