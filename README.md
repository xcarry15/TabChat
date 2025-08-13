
### 一、项目概述
- **目标**: 开发一个本地加载的 Chrome 扩展，覆盖新标签页内容为插件自定义页面，上方显示时间，下方为聊天输入条。用户可回车直接搜索，或 Ctrl+Enter 通过 AI 模型回复。
- **范围**:
  - 覆盖 Chrome 新标签页内容（`chrome_url_overrides.newtab`）。
  - 本地未打包加载使用（开发模式）。
- **限制说明（重要）**:
  - Chrome 扩展不能强制修改浏览器“主页/启动页”，可稳定覆盖“新标签页”。若需启动即显示，建议设置浏览器启动打开新标签页。

### 二、用户故事
- 作为用户，我打开新标签页时，顶部看到当前时间，底部有聊天输入条。
- 作为用户，我在输入后按 Enter，用浏览器默认搜索引擎搜索该内容。
- 作为用户，我在输入后按 Ctrl+Enter，用内置 AI 模型得到流式回复。
- 作为用户，我可以配置/粘贴我的 API Key、模型与接口地址，且这些信息被安全保存到本地。
- 作为用户，我能看到网络错误或鉴权失败的清晰提示，并可重试。

### 三、核心功能需求
- **时间显示（顶部）**
  - 实时显示本地时间，格式可配置（默认 24 小时制，HH:mm，带日期可选）。
  - 每分钟自动刷新；跨天正确切换日期。
- **聊天输入条（底部横条）**
  - 文本输入支持常规编辑、中文输入法。
  - 按键行为：
    - Enter：触发搜索（默认搜索引擎）。
    - Ctrl+Enter：触发 AI 回复。
    - Shift+Enter：换行。
    - Esc：清空输入（可配置）。
  - 占位文案与快捷键提示。
- **搜索行为（回车）**
  - 使用默认搜索引擎进行搜索，而非硬编码到特定网站。
  - 建议使用 `chrome.search.query({ text, disposition: 'CURRENT_TAB' })`，需 `search` 权限。
- **AI 回复（Ctrl+Enter）**
  - 调用 `https://api.siliconflow.cn/v1` Chat Completions，默认模型 `deepseek-ai/DeepSeek-V2.5`，支持流式输出。
  - 在 UI 中逐字/逐片段渲染模型回复；支持暂停/中止。
  - 输入为空时不触发；请求进行中禁止重复提交或提供取消按钮。

### 四、非功能需求
- **性能**: 新标签页首屏渲染 ≤ 200ms（不含首次字体加载）；AI 首包展示 ≤ 1s（网络允许）。
- **可用性**: 纯键盘可操作，中文提示清晰；深色模式自适应。
- **可访问性**: ARIA 标签、对比度符合 WCAG AA。
- **稳定性**: 网络错误与 429/401 等状态均有可识别提示与重试。
- **隐私安全**: 不上传用户输入和 Key；不采集遥测；Key 仅存储本地 `chrome.storage.local`；不硬编码密钥。

### 五、交互与 UI 说明
- **布局**
  - 顶部：大号时间（含可选日期与星期），居中对齐。
  - 底部：横向输入条（左侧多行可扩展输入框，中间提示，右侧状态/操作按钮如“AI/搜索”、“取消/停止”）。
- **状态**
  - 空闲、输入中、请求中（loading/流式）、错误（重试按钮）。
- **动效**
  - 输入聚焦高亮；AI 流式逐字显现；错误轻量动画提示。

### 六、AI 集成细则
- **配置项（可在设置面板）**
  - Base URL（默认 `https://api.siliconflow.cn/v1`）
  - API Key（必填，敏感）
  - 模型（默认 `deepseek-ai/DeepSeek-V2.5`）
  - 超时（默认 30s），最大 Tokens，温度等可选
- **请求形态**
  - 方法：POST
  - 路径：`/chat/completions`
  - 采用流式（SSE）渲染；解析增量内容并拼接展示。
