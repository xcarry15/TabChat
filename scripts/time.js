/*
v0.3.4 | 2025-08-17
- 版本头同步：与历史面板功能发布一致；无功能改动
*/
(() => {
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const week = ['日','一','二','三','四','五','六'][d.getDay()];
    return `${y}-${m}-${day} 周${week}`;
  }

  function render() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    if (timeEl) timeEl.textContent = `${hh}:${mm}`;
    if (dateEl) dateEl.textContent = formatDate(now);
  }

  function scheduleNextMinuteTick() {
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(() => {
      render();
      setInterval(render, 60 * 1000);
    }, Math.max(msToNextMinute, 200));
  }

  render();
  scheduleNextMinuteTick();
})();

