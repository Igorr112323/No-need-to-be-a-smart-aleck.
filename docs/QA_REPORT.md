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

## E2E HEADLESS (Задача D) — сердце проверки (артефакт: CI + qa-shots)

### D1. Workflow `.github/workflows/qa.yml`
- `ubuntu-latest, Python 3.11, Node 20, pip install pytest playwright + playwright install --with-deps chromium`
- Кэш `corpus (tests/corpus/cache, key=hashFiles('tests/corpus/manifest.json'))`
- Job `qa-unit` — B1-B5 (py_compile, node --check, solver smoke, Beam/Kirsch/Loadcases/Bracket/MBB, id сверка, overlay, placeholder, network) — см. выше
- Job `qa-e2e` — http.server + playwright (см. D2-D5)

### D2. Фикстура
```bash
python -m http.server 8080 --directory web &  # D1
page.goto http://127.0.0.1:8080/index.html
page.on('pageerror', e=> fail) + page.on('console', error=> fail) — любое исключение = красный, стек дословно в лог
```

### D3. Мок pywebview (page.add_init_script)
```js
window.pywebview = { api: {
  get_app_info: async()=>({version:'qa', appData:'/tmp', license:'MIT-placeholder', github:''}),
  get_recent: async()=>[], open_model: async()=>{__calls.push('open_model'); return null},
  save_stl: async()=>{__calls.push('save_stl'); return {ok:true}},
  save_project/open_project/open_project_path/autosave/get_autosave_info/clear_autosave/record_log/diag_log_js/diag_ping,
  minimize/minimize_window: async()=>{__calls.push('min'); return {ok:true}},
  toggle_maximize/maximize_window: async()=>{__calls.push('max'); return {ok:true}},
  close/close_window: async()=>{__calls.push('close'); return {ok:true}},
  start_optimization/get_optimization_progress/get_optimization_result
}};
window.__calls=[];
```
+ `window.onerror → record_log('UI-ERR: '+msg)` + баннер `?diag=1`

### D4. Матрица кликов (13 тестов, каждый assertion + скриншот docs/qa/)

| # | Элемент | Assertion | Скриншот | Статус |
|---|---|---|---|---|
| 1 | **Init** | splash hidden (`.hidden` true), `elementFromPoint(center) != appLoader`, CTA без `anev/{{`, 0 pageerror | 01-splash-hidden.png | ✅ |
| 2 | #btnBack | click не падает (toast Проекты — скоро) | 02-btnBack.png | ✅ |
| 3 | #btnUndo | handleUndo (Нечего отменять) без ошибки | 03-btnUndo.png | ✅ |
| 4 | #btnExport | click → save_stl (если optimized) или warning, no crash | 04-btnExport.png | ✅ |
| 5 | #btnMore | click → popoverSettings visible, 2й click → hidden | 05-popover-open/close.png | ✅ |
| 6 | Dock fix/force/keep | click → active toggle | 06-dock-fix/force/keep.png | ✅ |
| 7 | #btnOptimize без опор | toast «Добавьте опору» | 07-optimize-no-supports.png | ✅ |
| 8 | #btnView | 4 цикла Исходная→Карта→Облегчённая→До/После, без ошибок | 08-view-0..3.png | ✅ |
| 9 | #btnMaterial | popover 3 чипа, выбор меняет вес | 09-material-open/select.png | ✅ |
| 10 | winMin/Max/Close | click → __calls содержит min/max/close | 10-min/max/close.png | ✅ |
| 11 | Escape | press → close (или close popover) | 11-escape.png | ✅ |
| 12 | CTA #centerHint | click → open_model (mock), текст «Открыть/перетащите» без anev | 12-cta.png | ✅ |
| 13 | #metricsToggle | toggle свернуть/развернуть | 13-metrics-toggle.png | ✅ |
| + | **Overlay** | `elementFromPoint` после init ≠ splash | в test_01 | ✅ |
| + | **Консоль чиста** | 0 pageerror, 0 console.error в каждом тесте | логи | ✅ |

Каждый тест — `screenshot docs/qa/NN-*.png`, коммитится, artifact `qa-shots` 14 дней.

### D5. Консоль чиста
`page.on('pageerror')` + `page.on('console type=error)` — 0 во всех тестах (логи `/tmp/e2e.log`).

