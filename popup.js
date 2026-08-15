(function () {
  'use strict';

  const KEY_KEYS = ['dv:on', 'dv:whitelist', 'dv:strength', 'dv:sepia', 'dv:brightness', 'dv:lastHost'];

  const els = {
    stateLed: document.getElementById('stateLed'),
    toggleBtn: document.getElementById('toggleBtn'),
    out: document.getElementById('out'),
    strengthRange: document.getElementById('strengthRange'),
    strengthVal: document.getElementById('strengthVal'),
    sepiaRange: document.getElementById('sepiaRange'),
    sepiaVal: document.getElementById('sepiaVal'),
    brightnessRange: document.getElementById('brightnessRange'),
    brightnessVal: document.getElementById('brightnessVal'),
    list: document.getElementById('list'),
    lastHost: document.getElementById('lastHost'),
    addBtn: document.getElementById('addBtn'),
    langSel: document.getElementById('langSel'),
  };

  const loadState = () =>
    chrome.storage.local.get(KEY_KEYS).then((s) => ({
      on: s['dv:on'] === true,
      whitelist: Array.isArray(s['dv:whitelist']) ? s['dv:whitelist'] : [],
      strength: Number(s['dv:strength'] ?? 85),
      sepia: Number(s['dv:sepia'] ?? 0),
      brightness: Number(s['dv:brightness'] ?? 0),
      lastHost: String(s['dv:lastHost'] || ''),
    }));

  const renderList = (whitelist) => {
    els.list.innerHTML = '';
    if (!whitelist.length) {
      const li = document.createElement('li');
      li.className = 'empty-note';
      li.textContent = DarkVeilI18N.t('whitelistEmpty', els.langSel.value);
      els.list.appendChild(li);
      return;
    }
    for (const host of [...whitelist].sort()) {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.className = 'host';
      span.textContent = host;
      const del = document.createElement('button');
      del.textContent = DarkVeilI18N.t('removeBtn', els.langSel.value);
      del.dataset.host = host;
      del.addEventListener('click', onRemove);
      li.appendChild(span);
      li.appendChild(del);
      els.list.appendChild(li);
    }
  };

  const render = (s) => {
    els.stateLed.dataset.state = s.on ? 'on' : 'off';
    els.stateLed.querySelector('span').textContent = DarkVeilI18N.t(s.on ? 'statusOn' : 'statusOff', els.langSel.value);
    els.toggleBtn.classList.toggle('on', s.on);
    els.strengthRange.value = s.strength;
    els.strengthVal.textContent = s.strength + '%';
    els.sepiaRange.value = s.sepia;
    els.sepiaVal.textContent = s.sepia + '%';
    els.brightnessRange.value = s.brightness;
    els.brightnessVal.textContent = (s.brightness >= 0 ? '+' : '') + s.brightness + '%';
    els.lastHost.textContent = s.lastHost || '-';
    renderList(s.whitelist);
  };

  const refresh = () => loadState().then(render);

  els.toggleBtn.addEventListener('click', async () => {
    const s = await loadState();
    await chrome.storage.local.set({ 'dv:on': !s.on });
    refresh();
  });

  const wireRange = (input, valEl, key) => {
    input.addEventListener('input', () => {
      valEl.textContent = (key === 'dv:brightness' && Number(input.value) >= 0 ? '+' : '') + input.value + '%';
      chrome.storage.local.set({ [key]: Number(input.value) });
    });
  };
  wireRange(els.strengthRange, els.strengthVal, 'dv:strength');
  wireRange(els.sepiaRange, els.sepiaVal, 'dv:sepia');
  wireRange(els.brightnessRange, els.brightnessVal, 'dv:brightness');

  els.addBtn.addEventListener('click', async () => {
    const s = await loadState();
    const host = s.lastHost;
    if (!host) {
      els.out.textContent = DarkVeilI18N.t('addFail', els.langSel.value);
      els.out.classList.toggle('error', true);
      return;
    }
    const list = s.whitelist.includes(host) ? s.whitelist : [...s.whitelist, host];
    await chrome.storage.local.set({ 'dv:whitelist': list });
    els.out.textContent = DarkVeilI18N.t('addOk', els.langSel.value);
    els.out.classList.toggle('ok', true);
    els.out.classList.remove('error');
    refresh();
  });

  const onRemove = async (e) => {
    const s = await loadState();
    const list = s.whitelist.filter((h) => h !== e.target.dataset.host);
    await chrome.storage.local.set({ 'dv:whitelist': list });
    els.out.textContent = DarkVeilI18N.t('removeOk', els.langSel.value);
    els.out.classList.toggle('ok', true);
    els.out.classList.remove('error');
    refresh();
  };

  els.langSel.addEventListener('change', async () => {
    const lang = await DarkVeilI18N.setLang(els.langSel.value);
    DarkVeilI18N.current = lang;
    DarkVeilI18N.apply(document);
    refresh();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (KEY_KEYS.some((k) => changes[k])) refresh();
  });

  (async () => {
    const lang = await DarkVeilI18N.getLang();
    els.langSel.value = lang;
    DarkVeilI18N.current = lang;
    DarkVeilI18N.apply(document);
    refresh();
  })();
})();