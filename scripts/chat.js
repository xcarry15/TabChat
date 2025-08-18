/*
v0.3.6 | 2025-08-18
- 变更：切换至不同操作（search/ai/translate/format）时，中断当前请求并清空 AI 对话记忆（aiClearHistory），同步重置 UI，避免上下文混淆

v0.3.5 | 2025-08-18
- 新增：格式 按钮与 doFormat()，将输入内容通过 AI 转为严格 JSON；输出尝试 JSON.parse 并以代码块渲染
- 保持与现有 doAI 相同的流式体验与 UI 行为，最小侵入
- 抽取提示词：将内置 Prompt 提取到 scripts/prompts.js，chat.js 通过 Prompts 调用（含回退）

v0.3.4 | 2025-08-17
- 修复：切换模式（搜索/AI/翻译）时不再清空对话历史，仅重置 UI
- 保留“重置对话”按钮的清空历史行为（显式操作）
*/
let isComposing = false;
let __lastMode = null; // 'search' | 'ai' | 'translate' | 'format'

async function __resetConversation() {
  try { aiCancelActive?.(); } catch (_) {}
  const output = document.getElementById('aiOutput');
  const content = document.getElementById('aiContent');
  if (content) content.innerHTML = '';
  if (output) output.hidden = true;
  showError('');
}

async function doFormat(text) {
  const output = document.getElementById('aiOutput');
  const content = document.getElementById('aiContent');
  const aiControls = document.getElementById('aiControls');
  if (content) content.innerHTML = '';
  output.hidden = false;
  if (aiControls) aiControls.hidden = false;
  updateOutputMaxHeight();
  showError('');
  setBusy(true);
  try { output.setAttribute('aria-busy', 'true'); } catch (_) {}

  let streamContainer = null;
  if (content) {
    streamContainer = document.createElement('div');
    streamContainer.id = 'aiStream';
    content.appendChild(streamContainer);
  }
  const fullChunks = [];
  const pendingChunks = [];
  const FLUSH_INTERVAL_MS = 100;
  let flushTimer = null;

  const isAtBottom = (el, threshold = 8) => {
    if (!el) return false;
    return (el.scrollHeight - el.clientHeight - el.scrollTop) <= threshold;
  };

  const flushStream = () => {
    if (!content || !streamContainer) return;
    if (pendingChunks.length === 0) return;
    const stickToBottom = isAtBottom(output);
    const add = pendingChunks.join('');
    pendingChunks.length = 0;
    const span = document.createElement('span');
    span.className = 'stream-chunk';
    span.textContent = add;
    streamContainer.appendChild(span);
    updateOutputMaxHeight();
    requestAnimationFrame(() => {
      if (stickToBottom) output.scrollTop = output.scrollHeight;
    });
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushStream();
    }, FLUSH_INTERVAL_MS);
  };

  const formatPrompt = (window.Prompts && typeof window.Prompts.buildFormatPrompt === 'function')
    ? window.Prompts.buildFormatPrompt(text)
    : (
      '你是 JSON 格式化助手。请将以下文本转写为详细的结构化 JSON。严格要求：仅输出合法 JSON（UTF-8），不要输出任何解释、前后缀或代码块围栏；不包含注释。' +
      ' 字段命名建议使用小写下划线；能抽取的实体/属性尽量抽取；未知信息保持原样。' +
      ' 如果确实无法结构化，请输出 {"text": "原文"}，其中将原文完整放入 text。\n\n===\n' + text
    );

  await aiChat(formatPrompt, (delta) => {
    pendingChunks.push(delta);
    fullChunks.push(delta);
    scheduleFlush();
  }, (errMsg) => {
    showError(errMsg);
  }, () => {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    const finalText = fullChunks.join('').trim();
    let pretty = finalText;
    try {
      const obj = JSON.parse(finalText);
      pretty = JSON.stringify(obj, null, 2);
    } catch (_) {
      // 保留模型输出
    }
    const stickToBottom = isAtBottom(output);
    const rendered = '```json\n' + pretty + '\n```';
    if (content) content.innerHTML = window.renderMarkdown ? window.renderMarkdown(rendered) : pretty;
    updateOutputMaxHeight();
    requestAnimationFrame(() => {
      if (stickToBottom) output.scrollTop = output.scrollHeight;
    });
    setBusy(false);
    try { output.setAttribute('aria-busy', 'false'); } catch (_) {}
  });
}

