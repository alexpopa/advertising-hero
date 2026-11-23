/**
 * Growth (DESIGN.md 6.15): your team, your shops and the monthly goals. You start alone,
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

/** Rent per day for a shop in a zone: busier neighborhoods cost more. */
export function shopRent(world: World, zone: number): number {
  return C.shop.rentMin + C.shop.rentSpan * world.zones[zone].busyness;
}

/** What your next shop costs to open. */
export function shopCost(state: Pick<GameState, "shops">): number {
  return Math.round(C.shop.cost * Math.pow(C.shop.costGrowth, state.shops.length));
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

/** Open a shop in a zone, if you can afford it and don't have one there. */
export function openShop(state: GameState, zone: number): GameState {
  const cost = shopCost(state);
  if (state.status !== "playing" || state.shops.includes(zone) || state.cash < cost) return state;
  return {
    ...state,
    cash: state.cash - cost,
    shops: [...state.shops, zone],
    purchases: [...state.purchases, { day: state.day, kind: "shop", zone, cost }],
  };
}

/**
 * Steady-state estimate for a plan in a zone, with or without your shop there (ignoring
 * brand, spillover and noise, like the zone's built-in estimates). Shop rent isn't included.
 */
export function estimateAt(world: World, zone: number, plan: Plan, shop: boolean): Estimate {
  const z = world.zones[zone];
  if (!shop) return z.est[plan.ooh][plan.digital];
  const steady = (intensity: number) => intensity / (1 - C.adDecay);
  const rOoh = reach(steady(C.levelMult[plan.ooh] + C.shop.pressure));
  const rDigital = reach(steady(C.levelMult[plan.digital]));
  const customers = z.pmax * (1 + C.shop.boost) * channelMix(z.formatEff, rOoh, rDigital);
  const cost = adCostPerDay({ ooh: z.price, digital: z.priceDigital }, plan);
  const unitMargin = world.product.orderValue * world.product.margin;
  return { customers, cost, profit: customers * unitMargin * (1 - C.variableOverhead) - cost };
}

/** The steady-state estimate for a plan in a zone, given whether you have a shop there. */
export function estimateFor(world: World, state: Pick<GameState, "shops">, zone: number, plan: Plan): Estimate {
  return estimateAt(world, zone, plan, state.shops.includes(zone));
}

/** The most profitable plan your team can run in a zone (Off if nothing pays). */
export function bestAllowed(
  world: World,
  staff: Staff,
  zone: number,
  shop: boolean,
): { plan: Plan; profit: number } {
  let best = { plan: OFF, profit: estimateAt(world, zone, OFF, shop).profit };
  for (const plan of ALL_PLANS) {
    if (!allowed(staff, plan)) continue;
    const profit = estimateAt(world, zone, plan, shop).profit;
    if (profit > best.profit) best = { plan, profit };
  }
  return best;
}

/** Steady-state profit per day if every zone ran its best allowed plan, after fixed costs. */
export function potentialProfit(world: World, state: Pick<GameState, "staff" | "shops">): number {
  const zones = world.zones.reduce(
    (a, z) => a + bestAllowed(world, state.staff, z.index, state.shops.includes(z.index)).profit,
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

/** How much a shop here would add to this zone's best profit per day, rent included (Easy mode). */
export function shopGain(world: World, state: Pick<GameState, "staff">, zone: number): number {
  return (
    bestAllowed(world, state.staff, zone, true).profit -
    Math.max(0, bestAllowed(world, state.staff, zone, false).profit) -
    shopRent(world, zone)
  );
}

/** Goal for a month (0-based), in average profit per day. */
export function monthGoal(month: number): number {
  return C.goals[Math.min(month, C.goals.length - 1)];
}

/** Bonus cash for hitting a month's goal. */
export function goalBonus(month: number): number {
  return Math.max(250, monthGoal(month) * C.goalBonusDays);
}

/** The month in progress: its goal and the average profit per day so far. */
export function monthProgress(state: Pick<GameState, "day" | "history">): {
  month: number;
  goal: number;
  daysIn: number;
  avg: number;
  daysLeft: number;
} {
  const month = Math.min(Math.floor(state.day / C.monthDays), C.goals.length - 1);
  const start = month * C.monthDays;
  const days = state.history.filter((h) => h.day > start && h.day <= start + C.monthDays);
  const avg = days.length ? days.reduce((a, h) => a + h.profit, 0) / days.length : 0;
  return { month, goal: monthGoal(month), daysIn: days.length, avg, daysLeft: C.monthDays - days.length };
}
