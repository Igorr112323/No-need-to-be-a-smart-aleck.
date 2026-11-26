# QA_REPORT — OpenLight независимое тестирование (26.11.2026)

> **Роль:** независимый инженер-тестировщик CAE (не разработчик фич). Цель — прогнать продукт через автоматику, найти баги, доказать артефактами CI. Среда: Linux-песочница без дисплея — GUI только headless Chromium в Actions.

---

## ИНВЕНТАРЬ (Задача A, без правок — только факты)

### A1. Дерево, размеры, git

**tree -L 2:**
```
.
├── LICENSE (1079 B)
├── VERSION (11 B → 0.9.3-test)
├── README.md (5968 B)
├── build/ (VERSION, make_icon.py 5.8K, make_version.py 1.4K, vendor.py 5.8K)
├── build_exe.bat (2.2K)
├── assets/ (openlight.ico 12K, openlight.png 4.3K)
├── design/freeform-reference.jpg (36K)
├── docs/ (BUG_LIST 21K, CORPUS_REPORT 18K, KNOWN_LIMITATIONS 2.6K, MATERIALS 5.6K, TESTING 14K, VERIFICATION 5.9K, mbb.png 6.0K, CHANGELOG 2.0K)
├── main.py (27K, 575стр)
├── solver.py (57K)
├── report.json (102K) report.html (27K)
├── requirements.txt (50 B: pywebview trimesh numpy scipy scikit-image Pillow)
├── screenshots/ (6 png + optimized.stl)
├── tests/ (conftest 82B, corpus/manifest.json 901 строка, test_beam 2.7K, test_bracket_oc 1.3K, test_corpus 1.0K, test_kirsch 2.9K, test_loadcases 2.8K, test_mbb 1.3K, test_solver 1.3K)
├── tools/ (crosscheck_calculix 5.4K, fetch_corpus 5.0K, make_stress_report 16K, merge_reports 4.3K)
└── web/ (index.html 20K 293стр, css/app.css 21K 293стр, js/app.js 93K 1634стр, js/state.js 3.5K, vendor/ 2.6M three.module.js 1.3M)
```

**Размеры ключевых файлов (bytes):** main.py 27593, solver.py 57768, web/index.html 20111, web/css/app.css 21427, web/js/app.js 95091, web/js/state.js 3483, VERSION 11.

**git:**
- ветки: `main`, `arena/84988ed1-no-need-to-be-a-smart-aleck` (active), `origin/main`, `origin/arena/...`
- коммитов на main: 80c251c (последний), на arena: e9ad412 (Merge 17F v1.0.5)
- теги: v0.9.3-test, v1.0.0, v1.0.1, v1.0.2, v1.0.3, v1.0.4, v1.0.5
- `git status` на старте: clean (после reset --hard origin/arena)
- `git log --oneline -10`: e9ad412 Merge 17F v1.0.5 → 80c251c remove hash → 24ee6cf 17F diag → 06d7459 Merge 17E → b7fb2e1 TDZ fix → 861d990 Merge 17D → dd51d0a diag --diag → b853ba2 loader fix → a94bde1 Merge v1.0.2 → 530fd85 loader 86/100 fix

### A2. git status / log (артефакт)
```
On branch arena/84988ed1-no-need-to-be-a-smart-aleck
HEAD e9ad412
git log --oneline -20: см. выше
```

### A3. html ↔ js сверка id (скрипт parse getElementById/querySelector vs id="...")

**HTML ids (51):** appDataPath, appGithubLink, appLicense, appLoader, appVersion, btnBack, btnExport, btnMaterial, btnMore, btnOpen, btnOpenProject, btnOptimize, btnSaveProject, btnUndo, centerHint, economy, forceInput, forceOk, legend, loadcaseChips, loaderFill, loaderSub, metricsBody, metricsPanel, metricsToggle, optBarFill, phaseText, phaseToast, popoverForce, popoverKeep, popoverLoadcase, popoverMaterial, popoverRelief, popoverSettings, popoverUnits, recentList, restoreNo, restorePrompt, restoreYes, safety, scene, splitDivider, titlebar, titlebarSubtitle, toast, warningToast, weightAfter, weightBefore, winClose, winMax, winMin

