/**
 * Saves the current run in the browser. Storage can be unavailable (private windows,
 * blocked site data), so every access is wrapped: the game still runs, it just won't resume.
 */
import categories from "../scripts/categories.json";
import { C, initialKnown, type CategoriesData, type GameState, type Level } from "./sim";
import type { MapLayer } from "./layers";

export interface SavedGame {
  brand: string;
  state: GameState;
  /** What the map was colored by, so a reload comes back to the same view. */
  layer?: MapLayer;
}

const GAME_KEY = "ad-empire-sf:game:v1";
const HINTS_KEY = "ad-empire-sf:hints-seen:v1";

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as SavedGame;
    if (typeof g?.brand !== "string" || !g.state) return null;
    const raw4 = g.state as unknown as Record<string, unknown>;
    const state = raw4.version === 5 ? (raw4 as unknown as GameState) : upgradeTo5(migrate(raw4));
    return state ? { ...g, state } : null;
  } catch {
    return null;
  }
}

/**
 * Version 4 saves come from before the team, shops, monthly goals and per-channel levels
 * (2026-11-23). They carry on with the whole team already hired (every ad level was open to
 * them), no shops, the months already played counted as missed, and their one level applied
 * to each channel they ran.
 */
type V4 = Omit<GameState, "version" | "staff" | "shops" | "purchases" | "goalsMet" | "plans"> & {
  version: 4;
  levels: Level[];
  formats: ("ooh" | "digital" | "both")[];
};
function upgradeTo5(s: V4 | null): GameState | null {
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
    goalsMet: new Array(Math.min(C.goals.length, Math.floor(s.day / C.monthDays))).fill(false),
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
    known: (s.known as string[] | undefined) ?? initialKnown(product, s.difficulty as GameState["difficulty"]),
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
