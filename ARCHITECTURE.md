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
- `src/game/simulation.js`: thin facade that re-exports race simulation API.
- `src/game/simMotion.js`: racer movement/coasting step primitives.
- `src/game/simInteractions.js`: body-crossing rules, anti-stall recovery, racer collisions.
- `src/game/simBodySystem.js`: thin facade that re-exports body/effect API.
- `src/game/simBodyCore.js`: body segments, heading alignment, speed floors and effect multipliers.
- `src/game/simItemEffects.js`: hunger ticks, pickups/body-items, effect application/removal.
- `src/game/simProgress.js`: checkpoint progress and standings.
- `src/game/aiTargeting.js`: apple attraction and target blending.
- `src/game/aiAvoidance.js`: hazard/edge avoidance vectors and safe target shift.
- `src/game/aiSteering.js`: steering decision assembly (throttle/brake/turn) using targeting + avoidance.
- `src/game/venomSystem.js`: venom targeting, projectile lifecycle and hit effects.
- `src/game/ai.js`: thin AI facade composing steering + venom systems.
- `src/game/raceFlow.js`: countdown/race loop/finish/results orchestration.
- `src/game/raceSetup.js`: race state creation + spawn generation/validation.

UI/Scene modules:
- `src/game/hud.js`: HUD labels/standings/effect text.
- `src/game/coreUi.js`: overlay/countdown, toast, time formatting, render wrappers.
- `src/game/renderWorld.js`: background, track, checkpoints, pickups/body-items, venom visuals.
- `src/game/renderRacers.js`: racer body/trail rendering, snake sprites and labels sync.
- `src/game/render.js`: thin render orchestrator (race vs idle screen).
- `src/game/uiFlow.js`: screen navigation, cards, hotkeys, race start/restart.
- `src/game/scene.js`: Phaser scene bootstrap + background keep-alive + track music.

Support modules:
- `src/game/titleWave.js`: animated title behavior.
- `src/game/raceDurationStats.js`: average race duration stats for title crawl pacing.

- 2026-02 step-13: src/game/simBodySystem.js owns snake body, hunger, effects, pickups and speed-floor helpers.
- 2026-02 step-14: src/game/simProgress.js owns checkpoint progress and standings; src/game/simulation.js is now physics/collision focused.
- 2026-02 step-15: AI split into src/game/aiSteering.js and src/game/venomSystem.js; src/game/ai.js became a composition facade.
- 2026-02 step-16: render split into src/game/renderWorld.js and src/game/renderRacers.js; src/game/render.js now orchestrates them.
- 2026-02 step-17: simulation internals split into src/game/simMotion.js and src/game/simInteractions.js; src/game/simulation.js became a re-export facade.
- 2026-02 step-18: body/effects internals split into src/game/simBodyCore.js and src/game/simItemEffects.js; src/game/simBodySystem.js became a re-export facade.
- 2026-02 step-19: aiSteering internals split into src/game/aiTargeting.js and src/game/aiAvoidance.js; src/game/aiSteering.js now focuses on final control synthesis.
