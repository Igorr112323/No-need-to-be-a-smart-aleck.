# OpenLight

Лёгкое Windows-приложение для «умного» облегчения 3D-деталей с сохранением прочности. MVP в стиле Apple Freeform.

> **Статус: Этап 5 — Python js_api.** Импорт STL, проекты `.olight.json`, последние файлы, автосейв. Демо-оптимизация как в Этапе 4 (без МКЭ), честно подписана.

## Запуск

```bash
pip install -r requirements.txt
python main.py
# или
python openlight/main.py
```

Окно 1400×900, заголовок «OpenLight», dot-grid сквозь canvas. `ЛКМ` вращение, `колесо` зум, `ПКМ` панорама, `Esc` выход. `Ctrl+S` сохранить проект, `Ctrl+O` открыть.

Быстрая отладка без Python: `web/index.html` в браузере — падение на `localStorage`/`Blob` (без нативных диалогов).

## Что нового в Этапе 5

1. **Импорт модели** — кнопка *папка* в правой капсуле (рядом с Undo). `api.open_model()` → нативный диалог `STL/OBJ/STEP`; STL парсится `STLLoader` локально, bbox центрируется, встроенный кронштейн заменяется импортом, метки сбрасываются. Ошибки — тост, не `alert`.
2. **Экспорт STL** — `api.save_stl(b64, 'optimized.stl')` → нативное «Сохранить как»; в браузере — `Blob`.
3. **Проекты** — `api.save_project()/open_project()` формат `.olight.json`:
   ```json
   {version, material, process, targetRelief, supports[], forces[], keepZones[], cameraPosition}
   ```
   В поповере «…» — *Сохранить… / Открыть…* + список последних 5 (клик — открыть). Путь к `appData` из `api.get_app_info()` (`%APPDATA%\OpenLight`).
4. **Автосейв** — `debounce 800 мс` при изменении состояния → `api.autosave()`. При старте если `autosave.olight.json` свежее 7 дней — поповер «Восстановить прошлую работу? Да/Нет».
5. Вся работа с FS только через `api.*`.

## Структура

```
openlight/
  main.py                # pywebview 1400×900 + класс Api (open_model/save_stl/save_project/open_project/get_app_info/autosave/recent)
  web/
    index.html           # canvas + доки + 6 поповеров + легенда/шторка/восстановление
    css/app.css          # dot-grid + пилюли + progress/legend/shutter/recent
    js/state.js          # состояние + честный вес
    js/app.js            # Three.js + STLLoader/OBJLoader + STLExporter + демо-оптимизация + проекты (ES-модуль)
    vendor/              # three.module.js, OrbitControls, STLLoader, OBJLoader, STLExporter
  build/vendor.py        # качает Three.js через api.github.com
  design/freeform-reference.jpg
```

Дубли в корне для `python main.py`.

## Демо-оптимизация (Этап 4)

Фазы 3.8–4.6 с, синтетическое поле (гаусс у опор/сил/отверстий), карта `синий→коралл` + легенда, 3 кэша `20/40/60%` с эллипсами, шторка `scissor`, метрики `412 г→247 г −40% 2,1`, предупреждения, `optimized.stl`.

## Стек

Python 3 + pywebview/WebView2, vanilla HTML/CSS/JS + Three.js локально, PyInstaller `--onefile --windowed`. Только OSS, офлайн.
