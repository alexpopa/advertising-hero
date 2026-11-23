/**
 * "Why does this neighborhood score the way it does?" — the panel shown on click.
 * Everything here is generated from the numbers; nothing is written per neighborhood.
 *
 * What it shows depends on the difficulty: Easy shows the score, the estimates and every
 * place type that matters. Normal shows only the place types you've learned, and unlocks
 * the score and estimates once you've advertised here for two weeks. Hard never shows
 * estimates: only your real results.
 */
import { useState } from "react";
import {
  C,
  CHANNELS,
  CHANNEL_NAMES,
  FORMAT_NAMES,
  channelsOf,
  formatOf,
  LEVEL_NAMES,
  adCost,
  awareness,
  estimate,
  explain,
  labelName,
  reach,
  roles,
  steadyPressure,
  unknownCount,
  zoneDayProfit,
  type Channel,
  type GameState,
  type Level,
  type Plan,
  type World,
} from "./sim";
import { scoreBin, usd } from "./scale";

interface Props {
  world: World;
  zone: number;
  examples: Record<string, string[]> | undefined;
  onClose: () => void;
  state: GameState;
  onSetPlan: (change: Partial<Plan>) => void;
}

/** Can the player see this zone's score and estimates? */
export function estimatesShown(state: GameState, zone: number): boolean {
  if (state.difficulty === "easy") return true;
  return state.difficulty === "normal" && state.adDays[zone] >= C.insightDays;
}

const ROLE_KIND: Record<string, string> = {
  customers: "Buyers nearby",
  stockist: "Carry you",
  both: "Carry you, sell rivals too",
  competitor: "Competitors",
};

