# ПОЛЗУНКИ: структура кода

## Текущее состояние

- Фронтенд: один большой файл `script.js` (игровая логика, AI, физика, рендер, UI, утилиты).
- Матч-сервер: `match-server/src/raceRoom.js` + `match-server/src/nakamaClient.js`.
- Nakama runtime: `backend/nakama/modules/main.lua`.

## Целевая разбивка фронтенда

1. `src/game/config.js`
- Все константы и параметры геймплея.

2. `src/game/catalog.js`
- `SNAKES`, `TRACK_DEFS`, профили ботов, типы пикапов.

3. `src/game/state.js`
- `ui`, `state`, bootstrap и переключение экранов.

4. `src/game/simulation.js`
- Цикл гонки, физика, правила столкновений, голод, анти-залипание.

5. `src/game/ai.js`
- Логика NPC и выбор целей (яблоки/траектория/яд).

6. `src/game/render.js`
- Отрисовка трассы, змей, спрайтов, HUD.

7. `src/game/track-math.js`
- Геометрия трассы: projection/sample/interpolation.

8. `src/game/utils.js`
- Общие утилиты (`clamp`, `lerp`, `wrapAngle` и т.д.).

## Правила для следующих рефакторов

- Сначала переносить чистые функции без побочных эффектов.
- После каждого шага проверять `node --check` и ручной smoke-run.
- Не смешивать в одном коммите: изменение поведения и структурный перенос.
- Для новых механик сначала добавлять в нужный модуль, потом обновлять `README.md`.
