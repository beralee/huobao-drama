---
name: storyboard-breaker
description: Drama Skills 导演分镜适配。根据当前剧本和视觉资产拆镜，确定职责、起止状态、声音预算和冻结首帧，并保存到现有分镜表。
---

# 分镜：职责、动作、可剪的终点

来源：zenstory-ai/drama-skills 0.11.2 的 short-drama-storyboard / short-drama-video-prompts（MIT）；本文件为映作适配。

先 read_storyboard_context，读当前剧本、项目画风、资产、已有分镜和实际图片字段。
默认一个分镜记录承载一个连续镜头；用户明确要求多镜容器且目标模型已确认支持时才在同一记录中切镜。

每镜填写工具已有字段：
- shot_number / title：清晰稳定的镜序和职责简称。
- description：写“职责；来源场次；起点；主要动作；声音/对白及估时依据；连续性/缺图项”。保留逐字台词，明确说话人，不把声音移给画面中的另一人。
- result：动作完成后的可见终点。交接要交代接触者、用手、落点，下一镜从可信状态开始。
- shot_type / angle / movement：按本镜信息、权力或情绪变化选景别/机位/运镜，静止也要有理由。
- scene_id / character_ids / prop_ids：绑定本项目真实资产 ID，只绑定本镜所需项。
- atmosphere：沿用同场光向、色温、画风；区分资产事实与本镜情绪。
- image_prompt：冻结起点，仅写此时看见的状态；不把结局姿势、交接后的物件或尚未出现的人塞进首帧。兑现本镜生效的连续性锁。
- video_prompt：起点 → 单一主变化 → 次级反应 → 运镜与声音 → 终点；用真实 @角色名/@场景名/@道具名，台词原文只出现一次。只在动作确需时标时间，不固定三秒切段。不生成画外字幕或对白文字叠加；剧本要求的画内文字另写清楚。
- duration：按完整发声、不能同时发生的动作、停顿和反应估算；实际音频优先，估算写明语速前提。未确认供应商能力时不猜模型限制，不按全剧字数或统一镜长反推数量。叙事镜长与供应商最短生成片长不同，必要时生成后用审片入出点选取。

在同场首镜 description 写场景站位：固定锚点、各人相对位置、轴线和摄影机工作侧；后续逐镜保持视线、屏幕方向、持物和出入口。换侧要有可理解的过渡。
删掉不带来新信息/情绪/空间变化的同义镜头；简化超载动作，不用“全程不动、只有嘴动”代替表演设计。
图片 URL 仅表示有媒体记录；若未查看实际图像不能宣称内容核对通过。缺首帧或参考图写入 description 的缺图项，提示词仍可完成；不伪造参考图，不擅自切成文生视频。

整集重拆：save_storyboards 每批最多 8 条，仅首批 replace_existing:true；后续批次接续。局部调整用 update_storyboard，保持未受影响 ID，不改用户已确认的台词和剧情边界。
保存后核对剧本覆盖、总时长、动作衔接和缺图项；报告自检结果，不自动批准审片。

按需读取：
- `drama-skills/short-drama-storyboard/references/shot-craft.md`：对白覆盖、镜长和切点。
- `drama-skills/short-drama-storyboard/references/blocking-playbooks.md`：多人站位、轴线。
- `drama-skills/short-drama-storyboard/references/keyframe-craft.md`：冻结首帧。
- `drama-skills/short-drama-video-prompts/references/generability.md`：复杂动作与生成风险。
