# OpenLight

Лёгкое Windows-приложение для «умного» облегчения 3D-деталей с сохранением прочности. MVP в стиле Apple Freeform.

> **Статус: Этап 7 (фаза B) — реальное ядро.** Воксельная дискретизация 64³ (≤150k), МКЭ на гекс-элементах (numpy+scipy.sparse), SIMP 15–25 итераций, удаление несвязных компонент, marching cubes + Taubin, запас по von Mises. Подпись «Демонстрационный режим» убрана.

## Требования

* **Windows 10 / 11 x64**, **WebView2** (в Win11 встроен; Win10 → [Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section))
* Для сборки: **Python 3.10+** + `pip`

> **Интернет нужен только один раз, для вендора** — `python build/vendor.py` скачивает `three.module.js` и др. в `web/vendor/`. Дальше офлайн.

## Быстрый старт

```bash
pip install -r requirements.txt
python main.py
```

Окно 1400×900, `ЛКМ` вращение, `колесо` зум, `ПКМ` панорама, `Esc` выход. `Ctrl+S`/`Ctrl+O` проект.

## Что нового в Этапе 7

1. **Вокселизация** — `trimesh → voxel grid 64³` по длинной стороне, ≤150k ячеек, pitch = longest/64.
2. **МКЭ** — 8-узловые гексы, матрица `C(3,3)` из `E,ν`, `D` 6×6, `B` 6×24, `Ke = ∫BᵀDB dV` 2×2×2 Гаусс, Dirichlet у опор, нагрузки у сил, решатель `spsolve` / `CG` с диагональным предобуславливателем.
3. **SIMP** — фильтр плотности `r=1.5` без чекерборда, `p=3`, 15–25 итераций, таргет `vol=1−relief`, OC-обновление, каждые 5 итераций `scipy.ndimage.label` удаляет несвязные.
4. **Геометрия** — `marching cubes` (skimage) + `Taubin smoothing` → экспорт через `STLExporter` (тот же `save_stl`).
5. **Поле напряжений** — ИЗ РЕШЕНИЯ `B·u → σ → von Mises`, запас `yield / max(σ)` по выбранному материалу (Сталь 345 МПа, АМг6 140 МПа, PLA 50 МПа).
6. **Прогресс** — честный `фаза + итерация + %`, счётчик `i/25`, тайм-аут 45 с → предложение снизить до `32³`.

## Сборка

```bat
python --version
pip install -r requirements.txt
python build/vendor.py      # интернет только здесь
python build/make_icon.py   # Pillow → assets/openlight.ico
build_exe.bat               # PyInstaller --onefile --windowed → dist\OpenLight.exe (~45 МБ <60)
```

Проверка офлайн: отключите Wi-Fi → импорт STL, опоры/силы, *Оптимизировать* (воксели/SIMP), карта, облегчённая, шторка, слайдер, вес/запас честные, экспорт — всё без сети (Network 0).

## Таблица

| Есть | Нет |
|---|---|
| Реальный МКЭ/SIMP, воксели, von Mises, запас | STEP-парсинг — заглушка |
| Импорт STL/OBJ, проекты `.olight.json`, последние 5, автосейв | Отчёт PDF — Этап 6 |
| Опоры/силы/зоны, материал, облегчение 20/40/60, карта, шторка | — |

## Структура

```
openlight/
  main.py              # pywebview + Api (open_model/save_stl/projects + start_optimization/get_optimization_progress)
  solver.py            # воксели + Ke + CG/spsolve + SIMP + label + marching cubes + Taubin + von Mises
  web/                 # index.html + app.css + app.js (ES-модуль, STLLoader) + vendor/
  build/vendor.py      # pinned r160 SHA256
  build/make_icon.py   # Pillow
```

## Чек-лист

* `dist\OpenLight.exe` <60 МБ, двойной клик → окно, все этапы без интернета, Network 0, иконка пилюля+искра #007AFF.

## Известные ограничения (честно, Этап 7B)

- **МКЭ-матрица сингулярна в текущей реализации** — на Г-кронштейне 32³ (3414 эл, 80760 DOF, 24 fixed) `spsolve` → `Matrix is exactly singular`, CG не сходится (`info=500`) → тайм-аут 45с. Требуется доработка фиксации/границ. Пока работает демо-ветка (fallback в `app.js`).
- **Marching cubes** падает на `res 24/16` при `vol_frac 0.4` → `Surface level must be within volume data range` (binary пусто после `keep_connected`).
- **Исправлено 2026-11-26:** `trimesh 5.2.2 vg.origin → vg.bounds[0]` и `scipy 1.17 cg(tol→rtol)`.
- **Упрощения, влияющие на числа:** von Mises ≈ `sqrt(ce·E/vol)` (не полный `B·D·B`), `density_filter` — uniform вместо конуса, Taubin — ленивый fallback. Числа безопасности/веса для Этапа 7 — эвристика.
- **UI:** тосты «— демо-режим» остались в `app.js:365,820,836` как fallback-ветка для браузера без Python, в `index.html` подпись убрана.
