/**
 * Growth (DESIGN.md 6.15): your team, and your shops. You start alone,
 * able to buy digital ads at Low; each hire unlocks the next level of one channel. A shop is
 * a permanent bet on one neighborhood. Both are paid for from cash and can't be undone.
 */
import { C } from "./constants";
import { channelMix, reach, adCostPerDay } from "./world";
import {
  ALL_PLANS,
  CHANNELS,
  OFF,
  type Channel,
  type Estimate,
  type GameState,
  type Level,
  type Plan,
  type Staff,
  type World,
} from "./types";

export const START_STAFF: Staff = { ooh: 0, digital: 1 };

export interface HireOffer {
  channel: Channel;
  /** The level this hire unlocks. */
  level: Level;
  title: string;
  signing: number;
  salary: number;
}

/** Every hire there is, in ladder order per channel. */
export const ALL_HIRES: HireOffer[] = CHANNELS.flatMap((channel) =>
  ([1, 2, 3] as Level[]).flatMap((level) => {
    const h = C.hires[channel][level];
    return h ? [{ channel, level, ...h }] : [];
  }),
);

/** The next person you can hire for a channel, or null when that channel's team is complete. */
export function nextHire(staff: Staff, channel: Channel): HireOffer | null {
  return ALL_HIRES.find((h) => h.channel === channel && h.level === staff[channel] + 1) ?? null;
}

/** Hires already made, for a staff level. */
export function hiredOf(staff: Staff): HireOffer[] {
  return ALL_HIRES.filter((h) => h.level <= staff[h.channel]);
}

/** Total salaries per day. */
export function salaries(staff: Staff): number {
  return hiredOf(staff).reduce((a, h) => a + h.salary, 0);
}

/** Can your team run this plan? Each channel's level must be one its buyers unlocked. */
export function allowed(staff: Staff, plan: Plan): boolean {
  return plan.ooh <= staff.ooh && plan.digital <= staff.digital;
}

/** The plan, with each channel cut to what your team can buy. */
export function clampPlan(staff: Staff, plan: Plan): Plan {
  return allowed(staff, plan)
    ? plan
    : { ooh: Math.min(plan.ooh, staff.ooh) as Level, digital: Math.min(plan.digital, staff.digital) as Level };
}

/** Rent per day for one shop in a zone: busier neighborhoods cost more. */
export function shopRent(world: World, zone: number): number {
  return C.shop.rentMin + C.shop.rentSpan * world.zones[zone].busyness;
}

/** What opening a shop in this zone costs: dearer where it's busy. */
export function shopCost(world: World, zone: number): number {
  return Math.round((C.shop.cost * (C.shop.costMin + C.shop.costSpan * world.zones[zone].busyness)) / 1000) * 1000;
}

/** How many shops you have in a zone. */
export function shopsIn(state: Pick<GameState, "shops">, zone: number): number {
  let n = 0;
  for (const z of state.shops) if (z === zone) n++;
  return n;
}

/** Shops per zone, for every zone. */
export function shopCounts(world: World, state: Pick<GameState, "shops">): number[] {
  const n = new Array(world.zones.length).fill(0);
  for (const z of state.shops) n[z]++;
  return n;
}

/**
 * The combined effect of `n` shops in one zone, in units of one shop: 1, 1.5, 1.75...
 * Each extra shop adds `stack` times what the one before it added.
 */
export function shopStrength(n: number): number {
  return n <= 0 ? 0 : (1 - Math.pow(C.shop.stack, n)) / (1 - C.shop.stack);
}

/** Can you open another shop here (ignoring cash)? */
export function canAddShop(state: Pick<GameState, "shops">, zone: number): boolean {
  return shopsIn(state, zone) < C.shop.maxPerZone;
}

/** Rent for every shop you have, per day. */
export function totalRent(world: World, state: Pick<GameState, "shops">): number {
  return state.shops.reduce((a, z) => a + shopRent(world, z), 0);
}

/** Base running cost + salaries + rent, per day (the share of sales comes on top). */
export function fixedCosts(world: World, state: Pick<GameState, "staff" | "shops">): number {
  return C.fixedOverhead + salaries(state.staff) + totalRent(world, state);
}

