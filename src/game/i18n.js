const LANGUAGE_STORAGE_KEY = "polzunki_ui_lang_v1";
const DEFAULT_LANGUAGE = "ru";
const SUPPORTED_LANGUAGES = new Set(["ru", "en"]);

const UI_TEXT = {
  ru: {
    "meta.title": "ПОЛЗУНКИ",
    "header.subtitle": "Аркадная гонка змей: классика 1+3 бота и режим отладки 4 бота",
    "lang.toggleAria": "Сменить язык на {lang}",

    "menu.rules": "Правила",
    "menu.playerNameLabel": "Имя игрока (онлайн)",
    "menu.playerNamePlaceholder": "Введите имя",
    "menu.playOffline": "Играть офлайн",
    "menu.playOnline": "Играть онлайн",
    "menu.leaderboard": "Таблица лидеров",
    "menu.about": "Об игре",

    "leaderboard.title": "Таблица лидеров",
    "leaderboard.track": "Трасса",
    "leaderboard.refresh": "Обновить",
    "leaderboard.initial": "Выберите трассу и обновите таблицу.",
    "leaderboard.header.rank": "#",
    "leaderboard.header.player": "Игрок",
    "leaderboard.header.track": "Трасса",
    "leaderboard.header.bestTime": "Лучшее время",
    "leaderboard.empty": "Нет записей для выбранной трассы.",
    "leaderboard.loading": "Загрузка: {track}...",
    "leaderboard.loaded": "Трасса: {track}. Записей: {count}.",
    "leaderboard.disabled": "Nakama отключен: таблица пока пустая.",
    "leaderboard.unavailable": "Сервис лидерборда недоступен.",
    "leaderboard.loadFailed": "Не удалось загрузить таблицу: {error}",

    "snake.title": "Выбор змеи",
    "snake.modeClassicBtn": "Классика: 1 игрок + 3 бота",
    "snake.modeDebugBtn": "Отладка: 4 бота",
    "snake.modeClassicNote": "Режим классики: вы управляете змеёй, остальные 3 - боты.",
    "snake.modeDebugNote": "Режим отладки: все 4 змеи на автопилоте.",
    "snake.stat.maxSpeed": "Макс. скорость: {value}",
    "snake.stat.turn": "Поворот: {value}",
    "snake.stat.offroadPenalty": "Штраф вне дороги: {value}%",

    "track.title": "Выбор трассы",
    "track.onlineRoomLabel": "Комната (онлайн)",
    "track.onlineAuto": "Авто: подключиться или создать",
    "track.onlineRoomPlaceholder": "Или введите ID комнаты вручную",
    "track.onlineRoomRefresh": "Обновить список",
    "track.bestLocal": "Лучшее локальное: {value}",
    "track.roadWidth": "Ширина трассы: {value}",

    "common.back": "Назад",
    "common.next": "Дальше",
    "common.start": "Старт",
    "common.retry": "Повторить",
    "common.nextTrack": "Следующая трасса",

    "hud.time": "Время",
    "hud.speed": "Скорость",
    "hud.position": "Позиция",
    "hud.effect": "Эффект",
    "hud.order": "Порядок",
    "hud.controls1": "Управление: W/A/S/D или стрелки",
    "hud.controls2": "R: рестарт трассы",
    "hud.touchHint": "Джойстик: вверх газ, вниз тормоз, в стороны поворот",
    "hud.speedValue": "{value} км/ч",
    "hud.progressCp": "КП {value}",
    "hud.progressNext": "КП {checkpoints} | до следующей {distance}px",

    "results.title": "Результаты заезда",
    "results.header.rank": "#",
    "results.header.participant": "Участник",
    "results.header.snake": "Змея",
    "results.header.finish": "Финиш / прогресс",
    "results.progressMeters": "Прогресс: {value} м",

    "rules.title": "Правила ПОЛЗУНКИ",
    "rules.goal1": "Цель заезда: пройти <strong>3 круга</strong> и показать лучшее время.",
    "rules.goal2": "На старте есть короткий бриф, затем отсчёт <strong>3..2..1</strong> и GO.",
    "rules.bodyTitle": "Длина тела змеи",
    "rules.bodyLong": "Длинное тело даёт стабильный темп: меньше штрафов к скорости и проще держать траекторию.",
    "rules.bodyShort": "Короткое тело опасно: чем меньше сегментов, тем сильнее замедление и выше риск проиграть по времени.",
    "rules.snakesTitle": "Типы змей",
    "rules.objectsTitle": "Объекты на трассе",

    "rules.speedster.title": "Скоростник",
    "rules.speedster.desc": "Максимальная скорость выше всех, но змея тяжелее заходит в повороты.",
    "rules.speedster.p1": "Сильная сторона: быстрые прямые.",
    "rules.speedster.p2": "Риск: легко пролететь апекс в узкой связке.",

    "rules.handler.title": "Рулевой",
    "rules.handler.desc": "Лучший контроль в поворотах и стабильный темп на техничных трассах.",
    "rules.handler.p1": "Сильная сторона: точные перекладки и удержание траектории.",
    "rules.handler.p2": "Риск: уступает топам по пиковой скорости.",

    "rules.bully.title": "Тяжеловес",
    "rules.bully.desc": "Тяжелый корпус и мощные контакты в борьбе, хорошо давит соперников.",
    "rules.bully.p1": "Сильная сторона: силовая дуэль и контроль пространства.",
    "rules.bully.p2": "Риск: инерционность в резких поворотах.",

    "rules.trickster.title": "Хитрец",
    "rules.trickster.desc": "Лучше держит темп вне дороги и прощает грубые ошибки по траектории.",
    "rules.trickster.p1": "Сильная сторона: уверенный выход с оффроуда.",
    "rules.trickster.p2": "Риск: менее жесткий контакт, чем у Тяжеловеса.",

    "rules.item.boost": "Скорость и разгон выше. Длительность: <strong>2.6 c</strong>.",
    "rules.item.shield": "Блокирует один негативный удар. Длительность: <strong>6.5 c</strong>.",
    "rules.item.apple": "+2 сегмента и короткий резкий рывок. Длительность буста: <strong>0.68 c</strong>.",
    "rules.item.oil": "Сложнее рулить, хуже разгон. Длительность: <strong>2.2 c</strong>.",
    "rules.item.bomb": "-1 сегмент и сильное замедление. Длительность: <strong>1.45 c</strong>.",
    "rules.item.cactus": "Шанс потери сегмента тела. Эффект мгновенный.",

    "about.title": "Об игре",
    "about.text":
      "Аркадная высокотехнологичная игра \"Ползунки\" создана 15 февраля 2026 года за 48 часов специально для хакатона «VMK Labs». Авторы: студенты первого курса института физики — Гром Арина, Чуклина Наталья, Климов Максим, Перун Вячеслав.",

    "race.goalOverlay": "ЦЕЛЬ: ПРОЙТИ 3 КРУГА НА МАКСИМАЛЬНОЙ СКОРОСТИ",
    "race.go": "GO",
    "race.finish": "ФИНИШ",
    "race.phase.rules": "Бриф",
    "race.phase.countdown": "Отсчёт",
    "race.phase.running": "Гонка",
    "race.phase.finished": "Финиш",
    "race.info.track": "Трасса",
    "race.info.phase": "Фаза",
    "race.info.time": "Время",
    "online.phase.lobby": "лобби",
    "online.phase.rules": "бриф",
    "online.phase.countdown": "отсчёт",
    "online.phase.running": "гонка",
    "online.phase.finished": "финиш",
    "online.phase.unknown": "неизвестно",

    "hud.hunger": "голод: {value}",
    "hud.hungerCrawl": "голод: {value} (ползком)",
    "hud.body": "тело: {value}",
    "hud.none": "нет",
    "hud.inRace": "в гонке",
    "hud.effect.shield": "Щит x{value}",
    "hud.effect.bombSlow": "Бомба: замедление",
    "hud.effect.boost": "Ускорение",
    "hud.effect.appleBoost": "Яблочный рывок",
    "hud.effect.oil": "Масло",
    "hud.effect.venom": "Яд",
    "hud.effect.shieldActive": "Щит",

    "toast.offlineActivated": "Офлайн-режим активирован.",
    "toast.onlineHint": "Онлайн MVP: выбери змею и трассу, затем нажми Старт для подключения к комнате.",
    "toast.onlineRoomsFailed": "Не удалось получить список комнат: {error}",
    "toast.onlineRoomsFound": "Комнат найдено: {count}",
    "toast.leaderboardUnavailable": "Лидерборд недоступен: {error}",
    "toast.leaderboardUpdated": "Лидерборд обновлён: {count} записей.",
    "toast.leaderboardScreenUnavailable": "Экран таблицы лидеров недоступен в этой сборке интерфейса.",
    "toast.onlineStalledFinish": "Онлайн-заезд завершен по прогрессу: движения нет слишком долго.",
    "toast.onlineFinish": "Финиш онлайн-заезда: таблица результатов обновлена.",
    "toast.onlineConnectFailed": "Не удалось подключиться к онлайн-комнате: {error}",
    "toast.onlineConnected": "Онлайн: подключено к комнате {room}{endpoint}.",
    "toast.debugRace": "DEBUG: 4 бота на автопилоте.",
    "toast.classicRace": "Классический офлайн: 1 игрок + 3 бота.",

    "fallback.player": "Игрок",
    "fallback.snake": "Змея",
    "fallback.online": "Онлайн",
  },
  en: {
    "meta.title": "POLZUNKI",
    "header.subtitle": "Arcade snake racing: classic 1+3 bots and debug 4-bot mode",
    "lang.toggleAria": "Switch language to {lang}",

    "menu.rules": "Rules",
    "menu.playerNameLabel": "Player name (online)",
    "menu.playerNamePlaceholder": "Enter name",
    "menu.playOffline": "Play Offline",
    "menu.playOnline": "Play Online",
    "menu.leaderboard": "Leaderboard",
    "menu.about": "About",

    "leaderboard.title": "Leaderboard",
    "leaderboard.track": "Track",
    "leaderboard.refresh": "Refresh",
    "leaderboard.initial": "Select a track and refresh the table.",
    "leaderboard.header.rank": "#",
    "leaderboard.header.player": "Player",
    "leaderboard.header.track": "Track",
    "leaderboard.header.bestTime": "Best time",
    "leaderboard.empty": "No records for this track.",
    "leaderboard.loading": "Loading: {track}...",
    "leaderboard.loaded": "Track: {track}. Records: {count}.",
    "leaderboard.disabled": "Nakama is disabled: table is currently empty.",
    "leaderboard.unavailable": "Leaderboard service is unavailable.",
    "leaderboard.loadFailed": "Failed to load leaderboard: {error}",

    "snake.title": "Choose Snake",
    "snake.modeClassicBtn": "Classic: 1 player + 3 bots",
    "snake.modeDebugBtn": "Debug: 4 bots",
    "snake.modeClassicNote": "Classic mode: you control one snake, the other 3 are bots.",
    "snake.modeDebugNote": "Debug mode: all 4 snakes use autopilot.",
    "snake.stat.maxSpeed": "Max speed: {value}",
    "snake.stat.turn": "Turn rate: {value}",
    "snake.stat.offroadPenalty": "Offroad penalty: {value}%",

    "track.title": "Choose Track",
    "track.onlineRoomLabel": "Room (online)",
    "track.onlineAuto": "Auto: join or create",
    "track.onlineRoomPlaceholder": "Or enter room ID manually",
    "track.onlineRoomRefresh": "Refresh list",
    "track.bestLocal": "Best local: {value}",
    "track.roadWidth": "Road width: {value}",

    "common.back": "Back",
    "common.next": "Next",
    "common.start": "Start",
    "common.retry": "Retry",
    "common.nextTrack": "Next track",

    "hud.time": "Time",
    "hud.speed": "Speed",
    "hud.position": "Position",
    "hud.effect": "Effect",
    "hud.order": "Order",
    "hud.controls1": "Controls: W/A/S/D or arrows",
    "hud.controls2": "R: restart track",
    "hud.touchHint": "Joystick: up throttle, down brake, sides steer",
    "hud.speedValue": "{value} km/h",
    "hud.progressCp": "CP {value}",
    "hud.progressNext": "CP {checkpoints} | next {distance}px",

    "results.title": "Race Results",
    "results.header.rank": "#",
    "results.header.participant": "Participant",
    "results.header.snake": "Snake",
    "results.header.finish": "Finish / progress",
    "results.progressMeters": "Progress: {value} m",

    "rules.title": "POLZUNKI Rules",
    "rules.goal1": "Race objective: complete <strong>3 laps</strong> with the best time.",
    "rules.goal2": "Before the start there is a short briefing, then <strong>3..2..1</strong> and GO.",
    "rules.bodyTitle": "Snake body length",
    "rules.bodyLong": "Long body gives stable pace: lower speed penalties and easier racing line control.",
    "rules.bodyShort": "Short body is risky: fewer segments mean stronger slowdown and higher chance to lose on time.",
    "rules.snakesTitle": "Snake types",
    "rules.objectsTitle": "Track objects",

    "rules.speedster.title": "Speedster",
    "rules.speedster.desc": "Highest top speed, but harder to place in technical corners.",
    "rules.speedster.p1": "Strength: fast straights.",
    "rules.speedster.p2": "Risk: easy to overshoot apex in tight sections.",

    "rules.handler.title": "Handler",
    "rules.handler.desc": "Best corner control and stable pace on technical tracks.",
    "rules.handler.p1": "Strength: precise direction changes and line holding.",
    "rules.handler.p2": "Risk: lower peak speed than top sprinters.",

    "rules.bully.title": "Bully",
    "rules.bully.desc": "Heavy body and stronger contact pressure in duels.",
    "rules.bully.p1": "Strength: close combat and space control.",
    "rules.bully.p2": "Risk: sluggish in sharp turns.",

    "rules.trickster.title": "Trickster",
    "rules.trickster.desc": "Keeps pace better offroad and forgives rough line mistakes.",
    "rules.trickster.p1": "Strength: confident exits from offroad.",
    "rules.trickster.p2": "Risk: weaker contact than Bully.",

    "rules.item.boost": "Higher speed and acceleration. Duration: <strong>2.6 s</strong>.",
    "rules.item.shield": "Blocks one negative hit. Duration: <strong>6.5 s</strong>.",
    "rules.item.apple": "+2 body segments and a short sharp burst. Boost duration: <strong>0.68 s</strong>.",
    "rules.item.oil": "Harder steering and slower acceleration. Duration: <strong>2.2 s</strong>.",
    "rules.item.bomb": "-1 segment and heavy slowdown. Duration: <strong>1.45 s</strong>.",
    "rules.item.cactus": "Chance to lose a body segment. Instant effect.",

    "about.title": "About",
    "about.text":
      "The arcade high-tech game \"Polzunki\" was created on February 15, 2026, in 48 hours for the VMK Labs hackathon. Authors: first-year physics institute students Arina Grom, Natalya Chuklina, Maksim Klimov, Vyacheslav Perun.",

    "race.goalOverlay": "GOAL: COMPLETE 3 LAPS AT MAXIMUM SPEED",
    "race.go": "GO",
    "race.finish": "FINISH",
    "race.phase.rules": "Briefing",
    "race.phase.countdown": "Countdown",
    "race.phase.running": "Race",
    "race.phase.finished": "Finish",
    "race.info.track": "Track",
    "race.info.phase": "Phase",
    "race.info.time": "Time",
    "online.phase.lobby": "lobby",
    "online.phase.rules": "briefing",
    "online.phase.countdown": "countdown",
    "online.phase.running": "race",
    "online.phase.finished": "finish",
    "online.phase.unknown": "unknown",

    "hud.hunger": "hunger: {value}",
    "hud.hungerCrawl": "hunger: {value} (crawl)",
    "hud.body": "body: {value}",
    "hud.none": "none",
    "hud.inRace": "racing",
    "hud.effect.shield": "Shield x{value}",
    "hud.effect.bombSlow": "Bomb: slowdown",
    "hud.effect.boost": "Boost",
    "hud.effect.appleBoost": "Apple burst",
    "hud.effect.oil": "Oil",
    "hud.effect.venom": "Venom",
    "hud.effect.shieldActive": "Shield",

    "toast.offlineActivated": "Offline mode activated.",
    "toast.onlineHint": "Online MVP: choose snake and track, then press Start to connect to a room.",
    "toast.onlineRoomsFailed": "Failed to get room list: {error}",
    "toast.onlineRoomsFound": "Rooms found: {count}",
    "toast.leaderboardUnavailable": "Leaderboard unavailable: {error}",
    "toast.leaderboardUpdated": "Leaderboard refreshed: {count} records.",
    "toast.leaderboardScreenUnavailable": "Leaderboard screen is unavailable in this UI build.",
    "toast.onlineStalledFinish": "Online race ended by progress fallback: no movement for too long.",
    "toast.onlineFinish": "Online race finished: results table updated.",
    "toast.onlineConnectFailed": "Failed to connect to online room: {error}",
    "toast.onlineConnected": "Online: connected to room {room}{endpoint}.",
    "toast.debugRace": "DEBUG: 4 bots on autopilot.",
    "toast.classicRace": "Classic offline: 1 player + 3 bots.",

    "fallback.player": "Player",
    "fallback.snake": "Snake",
    "fallback.online": "Online",
  },
};

