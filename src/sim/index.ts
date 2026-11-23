/** The game engine: no React, no DOM, so it can be tested and run headless. */
export { C } from "./constants";
export { buildWorld, adCostPerDay, channelMix, reach, steadyPressure, percentiles, estimate, roles, productLabels } from "./world";
export { initGame, step, keepPlaying, adCost, awareness, zoneDayProfit, zoneTotalProfit } from "./game";
export {
  START_STAFF,
  ALL_HIRES,
  nextHire,
  hiredOf,
  salaries,
  allowed,
  clampPlan,
  shopRent,
  shopCost,
  shopsIn,
  shopCounts,
  shopStrength,
  canAddShop,
  shopPayback,
  totalRent,
  fixedCosts,
  hire,
  openShop,
  estimateAt,
  estimateFor,
  bestAllowed,
  potentialProfit,
  hireGain,
  shopGain,
  type HireOffer,
} from "./team";
export { recommend, type Recommendation } from "./recommend";
export { explain, type Explanation } from "./explain";
export { initialKnown, nextInsight, unknownCount, roleSentence, ROLE_TITLES } from "./insights";
export { labelName, countPhrase, hasName } from "./labels";
export { seedFrom } from "./rng";
export * from "./types";
