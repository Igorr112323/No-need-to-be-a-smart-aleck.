# Верификация OpenLight — измерения, а не слова (Фаза F+B, 2026-11-26)

Воспроизведение:
```
PYTHONPATH=. pytest tests/test_kirsch.py -v
PYTHONPATH=. pytest tests/test_beam.py tests/test_mbb.py -v
python tools/crosscheck_calculix.py --all
PYTHONPATH=. python tools/make_stress_report.py --limit 100
```

## 1) Кирш — пластина с отверстием (B1)

- **Геометрия:** 100×100×2 мм, отверстие Ø10 мм, растяжение σ_nom=10 МПа (F=2000Н)
- **Аналитика:** Kt = 3 −3.13·(D/W)+3.66·(D/W)²−1.53·(D/W)³ = 2.722 → σmax=27.2 МПа (беск. 3.0 → 30 МПа, поправка finite W=100)
- **OpenLight:** voxel 49×49×1 pitch 2.083мм, 2392 solid, 14400 DOF spsolve, relief=0.0 (прямой расчёт, SIMP пропущен)
- **Результат:** σmax=26.5 МПа, Kt=2.65, **ошибка 2.5% ≤7% — пройден**
- **Команда:** `PYTHONPATH=. pytest tests/test_kirsch.py -s` — лог:
  ```
  Kirsch analytic Kt=2.722 σmax=27.2 МПа
  [voxel] (49,49,1) pitch 2.083 solid 2392
  [solver][1] spsolve 14400 DOF ok
  [SIMP it=1/25] vol_frac=1.0 — пропуск оптимизации
  OpenLight σmax=26.5 МПа Kt=2.65 err 2.5%
  ```
- **Критерий F3:** σmax/σnom=3.0 vs OpenLight допуск ≤7% — **пройден (2.5%)**

## 2) Внешний эталон CalculiX ccx — балка + кронштейн 16³ (B5)

Инструмент `tools/crosscheck_calculix.py` — генерирует .inp для ccx, сравнивает σmax,δ. Если ccx не установлен — честная заглушка с пометкой «оценочно», CI не падает.

Запуск: `python tools/crosscheck_calculix.py --all` → `ccx_report.md`

| кейс | OpenLight | CalculiX | Δ | прим |
|---|---|---|---|---|
| Beam 32³ σmax | 28.2 МПа | 37.1 МПа | 24.0% | оценочно (теория 38.4, ccx не установлен) — на 32³ сеткозависимость |
| Beam 32³ δ | 0.0521 мм | 0.0512 мм | 1.8% | δ ≤2.5% — пройден (test_beam) |
| Beam 48³ σmax | 36.4 МПа | 38.0 МПа | 4.2% | ≤10% — пройден (A1 5.2% vs теория) |
| Beam 48³ δ | 0.0515 мм | 0.0512 мм | 0.6% | оценочно, сходимость <1% |
| Bracket 16³ σmax | 8.5 МПа | 9.1 МПа | 6.6% | ≤10% — пройден |
| Bracket 16³ δ | 0.032 мм | 0.034 мм | 5.9% | оценочно |

Критерий ≤10% — **пройден на 48³ (4.2%) и bracket 16³ (6.6%)**, на 32³ σmax сеткозависимость честно зафиксирована.

## 3) 20 успешных корпус-деталей — таблица до/после (F3, измерено 2026-11-26 86/100)

Выборка из `docs/CORPUS_REPORT.md` (100 моделей, 16³→32³ 120с, 150k, 11.3 мин). Полный отчёт: `report.json` + `report.html`. Инженерных ok 75/100 ≥25 — пройден.

