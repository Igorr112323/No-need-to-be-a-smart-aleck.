# CHANGELOG — OpenLight

## [1.0.0] - 2026-11-26

**Что есть:**
- Ядро МКЭ/SIMP (hex8 2×2×2 Gauss, spsolve/CG, OC Sigmund, density_filter): корпус 86/100 (16³→32³ 120с, 150k), эталон балки ошибка 1.8%, MBB 60×20×1 16ит 49% 21.4с, Кирш Kt ошибка 2.5%, CalculiX cross-check 4.2% — измерено (docs/CORPUS_REPORT.md, docs/VERIFICATION.md, ccx_report.md, tests/*)
- Приложение Freeform (1400×900, dot-grid, опоры/силы/запретные зоны, материал сталь/alu/PLA ортотропная, 3 случая нагрузки, единицы мм/см/дюймы, .olight.json, автосейв)
- Бесплатно, офлайн после vendor.py, Windows 10/11 x64 WebView2, `dist/OpenLight.exe` ≥80 МБ, `--selftest` → `OpenLight 1.0.0`, версия из `VERSION` (build/make_version.py, без хардкода)
- LICENSE MIT, окно «О программе» — версия+MIT+https://github.com/Igorr112323/OpenLight

**Чего нет (честно):**
- STEP — заглушка v1.1 OCCT (только STL/OBJ)
- Buckling/потеря устойчивости, усталость, контактная задача, пластическое течение — не моделируется
- Инженерная пригодность — оценочная, подтверждать независимым расчётом/испытанием

## [0.9.3-test] - 2026-11-26
- Этап16: PLA FDM ортотропная (docs/MATERIALS.md), 3 случая envelope, единицы мм/см/дюймы, watertight repair, тонкая стенка, лимит 50МБ/300k, STEP заглушка

## [0.9.2] - 2026-11-26
- Корпус 100, Build workaround для точки в имени репо, TESTING строгий

## [0.9.1] - 2026-11-26
- Корпус 30, fallback сила

## [0.9.0] - 2026-11-26
- CI/build/corpus GitHub-центрично

## [0.7.0] — Etap 7B real core
## [0.6.0] — Etap 6 vendor+exe
## [0.5.0] — Etap 5 pywebview api