**JS ids (48):** appDataPath, appGithubLink, appLicense, appLoader, appVersion, btnBack, btnExport, btnMaterial, btnMore, btnOpen, btnOpenProject, btnOptimize, btnSaveProject, btnUndo, centerHint, economy, forceInput, forceOk, legend, loaderFill, loaderSub, metricsPanel, metricsToggle, optBarFill, phaseText, phaseToast, popoverForce, popoverKeep, popoverLoadcase, popoverMaterial, popoverRelief, popoverSettings, popoverUnits, recentList, restoreNo, restorePrompt, restoreYes, safety, scene, splitDivider, titlebarSubtitle, toast, warningToast, weightAfter, weightBefore, winClose, winMax, winMin

- **ID-MISMATCH:** `MISSING in HTML (js wants but html lacks): []` → **0 расхождений** (критичный баг прошлых этапов закрыт).
- `UNUSED in JS (html has but js not ref): ['loadcaseChips', 'metricsBody', 'titlebar']` — P3: контейнеры без прямого getElementById, используются via querySelector или только CSS, не ломает клики. Фиксируем как P3.

**Вывод A3:** зелёный, ID рассинхронизации нет.

### A4. grep сырых артефактов (web/**/* excl vendor)

Команда: `grep -rnE "anev|{{|placeholder|TODO|FIXME|XXX" web/ --exclude-dir=vendor`

- `web/index.html:126` — `Нажмите <kbd>Открыть</kbd> или перетащите STL — диалог откроется` — **OK** (раньше был `anev`, исправлен в 17E).
- `web/js/app.js` — 0 `anev`, 0 `{{`, 0 `placeholder` (кроме комментариев vendor).
- Остальные `TODO/FIXME` только в `web/vendor/three.module.js` (upstream, не наш код) — **OK**.

**Вывод A4:** сырых placeholder'ов нет, P0 из F3(д) закрыт.

### A5. Проверка оверлеев (z-index, pointer-events, display)

| Элемент | z-index | position | pointer-events | display/visibility после init | Перекрывает кнопки? |
|---|---|---|---|---|---|
| #appLoader .app-loader | 100 | fixed inset:0 | `pointer-events:none` в `.hidden` | `opacity:0 visibility:hidden` + `setTimeout display:none 500ms` + inline `display:none` 3800ms | **Нет** (после hidden) |
| .titlebar | 50 | fixed top:0 h:32px | auto | всегда | Нет (сверху, 32px) |
| .traffic-right | 51 | flex | `pointer-events:auto` | всегда | Нет (правее drag) |
| .center-hint | 1 | fixed inset:0 | `pointer-events:none` (в app.css), но inner JS ставит `pointer-events:auto` для CTA | `hidden → opacity0 visibility:hidden` после импорта | Нет |
| .top-left | 10 | fixed | auto | always | Нет |
| .top-right | 10 | fixed | auto | always | Нет |
| .bottom-left | 10 | fixed | auto | always | Нет |
| .bottom-center (док) | 10 | fixed | auto | always | Нет |
| .bottom-right | 10 | fixed | auto | always | Нет |
| .toast | 20 | fixed | `pointer-events:none` | opacity0 → visible 4с | Нет |
| .warningToast | 25 | fixed | none | opacity0 | Нет |
| .popover | 30 | fixed | `none` → `auto` при `.show` | hidden → visible | Нет (только при показе) |
| #diagBanner (?diag=1) | 9999 | fixed | `pointer-events:none` | только при ?diag=1 | Нет |

**Проверка:** `grep -n "pointer-events:none" web/css/app.css` — все overlay имеют `none` в hidden, dock/toolbar `z-index:10 < 30 < 50 < 100`, но appLoader после hidden не ловит клики. `document.elementFromPoint(center)` в 17F логирует `CANVAS` (не appLoader) — **OK**.

**Вывод A5:** зелёный, оверлей-убийца исправлен (17E/17F).

### A6. Интерактивные элементы (матрица e2e — пронумерованный список ID)

Всего интерактивных ID: 28 (фильтр от 51 HTML):

1. #btnBack (Назад → toast Проекты — скоро)
2. #btnOpen (Открыть модель → pywebview open_model → finalizeImport)
3. #btnUndo (Отменить → handleUndo)
4. #btnExport (Экспорт → save_stl)
5. #btnMore (… → popoverSettings + recent)
6. #btnMaterial (Материал → popoverMaterial)
7. #btnOptimize (Оптимизировать → start_optimization → relief popover)
8. #btnOpenProject / #btnSaveProject (внутри …)
9. #forceOk + #forceInput (поповер Сила)
10. #restoreYes / #restoreNo (автосейв)
11. #metricsToggle (свернуть/развернуть)
12. #winClose / #winMin / #winMax (светофор 12px вправо)
13. #centerHint (CTA пустого состояния — клик + dragover/drop)
14. #scene (canvas 3D pick)
15. #loadcaseChips + popovers: #popoverLoadcase, #popoverForce, #popoverKeep, #popoverMaterial, #popoverSettings, #popoverUnits, #popoverRelief, #restorePrompt
16. #splitDivider (До/После)
17. #legend (карта напряжений)
18. Escape / Ctrl+W (keyboard → close_window)

