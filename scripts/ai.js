/*
v0.3.4 | 2025-08-17
- 版本头同步：与历史面板功能发布一致；与历史面板共享 chatHistoryPairs；无功能改动
*/
// 支持外部停止：按 ESC 或点击“停止”
let __aiActiveController = null;
let __aiUserAborted = false;

function aiCancelActive() {
  __aiUserAborted = true;
  try { __aiActiveController?.abort(); } catch (_) {}
}

// 对话记忆：使用 chrome.storage.local 存储，以轮为单位 [{ user, assistant }]
async function __getChatHistoryPairs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatHistoryPairs'], (res) => {
      const list = Array.isArray(res.chatHistoryPairs) ? res.chatHistoryPairs : [];
      resolve(list);
    });
  });
}

async function __saveChatHistoryPairs(pairs) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ chatHistoryPairs: pairs }, () => resolve());
  });
}

async function aiClearHistory() {
  return __saveChatHistoryPairs([]);
}

async function aiChat(userText, onDelta, onError, onFinish) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    onError?.('未配置 API Key，请在设置中填写');
    onFinish?.();
    return;
  }

  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const baseBody = {
    model: settings.model,
    stream: true,
    messages: [],
    temperature: settings.temperature,
    top_p: settings.topP,
    max_tokens: settings.maxTokens
  };

  // 组装对话记忆
  if (settings.systemPrompt) {
    baseBody.messages.push({ role: 'system', content: settings.systemPrompt });
  }
  if (settings.memoryEnabled) {
    try {
      const pairs = await __getChatHistoryPairs();
      const turns = Math.max(0, settings.memoryMaxTurns);
      const recent = turns > 0 ? pairs.slice(-turns) : [];
      for (const p of recent) {
        if (p && typeof p.user === 'string') baseBody.messages.push({ role: 'user', content: p.user });
        if (p && typeof p.assistant === 'string') baseBody.messages.push({ role: 'assistant', content: p.assistant });
      }
    } catch (_) {}
  }
  // 当前用户消息始终追加
  baseBody.messages.push({ role: 'user', content: userText });

  let attempt = 0;
  const maxAttempts = Math.max(0, settings.retries) + 1;
  let finished = false;
  let lastError = null;

  while (attempt < maxAttempts && !finished) {
    if (attempt > 0) {
      const delaySeconds = settings.retryInitialDelaySeconds * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delaySeconds * 1000));
    }

    const controller = new AbortController();
    __aiActiveController = controller;
    __aiUserAborted = false;
    const timeoutId = setTimeout(() => controller.abort(), settings.timeoutSeconds * 1000);

    let receivedAny = false;
    let assistantFullText = '';

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(baseBody),
        signal: controller.signal
      });

      if (!resp.ok) {
        let errMsg = `网络异常（${resp.status}）`;
        try {
          const text = await resp.text();
          const json = JSON.parse(text);
          errMsg = json?.error?.message || json?.message || errMsg;
        } catch (_) {}
        if (resp.status === 401) errMsg = '鉴权失败，请检查 API Key';
        if (resp.status === 429) errMsg = '速率限制，稍后重试';
        // 对 429/5xx 进行重试
        if ((resp.status === 429 || resp.status >= 500) && attempt < maxAttempts - 1) {
          attempt++;
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        receivedAny = true;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
            if (delta) {
              assistantFullText += delta;
              onDelta?.(delta);
            }
          } catch (_) {
            // 忽略解析错误
          }
        }
      }
      finished = true;
      // 成功结束且启用记忆时保存一轮对话
      if (settings.memoryEnabled && assistantFullText) {
        try {
          const pairs = await __getChatHistoryPairs();
          pairs.push({ user: userText, assistant: assistantFullText });
          const turns = Math.max(0, settings.memoryMaxTurns);
          const trimmed = turns > 0 ? pairs.slice(-turns) : [];
          await __saveChatHistoryPairs(trimmed);
        } catch (_) {}
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (__aiUserAborted) {
          onError?.('已取消');
          finished = true;
          lastError = null;
        } else {
          // 超时等导致的中断：若尚未接收内容且可重试
          if (!receivedAny && attempt < maxAttempts - 1) {
            attempt++;
            lastError = err;
            continue;
          }
          onError?.('请求超时或被中断');
          finished = true;
        }
      } else {
        const msg = err?.message || '请求失败';
        // 网络错误重试（仅在未收到任何数据时）
        if (!receivedAny && attempt < maxAttempts - 1) {
          attempt++;
          lastError = err;
          continue;
        }
        onError?.(msg);
        finished = true;
      }
    } finally {
      clearTimeout(timeoutId);
      if (__aiActiveController === controller) {
        __aiActiveController = null;
      }
    }
  }

  try {
    // noop - 所有错误已在上面回调
  } finally {
    onFinish?.();
  }
}
