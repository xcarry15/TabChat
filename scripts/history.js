/*
v0.3.4 | 2025-08-17
- 新增历史面板逻辑：左下角按钮打开/关闭，渲染 chrome.storage.local 中的 chatHistoryPairs
- 列表默认可见至少20条（由样式控制高度），点击项将 user 文本填入输入框
- 版本号同步到 0.3.4
*/

(function(){
  'use strict';

  // 读取对话对（与 ai.js 的存储键保持一致）
  function getChatHistoryPairs() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['chatHistoryPairs'], (res) => {
          const list = Array.isArray(res.chatHistoryPairs) ? res.chatHistoryPairs : [];
          resolve(list);
        });
      } catch (_) {
        resolve([]);
      }
    });
  }

  function createItem(pair, index){
    const li = document.createElement('div');
    li.className = 'history-item';
    li.setAttribute('role','listitem');
    const user = (pair && typeof pair.user === 'string') ? pair.user : '';
    const assistant = (pair && typeof pair.assistant === 'string') ? pair.assistant : '';

    const userPreview = user.replace(/\s+/g,' ').slice(0,120);
    const asstPreview = assistant.replace(/\s+/g,' ').slice(0,120);

    li.innerHTML = `
      <div class="history-item-index">#${index+1}</div>
      <div class="history-item-body">
        <div class="history-item-user" title="用户">${escapeHtml(userPreview)}</div>
        ${asstPreview ? `<div class="history-item-assistant" title="回复">${escapeHtml(asstPreview)}</div>` : ''}
      </div>
    `;

    li.addEventListener('click', () => {
      try {
        const input = document.getElementById('input');
        if (input) {
          input.value = user;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        }
      } catch (_) {}
    });

    return li;
  }

  function escapeHtml(str){
    return str
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  async function renderHistory(){
    const listEl = document.getElementById('historyList');
    if (!listEl) return;
    listEl.innerHTML = '';
    const pairs = await getChatHistoryPairs();
    // 最新在下方或上方：采用最新在顶部以便快速操作
    const data = pairs.slice().reverse();

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = '暂无历史记录';
      listEl.appendChild(empty);
      return;
    }

    data.forEach((p, i) => {
      const item = createItem(p, i);
      listEl.appendChild(item);
    });
  }

  function togglePanel(show){
    const panel = document.getElementById('historyPanel');
    if (!panel) return;
    const want = typeof show === 'boolean' ? show : panel.hasAttribute('hidden');
    if (want) {
      panel.removeAttribute('hidden');
      renderHistory();
    } else {
      panel.setAttribute('hidden','');
    }
  }

  function initHistory(){
    const btn = document.getElementById('historyBtn');
    const closeBtn = document.getElementById('historyCloseBtn');
    btn?.addEventListener('click', () => togglePanel());
    closeBtn?.addEventListener('click', () => togglePanel(false));

    // 点击面板外区域关闭（可选，保持简洁不引入遮罩）
    document.addEventListener('click', (e) => {
      try {
        const panel = document.getElementById('historyPanel');
        if (!panel || panel.hasAttribute('hidden')) return;
        const btnEl = document.getElementById('historyBtn');
        if (panel.contains(e.target) || btnEl?.contains(e.target)) return;
        panel.setAttribute('hidden','');
      } catch (_) {}
    });
  }

  document.addEventListener('DOMContentLoaded', initHistory);
})();
