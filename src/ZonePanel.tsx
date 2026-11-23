/**
 * "Why does this neighborhood score the way it does?" — the panel shown on click.
 * Everything here is generated from the numbers; nothing is written per neighborhood.
 *
 * What it shows depends on the difficulty: Easy shows the score, the estimates and every
 * place type that matters. Normal shows only the place types you've learned, and unlocks
 * the score and estimates once you've advertised here for two weeks. Hard never shows
 * estimates: only your real results.
 */
import {
  C,
  CHANNELS,
  CHANNEL_ICONS,
  CHANNEL_NAMES,
  LEVEL_NAMES,
  adCost,
  awareness,
  bestAllowed,
  estimateFor,
  explain,
  isOn,
  planName,
  shopCost,
  shopGain,
  shopRent,
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
  onOpenShop: () => void;
}

/** Who you'd need to hire to run this level in this channel, or null if your team can. */
function lockedBy(state: GameState, ch: Channel, level: Level): string | null {
  if (state.staff[ch] >= level) return null;
  return C.hires[ch][state.staff[ch] + 1]?.title ?? null;
}

/** "a senior digital buyer", "an out-of-home buyer" */
const aOrAn = (title: string) => (/^[aeiou]/i.test(title) ? "an " : "a ") + title.toLowerCase();

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

