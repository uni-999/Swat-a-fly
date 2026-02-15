import { drawBackground, drawRaceWorld, ensureTrackBackdrop, hideTrackBackdrop } from "./renderWorld.js";
import { drawRacers, syncRacerRenderSprites, syncRacerLabels } from "./renderRacers.js";

export function renderRace(scene, race, nowMs, helpers = {}) {
  const formatMs = helpers.formatMs || ((value) => String(value ?? ""));
  const getRacerMotionHeading = helpers.getRacerMotionHeading || (() => null);
  const g = scene.graphics;
  const hasTrackBackdrop = ensureTrackBackdrop(scene, race);
  drawBackground(g, { skipBase: hasTrackBackdrop });
  drawRaceWorld(g, race, { skipTrack: hasTrackBackdrop });
  drawRacers(scene, g, race.racers, getRacerMotionHeading);
  syncRacerRenderSprites(scene, race.racers, true, getRacerMotionHeading);
  syncRacerLabels(scene, race.racers, true);

  const phaseText = race.phase === "countdown" ? "РћС‚СЃС‡РµС‚" : race.phase === "running" ? "Р“РѕРЅРєР°" : "Р¤РёРЅРёС€";
  scene.infoText.setVisible(true);
  scene.infoText.setText([
    `РўСЂР°СЃСЃР°: ${race.trackDef.name}`,
    `Р¤Р°Р·Р°: ${phaseText}`,
    `Р’СЂРµРјСЏ: ${formatMs(Math.max(0, nowMs - race.raceStartMs))}`,
  ]);
}

export function renderIdle(scene, helpers = {}) {
  const getRacerMotionHeading = helpers.getRacerMotionHeading || (() => null);
  hideTrackBackdrop(scene);
  drawBackground(scene.graphics);
  scene.infoText.setVisible(false);
  syncRacerRenderSprites(scene, [], false, getRacerMotionHeading);
  syncRacerLabels(scene, [], false);
}
