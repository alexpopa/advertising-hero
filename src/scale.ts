/**
 * Score color scale: 5 classed steps of one blue, light (poor) to dark (great).
 * Ordinal ramp validated with the dataviz palette validator (monotone lightness,
 * visible step gaps, lightest step >= 2:1 against the surface).
 */
export const SCORE_BINS = [
  { min: 0, max: 19, color: "#86b6ef", label: "Poor" },
  { min: 20, max: 39, color: "#5598e7", label: "Below average" },
  { min: 40, max: 59, color: "#2a78d6", label: "Average" },
  { min: 60, max: 79, color: "#1c5cab", label: "Good" },
  { min: 80, max: 100, color: "#104281", label: "Great" },
] as const;

export function scoreBin(score: number) {
  return SCORE_BINS.find((b) => score <= b.max) ?? SCORE_BINS[SCORE_BINS.length - 1];
}

export const usd = (n: number, digits = 0) =>
  (n < 0 ? "−" : "") +
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
