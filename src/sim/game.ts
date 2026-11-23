/**
 * The day-by-day game (DESIGN.md 6.5, 6.6). Pure functions: state in, new state out.
 * Random events (street fairs, rival campaigns...) were removed on 2026-11-23 (DESIGN.md 6.8).
 */
import { C } from "./constants";
import { Rng } from "./rng";
import { adCostPerDay, channelMix, reach, type Prices } from "./world";
import { initialKnown, nextInsight } from "./insights";
import { START_STAFF, clampPlan, fixedCosts, goalBonus, hire, monthGoal, openShop } from "./team";
import { OFF, isOn, type Action, type Difficulty, type GameState, type Insight, type Plan, type World, type ZoneLedger } from "./types";

const emptyLedger = (n: number): ZoneLedger => ({
  customers: new Array(n).fill(0),
  revenue: new Array(n).fill(0),
  adSpend: new Array(n).fill(0),
});

export function initGame(world: World, seed: number, difficulty: Difficulty = "hard"): GameState {
  const n = world.zones.length;
  const rng = new Rng(seed);
  return {
    version: 5,
    seed,
    rng: rng.state,
    productKey: world.productKey,
    difficulty,
    day: 0,
    cash: C.startCash,
    plans: new Array(n).fill(OFF),
    adDays: new Array(n).fill(0),
    known: initialKnown(world.product, difficulty),
    insights: [],
    pressure: new Array(n).fill(0),
    pressureDigital: new Array(n).fill(0),
    staff: { ...START_STAFF },
    shops: [],
    purchases: [],
    goalsMet: [],
    daysBelowZero: 0,
    status: "playing",
    history: [],
    lastDay: emptyLedger(n),
    totals: emptyLedger(n),
  };
}

/** The zone's ad prices. */
function pricesOf(world: World, zone: number): Prices {
  return { ooh: world.zones[zone].price, digital: world.zones[zone].priceDigital };
}

/** How many people in a zone know your brand, 0..1: reached by out-of-home or digital ads. */
export function awareness(state: Pick<GameState, "pressure" | "pressureDigital">, zone: number): number {
  return 1 - (1 - reach(state.pressure[zone])) * (1 - reach(state.pressureDigital?.[zone] ?? 0));
}

/** Ad cost per day for a plan in a zone, campaign fees included. */
export function adCost(world: World, zone: number, plan: Plan): number {
  return adCostPerDay(pricesOf(world, zone), plan);
}

