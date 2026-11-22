/**
 * Saves the current run in the browser. Storage can be unavailable (private windows,
 * blocked site data), so every access is wrapped: the game still runs, it just won't resume.
 */
import type { GameState } from "./sim";

export interface SavedGame {
  brand: string;
  state: GameState;
}

const GAME_KEY = "ad-empire-sf:game:v1";
const HINTS_KEY = "ad-empire-sf:hints-seen:v1";

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as SavedGame;
    return g?.state?.version === 1 && typeof g.brand === "string" ? g : null;
  } catch {
    return null;
  }
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
