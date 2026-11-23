/**
 * "Why does this neighborhood score the way it does?" — the panel shown on click.
 * Everything here is generated from the numbers; nothing is written per neighborhood.
 *
 * What it shows depends on the difficulty: Easy shows the score, the estimates and every
 * place type that matters. Hard shows only the place types you've learned, and unlocks
 * the score and estimates once you've advertised here for two weeks. The card stays short:
 * your ads and the shop up top, everything you know folded away below.
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
  shopsIn,
  canAddShop,
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
  return state.adDays[zone] >= C.insightDays;
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
  const bestHere = bestAllowed(world, state.staff, zone, shopsIn(state, zone));
  const rentHere = shopsIn(state, zone) * shopRent(world, zone);
  const role = roles(world.product);

  // Real places for the place types the player knows, strongest presence first.
  const exampleLines = [...role]
    .filter(([label, r]) => r !== "decoy" && (!known || known.includes(label)) && (z.data.n[label] ?? 0) > 0)
    .map(([label, r]) => ({ label, kind: ROLE_KIND[r], names: examples?.[label] ?? [] }))
    .filter((x) => x.names.length)
    .slice(0, 4);

  const why = [e.fitLine, e.stockLine, e.competitionLine, e.priceLine].filter((l): l is string => !!l);

  const peopleK = e.peopleLine;
  const knowCount = why.length + exampleLines.length;

  return (
    <aside className="panel" aria-label={`${z.name} details`}>
      <header className="panel-head">
        <div>
          <h2>{z.name}</h2>
          <div className="panel-tags">
            <span className="tag-chip">{peopleK}</span>
            {shown && (
              <span className="tag-chip score-chip" title="Return per ad dollar, ranked against the rest of SF">
                <span className="swatch" style={{ background: bin.color }} aria-hidden />
                {z.score} · {bin.label}
              </span>
            )}
            {shopsIn(state, zone) > 0 && (
              <span className="tag-chip shop-chip">
                🏪 {shopsIn(state, zone) === 1 ? "Your shop" : `${shopsIn(state, zone)} of your shops`}
              </span>
            )}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <AdControls world={world} zone={zone} state={state} plan={plan} onSetPlan={onSetPlan} />
      {state.difficulty === "easy" && (
        <p className="small best-line">
          {isOn(bestHere.plan) ? (
            <>
              ⭐ <b>Best:</b> {planName(bestHere.plan)} ({bestHere.profit - rentHere >= 0 ? "+" : ""}
              {usd(bestHere.profit - rentHere)}/day){" "}
              {/* Always rendered, hidden when already in use, so the line never reflows. */}
              <button
                className="link"
                onClick={() => onSetPlan(bestHere.plan)}
                disabled={state.status !== "playing"}
                style={{ visibility: bestHere.plan.ooh !== plan.ooh || bestHere.plan.digital !== plan.digital ? "visible" : "hidden" }}
              >
                Use it
              </button>
            </>
          ) : (
            <>{shopsIn(state, zone) > 0
                ? `Best: no ads here. Your shops make ${bestHere.profit - rentHere >= 0 ? "+" : ""}${usd(bestHere.profit - rentHere)}/day after rent.`
                : "No ads pay here with your team."}</>
          )}
        </p>
      )}

      <ShopRow world={world} zone={zone} state={state} shown={shown} onOpenShop={onOpenShop} />

      <details className="more">
        <summary>
          <span>What you know here</span>
          {knowCount > 0 && <span className="more-count">{knowCount}</span>}
        </summary>
        <div className="more-body">
          {why.length > 0 && (
            <ul className="why">
              {why.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          {e.unknownLine && <p className="muted small">{e.unknownLine}</p>}
          {exampleLines.length > 0 && (
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
          )}
          <p className="muted small credit">
            Places from Overture Maps (© Overture Maps Foundation, © OpenStreetMap contributors). Sales numbers are part
            of the game, not real data.
          </p>
        </div>
      </details>
    </aside>
  );
}

/**
 * A short line under each channel. How strong each is here is only rated where estimates
 * are shown (Easy, or Hard after two weeks of ads), so it can't give the answer away.
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
  // Depends on what has happened here, not on what's selected, so picking a level never adds rows.
  const active = customers > 0.05 || state.totals.adSpend[zone] > 0 || known > 0.005;
  const disabled = state.status !== "playing";
  const learning = state.difficulty !== "easy" && unknownCount(world, state.known) > 0;
  const shown = estimatesShown(state, zone);
  const rentHere = shopsIn(state, zone) * shopRent(world, zone);
  const estRaw = estimateFor(world, state, zone, plan);
  const est = { ...estRaw, profit: estRaw.profit - rentHere };

  const left = C.insightDays - state.adDays[zone];
  const unlocking = state.difficulty !== "easy" && left > 0;

  return (
    <section className="ad-controls" aria-label="Your ads here">
      {CHANNELS.map((ch) => {
        const firstLock = lockedBy(state, ch, 1);
        return (
          <div key={ch} className={`channel-row ch-${ch}` + (plan[ch] > 0 ? " on" : "")}>
            <div className="channel-label">
              <span className="channel-icon" aria-hidden>
                {CHANNEL_ICONS[ch]}
              </span>
              <b>{CHANNEL_NAMES[ch]}</b>
              <span className="channel-hint">{firstLock ? <span title={`Hire ${aOrAn(firstLock)} to unlock`}>🔒 Hire to unlock</span> : channelHint(world, zone, ch, shown)}</span>
            </div>
            <div className="segmented levels-pick" role="radiogroup" aria-label={`${CHANNEL_NAMES[ch]} level`}>
              {([0, 1, 2, 3] as Level[]).map((l) => {
                const lock = lockedBy(state, ch, l);
                const option = { ...plan, [ch]: l };
                const optCost = adCost(world, zone, { ooh: 0, digital: 0, [ch]: l });
                const optProfit = estimateFor(world, state, zone, option).profit - rentHere;
                return (
                  <button
                    key={l}
                    role="radio"
                    aria-checked={plan[ch] === l}
                    className={(plan[ch] === l ? (l === 0 ? "on off" : "on") : "") + (lock ? " locked" : "")}
                    disabled={disabled || !!lock}
                    title={lock ? `Hire ${aOrAn(lock)} to run ${LEVEL_NAMES[l]}` : undefined}
                    onClick={() => onSetPlan({ [ch]: l })}
                  >
                    <b>{LEVEL_NAMES[l]}</b>
                    {lock ? (
                      <span className="lvl-sub" aria-label="Locked">
                        🔒
                      </span>
                    ) : (
                      <span className="lvl-sub">{l === 0 ? "—" : `${usd(optCost)}/d`}</span>
                    )}
                    {/* With estimates shown, every option keeps a profit line (hidden when empty) so rows never change height. */}
                    {shown && (
                      <span
                        style={{ visibility: !lock && (l > 0 || Math.abs(optProfit) >= 0.5) ? "visible" : "hidden" }}
                        className={"lvl-sub " + (optProfit >= 0 ? "pos" : "neg")}
                        title="Profit per day here once ads have built up, with the other channel as it is, after your shops' rent here"
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
      {/* Always there (shows $0/day when off) so selecting a level never pushes the card down. */}
      <div className="ad-status">
          <div className="ad-status-row">
            <span>
              <b>{usd(adCost(world, zone, plan))}</b>
              <span className="muted">/day</span>
            </span>
            {shown && (
              <span
                className={est.profit >= 0 ? "pos" : "neg"}
                title={`${est.customers.toFixed(1)} customers a day once built up`}
                style={{ visibility: on || Math.abs(est.profit) >= 0.5 ? "visible" : "hidden" }}
              >
                {est.profit >= 0 ? "+" : ""}
                {usd(est.profit)}/day expected
              </span>
            )}
          </div>
          {active && state.day > 0 && (
            <>
              <div className="ad-status-row">
                <span className="muted">Awareness</span>
                <span className="meter-wrap">
                  <span className="meter" aria-hidden>
                    <span style={{ width: `${Math.round(Math.min(1, strength) * 100)}%` }} />
                  </span>
                  {Math.round(known * 100)}%
                </span>
              </div>
              <div className="ad-status-row">
                <span className="muted">Yesterday</span>
                <span>
                  {customers.toFixed(1)} customers ·{" "}
                  <span className={profit >= 0 ? "pos" : "neg"}>
                    {profit >= 0 ? "+" : ""}
                    {usd(profit)}
                  </span>
                </span>
              </div>
            </>
          )}
          {unlocking && (
            <div className="unlock" title="Advertise here long enough to unlock estimates and learn something new">
              <span className="unlock-bar" aria-hidden>
                <span style={{ width: `${(state.adDays[zone] / C.insightDays) * 100}%` }} />
              </span>
              <span className="small muted">
                {learning ? "Clue" : "Estimates"} in {left} day{left === 1 ? "" : "s"}
              </span>
            </div>
          )}
      </div>
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
  const have = shopsIn(state, zone);
  if (!canAddShop(state, zone))
    return (
      <p className="small muted shop-full">
        🏪 {have} shops here, the most one neighborhood takes · {usd(have * rent)}/day rent
      </p>
    );
  const cost = shopCost(world, zone);
  const gain = shopGain(world, state, zone);
  const short = state.cash < cost;
  const pct = Math.max(0, Math.min(1, state.cash / cost)) * 100;
  return (
    <div className="shop-card">
      <button
        className={"btn-buy" + (short ? " saving" : "")}
        style={{ ["--p" as string]: `${pct}%` }}
        disabled={state.status !== "playing" || short}
        onClick={onOpenShop}
      >
        <span className="btn-buy-label">🏪 {have ? `Open shop #${have + 1} here` : "Open a shop here"}</span>
        <span className="btn-buy-price">{usd(cost)}</span>
      </button>
      <span className="small muted">
        {short ? `${usd(cost - state.cash)} to go` : have ? "Adds half what the last one did" : "Walk-ins and more sales here"} · rent{" "}
        {usd(rent)}/day
        {shown && (
          <>
            {" · "}
            <span className={gain >= 0 ? "pos" : "neg"}>
              {gain >= 0 ? "+" : ""}
              {usd(gain)}/day
            </span>
          </>
        )}
      </span>
    </div>
  );
}
