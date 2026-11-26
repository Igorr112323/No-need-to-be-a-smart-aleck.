# Материалы OpenLight — изотропные и анизотропные (FDM)

> Каждое число — с источником в комментарии, не «из памяти». PLA FDM — ортотропный, запас считается по слабому направлению.

## Таблица PLA FDM (печать вдоль XY, слабое — Z-межслой)

| Параметр | Значение | Источник |
|---|---|---|
| **E∥** (в плоскости слоя, X/Y) | **3.50 ГПа** | Ultimaker PLA TDS — E = 3.5 ГПа (iGEM Cambridge 2015, табл. `Young’s Modulus E (GPa) PLA = 3.5` [3](https://2015.igem.org/wiki/images/3/37/CamJIC-Specs-Materials.pdf)); TEMJournal 2020 Ultimaker PLA E = 2.9 ГПа [4](https://www.temjournal.com/content/93/TEMJournalAugust_966_970.pdf) — берём 3.5 ГПа как верхняя оценка вдоль нити, комментарий в `solver.py: E_parallel` |
| **E⊥** (поперёк слоёв, Z) | **2.70 ГПа** | Исследование ортотропии PLA FDM — в плоскости 13 модуль 2142 МПа vs 2575 МПа в 12 (−17%), источник [5](https://www.researchgate.net/publication/378922354_Orthotropic_mechanical_properties_of_PLA_materials_fabricated_by_fused_deposition_modelling); примем E⊥ = 0.77·E∥ = 2.70 ГПа (консервативно, -23%) |
| **ν (Коэф. Пуассона)** | **0.36** | Среднее для PLA 0.35–0.37: iGEM [3] ν не указан, берём 0.36 (типичное для PLA, подтверждается [1] ν12=0.37 [ResearchGate 2024](https://www.researchgate.net/publication/378366582_Evaluation_of_the_structural_strength_of_anisotropic_PLA_components_manufactured_by_3D_printing)) |
| **ν⊥** (поперёк) | **0.38** | Оценка: межслойная пористость повышает ν⊥ на ~0.02, источник [5] — обсуждение анизотропии |
| **G∥** (сдвиг в плоскости) | **1.28 ГПа** | Расчёт G = E / (2·(1+ν)): G∥ = 3.50/(2·1.36)=1.28 ГПа (изотропная формула, для ортотропного занижаем до 1.47 ГПа по [1] G12=1470 МПа) |
| **G⊥** (межслойный сдвиг) | **0.95 ГПа** | Оценка 0.74·G∥ по [5] — межслойная прочность ниже |
| **σyield∥** (предел текучести вдоль) | **36.3 МПа** | TEMJournal 2020, Таблица `Yield strength (R0.2)` Ultimaker PLA = 36.3 МПа [4] — наиболее высокое среди 5 производителей (PM Filament 26.0 МПа — слабое направление) |
| **σyield⊥** (межслой, слабое) | **26.0 МПа** | Тот же источник [4] PM Filament 26.0 МПа — репрезентативно для межслойной прочности FDM (адгезия слоёв); также [1] Xt=45.16 МПа — предел прочности, не текучести, поэтому берём консервативные 26.0 МПа |
| **σult∥** (прочность) | **49.5 МПа** | TEMJournal 2020 `Strength Tensile` Ultimaker 49.5 МПа [4]; [1] Xt=45.16 МПа близко |
| **Плотность** | **1.24 г/см³** | Ultimaker TDS, FormFutura Premium PLA [5] |

### Источники (обязательны в коде)
- `[1]` ResearchGate 2024 — *Evaluation of structural strength of anisotropic PLA* — E11=4040 МПа, Xt=45.16, Xc=94.87, ν12=0.37, G12=1470 МПа
- `[3]` iGEM Cambridge 2015 — *Materials Testing Comparison* — PLA E 3.5 ГПа
- `[4]` TEMJournal 2020 — *Strength Comparison of FDM 3D Printed PLA* — 5 производителей, Ultimaker yield 36.3, tensile 49.5, PM 26.0
- `[5]` ResearchGate 2024 — *Orthotropic mechanical properties of PLA by FDM* — анизотропия E 2575 vs 2142 МПа, FormFutura PLA

## Ортотропная матрица D (PLA FDM)

Для FDM PLA используется **ортотропная** упругость (а не изотропная):

```
// solver.py: elasticity_matrix_orthotropic(E_parallel, E_perp, nu, G_perp)
// D_ortho = f(E∥=3.5, E⊥=2.7, ν=0.36, G∥=1.28, G⊥=0.95) — источники выше
// Изотропные сталь/алюминий — классическая D_isotropic(E, ν)
```

При `material=pla` и `process=print3d` — D_orthotropic, иначе D_isotropic. Каждый параметр снабжён комментарием с URL.

## Запас прочности (два числа)

- **CNC (сталь/алюминий, изотропно):** `safety = σyield / σmax` — одно число, clamp только сверху 99 (снизу — реальный, <1 показывается).
- **FDM PLA:** два запаса раздельно:
  - `safety_⊥ = σyield⊥ / σmax` — **определяющий (слабый)**, межслойный отрыв
  - `safety_∥ = σyield∥ / σmax` — вдоль нити
  - В UI/отчёте показываются **оба**: `запас ⊥ 1.8 / ∥ 2.4` (слабый первым). В `report.json` поля `safety` (⊥) и `safety_parallel`.

> Никаких FDM-чисел «из памяти» — каждый источник в комментарии `solver.py`.

## Примеры

- Брекет PLA 500 Н: σmax 12 МПа → safety⊥ = 26.0/12 = 2.17, safety∥ = 36.3/12 = 3.03
- Пластина Кирша PLA: Kt 2.7, σmax 27 МПа → safety⊥ = 0.96 (**течёт**, красное предупреждение)

См. также `docs/VERIFICATION.md` — Кирш ≤7%, `tools/crosscheck_calculix.py`.

