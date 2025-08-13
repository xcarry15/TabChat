const DEFAULT_SETTINGS = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'deepseek-ai/DeepSeek-V2.5',
  timeoutSeconds: 30,
  temperature: 0.7,
  topP: 1,
  maxTokens: 2048,
  retries: 2,
  retryInitialDelaySeconds: 1,
  memoryEnabled: true,
  memoryMaxTurns: 8,
  systemPrompt: ''
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'baseUrl', 'apiKey', 'model', 'timeoutSeconds',
      'temperature', 'topP', 'maxTokens', 'retries', 'retryInitialDelaySeconds',
      'memoryEnabled', 'memoryMaxTurns', 'systemPrompt'
    ], (res) => {
      resolve({
        baseUrl: res.baseUrl || DEFAULT_SETTINGS.baseUrl,
        apiKey: res.apiKey || '',
        model: res.model || DEFAULT_SETTINGS.model,
        timeoutSeconds: typeof res.timeoutSeconds === 'number' ? res.timeoutSeconds : DEFAULT_SETTINGS.timeoutSeconds,
        temperature: typeof res.temperature === 'number' ? res.temperature : DEFAULT_SETTINGS.temperature,
        topP: typeof res.topP === 'number' ? res.topP : DEFAULT_SETTINGS.topP,
        maxTokens: typeof res.maxTokens === 'number' ? res.maxTokens : DEFAULT_SETTINGS.maxTokens,
        retries: typeof res.retries === 'number' ? res.retries : DEFAULT_SETTINGS.retries,
        retryInitialDelaySeconds: typeof res.retryInitialDelaySeconds === 'number' ? res.retryInitialDelaySeconds : DEFAULT_SETTINGS.retryInitialDelaySeconds,
        memoryEnabled: typeof res.memoryEnabled === 'boolean' ? res.memoryEnabled : DEFAULT_SETTINGS.memoryEnabled,
        memoryMaxTurns: typeof res.memoryMaxTurns === 'number' ? res.memoryMaxTurns : DEFAULT_SETTINGS.memoryMaxTurns,
        systemPrompt: typeof res.systemPrompt === 'string' ? res.systemPrompt : DEFAULT_SETTINGS.systemPrompt
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
  const form = document.getElementById('settingsForm');
  const advTpl = document.getElementById('advancedSettingsTemplate');
  // 动态挂载高级参数区域（避免旧版本缺少这些字段）
  if (form && advTpl && !document.getElementById('temperature')) {
    try {
      const menuEl = form.querySelector('menu');
      const frag = advTpl.content.cloneNode(true);
      if (menuEl) {
        form.insertBefore(frag, menuEl);
      } else {
        form.appendChild(frag);
      }
    } catch (_) {}
  }
  const baseUrl = document.getElementById('baseUrl');
  const apiKey = document.getElementById('apiKey');
  const model = document.getElementById('model');
  const timeout = document.getElementById('timeout');
  const temperature = document.getElementById('temperature');
  const topP = document.getElementById('topP');
  const maxTokens = document.getElementById('maxTokens');
  const retries = document.getElementById('retries');
  const retryInitialDelaySeconds = document.getElementById('retryInitialDelaySeconds');
  const memoryEnabled = document.getElementById('memoryEnabled');
  const memoryMaxTurns = document.getElementById('memoryMaxTurns');
  const systemPrompt = document.getElementById('systemPrompt');

  if (!dialog || !btn) return;

  btn.addEventListener('click', async () => {
    const s = await getSettings();
    baseUrl.value = s.baseUrl;
    apiKey.value = s.apiKey;
    model.value = s.model;
    timeout.value = String(s.timeoutSeconds);
    if (temperature) temperature.value = String(s.temperature);
    if (topP) topP.value = String(s.topP);
    if (maxTokens) maxTokens.value = String(s.maxTokens);
    if (retries) retries.value = String(s.retries);
    if (retryInitialDelaySeconds) retryInitialDelaySeconds.value = String(s.retryInitialDelaySeconds);
    if (memoryEnabled) memoryEnabled.checked = !!s.memoryEnabled;
    if (memoryMaxTurns) memoryMaxTurns.value = String(s.memoryMaxTurns);
    if (systemPrompt) systemPrompt.value = s.systemPrompt || '';
    dialog.showModal();
  });

  saveBtn?.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    const payload = {
      baseUrl: baseUrl.value.trim() || DEFAULT_SETTINGS.baseUrl,
      apiKey: apiKey.value.trim(),
      model: model.value.trim() || DEFAULT_SETTINGS.model,
      timeoutSeconds: Math.min(120, Math.max(5, Number(timeout.value) || DEFAULT_SETTINGS.timeoutSeconds)),
      temperature: Math.min(2, Math.max(0, Number(temperature?.value ?? DEFAULT_SETTINGS.temperature))),
      topP: Math.min(1, Math.max(0, Number(topP?.value ?? DEFAULT_SETTINGS.topP))),
      maxTokens: Math.max(1, Math.floor(Number(maxTokens?.value ?? DEFAULT_SETTINGS.maxTokens))),
      retries: Math.min(5, Math.max(0, Math.floor(Number(retries?.value ?? DEFAULT_SETTINGS.retries)))),
      retryInitialDelaySeconds: Math.min(10, Math.max(0.25, Number(retryInitialDelaySeconds?.value ?? DEFAULT_SETTINGS.retryInitialDelaySeconds))),
      memoryEnabled: !!(memoryEnabled?.checked ?? DEFAULT_SETTINGS.memoryEnabled),
      memoryMaxTurns: Math.min(32, Math.max(0, Math.floor(Number(memoryMaxTurns?.value ?? DEFAULT_SETTINGS.memoryMaxTurns)))),
      systemPrompt: String(systemPrompt?.value ?? DEFAULT_SETTINGS.systemPrompt)
    };
    await saveSettings(payload);
    dialog.close();
  });
}

document.addEventListener('DOMContentLoaded', initSettingsUI);

