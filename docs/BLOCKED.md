# BLOCKED — где нужен человек (26.11.2026)

> Фиксируем всё, где без куратора нельзя, и идём дальше (не ждём ответов).

## 1. Переименование репозитория
- **Что:** `Igorr112323/No-need-to-be-a-smart-aleck.` (с точкой) → `Igorr112323/OpenLight` (без точки, соответствует бейджам и GITHUB_URL).
- **Причина:** `gh api repos/.../rename` → `403 Resource not accessible` (нет прав Arena). Попытка `git remote set-url` локально не меняет GitHub.
- **Действие куратора:** GitHub → Settings → General → Repository name → убрать точку → Save. Затем `git remote set-url origin https://github.com/Igorr112323/OpenLight.git` у всех клонов.
- **Статус:** BLOCKED, workaround `git clone .../repo` в build.yml уже удалён, основной build на `checkout@v4` зелёный, но бейджи 404 пока не починятся.

## 2. Выбор LICENSE
- **Что:** Сейчас `LICENSE` MIT-placeholder (в окне «О программе» `MIT (ожидает выбора куратора)`). Решение за куратором: MIT vs другой.
- **Действие:** куратор выбирает лицензию → обновить LICENSE файл → `git commit`.
- **Статус:** BLOCKED, не меняем без решения.

## 3. Релизный тег и публикация
- **Что:** Теги `v*` → Build → Release `OpenLight.exe`. По правилам задачи G1 тег создаёт только куратор.
- **Действие:** куратор `git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z` → проверить Build success → Release page.
- **Статус:** BLOCKED, агент не создаёт теги (кроме уже существующих v1.0.x по prior этапам).

## 4. Windows GUI клик-тест
- **Что:** Чек-лист `docs/TESTING.md` 24 шага — запуск `OpenLight.exe` на Windows 10/11, клики по всем кнопкам, импорт STL, оптимизация, экспорт.
- **Причина:** Linux-песочница без дисплея — `pywebview` не запускается, `npm run dev` preview exited, только headless Chromium через http.server.
- **Действие куратора:** Скачать `OpenLight.exe` из Release/Artifacts → `OpenLight.exe --selftest` → двойной клик → по чек-листу TESTING.md → логи/скрины в BUG_LIST.md.
- **Статус:** BLOCKED, честно в QA_REPORT.md «Windows GUI: НЕ ВЫПОЛНЕНО».

## 5. Расширение корпуса до 1000 реальных моделей (NASA/trimesh/Thingi10K)
- **Что:** Цель E1 200 реальных + 800 процедурных = 1000. Требует ручного отбора CC0/CC-BY/MIT/BSD, скачивания, проверки sha256, записи в manifest.json (каждая строка source_url raw.githubusercontent, license, sha256 измеренный).
- **Причина:** Лимит GitHub API, время CI (55мин/shard), объём скачивания >1ГБ — в песочнице не уложиться.
- **Действие:** куратор/агент партиями: `gh api repos/.../contents` → `sha256sum` → manifest.json → `git commit qa: corpus +N`.
- **Статус:** BLOCKED частично — в этой кампании делаем 100→200 реальных + 50 процедурных демо, полный 1000 — честно указываем фактическое число.

## 6. Субъективная оценка дизайна
- **Что:** «Красиво/нет», удобство Freeform-стиля.
- **Статус:** BLOCKED — не измеряется автоматикой, только человек.

