import { Room } from "@colyseus/core";

const TRACK_LENGTH = 12000;
const COUNTDOWN_MS = 3000;
const STEER_RESPONSE_PER_SEC = 8.5;
const BASE_TURN_RATE = 2.15;
const TURN_RATE_SPEED_LOSS = 0.85;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export class RaceRoom extends Room {
  // -----------------------------
  // Room Lifecycle
  // -----------------------------
  onCreate(options) {
    this.maxClients = 4;
    this.tickRate = Math.max(10, safeNumber(process.env.SERVER_TICK_RATE, 20));
    this.raceMaxMs = Math.max(30000, safeNumber(process.env.RACE_MAX_MS, 180000));
    this.trackId = typeof options?.trackId === "string" ? options.trackId : "canyon_loop";
    this.nakamaClient = options?.nakamaClient;

    this.players = new Map();
    this.phase = "lobby";
    this.tickIndex = 0;
    this.lastTickAtMs = Date.now();
    this.countdownEndsAtMs = 0;
    this.raceStartedAtMs = 0;
    this.raceEndedAtMs = 0;
    this.resultsSubmitted = false;

    this.setPrivate(false);
    this.setMetadata({ trackId: this.trackId, phase: this.phase, tickRate: this.tickRate });

    this.onMessage("input", (client, payload) => this.handleInput(client, payload));
    this.onMessage("ready", (client, payload) => this.handleReady(client, payload));
    this.onMessage("ping", (client, payload) => {
      client.send("pong", { serverTimeMs: Date.now(), echo: payload ?? null });
    });

    this.clock.setInterval(() => this.tick(), Math.floor(1000 / this.tickRate));
  }

  onJoin(client, options) {
    const userId = options?.userId ? String(options.userId) : client.sessionId;
    const displayName = options?.name ? String(options.name) : `Player ${this.clients.length}`;

    this.players.set(client.sessionId, {
      sessionId: client.sessionId,
      userId,
      displayName,
      connected: true,
      isBot: false,
      ready: true,
      input: { turn: 0, throttle: 0, brake: 0 },
      x: 0,
      y: 0,
      heading: 0,
      steer: 0,
      speed: 0,
      progress: 0,
      finished: false,
      finishTimeMs: null,
      resultSubmitted: false,
    });

    this.broadcastState();
  }

  onLeave(client) {
    const player = this.players.get(client.sessionId);
    if (!player) {
      return;
    }

    // During active race we keep slot and switch to bot.
    if (this.phase === "running" && !player.finished) {
      player.connected = false;
      player.isBot = true;
      player.ready = true;
      player.displayName = `${player.displayName} [BOT]`;
    } else {
      this.players.delete(client.sessionId);
    }

    this.broadcastState();
  }

  onDispose() {
    this.players.clear();
  }

  // -----------------------------
  // Input / Ready Handlers
  // -----------------------------
  handleInput(client, payload) {
    const player = this.players.get(client.sessionId);
    if (!player || player.isBot || this.phase !== "running") {
      return;
    }

    player.input.turn = clamp(safeNumber(payload?.turn, 0), -1, 1);
    player.input.throttle = clamp(safeNumber(payload?.throttle, 0), 0, 1);
    player.input.brake = clamp(safeNumber(payload?.brake, 0), 0, 1);
  }

  handleReady(client, payload) {
    const player = this.players.get(client.sessionId);
    if (!player || this.phase !== "lobby") {
      return;
    }

    player.ready = payload?.ready !== false;
    this.tryStartCountdown();
    this.broadcastState();
  }

  tryStartCountdown() {
    if (this.phase !== "lobby") {
      return;
    }

    const participants = Array.from(this.players.values()).filter((p) => p.connected);
    if (participants.length < 1) {
      return;
    }

    const allReady = participants.every((p) => p.ready);
    if (!allReady) {
      return;
    }

    this.phase = "countdown";
    this.countdownEndsAtMs = Date.now() + COUNTDOWN_MS;
    this.setMetadata({ ...this.metadata, phase: this.phase });
  }

  tick() {
    const nowMs = Date.now();
    const dt = Math.min(0.1, Math.max(0.001, (nowMs - this.lastTickAtMs) / 1000));
    this.lastTickAtMs = nowMs;
    this.tickIndex += 1;

    if (this.phase === "countdown" && nowMs >= this.countdownEndsAtMs) {
      this.phase = "running";
      this.raceStartedAtMs = nowMs;
      this.setMetadata({ ...this.metadata, phase: this.phase });
    }

    if (this.phase === "running") {
      this.simulate(dt, nowMs);
      if (nowMs - this.raceStartedAtMs >= this.raceMaxMs) {
        this.forceFinishTimeout(nowMs);
      }
    }

    this.broadcastState();
  }

  // -----------------------------
  // Simulation
  // -----------------------------
  simulate(dt, nowMs) {
    for (const player of this.players.values()) {
      if (player.finished) {
        continue;
      }

      const input = player.isBot ? this.generateBotInput(player, nowMs) : player.input;
      const maxSpeed = 250;
      const accel = 280;
      const brakeForce = 380;
      const drag = 1.15;
      const throttleInput = clamp(safeNumber(input?.throttle, 0), 0, 1);
      const brakeInput = clamp(safeNumber(input?.brake, 0), 0, 1);
      const targetTurn = clamp(safeNumber(input?.turn, 0), -1, 1);

      player.speed += (throttleInput * accel - brakeInput * brakeForce - drag * player.speed) * dt;
      player.speed = clamp(player.speed, 0, maxSpeed);

      const steerBlend = Math.min(1, dt * STEER_RESPONSE_PER_SEC);
      player.steer += (targetTurn - player.steer) * steerBlend;

      const turnRate = BASE_TURN_RATE - (player.speed / maxSpeed) * TURN_RATE_SPEED_LOSS;
      player.heading += player.steer * turnRate * dt;
      player.x += Math.cos(player.heading) * player.speed * dt;
      player.y += Math.sin(player.heading) * player.speed * dt;
      player.progress += player.speed * dt;

      if (player.progress >= TRACK_LENGTH) {
        player.finished = true;
        player.finishTimeMs = Math.max(0, nowMs - this.raceStartedAtMs);
      }
    }

    const unfinished = Array.from(this.players.values()).some((p) => !p.finished);
    if (!unfinished) {
      this.finishRace(nowMs);
    }
  }

  generateBotInput(player, nowMs) {
    const wobble = Math.sin((nowMs / 1000) * 0.8 + player.sessionId.length * 0.25);
    return {
      turn: clamp(wobble * 0.9, -1, 1),
      throttle: 0.88,
      brake: Math.abs(wobble) > 0.8 ? 0.1 : 0,
    };
  }

  forceFinishTimeout(nowMs) {
    for (const player of this.players.values()) {
      if (!player.finished) {
        player.finished = true;
        player.finishTimeMs = null;
      }
    }
    this.finishRace(nowMs);
  }

  finishRace(nowMs) {
    if (this.phase === "finished") {
      return;
    }

    this.phase = "finished";
    this.raceEndedAtMs = nowMs;
    this.setMetadata({ ...this.metadata, phase: this.phase });
    this.submitResults().catch((error) => {
      console.error("[match-server] submitResults failed:", error);
    });
  }

  // -----------------------------
  // Result Submission
  // -----------------------------
  async submitResults() {
    if (this.resultsSubmitted) {
      return;
    }
    if (!this.nakamaClient || !this.nakamaClient.enabled) {
      this.resultsSubmitted = true;
      return;
    }

    const results = Array.from(this.players.values())
      .filter((p) => Number.isFinite(p.finishTimeMs))
      .sort((a, b) => a.finishTimeMs - b.finishTimeMs);

    let allSubmitted = true;
    for (const player of results) {
      if (player.resultSubmitted) {
        continue;
      }
      const response = await this.nakamaClient.submitRaceTime({
        userId: player.userId,
        trackId: this.trackId,
        timeMs: player.finishTimeMs,
        metadata: {
          room_id: this.roomId,
          player_name: player.displayName,
          phase: this.phase,
        },
      });

      if (response?.ok) {
        player.resultSubmitted = true;
      } else {
        allSubmitted = false;
        console.warn("[match-server] result submit failed", {
          roomId: this.roomId,
          trackId: this.trackId,
          userId: player.userId,
          response,
        });
      }
    }

    this.resultsSubmitted = allSubmitted;
    if (!allSubmitted) {
      // Retry failed submissions; keep state until all results are accepted.
      this.clock.setTimeout(() => {
        this.submitResults().catch((error) => {
          console.error("[match-server] submitResults retry failed:", error);
        });
      }, 5000);
    }
  }

  // -----------------------------
  // Snapshot Broadcasting
  // -----------------------------
  buildSnapshot() {
    const players = Array.from(this.players.values())
      .map((p) => ({
        sessionId: p.sessionId,
        userId: p.userId,
        displayName: p.displayName,
        connected: p.connected,
        isBot: p.isBot,
        ready: p.ready,
        x: Number(p.x.toFixed(2)),
        y: Number(p.y.toFixed(2)),
        heading: Number(p.heading.toFixed(4)),
        speed: Number(p.speed.toFixed(2)),
        progress: Number(p.progress.toFixed(2)),
        finished: p.finished,
        finishTimeMs: p.finishTimeMs,
      }))
      .sort((a, b) => b.progress - a.progress);

    return {
      roomId: this.roomId,
      tick: this.tickIndex,
      phase: this.phase,
      trackId: this.trackId,
      raceStartedAtMs: this.raceStartedAtMs,
      raceEndedAtMs: this.raceEndedAtMs,
      players,
    };
  }

  broadcastState() {
    this.broadcast("snapshot", this.buildSnapshot());
  }
}
