// 轻量 Markdown 渲染（安全）：支持粗体、行内代码、链接、标题、列表、代码块
// 处理顺序：分块解析代码围栏 → 普通块级（标题/列表/段落）→ 行内替换（粗体/行内代码/链接）

(function(){
  function escapeHtml(raw) {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function tokenize(text) {
    const lines = text.split(/\r?\n/);
    const tokens = [];
    let inFence = false;
    let fenceLang = '';
    let fenceBuffer = [];
    let normalBuffer = [];

    function flushNormal() {
      if (normalBuffer.length) {
        tokens.push({ type: 'text', content: normalBuffer.join('\n') });
        normalBuffer = [];
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fenceOpen = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/);
      if (!inFence && fenceOpen) {
        flushNormal();
        inFence = true;
        fenceLang = fenceOpen[1] || '';
        fenceBuffer = [];
        continue;
      }
      if (inFence && /^```\s*$/.test(line)) {
        tokens.push({ type: 'code', lang: fenceLang, content: fenceBuffer.join('\n') });
        inFence = false;
        fenceLang = '';
        fenceBuffer = [];
        continue;
      }
      if (inFence) {
        fenceBuffer.push(line);
      } else {
        normalBuffer.push(line);
      }
    }
    if (inFence) {
      // 未闭合代码块，按文本处理
      normalBuffer.push('```' + (fenceLang ? (' ' + fenceLang) : ''));
      normalBuffer.push(...fenceBuffer);
    }
    flushNormal();
    return tokens;
  }

  function renderBlocks(text) {
    const out = [];
    const lines = text.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // 标题 #
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const level = Math.min(6, h[1].length);
        out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
        i++;
        continue;
      }
      // 无序列表
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          const item = lines[i].replace(/^\s*[-*]\s+/, '');
          items.push(`<li>${renderInline(item)}</li>`);
          i++;
        }
        out.push(`<ul>${items.join('')}</ul>`);
        continue;
      }
      // 有序列表
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const item = lines[i].replace(/^\s*\d+\.\s+/, '');
          items.push(`<li>${renderInline(item)}</li>`);
          i++;
        }
        out.push(`<ol>${items.join('')}</ol>`);
        continue;
      }
      // 空行 → 段落分隔
      if (/^\s*$/.test(line)) {
        out.push('');
        i++;
        continue;
      }
      // 段落（合并连续非空行）
      const para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push(`<p>${renderInline(para.join(' '))}</p>`);
    }
    return out.join('\n');
  }

  function renderInline(text) {
    // 先转义
    let s = escapeHtml(text);
    // 行内代码 `code`
    s = s.replace(/`([^`]+)`/g, (m, p1) => `<code>${p1}</code>`);
    // 粗体 **bold**
    s = s.replace(/\*\*([^*]+)\*\*/g, (m, p1) => `<strong>${p1}</strong>`);
    // 斜体 *em*
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (m, p1) => `<em>${p1}</em>`);
    // 链接 [text](url)
    s = s.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, (m, p1, p2) => `<a href="${p2}" target="_blank" rel="noopener noreferrer">${p1}</a>`);
    return s;
  }

  function renderMarkdown(text) {
    if (!text) return '';
    const tokens = tokenize(text);
    const htmlParts = [];
    for (const t of tokens) {
      if (t.type === 'code') {
        htmlParts.push(`<pre><code class="lang-${escapeHtml(t.lang || '')}">${escapeHtml(t.content)}</code></pre>`);
      } else {
        htmlParts.push(renderBlocks(t.content));
      }
    }
    return htmlParts.join('\n');
  }

  // 暴露全局函数
  window.renderMarkdown = renderMarkdown;
})();