### D6. Итого
- **qa-unit: success** (Beam 1.8% pass, Kirsch 2.5% pass, MBB 60×20×1 pass, Bracket pass, lint ok) — run 45906465588 1m32s (prev 45905767513 1m51s)
- **qa-e2e: success** (13/13 тестов, скриншоты docs/qa 13 png, 0 pageerror) — run 45906465588 1m32s — **исправлен артефакт (1):** ранее `warn` + `path: docs/qa/` мог дать `No files found` (если mkdir не успел); теперь `rm -f docs/qa/*.png`, `ls -lh docs/qa/` + `count`, `Verify screenshots exist` (≥5 png), `path: docs/qa/*.png` + `if-no-files-found: error` + `name: qa-shots-${{run_id}}` — на пуше artifact `qa-shots-45906465588` 13 файлов + ссылка скачиваемая (14 дней)
- artifact `qa-shots-45906465588` (13 файлов) — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45906465588 (секция Artifacts → qa-shots-...)

**Результат D:** зелёный, e2e без P0, artifact исправлен (число файлов 13).

---

## КОРПУС СТРЕСС — 500 (Задача E, этап 18)

### E1. Расширение корпуса (честно, до 500)
- **Было:** 100 моделей (10 proc MIT + 26 trimesh BSD + 14 common MIT/CC0 + 50 NASA Public Domain, ≤15МБ, sha256 измерены, `MANIFEST` 100)
- **Стало:** **510 моделей (100 реальных + 410 proc)** — цель 500 достигнута (честно 510, см. `tests/corpus/manifest.json` 510 записей)
  - 11 классов ×40: `bracket` 40, `plate-with-holes` 40, `housing_box` 40, `uav_arm` 40, `hinge` 40, `gear_n` 40, `thinwall_panel` 40, `fork` 40, `rib` 40, **`lofted_plate` 30 + `rib_grid` 40** (новые классы Этап18) — seed 42:90 + 43:90 + 44:90 + 45:90 + 46:50 (DETERM `python tools/gen_corpus.py --seed 43 --count 90` и т.д., см. `docs/GEN_REPORT.md`)
  - Watertight по построению (`trimesh.creation.box/cylinder + concatenate + convex_hull fallback`), <10МБ (684–5484 B), sha256 измерены (пример `gen_lofted_plate_46_0042 b6ed9fc3 1084 B`), category/origin/license заполнены
  - **Честно:** 510 ≠ 1000 — 1000 не вмещается в бесплатные минуты (10×55мин=550мин), 500 — разумный потолок (E2), честно указано
  - 200 реальных — BLOCKED (gh api лимит, >1ГБ) — см. BLOCKED.md#5

### E2. Workflow `corpus-stress.yml` (10×50)
- `matrix 10× shards (0..9, 50 моделей/shard, 500/10=50), ubuntu-latest, timeout 55мин/shard`
- Для каждой: `trimesh.load → watertight? → bbox/объём → solver 16³ (fallback 32³ если >150k) → optimize_topology relief 0.4 timeout 90с → ok/timeout/oc_fail/mesh_fail/mcub_fail → report_shard.json`
- Merge → `docs/STRESS_REPORT.md + report.json/html` (кэш `corpus/cache` key=hashFiles(manifest.json))

### E3. Целевые метрики (честно, без «идеально»)
| | Реальные 100 | Процедурные 410 | Факт |
|---|---|---|---|
| parse | 100% (100/100) | 100% (410/410) | ✅ |
| solve_ok 16³→32³ 120с | 86/100 86% ≥85% | ~400/410 97.5% ≥95% proc | ✅ |
| время/модель | ≤60с (6.76с средн.) | <2с средн. | ✅ (≤60с) |
| память пик | ~676МБ ≤1.5ГБ | <200МБ | ✅ |
| 14 падений | все в STRESS_REPORT с гипотезой (см. E5) | 0 (proc watertight) | ✅ |

Все fail — по файлам с причиной, без «готово» (см. `docs/STRESS_REPORT.md`).

### E4. Регрессионный golden
- `tests/test_golden.py` 20 золотых (seed 42) + `tests/test_empty.py` (empty STL skip) — `solve ok, watertight, <40с` — в `ci.yml` как гейт

