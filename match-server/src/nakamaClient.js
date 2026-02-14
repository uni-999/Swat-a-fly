const DEFAULT_TIMEOUT_MS = 5000;

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function createNakamaClient() {
  const baseUrl = (process.env.NAKAMA_URL || "").replace(/\/$/, "");
  const httpKey = process.env.NAKAMA_HTTP_KEY || "";
  const rpcId = process.env.NAKAMA_RPC_ID || "submit_race_time";

  const enabled = baseUrl.length > 0 && httpKey.length > 0;

  async function submitRaceTime({ userId, trackId, timeMs, metadata = {} }) {
    if (!enabled) {
      return { ok: false, skipped: true, reason: "nakama_client_disabled" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const leaderboardId = `track_${trackId}_time`;
    const url = `${baseUrl}/v2/rpc/${encodeURIComponent(rpcId)}?http_key=${encodeURIComponent(httpKey)}`;

    const payload = {
      user_id: String(userId),
      leaderboard_id: leaderboardId,
      track_id: String(trackId),
      score: Math.max(0, Math.floor(timeMs)),
      metadata,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      const body = parseJsonSafe(text);

      if (!response.ok) {
        return {
          ok: false,
          skipped: false,
          status: response.status,
          body,
        };
      }

      return { ok: true, skipped: false, body };
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

  return {
    enabled,
    baseUrl,
    rpcId,
    submitRaceTime,
  };
}