const TRACK_TEXT = {
  ru: {
    canyon_loop: { name: "Каньонная петля", subtitle: "Быстрая трасса с затяжными связками" },
    switchback_run: { name: "Серпантин", subtitle: "Больше смен темпа и двойные апексы" },
    twin_fang: { name: "Двойной клык", subtitle: "Почти восьмерка с коварными перекладками" },
  },
  en: {
    canyon_loop: { name: "Canyon Loop", subtitle: "Fast track with long linked corners" },
    switchback_run: { name: "Switchback Run", subtitle: "More tempo changes and double apexes" },
    twin_fang: { name: "Twin Fang", subtitle: "Almost a figure-eight with tricky transitions" },
  },
};

const SNAKE_TEXT = {
  ru: {
    speedster: { name: "Скоростник", flavor: "Максимальная скорость выше всех, но сложнее входить в повороты" },
    handler: { name: "Рулевой", flavor: "Лучший контроль в поворотах" },
    bully: { name: "Тяжеловес", flavor: "Тяжелый корпус и более сильные толчки" },
    trickster: { name: "Хитрец", flavor: "Почти не теряет темп вне дороги" },
  },
  en: {
    speedster: { name: "Speedster", flavor: "Highest top speed, but harder corner entry" },
    handler: { name: "Handler", flavor: "Best corner control" },
    bully: { name: "Bully", flavor: "Heavy body and stronger pushes" },
    trickster: { name: "Trickster", flavor: "Loses very little pace offroad" },
  },
};

