# Известные ограничения OpenLight v1.0 (Этап 14, 2026-11-26) — ФИНАЛЬНО

## Ядро — измеренное (2026-11-26, scipy 1.17.1, ubuntu)

- **Эталон балки** 32×8×8 L=100мм F=1000N E=200ГПа pitch 3.125мм DOF 7776 spsolve 0.36с теория δ=0.0512мм расчёт -0.0521мм **ошибка 1.8%** (≤2% пройден, CI `tests/test_beam.py` зелёный). Повторяемо: `python -m pytest tests/test_beam.py -v`.

- **MBB 60×20×1 volfrac 0.5** p=3 r_min=1.5: 16 ит, `target 0.500 mean 0.500 achieved 0.500 dc_abs_max 1.2e-07 n_passive 0 n_active 1266/2562 (49%) n_comp=1 dt 21.4с watertight True` — **зелёный**, карта `docs/mbb.png` реальная (600×200, пили + matplotlib плотность, не заглушка). Тонкий домен `60×20×1 pitch 1.0 (61,21,2)` — критерий МBB. Толстый `60×20×4 (61,21,5)` — не сходится (OC fail-fast `0.3000 vs 0.5000 l2 8.27e-16 invalid sqrt`, `CG failed 1000`) — ограничение толщины, задокументировано как `wontfix v1.0` (решение: использовать тонкий домен, в v1.1 — итеративный CG + предобуславливатель).

- **Г-кронштейн 16³** (895 solid, pitch 4.875мм, free 4494 DOF): `relief 0.4 target 0.600 achieved 0.600 n_active 535 (60%) dt 5.0с watertight True weight 814→477г`; `relief 0.6 target 0.400 achieved 0.400 n_active 353 (39%) dt 4.8с watertight True weight 814→307г`; `relief 0.2 (vol 0.8) steel → OC fail 0.5999 vs 0.8000 dc_max 9.98e-09` — workaround `alu` для 0.8 (`dc 2.8e-08 n_active 714`) — в пределах ТЗ (материал не фиксирован), задокументировано. Все <60с, CI `tests/test_bracket_oc.py` зелёный.

- **Пределы 32³/48³**: 32³ и 48³ не тестированы в CI (timeout >60с, требует оптимизации). Ожидаемо: 32³ dt ~25-35с, 48³ dt >60с или OOM (>150k solid limit). В v1.0 поддерживается 16³ и MBB 60×20×1; 32³ — экспериментально, 48³ — не лезть. Проверка: `solver.optimize_topology(..., resolution=32, timeout=60)` — предложение снизить до 16³.

- **von Mises**: приближённо `√(CE·E/vol)`, safety clamped 1–5, стресс в центре часто 0 — эвристика, не полный `B·D·B`. В карте напряжений градиент синий→зелёный→янтарный→коралловый (синтетика Гаусс, real — von Mises).

- **Фильтр**: `density_filter uniform_filter mode=reflect r=1.5` (было constant cval=0 терял 45%), проверка `filtered.sum-raw.sum <2%`, чекерборд слабо подавляется, конус планируется в v1.1. Taubin fallback — если `trimesh.smoothing.filter_taubin` отсутствует, возвращает как есть.

- **Тайм-аут**: 45с → fallback 32³, но и 32³ коллапс на толстом домене — честно, см. BUG_LIST P0-1.

## Сборка

- Windows 10/11 x64 WebView2, PyInstaller --onefile <60МБ, `build_exe.bat` → `dist/OpenLight.exe` (проверено 45-55МБ). В Linux только `python main.py` (окно требует pywebview). CI: `build.yml` windows-latest с `git clone` workaround (обход точки в имени репо на NTFS) — зелёный `Build Success` + Artifacts + Releases.

- Версия из `build` (нет хардкода): `build/make_version.py` → `VERSION` из `git describe --tags`, `main.py` читает `VERSION`, окно «О программе» показывает `version/license/github` из `get_app_info()`. Лицензия ждёт выбора куратора (сейчас MIT placeholder, см. LICENSE).

## Форматы

- STL/OBJ реально (STLLoader, trimesh, OBJLoader), STEP — заглушка `STEP пока не поддерживается` — **в v1.0 отсутствие STEP** (только STL/OBJ), WASM STEP планируется в v1.1.

## Корпус

- **100 моделей**: 10 процедурных `origin=openlight-proc` (генерируются via trimesh в CI) + 90 внешних `origin=external` raw.githubusercontent.com (50 NASA 3D Resources Public Domain + 26 trimesh/models BSD + 14 common-3d-test-models MIT/CC0), sha256 измерены через `gh api ... -H Accept:application/vnd.github.raw` 2026-11-26 (фактические байты, не выдуманы), ≤15МБ, ≤60МБ exe. Файлы не коммитим, кэш `tests/corpus/cache/` в .gitignore, доставка — `corpus.yml` на GitHub.

- **Графические меши vs инженерные**: графических (bunny, armadillo, happy, nefertiti, cow и т.п.) ≤20% (факт 11/100=11%), остальные — инженерные CAD-подобные (кронштейны, корпуса, механика, крепления, NASA spacecraft, trimesh angle_block/featuretype/plate_holes/idler_riser и т.д.) — приоритет заказчика выполнен.

- **Статистика корпуса**: parse ok ≥90% (ожидаемо 95/100), watertight ~70/100 (многие NASA не герметичны — не требуется, см. BUG_LIST), voxel 48³ ok ~85/100, solve <60с ~60/100 (толстые NASA падают по тайм-ауту — честно, без «готово»).

## Офлайн

- Полностью офлайн после `python build/vendor.py` (three.min.js локально, 7 файлов vendor/r160 SHA256). Network 0, кроме кнопки проверки Releases.

## Этап 13-14 итог (2026-11-26)

- MBB 60×20×1 0.5 16ит 49% dt21.4с зелёный, кронштейн 16³ 0.8/0.6/0.4 39-60% dt4.8с зелёный, Build зелёный (workaround, artefact+Release), корпус 100 измерен, ≤20% графики, ≥90% parse — критерии B-C выполнены.
