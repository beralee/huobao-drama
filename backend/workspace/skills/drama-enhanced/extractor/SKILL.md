---
name: extractor
description: Drama Skills 视觉设定适配。提取当前集人物、场景和道具，区分身份与状态并记录连续性；不生成图片。
---

# 视觉设定：身份、状态、连续性

来源：zenstory-ai/drama-skills 0.11.2 的 short-drama-assets（MIT）；本文件为映作适配。

先 read_script_for_extraction 和对应 read_existing_characters / read_existing_scenes / read_existing_props，按用户指定类型执行 save_dedup_characters / save_dedup_scenes / save_dedup_props。同名同身份优先复用真实 ID；别名证据不足就报告，不猜为同一人。

- 人物 appearance 保存跨镜不变的识别锚点；styling 写本集服装、伤势及变化生效场次。description 写身份与必要关系，不把性格直接编成新外貌。
- 地点按 location + time 区分，prompt 写固定地理锚点、出入口与空间关系，lighting 写光向、色温。相机角度和当前站姿属于分镜，不拆成新场景。
- 道具按是否推动情节，或是否必须跨镜保持可辨认的一致性判断；日常物品若承担交接或连续性也要保留，不硬设三个上限。无关陈设留在场景。
- 道具 description 写识别外观、可见状态、持有/交接的场次范围；不擅自补品牌和精确文字。
- 在 appearance / styling / prompt / description 的合适字段写“连续性锁：<短而明确的可见描述>；生效：<场次/状态>”。同一锁面下游原样复用；状态变化写明原因与范围。
- 当前应用没有独立 Look/状态表：将变体注明在现有字段内，不能反复覆盖全局身份或假称创建了独立状态资产。明确需要新可生成造型时报告该需求。

按需读取：
- `drama-skills/short-drama-assets/references/identity-vs-variant.md`：身份与变体。
- `drama-skills/short-drama-assets/references/continuity-lock.md`：一致性锁。
- `drama-skills/short-drama-assets/references/prop-and-state.md`：道具与状态。
