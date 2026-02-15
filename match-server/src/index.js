import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";

import cors from "cors";
import express from "express";
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

import { createNakamaClient } from "./nakamaClient.js";
import { RaceRoom } from "./raceRoom.js";

const port = Number.parseInt(process.env.PORT || "2567", 10);
const app = express();
const nakamaClient = createNakamaClient();
const raceDurationStatsFile = process.env.RACE_DURATION_STATS_FILE || path.resolve(process.cwd(), "_data", "race-duration-stats.json");
const raceDurationEmaAlpha = clampNumber(
  Number.parseFloat(process.env.RACE_DURATION_STATS_EMA_ALPHA || "0.24"),
  0.01,
  0.9,
);

app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, service: "match-server", port });
});

app.get("/config", (_req, res) => {
  res.status(200).json({
    ok: true,
    port,
    nakamaEnabled: nakamaClient.enabled,
    nakamaUrl: nakamaClient.baseUrl || null,
    nakamaRpc: nakamaClient.rpcId,
    raceDurationStatsFile,
  });
});

app.get("/local-stats/race-duration", async (_req, res) => {
  try {
    const stats = await readRaceDurationStats();
    res.status(200).json({ ok: true, ...stats });
  } catch (error) {
    console.error("[match-server] read race duration stats failed:", error);
    res.status(500).json({ ok: false, error: "read_failed" });
  }
});

app.get("/rooms/race", async (req, res) => {
  try {
    const trackIdFilter = typeof req.query?.trackId === "string" ? req.query.trackId.trim() : "";
    const listed = await matchMaker.query({ name: "race" });
    const rooms = (Array.isArray(listed) ? listed : [])
      .map((room) => {
        const metadata = room?.metadata && typeof room.metadata === "object" ? room.metadata : {};
        return {
          roomId: String(room?.roomId || ""),
          trackId: typeof metadata.trackId === "string" ? metadata.trackId : null,
          phase: typeof metadata.phase === "string" ? metadata.phase : "lobby",
          clients: Number(room?.clients || 0),
          maxClients: Number(room?.maxClients || 0),
          locked: Boolean(room?.locked),
        };
      })
      .filter((room) => room.roomId)
      .filter((room) => !trackIdFilter || !room.trackId || room.trackId === trackIdFilter);

    res.status(200).json({ ok: true, rooms });
  } catch (error) {
    console.error("[match-server] /rooms/race failed:", error);
    res.status(500).json({ ok: false, error: "rooms_query_failed" });
  }
});

app.post("/local-stats/race-duration", async (req, res) => {
  const raceMeanMs = Number(req.body?.raceMeanMs);
  if (!Number.isFinite(raceMeanMs) || raceMeanMs <= 0) {
    res.status(400).json({ ok: false, error: "invalid_race_mean_ms" });
    return;
  }

  try {
    const current = await readRaceDurationStats();
    const samples = Math.max(0, Number(current.samples) || 0);
    const prevMean = Number(current.meanMs) || raceMeanMs;
    const nextMean = samples <= 0 ? raceMeanMs : prevMean * (1 - raceDurationEmaAlpha) + raceMeanMs * raceDurationEmaAlpha;
    const next = {
      version: 1,
      meanMs: Math.round(nextMean),
      samples: samples + 1,
      totalMs: Math.round((Number(current.totalMs) || 0) + raceMeanMs),
      updatedAt: new Date().toISOString(),
    };
    await writeRaceDurationStats(next);
    res.status(200).json({ ok: true, ...next });
  } catch (error) {
    console.error("[match-server] update race duration stats failed:", error);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

class ConfiguredRaceRoom extends RaceRoom {
  onCreate(options) {
    super.onCreate({
      ...options,
      nakamaClient,
    });
  }
}

gameServer.define("race", ConfiguredRaceRoom).filterBy(["trackId"]).enableRealtimeListing();

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`[match-server] listening on 0.0.0.0:${port}`);
  console.log(`[match-server] nakama enabled: ${nakamaClient.enabled ? "yes" : "no"}`);
});

async function shutdown(signal) {
  console.log(`[match-server] received ${signal}, shutting down...`);
  try {
    await gameServer.gracefullyShutdown(false);
  } catch (error) {
    console.error("[match-server] graceful shutdown failed:", error);
  }

  httpServer.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function readRaceDurationStats() {
  try {
    const raw = await fs.readFile(raceDurationStatsFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return makeDefaultRaceDurationStats();
    }
    const meanMs = Number(parsed.meanMs);
    const samples = Number(parsed.samples);
    const totalMs = Number(parsed.totalMs);
    return {
      version: 1,
      meanMs: Number.isFinite(meanMs) && meanMs > 0 ? Math.round(meanMs) : 0,
      samples: Number.isFinite(samples) && samples > 0 ? Math.round(samples) : 0,
      totalMs: Number.isFinite(totalMs) && totalMs > 0 ? Math.round(totalMs) : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return makeDefaultRaceDurationStats();
    }
    throw error;
  }
}

async function writeRaceDurationStats(stats) {
  const dir = path.dirname(raceDurationStatsFile);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(raceDurationStatsFile, JSON.stringify(stats, null, 2), "utf8");
}

function makeDefaultRaceDurationStats() {
  return {
    version: 1,
    meanMs: 0,
    samples: 0,
    totalMs: 0,
    updatedAt: null,
  };
}
