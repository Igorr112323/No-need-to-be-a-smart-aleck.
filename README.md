# OpenLight

Лёгкое Windows-приложение для «умного» облегчения 3D-деталей с сохранением прочности. MVP в стиле Apple Freeform — чистый светлый холст, точечная сетка, парящие «пилюли».

> **Статус: Этап 6 — релиз MVP.** Полный сценарий Этапа 5 работает офлайн в `dist\OpenLight.exe`. Реальный воксельный SIMP+МКЭ — Этап 7.

## Требования

* **Windows 10 / 11 x64** (чистый профиль без Python — достаточно `OpenLight.exe`)
* **WebView2** — встроен в Windows 11. Для Windows 10 установите Evergreen-загрузчик Microsoft:
  <https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section> → *Evergreen Bootstrapper*
* Для сборки из исходников: **Python 3.10+** (с галочкой *Add to PATH*) + `pip`

> **Интернет нужен только один раз, для вендора** — `python build/vendor.py` скачивает `three.module.js` и др. в `web/vendor/`. Дальше всё офлайн, ни одного запроса в сеть (проверьте DevTools → Network).

## Быстрый старт без сборки

```bash
pip install -r requirements.txt
python main.py
# или
python openlight/main.py
```

Окно 1400×900, заголовок `OpenLight`, dot-grid сквозь прозрачный canvas. `ЛКМ` вращение, `колесо` зум, `ПКМ` панорама, `Esc` выход. `Ctrl+S` сохранить проект, `Ctrl+O` открыть.

## Сборка в 5 команд (Windows)

```bat
:: 1. Клонировать
git clone https://github.com/.../No-need-to-be-a-smart-aleck.git
cd No-need-to-be-a-smart-aleck.

:: 2. Проверить Python
python --version

:: 3. Зависимости
pip install -r requirements.txt

:: 4. Вендор — интернет только здесь (скачает Three.js r160)
python build/vendor.py

:: 5. Сборка exe (проверит Python, поставит зависимости, запустит вендор и PyInstaller)
build_exe.bat
:: Готово: dist\OpenLight.exe  (~45 МБ, <60 МБ)
```

Вручную без `.bat`:
```bash
pip install -r requirements.txt
python build/vendor.py
pyinstaller --onefile --windowed --name OpenLight --icon assets/openlight.ico --add-data "web;web" --add-data "assets;assets" main.py
```

Иконка: `python build/make_icon.py` (нужен `Pillow`) — генерирует `assets/openlight.ico` (белый глиф-пилюля с молнией на `#007AFF`, радиус как у macOS).

## Как проверить офлайн

1. Соберите `dist\OpenLight.exe` один раз с интернетом (`build/vendor.py`).
2. Отключите Wi-Fi / включите «Самолёт».
3. Двойной клик по `OpenLight.exe` → полный сценарий Этапа 5 без сети:
   * папка → импорт STL с диска (например `samples/bracket.stl`)
   * опоры/силы/зоны + Undo, материал, «Оптимизировать» 3.8 с, карта/облегчённая/шторка, слайдер 20/40/60, метрики, предупреждения
   * экспорт `optimized.stl` и проект `.olight.json` + последние 5 + автосейв
4. Откройте DevTools в собранном приложении (если `debug=True`) → вкладка Network пустая — ни одного запроса.

## Что есть / чего нет

| Есть в MVP (Этапы 0–6) | Чего нет (до Этапа 7) |
|---|---|
| Открытие `.exe` без установки, окно 1400×900, Freeform-стиль | Реальный воксельный SIMP+МКЭ — пока демо-поле (гаусс у опор/сил) |
| Импорт STL/OBJ с диска (диалог через `pywebview`), bbox-центрирование | STEP — диалог есть, парсинг позже |
| Опоры, силы (Н), запретные зоны, материал Сталь/АМг6/PLA, ЧПУ/3D-печать | CAE-расчёт «на прочность» как в APM FEM — не по силе, а по простоте |
| Оптимизация-демо 3.8–4.6 с, карта напряжений `синий→коралл` + легенда, облегчённые 20/40/60% + шторка До/После | Истинная топо-оптимизация — синтетические эллипсы, кэш <300 мс |
| Сохранение `optimized.stl` (валидный STL) + проекты `.olight.json`, последние 5, автосейв 800 мс | Отчёт PDF — тост «будет в Этапе 6» |
| Иконка `assets/openlight.ico`, `build_exe.bat`, `build/vendor.py` с SHA256 | Поддержка macOS/Linux — только Windows |

## Структура

```
openlight/
  main.py                # pywebview + Api (open_model/save_stl/save_project/open_project/get_app_info/autosave/recent)
  web/
    index.html           # canvas + доки + поповеры + легенда/шторка/восстановление
    css/app.css          # dot-grid + пилюли + progress/legend/shutter/recent
    js/state.js          # состояние + честный вес 52.48 см³
    js/app.js            # Three.js + STLLoader/OBJLoader/STLExporter + демо-оптимизация + проекты
    vendor/              # three.min.js, three.module.js, OrbitControls.js, STLLoader.js, STLExporter.js (build/vendor.py)
  build/vendor.py        # качает Three.js r160 с SHA256, интернет только раз
  build/make_icon.py     # PIL → assets/openlight.ico (пилюля с искрой на #007AFF)
  assets/openlight.ico / .png
build_exe.bat            # проверка python → pip → vendor → PyInstaller → dist\OpenLight.exe
```

Дубли в корне для `python main.py`.

## Финальный чек-лист релиза

* [ ] `dist\OpenLight.exe` <60 МБ (обычно ~38–48 МБ)
* [ ] Двойной клик на чистой Windows 10/11 без Python → окно
* [ ] Все этапы сценария без интернета: импорт STL → опоры/силы → Оптимизировать → Вид×4 → слайдер → шторка → Экспорт STL + проект → автосейв/восстановление
* [ ] DevTools → Network — 0 запросов
* [ ] Иконка в панели задач — белая пилюля с молнией на синем квадрате
