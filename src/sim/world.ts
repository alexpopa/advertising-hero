/**
 * Static per-zone numbers for one product (DESIGN.md 6.3-6.5, 6.7, 6.12). Computed once per run.
 */
import { C } from "./constants";
import {
  ALL_PLANS,
  CHANNELS,
  OFF,
  isOn,
  type CategoriesData,
  type Estimate,
  type Channel,
  type Level,
  type Plan,
  type ProductData,
  type Role,
  type World,
  type ZoneData,
  type ZoneModel,
} from "./types";

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

/** Low-level price per day of each channel in a zone. */
export type Prices = Record<Channel, number>;

/** Ad cost per day: for each channel it runs, that channel's price x its level, plus its campaign fee. */
export function adCostPerDay(prices: Prices, plan: Plan): number {
  return CHANNELS.reduce((a, ch) => (plan[ch] > 0 ? a + prices[ch] * C.levelMult[plan[ch]] + C.formats[ch].fee : a), 0);
}

/** Pressure a channel settles at if it holds this level forever (ignoring spillover). */
export function steadyPressure(level: Level): number {
  return C.levelMult[level] / (1 - C.adDecay);
}

/**
 * Customers per unit of potential from each channel's reach. Each channel reaches people on
 * its own; where both run, some people see both, so the overlap is counted once (half the
 * weaker channel's share of the people both reach). Adding a channel never lowers this.
 */
export function channelMix(eff: Record<Channel, number>, rOoh: number, rDigital: number): number {
  return eff.ooh * rOoh + eff.digital * rDigital - 0.5 * Math.min(eff.ooh, eff.digital) * rOoh * rDigital;
}

/** What each label does for a product. Stockist + competitor = "both". */
export function roles(product: ProductData): Map<string, Role> {
  const m = new Map<string, Role>();
  for (const l of product.decoys ?? []) m.set(l, "decoy");
  for (const l of Object.keys(product.demand)) m.set(l, "customers");
  for (const l of Object.keys(product.stockists ?? {})) m.set(l, "stockist");
  for (const l of Object.keys(product.competitors)) m.set(l, m.get(l) === "stockist" ? "both" : "competitor");
  return m;
}

/** Every label that matters (or pretends to) for a product. */
export function productLabels(product: ProductData): string[] {
  return [...roles(product).keys()];
}

