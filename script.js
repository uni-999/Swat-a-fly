import { bootstrapApp } from "./src/game/app.js?v=20260216_mobile_joy_5";

const PHASER_CANDIDATE_URLS = [
  "/assets/vendor/phaser.min.js",
  "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js",
  "https://unpkg.com/phaser@3.90.0/dist/phaser.min.js",
];

async function ensurePhaserLoaded() {
  if (typeof window !== "undefined" && window.Phaser) {
    return true;
  }

  for (const url of PHASER_CANDIDATE_URLS) {
    const ok = await loadScript(url);
    if (ok && typeof window !== "undefined" && window.Phaser) {
      return true;
    }
  }

  return false;
}

function loadScript(url) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }

    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      if (typeof window !== "undefined" && window.Phaser) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(Boolean(window.Phaser)), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Phaser));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

void (async () => {
  const phaserReady = await ensurePhaserLoaded();
  if (!phaserReady) {
    console.error("[bootstrap] Phaser failed to load from all sources.");
    return;
  }
  bootstrapApp();
})();
