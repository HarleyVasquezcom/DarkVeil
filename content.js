(function () {
  'use strict';

  const STYLE_ID = 'dv-shadow';
  const KEY_KEYS = ['dv:on', 'dv:whitelist', 'dv:strength', 'dv:sepia', 'dv:brightness'];

  const hostname = location.hostname.toLowerCase();

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const buildCss = (s) => {
    const strength = clamp(Number(s['dv:strength'] ?? 85), 50, 100);
    const sepia = clamp(Number(s['dv:sepia'] ?? 0), 0, 100);
    const brightness = clamp(Number(s['dv:brightness'] ?? 0), -60, 60);
    const b = 100 + brightness;
    return (
      'html.dv-on{' +
      'filter:invert(' + strength / 100 + ') hue-rotate(180deg) sepia(' + sepia / 100 + ')' +
      ' brightness(' + b / 100 + ') contrast(1.05) !important;' +
      '}'
    );
  };

  const apply = () => {
    chrome.storage.local.get(KEY_KEYS, (s) => {
      const on = s['dv:on'] === true;
      const list = Array.isArray(s['dv:whitelist']) ? s['dv:whitelist'] : [];
      const dark = on && list.includes(hostname);
      const existing = document.getElementById(STYLE_ID);
      if (!dark) {
        if (existing) existing.remove();
        document.documentElement.classList.remove('dv-on');
        return;
      }
      if (!existing) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(style);
      }
      document.getElementById(STYLE_ID).textContent = buildCss(s);
      document.documentElement.classList.add('dv-on');
    });
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && KEY_KEYS.some((k) => changes[k])) apply();
  });

  apply();

  try {
    chrome.storage.local.set({ 'dv:lastHost': hostname });
  } catch (e) {}
})();