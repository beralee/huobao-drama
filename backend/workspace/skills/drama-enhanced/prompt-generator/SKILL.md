---
name: prompt-generator
description: Drama Skills 图片与视频提示词适配。保留视觉一致性、冻结首帧和镜头动作边界，保存纯净提示词；不改剧情、不生成媒体。
---

# 提示词：视觉事实和状态变化

来源：zenstory-ai/drama-skills 0.11.2 的 short-drama-image-prompts / short-drama-video-prompts（MIT）；本文件为映作适配。

图片任务：按类型 read_characters / read_scenes / read_props，再调用对应 save_character_final_prompt / save_scene_final_prompt / save_prop_final_prompt。
- 人物板保持身份锚点和本集单一造型；现有入口要求三视图时写正面/侧面/背面同一身份，不在一板混合互斥状态。
- 场景板给出固定空间关系、出入口、光向色温，遵守无人物空景要求。
- 道具板清晰显示尺度、材质和本次状态；现有入口要求白底单品时沿用。
- 三类资产保存工具会自动注入项目画风，正文不要重复或混入不兼容画风。连续性锁原样保留。

视频任务：先 read_storyboard_context，读取目标镜 description、result、image_prompt、duration、运镜与资产绑定，只通过 update_storyboard 更新点名的 video_prompt。不得重新拆集或回传其他字段。
- 按冻结起点 → 触发 → 唯一主动作（方向、接触、落点）→ 次级反应 → 运镜 → 声音 → 终点组织。既有多镜描述保留已定切点，不自行加镜。
- duration 与分镜一致；台词按原文说完整，只出现一次，明确说话人、顺序和语气。预算不够报告回分镜修订，不能偷偷改秒数或删台词。
- 需要时间标记时按实际事件划分，不固定三秒等分。保留合理身体动作和反应，不把所有人物冻结成只动嘴。
- 使用应用识别的 @资产名；#角色名 仅用于已有音色的实际说话人。应用负责素材绑定，不把上游 REF/PLAN 或虚构路径塞进可复制正文。
- 原始参考缺失在完成报告指出，不能声称已经挂图。静态外观只有被真实可用参考覆盖时才精简；跨镜连续性锁仍保留。
- 全镜不生成非画内字幕、caption 或对白文字叠加；剧本指定的画内文字写清字符、语言、载体和位置，不能与全局禁字互相冲突。
- 已确认模型与能力才读取对应方言。外部续接、多图/音频模式未经当前适配器支持不能假称可提交。未知模型走通用描述。

按需读取工作目录中的参考资料：
- `drama-skills/short-drama-image-prompts/references/common-recipe.md`：板式、引用范围与文字政策。
- `drama-skills/short-drama-video-prompts/references/motion-recipe.md`：动作正文。
- `drama-skills/short-drama-video-prompts/references/performance-action-timing.md`：多人表演、对白估时。
- `drama-skills/short-drama-video-prompts/references/camera-audio-continuity.md`：视听连续性。
- `drama-skills/short-drama-video-prompts/references/target-model-profile.md`：通用能力档案。
- 同目录 `seedance-2.0.md`、`seedance-2.5.md`、`minimax-h3.md`、`wan-3.0.md`：仅按已确认目标选择一份；上游文档不是本应用适配器能力证明。

保存成功才报告完成；自检不代表实际画面合格。