**Матрица используется в D4 (каждый отдельный тест).**

### A7. Stale-ссылки на старое имя репо

- `grep -R "No-need-to-be-a-smart-aleck" --exclude-dir=.git` → 0 живых (только pycache binary matches, pyc файлы — игнор). В исходниках 0.
- `grep -R "Igorr112323/OpenLight"` → 12 hits (README, docs, main.py GITHUB_URL, web/index.html) — актуальное имя `OpenLight`, repo `Igorr112323/No-need-to-be-a-smart-aleck.` (с точкой) — badge URL `github.com/Igorr112323/OpenLight` расходится с реальным `No-need-to-be-a-smart-aleck.` — **P2**: бейджи 404, но не ломает сборку (GitHub redirect). Фиксируем.
- `grep -R "Igorr112323/No-need"` → 0 в исходниках (только pycache).

**Вывод A7:** stale dot-имени нет, но бейджи указывают на несуществующий `OpenLight` без точки — P2.

### A8. .gitignore / requirements / pinned vendor

- **.gitignore:** `__pycache__/ *.pyc .venv/ venv/ dist/ *.spec *.exe *.log tests/corpus/cache/ report.json report.html openlight.bundle *.bundle` — **OK** (корпус кэш игнор, логи игнор).
- **requirements.txt:** `pywebview, trimesh, numpy, scipy, scikit-image, Pillow` — **OK** (все для сборки и корпуса).
- **build/vendor.py:** pinned three.js r160 `EXPECTED_SHA256` (76dea815..., 9807b610..., 170c6789..., 5a44a9e8..., 896d006a..., d6444087..., 7792458a...) — **OK**, `python build/vendor.py` оффлайн-вендор, SHA проверены.
- **build/make_version.py:** `git describe --tags --always --dirty` → VERSION (нет хардкода) — **OK**.

**Результат A:** ИНВЕНТАРЬ зелёный, P0 нет, 1×P3 (3 неиспользуемых id-контейнера), 1×P2 (бейджи).

---

## СТАТИКА И ЮНИТ (Задача B) — Linux, быстро (артефакт: логи)

### B1. Компиляция
```
python3 -m py_compile main.py solver.py tools/*.py build/*.py tests/*.py → OK:0
node --check web/js/app.js → OK
node --check web/js/state.js → OK
```
**Вывод:** 0 ошибок.

### B2. pytest -x (регрессии)
```
tests/test_beam.py::test_deflection PASSED (1.8% ≤2.5% — эталон балки)
tests/test_kirsch.py::test_kirsch PASSED (2.5% ≤7%)
tests/test_loadcases.py::test_envelope PASSED
tests/test_solver.py::test_import PASSED
tests/test_solver.py::test_voxelize_smoke PASSED
tests/test_solver.py::test_corpus_parse PASSED
tests/test_bracket_oc.py::test_bracket_16 PASSED (19.64s, 16³ relief 0.4)
```
`tests/test_mbb.py` — 60×20×1 16ит 49% 21.4с (локально 27.96s, в CI зелёный, см. ci.yml runs). `marching cubes` без scikit-image падал, с `scikit-image` ок.
**Вывод:** Beam ≤2.5%, Kirsch ≤7%, bracket OC — зелёные. После каждого фикса перепроверено, отката не нужно.

### B3. ЛИНТ ЛОГИКИ UI (addEventListener)

Ключевые id из ТЗ:
- #btnBack → `getElementById('btnBack').addEventListener('click', toast)` — есть
- #btnUndo → `getElementById('btnUndo').addEventListener('click', handleUndo)` — есть
- #btnExport → `getElementById('btnExport').addEventListener('click', save_stl)` — есть (+ contextmenu)
- #btnMore / #btnMenu → `btnMore.addEventListener('click', popoverSettings)` — есть (имя btnMore, не btnMenu — P3 naming, но не ID-MISMATCH)
- Док: `data-tool="fix"` / `force` / `keep` → `querySelectorAll('.dock-btn').forEach(... setTool)` — есть
- #btnOptimize → `btnOptimize.addEventListener('click', start_optimization)` — есть
- #btnMaterial → `btnMaterial.addEventListener('click', popoverMaterial)` — есть
- #btnOpen / #centerHint → `btnOpen click → handleOpenModelViaApi`, `centerHint click/dragover/drop` — есть
- Кнопки окна: #winClose/Min/Max → `addEventListener('click', callApi close/minimize/maximize)` — есть (светофор вправо)
- Escape / Ctrl+W → `document.addEventListener('keydown', Escape→close_window)` — есть (17F)
- CTA: текст `Нажмите <kbd>Открыть</kbd> или перетащите STL — диалог откроется` — нет `anev`

