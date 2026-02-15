import { MATCH_SERVER_PORT } from "./config.js";

const COLYSEUS_ESM_URL = "https://cdn.jsdelivr.net/npm/colyseus.js@0.16.17/+esm";
const LOCAL_COLYSEUS_SCRIPT_PATH = "/assets/vendor/colyseus.js";
const ONLINE_USER_ID_KEY = "snake_online_user_id_v1";
const ONLINE_PING_INTERVAL_MS = 4000;
const MATCH_PROXY_PATH = "/match/";

export function createOnlineRoomClientApi({ state } = {}) {
  let colyseusModulePromise = null;
  let colyseusScriptLoadPromise = null;

  function loadColyseusScriptTag() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return Promise.resolve(false);
    }
    if (window.Colyseus?.Client) {
      return Promise.resolve(true);
    }
    if (!colyseusScriptLoadPromise) {
      colyseusScriptLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${LOCAL_COLYSEUS_SCRIPT_PATH}"]`);
        if (existing) {
          existing.addEventListener("load", () => resolve(Boolean(window.Colyseus?.Client)), { once: true });
          existing.addEventListener("error", () => reject(new Error("colyseus_script_load_failed")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = LOCAL_COLYSEUS_SCRIPT_PATH;
        script.async = true;
        script.onload = () => resolve(Boolean(window.Colyseus?.Client));
        script.onerror = () => reject(new Error("colyseus_script_load_failed"));
        document.head.appendChild(script);
      }).catch((error) => {
        colyseusScriptLoadPromise = null;
        throw error;
      });
    }
    return colyseusScriptLoadPromise;
  }

  async function loadColyseusClientModule() {
    if (typeof window !== "undefined" && window.Colyseus?.Client) {
      return window.Colyseus;
    }

    // Prefer modern ESM build first to avoid incompatibilities from stale global scripts.
    if (!colyseusModulePromise) {
      colyseusModulePromise = import(COLYSEUS_ESM_URL).catch((error) => {
        colyseusModulePromise = null;
        throw error;
      });
    }
    try {
      const imported = await colyseusModulePromise;
      return imported?.Client ? imported : imported?.default?.Client ? imported.default : imported;
    } catch (error) {
      // Fall through to script tag fallback.
    }

    await loadColyseusScriptTag();
    if (typeof window !== "undefined" && window.Colyseus?.Client) {
      return window.Colyseus;
    }
    throw new Error("colyseus_client_load_failed");
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

  function normalizeRoomId(rawRoomId) {
    const value = String(rawRoomId ?? "").trim();
    return value.slice(0, 64);
  }

  function toHttpEndpoint(wsEndpoint) {
    const source = String(wsEndpoint || "").trim();
    if (!source) {
      return "";
    }
    try {
      const parsed = new URL(source);
      parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
      return parsed.toString().replace(/\/+$/, "");
    } catch (error) {
      return "";
    }
  }

  function makeRoomsApiUrl(httpBase, trackId = "") {
    if (!httpBase) {
      return "";
    }
    try {
      const baseWithSlash = `${httpBase.replace(/\/+$/, "")}/`;
      const url = new URL("rooms/race", baseWithSlash);
      const normalizedTrackId = String(trackId || "").trim();
      if (normalizedTrackId) {
        url.searchParams.set("trackId", normalizedTrackId);
      }
      return url.toString();
    } catch (error) {
      return "";
    }
  }

  function getRoomsHttpCandidates(trackId = "") {
    const candidates = [];
    const push = (url) => {
      if (!url || candidates.includes(url)) {
        return;
      }
      candidates.push(url);
    };

    if (typeof window !== "undefined" && window.location?.origin) {
      push(makeRoomsApiUrl(`${window.location.origin}${MATCH_PROXY_PATH}`, trackId));
    }

    for (const wsEndpoint of getMatchServerWsCandidates()) {
      const httpBase = toHttpEndpoint(wsEndpoint);
      push(makeRoomsApiUrl(httpBase, trackId));
    }

    return candidates;
  }

  async function tryListRoomsViaHttp(trackId = "") {
    const candidates = getRoomsHttpCandidates(trackId);
    let lastError = null;

    for (const endpoint of candidates) {
      if (!endpoint) {
        continue;
      }
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          lastError = new Error(`room_listing_http_${response.status}`);
          continue;
        }
        const payload = await response.json();
        const rooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
        return {
          ok: true,
          endpoint,
          rooms,
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      ok: false,
      error: lastError?.message || "room_listing_http_unavailable",
      endpoint: null,
      rooms: [],
    };
  }

  function normalizeListedRooms(rooms, preferredTrackId = "") {
    const preferred = String(preferredTrackId || "").trim();
    return (Array.isArray(rooms) ? rooms : [])
      .map((room) => {
        const metadata = room?.metadata && typeof room.metadata === "object" ? room.metadata : {};
        const roomTrackId =
          typeof metadata.trackId === "string"
            ? metadata.trackId
            : typeof room?.trackId === "string"
            ? room.trackId
            : null;
        const phase =
          typeof metadata.phase === "string"
            ? metadata.phase
            : typeof room?.phase === "string"
            ? room.phase
            : null;
        const clients = Number(room?.clients ?? room?.clientsCount ?? 0);
        const maxClients = Number(room?.maxClients ?? 0);
        return {
          roomId: String(room?.roomId || ""),
          trackId: roomTrackId,
          phase,
          clients: Number.isFinite(clients) ? clients : 0,
          maxClients: Number.isFinite(maxClients) ? maxClients : 0,
          locked: Boolean(room?.locked),
        };
      })
      .filter((room) => room.roomId)
      .sort((a, b) => {
        const aPreferred = preferred && a.trackId === preferred ? 1 : 0;
        const bPreferred = preferred && b.trackId === preferred ? 1 : 0;
        if (aPreferred !== bPreferred) {
          return bPreferred - aPreferred;
        }
        return b.clients - a.clients || a.roomId.localeCompare(b.roomId);
      });
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
    roomId = "",
  } = {}) {
    if (!trackId) {
      return { ok: false, error: "track_id_required" };
    }

    await disconnectOnlineRace();

    const onlineUserId = userId || ensureOnlineUserId();
    const requestedRoomId = normalizeRoomId(roomId);
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
          if (requestedRoomId) {
            room = await client.joinById(requestedRoomId, {
              trackId,
              userId: onlineUserId,
              name: playerName,
            });
          } else {
            room = await client.joinOrCreate("race", {
              trackId,
              userId: onlineUserId,
              name: playerName,
            });
          }
          endpoint = candidate;
          break;
        } catch (error) {
          lastError = error;
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

  async function listOnlineRooms({ trackId = null } = {}) {
    const preferredTrackId = typeof trackId === "string" ? trackId.trim() : "";

    const httpResult = await tryListRoomsViaHttp(preferredTrackId);
    if (httpResult.ok) {
      return {
        ok: true,
        endpoint: httpResult.endpoint,
        rooms: normalizeListedRooms(httpResult.rooms, preferredTrackId),
      };
    }

    try {
      const colyseus = await loadColyseusClientModule();
      const endpointCandidates = getMatchServerWsCandidates();
      let lastError = null;

      for (const endpoint of endpointCandidates) {
        try {
          const client = new colyseus.Client(endpoint);
          if (typeof client.getAvailableRooms !== "function") {
            throw new Error("room_listing_unsupported_by_client");
          }
          const rooms = await client.getAvailableRooms("race");
          const normalized = normalizeListedRooms(rooms, preferredTrackId);

          return {
            ok: true,
            endpoint,
            rooms: normalized,
          };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("match_server_unreachable");
    } catch (error) {
      const unsupported =
        typeof error?.message === "string" && error.message.includes("room_listing_unsupported_by_client");
      if (unsupported) {
        return {
          ok: true,
          rooms: [],
          endpoint: null,
        };
      }
      return {
        ok: false,
        error: error?.message || String(error),
        rooms: [],
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
    listOnlineRooms,
    disconnectOnlineRace,
    sendOnlineInput,
    ensureOnlineUserId,
  };
}

