export { stepFinishedRacer, stepRacer } from "./simMotion.js";

export {
  applyBodyCrossingRules,
  preventRacerStall,
  resolveRacerCollisions,
  applyCollisionPenalty,
} from "./simInteractions.js";

export {
  updatePickups,
  updateBodyItems,
  updateRacerHunger,
  checkPickupCollection,
  checkBodyItemCollection,
  applyBodyItem,
  getCurrentBodySegments,
  applyBodySegmentDelta,
  applyPickup,
  addEffect,
  removeEffect,
  updateBodySegmentsForRace,
  getRacerMotionHeading,
  alignRacerHeadingToMotion,
  updateRacerBodySegments,
  shouldNeverStop,
  getLowBodySpeedFactor,
  getExhaustionSpeedFactor,
  ensureAlwaysMoveSpeed,
  ensureBombSlowFloorSpeed,
  ensureOutsideCrawlSpeed,
  getRacerModifiers,
  getBodyInfluence,
  applyHarmfulMitigation,
} from "./simBodySystem.js";

export { updateCheckpointProgress, computeStandings } from "./simProgress.js";
