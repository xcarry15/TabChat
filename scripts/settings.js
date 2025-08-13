const DEFAULT_SETTINGS = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'deepseek-ai/DeepSeek-V2.5',
  timeoutSeconds: 30
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['baseUrl', 'apiKey', 'model', 'timeoutSeconds'], (res) => {
      resolve({
        baseUrl: res.baseUrl || DEFAULT_SETTINGS.baseUrl,
        apiKey: res.apiKey || '',
        model: res.model || DEFAULT_SETTINGS.model,
        timeoutSeconds: typeof res.timeoutSeconds === 'number' ? res.timeoutSeconds : DEFAULT_SETTINGS.timeoutSeconds
      });
    });
  });
}

async function saveSettings(partial) {
  return new Promise((resolve) => {
    chrome.storage.local.set(partial, () => resolve());
  });
}

function initSettingsUI() {
  const dialog = document.getElementById('settingsDialog');
  const btn = document.getElementById('settingsBtn');
  const saveBtn = document.getElementById('saveSettings');
  const baseUrl = document.getElementById('baseUrl');
  const apiKey = document.getElementById('apiKey');
  const model = document.getElementById('model');
  const timeout = document.getElementById('timeout');

  if (!dialog || !btn) return;

  btn.addEventListener('click', async () => {
    const s = await getSettings();
    baseUrl.value = s.baseUrl;
    apiKey.value = s.apiKey;
    model.value = s.model;
    timeout.value = String(s.timeoutSeconds);
    dialog.showModal();
  });

  saveBtn?.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    const payload = {
      baseUrl: baseUrl.value.trim() || DEFAULT_SETTINGS.baseUrl,
      apiKey: apiKey.value.trim(),
      model: model.value.trim() || DEFAULT_SETTINGS.model,
      timeoutSeconds: Math.min(120, Math.max(5, Number(timeout.value) || DEFAULT_SETTINGS.timeoutSeconds))
    };
    await saveSettings(payload);
    dialog.close();
  });
}

document.addEventListener('DOMContentLoaded', initSettingsUI);