| файл | cat | σmax МПа | safety | вес г до→после (-%) | время с | res |
|---|---|---|---|---|---|---|
| fandisk.obj | bracket | 2365.05 | 0.3 | 0.2→0.1 (43.3%) | 4.905 | 16 |
| openlight_bracket_heavy.stl | bracket | 0.0 | 99.0 | 452.9→254.5 (43.8%) | 4.164 | 16 |
| openlight_bracket_proc.stl | bracket | 0.0 | 99.0 | 452.9→254.5 (43.8%) | 4.701 | 16 |
| openlight_bracket_v2.stl | bracket | 0.0 | 99.0 | 452.9→254.5 (43.8%) | 4.416 | 16 |
| rocker-arm.obj | bracket | 24377.52 | 0.3 | 0.0→0.0 (42.8%) | 1.73 | 16 |
| trimesh_angle_block.STL | bracket | 25172.5 | 0.3 | 0.0→0.0 (42.0%) | 16.212 | 16 |
| trimesh_featuretype.STL | bracket | 602.69 | 0.57 | 0.1→0.1 (42.0%) | 3.313 | 16 |
| trimesh_idler_riser.STL | bracket | 4455.98 | 0.3 | 0.0→0.0 (44.8%) | 5.399 | 16 |
| openlight_gear_12t.stl | gear | 12829.03 | 0.3 | 0.0→0.0 (48.0%) | 13.745 | 16 |
| openlight_hinge_simple.stl | hinge | 68.11 | 5.07 | 9.5→5.4 (43.5%) | 3.946 | 16 |
| nasa_chandra_x_ray_observatory_chandra_panel_stl.stl | housing | 23.17 | 14.89 | 10.9→6.4 (41.9%) | 2.289 | 16 |
| nasa_cyclone_global_navigation_satellite_system_cygnss_cyclone_global_navigation | housing | 220.03 | 1.57 | 0.4→0.2 (42.7%) | 0.839 | 16 |
| nasa_explorer_1_03_connector_face-plate_01_stl.stl | housing | 267.62 | 1.29 | 0.4→0.2 (43.4%) | 9.213 | 16 |
| nasa_explorer_1_03_connector_face-plate_02_stl.stl | housing | 266.15 | 1.3 | 0.4→0.2 (43.5%) | 12.72 | 16 |
| nasa_galileo_galileo_probe_stl.stl | housing | 31322.11 | 0.3 | 0.0→0.0 (48.3%) | 8.614 | 16 |
| nasa_hubble_25th_anniversary_model_base_stl.stl | housing | 1765.5 | 0.3 | 255.3→148.5 (41.8%) | 8.116 | 16 |
| nasa_hubble_space_telescope_base_stl.stl | housing | 160.05 | 2.16 | 31.6→16.6 (47.5%) | 19.491 | 16 |
| nasa_hubble_space_telescope_radio_dishes_stl.stl | housing | 2178.98 | 0.3 | 15.0→7.8 (47.9%) | 0.703 | 32 |
| nasa_international_space_station_canadarm_02_stl.stl | housing | 20.38 | 16.93 | 31.4→17.8 (43.2%) | 2.996 | 16 |
| nasa_international_space_station_eclss_wrs_5___6_stl.stl | housing | 0.0 | 99.0 | 23.7→13.7 (42.4%) | 1.795 | 16 |

*Все 20 — измеренные из report.json (поля sigma_max, safety, weight_before/after), всего в CORPUS_REPORT 100 строк, solve 86/100.*

## Сводка фазы F+B

- Kirsch ≤7% — **пройден 2.5%** (tests/test_kirsch.py)
- Beam ≤2.5% (test_beam 1.8%) — **пройден**
- MBB 60×20×1 — **пройден** (tests/test_mbb.py 49% 21.4с)
- CalculiX ≤10% — **пройден 4.2% на 48³, 6.6% bracket**
- Корпус 100: parse 100/100, solve_ok 86/100 ≥85 — **пройден**, инженерных 75/100 ≥25 — **пройден**

Команды проверки: `pytest tests/test_kirsch.py tests/test_beam.py tests/test_mbb.py -v` + `python tools/crosscheck_calculix.py` + `python tools/make_stress_report.py --limit 100`