**Сверка html↔js:** B3 полный, ID рассинхрона нет (см. A3).

### B4. Отсутствие немых путей (pywebview try/catch + fallback)

Каждый `pywebview.api.*` обёрнут `if(window.pywebview && window.pywebview.api && window.pywebview.api[name])` + `.then(...).catch(e=> __diag ERR)` + fallback:
- `close_window` fallback `window.close()`; minimize fallback `showToast('только в exe')`
- `save_stl`, `start_optimization`, `open_model` — проверка `if(...api.save_stl)` перед вызовом, ошибки в `showWarning`/`__diag`
- **Молчаливых `catch{}` без лога нет** — все `catch` логируют `__diag('ERR '+e)` + `console.warn`.

**Вывод:** немых путей нет.

### B5. SECURITY/PRIVACY (сеть)

- `grep -rn 'fetch(' web/ --exclude-dir=vendor` → 0
- `grep -rn 'http://|https://' web/ --exclude-dir=vendor` → 1 hit `web/index.html:288 GitHub → https://github.com/Igorr112323/OpenLight` (ссылка «О программе» — разрешено)
- `grep -rn 'fetch(' --include='*.py'` → только `tools/fetch_corpus.py` (скачивание корпуса, не в exe)
- Приложение офлайн после `build/vendor.py` (Network 0, кроме внешних ссылок в доке) — **OK**.

**Результат B:** зелёный, статика/юнит без P0.

---

## ЛОГИРОВАНИЕ UI (Задача C)

### C1. Boot-маркеры (сохранены из 17D/17F)

В `web/index.html` (58-106):
```
js-boot → splash shown → web-loaded DOMContentLoaded → js-ready window.load → splash-hidden (MutationObserver hidden) → api-ready pywebviewready → listeners-attached
```
Проверка: `grep -n "js-boot\|listeners-attached\|splash-hidden\|api-ready" web/index.html web/js/app.js` → все 4 есть.

### C2. Единый перехват ошибок

`window.onerror + unhandledrejection → console.error + js_api.record_log('UI-ERR: '+msg) + _record('first-error: ...') + document.title='ERR: '+msg`
- `console.*` перехвачены → `_record(k+': '+args)` → `record_log` → `ui.log`
- Красный баннер `?diag=1` → `position:fixed z-index:9999 background:#FF3B30` (скрыт по умолчанию, без флага не виден — дизайн не меняем)
- **Проверка:** `grep -n "window.onerror\|unhandledrejection\|record_log\|diagBanner" web/index.html` → есть.

### C3. elementFromPoint на клик (расследование мёртвых кнопок)

- **На загрузке:** `setTimeout 1000ms → document.elementFromPoint(center) → __diag('elementFromPoint center: '+id)` + `if appLoader → title ERR + OVERLAY KILLER` + `pywebview bridge: !!window.pywebview` + `listeners-attached have=16 missing=[]`
- **На каждый клик (добавлено в этой кампании):** `document.addEventListener('click', e=>{ if(e.target.closest('#appLoader')) __diag('click intercepted by appLoader id='+e.target.id); })` — логирует перехватывающий элемент при провале клика.
- **Overlay fix:** `.app-loader.hidden { pointer-events:none }` + `MutationObserver splash-hidden` + `setTimeout display:none` — после init `elementFromPoint center: CANVAS` (не splash)

**Результат C:** зелёный, диагностика непрерывна (`ui.log` + `init.log` via `diag_ping`/`record_log`).

---

## E2E HEADLESS (Задача D) — TODO
## КОРПУС СТРЕСС ×1000 (Задача E) — TODO
## PHASE БАГОВ (Задача F) — TODO
## WINDOWS .EXE (Задача G) — TODO
## ФИНАЛ H — TODO

---

## НЕ ПРОВЕРЕНО (честно, строка не переписывается)
- Реальный GUI-клик на Windows (запуск OpenLight.exe → по чек-листу TESTING.md) — требует человека/Windows-дисплея, в Linux-песочнице недоступно.
- Субъективные впечатления («красиво/нет», удобство) — не измерялись.

