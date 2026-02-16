import { createHash } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 5000;

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function uuidFromString(source) {
  const hex = createHash("sha1").update(String(source)).digest("hex");
  const base = hex.slice(0, 32).split("");
  base[12] = "5"; // version 5 style UUID.
  const variant = Number.parseInt(base[16], 16);
  base[16] = ((variant & 0x3) | 0x8).toString(16);
  const compact = base.join("");
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20, 32),
  ].join("-");
}

function toOwnerId(userId) {
  if (isUuid(userId)) {
    return String(userId).toLowerCase();
  }
  return uuidFromString(userId);
}

function toUsername(userId, metadata = {}) {
  const candidate = metadata.player_name || userId;
  const value = String(candidate || "snake-player").trim();
  if (!value) {
    return "snake-player";
  }
  return value.slice(0, 64);
}

function parseRpcPayload(rawBody) {
  if (rawBody && typeof rawBody === "object" && typeof rawBody.payload === "string") {
    return parseJsonSafe(rawBody.payload);
  }
  if (typeof rawBody === "string") {
    return parseJsonSafe(rawBody);
  }
  return rawBody && typeof rawBody === "object" ? rawBody : {};
}

export function createNakamaClient() {
  const baseUrl = (process.env.NAKAMA_URL || "").replace(/\/$/, "");
  const httpKey = process.env.NAKAMA_HTTP_KEY || "";
  const rpcId = process.env.NAKAMA_RPC_ID || "submit_race_time";
  const leaderboardRpcId = process.env.NAKAMA_LEADERBOARD_RPC_ID || "get_track_leaderboard";

  const enabled = baseUrl.length > 0 && httpKey.length > 0;

  async function callRpc(rpcName, payload) {
    if (!enabled) {
      return { ok: false, skipped: true, reason: "nakama_client_disabled" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const url = `${baseUrl}/v2/rpc/${encodeURIComponent(rpcName)}?http_key=${encodeURIComponent(httpKey)}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Nakama HTTP RPC expects JSON-string payload.
        body: JSON.stringify(JSON.stringify(payload ?? {})),
        signal: controller.signal,
      });
      const text = await response.text();
      const rawBody = parseJsonSafe(text);
      const body = parseRpcPayload(rawBody);

      if (!response.ok) {
        return {
          ok: false,
          skipped: false,
          status: response.status,
          body,
          rawBody,
        };
      }

      return { ok: true, skipped: false, body, rawBody };
    } catch (error) {
      return {
        ok: false,
        skipped: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function submitRaceTime({ userId, trackId, timeMs, metadata = {} }) {
    const leaderboardId = `track_${trackId}_time`;
    const ownerId = toOwnerId(userId);
    const username = toUsername(userId, metadata);

    const payload = {
      owner_id: ownerId,
      user_id: String(userId),
      username,
      leaderboard_id: leaderboardId,
      track_id: String(trackId),
      score: Math.max(0, Math.floor(timeMs)),
      metadata,
    };

    const result = await callRpc(rpcId, payload);
    if (!result?.ok) {
      return {
        ok: false,
        skipped: Boolean(result?.skipped),
        status: result?.status,
        error: result?.error,
        body: result?.body,
      };
    }
    return { ok: true, skipped: false, body: result.body };
  }

  async function getTrackLeaderboard({ trackId, limit = 20, cursor = null } = {}) {
    const normalizedTrackId = String(trackId || "").trim().toLowerCase().replace(/-/g, "_");
    if (!normalizedTrackId) {
      return { ok: false, skipped: false, error: "track_id_required", records: [] };
    }
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
    const payload = {
      track_id: normalizedTrackId,
      limit: safeLimit,
    };
    if (cursor) {
      payload.cursor = String(cursor);
    }

    const result = await callRpc(leaderboardRpcId, payload);
    if (!result?.ok) {
      return {
        ok: false,
        skipped: Boolean(result?.skipped),
        status: result?.status,
        error: result?.error || result?.reason || "nakama_rpc_failed",
        body: result?.body,
        records: [],
      };
    }

    const body = result.body && typeof result.body === "object" ? result.body : {};
    const rawRecords = Array.isArray(body.records) ? body.records : [];
    const records = rawRecords.map((record, index) => {
      const rank = Number(record?.rank);
      const score = Number(record?.score);
      return {
        rank: Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : index + 1,
        username: String(record?.username || record?.owner_id || `Player ${index + 1}`),
        owner_id: record?.owner_id ? String(record.owner_id) : null,
        score: Number.isFinite(score) ? Math.max(0, Math.floor(score)) : null,
        subscore: Number.isFinite(Number(record?.subscore)) ? Math.floor(Number(record.subscore)) : 0,
        metadata: record?.metadata && typeof record.metadata === "object" ? record.metadata : {},
      };
    });

    return {
      ok: true,
      skipped: false,
      trackId: String(body.track_id || normalizedTrackId),
      leaderboardId: String(body.leaderboard_id || `track_${normalizedTrackId}_time`),
      records,
      nextCursor: body.next_cursor || null,
      prevCursor: body.prev_cursor || null,
    };
  }

  return {
    enabled,
    baseUrl,
    rpcId,
    leaderboardRpcId,
    submitRaceTime,
    getTrackLeaderboard,
  };
}