async function __ensureModeAndMaybeReset(newMode) {
  if (__lastMode && __lastMode !== newMode) {
    // 1) 立即中断当前请求
    try { aiCancelActive?.(); } catch (_) {}
    // 2) 尝试清空对话记忆（避免模型沿用上一个功能的上下文）
    try { await aiClearHistory?.(); } catch (_) {}
    // 3) 重置 UI
    await __resetConversation();
  }
  __lastMode = newMode;
}

function autoResizeTextArea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.15) + 'px';
}

function __clearAiBusyClass() {
  try {
    document.documentElement.classList.remove('ai-busy');
  } catch (_) {}
  try {
    requestAnimationFrame(() => {
      try { document.documentElement.classList.remove('ai-busy'); } catch (_) {}
      setTimeout(() => {
        try { document.documentElement.classList.remove('ai-busy'); } catch (_) {}
      }, 120);
    });
  } catch (_) {}
}

let __heightRaf = 0;
function updateOutputMaxHeight() {
  try {
    const output = document.getElementById('aiOutput');
    if (!output || output.hidden) return;
    const chat = document.getElementById('chat');
    const bottomGapPx = chat ? parseFloat(getComputedStyle(chat).paddingBottom) || 0 : 0;
    if (__heightRaf) return; // 简易节流，下一帧再计算
    __heightRaf = requestAnimationFrame(() => {
      __heightRaf = 0;
      const rect = output.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const available = Math.max(30, Math.floor(viewportHeight - rect.top - bottomGapPx));
      const maxByViewport = Math.max(45, Math.floor(viewportHeight * 0.4));
      output.style.maxHeight = Math.min(available, maxByViewport) + 'px';
    });
  } catch (_) {}
}

function setBusy(busy) {
  const input = document.getElementById('input');
  const aiBtn = document.getElementById('aiBtn');
  const searchBtn = document.getElementById('searchBtn');
  const aiControls = document.getElementById('aiControls');
  input.disabled = !!busy;
  aiBtn.disabled = !!busy;
  searchBtn.disabled = !!busy;
  if (aiControls) aiControls.hidden = !busy;
  try {
    document.documentElement.classList.toggle('ai-busy', !!busy);
    if (!busy) __clearAiBusyClass();
  } catch (_) {}
}

function showError(msg) {
  const el = document.getElementById('error');
  if (el) {
    el.textContent = msg;
    el.hidden = !msg;
  }
}

async function doSearch(text) {
  try {
    chrome.search.query({ text, disposition: 'CURRENT_TAB' });
  } catch (e) {
    showError('搜索失败：' + (e?.message || '未知错误'));
  }
}

