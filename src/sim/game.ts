/**
 * The day-by-day game (DESIGN.md 6.5, 6.6, 6.8). Pure functions: state in, new state out.
 */
import { C } from "./constants";
import { Rng } from "./rng";
import { adCostPerDay, channelMix, reach, runs, type Prices } from "./world";
import { initialKnown, nextInsight } from "./insights";
import type {
  Action,
  ActiveEvent,
  Difficulty,
  EventKind,
  Format,
  GameState,
  Insight,
  Level,
  World,
  ZoneLedger,
} from "./types";

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
    version: 4,
    seed,
    rng: rng.state,
    productKey: world.productKey,
    difficulty,
    day: 0,
    cash: C.startCash,
    levels: new Array(n).fill(0),
    formats: new Array(n).fill("ooh"),
    adDays: new Array(n).fill(0),
    known: initialKnown(world.product, difficulty),
    insights: [],
    pressure: new Array(n).fill(0),
    pressureDigital: new Array(n).fill(0),
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

/** The zone's ad prices today, with any price event. */
function pricesNow(world: World, events: ActiveEvent[], zone: number): Prices {
  const m = eventMult(events, "priceUp", zone);
  return { ooh: world.zones[zone].price * m, digital: world.zones[zone].priceDigital * m };
}

/** How many people in a zone know your brand, 0..1: reached by out-of-home or digital ads. */
export function awareness(state: Pick<GameState, "pressure" | "pressureDigital">, zone: number): number {
  return 1 - (1 - reach(state.pressure[zone])) * (1 - reach(state.pressureDigital?.[zone] ?? 0));
}

/**
 * Ad cost per day for a zone at a level, with its format (or the one given), including the
 * campaign fee and any price event.
 */
export function adCost(
  world: World,
  state: Pick<GameState, "events" | "formats">,
  zone: number,
  level: Level,
  format: Format = state.formats?.[zone] ?? "ooh",
): number {
  return adCostPerDay(pricesNow(world, state.events, zone), { level, format });
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
  const formats = [...state.formats];
  for (const a of actions) {
    if (a.type === "setLevel") levels[a.zone] = a.level;
    else if (a.type === "setFormat") formats[a.zone] = a.format;
  }

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

  // Ad pressure, one track per channel: yesterday's fades, today's ads add. Out-of-home ads
  // spill over a little into neighbors (people cross the street); digital ads are targeted and don't.
  // Pressure is in "intensity" units (Low = 1/day), so spillover from an expensive zone
  // doesn't swamp a cheap neighbor.
  const plans = levels.map((level, i) => ({ level, format: formats[i] }));
  const oohIn = plans.map((p) => (runs(p, "ooh") ? C.levelMult[p.level] : 0));
  const digitalIn = plans.map((p) => (runs(p, "digital") ? C.levelMult[p.level] : 0));
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
  const brand = Math.min(C.brandCap, 1 + C.brandPerZone * strongZones) * eventMult(events, "viral", -1);
  const rain = eventMult(events, "rain", -1);
  const unitMargin = world.product.orderValue * world.product.margin;

  const lastDay = emptyLedger(n);
  let revenue = 0;
  let adSpend = 0;
  let customers = 0;
  for (let i = 0; i < n; i++) {
    const z = world.zones[i];
    const spend = adCostPerDay(pricesNow(world, events, i), plans[i]);
    let cust = 0;
    if (aware[i] > 1e-4) {
      const noise = Math.min(C.noiseMax, Math.max(C.noiseMin, 1 + C.noiseSd * rng.normal()));
      const local = eventMult(events, "streetFair", i) * eventMult(events, "competitor", i);
      cust = z.pmax * channelMix(z.formatEff, reachOoh[i], reachDigital[i]) * brand * noise * rain * local;
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

  // Insights: two weeks of ads in a neighborhood teaches one thing about the product.
  const adDays = state.adDays.map((d, i) => (levels[i] > 0 ? d + 1 : d));
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
    levels,
    formats,
    adDays,
    known,
    insights,
    pressure,
    pressureDigital,
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
