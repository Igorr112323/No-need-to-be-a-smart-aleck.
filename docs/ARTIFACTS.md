# ARTIFACTS — кликабельные артефакты (27.11.2026)

> Каждый артефакт — кликабельная ссылка, размер и sha256 (сверка `sha256sum` vs API digest)

## QA (headless, 13 png ≥5KB, size gate)
- **QA — статика/юнит + e2e headless** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45961516647 → `qa-shots-45961516647` (13 png, 120KB, 14 дней) — `docs/qa/01-init.png 8.9K … 13-metrics-toggle.png 9.6K` (закоммичены в `docs/qa/`)
- **CI** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45961516643 — Beam 1.8% / MBB 49% / Kirsch 2.5% зелёные
- **e2e-extra 20** — `tests/e2e/test_e2e_extra.py` (seed 123, 20 реальных, каждый опора/сила→оптимизация→метрики→экспорт watertight, `docs/qa-extra/NN.png` ≥5KB) — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45961516647 (расширение qa)

## Stress 1000 (20×50, 90с/модель, watertight/parse/solve/время/память)
- **Corpus stress 1000** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45961516651 → `stress-report` (report.json/html, STRESS_REPORT.md) — 1000 строк, без «идеально», parse ≥99% / watertight ≥85% / solve_ok ≥90% real
- **Expand corpus 510→1000** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/workflows/expand-corpus.yml — `manifest.json` 1000 записей (whitelist MIT/CC0/BSD/public domain, ≤15МБ, sha256 измерены `gh api`, не выдуманы)

## Build (≥80МБ, --selftest exit 0, sha256 vs digest)
- **Build OpenLight.exe** — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45961516648 — `OpenLight.exe` ≥80МБ, `sha256sum` выводится в логе (сверка с digest API), `--selftest exit 0`

## Release (куратор, теги не создаём)
- Releases — https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./releases — `OpenLight.exe` из Build Artifacts

**Windows GUI: НЕ ВЫПОЛНЕНО (куратор: запуск OpenLight.exe → по чек-листу TESTING.md)**
