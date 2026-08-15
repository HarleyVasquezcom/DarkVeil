(function () {
  'use strict';

  const LANGUAGES = ['en', 'es', 'fr', 'pt', 'it', 'de'];

  const I18N = {
    en: {
      appTitle: 'DarkVeil', tagline: 'whitelisted dark, everywhere else untouched', credit: 'Built by Harley Vásquez',
      statusOn: 'VEILED', statusOff: 'CLEAR', toggle: '[ toggle veil ]',
      strength: 'strength:', sepia: 'sepia:', brightness: 'brightness:',
      whitelistTitle: 'whitelist', whitelistEmpty: '~ no sites yet',
      addHint: 'current page:', addBtn: '[ add ]', removeBtn: '[ x ]',
      saveOk: 'ok: saved', addOk: 'ok: site veiled', addFail: 'error: no host reported',
      removeOk: 'ok: site cleared',
    },
    es: {
      appTitle: 'DarkVeil', tagline: 'oscuro solo donde lo eliges, el resto intacto', credit: 'Creado por Harley Vásquez',
      statusOn: 'VELADO', statusOff: 'CLARO', toggle: '[ alternar velo ]',
      strength: 'intensidad:', sepia: 'sepia:', brightness: 'brillo:',
      whitelistTitle: 'lista blanca', whitelistEmpty: '~ sin sitios todavía',
      addHint: 'página actual:', addBtn: '[ añadir ]', removeBtn: '[ x ]',
      saveOk: 'ok: guardado', addOk: 'ok: sitio velado', addFail: 'error: sin host reportado',
      removeOk: 'ok: sitio limpio',
    },
    fr: {
      appTitle: 'DarkVeil', tagline: 'sombre là où tu le choisis, intact ailleurs', credit: 'Créé par Harley Vásquez',
      statusOn: 'VOILÉ', statusOff: 'CLAIR', toggle: '[ basculer le voile ]',
      strength: 'intensité :', sepia: 'sépia :', brightness: 'luminosité :',
      whitelistTitle: 'liste blanche', whitelistEmpty: '~ aucun site pour l\'instant',
      addHint: 'page actuelle :', addBtn: '[ ajouter ]', removeBtn: '[ x ]',
      saveOk: 'ok : enregistré', addOk: 'ok : site voilé', addFail: 'erreur : aucun hôte signalé',
      removeOk: 'ok : site débarrassé',
    },
    pt: {
      appTitle: 'DarkVeil', tagline: 'escuro só onde você escolhe, intocado no resto', credit: 'Criado por Harley Vásquez',
      statusOn: 'VELADO', statusOff: 'CLARO', toggle: '[ alternar véu ]',
      strength: 'intensidade:', sepia: 'sépia:', brightness: 'brilho:',
      whitelistTitle: 'lista branca', whitelistEmpty: '~ nenhum site ainda',
      addHint: 'página atual:', addBtn: '[ adicionar ]', removeBtn: '[ x ]',
      saveOk: 'ok: salvo', addOk: 'ok: site velado', addFail: 'erro: nenhum host relatado',
      removeOk: 'ok: site limpo',
    },
    it: {
      appTitle: 'DarkVeil', tagline: 'scuro solo dove scegli, intatto altrove', credit: 'Creato da Harley Vásquez',
      statusOn: 'VELATO', statusOff: 'CHIARO', toggle: '[ alterna velo ]',
      strength: 'intensità:', sepia: 'seppia:', brightness: 'luminosità:',
      whitelistTitle: 'lista bianca', whitelistEmpty: '~ nessun sito ancora',
      addHint: 'pagina attuale:', addBtn: '[ aggiungi ]', removeBtn: '[ x ]',
      saveOk: 'ok: salvato', addOk: 'ok: sito velato', addFail: 'errore: nessun host segnalato',
      removeOk: 'ok: sito ripulito',
    },
    de: {
      appTitle: 'DarkVeil', tagline: 'dunkel nur wo du es wählst, unberührt sonst', credit: 'Erstellt von Harley Vásquez',
      statusOn: 'VERSCHLEIERT', statusOff: 'HELL', toggle: '[ Schleier umschalten ]',
      strength: 'stärke:', sepia: 'sepia:', brightness: 'helligkeit:',
      whitelistTitle: 'Weißliste', whitelistEmpty: '~ noch keine Seiten',
      addHint: 'aktuelle Seite:', addBtn: '[ hinzufügen ]', removeBtn: '[ x ]',
      saveOk: 'ok: gespeichert', addOk: 'ok: Seite verschleiert', addFail: 'fehler: kein Host gemeldet',
      removeOk: 'ok: Seite freigelegt',
    },
  };

  const apply = (root) => {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (I18N[current][key] !== undefined) el.textContent = I18N[current][key];
    });
    root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const key = el.getAttribute('data-i18n-ph');
      if (I18N[current][key] !== undefined) el.placeholder = I18N[current][key];
    });
  };

  const getLang = () =>
    chrome.storage.local.get('dv:lang').then(({ 'dv:lang': lang }) => (LANGUAGES.includes(lang) ? lang : detect()));

  const setLang = (lang) => chrome.storage.local.set({ 'dv:lang': lang }).then(() => (LANGUAGES.includes(lang) ? lang : 'en'));

  const detect = () => {
    const nav = (navigator.language || 'en').toLowerCase().split('-')[0];
    return LANGUAGES.includes(nav) ? nav : 'en';
  };

  let current = 'en';

  window.DarkVeilI18N = {
    apply,
    getLang,
    setLang,
    t: (key, lang) => (I18N[lang] || I18N.en)[key] !== undefined ? (I18N[lang] || I18N.en)[key] : key,
    get current() { return current; },
    set current(l) { current = l; },
  };
})();