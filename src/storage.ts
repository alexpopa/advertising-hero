/**
 * Saves the current run in the browser. Storage can be unavailable (private windows,
 * blocked site data), so every access is wrapped: the game still runs, it just won't resume.
 */
import categories from "../scripts/categories.json";
import { initialKnown, type CategoriesData, type GameState, type Level } from "./sim";
import type { MapLayer } from "./layers";

export interface SavedGame {
  brand: string;
  state: GameState;
  /** What the map was colored by, so a reload comes back to the same view. */
  layer?: MapLayer;
}

const GAME_KEY = "ad-empire-sf:game:v1";
const HINTS_KEY = "ad-empire-sf:hints-seen:v2";

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as SavedGame;
    if (typeof g?.brand !== "string" || !g.state) return null;
    const raw4 = g.state as unknown as Record<string, unknown>;
    const state =
      raw4.version === 6
        ? (raw4 as unknown as GameState)
        : upgradeTo6(raw4.version === 5 ? (raw4 as unknown as V5) : upgradeTo5(migrate(raw4)));
    return state ? { ...g, state: tidy(state) } : null;
  } catch {
    return null;
  }
}

/**
 * 2026-11-23: three difficulties became two (old Normal is now Hard, old Hard is gone) and
 * monthly goals were removed. Saved runs on either old mode carry on as Hard.
 */
function tidy(state: GameState): GameState {
  const { goalsMet: _g, ...rest } = state as GameState & { goalsMet?: unknown };
  void _g;
  return { ...rest, difficulty: rest.difficulty === "easy" ? "easy" : "hard" };
}

/**
 * Version 5 saves come from before dollars were multiplied by 10 (2026-11-23). Customers
 * were scaled up with prices, so every money and customer figure is multiplied by 10 and the
 * run carries on with the same balance.
 */
type V5 = Omit<GameState, "version"> & { version: 5 };
const MONEY_SCALE = 10;
function upgradeTo6(s: V5 | null): GameState | null {
  if (!s) return null;
  const x = (v: number) => v * MONEY_SCALE;
  const ledger = (l: GameState["totals"]) => ({
    customers: l.customers.map(x),
    revenue: l.revenue.map(x),
    adSpend: l.adSpend.map(x),
  });
  return {
    ...s,
    version: 6,
    cash: x(s.cash),
    history: s.history.map((h) => ({
      ...h,
      revenue: x(h.revenue),
      adSpend: x(h.adSpend),
      overhead: x(h.overhead),
      profit: x(h.profit),
      cash: x(h.cash),
      customers: x(h.customers),
    })),
    lastDay: ledger(s.lastDay),
    totals: ledger(s.totals),
    purchases: s.purchases.map((p) => ({ ...p, cost: x(p.cost) })),
  };
}

/**
 * Version 4 saves come from before the team, shops and per-channel levels
 * (2026-11-23). They carry on with the whole team already hired (every ad level was open to
 * them), no shops, and their one level applied
 * to each channel they ran.
 */
type V4 = Omit<GameState, "version" | "staff" | "shops" | "purchases" | "plans"> & {
  version: 4;
  levels: Level[];
  formats: ("ooh" | "digital" | "both")[];
};
function upgradeTo5(s: V4 | null): V5 | null {
  if (!s) return null;
  const { levels, formats, ...rest } = s;
  return {
    ...rest,
    version: 5,
    // One level and a choice of channels became a level per channel.
    plans: levels.map((l, i) => ({
      ooh: formats[i] !== "digital" ? l : 0,
      digital: formats[i] !== "ooh" ? l : 0,
    })),
    staff: { ooh: 3, digital: 3 },
    shops: [],
    purchases: [],
  };
}

/**
 * Older saves carry on. Version 1 (before channels and insights) and version 2 (four formats
 * and schedules, 2026-11-22) start with out-of-home ads ("digital" stays digital). Version 3
 * (2026-11-23) called out-of-home "local" and had no digital awareness track.
 */
function migrate(s: Record<string, unknown>): V4 | null {
  if (s.version === 4) {
    // Events were removed on 2026-11-23; drop their fields from older saves.
    const { events: _e, nextEventDay: _n, eventLog: _l, ...rest4 } = s;
    void _e;
    void _n;
    void _l;
    return rest4 as unknown as V4;
  }
  if (s.version !== 1 && s.version !== 2 && s.version !== 3) return null;
  const product = (categories as unknown as CategoriesData).products[s.productKey as string];
  if (!product) return null;
  const n = (s.levels as number[]).length;
  const old = s.formats as string[] | undefined;
  const { schedules: _a, pressureOnline: _b, events: _e, nextEventDay: _n, eventLog: _l, ...rest } = s as Record<string, unknown>;
  void _a;
  void _b;
  void _e;
  void _n;
  void _l;
  return {
    ...(rest as unknown as V4),
    version: 4,
    formats: new Array(n).fill(0).map((_, i) => (old?.[i] === "digital" ? "digital" : "ooh")) as V4["formats"],
    pressureDigital: (s.pressureOnline as number[] | undefined) ?? new Array(n).fill(0),
    adDays: (s.adDays as number[] | undefined) ?? new Array(n).fill(0),
    known: (s.known as string[] | undefined) ?? initialKnown(product, s.difficulty === "easy" ? "easy" : "hard"),
    insights: (s.insights as GameState["insights"] | undefined) ?? [],
  };
}

export function saveGame(game: SavedGame | null): void {
  try {
    if (game) localStorage.setItem(GAME_KEY, JSON.stringify(game));
    else localStorage.removeItem(GAME_KEY);
  } catch {
    /* storage unavailable: keep playing without saving */
  }
}

export function hintsSeen(): boolean {
  try {
    return localStorage.getItem(HINTS_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHintsSeen(): void {
  try {
    localStorage.setItem(HINTS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** A run that paid off the bank: kept between games in this browser. The day is the score. */
export interface Win {
  /** The run's seed, so the same win is never recorded twice. */
  seed: number;
  productKey: string;
  day: number;
  difficulty: GameState["difficulty"];
  brand: string;
  /** When it was won (ISO date). */
  date: string;
}

const WINS_KEY = "ad-empire-sf:wins:v1";

export function loadWins(): Win[] {
  try {
    const w = JSON.parse(localStorage.getItem(WINS_KEY) ?? "[]") as Win[];
    return Array.isArray(w) ? w.filter((x) => typeof x?.day === "number" && typeof x.productKey === "string") : [];
  } catch {
    return [];
  }
}

/** Records a paid-off run (once per run) and returns every win. */
export function recordWin(brand: string, state: GameState): Win[] {
  const wins = loadWins();
  if (state.paidDay === undefined || wins.some((w) => w.seed === state.seed)) return wins;
  const next = [
    ...wins,
    {
      seed: state.seed,
      productKey: state.productKey,
      day: state.paidDay,
      difficulty: state.difficulty,
      brand,
      date: new Date().toISOString().slice(0, 10),
    },
  ];
  try {
    localStorage.setItem(WINS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the win just isn't remembered */
  }
  return next;
}

/** The fastest payoff per product. */
export function bestDays(wins: Win[]): Map<string, Win> {
  const m = new Map<string, Win>();
  for (const w of wins) {
    const b = m.get(w.productKey);
    if (!b || w.day < b.day) m.set(w.productKey, w);
  }
  return m;
}