export function buildWorld(
  zonesData: ZoneData[],
  categories: CategoriesData,
  productKey: string,
  /** Overrides C.salesBoost (tests and balance scripts). */
  salesBoost: number = C.salesBoost,
): World {
  const raw = categories.products[productKey];
  if (!raw) throw new Error(`Unknown product: ${productKey}`);
  const product: ProductData = { ...raw, stockists: raw.stockists ?? {}, decoys: raw.decoys ?? [], hints: raw.hints ?? [] };
  const ids = new Map(zonesData.map((z, i) => [z.id, i]));

  const people = zonesData.map((z) => z.floorArea / C.m2PerPerson);
  const per10k = (i: number) => Math.max(people[i], 1) / 10_000;
  const transitPct = percentiles(zonesData.map((z) => z.transit / z.area));
  const placesPct = percentiles(zonesData.map((z) => z.nAll / z.area));
  const busyness = zonesData.map((_, i) => 0.5 * transitPct[i] + 0.5 * placesPct[i]);

  // Fit: weighted average of each demand label's density percentile.
  const demandLabels = Object.entries(product.demand);
  const labelPct = new Map(
    demandLabels.map(([label]) => [label, percentiles(zonesData.map((z) => (z.n[label] ?? 0) / z.area), true)]),
  );
  const weightSum = demandLabels.reduce((a, [, w]) => a + w, 0);

  // Stockists: weighted count per 10,000 people.
  const stockLabels = Object.entries(product.stockists);
  const stockDensity = zonesData.map(
    (z, i) => stockLabels.reduce((a, [l, w]) => a + w * (z.n[l] ?? 0), 0) / per10k(i),
  );
  const stockPct = percentiles(stockDensity, true);

  const price = zonesData.map(
    (_, i) =>
      C.adPriceBase *
      Math.pow(people[i] / 10_000, C.adPriceExponent) *
      (C.busynessMin + C.busynessSpan * busyness[i]),
  );
  const pricePct = percentiles(price);
  // Digital is priced per person reached, with no premium for busy streets.
  const priceDigital = zonesData.map(
    (_, i) => C.adPriceBase * Math.pow(people[i] / 10_000, C.adPriceExponent) * C.formats.digital.price,
  );
  const oohPrice = price.map((p) => p * C.formats.ooh.price);
  for (let i = 0; i < price.length; i++) price[i] = oohPrice[i];

  const zones: ZoneModel[] = zonesData.map((z, i) => {
    const fitParts = demandLabels.map(([label, weight]) => ({
      label,
      weight,
      count: z.n[label] ?? 0,
      pct: labelPct.get(label)![i],
    }));
    const fit = weightSum ? fitParts.reduce((a, p) => a + p.weight * p.pct, 0) / weightSum : 0;

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
    const competitionDensity = people[i] > 0 ? competition / per10k(i) : 0;
    const compFactor = 1 / (1 + competitionDensity / C.kappa);

    const stockParts = stockLabels.map(([label, weight]) => ({ label, weight, count: z.n[label] ?? 0 }));
    const sd = stockDensity[i];
    const stockFactor = 1 + (C.stockBoost * sd) / (sd + C.stockHalf);

    // Customers/day per unit purchase rate; scaled by the calibrated rate below.
    const pmax =
      people[i] * (C.fitFloor + (1 - C.fitFloor) * Math.pow(fit, C.fitSharpness)) * compFactor * stockFactor;

    // Out-of-home ads (billboards, bus shelters, posters, displays in shops and venues) work
    // best where many people pass and where stores carry you (stockists left out for products
    // not sold in stores). Digital ads target your buyers wherever they are: they follow the fit.
    const ooh = C.formats.ooh;
    const oohParts = stockLabels.length ? [busyness[i], stockPct[i]] : [busyness[i]];
    const oohMix = oohParts.reduce((a, b) => a + b, 0) / oohParts.length;
    const formatEff: Record<Channel, number> = {
      ooh: ooh.effMin + ooh.effSpan * oohMix,
      digital: C.formats.digital.effMin + C.formats.digital.effSpan * fit,
    };

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
      stockParts,
      stockDensity: sd,
      stockFactor,
      oohMix,
      formatEff,
      pmax,
      price: price[i],
      priceDigital: priceDigital[i],
      pricePct: pricePct[i],
      score: 0,
      est: [],
      best: { ...OFF },
      bestProfit: 0,
      neighbors: z.neighbors.map((id) => ids.get(id)).filter((x): x is number => x !== undefined),
    };
  });

  const plans: Plan[] = ALL_PLANS.filter(isOn);
  // Customers per unit of pmax for each plan.
  const unitsOf = (z: ZoneModel, p: Plan) =>
    channelMix(z.formatEff, reach(steadyPressure(p.ooh)), reach(steadyPressure(p.digital)));
  const units = zones.map((z) => plans.map((p) => unitsOf(z, p)));
  const pricesOf = (z: ZoneModel, k = 1): Prices => ({ ooh: k * z.price, digital: k * z.priceDigital });

  // Calibrate the economy (see C.medianReturnAtMedium and C.perfectDailyProfit).
  const unitMargin = product.orderValue * product.margin;
  const grossPerCustomer = unitMargin * (1 - C.variableOverhead);
  // 1. Purchase rate: median zone's Medium return with out-of-home ads = target (ad price only,
  //    before the fee, which only means something once the money scale is set).
  const ref = plans.findIndex((p) => p.ooh === 2 && p.digital === 0);
  const mediumReturn = zones
    .map((z, i) => (z.pmax * units[i][ref] * grossPerCustomer) / (z.price * C.levelMult[2]))
    .sort((a, b) => a - b);
  const purchaseRate = C.medianReturnAtMedium / mediumReturn[Math.floor(mediumReturn.length / 2)];
  for (const z of zones) z.pmax *= purchaseRate;
  // 2. Money scale: customers and prices scale together; perfect profit (with the flat
  //    campaign fee) rises with the scale, so a bisection finds it.
  const perfectAt = (k: number) =>
    zones.reduce(
      (sum, z, i) =>
        sum +
        Math.max(0, ...plans.map((p, j) => k * z.pmax * units[i][j] * grossPerCustomer - adCostPerDay(pricesOf(z, k), p))),
      -C.calibrationOverhead,
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
    z.pmax *= moneyScale * salesBoost;
    z.price *= moneyScale;
    z.priceDigital *= moneyScale;
  }

  // Steady-state estimates for every plan, the best plan, and the 0..100 score
  // (return per ad dollar at Medium, with the best of out-of-home, digital or both).
  const roi: number[] = [];
  zones.forEach((z, i) => {
    z.est = [0, 1, 2, 3].map(() => new Array<Estimate>(4));
    z.est[0][0] = { customers: 0, cost: 0, profit: 0 };
    plans.forEach((p, j) => {
      const customers = z.pmax * units[i][j];
      const cost = adCostPerDay(pricesOf(z), p);
      const profit = customers * unitMargin * (1 - C.variableOverhead) - cost;
      z.est[p.ooh][p.digital] = { customers, cost, profit };
      if (profit > z.bestProfit) {
        z.bestProfit = profit;
        z.best = p;
      }
    });
    const medium = [z.est[2][0], z.est[0][2], z.est[2][2]];
    roi.push(Math.max(...medium.map((e) => e.profit / e.cost)));
  });
  percentiles(roi).forEach((p, i) => (zones[i].score = Math.round(p * 100)));

  return {
    productKey,
    product,
    purchaseRate: purchaseRate * moneyScale,
    moneyScale,
    zones,
    byId: new Map(zones.map((z) => [z.id, z])),
  };
}

/** The steady-state estimate for a plan in a zone. */
export function estimate(z: ZoneModel, plan: Plan): Estimate {
  return z.est[plan.ooh][plan.digital];
}
