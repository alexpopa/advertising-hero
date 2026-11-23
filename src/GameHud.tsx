/**
 * What floats over the map during a run. Only one thing is always there: a small pill with
 * the brand, day, cash and the clock. Clicking the brand opens a dropdown with campaigns
 * and what you know (and suggestions on Easy). What the map shows lives in its own button
 * (LayersPanel.tsx). Toasts, the low-cash warning and the
 * first-run hints come and go on their own.
 */
import { useEffect, useRef, useState } from "react";
import { Campaigns, Knowledge, Suggestions, Team } from "./Lists";
import {
  C,
  CHANNELS,
  CHANNEL_ICONS,
  CHANNEL_NAMES,
  LEVEL_NAMES,
  OFF,
  adCost,
  estimateFor,
  isOn,
  labelName,
  hiredOf,
  nextHire,
  shopCost,
  shopsIn,
  reach,
  steadyPressure,
  fixedCosts,
  canAddShop,
  roleSentence,
  step,
  type Channel,
  type GameState,
  type Plan,
  type World,
} from "./sim";
import { usd } from "./scale";
import { popsForDay, type Pop } from "./pops";
import { hintsSeen, markHintsSeen } from "./storage";
import { useExclusivePanel } from "./panels";

/** Real seconds per game day at 1x. */
const SECONDS_PER_DAY = 2;
const SPEEDS = [1, 2, 4] as const;

type Tab = "suggestions" | "campaigns" | "know";
const TAB_NAMES: Record<Tab, string> = {
  suggestions: "Suggestions",
  campaigns: "Campaigns",
  know: "What you know",
};

interface Toast {
  id: number;
  title: string;
  detail: string;
  zone: number;
  insight?: boolean;
}

interface Props {
  world: World;
  brand: string;
  state: GameState;
  setState: (f: (s: GameState) => GameState) => void;
  setPlan: (zone: number, change: Partial<Plan>) => void;
  onSelect: (zone: number | null) => void;
  /** True while the results card is up: the clock stops. */
  paused: boolean;
  onMenu: () => void;
  onResults: () => void;
  /** Bubbles over the map for each day that passes (leads, orders). */
  onPops?: (pops: Pop[]) => void;
  /** Is the neighborhood card open? (On phones it covers the plan tray.) */
  zoneOpen?: boolean;
  onHire: (channel: Channel) => void;
}

