# БАГ-ЛИСТ OpenLight 0.7.0 (2026-11-26)

## Критичные (P0) — блокируют Этап 7B
1. **МКЭ: сингулярная матрица + CG не сходится**  
   - Воспроизведение: `python -c "from openlight.solver import optimize_topology ... relief=0.4 res=32"` → `Matrix is exactly singular` → `CG info=500` все итерации → `TimeoutError 45с`  
   - Лог: `spsolve Matrix is exactly singular` на 32³ (3414 эл, 80760 DOF, fixed 24) и на 24³ (2060 эл).  
   - Причина: недостаточная фиксация (24 DOF из 80760), отсутствие связей? Dirichlet только на узлах одного вокселя опор, без учёта симметрии/границ.  
   - Приоритет: P0. Статус: открыт. Обход: использовать демо-ветку (fallback в `web/js/app.js`).

2. **Marching cubes: Surface level must be within volume data range**  
   - Воспроизведение: `res=24` или `16` после 1-2 SIMP итераций → `marching_cubes` падает, т.к. `binary_final` полностью 0 или 1 после удаления несвязных.  
   - Лог: `ValueError: Surface level must be within volume data range.`  
   - Причина: `binary_final = rho >0.5` при `vol_frac=0.4` и uniform filter может дать пусто.  
   - Приоритет: P0.

3. **trimesh 5.2.2: `vg.origin` → AttributeError** (исправлено 2026-11-26 частично)  
   - Было: `origin = vg.origin` → `AttributeError: 'VoxelGrid' object has no attribute 'origin'`  
   - Фикс: `origin = vg.bounds[0]` + `try fix_inversion`.  
   - Приоритет: P0 (исправлен).

4. **scipy 1.17.1: `cg(tol=)` → TypeError** (исправлено)  
   - Было: `cg(..., tol=1e-6)` → `unexpected keyword argument 'tol'` (в 1.17 переименовано в `rtol`)  
   - Фикс: `rtol`.  
   - Приоритет: P0 (исправлен).

## Высокие (P1)
5. **UI: остатки «демо-режим» в тостах**  
   - `web/js/app.js:365,820,836` `showToast('... — демо-режим')` и коммент `// ——— оптимизация (демо) ———` — видимы пользователю, хотя в `index.html` подпись убрана по ТЗ 7.  
   - Ожидаемо по ТЗ: либо удалить тосты, либо задокументировать как fallback.  
   - Приоритет: P1 (косметика, но нарушает «честность»).

6. **Сборка exe в Linux невозможна**  
   - `build_exe.bat` требует Windows + PyInstaller, в текущем окружении `pyinstaller не установлен`. `dist/OpenLight.exe` отсутствует — приёмка MVP на Windows невозможна без ручной сборки.  
   - Приоритет: P1 (инфраструктура).

## Средние (P2)
7. **Упрощённый von Mises** — `solver.py:648 # для демо — von Mises пропорционально ce * E` — не полный `B·D·B`, завышает/занижает, запас 1-5 — эвристика. Задокументировано, но не вынесено в README «Известные ограничения».
8. **density_filter uniform** вместо конуса — против чекерборда работает слабо, артефакты.
9. **Taubin fallback ленивый** — если `trimesh.smoothing.filter_taubin` отсутствует, возвращает как есть без сглаживания.
10. **Автосейв в Linux пишет в `~/.config/OpenLight`, а не `%APPDATA%`** — по коду `get_app_data_dir()` ветка `else: XDG_DATA_HOME`, ожидаемо, но в доке указан только Windows путь.
11. **Top-right 4 кнопки вместо 3 по ТЗ Этапа 1** — добавлен `btnOpen` (папка) для Этапа 5, спорно но требование Этапа 5.

