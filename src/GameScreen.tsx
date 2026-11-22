import { useCallback, useEffect, useRef, useState } from "react";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";
import { ZonePanel } from "./ZonePanel";
import { PRODUCT_UI } from "./StartScreen";
import type { GameData } from "./data";
import { C, describeEvent, step, type GameState, type Level, type World } from "./sim";
import { SCORE_BINS, usd } from "./scale";
import { hintsSeen, markHintsSeen } from "./storage";

/** Real seconds per game day at 1x. */
const SECONDS_PER_DAY = 3;
const SPEEDS = [1, 2, 4] as const;

interface Toast {
  id: number;
  title: string;
  detail: string;
  zone: number;
}

interface Props {
  data: GameData;
  world: World;
  brand: string;
  state: GameState;
  setState: (f: (s: GameState) => GameState) => void;
  onMenu: () => void;
}

export function GameScreen({ data, world, brand, state, setState, onMenu }: Props) {
  const [speed, setSpeed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false); // phones: the sidebar as a bottom sheet
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showHints, setShowHints] = useState(() => !hintsSeen() && state.day === 0);
  const playing = state.status === "playing";

  // The clock.
  useEffect(() => {
    if (!speed || !playing) return;
    const t = setInterval(() => setState((s) => step(world, s)), (SECONDS_PER_DAY * 1000) / speed);
    return () => clearInterval(t);
  }, [speed, playing, world, setState]);

  // Space pauses / resumes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === "Space" && !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) {
        e.preventDefault();
        setSpeed((s) => (s ? 0 : 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A toast for each new event.
  const seenEvents = useRef(state.eventLog.length);
  useEffect(() => {
    const fresh = state.eventLog.slice(seenEvents.current);
    seenEvents.current = state.eventLog.length;
    if (!fresh.length) return;
    const added = fresh.map((e) => ({ id: Math.random(), zone: e.zone, ...describeEvent(world, e) }));
    setToasts((t) => [...t, ...added].slice(-3));
    const ids = added.map((a) => a.id);
    setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 8000);
  }, [state.eventLog, world]);

  const setLevel = useCallback(
    (zone: number, level: Level) =>
      setState((s) => (s.status === "playing" ? { ...s, levels: s.levels.map((l, i) => (i === zone ? level : l)) as Level[] } : s)),
    [setState],
  );

  const select = (z: number | null) => {
    setSelected(z);
    if (z !== null) setSheet(false);
  };

  const yesterday = state.history[state.history.length - 1];
  const running = state.levels.filter((l) => l > 0).length;

  return (
    <div className="app">
      <header className="topbar game">
        <button className="brand-btn" onClick={onMenu} aria-label="Menu">
          <span aria-hidden>{PRODUCT_UI[world.productKey]?.icon}</span> <b>{brand}</b>
        </button>
        <div className="kpis">
          <div>
            <span className="muted small">Day</span>
            <b>
              {state.day}
              <span className="muted">/{C.days}</span>
            </b>
          </div>
          <div>
            <span className="muted small">Cash</span>
            <b className={state.cash < 0 ? "neg" : ""}>{usd(state.cash)}</b>
          </div>
          <div>
            <span className="muted small">Profit/day</span>
            <b className={!yesterday ? "" : yesterday.profit >= 0 ? "pos" : "neg"}>
              {yesterday ? (yesterday.profit >= 0 ? "+" : "") + usd(yesterday.profit) : "—"}
            </b>
          </div>
        </div>
        <div className="clock" role="group" aria-label="Game speed">
          <button className={speed === 0 ? "on" : ""} onClick={() => setSpeed(0)} aria-label="Pause" title="Pause (space)">
            ❚❚
          </button>
          {SPEEDS.map((s) => (
            <button key={s} className={speed === s ? "on" : ""} onClick={() => setSpeed(s)} aria-label={`Play at ${s}x`}>
              {s === 1 ? "▶" : `${s}×`}
            </button>
          ))}
          <button
            onClick={() => setState((s) => step(world, s))}
            disabled={!playing || speed > 0}
            title="Advance one day"
            aria-label="Advance one day"
          >
            +1
          </button>
        </div>
        <button className="btn btn-small phone-only" onClick={() => (setSheet((v) => !v), setSelected(null))}>
          {state.difficulty === "easy" ? "Suggestions" : "Campaigns"} ({running})
        </button>
      </header>

      {state.daysBelowZero > 0 && playing && (
        <div className="banner neg-bg" role="alert">
          Cash is below $0 ({state.daysBelowZero} of {C.bankruptDays} days). Cut losing campaigns or you'll go bankrupt.
        </div>
      )}
      {state.day === 0 && speed === 0 && !showHints && (
        <div className="banner" role="status">
          Pick a neighborhood and buy ads, then press ▶ to start the clock. Time is paused until you do.
        </div>
      )}

      <div className="game-body">
        <div className={"sidebar-wrap" + (sheet ? " open" : "")}>
          <Sidebar
            world={world}
            state={state}
            onSelect={select}
            onSetLevel={setLevel}
            onClose={sheet ? () => setSheet(false) : undefined}
          />
        </div>
        <main className="stage">
          <MapView
            geojson={data.geojson}
            world={world}
            selected={selected}
            onSelect={select}
            levels={state.levels}
            sheetOpen={sheet}
          />
          <div className="legend compact" aria-label="Score legend">
            <div className="legend-title">Fit for {world.product.name.toLowerCase()}</div>
            <div className="legend-row">
              {SCORE_BINS.map((b) => (
                <span key={b.min} className="swatch" style={{ background: b.color }} title={`${b.min}–${b.max} ${b.label}`} />
              ))}
            </div>
            <div className="legend-ends small muted">
              <span>Poor</span>
              <span>Great</span>
            </div>
          </div>

          {showHints && (
            <div className="hints" role="dialog" aria-label="How to play">
              <h2>How to play</h2>
              <ol>
                <li>
                  <b>Colors show where your product fits.</b> Darker blue means a better return per ad dollar.
                </li>
                <li>
                  {state.difficulty === "easy" ? (
                    <>
                      <b>Start with a suggestion</b> from the list on the left, or click any neighborhood.
                    </>
                  ) : (
                    <>
                      <b>Click a neighborhood</b> to see why it scores that way and what ads cost there.
                    </>
                  )}
                </li>
                <li>
                  <b>Watch profit per day and cut what's red.</b> Running the business costs{" "}
                  {usd(C.fixedOverhead)}/day, so you'll need several good neighborhoods. But every campaign has a{" "}
                  {usd(C.campaignFee)}/day fee and ads take about a week to build up, so don't buy everywhere.
                </li>
              </ol>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowHints(false);
                  markHintsSeen();
                }}
              >
                Got it
              </button>
            </div>
          )}

          <div className="toasts" aria-live="polite">
            {toasts.map((t) => (
              <button
                key={t.id}
                className="toast"
                onClick={() => {
                  if (t.zone >= 0) select(t.zone);
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                <b>{t.title}</b>
                <span className="small muted">{t.detail}</span>
              </button>
            ))}
          </div>

          {selected !== null && (
            <ZonePanel
              world={world}
              zone={selected}
              examples={data.examples[world.zones[selected].id]}
              onClose={() => setSelected(null)}
              state={state}
              onSetLevel={(l) => setLevel(selected, l)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
