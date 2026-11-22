/** The game engine: no React, no DOM, so it can be tested and run headless. */
export { C } from "./constants";
export { buildWorld, levelCost, reach, steadyPressure, percentiles } from "./world";
export { initGame, step, adCost, EVENTS, zoneDayProfit, zoneTotalProfit, describeEvent } from "./game";
export { recommend, type Recommendation } from "./recommend";
export { explain, type Explanation } from "./explain";
export { labelName, countPhrase } from "./labels";
export { seedFrom } from "./rng";
export * from "./types";