export function GameHud({
  world,
  brand,
  state,
  setState,
  setPlan,
  onSelect,
  paused,
  onMenu,
  onResults,
  onPops,
  zoneOpen,
  onHire,
}: Props) {
  const [running, setRunning] = useState(false);
  const [speedIx, setSpeedIx] = useState(0);
  const [tab, setTab] = useState<Tab | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showHints, setShowHints] = useState(() => !hintsSeen() && state.day === 0);
  const playing = state.status === "playing";
  const easy = state.difficulty === "easy";
  const speed = SPEEDS[speedIx];
  const ticking = running && playing && !paused;
  const tabs: Tab[] = easy ? ["suggestions", "campaigns", "know"] : ["campaigns", "know"];
  const [teamOpen, setTeamOpen] = useState(false);
  const hud = useRef<HTMLDivElement>(null);
  useExclusivePanel("menu", tab !== null, () => setTab(null));
  useExclusivePanel("team", teamOpen, () => setTeamOpen(false));

  // The clock.
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setState((s) => step(world, s)), (SECONDS_PER_DAY * 1000) / speed);
    return () => clearInterval(t);
  }, [ticking, speed, world, setState]);

  // Space pauses / resumes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === "Space" && !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) {
        e.preventDefault();
        setRunning((r) => !r);
      }
      if (e.key === "Escape") {
        setTab(null);
        setTeamOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clicking outside the pill and its dropdown closes the dropdown.
  useEffect(() => {
    if (!tab) return;
    const onDown = (e: PointerEvent) => {
      if (hud.current && !hud.current.contains(e.target as Node)) setTab(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [tab]);

  // A toast for each new insight.
  const seenInsights = useRef(state.insights.length);
  useEffect(() => {
    const fresh = state.insights.slice(seenInsights.current);
    seenInsights.current = state.insights.length;
    if (!fresh.length) return;
    const added = fresh.map((ins) => ({
      id: Math.random(),
      zone: ins.zone,
      title: `New insight from ${world.zones[ins.zone].name}`,
      detail: roleSentence(world, ins.label),
      insight: true,
    }));
    setToasts((t) => [...t, ...added].slice(-3));
    const ids = added.map((a) => a.id);
    setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 12000);
  }, [state.insights, world]);

  // Leads and orders pop up over the map each day. Only for a day that just passed, not on
  // load or after a reset, so reopening a saved game doesn't replay old sales.
  const prevState = useRef(state);
  useEffect(() => {
    const before = prevState.current;
    prevState.current = state;
    if (!onPops || state.day !== before.day + 1) return;
    const pops = popsForDay(world, before, state, (SECONDS_PER_DAY * 1000) / speed);
    onPops(pops);
    const first = pops.find((p) => p.kind === "first");
    if (first) {
      const t: Toast = {
        id: Math.random(),
        zone: first.zone,
        title: `🎉 First sale, in ${world.zones[first.zone].name}!`,
        detail: "🙂 shows how many people noticed you, 🛍️ your orders. Most people who notice don't buy right away.",
      };
      setToasts((all) => [...all, t].slice(-3));
      setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 9000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.day]);

  const select = (z: number) => {
    onSelect(z);
    setTab(null);
  };

  const yesterday = state.history[state.history.length - 1];
  const target = easy && playing ? buildingTarget(world, state) : null;
  const campaignCount = state.plans.filter(isOn).length;
  const waitingToStart = playing && state.day === 0 && !running;

  return (
    <>
      <div className="hud" ref={hud}>
        <div className="pill">
          {/* The bank loan: a thin bar along the pill's bottom edge, filling with cash. */}
          <span
            className="loan-bar"
            style={{ visibility: state.paidDay === undefined ? "visible" : "hidden" }}
            role="img"
            aria-label={`Bank loan: ${usd(Math.max(0, state.cash))} of ${usd(C.loan)}`}
          >
            <span style={{ width: `${Math.min(100, Math.max(0, (state.cash / C.loan) * 100))}%` }} />
          </span>
          <button
            className={"pill-brand" + (tab ? " open" : "")}
            onClick={() => setTab((t) => (t ? null : tabs[0]))}
            aria-expanded={tab !== null}
            aria-label={`${brand}: open campaigns`}
          >
            <span aria-hidden>{world.product.icon}</span>
            <b>{brand}</b>
            {campaignCount > 0 && <span className="count">{campaignCount}</span>}
            <svg className="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="pill-sep" />
          <span className="pill-stat" title="Day">
            <span className="muted">Day</span> {state.day}
            {!state.endless && <span className="muted of-days">/{C.days}</span>}
          </span>
          <span className={"pill-stat" + (state.cash < 0 ? " neg" : "")} title={state.paidDay === undefined ? `Cash · bank loan ${usd(C.loan)}, due day ${C.days}` : "Cash"}>
            {usd(state.cash)}
          </span>
          {yesterday && (
            <span className={"pill-stat small-stat " + (yesterday.profit >= 0 ? "pos" : "neg")} title="Profit yesterday">
              {yesterday.profit >= 0 ? "+" : ""}
              {usd(yesterday.profit)}/day
            </span>
          )}
          {yesterday && target !== null && (
            <span className="pill-stat small-stat building" title="Ads still building up: profit per day at full strength">
              ↗ {target >= 0 ? "+" : ""}
              {usd(target)}
            </span>
          )}
          <span className="pill-sep" />
          {playing ? (
            <>
              <button
                className={"pill-play" + (waitingToStart ? " pulse" : "")}
                onClick={() => setRunning((r) => !r)}
                aria-label={running ? "Pause" : "Play"}
                title={running ? "Pause (space)" : "Play (space)"}
              >
                {running ? "❚❚" : "▶"}
              </button>
              <button
                className="pill-speed"
                onClick={() => setSpeedIx((i) => (i + 1) % SPEEDS.length)}
                aria-label={`Speed ${speed}x, click to change`}
                title="Game speed"
              >
                {speed}×
              </button>
            </>
          ) : (
            <button className="pill-speed results" onClick={onResults}>
              Results
            </button>
          )}
        </div>

        {state.daysBelowZero > 0 && playing && !tab && (
          <div className="pill-hint neg-bg" role="alert">
            Cash below $0 for {state.daysBelowZero} of {C.bankruptDays} days. Cut losing campaigns.
          </div>
        )}

        {tab && (
          <div className="float-card dropdown">
            <div className="tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                  {t === "campaigns" ? `${TAB_NAMES[t]} (${campaignCount})` : TAB_NAMES[t]}
                </button>
              ))}
            </div>
            <div className="tab-body">
              {tab === "suggestions" && <Suggestions world={world} state={state} onSelect={select} onSetPlan={setPlan} />}
              {tab === "campaigns" && <Campaigns world={world} state={state} onSelect={select} onSetPlan={setPlan} />}
              {tab === "know" && <Knowledge world={world} state={state} onSelect={select} />}
            </div>
            <footer className="dropdown-foot">
              <button
                className="link"
                onClick={() => {
                  setRunning(false);
                  onMenu();
                }}
              >
                Main menu
              </button>
              <span className="muted small">Space pauses · your game saves automatically</span>
            </footer>
          </div>
        )}
      </div>

      <TeamBubble
        world={world}
        state={state}
        open={teamOpen}
        onToggle={() => {
          setTeamOpen((o) => !o);
          setTab(null);
        }}
        onHire={onHire}
      />

      {showHints && (
        <div className="float-card hints" role="dialog" aria-label="How to play">
          <h2>How to play</h2>
          <p>
            <b>Your buyers:</b> {world.product.who}.
            {!easy && state.known.length > 0 && (
              <> You know that {state.known.map((l) => labelName(l)).join(" and ")} matter. The rest is up to you.</>
            )}
          </p>
          <ol>
            <li>
              <b>Pay back the bank:</b> {usd(C.loan)} by day {C.days}. It's paid automatically the day your cash reaches
              it (the green line under the top bar), and that's a win. The day you pay is your score.
            </li>
            <li>
              {easy ? (
                <>
                  <b>Colors show where your product fits.</b> Darker blue means a better return per ad dollar.
                </>
              ) : (
                <>
                  <b>Work out where your buyers are.</b> Use <i>Color the map</i> (bottom left) to see where gyms, bars,
                  offices or anything else are. Some places draw your buyers, some stores carry you, some compete, and
                  some just look relevant.
                </>
              )}
            </li>
            <li>
              {easy ? (
                <>
                  <b>Start with a suggestion</b> (click your brand at the top), or click any neighborhood.
                </>
              ) : (
                <>
                  <b>Click a neighborhood to buy ads.</b> After two weeks of ads there you learn one thing about your
                  buyers (see <i>What you know</i> under your brand).
                </>
              )}
            </li>
            <li>
              <b>Two channels, each with its own level.</b> Out-of-home ads (billboards, bus shelters, posters) work
              best in busy areas and near the stores that sell you. Digital ads follow where your buyers are, with no
              downtown premium. Run either or both; each reaches its own people.
            </li>
            <li>
              <b>You start alone, with digital ads at Low.</b> Hire buyers (👥 top left) to unlock out-of-home ads, and
              Medium and High in each channel. Each hire costs a signing fee and a salary, for good. A shop is a
              permanent bet on one neighborhood: walk-ins and more sales there, plus rent.
            </li>
            <li>
              <b>Press ▶ to start the clock.</b> Digital ads build up in about a week, out-of-home over a month, and every campaign has a daily fee, so
              don't buy everywhere.
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

      {playing && !running && !paused && !showHints && (
        <PlanTray
          world={world}
          state={state}
          zoneOpen={!!zoneOpen}
          covered={teamOpen || tab !== null}
          onSelect={(z) => {
            onSelect(z);
            setTab(null);
          }}
          onRemove={(z) => setPlan(z, OFF)}
          onLaunch={() => {
            setRunning(true);
            onSelect(null);
          }}
        />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            className={"toast" + (t.insight ? " insight" : "")}
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
    </>
  );
}

/**
 * Easy only: while any campaign is still building up, the profit per day once everything
 * reaches full strength (null when nothing is building).
 */
function buildingTarget(world: World, state: GameState): number | null {
  let building = false;
  let profit = 0;
  for (const z of world.zones) {
    const p = state.plans[z.index];
    const shops = shopsIn(state, z.index);
    if (!isOn(p) && !shops) continue;
    if (
      (p.ooh > 0 && reach(state.pressure[z.index]) < 0.95 * reach(steadyPressure(p.ooh))) ||
      (p.digital > 0 && reach(state.pressureDigital[z.index]) < 0.95 * reach(steadyPressure(p.digital)))
    )
      building = true;
    profit += estimateFor(world, state, z.index, p).profit;
  }
  return building ? profit - fixedCosts(world, state) : null;
}

/**
 * "Your plan": shown whenever the clock is stopped. Lists every neighborhood you've set ads
 * in (click to edit, × to remove), what it all costs, and one button to launch or resume.
 * Before day 1 it explains that you can pick as many neighborhoods as you like first.
 */
function PlanTray({
  world,
  state,
  zoneOpen,
  covered,
  onSelect,
  onRemove,
  onLaunch,
}: {
  world: World;
  state: GameState;
  zoneOpen: boolean;
  /** The team card or brand menu is open: on phones the tray hides under it. */
  covered?: boolean;
  onSelect: (zone: number) => void;
  onRemove: (zone: number) => void;
  onLaunch: () => void;
}) {
  const planned = world.zones.filter((z) => isOn(state.plans[z.index]));
  const fresh = state.day === 0;
  const cost = planned.reduce((a, z) => a + adCost(world, z.index, state.plans[z.index]), 0);
  const est =
    state.difficulty === "easy"
      ? planned.reduce(
          (a, z) => a + estimateFor(world, state, z.index, state.plans[z.index]).profit,
          -fixedCosts(world, state),
        )
      : null;
  const n = planned.length;

  return (
    <section className={"float-card plan-tray" + (zoneOpen ? " behind-panel" : "") + (covered ? " covered" : "")} aria-label="Your plan">
      {n === 0 ? (
        <span className="plan-empty muted small">
          {fresh ? "Click neighborhoods to plan ads, then launch them together" : "No campaigns running"}
        </span>
      ) : (
        <ul className="plan-chips">
          {planned.map((z) => {
            const p = state.plans[z.index];
            const chans = CHANNELS.filter((ch) => p[ch] > 0);
            return (
              <li key={z.index} className="plan-chip">
                <button className="chip-main" onClick={() => onSelect(z.index)} title={`Edit ${z.name}`}>
                  <span className="chip-name">{z.name}</span>
                  <span className="chip-chans" aria-label={chans.map((ch) => `${CHANNEL_NAMES[ch]} ${LEVEL_NAMES[p[ch]]}`).join(", ")}>
                    {chans.map((ch) => (
                      <span key={ch} className="chip-chan">
                        {CHANNEL_ICONS[ch]}
                        {LEVEL_NAMES[p[ch]][0]}
                      </span>
                    ))}
                  </span>
                </button>
                <button className="chip-x" onClick={() => onRemove(z.index)} aria-label={`Remove ${z.name}`}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {n > 0 && (
        <span className="plan-total small">
          <b>{usd(cost)}</b>/day
          {est !== null && (
            <span className={est >= 0 ? "pos" : "neg"} title="Profit per day once ads have built up, after running costs">
              {" "}
              {est >= 0 ? "+" : ""}
              {usd(est)}
            </span>
          )}
        </span>
      )}
      <button className="btn btn-primary launch-btn" onClick={onLaunch} disabled={fresh && n === 0}>
        ▶ {fresh ? (n === 0 ? "Launch" : `Launch ${n}`) : "Resume"}
      </button>
    </section>
  );
}

/**
 * Top left: your team. Shows who you have and a green dot when you can afford a hire or a
 * shop. Click to open the team card.
 */
function TeamBubble({
  world,
  state,
  open,
  onToggle,
  onHire,
}: {
  world: World;
  state: GameState;
  open: boolean;
  onToggle: () => void;
  onHire: (channel: Channel) => void;
}) {
  const playing = state.status === "playing";
  const canBuy =
    playing &&
    ((["digital", "ooh"] as Channel[]).some((ch) => {
      const h = nextHire(state.staff, ch);
      return h && state.cash >= h.signing;
    }) ||
      world.zones.some((z) => canAddShop(state, z.index) && state.cash >= shopCost(world, z.index)));
  const people = 1 + hiredOf(state.staff).length;
  return (
    <div className={"team-bubble" + (open ? " open" : "")}>
      <button className={"team-chip" + (canBuy ? " ready" : "")} onClick={onToggle} aria-expanded={open} title="Your team">
        <span className="team-chip-icon" aria-hidden>
          👥
        </span>
        <span className="team-chip-text">
          <b>Team</b>
          <span className="small muted">
            {people} {people === 1 ? "person" : "people"}
            {state.shops.length > 0 && ` · ${state.shops.length} shop${state.shops.length === 1 ? "" : "s"}`}
          </span>
        </span>
        {canBuy && <span className="buy-dot" aria-label="You can afford a hire or a shop" />}
      </button>
      {open && (
        <div className="float-card team-card">
          <header className="team-head">
            <b>Your team</b>
            <button className="icon-btn" onClick={onToggle} aria-label="Close">
              ×
            </button>
          </header>
          <div className="team-body">
            <Team world={world} state={state} onHire={onHire} />
          </div>
        </div>
      )}
    </div>
  );
}
