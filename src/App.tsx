/**
 * One screen: the map fills the window the whole time and everything else floats over it.
 * Phases: the menu (Continue / New game), play, and the results card when a run ends. The
 * map is mounted once at the top of the tree so switching phases never reloads it.
 *
 * The run is saved in the browser after every change, so a reload offers Continue.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EndScreen } from "./EndScreen";
import { GameHud } from "./GameHud";
import { Menu } from "./Menu";
import { MapView } from "./MapView";
import { ZonePanel } from "./ZonePanel";
import { MapControl } from "./LayersPanel";
import { layerView, normalizeLayer, type MapLayer } from "./layers";
import { loadGameData, type GameData } from "./data";
import { buildWorld, initGame, type Difficulty, type GameState, type Plan } from "./sim";
import { loadGame, saveGame, type SavedGame } from "./storage";
import { popId, type Pop } from "./pops";

type Phase = "menu" | "play" | "end";

export function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<SavedGame | null>(loadGame);
  const [phase, setPhase] = useState<Phase>("menu");
  const [startNew, setStartNew] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  /** Bubbles over the map; only recent ones are kept (the map shows each id once). */
  const [pops, setPops] = useState<Pop[]>([]);
  const addPops = useCallback((p: Pop[]) => p.length && setPops((old) => [...old.slice(-80), ...p]), []);
  const levelsNow = useRef<number[]>([]);
  levelsNow.current = game?.state.levels ?? [];
  const layer: MapLayer = normalizeLayer(game?.layer) ?? { kind: game?.state.difficulty === "easy" ? "fit" : "none" };
  const setLayer = useCallback((l: MapLayer) => setGame((g) => (g ? { ...g, layer: l } : g)), []);

  useEffect(() => {
    loadGameData().then(setData, (e: Error) => setError(e.message));
  }, []);

  // Before any game exists the map still needs a world for zone names and hit-testing;
  // any product will do since the menu map is uncolored.
  const productKey = game?.state.productKey ?? (data ? Object.keys(data.categories.products)[0] : undefined);
  const world = useMemo(
    () => (data && productKey ? buildWorld(data.zones, data.categories, productKey) : null),
    [data, productKey],
  );
  const inGame = phase !== "menu" && game !== null;
  // Keyed by the layer's content: the default layer is a fresh object on every render.
  const layerKey = inGame ? JSON.stringify(layer) : "menu";
  const view = useMemo(
    () => (world ? layerView(world, inGame ? layer : { kind: "none" }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, layerKey],
  );

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  // Show the results shortly after a run finishes. Only when the status changes, so closing
  // the results to look at the map doesn't bounce back.
  const status = game?.state.status;
  useEffect(() => {
    if (status && status !== "playing") {
      const t = setTimeout(() => setPhase((p) => (p === "play" ? "end" : p)), 800);
      return () => clearTimeout(t);
    }
  }, [status]);

  const setState = useCallback(
    (f: (s: GameState) => GameState) => setGame((g) => (g ? { ...g, state: f(g.state) } : g)),
    [],
  );
  /** Change a zone's campaign: its level, its format, or both. */
  const setPlan = useCallback(
    (zone: number, change: Partial<Plan>) => {
      if (change.level && !levelsNow.current[zone]) addPops([{ id: popId(), zone, kind: "added", text: "Added", delay: 0 }]);
      setState((s) => {
        if (s.status !== "playing") return s;
        const at = <T,>(arr: T[], v: T | undefined) => (v === undefined ? arr : arr.map((x, i) => (i === zone ? v : x)));
        return {
          ...s,
          levels: at(s.levels, change.level),
          formats: at(s.formats, change.format),
        };
      });
    },
    [setState, addPops],
  );

  // Escape closes the neighborhood card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const start = (brand: string, key: string, difficulty: Difficulty) => {
    if (!data) return;
    const w = buildWorld(data.zones, data.categories, key);
    const seed = (Math.random() * 2 ** 31) | 0;
    // Normal and Hard start with a plain map (the default layer): the fit colors nearly give the answer away.
    setGame({ brand, state: initGame(w, seed, difficulty) });
    setSelected(null);
    setPhase("play");
  };

  const resume = () => {
    if (!game) return;
    setPhase(game.state.status === "playing" ? "play" : "end");
  };

  return (
    <div className="shell">
      {data && world && view && (
        <MapView
          geojson={data.geojson}
          world={world}
          selected={inGame ? selected : null}
          onSelect={inGame ? setSelected : () => {}}
          levels={inGame ? game.state.levels : undefined}
          paint={view.paint}
          describe={view.describe}
          zoneCardOpen={inGame && selected !== null}
          pops={inGame ? pops : undefined}
        />
      )}

      {error && <div className="float-card center-card">Couldn't load the map data: {error}</div>}
      {!error && !data && <div className="float-card center-card loading">Loading San Francisco…</div>}

      {data && world && phase === "menu" && (
        <Menu
          key={String(startNew)}
          categories={data.categories}
          saved={game}
          startNew={startNew}
          onStart={start}
          onContinue={resume}
        />
      )}

      {inGame && world && view && (
        <>
          <GameHud
            key={game.state.seed}
            world={world}
            brand={game.brand}
            state={game.state}
            setState={setState}
            setPlan={setPlan}
            onSelect={setSelected}
            onPops={addPops}
            zoneOpen={selected !== null}
            paused={phase !== "play"}
            onMenu={() => {
              setStartNew(false);
              setPhase("menu");
            }}
            onResults={() => setPhase("end")}
          />
          <MapControl
            world={world}
            layer={layer}
            view={view}
            onChange={setLayer}
            allowFit={game.state.difficulty === "easy"}
          />
          {selected !== null && (
            <ZonePanel
              world={world}
              zone={selected}
              examples={data!.examples[world.zones[selected].id]}
              onClose={() => setSelected(null)}
              state={game.state}
              onSetPlan={(p) => setPlan(selected, p)}
            />
          )}
        </>
      )}

      {phase === "end" && game && world && (
        <EndScreen
          world={world}
          brand={game.brand}
          state={game.state}
          onPlayAgain={() => {
            setStartNew(true);
            setPhase("menu");
          }}
          onViewMap={() => setPhase("play")}
        />
      )}
    </div>
  );
}
