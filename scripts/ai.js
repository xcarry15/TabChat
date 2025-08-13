// 移除外部停止逻辑，内部仍支持超时自动中断

async function aiChat(userText, onDelta, onError, onFinish) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    onError?.('未配置 API Key，请在设置中填写');
    onFinish?.();
    return;
  }

  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: settings.model,
    stream: true,
    messages: [{ role: 'user', content: userText }]
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), settings.timeoutSeconds * 1000);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!resp.ok) {
      if (resp.status === 401) throw new Error('鉴权失败，请检查 API Key');
      if (resp.status === 429) throw new Error('速率限制，稍后重试');
      throw new Error(`网络异常（${resp.status}）`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 按行解析
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
          if (delta) onDelta?.(delta);
        } catch (_) {
          // 忽略解析错误
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      onError?.('已取消');
    } else {
      onError?.(err.message || '请求失败');
    }
  } finally {
    clearTimeout(timeoutId);
    onFinish?.();
  }
}

