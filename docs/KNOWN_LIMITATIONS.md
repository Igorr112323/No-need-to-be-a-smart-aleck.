# Известные ограничения OpenLight v0.9 (Этап 11, 2026-11-26)

## Ядро (Этап 7B/9/11 — измерения)

- **Эталон балки**: 32×8×8, L=100мм, F=1000N, E=200ГПа, pitch=3.125мм, DOF 7776, spsolve 0.36с, теория δ=0.0512мм, расчёт -0.0521мм, **ошибка 1.8%** (ранее 2.06% на аналогичной сетке, критерий ≤2% — пройден, CI `tests/test_beam.py` зелёный). Повторяемо: `python /tmp/beam_32.py`.
- **Г-кронштейн 16³** (895 solid, pitch 4.875мм, free 4494 DOF): fallback нагрузка 500N в [0,68,0] (конец полки), spsolve 4494 DOF OK, но SIMP OC коллапс — rho mean 0.6→0.4→0.019, active <50, marching cubes guard срабатывает, watertight не достигается. Измерено 2026-11-26 локально и в CI (см. BUG_LIST P0-1). Fallback на 12³/24³/32³ даёт ту же картину — 0 active.
- **Г-кронштейн 24³/32³/48³**: не подтверждается — 20/40/60% не завершаются <60с с watertight True (см. BUG_LIST). Требуется переписать OC (λ из медианы dc, нормировка E).
- **von Mises**: приближённо √CE·E/vol, safety clamped 1–5, стресс в центре часто 0 — эвристика, не полный B·D·B.
- **Фильтр**: uniform_filter (не конус), чекерборд слабо подавляется. Taubin ленивый fallback.
- **Тайм-аут**: 45с → предложение 32³, но и 32³ коллапс — не помогает.

## Сборка

- Windows 10/11 x64 WebView2, PyInstaller --onefile. В Linux только `python main.py` (окно требует pywebview). CI: build.yml windows-latest с `path: repo` (обход точки в имени репо на NTFS).

## Форматы

- STL/OBJ реально (STLLoader, trimesh), STEP — заглушка `STEP пока не поддерживается`.

## Корпус

- 30 моделей: 10 процедурных `origin=openlight-proc` (генерируются via trimesh в CI) + 20 внешних raw.githubusercontent.com (10 alec jacobson common-3d-test-models MIT/CC0 + 10 trimesh/models BSD), sha256 измерены через `gh api` 2026-11-26 (см. `tests/corpus/manifest.json` + `LICENSES.md`), ≤15МБ. Файлы не коммитим, кэш `tests/corpus/cache/` в .gitignore, доставка — `corpus.yml` на GitHub.

## Офлайн

- Полностью офлайн после `python build/vendor.py` (three.min.js локально). Network 0, кроме кнопки проверки Releases.

