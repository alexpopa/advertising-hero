/**
 * Saves the current run in the browser. Storage can be unavailable (private windows,
 * blocked site data), so every access is wrapped: the game still runs, it just won't resume.
 */
import categories from "../scripts/categories.json";
import { initialKnown, type CategoriesData, type GameState } from "./sim";
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
    const state = migrate(g.state as unknown as Record<string, unknown>);
    return state ? { ...g, state } : null;
  } catch {
    return null;
  }
}

/**
 * Older saves carry on. Version 1 (before channels and insights) and version 2 (four formats
 * and schedules, 2026-11-22) start with out-of-home ads ("digital" stays digital). Version 3
 * (2026-11-23) called out-of-home "local" and had no digital awareness track.
 */
function migrate(s: Record<string, unknown>): GameState | null {
  if (s.version === 4) {
    // Events were removed on 2026-11-23; drop their fields from older saves.
    const { events: _e, nextEventDay: _n, eventLog: _l, ...rest4 } = s;
    void _e;
    void _n;
    void _l;
    return rest4 as unknown as GameState;
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
    ...(rest as unknown as GameState),
    version: 4,
    formats: new Array(n).fill(0).map((_, i) => (old?.[i] === "digital" ? "digital" : "ooh")),
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
