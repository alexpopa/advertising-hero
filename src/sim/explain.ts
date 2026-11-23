/**
 * "Why does this zone score the way it does?" in plain English, built from the numbers,
 * never hand-written per zone (DESIGN.md 6.7). Only mentions place types the player knows
 * about (all of them on Easy), so the panel never gives away what's left to discover.
 */
import { countPhrase, labelName } from "./labels";
import { roles } from "./world";
import type { World } from "./types";

export interface Explanation {
  score: number;
  people: number;
  /** Known demand signals that help most, strongest first (only ones present in the zone). */
  signals: { label: string; count: number; text: string }[];
  /** e.g. "Buyers: 31 gyms and 12 fitness studios" */
  fitLine: string;
  /** e.g. "Stores that carry you: 3 pharmacies" (null if the product isn't sold in stores, or none are known) */
  stockLine: string | null;
  /** e.g. "Competition: only 2 juice bars" (null if no competitor is known yet) */
  competitionLine: string | null;
  /** e.g. "Other place types matter too. A week of ads here will teach you one." */
  unknownLine: string | null;
  /** e.g. "Ads: cheaper than 70% of SF" */
  priceLine: string;
  /** e.g. "About 64,000 people live or work here (estimated from building floor space)" */
  peopleLine: string;
  /** One short line for lists: "31 gyms, only 2 juice bars, cheaper than 70% of SF" */
  summary: string;
}

const round = (n: number) => (n >= 10_000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100);

/** `known`: labels the player knows the role of; omit for everything (Easy, recommendations). */
export function explain(world: World, zoneIndex: number, known?: string[]): Explanation {
  const z = world.zones[zoneIndex];
  const isKnown = (l: string) => !known || known.includes(l);
  const role = roles(world.product);

  const knownDemand = z.fitParts.filter((p) => isKnown(p.label));
  const signals = knownDemand
    .filter((p) => p.count > 0)
    .sort((a, b) => b.weight * b.pct - a.weight * a.pct)
    .slice(0, 2)
    .map((p) => ({ label: p.label, count: p.count, text: countPhrase(p.label, p.count) }));
  const fitLine = signals.length
    ? `Buyers: ${signals.map((s) => s.text).join(" and ")}`
    : knownDemand.length
      ? `Buyers: none of the places you know draw ${world.product.name.toLowerCase()} buyers`
      : "Buyers: you haven't worked out what draws them yet";

  const knownStock = z.stockParts.filter((p) => isKnown(p.label));
  let stockLine: string | null = null;
  if (Object.keys(world.product.stockists).length === 0) stockLine = "Not sold in stores";
  else if (knownStock.length) {
    const present = knownStock.filter((p) => p.count > 0);
    stockLine = present.length
      ? `Stores that carry you: ${present.map((p) => countPhrase(p.label, p.count)).join(", ")}`
      : `Stores that carry you: no ${knownStock.map((p) => labelName(p.label)).join(" or ")}`;
  }

  // Competitors the player knows; a label that's both a stockist and a competitor is
  // described under stockists.
  const comp = z.compParts.filter((p) => isKnown(p.label) && role.get(p.label) !== "both");
  let competitionLine: string | null = null;
  const mainComp = [...comp].sort((a, b) => b.count * b.weight - a.count * a.weight)[0];
  const compRank = world.zones.filter((o) => o.competitionDensity < z.competitionDensity).length / (world.zones.length - 1);
  if (mainComp) {
    const totalComp = comp.reduce((a, p) => a + p.count, 0);
    if (totalComp === 0) competitionLine = `Competition: no ${comp.map((p) => labelName(p.label)).join(" or ")}`;
    else {
      const what = comp.filter((p) => p.count > 0).map((p) => countPhrase(p.label, p.count)).join(", ");
      // Ranked per person, so "2 toy stores" can be a lot for a small neighborhood. Only
      // ranked when the player knows every competitor, so the ranking gives nothing away.
      const allKnown = z.compParts.every((p) => isKnown(p.label));
      competitionLine =
        allKnown && compRank < 0.33 ? `Competition: only ${what}`
        : allKnown && compRank > 0.67 ? `Competition: ${what} (more per person than most of SF)`
        : `Competition: ${what}`;
    }
  }

  const unknown = known ? [...role.keys()].filter((l) => !known.includes(l)).length : 0;
  const unknownLine = unknown
    ? `${unknown} more place type${unknown === 1 ? "" : "s"} could matter. A week of ads here will teach you one.`
    : null;

  const cheaper = Math.round((1 - z.pricePct) * 100);
  const priceLine =
    cheaper >= 50 ? `Ads: cheaper than ${cheaper}% of SF` : `Ads: pricier than ${100 - cheaper}% of SF`;

  const peopleLine = `About ${round(z.people).toLocaleString("en-US")} people live or work here (estimated from building floor space)`;

  const topStock = knownStock.filter((p) => p.count > 0).sort((a, b) => b.count * b.weight - a.count * a.weight)[0];
  const summaryParts = [
    signals[0]?.text,
    topStock ? `${countPhrase(topStock.label, topStock.count)} carry you` : undefined,
    mainComp && compRank < 0.33
      ? z.compParts.every((p) => p.count === 0)
        ? `no ${labelName(mainComp.label)}`
        : `only ${countPhrase(mainComp.label, mainComp.count)}`
      : undefined,
    cheaper >= 60 ? `cheaper than ${cheaper}% of SF` : undefined,
  ].filter(Boolean);

  return {
    score: z.score,
    people: z.people,
    signals,
    fitLine,
    stockLine,
    competitionLine,
    unknownLine,
    priceLine,
    peopleLine,
    summary: summaryParts.join(", ") || "average on most measures",
  };
}
