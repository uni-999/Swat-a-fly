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

## Current Modular Layout (2026-02)

Entry:
- `script.js` -> calls `bootstrapApp()` from `src/game/app.js`.

Composition root:
- `src/game/app.js` wires all module APIs and starts the app.

Core modules:
- `src/game/config.js`: gameplay constants/config.
- `src/game/catalog.js`: snakes, tracks, pickups, bot profiles.
- `src/game/utils.js`: math/common helpers.
- `src/game/trackMath.js`: track projection/sampling/runtime build.
- `src/game/state.js`: shared DOM handles + mutable app state.

Gameplay modules:
- `src/game/simulation.js`: movement, anti-stall recovery, body-crossing rules, collisions.
- `src/game/simBodySystem.js`: snake body, hunger, effects, pickups and speed-floor helpers.
- `src/game/simProgress.js`: checkpoint progress and standings.
- `src/game/ai.js`: bot steering/targeting + venom behavior.
- `src/game/raceFlow.js`: countdown/race loop/finish/results orchestration.
- `src/game/raceSetup.js`: race state creation + spawn generation/validation.

UI/Scene modules:
- `src/game/hud.js`: HUD labels/standings/effect text.
- `src/game/coreUi.js`: overlay/countdown, toast, time formatting, render wrappers.
- `src/game/uiFlow.js`: screen navigation, cards, hotkeys, race start/restart.
- `src/game/scene.js`: Phaser scene bootstrap + background keep-alive + track music.

Support modules:
- `src/game/titleWave.js`: animated title behavior.
- `src/game/raceDurationStats.js`: average race duration stats for title crawl pacing.

- 2026-02 step-13: src/game/simBodySystem.js owns snake body, hunger, effects, pickups and speed-floor helpers.
- 2026-02 step-14: src/game/simProgress.js owns checkpoint progress and standings; src/game/simulation.js is now physics/collision focused.
