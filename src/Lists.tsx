/** The lists in the in-game dropdown: suggestions (Easy), campaigns, your team, and what you know. */
import { useState, type ReactNode } from "react";
import {
  C,
  CHANNELS,
  CHANNEL_ICONS,
  CHANNEL_NAMES,
  fixedCosts,
  hireGain,
  isOn,
  nextHire,
  shopCost,
  shopCounts,
  shopRent,
  type Channel,
  LEVEL_NAMES,
  ROLE_TITLES,
  labelName,
  recommend,
  roleSentence,
  roles,
  unknownCount,
  zoneDayProfit,
  type GameState,
  type Level,
  type Plan,
  type Role,
  type World,
} from "./sim";
import { usd } from "./scale";

type SortKey = "profit" | "cost" | "name";

interface Props {
  world: World;
  state: GameState;
  onSelect: (zone: number) => void;
  onSetPlan: (zone: number, change: Partial<Plan>) => void;
}

export function Suggestions({ world, state, onSelect, onSetPlan }: Props) {
  const recs = recommend(world, state);
  if (!recs.length) return <p className="muted">Nothing to change right now: your campaigns are where they should be.</p>;
  return (
    <ol className="recs">
      {recs.map((r) => (
        <li key={`${r.zone}-${r.channel}-${r.to[r.channel]}`}>
          <button className="link" onClick={() => onSelect(r.zone)}>
            {r.title}
          </button>
          <div className="muted small">{r.reason}</div>
          <div className="rec-foot">
            <span className="pos small">+{usd(r.deltaProfit)}/day once built up</span>
            <button className="btn btn-small" disabled={state.status !== "playing"} onClick={() => onSetPlan(r.zone, r.to)}>
              {r.cut ? "Cut" : r.from[r.channel] === 0 ? "Buy" : "Change"} · {usd(r.costPerDay)}/day
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Campaigns({ world, state, onSelect, onSetPlan }: Props) {
  const [sort, setSort] = useState<SortKey>("profit");
  // Include zones whose ads have stopped but are still fading out and bringing customers.
  const rows = world.zones
    .filter((z) => isOn(state.plans[z.index]) || state.lastDay.customers[z.index] > 0.05)
    .map((z) => ({
      z,
      plan: state.plans[z.index],
      cost: state.lastDay.adSpend[z.index],
      customers: state.lastDay.customers[z.index],
      profit: zoneDayProfit(state, z.index),
    }))
    .sort((a, b) => (sort === "name" ? a.z.name.localeCompare(b.z.name) : sort === "cost" ? b.cost - a.cost : a.profit - b.profit));

  if (!rows.length)
    return (
      <p className="muted">
        No campaigns yet. Click a neighborhood on the map, check why it scores the way it does, and pick an ad level.
      </p>
    );

  const total = rows.reduce((a, r) => a + r.profit, 0);
  return (
    <>
      <div className="sort small">
        Sort:
        {(["profit", "cost", "name"] as SortKey[]).map((k) => (
          <button key={k} className={"link" + (sort === k ? " on" : "")} onClick={() => setSort(k)}>
            {k === "profit" ? "worst first" : k === "cost" ? "cost" : "name"}
          </button>
        ))}
      </div>
      <table className="campaigns">
        <thead>
          <tr>
            <th scope="col">Neighborhood</th>
            <th scope="col" title="Out-of-home">{CHANNEL_ICONS.ooh}</th>
            <th scope="col" title="Digital">{CHANNEL_ICONS.digital}</th>
            <th scope="col">Cust.</th>
            <th scope="col">Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.z.index}>
              <th scope="row">
                <button className="link" onClick={() => onSelect(r.z.index)}>
                  {r.z.name}
                </button>
              </th>
              {CHANNELS.map((ch) => (
                <td key={ch}>
                  <select
                    aria-label={`${CHANNEL_NAMES[ch]} level in ${r.z.name}`}
                    value={r.plan[ch]}
                    disabled={state.status !== "playing"}
                    onChange={(e) => onSetPlan(r.z.index, { [ch]: Number(e.target.value) as Level })}
                  >
                    {LEVEL_NAMES.map((n, l) => {
                      const locked = l > state.staff[ch];
                      return (
                        <option key={n} value={l} disabled={locked}>
                          {locked ? `${n} 🔒` : n}
                        </option>
                      );
                    })}
                  </select>
                </td>
              ))}
              <td>{r.customers.toFixed(1)}</td>
              <td className={r.profit >= 0 ? "pos" : "neg"}>
                {r.profit >= 0 ? "+" : ""}
                {usd(r.profit)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={4}>
              Campaigns yesterday
            </th>
            <td className={total >= 0 ? "pos" : "neg"}>
              {total >= 0 ? "+" : ""}
              {usd(total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="muted small">
        Profit per day: sales after product costs and fulfillment, minus ad cost. New campaigns lose money for the first
        week while awareness builds.
      </p>
    </>
  );
}

/** Ladder order in the Team tab: digital first, since that's where you start. */
const LADDER: Channel[] = ["digital", "ooh"];

/** Avatars for whoever runs each level (index = level; digital Low is you). */
const AVATARS: Record<Channel, string[]> = { digital: ["", "🙂", "🧑‍💻", "👩‍💻"], ooh: ["", "🧑‍🎨", "👨‍💼", "👩‍💼"] };

/** A buy button that fills up as you save towards it. */
export function BuyButton({
  label,
  price,
  cash,
  disabled,
  onClick,
}: {
  label: ReactNode;
  price: number;
  cash: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const short = cash < price;
  const pct = Math.max(0, Math.min(1, cash / price)) * 100;
  return (
    <button
      className={"btn-buy" + (short ? " saving" : "")}
      style={{ ["--p" as string]: `${pct}%` }}
      disabled={disabled || short}
      onClick={onClick}
      title={short ? `${usd(price - cash)} to go` : undefined}
    >
      <span className="btn-buy-label">{label}</span>
      <span className="btn-buy-price">{usd(price)}</span>
    </button>
  );
}

/** Who runs each level of a channel: you (digital Low) or a hire. */
function rung(ch: Channel, l: Level): { title: string; signing: number; salary: number } | null {
  return C.hires[ch][l] ?? (ch === "digital" && l === 1 ? { title: "You", signing: 0, salary: 0 } : null);
}

/**
 * One channel's ladder: three slots (Low, Medium, High). Click one to see who runs it. The
 * next one you can hire is picked by default; later ones say who to hire first.
 */
function Crew({
  world,
  state,
  channel: ch,
  easy,
  playing,
  onHire,
}: Pick<Props, "world" | "state"> & {
  channel: Channel;
  easy: boolean;
  playing: boolean;
  onHire: (channel: Channel) => void;
}) {
  const have = state.staff[ch];
  const next = nextHire(state.staff, ch);
  const [picked, setPicked] = useState<{ level: Level; at: Level } | null>(null);
  // Default to the next hire. A pick sticks until the next hire, then the ladder moves up.
  const sel: Level = picked && picked.at === have ? picked.level : ((next?.level ?? 3) as Level);
  const r = rung(ch, sel)!;
  const owned = have >= sel;
  const isNext = next?.level === sel;
  const gain = easy && isNext ? hireGain(world, state, ch) : null;
  const blocker = !owned && !isNext ? rung(ch, (sel - 1) as Level) : null;

  return (
    <section className={`crew ch-${ch}`}>
      <header className="crew-head">
        <span className="channel-icon" aria-hidden>
          {CHANNEL_ICONS[ch]}
        </span>
        <b>{CHANNEL_NAMES[ch]}</b>
      </header>
      <div className="rungs" role="tablist" aria-label={`${CHANNEL_NAMES[ch]} levels`}>
        {([1, 2, 3] as Level[]).map((l) => {
          const st = have >= l ? "owned" : next?.level === l ? "next" : "locked";
          return (
            <button
              key={l}
              role="tab"
              aria-selected={sel === l}
              className={`rung ${st}` + (sel === l ? " sel" : "")}
              onClick={() => setPicked({ level: l, at: have })}
            >
              <span className="rung-face" aria-hidden>
                {st === "owned" ? AVATARS[ch][l] : st === "next" ? "＋" : "🔒"}
              </span>
              <b>{LEVEL_NAMES[l]}</b>
            </button>
          );
        })}
      </div>
      <div className={"recruit" + (owned ? " owned" : "")}>
        <div className="recruit-text">
          <b>{owned ? (r.title === "You" ? "You" : r.title) : r.title}</b>
          <span className="small muted">
            <b className="unlock-name">{LEVEL_NAMES[sel]}</b>
            {r.salary > 0 && <> · {usd(r.salary)}/day</>}
          </span>
          {gain !== null && (
            <span className={"small " + (gain >= 0 ? "pos" : "neg")} title="Best extra profit per day, salary included">
              {gain >= 0 ? "+" : ""}
              {usd(gain)}/day
            </span>
          )}
        </div>
        {owned ? (
          <span className="recruit-done" aria-label="Hired">✓</span>
        ) : isNext ? (
          <BuyButton label="Hire" price={r.signing} cash={state.cash} disabled={!playing} onClick={() => onHire(ch)} />
        ) : (
          <span className="recruit-blocked">
            <span className="small">{usd(r.signing)}</span>
            <span className="small muted">🔒 {blocker ? blocker.title : LEVEL_NAMES[sel - 1]} first</span>
          </span>
        )}
      </div>
    </section>
  );
}

/** Your team (one ladder per channel), your shops and what it all costs per day. */
export function Team({
  world,
  state,
  onHire,
}: Pick<Props, "world" | "state"> & { onHire: (channel: Channel) => void }) {
  const easy = state.difficulty === "easy";
  const playing = state.status === "playing";
  const costs = world.zones.map((z) => shopCost(world, z.index));
  const cheapest = Math.min(...costs);
  const dearest = Math.max(...costs);
  return (
    <div className="team">
      {LADDER.map((ch) => (
        <Crew key={ch} world={world} state={state} channel={ch} easy={easy} playing={playing} onHire={onHire} />
      ))}

      <section className="crew ch-shop">
        <header className="crew-head">
          <span className="channel-icon" aria-hidden>
            🏪
          </span>
          <b>Shops</b>
          {state.shops.length > 0 && <span className="small muted">{state.shops.length}</span>}
        </header>
        {state.shops.length > 0 && (
          <ul className="shop-list small">
            {shopCounts(world, state).map((n, z) =>
              n ? (
                <li key={z}>
                  <span>
                    {world.zones[z].name}
                    {n > 1 && <b> ×{n}</b>}
                  </span>
                  <span className="muted">{usd(n * shopRent(world, z))}/day rent</span>
                </li>
              ) : null,
            )}
          </ul>
        )}
        <div className="saving-for">
          <span className="small">
            <b>{usd(cheapest)}</b>–<b>{usd(dearest)}</b>
          </span>
          <span className="unlock-bar" aria-hidden>
            <span style={{ width: `${Math.max(0, Math.min(1, state.cash / cheapest)) * 100}%` }} />
          </span>
        </div>
      </section>

      <p className="small costs">
        <span>Running costs</span>
        <b>{usd(fixedCosts(world, state))}/day</b>
      </p>
    </div>
  );
}

const ROLE_ORDER: Role[] = ["customers", "stockist", "both", "competitor", "decoy"];

/** What the player knows about their product, and how they learned it. */
export function Knowledge({ world, state, onSelect }: Pick<Props, "world" | "state" | "onSelect">) {
  const role = roles(world.product);
  const unknown = unknownCount(world, state.known);
  const easy = state.difficulty === "easy";
  return (
    <div className="knowledge">
      <p>
        <b>Your buyers:</b> {world.product.who}.
      </p>
      {ROLE_ORDER.map((r) => {
        const labels = state.known.filter((l) => role.get(l) === r);
        if (!labels.length) return null;
        return (
          <section key={r}>
            <h4>{ROLE_TITLES[r]}</h4>
            <p className="small">{labels.map((l) => labelName(l)).join(", ")}</p>
          </section>
        );
      })}
      {unknown > 0 ? (
        <p className="muted small">
          {unknown} more place type{unknown === 1 ? "" : "s"} could matter for {world.product.name.toLowerCase()}. Run ads in
          a neighborhood for {C.insightDays} days to learn the one that matters most there. Some places that look
          relevant don't matter at all.
        </p>
      ) : (
        !easy && <p className="muted small">You've worked out everything that matters.</p>
      )}
      {state.insights.length > 0 && (
        <>
          <h4>What you've learned</h4>
          <ul className="event-log">
            {[...state.insights].reverse().map((ins) => (
              <li key={ins.label}>
                <span className="muted small">
                  Day {ins.day} ·{" "}
                  <button className="link" onClick={() => onSelect(ins.zone)}>
                    {world.zones[ins.zone].name}
                  </button>
                </span>
                <div className="small">{roleSentence(world, ins.label)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
