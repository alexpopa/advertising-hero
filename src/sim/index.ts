/** The game engine: no React, no DOM, so it can be tested and run headless. */
export { C } from "./constants";
export { buildWorld, adCostPerDay, channelMix, runs, reach, steadyPressure, percentiles, estimate, roles, productLabels } from "./world";
export { initGame, step, adCost, awareness, EVENTS, zoneDayProfit, zoneTotalProfit, describeEvent } from "./game";
export { recommend, type Recommendation } from "./recommend";
export { explain, type Explanation } from "./explain";
export { initialKnown, nextInsight, unknownCount, roleSentence, ROLE_TITLES } from "./insights";
export { labelName, countPhrase, hasName } from "./labels";
export { seedFrom } from "./rng";
export * from "./types";
