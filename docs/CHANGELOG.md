# CHANGELOG — OpenLight

## [0.9.1] - 2026-11-26 — Etap 11: реальный корпус + ворота
- Корпус: 30 записей (10 proc + 20 external raw, sha256 via gh api, origin поле, LICENSES.md)
- Build: fix checkout path: repo (Windows точка в имени), corpus fetch --limit 30 sha256-check
- Ядро: fallback сила [0,68,0] 500N, OC scale dc<1e-4→1e-4, beam 32×8×8 1.8% CI ≤2.5%
- Доки: KNOWN_LIMITATIONS с измеренными числами, BUG_LIST P0-1 остаётся открыт честно

## [0.9.0] - 2026-11-26 — Etap 9/10 : GitHub-центричный
- CI: ci.yml (ubuntu) + build.yml (windows) + corpus.yml (weekly)
- Ядро: active_nodes, 12мм опора, rtol, эталон балки 2.06%
- Док: docs/TESTING.md, BUG_LIST.md, KNOWN_LIMITATIONS.md

## [0.7.0] - 2026-11-26 — Etap 7B real core (частично)
- voxel 64³, hex FEM C3x3 spsolve/CG, SIMP 15-25, marching+Taubin, von Mises

## [0.6.0] - 2026-11-26 — Etap 6 vendor+exe
- vendor r160 SHA256, make_icon, build_exe.bat

## [0.5.0] — Etap 5 pywebview api
## [0.4.0] — Etap 4 demo-оптимизация
## [0.3.0] — Etap 3 markers
## [0.2.0] — Etap 2 3D scene
## [0.1.0] — Etap 1 Freeform shell
