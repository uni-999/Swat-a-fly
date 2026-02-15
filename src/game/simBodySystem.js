export {
  updatePickups,
  updateBodyItems,
  updateRacerHunger,
  checkPickupCollection,
  checkBodyItemCollection,
  applyBodyItem,
  applyPickup,
  addEffect,
  removeEffect,
} from "./simItemEffects.js";

export {
  getCurrentBodySegments,
  applyBodySegmentDelta,
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
} from "./simBodyCore.js";
