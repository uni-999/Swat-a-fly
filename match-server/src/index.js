import http from "node:http";

import cors from "cors";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

import { createNakamaClient } from "./nakamaClient.js";
import { RaceRoom } from "./raceRoom.js";

const port = Number.parseInt(process.env.PORT || "2567", 10);
const app = express();
const nakamaClient = createNakamaClient();

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
  });
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
