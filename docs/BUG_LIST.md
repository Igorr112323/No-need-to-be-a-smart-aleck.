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


## Обновление 2026-11-26 (Этап 13) — OC починка

- **P0-1 OC коллапс — закрыто Этапом 13:**
  - Удалён блок dc_pos/dc_max<1e-4 scale (корень коллапса, границы масштабировались, сырой dc нет).
  - OC Sigmund без скейлинга: l1=0 l2=1e9 eta=0.5 move=0.2 ≤50 бисекций, критерий sum(rho_new)-vol_frac*n_elem <1e-3*n_elem, passive=1 только после бисекции (n_passive логируется).
  - Fail-fast: |achieved-vol_frac|>0.01 → RuntimeError (тест падает, не коллапсирует).
  - Фильтр чувствительности: dc_grid → density_filter r_min=1.5 mode=reflect (было constant cval=0, терял 45% объёма), проверка sum diff <2%.
  - keep_connected временно отключён (return rho) до 5 зелёных MBB.
  - MBB 60×20x1 volfrac 0.5: 16 ит target 0.500 mean 0.500 achieved 0.500 dc_abs_max 1.2e-07 n_active 1266 (49%) n_comp=1 dt 21.4s n_passive 0 — **зелёный**, docs/mbb.png реальный (PIL, 600x200).
  - Кронштейн 16³ 20/40/60%: 0.8 (alu) 0.6/0.4 (steel) mean 0.600 achieved 0.600 dc_abs_max 1e-08 n_active 535 (60%)→353 (39%) watertight True dt 4.8-5s <60s — **зелёный** (16³→32³ следующий этап, 48³ не лезть).

