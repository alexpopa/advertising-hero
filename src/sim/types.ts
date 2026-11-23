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
 * that sell you. Digital (targeted online ads) follows where your buyers are. A campaign runs
 * one or both: each channel costs its own money and adds its own awareness.
 */
export type Channel = "ooh" | "digital";
export const CHANNELS: Channel[] = ["ooh", "digital"];
export const CHANNEL_NAMES: Record<Channel, string> = { ooh: "Out-of-home", digital: "Digital" };
/** Which channels a campaign runs. */
export type Format = Channel | "both";
export const FORMATS: Format[] = ["ooh", "digital", "both"];
export const FORMAT_NAMES: Record<Format, string> = { ooh: "Out-of-home", digital: "Digital", both: "Out-of-home + digital" };
export const channelsOf = (f: Format): Channel[] => (f === "both" ? ["ooh", "digital"] : [f]);
/** The format for a set of ticked channels, or null for none. */
export function formatOf(ooh: boolean, digital: boolean): Format | null {
  return ooh && digital ? "both" : ooh ? "ooh" : digital ? "digital" : null;
}

/** A campaign setting for one zone. */
export interface Plan {
  level: Level;
  format: Format;
}

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
  /** Steady-state estimates per format and level (0..3), ignoring brand, spillover and noise. */
  est: Record<Format, Estimate[]>;
  /** The most profitable plan here (level 0 if nothing pays). */
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

export interface DayResult {
  day: number;
  revenue: number;
  adSpend: number;
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
  version: 4;
  seed: number;
  rng: number;
  productKey: string;
  difficulty: Difficulty;
  /** Days completed so far (0 before the first step). */
  day: number;
  cash: number;
  /** Ad level per zone index. */
  levels: Level[];
  /** Ad format per zone index (kept when ads are off, so fading ads keep theirs). */
  formats: Format[];
  /** Days each zone has had ads running, for insights. */
  adDays: number[];
  /** Labels the player knows the role of. */
  known: string[];
  insights: Insight[];
  /** Out-of-home ad pressure per zone index, in "Low-level days" units. */
  pressure: number[];
  /** Digital ad pressure per zone index. */
  pressureDigital: number[];
  daysBelowZero: number;
  status: "playing" | "finished" | "bankrupt";
  history: DayResult[];
  /** The most recent day, per zone (for the campaigns tab). */
  lastDay: ZoneLedger;
  /** Whole run so far, per zone (for the end screen). */
  totals: ZoneLedger;
}

export type Action =
  | { type: "setLevel"; zone: number; level: Level }
  | { type: "setFormat"; zone: number; format: Format };
