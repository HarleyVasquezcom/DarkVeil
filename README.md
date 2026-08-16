# DarkVeil

**Whitelisted dark mode** for Chromium (MV3). A real CSS filter — `invert()` + `hue-rotate(180deg)` + `sepia()` + `brightness()` — applied to pages you explicitly whitelist. Three sliders (strength, sepia, brightness) tune the veil; everything persists under `dv:*` keys. Everywhere else stays untouched.

---

**Español:** Modo oscuro **con lista blanca** para Chromium (MV3). Un filtro CSS real — `invert()` + `hue-rotate(180deg)` + `sepia()` + `brightness()` — aplicado solo a páginas que agregas explícitamente. Tres controles (intensidad, sepia, brillo) afinan el velo; todo persiste bajo claves `dv:*`. Todo lo demás queda intacto.

## Features / Funciones

- Real veiling: computed-style verified by the probe (`invert(0.85) hue-rotate(180deg) sepia(0.08) brightness(0.88)`). Velo real: la probe verifica el estilo computado.
- Whitelist only: non-whitelisted hosts keep the exact baseline computed filter. Solo lista blanca: los hosts no listados mantienen el filtro base exacto.
- Live sliders: strength/sepia/brightness re-apply instantly via `chrome.storage.onChanged`; settings survive reloads. Controles en vivo: intensidad/sepia/brillo se reaplican al instante y sobreviven recargas.
- 6 languages / 6 idiomas.

### Permission / Permiso

- `storage` only. Solo `storage`. No `<all_urls>`, no `tabs`, no `webRequest`, no remote code.

## Install / Instalación

1. Download `darkveil.zip` from the [landing page](https://darkveil-two.vercel.app) (or generate it: `npm run zip`).
2. Open `chrome://extensions`, enable **Developer mode / Modo desarrollador**.
3. Unzip and click **Load unpacked / Cargar descomprimida**, select the folder.

## Development / Desarrollo

```bash
npm.cmd install        # local deps (puppeteer, archiver) — no global installs
npm run gen-icons      # regenerate PNG icons (pure node)
npm run zip            # reproducible dist/darkveil.zip + landing/darkveil.zip copy
npm run probe          # hermetic probe: defaults -> veil on empty whitelist -> add site -> sliders -> reload persist -> non-whitelisted stays clear -> off -> frozen -> i18n -> landing -> zip
```

Environment / Entorno: `PROBE_CHROME` (optional) and `DARKVEIL_DEPLOY_URL` (optional — verifies the deployed ZIP is byte-identical).

The probe is fully local: fixture server on `127.0.0.1`, headless Chrome with and without the extension, computed-style assertions on the real DOM. Network only when `DARKVEIL_DEPLOY_URL` is set.

## Layout / Estructura

```
manifest.json        MV3 manifest (1 permission, popup, icons)
background.js        storage init: dv:on / dv:whitelist / sliders / dv:lastHost pinned on install/startup
content.js           veil engine: builds the CSS filter, injects <style id="dv-shadow">, reacts to storage changes, reports dv:lastHost
i18n.js              DarkVeilI18N dictionary (6 languages)
popup.html/.css/.js  night room: toggle, three sliders, whitelist manager, lang select
landing/index.html   bilingual landing (6 languages, zip download CTA)
tests/probe.mjs      hermetic end-to-end probe (computed-style assertions)
tools/zip.mjs        reproducible ZIP (fixed timestamps) via archiver
tools/gen-icons.mjs  PNG icon generator (crc32 + zlib, no native deps)
```

Built by [Harley Vásquez](https://www.linkedin.com/in/harleyvasquez/). / Creado por [Harley Vásquez](https://www.linkedin.com/in/harleyvasquez/).