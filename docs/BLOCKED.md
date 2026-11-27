# BLOCKED — где нужен человек (27.11.2026) — актуализировано

> Фиксируем всё, где без куратора нельзя, и идём дальше.

## 1. Rename репозитория (403, куратор)
- **Что:** `Igorr112323/No-need-to-be-a-smart-aleck.` (с точкой) → `Igorr112323/OpenLight` — бейджи `OpenLight` 404, `GITHUB_URL` расходится
- **Причина:** `gh api repos/.../rename → 403 Resource not accessible` (нет прав Arena)
- **Действие куратора:** GitHub Settings → General → Repository name → убрать точку → `git remote set-url origin https://github.com/Igorr112323/OpenLight.git`
- **Статус:** BLOCKED

## 2. LICENSE (MIT-placeholder ждёт)
- **Что:** `LICENSE` MIT-placeholder, в окне «О программе» `MIT (ожидает выбора куратора)`
- **Действие куратора:** выбрать MIT/другую → обновить `LICENSE` → `git commit`
- **Статус:** BLOCKED, не трогать

## 3. Windows GUI (куратор)
- **Что:** Чек-лист `docs/TESTING.md` 24 шага — запуск `OpenLight.exe` на Windows 10/11, клики, импорт STL, оптимизация, экспорт
- **Причина:** Linux-песочница без дисплея — `pywebview` не стартует, только headless Chromium via `http.server`
- **Действие куратора:** `OpenLight.exe --selftest` → двойной клик → по TESTING.md → логи в BUG_LIST
- **Статус:** BLOCKED — в QA_REPORT «Windows GUI: НЕ ВЫПОЛНЕНО (куратор)»

## 4. Теги/релиз v1.0.0 (куратор)
- **Что:** Теги `v*` → Build windows-latest → Release `OpenLight.exe` (Artifacts 14 дней)
- **Действие куратора:** `git tag -a v1.0.0 -m "..." && git push origin v1.0.0` → Build success → Release
- **Статус:** BLOCKED, агент теги не создаёт (кроме существующих v1.0.x)
