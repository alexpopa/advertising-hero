/**
 * "Why does this zone score the way it does?" in plain English, built from the numbers,
 * never hand-written per zone (DESIGN.md 6.7).
 */
import { countPhrase, labelName } from "./labels";
import type { World } from "./types";

export interface Explanation {
  score: number;
  people: number;
  /** Demand signals that help most, strongest first (only ones present in the zone). */
  signals: { label: string; count: number; text: string }[];
  /** e.g. "Fit: 31 gyms and 12 fitness studios" */
  fitLine: string;
  /** e.g. "Competition: only 2 sporting-goods stores" */
  competitionLine: string;
  /** e.g. "Ads: cheaper than 70% of SF" */
  priceLine: string;
  /** e.g. "About 64,000 people live or work here (estimated from building floor space)" */
  peopleLine: string;
  /** One short line for lists: "31 gyms, only 2 sporting-goods stores, cheaper than 70% of SF" */
  summary: string;
}

const round = (n: number) => (n >= 10_000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100);

export function explain(world: World, zoneIndex: number): Explanation {
  const z = world.zones[zoneIndex];

  const signals = [...z.fitParts]
    .filter((p) => p.count > 0)
    .sort((a, b) => b.weight * b.pct - a.weight * a.pct)
    .slice(0, 2)
    .map((p) => ({ label: p.label, count: p.count, text: countPhrase(p.label, p.count) }));
  const fitLine = signals.length
    ? `Fit: ${signals.map((s) => s.text).join(" and ")}`
    : `Fit: none of the places that signal ${world.product.name.toLowerCase()} buyers`;

  const totalComp = z.compParts.reduce((a, p) => a + p.count, 0);
  const mainComp = [...z.compParts].sort((a, b) => b.count * b.weight - a.count * a.weight)[0];
  const compRank = world.zones.filter((o) => o.competitionDensity < z.competitionDensity).length / (world.zones.length - 1);
  let competitionLine: string;
  if (totalComp === 0) competitionLine = `Competition: no ${labelName(mainComp.label)} nearby`;
  else {
    const what = z.compParts.filter((p) => p.count > 0).map((p) => countPhrase(p.label, p.count)).join(", ");
    const tone = compRank < 0.33 ? "only " : compRank > 0.67 ? "crowded: " : "";
    competitionLine = `Competition: ${tone}${what}`;
  }

  const cheaper = Math.round((1 - z.pricePct) * 100);
  const priceLine =
    cheaper >= 50 ? `Ads: cheaper than ${cheaper}% of SF` : `Ads: pricier than ${100 - cheaper}% of SF`;

  const peopleLine = `About ${round(z.people).toLocaleString("en-US")} people live or work here (estimated from building floor space)`;

  const summaryParts = [
    signals[0]?.text,
    totalComp === 0 ? `no ${labelName(mainComp.label)}` : compRank < 0.33 ? `only ${countPhrase(mainComp.label, mainComp.count)}` : undefined,
    cheaper >= 60 ? `cheaper than ${cheaper}% of SF` : undefined,
  ].filter(Boolean);

  return {
    score: z.score,
    people: z.people,
    signals,
    fitLine,
    competitionLine,
    priceLine,
    peopleLine,
    summary: summaryParts.join(", ") || "average on most measures",
  };
}
