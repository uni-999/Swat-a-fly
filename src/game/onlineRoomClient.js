import { MATCH_SERVER_PORT } from "./config.js";

const COLYSEUS_ESM_URL = "https://cdn.jsdelivr.net/npm/colyseus.js@0.16.17/+esm";
const ONLINE_USER_ID_KEY = "snake_online_user_id_v1";
const ONLINE_PING_INTERVAL_MS = 4000;
const MATCH_PROXY_PATH = "/match";

export function createOnlineRoomClientApi({ state } = {}) {
  let colyseusModulePromise = null;

  async function loadColyseusClientModule() {
    if (typeof window !== "undefined" && window.Colyseus?.Client) {
      return window.Colyseus;
    }
    if (!colyseusModulePromise) {
      colyseusModulePromise = import(COLYSEUS_ESM_URL).catch((error) => {
        colyseusModulePromise = null;
        throw error;
      });
    }
    return colyseusModulePromise;
  }

  function getMatchServerWsCandidates() {
    const secure = typeof window !== "undefined" && window.location?.protocol === "https:";
    const protocol = secure ? "wss" : "ws";
    const hostWithPort = typeof window !== "undefined" && window.location?.host ? window.location.host : "";
    const host = typeof window !== "undefined" && window.location?.hostname ? window.location.hostname : "localhost";
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    const fromGlobal =
      typeof window !== "undefined" && typeof window.__POLZUNKI_MATCH_WS_URL__ === "string"
        ? window.__POLZUNKI_MATCH_WS_URL__.trim()
        : "";
    const sameOriginProxy = hostWithPort ? `${protocol}://${hostWithPort}${MATCH_PROXY_PATH}` : "";
    const directPort = `${protocol}://${host}:${MATCH_SERVER_PORT}`;
    const seen = new Set();
    const autoCandidates = isLocalHost ? [directPort, sameOriginProxy] : [sameOriginProxy, directPort];
    return [fromGlobal, ...autoCandidates].filter((url) => {
      if (!url || seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
  }

  function ensureOnlineUserId() {
    try {
      const saved = localStorage.getItem(ONLINE_USER_ID_KEY);
      if (saved && saved.trim()) {
        return saved;
      }
      const next =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `web_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
      localStorage.setItem(ONLINE_USER_ID_KEY, next);
      return next;
    } catch (error) {
      return `web_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    }
  }

  function clearOnlinePingTimer() {
    if (state.online?.pingTimerId) {
      clearInterval(state.online.pingTimerId);
      state.online.pingTimerId = null;
    }
  }

  async function disconnectOnlineRace() {
    clearOnlinePingTimer();
    const room = state.online?.room;
    if (room) {
      try {
        await room.leave(true);
      } catch (error) {
        // Ignore room-close errors during explicit disconnect.
      }
    }
    state.online = {
      active: false,
      status: "idle",
      client: null,
      room: null,
      roomId: null,
      sessionId: null,
      endpoint: null,
      trackId: null,
      snapshot: null,
      lastSnapshotAtMs: 0,
      lastPongAtMs: 0,
      pingTimerId: null,
      latencyMs: null,
      error: null,
    };
  }

  async function startOnlineRace({
    trackId,
    playerName = "Player",
    userId = null,
  } = {}) {
    if (!trackId) {
      return { ok: false, error: "track_id_required" };
    }

    await disconnectOnlineRace();

    const onlineUserId = userId || ensureOnlineUserId();
    state.online = {
      active: true,
      status: "connecting",
      client: null,
      room: null,
      roomId: null,
      sessionId: null,
      endpoint: null,
      trackId,
      snapshot: null,
      lastSnapshotAtMs: 0,
      lastPongAtMs: 0,
      pingTimerId: null,
      latencyMs: null,
      error: null,
    };

    try {
      const colyseus = await loadColyseusClientModule();
      let client = null;
      let room = null;
      let endpoint = null;
      let lastError = null;
      const endpointCandidates = getMatchServerWsCandidates();

      for (const candidate of endpointCandidates) {
        try {
          client = new colyseus.Client(candidate);
          room = await client.joinOrCreate("race", {
            trackId,
            userId: onlineUserId,
            name: playerName,
          });
          endpoint = candidate;
          break;
        } catch (error) {
          lastError = error;
          try {
            client?.connection?.close?.();
          } catch (closeError) {
            // Ignore close failures while trying fallback endpoint.
          }
          client = null;
          room = null;
        }
      }
      if (!client || !room) {
        throw lastError || new Error("match_server_unreachable");
      }

      state.online.client = client;
      state.online.room = room;
      state.online.roomId = room.roomId || null;
      state.online.sessionId = room.sessionId || null;
      state.online.endpoint = endpoint;
      state.online.status = "connected";

      room.onMessage("snapshot", (snapshot) => {
        state.online.snapshot = snapshot || null;
        state.online.lastSnapshotAtMs = Date.now();
      });

      room.onMessage("pong", (payload) => {
        state.online.lastPongAtMs = Date.now();
        const echoed = Number(payload?.echo?.clientTimeMs);
        if (Number.isFinite(echoed)) {
          state.online.latencyMs = Math.max(0, Date.now() - echoed);
        }
      });

      room.onError((code, message) => {
        state.online.status = "error";
        state.online.error = `room_error_${code}: ${message || "unknown"}`;
      });

      room.onLeave((code) => {
        clearOnlinePingTimer();
        state.online.active = false;
        state.online.status = "disconnected";
        state.online.error = `room_closed_${code}`;
      });

      room.send("ready", { ready: true });
      state.online.pingTimerId = setInterval(() => {
        if (!state.online?.room) {
          return;
        }
        try {
          state.online.room.send("ping", { clientTimeMs: Date.now() });
        } catch (error) {
          // If send fails, disconnect handler will update state.
        }
      }, ONLINE_PING_INTERVAL_MS);

      return {
        ok: true,
        roomId: state.online.roomId,
        sessionId: state.online.sessionId,
        endpoint: state.online.endpoint,
      };
    } catch (error) {
      state.online.status = "error";
      state.online.error = error?.message || String(error);
      return {
        ok: false,
        error: state.online.error,
      };
    }
  }

  function sendOnlineInput(input) {
    const room = state.online?.room;
    if (!room || state.online?.status !== "connected") {
      return false;
    }
    try {
      room.send("input", {
        turn: Number(input?.turn) || 0,
        throttle: Number(input?.throttle) || 0,
        brake: Number(input?.brake) || 0,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  return {
    startOnlineRace,
    disconnectOnlineRace,
    sendOnlineInput,
    ensureOnlineUserId,
  };
}

