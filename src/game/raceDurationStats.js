import {
  RACE_TIMEOUT_MS,
  TITLE_RACE_DURATION_STATS_KEY,
  TITLE_CRAWL_DURATION_EXTRA_FACTOR,
  TITLE_CRAWL_MIN_DURATION_MS,
  TITLE_CRAWL_MAX_DURATION_MS,
  TITLE_CRAWL_EMA_ALPHA,
  TITLE_CRAWL_PACE_FACTOR,
  MATCH_SERVER_PORT,
  TITLE_REMOTE_STATS_PATH,
  TITLE_REMOTE_STATS_RETRY_MS,
} from "./config.js";
import { TRACK_DEFS, SNAKES, NPC_PROFILES } from "./catalog.js";
import { clamp, lerp } from "./utils.js";
import { buildTrackRuntime } from "./trackMath.js";

export function createRaceDurationStatsApi({ loadBestTime } = {}) {
  let cachedEstimatedRaceDurationMs = NaN;
  let remoteRaceDurationStats = null;
  let remoteRaceDurationFetchInFlight = false;
  let remoteRaceDurationFetchRetryAfterMs = 0;
  let remoteRaceDurationPostInFlight = false;

  function getTitleCrawlDurationMs() {
    const avgRaceMs = getAverageRaceDurationMs();
    return clamp(avgRaceMs * TITLE_CRAWL_DURATION_EXTRA_FACTOR, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS);
  }

  function estimateAverageRaceDurationMs() {
    if (Number.isFinite(cachedEstimatedRaceDurationMs)) {
      return cachedEstimatedRaceDurationMs;
    }

    const avgTrackLength =
      TRACK_DEFS.reduce((sum, def) => sum + buildTrackRuntime(def).totalLength, 0) / Math.max(1, TRACK_DEFS.length);
    const avgSnakeMaxSpeed = SNAKES.reduce((sum, snake) => sum + snake.stats.maxSpeed, 0) / Math.max(1, SNAKES.length);
    const avgProfileSpeedFactor =
      NPC_PROFILES.reduce((sum, profile) => sum + profile.speedFactor, 0) / Math.max(1, NPC_PROFILES.length);
    const effectiveSpeed = Math.max(18, avgSnakeMaxSpeed * avgProfileSpeedFactor * TITLE_CRAWL_PACE_FACTOR);
    const estimatedMs = (avgTrackLength / effectiveSpeed) * 1000;
    cachedEstimatedRaceDurationMs = clamp(estimatedMs, TITLE_CRAWL_MIN_DURATION_MS, RACE_TIMEOUT_MS * 0.9);
    return cachedEstimatedRaceDurationMs;
  }

  function loadRaceDurationStats() {
    try {
      const raw = localStorage.getItem(TITLE_RACE_DURATION_STATS_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !Number.isFinite(parsed.meanMs)) {
        return null;
      }
      return {
        meanMs: clamp(parsed.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS),
        samples: Number.isFinite(parsed.samples) ? clamp(parsed.samples, 0, 999) : 0,
      };
    } catch (error) {
      return null;
    }
  }

  function saveRaceDurationStats(stats) {
    if (!stats || !Number.isFinite(stats.meanMs)) {
      return;
    }
    const payload = {
      meanMs: clamp(stats.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS),
      samples: Number.isFinite(stats.samples) ? clamp(Math.floor(stats.samples), 0, 999) : 0,
    };
    localStorage.setItem(TITLE_RACE_DURATION_STATS_KEY, JSON.stringify(payload));
  }

  function getMatchServerBaseUrl() {
    if (typeof window === "undefined" || !window.location) {
      return null;
    }
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";
    return `${protocol}//${hostname}:${MATCH_SERVER_PORT}`;
  }

  function getRemoteRaceDurationStatsUrl() {
    const base = getMatchServerBaseUrl();
    if (!base) {
      return null;
    }
    return `${base}${TITLE_REMOTE_STATS_PATH}`;
  }

  function normalizeRaceDurationStats(stats) {
    if (!stats || !Number.isFinite(stats.meanMs) || stats.meanMs <= 0) {
      return null;
    }
    return {
      meanMs: clamp(stats.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS),
      samples: Number.isFinite(stats.samples) ? clamp(Math.floor(stats.samples), 0, 999999) : 0,
    };
  }

  function maybePrefetchRemoteRaceDurationStats() {
    if (remoteRaceDurationStats || remoteRaceDurationFetchInFlight) {
      return;
    }
    if (Date.now() < remoteRaceDurationFetchRetryAfterMs) {
      return;
    }
    const url = getRemoteRaceDurationStatsUrl();
    if (!url || typeof fetch !== "function") {
      return;
    }

    remoteRaceDurationFetchInFlight = true;
    fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`remote_stats_${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        const normalized = normalizeRaceDurationStats(payload);
        if (!normalized) {
          return;
        }
        remoteRaceDurationStats = normalized;
        saveRaceDurationStats(normalized);
        remoteRaceDurationFetchRetryAfterMs = 0;
      })
      .catch(() => {
        // Silent fallback to localStorage/estimate for standalone mode.
        remoteRaceDurationFetchRetryAfterMs = Date.now() + TITLE_REMOTE_STATS_RETRY_MS;
      })
      .finally(() => {
        remoteRaceDurationFetchInFlight = false;
      });
  }

  function postRaceDurationStatsSample(raceMeanMs) {
    if (!Number.isFinite(raceMeanMs) || raceMeanMs <= 0) {
      return;
    }
    if (remoteRaceDurationPostInFlight) {
      return;
    }

    const url = getRemoteRaceDurationStatsUrl();
    if (!url || typeof fetch !== "function") {
      return;
    }

    remoteRaceDurationPostInFlight = true;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ raceMeanMs: Math.round(raceMeanMs) }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`remote_stats_post_${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        const normalized = normalizeRaceDurationStats(payload);
        if (!normalized) {
          return;
        }
        remoteRaceDurationStats = normalized;
        saveRaceDurationStats(normalized);
      })
      .catch(() => {
        // Local stats already updated; network sync is optional.
      })
      .finally(() => {
        remoteRaceDurationPostInFlight = false;
      });
  }

  function getAverageRaceDurationMs() {
    if (remoteRaceDurationStats?.meanMs > 0) {
      return clamp(remoteRaceDurationStats.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS);
    }
    maybePrefetchRemoteRaceDurationStats();

    const saved = loadRaceDurationStats();
    if (saved && Number.isFinite(saved.meanMs)) {
      return saved.meanMs;
    }

    if (typeof loadBestTime === "function") {
      const bestTimes = TRACK_DEFS.map((track) => loadBestTime(track.id)).filter(
        (time) => Number.isFinite(time) && time > 0,
      );
      if (bestTimes.length >= 2) {
        const avgBest = bestTimes.reduce((sum, time) => sum + time, 0) / bestTimes.length;
        return clamp(avgBest, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS);
      }
    }

    return estimateAverageRaceDurationMs();
  }

  function updateRaceDurationStats(race) {
    if (!race?.racers?.length) {
      return;
    }
    const finishedTimes = race.racers
      .filter((racer) => racer.completedLap)
      .map((racer) => racer.finishTimeMs)
      .filter((ms) => Number.isFinite(ms) && ms > 0);
    if (!finishedTimes.length) {
      return;
    }

    const raceMeanMs = finishedTimes.reduce((sum, ms) => sum + ms, 0) / finishedTimes.length;
    const prev = loadRaceDurationStats();
    let localNext = null;
    if (!prev || prev.samples <= 0 || !Number.isFinite(prev.meanMs)) {
      localNext = { meanMs: raceMeanMs, samples: 1 };
    } else {
      const meanMs = lerp(prev.meanMs, raceMeanMs, TITLE_CRAWL_EMA_ALPHA);
      localNext = { meanMs, samples: prev.samples + 1 };
    }
    saveRaceDurationStats(localNext);
    postRaceDurationStatsSample(raceMeanMs);
  }

  return {
    getTitleCrawlDurationMs,
    maybePrefetchRemoteRaceDurationStats,
    getAverageRaceDurationMs,
    updateRaceDurationStats,
  };
}