function normalizeLanguage(rawLanguage) {
  const normalized = String(rawLanguage || "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : DEFAULT_LANGUAGE;
}

function readStoredLanguage() {
  try {
    const raw = String(localStorage.getItem(LANGUAGE_STORAGE_KEY) || "")
      .trim()
      .toLowerCase()
      .slice(0, 2);
    return SUPPORTED_LANGUAGES.has(raw) ? raw : "";
  } catch (error) {
    return "";
  }
}

function detectSystemLanguage() {
  if (typeof navigator === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  const probes = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
    navigator.userLanguage,
  ]
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);
  return probes.some((entry) => entry.startsWith("ru")) ? "ru" : "en";
}

function interpolate(template, vars = {}) {
  if (typeof template !== "string") {
    return "";
  }
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

function getDictionary(language) {
  return UI_TEXT[normalizeLanguage(language)] || UI_TEXT[DEFAULT_LANGUAGE];
}

export function initLanguageState(state) {
  const storedLanguage = readStoredLanguage();
  const nextLanguage = storedLanguage || detectSystemLanguage();
  state.language = normalizeLanguage(nextLanguage);
  state.languageOverridden = Boolean(storedLanguage);
  if (typeof document !== "undefined") {
    document.documentElement.lang = state.language;
  }
}

export function setLanguage(state, rawLanguage, { persist = true, userOverride = true } = {}) {
  const nextLanguage = normalizeLanguage(rawLanguage);
  state.language = nextLanguage;
  state.languageOverridden = Boolean(userOverride);
  if (typeof document !== "undefined") {
    document.documentElement.lang = nextLanguage;
  }
  if (!persist) {
    return nextLanguage;
  }
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  } catch (error) {
    // Ignore localStorage failures in private mode.
  }
  return nextLanguage;
}