- **错误处理**
  - 401：提示“鉴权失败，请检查 API Key”
  - 429：提示“速率限制，稍后重试”
  - 5xx/网络：提示“网络异常，重试”
  - 提供“停止生成/重新生成”按钮
- **安全**
  - Key 仅保存在 `chrome.storage.local`，读取前检查存在性。
  - 不在源码中出现明文 Key；请废弃文档中旧 Key 并在控制台中替换。

### 七、Chrome 扩展实现要点（Manifest V3）
- `manifest.json` 关键点
  - `manifest_version`: 3
  - `name`, `version`, `action`（可选）
  - `chrome_url_overrides.newtab`: 指向 `index.html`
  - `permissions`: `storage`, `search`
  - `host_permissions`: `https://api.siliconflow.cn/*`
  - `icons`: 16/48/128
- CORS/Fetch
  - 需在 `host_permissions` 中声明 SiliconFlow 域；在页面脚本直接 `fetch`。
- 存储
  - 使用 `chrome.storage.local` 保存用户设置；提供导出/清除入口（可选）。

### 八、项目结构建议
- `index.html`: 新标签页 UI
- `styles/`：样式（含浅/深主题）
- `scripts/`
  - `time.js`: 时间模块
  - `chat.js`: 输入行为与快捷键处理
  - `ai.js`: AI 请求与流式解析
  - `settings.js`: 设置面板与本地存储
- `manifest.json`: 扩展清单
- `assets/`: 图标与字体
- `README.md`: 本地加载与使用说明

### 九、键盘与事件规范
- Enter：默认搜索
- Ctrl+Enter：AI 回复
- Shift+Enter：换行
- Esc：清空或失焦（可配置）
- 处理中文输入法：在 `compositionend` 之后再判断回车提交，避免误触发。

### 十、测试与验收
- 功能用例
  - 新标签页时间显示正确，分钟跳变正确
  - 输入后 Enter 触发默认搜索（验证 `chrome.search.query`）
  - 输入后 Ctrl+Enter 触发 AI 且流式渲染
  - Key 缺失时提示配置；错误码处理覆盖 401/429/5xx
  - Shift+Enter 可换行；IME 下不误触发
- 兼容性
  - Chrome 最新稳定版（Windows/macOS），深浅色模式
- 验收标准
  - 不硬编码密钥；本地存储生效
  - Manifest 权限最小化，`host_permissions` 正确
  - UI 不卡顿，交互一致，错误可恢复

### 十一、开发里程碑（建议）
- M1：骨架页与时间模块（0.5 天）
- M2：输入条与快捷键（0.5 天）
- M3：默认搜索集成（0.5 天）
- M4：AI 接入与流式渲染（1 天）
- M5：设置面板与本地存储（0.5 天）
- M6：打磨与测试（0.5 天）

### 十二、部署与本地加载
- 打开 Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展 → 选择项目根目录。
- 新开一个标签页验证效果。

### 十三、风险与应对
- 搜索引擎调用：使用 `chrome.search` 而非硬编码 URL。
- CORS/流式：确保 `host_permissions` 包含 `https://api.siliconflow.cn/*`，并实现 SSE 解析。
- 明文 Key：从文档与代码中彻底移除；首次使用引导配置并本地保存；建议轮换旧密钥。

### 附：最小清单与调用示例（参考）
```json
{
  "manifest_version": 3,
  "name": "New Tab Chat",
  "version": "0.1.0",
  "chrome_url_overrides": { "newtab": "index.html" },
  "permissions": ["storage", "search"],
  "host_permissions": ["https://api.siliconflow.cn/*"]
}
```

```javascript
// 触发默认搜索
chrome.search.query({ text: userInput, disposition: 'CURRENT_TAB' });

// AI 流式（简化示意）
const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: modelName,
    stream: true,
    messages: [{ role: 'user', content: userInput }]
  })
});
const reader = resp.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // 解析 SSE data: 行，增量渲染到 UI
}
```