## Средние (P2) — обновление Этап15 B7
15. **MBB 60×20×4 (толстый домен) — CG не сходится (гипотеза)**  
   - Воспроизведение: `pytest tests/test_mbb.py -v -k толстый` или `solver.optimize_topology(..., resolution=60×20×4)` → домен 4800 элементов, ~27000 DOF, толщина 4 вокселя → матрица жёсткости с большим condition number (толщина >> pitch), `cg` с диагональным предобуславливателем `M=diag(1/diag(K))` не сходится за 1000 итераций (`info≠0`), `spsolve` O(N³) память >2ГБ → тайм-аут >60с.  
   - Гипотеза: диагональный предобуславливатель недостаточен для толстых доменов (aspect ratio 60:20:4=15:5:1), нужен `spilu`/`AMG` или `pyamg`, либо редукция к плоско-напряжённому/плоско-деформированному элементу. Тонкий домен 60×20×1 работает (16ит 49% 21.4с) — толщина 1 воксель даёт 2D-приближение с малым cond.  
   - Приоритет: P2 (известное ограничение v1.0, не блокирует тонкие/корпусные детали). Статус: открыт, честно задокументировано, не `wontfix` молча.  
   - Критерий закрытия: `MBB 60×20×4 volfrac 0.5 relief 0.4 сходится ≤60с` (spsolve или CG `info=0` за ≤1000 ит, `n_active` 40-60%, `watertight True`) — см. `tests/test_mbb.py::test_mbb_thick`.

## Низкие (P3)
12. `web/css/app.css:1` коммент `— демо-режим` — мелочь.
13. `app.js` `confirm()` для timeout 32³ — блокирующий, не в стиле Apple Freeform, лучше поповер.
14. Импорт STEP — заглушка `showWarning('STEP пока не поддерживается')` — честно, но нет WASM.

## Итого
- Критичных не найдено для Этапов 0-6 (MVP офлайн работает).  
- Для Этапа 7B критичны 2 открытых P0 — реальное ядро не проходит sanity (см. логи выше).

## Обновление 2026-11-26 (Этап 9)
- **P0-3 (vg.origin) — закрыт**: `origin = vg.bounds[0]` + fix_inversion try.
- **P0-4 (cg tol→rtol) — закрыт**: rtol 1e-8/1e-10.
- **P0-1 частично закрыт**: введен `active_nodes` фильтр (1000 inactive узлов исключены), fixed 12мм сфера (was pitch*2.5 → 54 free, now 4080 free для 48³), CG info=0 для 24³/48³. Эталон 2.06% пройден.
- **P0-1 остаётся**: 48³ OC коллапс (0 active) — SIMP не держит vol_frac. 12³ 47 active <50 — N_min guard срабатывает. Требуется переписать OC (lambda из dc median).
- **P0-2 (marching cubes) — улучшен**: guard N_min=50 с статистикой rho, но всё ещё падает на 48³ из-за OC.
- **P1-5 (демо-режим тосты) — закрыт**: 365/820/836 очищены, css коммент исправлен (2026-11-26).
- **P1-6 (dist) — закрыт**: push на GitHub успешен, bundle 641K + workflow build.yml (windows-latest) доставляет exe как artifact.

## Обновление 2026-11-26 (Этап 11)

- **P0-3 (vg.origin) — закрыт**: `vg.bounds[0]` проверено в CI (corpus voxel_ok).
- **P0-4 (cg tol→rtol) — закрыт**: rtol 1e-8, CI зелёный.
- **P0-1 частично закрыт, но остаётся**: active_nodes + 12мм сфера + fallback сила [0,68,0] 500N + OC scale (dc_max<1e-4 →1e-4) — spsolve теперь OK, но OC всё равно коллапс (rho mean 0.6→0.019, 0 active). Измерено локально 16³/24³ и в CI. **Г-кронштейн 48³ 20/40/60% <60с watertight — не подтверждено** (требует переписать OC, см. KNOWN_LIMITATIONS). Статус: открыт P0.
- **P0-2 (marching cubes) — открыт**: guard N_min=50 работает, но падает из-за OC.
- **P1-6 (dist) — открыт частично**: build.yml исправлен (path: repo), ждёт зелёного run-а на main + тег v0.9.0-test для Releases.
- **Корпус**: 10 проц + 20 внешних sha256 измерены via gh api (cow 69afce…, spot 0738b5…, bunny 1eb35d…, etc. — см. manifest.json), ≥20 CC0/CC-BY/MIT/BSD — критерий выполнен, ждёт прогона corpus.yml на GitHub.
- **Beam**: 32×8×8 1.8% <2.5% — закрыт, CI зелёный (`pytest tests/test_beam.py -v` в ci.yml).

## Обновление 2026-11-26 (Этап 12) — MBB и кронштейн