/** Hire the next person for a channel, if you can afford it. Otherwise nothing changes. */
export function hire(state: GameState, channel: Channel): GameState {
  const h = nextHire(state.staff, channel);
  if (!h || state.status !== "playing" || state.cash < h.signing) return state;
  return {
    ...state,
    cash: state.cash - h.signing,
    staff: { ...state.staff, [channel]: h.level },
    purchases: [...state.purchases, { day: state.day, kind: "hire", channel, level: h.level, cost: h.signing }],
  };
}

/** Open a shop in a zone, if you can afford it and there's room for another there. */
export function openShop(world: World, state: GameState, zone: number): GameState {
  const cost = shopCost(world, zone);
  if (state.status !== "playing" || !canAddShop(state, zone) || state.cash < cost) return state;
  return {
    ...state,
    cash: state.cash - cost,
    shops: [...state.shops, zone],
    purchases: [...state.purchases, { day: state.day, kind: "shop", zone, cost }],
  };
}

/**
 * Steady-state estimate for a plan in a zone with `shops` of your shops there (ignoring
 * brand, spillover and noise, like the zone's built-in estimates). Shop rent isn't included.
 */
export function estimateAt(world: World, zone: number, plan: Plan, shops: number): Estimate {
  const z = world.zones[zone];
  if (shops <= 0) return z.est[plan.ooh][plan.digital];
  const k = shopStrength(shops);
  const steady = (intensity: number) => intensity / (1 - C.adDecay);
  const rOoh = reach(steady(C.levelMult[plan.ooh] + C.shop.pressure * k));
  const rDigital = reach(steady(C.levelMult[plan.digital]));
  const customers = z.pmax * (1 + C.shop.boost * k) * channelMix(z.formatEff, rOoh, rDigital);
  const cost = adCostPerDay({ ooh: z.price, digital: z.priceDigital }, plan);
  const unitMargin = world.product.orderValue * world.product.margin;
  return { customers, cost, profit: customers * unitMargin * (1 - C.variableOverhead) - cost };
}

/** The steady-state estimate for a plan in a zone, given your shops there. */
export function estimateFor(world: World, state: Pick<GameState, "shops">, zone: number, plan: Plan): Estimate {
  return estimateAt(world, zone, plan, shopsIn(state, zone));
}

/** The most profitable plan your team can run in a zone (Off if nothing pays). */
export function bestAllowed(
  world: World,
  staff: Staff,
  zone: number,
  shops: number,
): { plan: Plan; profit: number } {
  let best = { plan: OFF, profit: estimateAt(world, zone, OFF, shops).profit };
  for (const plan of ALL_PLANS) {
    if (!allowed(staff, plan)) continue;
    const profit = estimateAt(world, zone, plan, shops).profit;
    if (profit > best.profit) best = { plan, profit };
  }
  return best;
}

/** Steady-state profit per day if every zone ran its best allowed plan, after fixed costs. */
export function potentialProfit(world: World, state: Pick<GameState, "staff" | "shops">): number {
  const zones = world.zones.reduce(
    (a, z) => a + bestAllowed(world, state.staff, z.index, shopsIn(state, z.index)).profit,
    0,
  );
  return zones - fixedCosts(world, state);
}

/** How much a hire would add to your best possible profit per day, salary included (Easy mode). */
export function hireGain(world: World, state: Pick<GameState, "staff" | "shops">, channel: Channel): number | null {
  const h = nextHire(state.staff, channel);
  if (!h) return null;
  const after = { ...state, staff: { ...state.staff, [channel]: h.level } };
  return potentialProfit(world, after) - potentialProfit(world, state);
}

/**
 * How much one more shop here would add to this zone's best profit per day, its rent
 * included (Easy mode). Can be negative, especially for a second or third shop.
 */
export function shopGain(world: World, state: Pick<GameState, "staff" | "shops">, zone: number): number {
  const n = shopsIn(state, zone);
  return (
    bestAllowed(world, state.staff, zone, n + 1).profit -
    Math.max(0, bestAllowed(world, state.staff, zone, n).profit) -
    shopRent(world, zone)
  );
}

/** Days for one more shop here to pay back its opening cost, or null if it never does. */
export function shopPayback(world: World, state: Pick<GameState, "staff" | "shops">, zone: number): number | null {
  const g = shopGain(world, state, zone);
  return g > 0 ? shopCost(world, zone) / g : null;
}
