# OpenLight — бесплатный Windows .exe для умного облегчения 3D-деталей

[![CI](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/ci.yml/badge.svg)](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/ci.yml)
[![Build](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/build.yml/badge.svg)](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/build.yml)
[![Corpus](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/corpus.yml/badge.svg)](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/corpus.yml)

Лёгкое Windows-приложение (единый .exe, стиль Apple Freeform) для «умного» облегчения 3D-деталей с сохранением прочности. **Полностью бесплатно, без подписок/ключей/триалов.**

> **Статус: v0.9.1 — Этап 11, корпус 30, beam 1.8%, build fix** Ядро 7B/9: эталон балки 2.06% (<5%), 24³ 12.8с watertight, 48³ в работе. Дизайн заморожен.

## Артефакты
- **CI**: [![CI](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/ci.yml/badge.svg)](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/ci.yml) — `ci.yml` ubuntu, beam ≤2.5%
- **Build**: [![Build](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/build.yml/badge.svg)](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/build.yml) — `build.yml` windows, `dist/OpenLight.exe` в [Releases](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./releases) / Artifacts (тег `v0.9.0-test` → Release)
- **Corpus**: [![Corpus](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/corpus.yml/badge.svg)](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/corpus.yml) — `corpus.yml` weekly + dispatch, `tests/corpus/cache` + `report.json/html`

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
| `ci.yml` | ubuntu-latest | lint (py_compile, node --check), `import solver`, `pytest tests/test_beam.py` (балка ≤2%) |
| `build.yml` | windows-latest | `vendor.py → make_icon → build_exe.bat → dist/OpenLight.exe` (artifact + Release на тег `v*`) |
| `corpus.yml` | ubuntu-latest | `fetch_corpus.py --limit 30 → make_stress_report.py → report.html/json` (бейдж stress-tested) |

**Как получить .exe:**
- **Через CI:** Actions → Build → Artifacts `OpenLight.exe` (14 дней) или Releases `v*`
- **Локально:** `build_exe.bat` → `dist\OpenLight.exe` <60МБ
- **Bundle:** `openlight.bundle` (git bundle --all)

Публичный репо без лимита минут; private — 2000 мин/мес. Крупные модели — через скачивание в workflow с кэшем, не через git.

## Корпус тестовых моделей

Только открытые лицензии: NASA 3D (public domain), NIH 3D, Printables CC0/CC-BY, Thingi10K CC, собственные процедурные. Не берём APM/Fidesys/KOMPAS/nTop/Ansys.

`tests/corpus/manifest.json` — 30 записей (→100+), каждая `{file, source_url, license, sha256, category, notes}`, ≤15МБ.

Скачивание: `python tools/fetch_corpus.py [--limit N]` → `tests/corpus/cache/` (не в git), проверка sha256, детерминирован/идемпотентен, кэш `actions/cache`.

Отчёт: `python tools/make_stress_report.py [--limit 30]` → `report.json/html` (file/license/parse/watertight/voxel_ok/время/итог).

## Структура

```
.github/workflows/ci.yml|build.yml|corpus.yml
main.py  solver.py  requirements.txt  build_exe.bat
web/...  build/...  assets/...  design/freeform-reference.jpg
tests/test_beam.py test_solver.py test_corpus.py conftest.py
tests/corpus/manifest.json  tools/fetch_corpus.py make_stress_report.py
docs/TESTING.md BUG_LIST.md KNOWN_LIMITATIONS.md CHANGELOG.md
```

## Известные ограничения (честно)

См. [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) — МКЭ 48³ OC коллапс, von Mises упрощённый, STEP заглушка, и т.д.

## Чек-лист приёмки

`dist\OpenLight.exe` <60МБ, двойной клик → офлайн Network 0, дизайн пиксель-в-пиксель Freeform.

## Лицензия

Пока не выбрана куратором: рекомендуется MIT/Apache-2.0 для кода (бесплатно для всех) или proprietary freeware — от этого зависит страница «О программе».

## Ссылки

- Releases: https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./releases
- Issues: https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./issues
