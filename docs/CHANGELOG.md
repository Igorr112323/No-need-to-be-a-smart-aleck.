# CHANGELOG — OpenLight

## [1.0.0] - 2026-11-26 — v1.0 подготовка (Этап 14)

**Что есть:**
- Ядро: МКЭ hex8 2×2×2 Gauss, spsolve/CG, SIMP 15-25 OC Sigmund l1=0 l2=1e9 eta0.5 move0.2 ≤80 бисекций, density_filter reflect r1.5 <2%, keep_connected (отключён до 5 зелёных MBB), Taubin — эталон балки 1.8% (≤2% зелёный), MBB 60×20×1 16ит 49% 21.4с watertight, кронштейн 16³ 20/40/60% 535→353 <60с watertight.
- Сценарий: Freeform дизайн (1400×900, dot-grid 24px, #F9F9FB), вращения/зум/панорама, маркеры опоры/силы/запретной зоны, материал сталь/alu/PLA + ЧПУ/3D-печать, оптимизация с честным прогрессом (вокселизация 5% → SIMP 15-85% → Marching 88% → Taubin 93% → Готово), виды Исходная/Карта напряжений/Облегчённая/До-После, экспорт STL, демо-ветка для браузера.
- Проекты/автосейв: `.olight.json` Ctrl+S/O, `%APPDATA%\OpenLight\autosave.olight.json` debounce 800мс, 7 дней, последние 5, restore prompt.
- Бесплатно: полностью бесплатно, без подписок/ключей/триалов, Network 0 после vendor.py, `dist/OpenLight.exe` <60МБ (факт 45-55МБ), Windows 10/11 x64 WebView2.
- Корпус: 100 моделей (10 proc + 90 external NASA/trimesh/common MIT/CC0/Public Domain/BSD, sha256 измерены, ≤15МБ, ≤20% графики факт 11% ≤20%, ≥90% parse).
- Сборка: Build Success + dist/OpenLight.exe в Artifacts + Release (тег `v0.9.2-test` → Release, размер зафиксирован в docs/CORPUS_REPORT.md), `VERSION` из build (нет хардкода), окно «О программе» версия+лицензия+GitHub, кнопка «Скачать OpenLight.exe» → Releases, чек-лист релиза.

**Чего нет (v1.0, планируется в v1.1):**
- STEP (только STL/OBJ, STEP — заглушка `STEP пока не поддерживается`).
- 32³/48³ стабильно (<60с) — 16³ зелёный, 32³ экспериментально, 48³ не лезть (требует CG предобуславливатель + OC итеративный).
- Тонкие толщины MBB 60×20×4 (nz=5) — OC fail-fast на толстом домене (только тонкий 60×20×1 в v1.0).
- Конус-фильтр vs uniform_filter (чекерборд слабо подавляется).
- Полный B·D·B von Mises (сейчас эвристика √CE·E/vol).
- Выбор лицензии куратором (сейчас MIT placeholder, окно «О программе» ждёт выбора).

## [0.9.2] - 2026-11-26 — Этап 14: разблокировка сборки + инженерный корпус (текущий)

- Корпус: 100 записей (10 proc + 26 trimesh BSD + 14 common MIT/CC0 + 50 NASA Public Domain), sha256 via gh api raw, graphics 11% ≤20%, engineering приоритет (housing/bracket/thinwall), `corpus.yml` limit=100 report.json/html + docs/CORPUS_REPORT.md таблица file→license→parse→watertight→voxel48→solve<60→итог, цель ≥90% parse ok.
- Build: fix checkout dot via `git clone https://github.com/${{github.repository}} repo` + Runner/PyInstaller version steps, Build Success + dist/OpenLight.exe в Artifacts + Release, размер <60МБ, `build/make_version.py` → VERSION, `build_exe.bat` добавляет VERSION+LICENSE, окно «О программе» версия из build + лицензия + GitHub.
- Доки: README кнопка «Скачать OpenLight.exe» → Releases + чек-лист релиза, KNOWN_LIMITATIONS финально (MBB 1.8%, 16³ время/объём, пределы 32/48³, графические vs инженерные, отсутствие STEP), TESTING.md строгий прогон из Release на Windows, CHANGELOG v1.0.0 что есть/чего нет.
- Ядро: MBB 60×20×1 16ит 49% 21.4с зелёный, кронштейн 16³ 0.8(alu)/0.6/0.4(steel) 39-60% 4.8с зелёный — без изменений от Этапа 13.

## [0.9.1] - 2026-11-26 — Etap 11: реальный корпус + ворота
- Корпус: 30 записей (10 proc + 20 external raw, sha256 via gh api, origin поле)
- Build: fix checkout path: repo (Windows точка в имени), corpus fetch --limit 30 sha256-check
- Ядро: fallback сила [0,68,0] 500N, OC scale dc<1e-4→1e-4, beam 32×8×8 1.8% CI ≤2.5%

## [0.9.0] - 2026-11-26 — Etap 9/10 : GitHub-центричный
- CI: ci.yml (ubuntu) + build.yml (windows) + corpus.yml (weekly)
- Ядро: active_nodes, 12мм опора, rtol, эталон балки 2.06%

## [0.7.0] - 2026-11-26 — Etap 7B real core (частично)
- voxel 64³, hex FEM C3x3 spsolve/CG, SIMP 15-25, marching+Taubin, von Mises

## [0.6.0] - 2026-11-26 — Etap 6 vendor+exe
- vendor r160 SHA256, make_icon, build_exe.bat

## [0.5.0] — Etap 5 pywebview api
## [0.4.0] — Etap 4 demo-оптимизация
## [0.3.0] — Etap 3 markers
## [0.2.0] — Etap 2 3D scene
## [0.1.0] — Etap 1 Freeform shell
