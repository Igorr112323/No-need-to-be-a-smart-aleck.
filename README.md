# OpenLight — бесплатный Windows .exe для умного облегчения 3D-деталей

[![CI](https://github.com/Igorr112323/OpenLight/actions/workflows/ci.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/ci.yml)
[![Build](https://github.com/Igorr112323/OpenLight/actions/workflows/build.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/build.yml)
[![Corpus](https://github.com/Igorr112323/OpenLight/actions/workflows/corpus.yml/badge.svg)](https://github.com/Igorr112323/OpenLight/actions/workflows/corpus.yml)

Лёгкое Windows-приложение (единый .exe, стиль Apple Freeform) для «умного» облегчения 3D-деталей с сохранением прочности. **Полностью бесплатно, без подписок/ключей/триалов.**

> **Скачать:** [![Скачать OpenLight.exe](https://img.shields.io/badge/Скачать-OpenLight.exe-blue?style=for-the-badge)](https://github.com/Igorr112323/OpenLight/releases/tag/v1.0.0) — `OpenLight.exe` из Release `v1.0.0` (≥80 МБ, `--selftest` → `OpenLight 1.0.0`) или Artifacts Build.

> **Статус: v1.0.0** — ядро МКЭ/SIMP: корпус 86/100 (16³→32³ 120с, 150k), эталон балки ошибка 1.8% (≤2%), Кирш Kt 2.5%, CalculiX 4.2%, MBB 60×20×1 16ит 49% 21.4с; бесплатно, офлайн, Windows 10/11 x64 WebView2. См. `docs/CORPUS_REPORT.md`, `docs/VERIFICATION.md`, `ccx_report.md`.

## Артефакты
- **CI**: `ci.yml` ubuntu — lint, `import solver`, `pytest` балка ≤2% + MBB + bracket
- **Build**: `build.yml` windows — `vendor.py → make_icon → make_version → pyinstaller --collect-all ... → dist/OpenLight.exe ≥80 МБ --selftest OK` (Artifact + Release на тег `v*`)
- **Corpus**: `corpus.yml` weekly + dispatch — `report.json/html` + `docs/CORPUS_REPORT.md` (100 моделей, ≥90% parse)

## Требования

* **Windows 10/11 x64**, **WebView2** (Win11 встроен; Win10 → [Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section))
* Для сборки: Python 3.10+ + pip

> Интернет нужен только один раз, для вендора — `python build/vendor.py`. Дальше полностью офлайн.

## Быстрый старт (локально)

```bash
pip install -r requirements.txt
python main.py
```
Окно 1400×900, ЛКМ вращение, колесо зум, ПКМ панорама, Esc выход, Ctrl+S/O проекты.

## Сборка и тесты — через GitHub Actions

| Workflow | Раннер | Что делает |
|---|---|---|
| `ci.yml` | ubuntu-latest | lint, `pytest tests/test_beam.py` + MBB + bracket |
| `build.yml` | windows-latest | `pyinstaller --collect-all trimesh scipy skimage pywebview numpy PIL → dist/OpenLight.exe ≥80 МБ Size≥80МБ --selftest OK` |
| `corpus.yml` | ubuntu-latest | `fetch_corpus.py --limit 100 → make_stress_report.py --limit 100 (16³→32³ 120с) → report.json/html` |

**Как получить .exe:**
- **Через CI:** Actions → Build → Artifacts `OpenLight.exe` (14 дней) или Releases `v1.0.0` → `OpenLight.exe`
- **Локально:** `build_exe.bat` → `dist\OpenLight.exe`
- **Bundle:** `openlight.bundle` (git bundle --all)

## Корпус тестовых моделей

Только открытые лицензии: NASA 3D Resources (public domain), common-3d-test-models MIT/CC0, trimesh BSD, собственные процедурные MIT.

`tests/corpus/manifest.json` — **100 записей**, каждая `{file, source_url, license, sha256, category, origin}`, ≤15МБ.

Отчёт: `python tools/make_stress_report.py --limit 100` → `report.json/html` + `docs/CORPUS_REPORT.md`.

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

См. [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) — измеренные числа: балка 1.8%, MBB 49%, 86/100, STEP заглушка, buckling/усталость/контакт/пластика — нет; пригодность — оценочная.

## Чек-лист релиза v1.0.0

- [x] `VERSION` из `git describe --tags` (нет хардкода) + `main.py --selftest` → `OpenLight 1.0.0`
- [x] `LICENSE` MIT, `GITHUB_URL` https://github.com/Igorr112323/OpenLight — в окне «О программе»
- [x] `Build OpenLight.exe` на теге `v1.0.0` Success (windows-latest, pyinstaller --collect-all, Size≥80МБ --selftest OK) → Release с реальным `dist/OpenLight.exe`
- [x] `docs/CORPUS_REPORT.md` 100 моделей (parse 100%, 86/100 solve 16³→32³ 120с) + `docs/VERIFICATION.md` Кирш 2.5% + `ccx_report.md` CalculiX 4.2% + балка 1.8%
- [x] `docs/KNOWN_LIMITATIONS.md` финальные измеренные числа, `docs/TESTING.md` прогон из Release
- [x] `CHANGELOG.md` [1.0.0] — что есть / чего нет (честно)

## Лицензия

MIT — см. [LICENSE](LICENSE). Окно «О программе» читает версию из `VERSION` (сгенерирован `build/make_version.py`, нет хардкода) + лицензию + ссылку на GitHub.

## Ссылки

- Releases: https://github.com/Igorr112323/OpenLight/releases
- Issues: https://github.com/Igorr112323/OpenLight/issues
- Corpus Report: docs/CORPUS_REPORT.md
- Testing: docs/TESTING.md
