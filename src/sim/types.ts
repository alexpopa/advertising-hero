/** Shapes of the data files (public/data/zones.json, scripts/categories.json). */
export interface ZoneData {
  id: string;
  name: string;
  hexes: number;
  center: [number, number];
  /** Land area, km2. */
  area: number;
  /** Sum of footprint x floors, m2. */
  floorArea: number;
  buildings: number;
  transit: number;
  nAll: number;
  /** Place counts per Overture category label. */
  n: Record<string, number>;
  /** Branded (chain) place counts per competitor label. */
  nBranded: Record<string, number>;
  neighbors: string[];
}

export type Tier = "starter" | "tricky" | "expert";

export interface ProductData {
  name: string;
  /** Menu group, e.g. "Food & drink". */
  group: string;
  icon: string;
  /** One line about the buyers: the only clue on Hard. */
  who: string;
  tier: Tier;
  orderValue: number;
  margin: number;
  /** Customers: places that show your buyers are around. */
  demand: Record<string, number>;
  /** Stores that carry you: they raise sales nearby and make out-of-home ads stronger. */
  stockists: Record<string, number>;
  /** They take sales. A label can be a stockist and a competitor at once. */
  competitors: Record<string, number>;
  /** Look relevant, but don't matter. */
  decoys: string[];
  /** What Normal mode tells you at the start. */
  hints: string[];
}

export interface CategoriesData {
  products: Record<string, ProductData>;
  /** Map layer groups. */
  layers?: { group: string; labels: string[] }[];
}

export type Difficulty = "easy" | "normal" | "hard";

/**
 * Ad channels, named as the industry does. Out-of-home (OOH: billboards, bus shelters,
 * posters, displays in shops and venues) is strongest where many people pass and near stores
 * that sell you. Digital (targeted online ads) follows where your buyers are. Each zone runs
 * each channel at its own level: each costs its own money and adds its own awareness.
 */
export type Channel = "ooh" | "digital";
export const CHANNELS: Channel[] = ["ooh", "digital"];
export const CHANNEL_NAMES: Record<Channel, string> = { ooh: "Out-of-home", digital: "Digital" };
export const CHANNEL_ICONS: Record<Channel, string> = { ooh: "🪧", digital: "📱" };

/** A zone's ads: a level per channel (0 = off). */
export type Plan = Record<Channel, Level>;
export const OFF: Plan = { ooh: 0, digital: 0 };
/** Does this plan run any ads? */
export const isOn = (p: Plan) => p.ooh > 0 || p.digital > 0;
/** The higher of the two levels (for the map badge). */
export const topLevel = (p: Plan) => Math.max(p.ooh, p.digital) as Level;
/** "Medium out-of-home + Low digital", "Low digital", "no ads" */
export function planName(p: Plan): string {
  const parts = CHANNELS.filter((ch) => p[ch] > 0).map((ch) => `${LEVEL_NAMES[p[ch]]} ${CHANNEL_NAMES[ch].toLowerCase()}`);
  return parts.length ? parts.join(" + ") : "no ads";
}
/** Every plan: 4 out-of-home levels x 4 digital levels, Off first. */
export const ALL_PLANS: Plan[] = ([0, 1, 2, 3] as Level[]).flatMap((ooh) =>
  ([0, 1, 2, 3] as Level[]).map((digital) => ({ ooh, digital })),
);

/** Steady-state estimate for one plan in one zone. */
export interface Estimate {
  customers: number;
  cost: number;
  profit: number;
}

/** What a label does for the product. */
export type Role = "customers" | "stockist" | "competitor" | "both" | "decoy";
/** 0 Off, 1 Low, 2 Medium, 3 High. */
export type Level = 0 | 1 | 2 | 3;
export const LEVEL_NAMES = ["Off", "Low", "Medium", "High"] as const;

/** One demand or competitor label's contribution in a zone. */
export interface SignalPart {
  label: string;
  weight: number;
  count: number;
  /** Percentile of count per km2 across zones, 0..1 (0 when the zone has none). */
  pct: number;
}

