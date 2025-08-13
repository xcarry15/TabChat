let isComposing = false;

function autoResizeTextArea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.3) + 'px';
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
  try { document.documentElement.classList.toggle('ai-busy', !!busy); } catch (_) {}
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
  showError('');
  setBusy(true);
  let buffered = '';
  const FLUSH_INTERVAL_MS = 80;
  let flushTimer = null;

  const isAtBottom = (el, threshold = 8) => {
    if (!el) return false;
    return (el.scrollHeight - el.clientHeight - el.scrollTop) <= threshold;
  };

  const flushStream = () => {
    if (!content) return;
    const stickToBottom = isAtBottom(output);
    content.textContent = buffered;
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
    buffered += delta;
    scheduleFlush();
  }, (errMsg) => {
    showError(errMsg);
  }, () => {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    // 最终一次性做 Markdown 渲染，避免流式阶段的频繁重排
    if (content) content.innerHTML = window.renderMarkdown ? window.renderMarkdown(buffered) : buffered;
    const stickToBottom = isAtBottom(output);
    requestAnimationFrame(() => {
      if (stickToBottom) output.scrollTop = output.scrollHeight;
    });
    setBusy(false);
  });
}

function initChat() {
  const input = document.getElementById('input');
  const searchBtn = document.getElementById('searchBtn');
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
        doAI(text);
      } else {
        doSearch(text);
      }
    }
  });

  searchBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (text) doSearch(text);
  });
  aiBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (text) doAI(text);
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
  });
  // 停止按钮已移除，如需中断 AI，可按 Esc 清空或刷新页面

  autoResizeTextArea(input);
  input.focus();
}

document.addEventListener('DOMContentLoaded', initChat);