/** Apply the player's actions, then simulate one day. */
export function step(world: World, state: GameState, actions: Action[] = []): GameState {
  if (state.status !== "playing") return state;
  const n = world.zones.length;
  // Hires and shops are paid for before the day starts.
  for (const a of actions) {
    if (a.type === "hire") state = hire(state, a.channel);
    else if (a.type === "openShop") state = openShop(state, a.zone);
  }
  const plans = [...state.plans];
  for (const a of actions) if (a.type === "setPlan") plans[a.zone] = { ...plans[a.zone], ...a.plan };
  // Nobody on the team can buy above what they've unlocked.
  for (let i = 0; i < n; i++) plans[i] = clampPlan(state.staff, plans[i]);
  const shop = world.zones.map((_, i) => state.shops.includes(i));

  const rng = new Rng(state.rng);
  const day = state.day + 1;

  // Ad pressure, one track per channel: yesterday's fades, today's ads add. Out-of-home ads
  // spill over a little into neighbors (people cross the street); digital ads are targeted and don't.
  // Pressure is in "intensity" units (Low = 1/day), so spillover from an expensive zone
  // doesn't swamp a cheap neighbor.
  // Your shop's storefront works like a Low out-of-home ad that never stops.
  const oohIn = plans.map((p, i) => C.levelMult[p.ooh] + (shop[i] ? C.shop.pressure : 0));
  const digitalIn = plans.map((p) => C.levelMult[p.digital]);
  const pressure = world.zones.map((z, i) => {
    let spill = 0;
    for (const nb of z.neighbors) spill += oohIn[nb];
    return C.adDecay * state.pressure[i] + oohIn[i] + C.spillover * spill;
  });
  const pressureDigital = world.zones.map((_, i) => C.adDecay * state.pressureDigital[i] + digitalIn[i]);
  const reachOoh = pressure.map(reach);
  const reachDigital = pressureDigital.map(reach);
  const aware = world.zones.map((_, i) => awareness({ pressure, pressureDigital }, i));

  const strongZones = aware.filter((r) => r > C.brandReachThreshold).length;
  const brand = Math.min(C.brandCap, 1 + C.brandPerZone * strongZones);
  const unitMargin = world.product.orderValue * world.product.margin;

  const lastDay = emptyLedger(n);
  let revenue = 0;
  let adSpend = 0;
  let customers = 0;
  for (let i = 0; i < n; i++) {
    const z = world.zones[i];
    const spend = adCostPerDay(pricesOf(world, i), plans[i]);
    let cust = 0;
    if (aware[i] > 1e-4) {
      const noise = Math.min(C.noiseMax, Math.max(C.noiseMin, 1 + C.noiseSd * rng.normal()));
      cust = z.pmax * (shop[i] ? 1 + C.shop.boost : 1) * channelMix(z.formatEff, reachOoh[i], reachDigital[i]) * brand * noise;
    }
    lastDay.customers[i] = cust;
    lastDay.revenue[i] = cust * unitMargin;
    lastDay.adSpend[i] = spend;
    revenue += cust * unitMargin;
    adSpend += spend;
    customers += cust;
  }
  const overhead = fixedCosts(world, state) + C.variableOverhead * revenue;
  const profit = revenue - adSpend - overhead;
  let cash = state.cash + profit;

  // End of a month: did the average profit per day reach the goal? A star and a bonus if so.
  let goalsMet = state.goalsMet;
  if (day % C.monthDays === 0 && goalsMet.length < C.goals.length) {
    const month = goalsMet.length;
    const recent = [...state.history.slice(-(C.monthDays - 1)), { profit }];
    const avg = recent.reduce((a, h) => a + h.profit, 0) / C.monthDays;
    const met = avg >= monthGoal(month);
    if (met) cash += goalBonus(month);
    goalsMet = [...goalsMet, met];
  }
  const daysBelowZero = cash < 0 ? state.daysBelowZero + 1 : 0;
  const status =
    daysBelowZero >= C.bankruptDays ? "bankrupt"
    : day >= C.days ? "finished"
    : "playing";

  // Insights: two weeks of ads in a neighborhood teaches one thing about the product.
  const adDays = state.adDays.map((d, i) => (isOn(plans[i]) || shop[i] ? d + 1 : d));
  let known = state.known;
  let insights = state.insights;
  for (let i = 0; i < n; i++) {
    if (adDays[i] !== C.insightDays) continue;
    const label = nextInsight(world, known, i);
    if (!label) continue;
    known = [...known, label];
    insights = [...insights, { day, zone: i, label } satisfies Insight];
  }

  const totals: ZoneLedger = {
    customers: state.totals.customers.map((v, i) => v + lastDay.customers[i]),
    revenue: state.totals.revenue.map((v, i) => v + lastDay.revenue[i]),
    adSpend: state.totals.adSpend.map((v, i) => v + lastDay.adSpend[i]),
  };

  return {
    ...state,
    rng: rng.state,
    day,
    cash,
    plans,
    adDays,
    known,
    insights,
    pressure,
    pressureDigital,
    goalsMet,
    daysBelowZero,
    status,
    history: [...state.history, { day, revenue, adSpend, overhead, profit, cash, customers }],
    lastDay,
    totals,
  };
}

/** A zone's profit on the most recent day: its gross profit minus its ad spend. */
export function zoneDayProfit(state: GameState, zone: number): number {
  const d = state.lastDay;
  return d.revenue[zone] * (1 - C.variableOverhead) - d.adSpend[zone];
}

/** A zone's profit over the whole run so far. */
export function zoneTotalProfit(state: GameState, zone: number): number {
  const t = state.totals;
  return t.revenue[zone] * (1 - C.variableOverhead) - t.adSpend[zone];
}
