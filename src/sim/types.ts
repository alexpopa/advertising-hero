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

export interface ProductData {
  name: string;
  orderValue: number;
  margin: number;
  demand: Record<string, number>;
  competitors: Record<string, number>;
}

export interface CategoriesData {
  products: Record<string, ProductData>;
  events?: Record<string, string[]>;
}

export type Difficulty = "easy" | "hard";
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
  /** Customers/day if everyone here knew your brand. */
  pmax: number;
  /** Low-level ad price, $/day (Medium = 2x, High = 4x). */
  price: number;
  /** Percentile of price across zones, 0..1. */
  pricePct: number;
  /** 0..100, steady-state return per ad dollar at Medium, as a percentile. */
  score: number;
  /** Steady-state profit/day at each level, ignoring brand, spillover and noise. */
  steadyProfit: [number, number, number, number];
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
  /** Weights for choosing event zones. */
  eventWeights: { streetFair: number[]; competitor: number[]; busyness: number[] };
}

export type EventKind = "streetFair" | "rain" | "competitor" | "viral" | "priceUp";

export interface ActiveEvent {
  kind: EventKind;
  /** Zone index, or -1 for citywide. */
  zone: number;
  daysLeft: number;
  /** Day the event started. */
  day: number;
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
  version: 1;
  seed: number;
  rng: number;
  productKey: string;
  difficulty: Difficulty;
  /** Days completed so far (0 before the first step). */
  day: number;
  cash: number;
  /** Ad level per zone index. */
  levels: Level[];
  /** Ad pressure per zone index, in "Low-level days" units. */
  pressure: number[];
  daysBelowZero: number;
  status: "playing" | "finished" | "bankrupt";
  events: ActiveEvent[];
  nextEventDay: number;
  /** Every event that has happened, for the log. */
  eventLog: ActiveEvent[];
  history: DayResult[];
  /** The most recent day, per zone (for the campaigns tab). */
  lastDay: ZoneLedger;
  /** Whole run so far, per zone (for the end screen). */
  totals: ZoneLedger;
}

export type Action = { type: "setLevel"; zone: number; level: Level };
