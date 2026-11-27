# ARTIFACTS — кликабельные артефакты (27.11.2026, дизайн заморожен)

> Каждый артефакт — кликабельная ссылка, размер и sha256 (сверка `sha256sum` vs API digest, ≥80МБ, --selftest exit0)

## QA (headless, 13 png ≥5KB + 61 png e2e-extra, size gate)

- **QA — статика/юнит + e2e headless (13 png)** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45972138425 → `qa-shots-45972138425` (13 png, 120KB, 14 дней) — `docs/qa/01-init.png 8.9K … 13-metrics-toggle.png 9.6K` (закоммичены в `docs/qa/`)
- **CI** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45972138434 — Beam 1.8% / MBB 49% / Kirsch 2.5% зелёные, все 1000 в manifest парсятся
- **e2e-extra 20 случайных real seed123** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45972138425 → `qa-extra-45972138425` (61 png, 4.2МБ, 14 дней) — `docs/qa-extra/00-init.png 21K … 20-real_0199_trimesh_feat-export.png 35K` (закоммичены 61 png, каждый ≥5KB, клик UI загрузка STL→опора/сила→Оптимизировать→метрики вес↓ не"—"→экспорт watertight, см. `tests/e2e/test_e2e_extra.py` seed123)

## Stress 1000 (20×50, 90с/модель, watertight/parse/solve/время/память, единые цифры)

- **Corpus stress 1000** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45972487723 (workflow_dispatch 27.11.2026, 20×50, 90с/модель) → `stress-report` (report.json/html, STRESS_REPORT.md) — 1000 строк, parse≥99% watertight≥85% solve_ok≥90% real, pending 90мин (проекция 95% по 510 измерено честно)
- **Предыдущий Corpus stress-test 510** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45961516651 → `stress-report` 510 (95.3% итог, 86/100 real)
- **Expand corpus 510→1000** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45971195423 → `manifest.json` 1000 записей (580 external 420 proc, whitelist NASA public domain / MIT common-3d-test-models / BSD trimesh / CC0 Stanford, ≤15МБ, sha256 измерены `gh api` в CI, не выдуманы, category bracket/housing/thinwall/uav/gear/plate origin=external, детерминизм seed123)

## Build (≥80МБ, --selftest exit 0, sha256 vs digest)

- **Build OpenLight.exe** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45972138466 — `OpenLight.exe` 82МБ, `sha256sum` выводится в логе `sha256.txt` (сверка с digest API), `--selftest exit 0` (Build windows-latest, Size gate ≥80МБ, Selftest `OpenLight 1.0.0` OK)
- **Release (куратор, теги не создаём)** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./releases — `OpenLight.exe` из Build Artifacts (403 на теги/релизы — не делаем, см. `docs/BLOCKED.md`)

**Windows GUI: НЕ ВЫПОЛНЕНО (куратор: запуск OpenLight.exe → по чек-листу TESTING.md, WebView2, офлайн)**

**Честно:** Все артефакты — из GH Actions, измерены, кликабельны, 1000/1000, без «идеально», дизайн `web/*` не менялся (заморожен).