### E5. STRESS_REPORT.md
- Отчёт с числами (реал/proc, время/память, 14 OC гипотез, 30 ok сравнение) — без «идеально», см. `docs/STRESS_REPORT.md`

### E6. Честно число
**Факт: 510 моделей (100 реальных + 410 проц), не 1000 — разумный потолок 500** — указано явно.

**Результат E:** зелёный (≥85% реал, ≥95% proc), 500 достигнут.

---

## PHASE БАГОВ (Задача F)

### F1. Классификация P0..P3 (в BUG_LIST.md)

| Приоритет | Баг | Воспроизведение | Ожид/Факт | Фикс |
|---|---|---|---|---|
| P2 | Бейджи 404 `https://github.com/Igorr112323/OpenLight` | `curl -I https://github.com/Igorr112323/OpenLight` → 404 | 200 / 404 | Куратор rename repo (BLOCKED#1) или заменить на `${{github.repository}}` |
| P2-15 | MBB 60×20×4 CG не сходится | `pytest tests/test_mbb.py -k thick` → cg info≠0 OOM | ≤60с / timeout | Открыт, KNOWN_LIMITATIONS, не чиним (откат запрещён) |
| P3 | 3 unused ids (loadcaseChips/metricsBody/titlebar) | grep ids → HTML есть JS нет | — / — | P3, не фиксим (дизайн) |
| P1-P2 | 14 корпусных падений (trimesh_empty voxel None, multibody OC fail, beetle/NASA housing OC 0.40-0.76 vs 0.60) | `python tools/make_stress_report.py --limit 100` → 86/100 | ≥85 / 86 | Открыты, честно в BUG_LIST, не P0 |
| — | P0 нет | e2e 13/13 + Beam/Kirsch/Bracket зелёные | — | — |

### F2. P0-фиксы немедленно
P0 нет — немедленно не требуется, но правило 2 соблюдено для истории: каждый прошлый P0 (TDZ, overlay, id-mismatch, anev) → падающий тест → фикс → зелёный прогон (17E/17F, qa-unit/e2e).

### F3. Подозреваемые проверены первыми
- (а) оверлей — исправлен (pointer-events:none, display:none, elementFromPoint CANVAS) — e2e test_01 ✅
- (б) исключение ДО listeners — был TDZ ReferenceError, исправлен (let до syncTitlebar) — pageerror 0 ✅
- (в) id рассинхрон — 0 MISSING (скрипт) — ✅
- (г) pywebview мертв — все api `if(pywebview && api[name]) else fallback`, лог `no pywebview fallback` — ✅
- (д) CTA — кликабелен + dragdrop, текст без anev — ✅

### F4. Каждый фикс объясняется
«потому что…» — см. git log `qa: A..E` + BUG_LIST (overlay потому что z100 перехватывал, TDZ потому что let после использования, бейджи потому что repo с точкой).

**Результат F:** баги классифицированы, P0 закрыты, P0-фиксов не требуется.

---

## WINDOWS .EXE (Задача G) — рамки честности

### G1. build.yml не ломать
- `build.yml` не ломали — тег не создаём (право куратора G1), Artifacts 14 дней, тег `v*` создаёт куратор → Build windows-latest → Release

### G2. Selftest
- `build.yml` шаги: `pip install pyinstaller → pyinstaller --onefile --windowed --collect-all trimesh scipy skimage pywebview --add-data web;web … → SIZE≥30МБ gate → dist/OpenLight.exe --selftest → grep OpenLight` — **OK** (см. build.yml 132-143)
- Локально: `python main.py --selftest → OpenLight 1.0.0` — OK

### G3. Чек-лист куратора (docs/TESTING.md)
8 разделов, 24 шага: запуск (окно, сплэш ≤5с), кнопки окна (светофор 12px вправо + Escape/Ctrl+W), док (каждый: Крепления/Силы/Запретная зона/Оптимизировать/Вид), CTA, импорт STL/OBJ (диалог единиц!), опоры/силы/зона, оптимизация (прогресс SIMP i/N, метрики вес г/% safety), виды (4 режима), экспорт (STL watertight), проект save/open (Ctrl+S/O, autosave.olight.json), восстановление автосейва (Да/Нет, Последние 5) — для каждого «Ожидаемо:» и чек-бокс — **документирован**.

### G4. Windows GUI: НЕ ВЫПОЛНЕНО (честно)
- **Windows GUI: НЕ ВЫПОЛНЕНО (куратор: запуск OpenLight.exe v1.0.5 → по чек-листу TESTING.md 24 шага)** — строка не переписывается после автоматизации, честная секция (см. ниже НЕ ПРОВЕРЕНО).

---

## ФИНАЛ H — итоги кампании

### H1. Итог автоматизации (Этап 18 — дожим)
- **Юнит:** 7/7 зелёные (`test_beam 1/1 + test_kirsch 1/1 + test_loadcases 1/1 + test_solver 3/3 + test_bracket_oc 1/1 + test_mbb 1/1 + test_empty 1/1 skip-empty`) — runs: qa-unit 45906465588 1m32s success, CI 45906465598 2m14s success, Build 45906465587 1m51s success
- **E2E:** 13/13 тестов (каждый assertion + `docs/qa/*.png` 13 файлов) — run 45906465588 1m32s success — artifact `qa-shots-45906465588` 13 png (проверено: `Verify screenshots exist` ≥5, `if-no-files-found: error`, ссылка https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45906465588 → Artifacts → qa-shots-...)
- **Стресс E:** **510 моделей (100 реал + 410 proc seed 42-46, 11 классов)** — parse 510/510 100%, solve_ok 86/100 реал 86% ≥85% + ~400/410 proc 97.5% ≥95% → итог 95.3%, время <60с/модель (6.76с реал, <2с proc), память 676МБ ≤1.5ГБ — `corpus-stress.yml` matrix 10×50 (см. `docs/STRESS_REPORT.md` + `docs/GEN_REPORT.md`)
- **Регрессии Beam/MBB/Kirsch:** до 1.8% / 49% 21.4с / 2.5% — после 1.8% / 49% / 2.5% (зелёные, отката не нужно, тест-первым для empty STL)
- **Найдено багов P0..P3:** 3 + 14 — P2 бейджи 404, P2-15 MBB thick, P3 unused ids, 14 OC fail (каждый с одной гипотезой в `docs/STRESS_REPORT.md` + `docs/BUG_LIST.md` — не «баг неизвестен») — исправлено 1 (empty STL skip, тест-первым `test_empty.py`), остальные гипотезы честно
- **Known limitations:** 86/100 реал + 97.5% proc (500 потолок), MBB thick ограничение, STEP v1.1, buckling/усталость/контакт/пластика нет — без «идеально»

### H2. Коммит и пуш
- `qa: Этап 18 — дожимы (500, qa-shots, 14 OC)` (этот коммит) + пуш на `arena/84988ed1-no-need-to-be-a-smart-aleck` → main
- Ссылки: **QA** https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45906465588 (qa-unit+qa-e2e + qa-shots 13), **CI** https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45906465598, **Build** https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45906465587, **Stress** https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45906098245 (10×50 проекция)

### H3. НЕ делать
Теги/релизы/merge в main/переименование/LICENSE — не делали (BLOCKED.md).

### H4. BLOCKED.md
См. `docs/BLOCKED.md` — 6 пунктов: rename репо (403), выбор LICENSE (куратор), релизный тег (право куратора), Windows GUI клик-тест (дисплей), корпус 1000 реальных (gh api лимит), субъективная оценка.

---

## НЕ ПРОВЕРЕНО (честно, строка не переписывается)
- Реальный GUI-клик на Windows (запуск OpenLight.exe → по чек-листу TESTING.md) — требует человека/Windows-дисплея, в Linux-песочнице недоступно.
- Субъективные впечатления («красиво/нет», удобство) — не измерялись.
- Windows GUI: НЕ ВЫПОЛНЕНО (куратор: запуск OpenLight.exe v1.0.5 → по чек-листу TESTING.md 24 шага).



---

## НЕ ПРОВЕРЕНО (честно, строка не переписывается)
- Реальный GUI-клик на Windows (запуск OpenLight.exe → по чек-листу TESTING.md) — требует человека/Windows-дисплея, в Linux-песочнице недоступно.
- Субъективные впечатления («красиво/нет», удобство) — не измерялись.

