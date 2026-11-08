# ZenMux 文本与图片接入

验证日期：2026-11-08。模型 ID 已通过 ZenMux 当日模型列表确认，以下两种模型均完成真实请求验证。

| 用途 | 默认模型 | 协议与地址 |
|---|---|---|
| 剧本、资产提取、分镜、提示词 Agent | `anthropic/claude-sonnet-5.5` | OpenAI Chat Completions，`https://zenmux.ai/api/v1` |
| 人物/场景/道具图、参考图编辑 | `openai/gpt-image-2.6-sunburst` | OpenAI Images，`https://zenmux.ai/api/v1` |

选择 Sonnet 作为常规文本工作流模型，是基于其工具调用定位和成本；这不是短剧创作模型排行榜结论。图片模型验证包括一张 1024×1536 文生图和一张相同尺寸参考图编辑，确认了接口可用，尚未进行人物跨镜一致性的批量评测。

## 配置与轮换密钥

设置页可以手工添加 OpenAI 兼容配置，填写上表的地址、完整模型 ID 和 ZenMux Key。也可在 backend 目录运行：

```powershell
node --import tsx scripts/configure-zenmux.ts <密钥文件路径>
```

不传路径时读取当前进程的 `ZENMUX_API_KEY`。脚本按服务类型和 ZenMux 地址更新已有记录，设为启用、默认优先级 100，不输出凭据。凭据写入本机被 Git 忽略的数据库；变更系统环境变量不会自动修改已有数据库记录，轮换后需重新运行脚本或更新设置页。

Claude Code 是独立客户端，使用 `ANTHROPIC_BASE_URL=https://zenmux.ai/api/anthropic` 与 `ANTHROPIC_AUTH_TOKEN`。Windows 已运行的终端/IDE/Claude Code 仍持有旧环境快照，需关闭并重新启动；用户级变量可覆盖同名系统级变量。工作台数据库配置与 Claude Code 的模型选择互不覆盖。

## 网络与兼容处理

- Node 22 不自动使用 Windows 系统代理。本应用启动时优先采用 HTTP_PROXY / HTTPS_PROXY / ALL_PROXY；没有显式代理时读取 Windows 当前用户已启用的静态代理。始终绕过 localhost / 127.0.0.1 / ::1，保留 NO_PROXY。没有解析 PAC 脚本；PAC 环境应显式设置代理。
- `STUDIO_SYSTEM_PROXY=off` 可关闭本应用的自动代理设置。没有降低 TLS 校验要求。
- GPT Image 模型可带 `openai/` 命名空间。请求保留完整路由 ID，尺寸和参数判断使用模型名，避免误按 DALL-E 发送 `response_format=url`。
- ZenMux 文本请求保留路由器默认思考策略，不注入通用中转站的强制关闭思考字段。
- 服务配置请求体不进入后端请求日志或前端 console；数据库与真实联调产物不进入 Git。

## 验证

- Claude 兼容 Messages 接口使用现有 `anthropic/claude-opus-5` 映射与新 Key 请求成功。
- 工作台原生 script_rewriter Agent 使用 Sonnet 5.5 读入合成文本、调用工具并保存剧本；测试使用独立临时数据库。
- 工作台图片 Adapter 完成 Sunburst 文生图、multipart 参考图编辑和结果解析；白色信封成功改为蓝色，并人工查看两张结果。
- 重启后的实际工作台完成两项配置的联网探测；Edge 页面显示启用状态，页面和 console 无 Key 明文。
- 后端类型检查、4 项 ZenMux/代理/日志回归、4 项创作方案回归及前端生产构建通过。

接口来源：[Claude Code 接入](https://zenmux.ai/docs/best-practices/claude-code.html)、[Sonnet 5.5](https://zenmux.ai/anthropic/claude-sonnet-5.5)、[OpenAI Images 协议](https://zenmux.ai/docs/guide/advanced/openai-image-generation.html)、[模型列表](https://zenmux.ai/docs/api/openai/openai-list-models.html)。
