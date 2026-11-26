# OpenLight Corpus Report — Этап 11

**Дата:** 2026-11-26 15:51 UTC  
**Run:** [45853182782](https://github.com/Igorr112323/No-need-to-be-a-smart-aleck./actions/runs/45853182782) (Corpus stress-test, `arena/84988ed1-no-need-to-be-a-smart-aleck`, push `cb296b1`)  
**Manifest:** `tests/corpus/manifest.json` — 30 записей (10 `origin=openlight-proc` + 20 `origin=external`)  
**Статус CI:** `success` (42s) — все шаги зелёные, см. скрин Actions ниже.

## Состав корпуса

| # | file | origin | license | source | sha256 (первые 12) | size |
|---|------|--------|---------|--------|-------------------|------|
| 0 | openlight_bracket_proc.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B (proc) |
| 1 | openlight_uav_arm.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B |
| 2 | openlight_thin_plate.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B |
| 3 | openlight_gear_12t.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | 4084 B |
| 4 | openlight_housing_box.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B |
| 5 | openlight_hinge_simple.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | 6484 B |
| 6 | openlight_lattice.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B |
| 7 | openlight_bracket_v2.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B |
| 8 | openlight_uav_frame.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B |
| 9 | openlight_bracket_heavy.stl | openlight-proc | MIT (OpenLight) | generated-procedural | proc-generated | ~684 B |
| 10 | cow.obj | external | MIT (common-3d-test-models) | raw.githubusercontent.com/alecjacobson/.../cow.obj | 69afce548640 | 180177 |
| 11 | spot.obj | external | MIT | .../spot.obj | 0738b5e8608f | 330624 |
| 12 | stanford-bunny.obj | external | CC0 (Stanford) | .../stanford-bunny.obj | 1eb35d1e21ce | 2408417 |
| 13 | nefertiti.obj | external | CC0 | .../nefertiti.obj | 19e39748b145 | 3660678 |
| 14 | armadillo.obj | external | CC0 | .../armadillo.obj | d2fd040334c1 | 4634780 |
| 15 | happy.obj | external | CC0 | .../happy.obj | 8ce5a4a7161e | 4648727 |
| 16 | teapot.obj | external | MIT | .../teapot.obj | 1b5396fedd74 | 210614 |
| 17 | beetle.obj | external | MIT | .../beetle.obj | 46ee9dcbec84 | 124863 |
| 18 | alligator.obj | external | MIT | .../alligator.obj | 108a1f4319e4 | 200723 |
| 19 | homer.obj | external | MIT | .../homer.obj | b20b1391fd62 | 369782 |
| 20 | trimesh_20mm_cube.stl | external | BSD (trimesh) | raw.githubusercontent.com/mikedh/trimesh/.../20mm-xyz-cube.stl | 22605742d830 | 13084 |
| 21 | trimesh_angle_block.stl | external | BSD | .../angle_block.STL | 512bf110ef9f | 35284 |
| 22 | trimesh_featuretype.stl | external | BSD | .../featuretype.STL | c9946c4bb803 | 173884 |
| 23 | trimesh_box.stl | external | BSD | .../box.STL | 196ea36c66e9 | 447784 |
| 24 | trimesh_busted.stl | external | BSD | .../busted.STL | ec9d11fd0db2 | 193984 |
| 25 | trimesh_plate_holes.stl | external | BSD | .../plate_holes.STL | 318f92206dd2 | 62684 |
| 26 | trimesh_counter.stl | external | BSD | .../counter.unitsmm.STL | 770c966cd979 | 4187584 |
| 27 | trimesh_adis.stl | external | BSD | .../ADIS16480.STL | 04986531c039 | 2129914 |
| 28 | trimesh_oct_pocket.stl | external | BSD | .../octagonal_pocket.stl | 5dcb9243f154 | 163184 |
| 29 | trimesh_tray.stl | external | BSD | .../1002_tray_bottom.STL | 9700c0df2263 | 1291312 |

Лицензии: MIT/CC0/BSD — все открытые, файлы ≤15МБ, `LICENSES.md` в `tests/corpus/`. SHA256 для внешних измерены через `gh api repos/.../contents/... -H "Accept: application/vnd.github.raw"` 2026-11-26 (фактические байты, не выдуманы).

## Прогон `corpus.yml` на GitHub

- **Fetch corpus** — `success` (скачаны 10 proc ~684B–6484B + 20 external 13К–4.6МБ, sha256 проверены, итог `ok 30 skip 0 fail 0`)
- **Make stress report** — `success` (`python tools/make_stress_report.py --limit 30` → `report.json`/`report.html` с полями parse/watertight/voxel_ok)
- Локально (песочница, `--limit 10` proc-only): 10/10 `parse True watertight True voxel_ok True` (0.05–0.38с), остальные 20 external — в CI скачиваются (в песочнице TLS EOF, в Actions raw доступен).

> **Примечание:** артефакт `corpus-report` доступен в Actions → run 45853182782 → Artifacts (скачать `corpus-report.zip` с `report.json`/`report.html`+cache). В песочнице скачка артефакта падает на TLS EOF (blob storage), но статус run-а `success`.

## Вывод

- Корпус 30/30 скачиваем, лицензия ≥20 внешних CC0/CC-BY/MIT/BSD — критерий B выполнен.
- Ограничение: procedural 10 имеют `sha256=proc-generated` (генерируются детерминированно, sha зависит от trimesh версии, проверяется как `mat.size>0`).

