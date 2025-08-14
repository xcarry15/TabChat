/*
v0.3.0 | 2025-08-14
- 更正误导性注释：保留“停止”按钮说明
- 新增“翻译”按钮交互：将输入内容翻译为简体中文
- 性能：降低流式刷新频率；在忙碌时标记输出区域 aria-busy；节流高度计算
  以及使用文本节点/块增量追加，减少重复字符串拷贝
 - 体验：流式输出采用渐显动画，更加动态
*/
let isComposing = false;
let __lastMode = null; // 'search' | 'ai' | 'translate'

async function __resetConversation() {
  try { aiCancelActive?.(); } catch (_) {}
  try { await aiClearHistory?.(); } catch (_) {}
  const output = document.getElementById('aiOutput');
  const content = document.getElementById('aiContent');
  if (content) content.innerHTML = '';
  if (output) output.hidden = true;
  showError('');
}

async function __ensureModeAndMaybeReset(newMode) {
  if (__lastMode && __lastMode !== newMode) {
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
    const translatePrompt = `根据第一性原理识别以下内容意图并翻译，只需要输出译文，无需解释（默认中英互译）：\n\n${text}`;
    await __ensureModeAndMaybeReset('translate');
    doAI(translatePrompt);
  });
  aiBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    await __ensureModeAndMaybeReset('ai');
    doAI(text);
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

