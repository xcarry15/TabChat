let isComposing = false;

function autoResizeTextArea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.3) + 'px';
}

function setBusy(busy) {
  const input = document.getElementById('input');
  const aiBtn = document.getElementById('aiBtn');
  const searchBtn = document.getElementById('searchBtn');
  input.disabled = !!busy;
  aiBtn.disabled = !!busy;
  searchBtn.disabled = !!busy;
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
  output.hidden = false;
  output.textContent = '';
  showError('');
  setBusy(true);
  await aiChat(text, (delta) => {
    output.textContent += delta;
    output.scrollTop = output.scrollHeight;
  }, (errMsg) => {
    showError(errMsg);
  }, () => {
    setBusy(false);
  });
}

function initChat() {
  const input = document.getElementById('input');
  const searchBtn = document.getElementById('searchBtn');
  const aiBtn = document.getElementById('aiBtn');

  input.addEventListener('input', () => autoResizeTextArea(input));
  input.addEventListener('compositionstart', () => isComposing = true);
  input.addEventListener('compositionend', () => { isComposing = false; });

  input.addEventListener('keydown', async (e) => {
    if (isComposing) return;
    if (e.key === 'Escape') {
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
  // 停止按钮已移除，如需中断 AI，可按 Esc 清空或刷新页面

  autoResizeTextArea(input);
  input.focus();
}

document.addEventListener('DOMContentLoaded', initChat);

