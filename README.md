# 映作短剧

从 [chatfire-AI/huobao-drama](https://github.com/chatfire-AI/huobao-drama) 派生的中文个人短剧工作台。上游基线 `b48e6b2`（v4.0.11）；本分支由本项目维护者修改，版本 0.1.0。

## 已保留与精简

保留项目与分集、剧本改写、角色/场景/道具、参考图、分镜、图片/视频生成、提示词编辑、素材存储及导出。

移除火宝 API 推广与快捷配置、英文/日文/韩文界面、语言切换、上游版本更新、Electron 打包与桌面迁移、Docker/Watchtower 发布入口、遗留 configs。使用本机浏览器，默认只监听 127.0.0.1。云服务适配器仍可自行配置，不默认填入 Key 或发起付费生成。

新增逐镜审片：通过/待审/退回、原因、预览与小数秒入出点。换掉视频会使旧审片失效；后端导出会阻止未经通过的镜头，按审片区间同步裁切画面和原音轨，统一画幅和帧率，保留完整构图，不自动裁脸。无音轨片段补静音；导出任务一次执行一个。

## 启动

需要 Node.js 22。首次在仓库根目录运行：

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix frontend
npm.cmd run build:frontend
npm.cmd start
```

之后可双击 `Start-Studio.cmd`，浏览器打开 http://127.0.0.1:5679。启动窗口按 Ctrl+C 停止服务。

数据库和媒体在本仓库 `data/`，被 Git 忽略；不会复制 API Key 到仓库。

## 导入豪门赘婿

默认从同级 `../short-drama/haomen-zhuixu` 读取剧本与生成清单：

```powershell
npm.cmd run import:haomen
```

导入会复制原始完整画幅图片/视频到新工作台，不修改原文件，重复执行保留已有编辑。它导入原视频自带声音，**不是旧成片的干声、字幕和悬疑混音**；导入后的 12 镜全部待审。首个导入项目可在 http://127.0.0.1:5679/review?episode=1 查看。

当前没有把 ComfyUI/Qwen3-TTS 的生成按钮接入此网页；现有本地生成入口仍在父目录。此版本完成本地素材接入、审片、剪辑导出与界面精简，云生成沿用上游适配器。原作的配音混音链路不自动迁移。

## 验证

```powershell
npm.cmd run check:backend
npm.cmd run test:review
npm.cmd run build:frontend
```

上游的结构快照测试包含已删除功能的固定字符串，不作为本分支功能验收；审片行为另有测试，并应以本地浏览器与真实 FFmpeg 导出验证。

## 来源与许可证

原作：ChatFire / chatfire-AI，火宝短剧。保留原 [LICENSE](LICENSE)，本派生版同样遵循 **CC BY-NC-SA 4.0**，并非无条件商用许可。[原始 README](docs/UPSTREAM_README.md) 仅作为来源记录，其中旧版启动和更新步骤不适用于本分支。