export function ZonePanel({ world, zone, examples, onClose, state, onSetPlan }: Props) {
  const z = world.zones[zone];
  const known = state.difficulty === "easy" ? undefined : state.known;
  const e = explain(world, zone, known);
  const bin = scoreBin(z.score);
  const shown = estimatesShown(state, zone);
  const plan: Plan = { level: state.levels[zone], format: state.formats[zone] };
  const role = roles(world.product);

  // Real places for the place types the player knows, strongest presence first.
  const exampleLines = [...role]
    .filter(([label, r]) => r !== "decoy" && (!known || known.includes(label)) && (z.data.n[label] ?? 0) > 0)
    .map(([label, r]) => ({ label, kind: ROLE_KIND[r], names: examples?.[label] ?? [] }))
    .filter((x) => x.names.length)
    .slice(0, 4);

  const why = [e.fitLine, e.stockLine, e.competitionLine, e.priceLine].filter((l): l is string => !!l);

  return (
    <aside className="panel" aria-label={`${z.name} details`}>
      <header className="panel-head">
        <div>
          <h2>{z.name}</h2>
          <p className="muted">{e.peopleLine}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      {shown && (
        <div className="score-row" title="Return per ad dollar, ranked against the rest of SF">
          <span className="swatch" style={{ background: bin.color }} aria-hidden />
          <span className="score-num">{z.score}</span>
          <span>
            <b>{bin.label}</b> for {world.product.name.toLowerCase()}
          </span>
        </div>
      )}

      <AdControls key={zone} world={world} zone={zone} state={state} plan={plan} onSetPlan={onSetPlan} />

      <h3>What you know here</h3>
      <ul className="why">
        {why.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {e.unknownLine && <p className="muted small">{e.unknownLine}</p>}

      <h3>Ad options</h3>
      <table className="levels" aria-label={`${FORMAT_NAMES[plan.format]} ads, once built up`}>
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Cost/day</th>
            {shown && <th scope="col">Customers/day</th>}
            {shown && <th scope="col">Profit/day</th>}
          </tr>
        </thead>
        <tbody>
          {([1, 2, 3] as Level[]).map((l) => {
            const est = estimate(z, { ...plan, level: l });
            const isBest = shown && l === z.best.level && plan.format === z.best.format;
            const isYours = plan.level === l;
            return (
              <tr key={l} className={[isBest ? "best" : "", isYours ? "yours" : ""].join(" ").trim() || undefined}>
                <th scope="row">{LEVEL_NAMES[l]}</th>
                <td>{usd(adCost(world, state, zone, l, plan.format))}</td>
                {shown && <td>{est.customers.toFixed(1)}</td>}
                {shown && (
                  <td className={est.profit >= 0 ? "pos" : "neg"}>
                    {est.profit >= 0 ? "+" : ""}
                    {usd(est.profit)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {state.difficulty === "easy" && z.best.level > 0 && (
        <p className="small">
          <b>Best here:</b> {LEVEL_NAMES[z.best.level]} {FORMAT_NAMES[z.best.format].toLowerCase()} ads (+{usd(z.bestProfit)}
          /day)
        </p>
      )}
      {state.difficulty === "easy" && z.best.level === 0 && (
        <p className="small">
          <b>No plan pays here</b> for {world.product.name.toLowerCase()}.
        </p>
      )}
      {!shown && state.difficulty === "normal" && (
        <p className="muted small">
          Estimates unlock after {C.insightDays} days of ads ({state.adDays[zone]}/{C.insightDays})
        </p>
      )}

      {exampleLines.length > 0 && (
        <>
          <h3>Real places here</h3>
          <ul className="examples">
            {exampleLines.map((x) => (
              <li key={x.label}>
                <span className="muted small">
                  {x.kind} · {labelName(x.label)}
                </span>
                <br />
                {x.names.slice(0, 3).join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small credit">
        Places, buildings and neighborhoods from Overture Maps (© Overture Maps Foundation, © OpenStreetMap
        contributors). Sales numbers are part of the game, not real data.
      </p>
    </aside>
  );
}

/**
 * A short line under each channel. How strong each is here is only rated where estimates
 * are shown (Easy, or Normal after two weeks of ads), so it can't give the answer away.
 */
function channelHint(world: World, zone: number, ch: Channel, shown: boolean): string {
  const z = world.zones[zone];
  if (!shown) return ch === "ooh" ? "billboards, posters" : "targets your buyers";
  const e = z.formatEff[ch];
  const [hi, lo] = ch === "ooh" ? [1.15, 0.85] : [0.95, 0.65];
  return e >= hi ? "strong here" : e <= lo ? "weak here" : "average here";
}

function AdControls({
  world,
  zone,
  state,
  plan,
  onSetPlan,
}: {
  world: World;
  zone: number;
  state: GameState;
  plan: Plan;
  onSetPlan: (change: Partial<Plan>) => void;
}) {
  const { level } = plan;
  // The level picked while no channel is ticked (or the running level), so ticking a box
  // starts ads at the level you chose.
  const [pickedLevel, setPickedLevel] = useState<Level>(level > 0 ? level : 1);
  const shownLevel = level > 0 ? level : pickedLevel;
  const ticked = (ch: Channel) => level > 0 && channelsOf(plan.format).includes(ch);
  const known = awareness(state, zone);
  const strength = known / reach(steadyPressure(3));
  const customers = state.lastDay.customers[zone];
  const profit = zoneDayProfit(state, zone);
  const active = level > 0 || customers > 0.05;
  const priceUp = state.events.some((e) => e.kind === "priceUp" && e.zone === zone);
  const disabled = state.status !== "playing";
  const learning = state.difficulty !== "easy" && unknownCount(world, state.known) > 0;
  const shown = estimatesShown(state, zone);

  const toggle = (ch: Channel) => {
    const ooh = ch === "ooh" ? !ticked("ooh") : ticked("ooh");
    const digital = ch === "digital" ? !ticked("digital") : ticked("digital");
    const format = formatOf(ooh, digital);
    onSetPlan(format ? { level: shownLevel, format } : { level: 0 });
  };
  const pickLevel = (l: Level) => {
    setPickedLevel(l);
    if (level > 0) onSetPlan({ level: l });
  };

  return (
    <section className="ad-controls" aria-label="Your ads here">
      <h3>Your ads here</h3>
      <div className="channels" role="group" aria-label="Where your ads run">
        {CHANNELS.map((ch) => (
          <label key={ch} className={"channel" + (ticked(ch) ? " on" : "")}>
            <input type="checkbox" checked={ticked(ch)} disabled={disabled} onChange={() => toggle(ch)} />
            <span>
              <b>{CHANNEL_NAMES[ch]}</b>
              <span className="small muted">{channelHint(world, zone, ch, shown)}</span>
            </span>
            <span className="channel-cost small">
              {usd(adCost(world, state, zone, shownLevel, ch))}
              /day
            </span>
          </label>
        ))}
      </div>
      <div className="segmented levels-pick" role="radiogroup" aria-label="How hard each channel runs">
        {([1, 2, 3] as Level[]).map((l) => (
          <button
            key={l}
            role="radio"
            aria-checked={shownLevel === l}
            className={shownLevel === l ? "on" : ""}
            disabled={disabled}
            onClick={() => pickLevel(l)}
          >
            <b>{LEVEL_NAMES[l]}</b>
            <span className="small">
              {usd(adCost(world, state, zone, l, level > 0 ? plan.format : "ooh"))}/day
            </span>
          </button>
        ))}
      </div>
      {level === 0 ? (
        <p className="muted small">No ads here</p>
      ) : (
        <p className="plan-result small">
          <b>Your plan:</b> {usd(adCost(world, state, zone, level, plan.format))}/day
          {shown && (
            <>
              {" "}
              → {estimate(world.zones[zone], plan).customers.toFixed(1)} customers,{" "}
              <span className={estimate(world.zones[zone], plan).profit >= 0 ? "pos" : "neg"}>
                {estimate(world.zones[zone], plan).profit >= 0 ? "+" : ""}
                {usd(estimate(world.zones[zone], plan).profit)}/day
              </span>
            </>
          )}
        </p>
      )}
      {priceUp && <p className="small warn">Ad prices are up 25% here for a few days.</p>}
      {active && state.day > 0 && (
        <dl className="zone-stats">
          <div>
            <dt>Awareness</dt>
            <dd>
              <span className="meter" aria-hidden>
                <span style={{ width: `${Math.round(Math.min(1, strength) * 100)}%` }} />
              </span>
              {Math.round(known * 100)}% reached
            </dd>
          </div>
          {state.day > 0 && (
            <div>
              <dt>Yesterday</dt>
              <dd>
                {customers.toFixed(1)} customers,{" "}
                <span className={profit >= 0 ? "pos" : "neg"}>
                  {profit >= 0 ? "+" : ""}
                  {usd(profit)}
                </span>
              </dd>
            </div>
          )}
        </dl>
      )}
      {learning && level > 0 && state.adDays[zone] < C.insightDays && (
        <p className="muted small">
          Next insight in {C.insightDays - state.adDays[zone]} day{C.insightDays - state.adDays[zone] === 1 ? "" : "s"}
        </p>
      )}
    </section>
  );
}