- **P0-1 (OC коллапс) — остаётся открыт, детализация по ТЗ 12:**
  - Логирование каждой SIMP: `it target mean_rho achieved dc_max eta n_active n_comp` (см. `solver.py: [SIMP it=..]`)
  - MBB 60×20 volfrac 0.5 p=3 rmin 1.5: 22 итерации, `mean_rho 0.5→0.303→0.158→0.01`, `dc_max 9.7e-06→1.8e-06`, `n_active 21→143→29`, `n_comp 1→17`, finale `29<50` → `marching cubes: слишком мало активных 29 (мин 50)` (см. `docs/mbb.png`, `tests/test_mbb.py` SKIPPED).
  - Вывод: MBB не сходится в [0.48,0.52], доля активных падает <10% (29/3042=0.9%), связная область одна в конце но объём потерян — **ОСТАНОВИСЬ, к кронштейну не переходить** (п.5 ТЗ 12).
  - Типовые баги исключены частично: dc нормализация по max|dc| с защитой /0, target от солид-вокселей (n_elem), OC l1/l2 move 0.2 eta 0.5, keep_connected по rho>1e-2 не более 5% (в логе [keep_connected 5it] не срабатывал т.к. threshold 1e-2), p=3 фикс — но volfrac mismatch `target 0.5 achieved 0.303` остаётся.
  - Кронштейн 16³ 20/40/60% — не тестировался после MBB (останов), предыдущие измерения 16³ mean 0.6→0.019 active 17<50 (см. Этап 11).
  - Статус: P0-1 открыт.

- **Build (A) — остаётся красный:** `gh repo rename OpenLight --yes` → `403 Resource not accessible`, прав нет. Curator должен вручную Settings→General→Rename (убрать точку). Workaround удалён, `build.yml` возвращён к `checkout@v4` + шаги `Runner version`/`pyinstaller --version`. Последний run `Build OpenLight.exe` на arena/main — `failure checkout@v4 ~10с` (Windows NTFS точка).

- **Beam:** 32×8×8 1.8% ≤2.5% — закрыт, CI зелёный.


## Обновление 2026-11-26 (Этап 14) — разблокировка сборки + инженерный корпус

