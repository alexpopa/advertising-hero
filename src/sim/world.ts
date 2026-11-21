/**
 * Static per-zone numbers for one product (DESIGN.md 6.3-6.5, 6.7). Computed once per run.
 */
import { C } from "./constants";
import type { CategoriesData, Level, World, ZoneData, ZoneModel } from "./types";

/**
 * Percentile rank of each value among all values, 0..1 (ties share the average rank).
 * With `zeroIsZero`, a value of 0 gets 0: a zone with no gyms has no gym signal, even if
 * most zones also have none.
 */
export function percentiles(values: number[], zeroIsZero = false): number[] {
  const n = values.length;
  if (n < 2) return values.map(() => 0.5);
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    if (zeroIsZero && v === 0) return 0;
    let lo = 0;
    while (lo < n && sorted[lo] < v) lo++;
    let hi = lo;
    while (hi < n && sorted[hi] === v) hi++;
    return (lo + (hi - lo - 1) / 2) / (n - 1);
  });
}

/** Reach (share of potential captured) for a given ad pressure. */
export function reach(pressure: number): number {
  return 1 - Math.exp(-pressure / C.reachScale);
}

/** Ad cost per day at a level: price x level multiplier, plus the campaign fee if running. */
export function levelCost(price: number, level: Level): number {
  return level === 0 ? 0 : price * C.levelMult[level] + C.campaignFee;
}

/** Pressure a zone settles at if it holds this level forever (ignoring spillover). */
export function steadyPressure(level: Level): number {
  return C.levelMult[level] / (1 - C.adDecay);
}

export function buildWorld(zonesData: ZoneData[], categories: CategoriesData, productKey: string): World {
  const product = categories.products[productKey];
  if (!product) throw new Error(`Unknown product: ${productKey}`);
  const ids = new Map(zonesData.map((z, i) => [z.id, i]));

  const people = zonesData.map((z) => z.floorArea / C.m2PerPerson);
  const transitPct = percentiles(zonesData.map((z) => z.transit / z.area));
  const placesPct = percentiles(zonesData.map((z) => z.nAll / z.area));
  const busyness = zonesData.map((_, i) => 0.5 * transitPct[i] + 0.5 * placesPct[i]);

  // Fit: weighted average of each demand label's density percentile.
  const demandLabels = Object.entries(product.demand);
  const labelPct = new Map(
    demandLabels.map(([label]) => [label, percentiles(zonesData.map((z) => (z.n[label] ?? 0) / z.area), true)]),
  );
  const weightSum = demandLabels.reduce((a, [, w]) => a + w, 0);

  const price = zonesData.map(
    (_, i) =>
      C.adPriceBase *
      Math.pow(people[i] / 10_000, C.adPriceExponent) *
      (C.busynessMin + C.busynessSpan * busyness[i]),
  );
  const pricePct = percentiles(price);

  const zones: ZoneModel[] = zonesData.map((z, i) => {
    const fitParts = demandLabels.map(([label, weight]) => ({
      label,
      weight,
      count: z.n[label] ?? 0,
      pct: labelPct.get(label)![i],
    }));
    const fit = fitParts.reduce((a, p) => a + p.weight * p.pct, 0) / weightSum;

    const compParts = Object.entries(product.competitors).map(([label, weight]) => ({
      label,
      weight,
      count: z.n[label] ?? 0,
      branded: z.nBranded[label] ?? 0,
    }));
    const competition = compParts.reduce(
      (a, p) => a + p.weight * (p.count - p.branded + C.brandedCompetitorWeight * p.branded),
      0,
    );
    const competitionDensity = people[i] > 0 ? competition / (people[i] / 10_000) : 0;
    const compFactor = 1 / (1 + competitionDensity / C.kappa);
    // Customers/day per unit purchase rate; scaled by the calibrated rate below.
    const pmax = people[i] * (C.fitFloor + (1 - C.fitFloor) * Math.pow(fit, C.fitSharpness)) * compFactor;

    return {
      index: i,
      id: z.id,
      name: z.name,
      data: z,
      people: people[i],
      busyness: busyness[i],
      fit,
      fitParts,
      competition,
      competitionDensity,
      compParts,
      compFactor,
      pmax,
      price: price[i],
      pricePct: pricePct[i],
      score: 0,
      steadyProfit: [0, 0, 0, 0],
      neighbors: z.neighbors.map((id) => ids.get(id)).filter((x): x is number => x !== undefined),
    };
  });

  // Calibrate the economy (see C.medianReturnAtMedium and C.perfectDailyProfit).
  const unitMargin = product.orderValue * product.margin;
  const grossPerCustomer = unitMargin * (1 - C.variableOverhead);
  // 1. Purchase rate: median zone's Medium return = target (ad price only, before the fee,
  //    which is in dollars and only means something once the money scale is set).
  const mediumReturn = zones
    .map((z) => (z.pmax * reach(steadyPressure(2)) * grossPerCustomer) / (z.price * C.levelMult[2]))
    .sort((a, b) => a - b);
  const purchaseRate = C.medianReturnAtMedium / mediumReturn[Math.floor(mediumReturn.length / 2)];
  for (const z of zones) z.pmax *= purchaseRate;
  // 2. Money scale: customers and prices scale together; perfect profit (with the flat
  //    campaign fee) rises with the scale, so a bisection finds it.
  const perfectAt = (k: number) =>
    zones.reduce(
      (sum, z) =>
        sum +
        Math.max(
          0,
          ...([1, 2, 3] as Level[]).map(
            (l) => k * z.pmax * reach(steadyPressure(l)) * grossPerCustomer - levelCost(k * z.price, l),
          ),
        ),
      -C.fixedOverhead,
    );
  let lo = 0;
  let hi = 1;
  while (perfectAt(hi) < C.perfectDailyProfit) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (perfectAt(mid) < C.perfectDailyProfit) lo = mid;
    else hi = mid;
  }
  const moneyScale = (lo + hi) / 2;
  for (const z of zones) {
    z.pmax *= moneyScale;
    z.price *= moneyScale;
  }

  // Steady-state economics per level, and the 0..100 score (return per ad dollar at Medium).
  for (const z of zones) {
    for (const level of [0, 1, 2, 3] as Level[]) {
      const revenue = z.pmax * reach(steadyPressure(level)) * unitMargin;
      z.steadyProfit[level] = revenue * (1 - C.variableOverhead) - levelCost(z.price, level);
    }
  }
  const roi = zones.map((z) => z.steadyProfit[2] / levelCost(z.price, 2));
  percentiles(roi).forEach((p, i) => (zones[i].score = Math.round(p * 100)));

  const count = (z: ZoneData, labels: string[]) => labels.reduce((a, l) => a + (z.n[l] ?? 0), 0);
  const fairLabels = categories.events?.street_fair ?? ["event_venue", "festival_venue", "park"];
  return {
    productKey,
    product,
    purchaseRate: purchaseRate * moneyScale,
    moneyScale,
    zones,
    byId: new Map(zones.map((z) => [z.id, z])),
    eventWeights: {
      streetFair: zonesData.map((z) => count(z, fairLabels)),
      competitor: zones.map((z) => z.competition),
      busyness: zones.map((z) => z.busyness),
    },
  };
}
