# Быстрый запуск online MVP (2-3 минуты)

## 1) Поднять только нужные сервисы

```bash
docker compose up --build -d match-server web
```

Это запускает:
- `web` (игра): `http://localhost:5500` (или `http://localhost:8080`)
- `match-server` (комнаты/снапшоты)

`nakama/postgres` для базового онлайн матча не нужны.

## Чистая пересборка с нуля (без старого кеша)

Остановить и удалить текущие контейнеры/сети/тома проекта:

```bash
docker compose down -v --remove-orphans
```

Пересобрать образы без build-кеша и с подтягиванием свежих базовых образов:

```bash
docker compose build --no-cache --pull web match-server
```

Запустить заново:

```bash
docker compose up -d match-server web
```

Опционально, если нужен совсем жесткий сброс docker-кеша на машине:

```bash
docker builder prune -af
```

## 2) Проверка сервера комнат

Через web-прокси:

```bash
curl http://localhost:5500/match/healthz
```

Ожидается JSON с `"ok": true`.

Либо напрямую:

```bash
curl http://localhost:2567/healthz
```

## 3) Проверка 2+ игроков

1. Открой 2 вкладки (или 2 браузера) на `http://localhost:5500`.
2. Нажми `Играть онлайн`.
3. Выбери змею и трассу.
4. Нажми `Старт` в обеих вкладках.

Обе вкладки должны попасть в одну комнату этой трассы, пойдут снапшоты и управление.

## Примечание по сети

- Если фронт открыт по `https`, клиент автоматически пойдёт по `wss`.
- Клиент пробует endpoint'ы по очереди:
  1. `window.__POLZUNKI_MATCH_WS_URL__` (если задан вручную)
  2. same-origin прокси: `/match`
  3. прямой порт: `:2567`
