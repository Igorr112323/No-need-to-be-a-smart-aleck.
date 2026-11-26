# OpenLight

Лёгкое Windows-приложение для «умного» облегчения 3D-деталей с сохранением прочности. MVP в стиле Apple Freeform.

> **Статус: Этап 2 — 3D-сцена.** Парит Г-кронштейн (процедурная геометрия Shape/Extrude + bevel, 3 отверстия), мягкая тень на полу, OrbitControls с damping, raycaster. Расчёт — имитация; реальный SIMP+МКЭ — Этап 7.

## Запуск

```bash
pip install -r requirements.txt
python main.py
# или
python openlight/main.py
```

Окно 1400×900, заголовок «OpenLight», dot-grid сквозь прозрачный canvas. Вращение — ЛКМ, зум — колесо, панорама — ПКМ. Клик по детали пишет `pick {point, normal}` в консоль. Консоль чистая, 60 FPS.

Быстрая отладка без Python: открой `web/index.html` (или `openlight/web/index.html`) в браузере — всё офлайн, ассеты в `web/vendor/`.

## Структура

```
openlight/
  main.py          # pywebview окно 1400x900
  web/
    index.html     # Freeform каркас + <canvas id="scene"> + importmap
    css/app.css    # dot-grid + стеклянные пилюли + canvas
    js/app.js      # Three.js сцена (ES-модуль)
    vendor/        # three.module.js, three.min.js, controls/OrbitControls.js (build/vendor.py)
  build/           # vendor.py — качает Three.js через api.github.com
  design/          # freeform-reference.jpg
```

Дубли в корне (`main.py`, `web/`) — для `python main.py` из корня.

## Трёхмерка (Этап 2)

- Камера-перспектива, изометрия (115,95,115), `OrbitControls` damping 0.07
- Свет: `Ambient 0.55` + `Directional` с `PCFSoft` тенями 2048 + заполняющий без теней; пол `ShadowMaterial 0.18`
- Деталь: два скруглённых параллелепипеда (56×78 и 56×70, толщина 10, r=7, bevel) с 3 отверстиями, `MeshStandard #C9CDD3 metalness 0.85 roughness 0.35`
- Raycaster: hover — подсветка кромок + `cursor:pointer`, click — `console.log('pick', …)`

## Сборка .exe

```bash
pyinstaller --onefile --windowed --name OpenLight openlight/main.py
```

## Честно про MVP

- Этапы 0–3 — имитация полей, Этап 7 — реальная математика (trimesh/numpy/scipy)
- Все ассеты локальные, без CDN/телеметрии, только OSS
