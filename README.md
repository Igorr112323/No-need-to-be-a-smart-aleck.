# OpenLight — бесплатный Windows .exe для умного облегчения 3D-деталей

[![CI](https://github.com/Igorr112323/OpenLight/actions/workflows/ci.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/ci.yml)
[![Build](https://github.com/Igorr112323/OpenLight/actions/workflows/build.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/build.yml)
[![Corpus](https://github.com/Igorr112323/OpenLight/actions/workflows/corpus.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/corpus.yml)

Лёгкое Windows-приложение (единый .exe, стиль Apple Freeform) для «умного» облегчения 3D-деталей с сохранением прочности. **Полностью бесплатно, без подписок/ключей/триалов.**

> **Скачать:** [![Скачать OpenLight.exe](https://img.shields.io/badge/Скачать-OpenLight.exe-blue?style=for-the-badge)](https://github.com/Igorr112323/OpenLight/releases) — последний Release `v0.9.3-test` `dist/OpenLight.exe` (40-70МБ, ≥30МБ, `--selftest` OK) или Artifacts Build.

> **Статус: Этап16 — физика до конца + единицы: PLA FDM E∥3.5/E⊥2.7 ν0.36 σyield∥36.3/⊥26.0 (см. docs/MATERIALS.md, D ортотропная), 3 случая нагрузки envelope, текучесть safety<1, единицы мм/см/дюймы (.olight.json units), импорт 50МБ/300k/тонкая стенка, STEP v1.1 заглушка. Корпус 86/100 11.3мин, beam 1.8% MBB 49% Kirsch 2.5%, build ≥30МБ без dummy.** Дизайн заморожен (web/* палитра не менялась, новые поповеры).

## Артефакты
- **CI**: [![CI](https://github.com/Igorr112323/OpenLight/actions/workflows/ci.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/ci.yml) — `ci.yml` ubuntu, beam ≤2.5% + MBB + bracket
- **Build**: [![Build](https://github.com/Igorr112323/OpenLight/actions/workflows/build.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/build.yml) — `build.yml` windows, `dist/OpenLight.exe` в [Releases](https://github.com/Igorr112323/OpenLight/releases) / Artifacts (тег `v*` → Release)
- **Corpus**: [![Corpus](https://github.com/Igorr112323/OpenLight/actions/workflows/corpus.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/corpus.yml) — `corpus.yml` weekly + dispatch, `tests/corpus/cache` + `report.json/html` + `docs/CORPUS_REPORT.md` (100 моделей, ≥90% parse)

## Требования

* **Windows 10/11 x64**, **WebView2** (Win11 встроен; Win10 → [Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section))
* Для сборки: Python 3.10+ + pip

> Интернет нужен только один раз, для вендора — `python build/vendor.py`. Дальше полностью офлайн (Network 0).

## Быстрый старт (локально)

```bash
pip install -r requirements.txt
python main.py
```
Окно 1400×900, ЛКМ вращение, колесо зум, ПКМ панорама, Esc выход, Ctrl+S/O проекты.

## Сборка и тесты — через GitHub Actions

Все сборки и стресс-тесты — только на GitHub, не в песочнице:

| Workflow | Раннер | Что делает |
|---|---|---|
| `ci.yml` | ubuntu-latest | lint (py_compile, node --check), `import solver`, `pytest tests/test_beam.py` (балка ≤2%) + MBB + bracket |
| `build.yml` | windows-latest | `vendor.py → make_icon → make_version → pyinstaller --collect-all trimesh scipy skimage pywebview --collect-submodules trimesh → dist/OpenLight.exe 40-70МБ Size≥30МБ --selftest OK` (artifact + Release на тег `v*`) |
| `corpus.yml` | ubuntu-latest | `fetch_corpus.py --limit 100 → make_stress_report.py --limit 100 (16³→32³ 90с, без --no-solve, solve_ok≥80) → report.html/json` (бейдж stress-tested, 100 моделей) |

**Как получить .exe:**
- **Через CI:** Actions → Build → Artifacts `OpenLight.exe` (14 дней) или Releases `v*` → скачать `OpenLight.exe` <60МБ
- **Локально:** `build_exe.bat` → `dist\OpenLight.exe` <60МБ (см. TESTING.md строго по шагам)
- **Bundle:** `openlight.bundle` (git bundle --all)

## Корпус тестовых моделей

Только открытые лицензии: NASA 3D Resources (public domain), common-3d-test-models MIT/CC0, trimesh BSD, собственные процедурные MIT. Не берём APM/Fidesys/KOMPAS/nTop/Ansys.

`tests/corpus/manifest.json` — **100 записей**, каждая `{file, source_url, license, sha256, category, origin}`, ≤15МБ. Графических (bunny и т.п.) ≤20% (факт 11%), остальные — инженерные CAD-подобные (кронштейны, корпуса, механика).

Скачивание: `python tools/fetch_corpus.py [--limit N]` → `tests/corpus/cache/` (не в git), проверка sha256, детерминирован/идемпотентен, кэш `actions/cache`.

Отчёт: `python tools/make_stress_report.py --limit 100` (16³→32³ timeout 90с, без --no-solve) → `report.json/html` + `docs/CORPUS_REPORT.md` (file/license/parse/watertight/voxel48/solve 90с/время/res/итог, цели ≥90% parse, ≥80 solve_ok).

## Структура

```
.github/workflows/ci.yml|build.yml|corpus.yml
main.py  solver.py  requirements.txt  build_exe.bat build/make_version.py
web/...  build/...  assets/...  design/freeform-reference.jpg
tests/test_beam.py test_mbb.py test_bracket_oc.py tests/corpus/manifest.json
tools/fetch_corpus.py tools/make_stress_report.py docs/TESTING.md ...
VERSION LICENSE docs/CORPUS_REPORT.md
```

## Известные ограничения (честно)

См. [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) — MBB 1.8%, 16³ время/объём, пределы 32/48³, STEP заглушка, и т.д.

## Чек-лист релиза (Release)

- [x] `git tag v0.9.3-test` → push → `Build OpenLight.exe` Success (windows-latest, pyinstaller --collect-all, Size≥30МБ --selftest OK)
- [x] Artifacts: `dist/OpenLight.exe` 40-70МБ, `Size` шаг ≥30МБ иначе fail → Release не создаётся (без dummy)
- [x] Release: этот же `dist/OpenLight.exe` в Releases (softprops/action-gh-release) + тег — не 1МБ dummy
- [x] `VERSION` из `git describe --tags` (нет хардкода) + `main.py --selftest` → `OpenLight 0.9.3-test` + CI шаг проверки
- [x] `LICENSE` MIT + `GITHUB_URL` https://github.com/Igorr112323/OpenLight в «О программе»
- [x] `docs/CORPUS_REPORT.md` 100 моделей (≥90% parse, ≥80 solve_ok 16³→32³ 90с) + BUG_LIST fallback статистика
- [x] `docs/TESTING.md` строгий прогон на Windows из Release (Network 0, версия 0.9.3-test)

## Лицензия

Пока не выбрана куратором: рекомендуется MIT/Apache-2.0 для кода (бесплатно для всех) или proprietary freeware — от этого зависит страница «О программе». Текущая: `LICENSE` MIT, окно «О программе» берёт версию из `VERSION` (нет хардкода) + лицензия + ссылка на GitHub.

## Ссылки

- Releases: https://github.com/Igorr112323/OpenLight/releases
- Issues: https://github.com/Igorr112323/OpenLight/issues
- Corpus Report: docs/CORPUS_REPORT.md
- Testing: docs/TESTING.md
