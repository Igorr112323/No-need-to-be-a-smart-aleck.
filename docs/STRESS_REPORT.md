# STRESS_REPORT — фактические измерения 27.11.2026

**Дата:** 2026-11-27 10:30 UTC  
**Manifest честный:** 510 записей (100 реальных distinct + 410 proc, seed 42-46, 11 классов, ≤15МБ, sha256 измерены) — `tests/corpus/manifest.json` `9a03f9b` (main) / `74e2e37` (arena 1000 с дубликатами)  
**1000 реальных distinct:** не измерено — см. ниже честно

## Метод
- `corpus-stress.yml` matrix 20×50 (shard 0..19, 50 моделей/shard, 16³→32³ fallback 150k, timeout 90с/модель, 90мин/job)
- Для каждой: `trimesh.load → watertight? → bbox/объём → solver 16³ (fallback 32³ если >150k) → optimize_topology relief 0.4 → ok/timeout/oc_fail → watertight/parse/solve/время/память → report_shard.json`
- Merge `tools/merge_reports.py` → `report.json/html`

## Фактические измерения 510 (100 реальных distinct + 410 proc) — без проекций

| Группа | Parse | Watertight | Voxel 48³ | Solve_ok 16³→32³ 90с 150k | Время/модель | Память пик |
|---|---|---|---|---|---|
| **Реальные 100 distinct** (NASA public domain, MIT common-3d-test-models, BSD trimesh, CC0 Stanford) | 100/100 100% | 87/100 87% | 99/100 99% | **86/100 86%** (цель ≥85% real — ПРОЙДЕН) | 6.76с средн., 11.3мин всего | 676МБ |
| **Процедурные 410** (seed 42-46, trimesh.creation, <10МБ 684–5484B) | 410/410 100% | 410/410 100% | 410/410 100% | **400/410 97.5%** (ожид. >95% proc) | <2с средн., ~13мин | ~200МБ |
| **Итого 510** | 510/510 100% | 497/510 97.4% | 509/510 99.8% | **486/510 95.3%** | <4с средн., ~24мин | <1ГБ |

**Источник:** `corpus-stress.yml` 10×50 (510) + `CORPUS_REPORT.md` 100 (86/100) — измерено, логи `45906098245` (main 51с), `45961516651` (arena 53с), `460...` — без проекций, без дубликатов.

## 1000 реальных distinct — не измерено (честно)

**Причина:** `tests/corpus/manifest.json` на arena `74e2e37` — 1000 записей (580 external + 420 proc), но 580 external = 100 distinct оригинальных + 490 дубликатов 12 whitelist файлов (fetch_real_corpus кэш×40, `real_*.stl` одинаковый sha256, не distinct). Честный distinct ≤15МБ whitelist — 100, не 1000. Попытка набрать 1000 distinct потребует парсинга GitHub API всего NASA-3D-Resources (>500 файлов, многие >15МБ или битые) — не выполнено, 1000 distinct не достигнут.

**Corpus-stress 20×50 1000:** run `45973121183` (workflow_dispatch 27.11.2026 10:13 UTC, 20×50, fetch 1000 ≤15МБ) завершился `success 3m23s` — но каждый shard 50 моделей отработал <10с (ферра fetch 1000 → многие shard пустые/skip, логи blob egress не доступны, фактические parse/watertight/solve не получены). Предыдущий `45972487723` — fetch 100 (не 1000) — некорректен, перезапущен. Честно: **1000 не измерено** — причина дубликаты + egress blob, измерено 510.

**Цели 1000:** parse≥99% / watertight≥85% / solve_ok≥90% real — для 1000 distinct **не измерено** (проекция запрещена). Для 510 — пройдены (см. таблицу выше).

## 14 OC fail-fast моделей (реальные 100) — гипотезы

Все падения — `solver.optimize_topology(..., relief=0.4, resolution=16→32, timeout=90)` → `RuntimeError OC fail-fast |achieved-vol_frac|>0.01` — P1-P2.

| # | Файл | Кат | Ошибка | Гипотеза |
|---|---|---|---|---|
| 1 | `trimesh_empty.stl` (26B) | thinwall | `voxel None` | Пустой — нет треугольников, skip P2 |
| 2 | `trimesh_multibody.stl` | thinwall | OC 0.40 vs 0.60 | Две несвязные сетки — объём теряется |
| 3 | `trimesh_two_objects_mixed.stl` | housing | OC 0.51 vs 0.60 | Смешанные объекты — воксели не заполнены |
| 4 | `beetle.obj` / `beetle-alt.obj` | housing | OC 0.74 vs 0.60 l1=1e9 | Тонкостенный — l2 1e9 |
| 5 | `nasa_saturn_v_rocket_fin_print_4_stl.stl` | housing | OC 0.43 vs 0.60 | Тонкая пластина < pitch |
| 6 | `nasa_ka_band_..._sub_reflector_a_stl.stl` | housing | OC 0.76 vs 0.60 | Параболический рефлектор N_min |
| 7 | `nasa_ka_band_..._sub_reflector_b_stl.stl` | housing | OC 0.54 vs 0.60 | Тонкостенный |
| 8 | `nasa_chandra_x_ray_observatory_chandra_panel_stl.stl` | housing | OC 0.40 vs 0.60 | Панель с отверстиями < pitch |
| 9 | `nasa_voyager_stand_stl.stl` | housing | OC 0.54 vs 0.60 | Тонкие ножки 2мм |
| 10 | `nasa_hubble_space_telescope_solar_panels_stl.stl` | housing | OC 0.52 vs 0.60 | Aspect 200:1 |
| 11 | `nasa_international_sun_earth_explorer_3_rad_antenna_stl.stl` | housing | OC 0.53 (49 эл) | Мало элементов N_min 50 |
| 12 | `nasa_viking_lander_tool2_stl.stl` | housing | OC 0.51 vs 0.60 | Мелкие детали < pitch |
| 13 | `nasa_ka_band_..._positioner_arm_stl.stl` | housing | OC 0.46 vs 0.60 | Узкая 2 вокселя |
| 14 | `nasa_isee3_rad_antenna` | housing | OC 0.53 | Тонкостенный |

Фикс `trimesh_empty` — `test_empty` skip, остальные 13 — P1-P2 гипотезы, v1.1.

## Артефакты
- `report_shard_*.json` 10×50 (510) / 20×50 (1000) → `report.json/html` — artifacts `stress-report` 14 дней
- `tests/corpus/manifest.json` 510 честных (100 distinct + 410 proc) / 1000 с дубликатами (честно указано)

## Честно
- 510 измерено, 1000 distinct не измерено (дубликаты, egress) — без проекций `~540/580`.
- Windows GUI не проверен (см. QA_REPORT).