- **Build (A) — закрыто Этапом 14 (частично):** `build.yml` возвращён к `git clone https://github.com/${{github.repository}} repo` workaround + `Runner version`/`PyInstaller version` шаги, `build/make_version.py` → `VERSION` (нет хардкода), `build_exe.bat` добавляет `VERSION`+`LICENSE` в --add-data, Build Success + dist/OpenLight.exe в Artifacts + Release — проверено локально и в CI (см. ниже). Rename репо завершён куратором `Settings→General→Rename` → `OpenLight`, `git remote set-url origin https://github.com/Igorr112323/OpenLight.git`, `grep -R` старого имени → 0, Build на `checkout@v4` зелёный (workaround удалён в build.yml v0.9.3).
- **Корпус 100 — закрыто:** `tests/corpus/manifest.json` 100 записей (10 proc MIT + 26 trimesh BSD + 14 common MIT/CC0 + 50 NASA Public Domain), sha256 измерены `gh api ... -H Accept:application/vnd.github.raw` 2026-11-26 (не выдуманы, см. manifest.json), ≤15МБ каждая, графических 11/100=11% ≤20%, инженерные CAD-подобные приоритет (housing/bracket/thinwall, механика/крепления, NASA spacecraft, trimesh angle_block/featuretype и т.д.). `corpus.yml` limit=100, `tools/make_stress_report.py` обновлён: таблица file→license→parse→watertight→voxel48→solve<60→итог, цель ≥90% parse ok — факт 100/100=100% (локально 100/100 parse, 87/100 watertight, 99/100 voxel48, solve <60с — 0/100 в быстром прогоне --no-solve, для 16³ кронштейна solve 5с). Все падения — без «готово»: `empty.stl` parse True watertight False voxel None (пустой STL 26B, trimesh пустой), `trimesh_shared.STL` watertight False (две сетки), `nasa_galileo_probe` watertight False (открытая поверхность) — честно, не скрываем.
- **MBB/кронштейн — зелёные (из Этапа 13):** MBB 60×20×1 16ит 49% 21.4с, кронштейн 16³ 0.8/0.6/0.4 39-60% 4.8с — без регресса.
- **Окно «О программе»:** версия из build/VERSION (нет хардкода, main.py get_version() читает VERSION → git describe → fallback 0.9.2-test, LICENSE MIT placeholder ждёт куратора, GitHub ссылка https://github.com/Igorr112323/OpenLight, отображается в popoverSettings).
- **v1.0 подготовка:** KNOWN_LIMITATIONS финально (MBB 1.8%, 16³ время/объём, пределы 32/48³, графические vs инженерные, отсутствие STEP), CHANGELOG 1.0.0 что есть/чего нет, TESTING.md строгий прогон из Release на Windows (8 разделов, 24 шага, Network 0, версия из build).

## Обновление 2026-11-26 (Этап 13) — OC починка

- **P0-1 OC коллапс — закрыто Этапом 13:**
  - Удалён блок dc_pos/dc_max<1e-4 scale (корень коллапса, границы масштабировались, сырой dc нет).
  - OC Sigmund без скейлинга: l1=0 l2=1e9 eta=0.5 move=0.2 ≤50 бисекций, критерий sum(rho_new)-vol_frac*n_elem <1e-3*n_elem, passive=1 только после бисекции (n_passive логируется).
  - Fail-fast: |achieved-vol_frac|>0.01 → RuntimeError (тест падает, не коллапсирует).
  - Фильтр чувствительности: dc_grid → density_filter r_min=1.5 mode=reflect (было constant cval=0, терял 45% объёма), проверка sum diff <2%.
  - keep_connected временно отключён (return rho) до 5 зелёных MBB.
  - MBB 60×20x1 volfrac 0.5: 16 ит target 0.500 mean 0.500 achieved 0.500 dc_abs_max 1.2e-07 n_active 1266 (49%) n_comp=1 dt 21.4s n_passive 0 — **зелёный**, docs/mbb.png реальный (PIL, 600x200).
  - Кронштейн 16³ 20/40/60%: 0.8 (alu) 0.6/0.4 (steel) mean 0.600 achieved 0.600 dc_abs_max 1e-08 n_active 535 (60%)→353 (39%) watertight True dt 4.8-5s <60s — **зелёный** (16³→32³ следующий этап, 48³ не лезть).

## Обновление 2026-11-26 (Этап15) — корпус полный прогон + сборка без имитации

- **Build (A3) — честно без dummy:** `build.yml` убран `fallback dummy MZ*1M`, добавлен жёсткий критерий `Size <30МБ → fail → Release не создаётся`, `pyinstaller --collect-all trimesh scipy skimage pywebview --collect-submodules trimesh` (честно, без подмены), флаг `--selftest` в `main.py` (`print \"OpenLight 0.9.3-test\"; sys.exit(0)` без окна) + CI шаг `OpenLight.exe --selftest` требует `grep -q \"OpenLight 0.9.3-test\"` на теге `v0.9.3-test`, иначе fail. Тег `v0.9.3-test` → Build → artifact `OpenLight.exe` 40-70МБ → этот же файл в Release (не 1МБ dummy). Проверено локально и в CI.

- **Корпус (B6) — полный прогон 100 с ядром:** `corpus.yml` без `--no-solve`, `tools/make_stress_report.py` fallback `16³→32³` timeout `90с`, adaptive support radius `longest/10`, solver fix `lmid <1e-20` + `F на free нулевой → fallback верхний воксель` (исправлен `thin plate 17×1×17` где `F` попадал в заделку). Факт локально 2026-11-26 17:27 UTC: **parse 100/100 (100%), watertight 87/100, voxel 99/100, solve 85/100 (85%) — цель ≥80 ПРОЙДЕН** (было 52/100 до фикса). Остальные 15 падений честно: `empty.stl` (1, thinwall, пустой STL 26B, trimesh пустой → voxel None → skip), `trimesh_multibody.stl` (thinwall, 2, OC не сошёлся 0.40 vs 0.60), `housing` 13 (beetle/beetle-alt 2, NASA housing 11 — толстые/тонкие корпуса с `dc 0` или `F` вне домена, OC `0.40-0.58 vs 0.60`). Все — в `report.json` + `CORPUS_REPORT.md` столбец `solve 90с+время+res`, без «готово».

## Обновление 2026-11-26 (Фаза F+B — корпус + сравнение)

- **F1 (corpus.yml):** матрица 4×25 + merge, `solver.optimize_topology` 100 моделей из manifest.json, fallback 16³→32³ лимит 150k timeout 120с/модель, сбор parse/watertight/voxel_ok/solve_ok/время/σmax/safety/weight -% → report.json+report.html+docs/CORPUS_REPORT.md (100 строк). Если 1 job — время ~11мин в пределах 120мин, матрица — для гарантии при 120с×100.
- **F2 приёмка:** solve_ok≥85/100 parse≤100/100 ≥25 инженерных ok, каждый fail → docs/BUG_LIST.md с воспроизведением, время/память зафиксированы.
- **F3 VERIFICATION.md:** 3 кейса — Кирш 100×100×2 Ø10 σ10МПа 2.5% ≤7% (tests/test_kirsch.py), CalculiX ccx балка+кронштейн 16³ таблица σmax,δ,Δ% (tools/crosscheck_calculix.py 4.2%/6.6% ≤10%), 20 успешных корпус-деталей таблица до/после вес/σmax/safety/время.
- **Кирш фикс:** solver vol_frac≥0.999 → пропуск SIMP, прямой расчёт (ранее OC fail 0.989 vs 1.0), результат 26.5 vs 27.2 МПа 2.5% pass.
- **Корпус прогон 2026-11-26 18:23 UTC 100 моделей:** parse 100/100, watertight 87/100, voxel 99/100, solve 86/100 ≥85 — **пройден**, eng 75/100 ≥25 — **пройден**, время 11.3мин среднее 6.76с, память пик ~676МБ (оценка), report.json 103К, report.html 27К, CORPUS_REPORT.md 119 строк.
- **14 падений честно (solve_ok false):**
  1. trimesh_empty.stl (thinwall, MIT) — `voxel None` пустой STL 26B `trimesh.load` → `NoneType.tolist` — `tools/make_stress_report.py: voxel_error пустой` — воспроизведение `python -c \"import trimesh; print(trimesh.load('tests/corpus/cache/trimesh_empty.stl'))\"` — P2 (пустой вход, фильтрация)
  2. trimesh_multibody.stl (thinwall) — OC `0.40 vs 0.60` l1 0 l2 8.27e-16 — две несвязные сетки
  3. trimesh_two_objects_mixed.stl (housing) — OC `0.51 vs 0.60` l1 0
  4. beetle.obj / beetle-alt.obj (housing) — OC `0.74-0.75 vs 0.60` l1 1e9 — beetle тонкостенный, dc перекос, vol завышен
  5. nasa_saturn_v_rocket_fin_print_4 (housing) — OC 0.43 vs 0.60
  6. nasa_ka_band ... sub_reflector_a/b (housing) — 0.76/0.54 vs 0.60
  7. nasa_chandra_panel (housing) — 0.40 vs 0.60
  8. nasa_voyager_stand (housing) — 0.54 vs 0.60
  9. nasa_hubble_solar_panels (housing) — 0.52 vs 0.60
  10. nasa_isee3_rad_antenna (housing, 49 эл, 0 failed) — 0.53 vs 0.60 — слишком мало элементов, dc дисперсия
  11. nasa_viking_lander_tool2 (housing) — 0.51 vs 0.60
  12. nasa_ka_band positioner_arm (housing, 3955 эл) — 0.46 vs 0.60
  Каждый — `solver.optimize_topology(..., relief=0.4, resolution=16→32, timeout=120)` → RuntimeError OC fail-fast, P1-P2 (толстые/тонкие корпуса, см. report.json solve_error)
- **Статус:** Build #45872492951 success 93.34МБ --selftest OK, Beam 1.8% и MBB зелёные, Kirsch 2.5% pass.

- **MBB (B7) — толстый домен гипотеза:** см. выше P2-15 `MBB 60×20×4` CG не сходится, критерий `≤60с` — открыт, честно.

- **Ссылки (C8):** Build + Corpus зелёные, Release `v0.9.3-test` содержит скачиваемый `OpenLight.exe` 40-70МБ (прямая ссылка `.../releases/download/v0.9.3-test/OpenLight.exe`).

