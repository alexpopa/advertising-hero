/**
 * Screens: start -> game -> end. The run is saved in the browser after every change, so a
 * reload picks up where you left off.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { EndScreen } from "./EndScreen";
import { GameScreen } from "./GameScreen";
import { StartScreen } from "./StartScreen";
import { loadGameData, type GameData } from "./data";
import { buildWorld, initGame, type Difficulty, type GameState } from "./sim";
import { loadGame, saveGame, type SavedGame } from "./storage";

type Screen = "start" | "game" | "end";

export function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved] = useState(loadGame);
  const [game, setGame] = useState<SavedGame | null>(null);
  const [screen, setScreen] = useState<Screen>("start");

  useEffect(() => {
    loadGameData().then(setData, (e: Error) => setError(e.message));
  }, []);

  const productKey = game?.state.productKey;
  const world = useMemo(
    () => (data && productKey ? buildWorld(data.zones, data.categories, productKey) : null),
    [data, productKey],
  );

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  // Show the end screen shortly after a run finishes.
  const status = game?.state.status;
  // Only when the status changes, so "Look at the map" afterwards doesn't bounce back.
  useEffect(() => {
    if (status && status !== "playing") {
      const t = setTimeout(() => setScreen((s) => (s === "game" ? "end" : s)), 800);
      return () => clearTimeout(t);
    }
  }, [status]);

  const setState = useCallback(
    (f: (s: GameState) => GameState) => setGame((g) => (g ? { ...g, state: f(g.state) } : g)),
    [],
  );

  if (error) return <div className="center">Couldn't load the map data: {error}</div>;
  if (!data) return <div className="center">Loading San Francisco…</div>;

  if (screen === "start" || !game || !world) {
    return (
      <StartScreen
        categories={data.categories}
        saved={game ?? saved}
        onStart={(brand: string, key: string, difficulty: Difficulty) => {
          const w = buildWorld(data.zones, data.categories, key);
          const seed = (Math.random() * 2 ** 31) | 0;
          setGame({ brand, state: initGame(w, seed, difficulty) });
          setScreen("game");
        }}
        onContinue={() => {
          if (!game && saved) setGame(saved);
          setScreen("game");
        }}
      />
    );
  }

  if (screen === "end") {
    return (
      <EndScreen
        world={world}
        brand={game.brand}
        state={game.state}
        onPlayAgain={() => setScreen("start")}
        onViewMap={() => setScreen("game")}
      />
    );
  }

  return (
    <GameScreen
      data={data}
      world={world}
      brand={game.brand}
      state={game.state}
      setState={setState}
      onMenu={() => setScreen(game.state.status === "playing" ? "start" : "end")}
    />
  );
}
