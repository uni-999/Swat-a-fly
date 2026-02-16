import {
  drawBackground,
  drawRaceWorld,
  ensureTrackBackdrop,
  hideTrackBackdrop,
  syncTrackObjectSprites,
} from "./renderWorld.js";
import { drawRacers, syncRacerRenderSprites, syncRacerLabels } from "./renderRacers.js";

export function renderRace(scene, race, nowMs, helpers = {}) {
  const formatMs = helpers.formatMs || ((value) => String(value ?? ""));
  const getRacerMotionHeading = helpers.getRacerMotionHeading || (() => null);
  const t = typeof helpers.t === "function" ? helpers.t : (key) => key;
  const localizeTrack = typeof helpers.localizeTrack === "function" ? helpers.localizeTrack : (track) => track;
  const g = scene.graphics;
  const hasTrackBackdrop = ensureTrackBackdrop(scene, race);
  drawBackground(g, { skipBase: hasTrackBackdrop });
  drawRaceWorld(scene, g, race, { skipTrack: hasTrackBackdrop });
  drawRacers(scene, g, race.racers, getRacerMotionHeading);
  syncRacerRenderSprites(scene, race.racers, true, getRacerMotionHeading);
  syncRacerLabels(scene, race.racers, true);

  const phaseText =
    race.phase === "rules"
      ? t("race.phase.rules")
      : race.phase === "countdown"
        ? t("race.phase.countdown")
        : race.phase === "running"
          ? t("race.phase.running")
          : t("race.phase.finished");
  const localizedTrack = localizeTrack(race.trackDef || {});
  scene.infoText.setVisible(true);
  scene.infoText.setText([
    `${t("race.info.track")}: ${localizedTrack?.name || race.trackDef?.name || "-"}`,
    `${t("race.info.phase")}: ${phaseText}`,
    `${t("race.info.time")}: ${formatMs(Math.max(0, nowMs - race.raceStartMs))}`,
  ]);
}

export function renderIdle(scene, helpers = {}) {
  const getRacerMotionHeading = helpers.getRacerMotionHeading || (() => null);
  hideTrackBackdrop(scene);
  syncTrackObjectSprites(scene, null, false);
  drawBackground(scene.graphics);
  scene.infoText.setVisible(false);
  syncRacerRenderSprites(scene, [], false, getRacerMotionHeading);
  syncRacerLabels(scene, [], false);
}