async function doAI(text) {
  const output = document.getElementById('aiOutput');
  const content = document.getElementById('aiContent');
  const aiControls = document.getElementById('aiControls');
  if (content) content.innerHTML = '';
  output.hidden = false;
  if (aiControls) aiControls.hidden = false;
  // 动态设置输出区域可用最大高度（随内容增长，达上限后滚动）
  updateOutputMaxHeight();
  showError('');
  setBusy(true);
  try { output.setAttribute('aria-busy', 'true'); } catch (_) {}
  // 流式容器：批量追加块，便于渐显动画
  let streamContainer = null;
  if (content) {
    streamContainer = document.createElement('div');
    streamContainer.id = 'aiStream';
    content.appendChild(streamContainer);
  }
  const fullChunks = [];
  const pendingChunks = [];
  const FLUSH_INTERVAL_MS = 100;
  let flushTimer = null;

  const isAtBottom = (el, threshold = 8) => {
    if (!el) return false;
    return (el.scrollHeight - el.clientHeight - el.scrollTop) <= threshold;
  };

  const flushStream = () => {
    if (!content || !streamContainer) return;
    if (pendingChunks.length === 0) return;
    const stickToBottom = isAtBottom(output);
    const add = pendingChunks.join('');
    pendingChunks.length = 0;
    const span = document.createElement('span');
    span.className = 'stream-chunk';
    span.textContent = add;
    streamContainer.appendChild(span);
    updateOutputMaxHeight();
    requestAnimationFrame(() => {
      if (stickToBottom) output.scrollTop = output.scrollHeight;
    });
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushStream();
    }, FLUSH_INTERVAL_MS);
  };

  await aiChat(text, (delta) => {
    pendingChunks.push(delta);
    fullChunks.push(delta);
    scheduleFlush();
  }, (errMsg) => {
    showError(errMsg);
  }, () => {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    // 最终一次性做 Markdown 渲染，避免流式阶段的频繁重排
    const finalText = fullChunks.join('');
    if (content) content.innerHTML = window.renderMarkdown ? window.renderMarkdown(finalText) : finalText;
    const stickToBottom = isAtBottom(output);
    updateOutputMaxHeight();
    requestAnimationFrame(() => {
      if (stickToBottom) output.scrollTop = output.scrollHeight;
    });
    setBusy(false);
    try { output.setAttribute('aria-busy', 'false'); } catch (_) {}
  });
}

function initChat() {
  const input = document.getElementById('input');
  const searchBtn = document.getElementById('searchBtn');
  const translateBtn = document.getElementById('translateBtn');
  const aiBtn = document.getElementById('aiBtn');
  const formatBtn = document.getElementById('formatBtn');
  const aiControls = document.getElementById('aiControls');
  const aiStopBtn = document.getElementById('aiStopBtn');
  const aiResetBtn = document.getElementById('aiResetBtn');

  input.addEventListener('input', () => autoResizeTextArea(input));
  input.addEventListener('compositionstart', () => isComposing = true);
  input.addEventListener('compositionend', () => { isComposing = false; });

  input.addEventListener('keydown', async (e) => {
    if (isComposing) return;
    if (e.key === 'Escape') {
      try { aiCancelActive?.(); } catch (_) {}
      input.value = '';
      autoResizeTextArea(input);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (e.ctrlKey || e.metaKey) {
        await __ensureModeAndMaybeReset('ai');
        doAI(text);
      } else {
        await __ensureModeAndMaybeReset('search');
        doSearch(text);
      }
    }
  });

  searchBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    await __ensureModeAndMaybeReset('search');
    doSearch(text);
  });
  translateBtn?.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    const translatePrompt = (window.Prompts && typeof window.Prompts.buildTranslatePrompt === 'function')
      ? window.Prompts.buildTranslatePrompt(text)
      : `根据第一性原理识别以下内容意图并翻译，只需要输出译文，无需解释（默认中英互译）：\n\n${text}`;
    await __ensureModeAndMaybeReset('translate');
    doAI(translatePrompt);
  });
  aiBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    await __ensureModeAndMaybeReset('ai');
    doAI(text);
  });
  formatBtn?.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    await __ensureModeAndMaybeReset('format');
    doFormat(text);
  });
  aiStopBtn?.addEventListener('click', () => {
    try { aiCancelActive?.(); } catch (_) {}
  });
  aiResetBtn?.addEventListener('click', async () => {
    try { await aiClearHistory?.(); } catch (_) {}
    const output = document.getElementById('aiOutput');
    const content = document.getElementById('aiContent');
    if (content) content.innerHTML = '';
    if (output) output.hidden = true;
    showError('已重置对话');
    setTimeout(() => showError(''), 1500);
    __lastMode = null;
  });
  // 可通过“停止”按钮或按 Esc 中断当前 AI 请求

  autoResizeTextArea(input);
  input.focus();
}

document.addEventListener('DOMContentLoaded', initChat);

window.addEventListener('resize', () => {
  updateOutputMaxHeight();
});