export function toggleLanguage(state) {
  const current = normalizeLanguage(state?.language);
  return setLanguage(state, current === "ru" ? "en" : "ru", { persist: true, userOverride: true });
}

export function getLanguageToggleLabel(state) {
  const current = normalizeLanguage(state?.language);
  return current === "ru" ? "EN" : "RU";
}

export function t(state, key, vars = {}) {
  const currentLanguage = normalizeLanguage(state?.language);
  const primaryDict = getDictionary(currentLanguage);
  const fallbackDict = getDictionary(DEFAULT_LANGUAGE);
  const rawTemplate = primaryDict[key] ?? fallbackDict[key] ?? key;
  return interpolate(rawTemplate, vars);
}

export function localizeTrack(state, trackOrId) {
  const language = normalizeLanguage(state?.language);
  const trackId =
    typeof trackOrId === "string"
      ? trackOrId
      : String(trackOrId?.id || "")
          .trim()
          .toLowerCase();
  const text = TRACK_TEXT[language]?.[trackId] || TRACK_TEXT[DEFAULT_LANGUAGE]?.[trackId] || null;
  return {
    id: trackId,
    name: text?.name || trackOrId?.name || trackId,
    subtitle: text?.subtitle || trackOrId?.subtitle || "",
  };
}

export function localizeSnake(state, snakeOrId) {
  const language = normalizeLanguage(state?.language);
  const snakeId =
    typeof snakeOrId === "string"
      ? snakeOrId
      : String(snakeOrId?.id || "")
          .trim()
          .toLowerCase();
  const text = SNAKE_TEXT[language]?.[snakeId] || SNAKE_TEXT[DEFAULT_LANGUAGE]?.[snakeId] || null;
  return {
    id: snakeId,
    name: text?.name || snakeOrId?.name || snakeId,
    flavor: text?.flavor || snakeOrId?.flavor || "",
  };
}

export function localizeSnakeById(state, snakeId, fallback = "") {
  const localized = localizeSnake(state, snakeId);
  return localized.name || fallback || snakeId;
}