export function ZonePanel({ world, zone, examples, onClose, state, onSetPlan, onOpenShop }: Props) {
  const z = world.zones[zone];
  const known = state.difficulty === "easy" ? undefined : state.known;
  const e = explain(world, zone, known);
  const bin = scoreBin(z.score);
  const shown = estimatesShown(state, zone);
  const plan = state.plans[zone];
  const bestHere = bestAllowed(world, state.staff, zone, state.shops.includes(zone));
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

      <AdControls world={world} zone={zone} state={state} plan={plan} onSetPlan={onSetPlan} />
      {state.difficulty === "easy" && (
        <p className="small">
          {isOn(bestHere.plan) ? (
            <>
              <b>Best for your team:</b> {planName(bestHere.plan)} (+{usd(bestHere.profit)}/day){" "}
              {(bestHere.plan.ooh !== plan.ooh || bestHere.plan.digital !== plan.digital) && (
                <button className="link" onClick={() => onSetPlan(bestHere.plan)} disabled={state.status !== "playing"}>
                  Use it
                </button>
              )}
            </>
          ) : (
            <>
              <b>No ads pay here</b> for {world.product.name.toLowerCase()} with your team.
            </>
          )}
        </p>
      )}
      {!shown && state.difficulty === "normal" && (
        <p className="muted small">
          Estimates unlock after {C.insightDays} days of ads ({state.adDays[zone]}/{C.insightDays})
        </p>
      )}
      <ShopRow world={world} zone={zone} state={state} shown={shown} onOpenShop={onOpenShop} />

      <h3>What you know here</h3>
      <ul className="why">
        {why.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {e.unknownLine && <p className="muted small">{e.unknownLine}</p>}

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

/**
 * One row per channel: Off, Low, Medium, High, each with its cost per day (and, where
 * estimates are shown, this zone's profit per day with that choice and the other channel as
 * it is). Levels your team can't buy yet are locked and name who to hire.
 */
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
  const known = awareness(state, zone);
  const strength = known / reach(steadyPressure(3));
  const customers = state.lastDay.customers[zone];
  const profit = zoneDayProfit(state, zone);
  const on = isOn(plan);
  const active = on || customers > 0.05;
  const disabled = state.status !== "playing";
  const learning = state.difficulty !== "easy" && unknownCount(world, state.known) > 0;
  const shown = estimatesShown(state, zone);
  const est = estimateFor(world, state, zone, plan);

  return (
    <section className="ad-controls" aria-label="Your ads here">
      <h3>Your ads here</h3>
      {CHANNELS.map((ch) => {
        const firstLock = lockedBy(state, ch, 1);
        return (
          <div key={ch} className={"channel-row" + (plan[ch] > 0 ? " on" : "")}>
            <div className="channel-label">
              <b>
                <span aria-hidden>{CHANNEL_ICONS[ch]}</span> {CHANNEL_NAMES[ch]}
              </b>
              <span className="small muted">{firstLock ? `🔒 Hire ${aOrAn(firstLock)}` : channelHint(world, zone, ch, shown)}</span>
            </div>
            <div className="segmented levels-pick" role="radiogroup" aria-label={`${CHANNEL_NAMES[ch]} level`}>
              {([0, 1, 2, 3] as Level[]).map((l) => {
                const lock = lockedBy(state, ch, l);
                const option = { ...plan, [ch]: l };
                const optCost = adCost(world, zone, { ooh: 0, digital: 0, [ch]: l });
                const optProfit = estimateFor(world, state, zone, option).profit;
                return (
                  <button
                    key={l}
                    role="radio"
                    aria-checked={plan[ch] === l}
                    className={(plan[ch] === l ? "on" : "") + (lock ? " locked" : "")}
                    disabled={disabled || !!lock}
                    title={lock ? `Hire ${aOrAn(lock)} to run ${LEVEL_NAMES[l]}` : undefined}
                    onClick={() => onSetPlan({ [ch]: l })}
                  >
                    <b>
                      {lock && <span aria-label="Locked">🔒 </span>}
                      {LEVEL_NAMES[l]}
                    </b>
                    {lock ? (
                      <span className="small">hire first</span>
                    ) : l === 0 ? (
                      <span className="small">$0</span>
                    ) : (
                      <span className="small">{usd(optCost)}/day</span>
                    )}
                    {shown && !lock && (
                      <span
                        className={"small " + (optProfit >= 0 ? "pos" : "neg")}
                        title="Profit per day here once ads have built up, with the other channel as it is"
                      >
                        {optProfit >= 0 ? "+" : ""}
                        {usd(optProfit)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {!on ? (
        <p className="muted small">No ads here</p>
      ) : (
        <p className="plan-result small">
          <b>Your plan:</b> {usd(adCost(world, zone, plan))}/day
          {shown && (
            <>
              {" "}
              → {est.customers.toFixed(1)} customers,{" "}
              <span className={est.profit >= 0 ? "pos" : "neg"}>
                {est.profit >= 0 ? "+" : ""}
                {usd(est.profit)}/day
              </span>
            </>
          )}
        </p>
      )}
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
        </dl>
      )}
      {learning && on && state.adDays[zone] < C.insightDays && (
        <p className="muted small">
          Next insight in {C.insightDays - state.adDays[zone]} day{C.insightDays - state.adDays[zone] === 1 ? "" : "s"}
        </p>
      )}
    </section>
  );
}

/** Your shop here, or a button to open one. */
function ShopRow({
  world,
  zone,
  state,
  shown,
  onOpenShop,
}: {
  world: World;
  zone: number;
  state: GameState;
  shown: boolean;
  onOpenShop: () => void;
}) {
  const rent = shopRent(world, zone);
  if (state.shops.includes(zone))
    return (
      <p className="shop-row small">
        🏪 <b>Your shop</b> · rent {usd(rent)}/day
      </p>
    );
  const cost = shopCost(state);
  const gain = shopGain(world, state, zone);
  const short = state.cash < cost;
  return (
    <div className="shop-row">
      <button className="btn btn-small" disabled={state.status !== "playing" || short} onClick={onOpenShop}>
        🏪 Open a shop · {usd(cost)}
      </button>
      <span className="small muted">
        + {usd(rent)}/day rent
        {shown && (
          <>
            {" · "}
            <span className={gain >= 0 ? "pos" : "neg"}>
              {gain >= 0 ? "+" : ""}
              {usd(gain)}/day
            </span>
          </>
        )}
        {short && ` · need ${usd(cost - state.cash)} more`}
      </span>
    </div>
  );
}
