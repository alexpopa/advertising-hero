/** The lists in the in-game dropdown: suggestions (Easy), campaigns, your team, and what you know. */
import { useState } from "react";
import {
  C,
  CHANNELS,
  CHANNEL_ICONS,
  CHANNEL_NAMES,
  fixedCosts,
  goalBonus,
  hireGain,
  isOn,
  monthProgress,
  salaries,
  shopCost,
  shopRent,
  totalRent,
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

/** Monthly goals, your team (hire the next person per channel), shops and running costs. */
export function Team({
  world,
  state,
  onHire,
}: Pick<Props, "world" | "state"> & { onHire: (channel: Channel) => void }) {
  const easy = state.difficulty === "easy";
  const playing = state.status === "playing";
  const prog = monthProgress(state);
  const current = playing ? state.goalsMet.length : -1;
  return (
    <div className="team">
      <section>
        <h4>Monthly goals · profit per day</h4>
        <ol className="goals">
          {C.goals.map((g, m) => {
            const met = state.goalsMet[m];
            const cls = met === true ? "met" : met === false ? "missed" : m === current ? "now" : "";
            return (
              <li
                key={m}
                className={cls}
                title={`Month ${m + 1}: average ${usd(g)}/day${met === undefined ? ` (bonus ${usd(goalBonus(m))})` : met ? ", met" : ", missed"}`}
              >
                <span className="goal-star" aria-hidden>
                  {met ? "★" : "☆"}
                </span>
                <span className="small">{usd(g)}</span>
              </li>
            );
          })}
        </ol>
        {playing && (
          <p className="small">
            Month {prog.month + 1}:{" "}
            <b className={prog.avg >= prog.goal ? "pos" : prog.daysIn ? "neg" : ""}>{usd(prog.avg)}</b>/day so far of{" "}
            {usd(prog.goal)} · {prog.daysLeft} days left · ★ pays {usd(goalBonus(prog.month))}
          </p>
        )}
      </section>

      <section>
        <h4>Your team</h4>
        {LADDER.map((ch) => (
          <div key={ch} className="ladder">
            <b className="small">{CHANNEL_NAMES[ch]}</b>
            <ul>
              {([1, 2, 3] as Level[]).map((l) => {
                const h = C.hires[ch][l];
                if (!h) return (
                  <li key={l} className="hired small">
                    ✓ You · {LEVEL_NAMES[l]}
                  </li>
                );
                const hired = state.staff[ch] >= l;
                const next = state.staff[ch] + 1 === l;
                if (hired)
                  return (
                    <li key={l} className="hired small">
                      ✓ {h.title} · {LEVEL_NAMES[l]} · {usd(h.salary)}/day
                    </li>
                  );
                if (!next)
                  return (
                    <li key={l} className="later small muted">
                      🔒 {h.title} · {LEVEL_NAMES[l]}
                    </li>
                  );
                const gain = easy ? hireGain(world, state, ch) : null;
                return (
                  <li key={l} className="next">
                    <button className="btn btn-small" disabled={!playing || state.cash < h.signing} onClick={() => onHire(ch)}>
                      Hire · {usd(h.signing)}
                    </button>
                    <span className="small">
                      <b>{h.title}</b> · unlocks {LEVEL_NAMES[l]} · {usd(h.salary)}/day
                      {gain !== null && (
                        <span className={gain >= 0 ? "pos" : "neg"}>
                          {" "}
                          · {gain >= 0 ? "+" : ""}
                          {usd(gain)}/day at best
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h4>Shops</h4>
        {state.shops.length > 0 && (
          <ul className="small">
            {state.shops.map((z) => (
              <li key={z}>
                🏪 {world.zones[z].name} · rent {usd(shopRent(world, z))}/day
              </li>
            ))}
          </ul>
        )}
        <p className="small muted">
          {state.shops.length ? "Next shop" : "Your first shop"}: {usd(shopCost(state))}. Open one from a neighborhood's card.
        </p>
      </section>

      <p className="small costs">
        Running costs {usd(fixedCosts(world, state))}/day: base {usd(C.fixedOverhead)} + salaries {usd(salaries(state.staff))}
        {state.shops.length > 0 && <> + rent {usd(totalRent(world, state))}</>}
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