/** Everything about a zone that doesn't change during a run, for one product. */
export interface ZoneModel {
  index: number;
  id: string;
  name: string;
  data: ZoneData;
  /** Estimated people who live or work here. */
  people: number;
  /** 0..1 */
  busyness: number;
  /** 0..1 */
  fit: number;
  fitParts: SignalPart[];
  /** Weighted competitor count (chains count extra). */
  competition: number;
  /** Weighted competitors per 10,000 people. */
  competitionDensity: number;
  compParts: { label: string; weight: number; count: number; branded: number }[];
  /** 0..1, share of potential left after competition. */
  compFactor: number;
  stockParts: { label: string; weight: number; count: number }[];
  /** Weighted stockists per 10,000 people. */
  stockDensity: number;
  /** >= 1: sales boost from stores that carry you. */
  stockFactor: number;
  /** 0..1: average of busyness and (if sold in stores) stockist percentile. Drives out-of-home ads. */
  oohMix: number;
  /** How well each ad channel works here (multiplies customers). */
  formatEff: Record<Channel, number>;
  /** Customers/day if everyone here knew your brand. */
  pmax: number;
  /** Low-level out-of-home ad price, $/day (Medium = 2x, High = 4x). Includes the busy-area premium. */
  price: number;
  /** Low-level digital ad price, $/day: per person, no busy-area premium. */
  priceDigital: number;
  /** Percentile of price across zones, 0..1. */
  pricePct: number;
  /** 0..100, steady-state return per ad dollar at Medium, as a percentile. */
  score: number;
  /** Steady-state estimates per plan, as est[ooh level][digital level], ignoring brand, spillover and noise. */
  est: Estimate[][];
  /** The most profitable plan here (OFF if nothing pays). */
  best: Plan;
  bestProfit: number;
  neighbors: number[];
}

export interface World {
  productKey: string;
  product: ProductData;
  /** Calibrated share of people who buy per day at full awareness (see constants). */
  purchaseRate: number;
  /** Factor applied to all ad prices and customers to set the money scale. */
  moneyScale: number;
  zones: ZoneModel[];
  byId: Map<string, ZoneModel>;
}

/** Something the player learned by running ads. */
export interface Insight {
  day: number;
  zone: number;
  label: string;
}

/** The highest ad level your team can buy in each channel (0: nobody can buy it yet). */
export type Staff = Record<Channel, Level>;

/** Something bought with cash that lasts the whole run: a hire or a shop. */
export interface Purchase {
  day: number;
  kind: "hire" | "shop";
  /** The hire's channel. */
  channel?: Channel;
  /** The level the hire unlocked. */
  level?: Level;
  /** The shop's zone. */
  zone?: number;
  cost: number;
}

export interface DayResult {
  day: number;
  revenue: number;
  adSpend: number;
  /** Everything else: base running cost, salaries, shop rent, and the share of sales. */
  overhead: number;
  profit: number;
  cash: number;
  customers: number;
}

/** Per-zone numbers, as arrays indexed by zone. */
export interface ZoneLedger {
  customers: number[];
  revenue: number[];
  adSpend: number[];
}

export interface GameState {
  version: 5;
  seed: number;
  rng: number;
  productKey: string;
  difficulty: Difficulty;
  /** Days completed so far (0 before the first step). */
  day: number;
  cash: number;
  /** Ad levels per zone index, one per channel. */
  plans: Plan[];
  /** Days each zone has had ads running, for insights. */
  adDays: number[];
  /** Labels the player knows the role of. */
  known: string[];
  insights: Insight[];
  /** Out-of-home ad pressure per zone index, in "Low-level days" units. */
  pressure: number[];
  /** Digital ad pressure per zone index. */
  pressureDigital: number[];
  /** Which ad levels your team can buy. */
  staff: Staff;
  /** Zones with your own shop, in the order opened. */
  shops: number[];
  /** Hires and shops, in order. */
  purchases: Purchase[];
  /** One entry per finished month: was its goal met? */
  goalsMet: boolean[];
  daysBelowZero: number;
  status: "playing" | "finished" | "bankrupt";
  history: DayResult[];
  /** The most recent day, per zone (for the campaigns tab). */
  lastDay: ZoneLedger;
  /** Whole run so far, per zone (for the end screen). */
  totals: ZoneLedger;
}

export type Action =
  | { type: "setPlan"; zone: number; plan: Partial<Plan> }
  | { type: "hire"; channel: Channel }
  | { type: "openShop"; zone: number };
