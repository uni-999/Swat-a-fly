import { TITLE_CRAWL_SIDE_PADDING, TITLE_CRAWL_SLOWDOWN_FACTOR } from "./config.js";
import { lerp } from "./utils.js";

export function initSnakeTitleWave({ getCurrentScreen, getRaceStageWidth, getTitleCrawlDurationMs }) {
  const title = document.querySelector(".app-header h1");
  if (!title || title.dataset.waveReady === "1") {
    return;
  }
  const text = title.textContent || "";
  const chars = [...text];
  title.textContent = "";
  title.classList.add("title-snake-wave");
  const allSpans = [];
  chars.forEach((char, index) => {
    const span = document.createElement("span");
    span.className = "title-wave-char";
    span.style.setProperty("--i", String(index));
    allSpans.push(span);
    span.dataset.char = char === " " ? "\u00A0" : char;
    if (char === " ") {
      span.classList.add("title-wave-space");
      span.textContent = "\u00A0";
    } else {
      span.textContent = char;
    }
    title.appendChild(span);
  });
  title.dataset.waveReady = "1";

  if (allSpans.length < 2) {
    return;
  }

  startSnakeTitleWave(title, allSpans, { getCurrentScreen, getRaceStageWidth, getTitleCrawlDurationMs });
}

function startSnakeTitleWave(title, letterSpans, { getCurrentScreen, getRaceStageWidth, getTitleCrawlDurationMs }) {
  const waveAmplitudeX = 8;
  const verticalAmplitude = 4;
  const waveFrequency = 3.0;
  const wavePhaseShift = Math.PI * 0.45;
  const gap = 8;
  const logicalTimeScale = 2.5;

  let logicalTime = 0;
  let crawlElapsedMs = 0;
  let wasRaceScreen = false;
  let lastFrameMs = performance.now();

  const inRaceScreen = () => getCurrentScreen?.() === "race";

  const getSpanWidth = (span) => {
    const rectWidth = span.getBoundingClientRect().width;
    const offsetWidth = span.offsetWidth || 0;
    const measured = Math.max(rectWidth, offsetWidth);
    if (measured > 0.5) {
      return measured;
    }
    return span.classList.contains("title-wave-space") ? gap * 0.85 : 24;
  };

  const measure = () => {
    const header = title.closest(".app-header");
    const availableWidth = header ? header.clientWidth : window.innerWidth;
    const stageWidthHint = inRaceScreen() ? getRaceStageWidth?.() || 0 : 0;
    const stageWidth = stageWidthHint > 320 ? stageWidthHint : Math.max(320, Math.min(800, availableWidth - 16));
    title.style.setProperty("--wave-stage-width", `${stageWidth}px`);

    const letterWidths = letterSpans.map((span) => getSpanWidth(span));
    const yPos = title.clientHeight * 0.5;

    return { stageWidth, letterWidths, yPos };
  };

  const renderFrame = () => {
    const { stageWidth, letterWidths, yPos } = measure();
    const totalWidth = letterWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, letterSpans.length - 1);
    const centeredBaseX = (stageWidth - totalWidth) * 0.5;
    const raceScreen = inRaceScreen();
    let currentBaseX = centeredBaseX;
    if (raceScreen) {
      const crawlDurationMs = Math.max(1, getTitleCrawlDurationMs() * TITLE_CRAWL_SLOWDOWN_FACTOR);
      const progress = ((crawlElapsedMs % crawlDurationMs) + crawlDurationMs) % crawlDurationMs / crawlDurationMs;
      const startX = 0;
      const endX = stageWidth + TITLE_CRAWL_SIDE_PADDING;
      currentBaseX = lerp(startX, endX, progress);
    }

    let currentX = currentBaseX;
    for (let i = 0; i < letterSpans.length; i += 1) {
      const phase = logicalTime * waveFrequency + i * wavePhaseShift;
      const sin1 = Math.sin(phase);
      const waveOffsetX = sin1 * waveAmplitudeX + 0.15 * sin1;
      const vertPhase = phase - Math.PI / 2;
      const waveOffsetY = Math.sin(vertPhase) * verticalAmplitude;

      const centerX = currentX + letterWidths[i] / 2 + waveOffsetX;
      const centerY = yPos + waveOffsetY;

      const span = letterSpans[i];
      span.style.left = `${centerX.toFixed(2)}px`;
      span.style.top = `${centerY.toFixed(2)}px`;

      currentX += letterWidths[i] + gap;
    }
  };

  const tick = (nowMs) => {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;
    logicalTime += dt * logicalTimeScale;
    const raceScreen = inRaceScreen();
    if (raceScreen) {
      if (!wasRaceScreen) {
        crawlElapsedMs = 0;
      }
      crawlElapsedMs += dt * 1000;
    }
    wasRaceScreen = raceScreen;
    renderFrame();

    requestAnimationFrame(tick);
  };

  renderFrame();
  if (document.fonts?.ready?.then) {
    document.fonts.ready.then(() => {
      renderFrame();
    });
  }
  requestAnimationFrame(tick);
}
