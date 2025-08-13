### 项目简介
- TabChat 是一个覆盖新标签页的轻量级“搜索 + AI 对话”扩展。顶部显示时间，底部为输入栏：按 Enter 用默认搜索引擎；按 Ctrl+Enter 让本地配置的 AI 模型进行流式回复。
- 设计目标：上手快、体验顺滑、配置安全（仅本地存储）。

### 功能
- 流式 AI 回复与最终 Markdown 渲染（流式阶段合并更新，完成后一次性高质量渲染）。
- 本地设置面板：Base URL、API Key、模型、超时、温度、TopP、最大输出、重试、对话记忆、系统提示词。
- 对话记忆：以“轮”为单位存储在 `chrome.storage.local`，可重置。
- 键盘友好：Enter 搜索、Ctrl+Enter AI、Shift+Enter 换行、Esc 取消/清空。
- 体验优化：AI 进行中临时关闭重模糊滤镜，滚动贴底渲染，深色风格与 ARIA 提示。

### 快速开始
1) 打开 Chrome → 扩展程序 → 开启“开发者模式”。
2) 选择“加载已解压的扩展程序”，指向项目根目录。
3) 新开一个标签页即可看到 TabChat。
4) 右上角“设置”按钮配置 API Key（必填）、Base URL/模型等，保存后即可使用。

### 键盘与交互
- Enter：使用默认搜索引擎搜索（`chrome.search.query`）。
- Ctrl+Enter：开始 AI 对话，支持流式；面板内可点“停止”、“重置对话”。
- Shift+Enter：输入框内换行。
- Esc：取消进行中的请求并清空输入。
- 已考虑中文输入法：在 `compositionend` 后再判断回车，避免误触发。

### 设置项（默认值）
- Base URL：`https://api.siliconflow.cn/v1`
- 模型：`deepseek-ai/DeepSeek-V2.5`
- 超时：30s；温度：0.7；TopP：1；最大输出：2048
- 重试：2 次（指数退避，初始间隔 1s）
- 对话记忆：启用；记忆轮数：8；系统提示词：空
- 所有配置与对话记忆均存储于 `chrome.storage.local`

### 权限与实现
- Manifest V3：`chrome_url_overrides.newtab` 指向 `index.html`
- 权限：`storage`, `search`
- Host 权限：`https://api.siliconflow.cn/*`, `https://*.siliconflow.cn/*`
- 前端直连 SiliconFlow Chat Completions（SSE），根据 `choices[].delta.content`/`message.content` 增量渲染。

### 已知限制
- 无法更改浏览器“主页/启动页”，仅能覆盖“新标签页”。如需启动即显示，可设置 Chrome 启动打开新标签页。

### 项目结构
- `index.html`：页面结构与设置模板
- `styles/main.css`：深色主题与组件样式
- `scripts/time.js`：时间/日期按分钟刷新
- `scripts/chat.js`：输入/快捷键、搜索与 AI 交互、流式合并渲染与 Markdown 最终渲染
- `scripts/ai.js`：SSE 调用、超时与取消、重试与对话记忆
- `scripts/settings.js`：设置 UI 与本地存储
- `scripts/markdown.js`：轻量 Markdown 渲染（安全）
- `scripts/background.js`：画布背景动效
- `manifest.json`：扩展清单
- `icons/`：图标（16/32/48/128/256）

### 打包（可选）
- 可参考 `打包.txt` 使用 PowerShell 打包：
  - 更新版本号变量后，将 `index.html, manifest.json, scripts, styles` 压缩为 zip 以供发布。

### 隐私与安全
- API Key 等配置仅保存在本地（`chrome.storage.local`），不上传、不采集遥测。
- 代码中不包含明文密钥；请把 Key 填入设置面板。

### 兼容性
- Chrome 114+（Manifest V3），Windows/macOS 均可。

### 变更日志
- 见 `CHANGELOG.md`。