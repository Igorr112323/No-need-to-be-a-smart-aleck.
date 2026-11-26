# Известные ограничения OpenLight v1.0.0

## Ядро — измерено (2026-11-26, scipy 1.17.1, ubuntu)

- **Эталон балки** 32×8×8 L=100мм F=1000N E=200ГПа pitch 3.125мм DOF 7776 spsolve 0.36с теория δ=0.0512мм расчёт -0.0521мм **ошибка 1.8%** (CI `tests/test_beam.py`).

- **MBB 60×20×1 volfrac 0.5** p=3 r_min=1.5: 16 ит, `achieved 0.500 n_active 1266/2562 (49%) dt 21.4с watertight True` (CI `tests/test_mbb.py`).

- **Г-кронштейн 16³** (895 solid, pitch 4.875мм, free 4494 DOF): relief 0.4 `achieved 0.600 n_active 535 (60%) dt 5.0с watertight True`; relief 0.6 `achieved 0.400 n_active 353 (39%) dt 4.8с`; relief 0.2 требует `alu` workaround (CI `tests/test_bracket_oc.py`).

- **Корпус 100 моделей** (16³→32³ 120с, 150k, 4×25): parse 100/100, watertight 87/100, voxel 99/100, solve 86/100, инжен. 75/100, среднее 6.76с, всего 11.3мин (см. `docs/CORPUS_REPORT.md`).

- **Кирш** Kt ошибка **2.5%** (CI `tests/test_kirsch.py`), **CalculiX** cross-check **4.2%** (см. `ccx_report.md`, `docs/VERIFICATION.md`).

- **von Mises** полный B·D·B по 8 углам → на узлы; E в Па, h_m=pitch*1e-3; safety=`σyield/σmax` clamp ≤99, красное «деталь течёт» при `safety<1`. PLA FDM ортотропная: E∥3.5/E⊥2.7 ГПа, два запаса ⊥/∥ (см. `docs/MATERIALS.md`).

- **Фильтр** `uniform_filter reflect r=1.5` <2% объёма; Taubin fallback. **Тайм-аут** 45с → предложение 32³.

- **Пределы**: 32³/48³ в CI не гоняются (timeout/OOM); поддерживается 16³ и MBB 60×20×1.

## Сборка

- Windows 10/11 x64 WebView2, PyInstaller --onefile --collect-all → `dist/OpenLight.exe` ≥80 МБ (проверено в Build), `build_exe.bat`. Версия из `build/make_version.py` → `VERSION`, окно «О программе» читает `VERSION`+`LICENSE`+GitHub.

## Форматы

- STL/OBJ — поддерживаются. STEP (.step/.stp) — заглушка `v1.1, OCCT` (не поддерживается в v1.0.0).

## Чего нет в v1.0.0

- Buckling/потеря устойчивости, усталость, контактная задача, пластическое течение — не моделируется.
- Инженерная пригодность — оценочная, подтверждать независимым расчётом/испытанием.

## Офлайн

- Офлайн после `python build/vendor.py` (three.js r160, 7 файлов SHA256). Network 0.
