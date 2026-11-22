/**
 * The day-by-day game (DESIGN.md 6.5, 6.6, 6.8). Pure functions: state in, new state out.
 */
import { C } from "./constants";
import { Rng } from "./rng";
import { levelCost, reach } from "./world";
import type { Action, ActiveEvent, Difficulty, EventKind, GameState, Level, World, ZoneLedger } from "./types";

export const EVENTS: Record<EventKind, { days: number; effect: number }> = {
  /** +40% customers in one zone. */
  streetFair: { days: 2, effect: 1.4 },
  /** -10% customers citywide. */
  rain: { days: 3, effect: 0.9 },
  /** -20% customers in one zone. */
  competitor: { days: 5, effect: 0.8 },
  /** Brand awareness x1.1 citywide. */
  viral: { days: 3, effect: 1.1 },
  /** +25% ad prices in one zone. */
  priceUp: { days: 4, effect: 1.25 },
};
const EVENT_KINDS = Object.keys(EVENTS) as EventKind[];

const emptyLedger = (n: number): ZoneLedger => ({
  customers: new Array(n).fill(0),
  revenue: new Array(n).fill(0),
  adSpend: new Array(n).fill(0),
});

export function initGame(world: World, seed: number, difficulty: Difficulty = "hard"): GameState {
  const n = world.zones.length;
  const rng = new Rng(seed);
  const nextEventDay = rng.int(C.eventGapMin, C.eventGapMax);
  return {
    version: 1,
    seed,
    rng: rng.state,
    productKey: world.productKey,
    difficulty,
    day: 0,
    cash: C.startCash,
    levels: new Array(n).fill(0),
    pressure: new Array(n).fill(0),
    daysBelowZero: 0,
    status: "playing",
    events: [],
    nextEventDay,
    eventLog: [],
    history: [],
    lastDay: emptyLedger(n),
    totals: emptyLedger(n),
  };
}

/** Ad cost per day for a zone at a level, including the campaign fee and any price event. */
export function adCost(world: World, state: GameState, zone: number, level: Level): number {
  return levelCost(world.zones[zone].price * eventMult(state.events, "priceUp", zone), level);
}

function eventMult(events: ActiveEvent[], kind: EventKind, zone: number): number {
  let m = 1;
  for (const e of events) if (e.kind === kind && (e.zone === -1 || e.zone === zone)) m *= EVENTS[kind].effect;
  return m;
}

function startEvent(world: World, rng: Rng, day: number): ActiveEvent {
  const kind = EVENT_KINDS[rng.int(0, EVENT_KINDS.length - 1)];
  const w = world.eventWeights;
  const zone =
    kind === "streetFair" ? rng.weighted(w.streetFair)
    : kind === "competitor" ? rng.weighted(w.competitor)
    : kind === "priceUp" ? rng.weighted(w.busyness)
    : -1;
  return { kind, zone, day, daysLeft: EVENTS[kind].days };
}

/** Apply the player's actions, then simulate one day. */
export function step(world: World, state: GameState, actions: Action[] = []): GameState {
  if (state.status !== "playing") return state;
  const n = world.zones.length;
  const levels = [...state.levels];
  for (const a of actions) if (a.type === "setLevel") levels[a.zone] = a.level;

  const rng = new Rng(state.rng);
  const day = state.day + 1;

  // Events: start a new one when due. Active events count down at the end of the day.
  let events = state.events;
  let nextEventDay = state.nextEventDay;
  let eventLog = state.eventLog;
  if (day >= nextEventDay) {
    const e = startEvent(world, rng, day);
    events = [...events, e];
    eventLog = [...eventLog, e];
    nextEventDay = day + rng.int(C.eventGapMin, C.eventGapMax);
  }

  // Ad pressure: yesterday's fades, today's ads add, neighbors spill over.
  // Pressure is in "intensity" units (Low = 1/day), so spillover from an expensive zone
  // doesn't swamp a cheap neighbor.
  const intensity = levels.map((l) => C.levelMult[l]);
  const pressure = world.zones.map((z, i) => {
    let spill = 0;
    for (const nb of z.neighbors) spill += intensity[nb];
    return C.adDecay * state.pressure[i] + intensity[i] + C.spillover * spill;
  });
  const reachNow = pressure.map(reach);

  const strongZones = reachNow.filter((r) => r > C.brandReachThreshold).length;
  const brand = Math.min(C.brandCap, 1 + C.brandPerZone * strongZones) * eventMult(events, "viral", -1);
  const rain = eventMult(events, "rain", -1);
  const unitMargin = world.product.orderValue * world.product.margin;

  const lastDay = emptyLedger(n);
  let revenue = 0;
  let adSpend = 0;
  let customers = 0;
  const priced = { ...state, events };
  for (let i = 0; i < n; i++) {
    const spend = adCost(world, priced, i, levels[i]);
    let cust = 0;
    if (reachNow[i] > 1e-4) {
      const noise = Math.min(C.noiseMax, Math.max(C.noiseMin, 1 + C.noiseSd * rng.normal()));
      const local = eventMult(events, "streetFair", i) * eventMult(events, "competitor", i);
      cust = world.zones[i].pmax * reachNow[i] * brand * noise * rain * local;
    }
    lastDay.customers[i] = cust;
    lastDay.revenue[i] = cust * unitMargin;
    lastDay.adSpend[i] = spend;
    revenue += cust * unitMargin;
    adSpend += spend;
    customers += cust;
  }
  const overhead = C.fixedOverhead + C.variableOverhead * revenue;
  const profit = revenue - adSpend - overhead;
  const cash = state.cash + profit;
  const daysBelowZero = cash < 0 ? state.daysBelowZero + 1 : 0;
  const status =
    daysBelowZero >= C.bankruptDays ? "bankrupt"
    : day >= C.days ? "finished"
    : "playing";

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
    levels,
    pressure,
    daysBelowZero,
    status,
    events: events.map((e) => ({ ...e, daysLeft: e.daysLeft - 1 })).filter((e) => e.daysLeft > 0),
    nextEventDay,
    eventLog,
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

/** Plain-English text for an event. Events are fictional and never name real businesses. */
export function describeEvent(world: World, e: ActiveEvent): { title: string; detail: string } {
  const where = e.zone >= 0 ? world.zones[e.zone].name : "";
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const d = EVENTS[e.kind].days;
  switch (e.kind) {
    case "streetFair":
      return { title: `Street fair in ${where}`, detail: `+40% customers there for ${days(d)}` };
    case "rain":
      return { title: "Rainy week", detail: `−10% customers everywhere for ${days(d)}` };
    case "competitor":
      return { title: `Rival campaign in ${where}`, detail: `−20% customers there for ${days(d)}` };
    case "viral":
      return { title: "Your brand went viral", detail: `+10% customers everywhere for ${days(d)}` };
    case "priceUp":
      return { title: `Ad prices up in ${where}`, detail: `+25% ad prices there for ${days(d)}` };
  }
}
