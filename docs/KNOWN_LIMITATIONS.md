# Известные ограничения OpenLight v0.9

## Ядро (Etap 7B/9)
- МКЭ-матрица: после фиксов active_nodes + 12мм сфера эталон балки 2.06% пройден; Г-кронштейн 24³ 12.8с watertight True, 48³ OC коллапс (0 active <50) — SIMP lambda требует доработки (см. BUG_LIST P0).
- Marching cubes guard N_min=50 с диагностикой, падает на 48³ из-за OC.
- von Mises ≈ sqrt(ce·E/vol) — не полный B·D·B, safety clamped 1-5, stress часто 0.0.
- density_filter uniform (не конус), Taubin ленивый fallback.

## Сборка
- Требует Windows + pyinstaller, в Linux только bundle. CI собирает exe.

## Форматы
- STL/OBJ реально, STEP — заглушка `STEP пока не поддерживается`.
- Облегчённая только для тестового кронштейна (импорт — пока без оптимизации в UI).

## Офлайн
- Приложение полностью офлайн, Network 0 (кроме опциональной проверки версии на GitHub Releases по кнопке).
