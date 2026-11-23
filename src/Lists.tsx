/** The lists in the in-game dropdown: suggestions (Easy), campaigns, what you know, and events. */
import { useState } from "react";
import {
  C,
  FORMAT_NAMES,
  LEVEL_NAMES,
  ROLE_TITLES,
  describeEvent,
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
        <li key={`${r.zone}-${r.to.level}-${r.to.format}`}>
          <button className="link" onClick={() => onSelect(r.zone)}>
            {r.title}
          </button>
          <div className="muted small">{r.reason}</div>
          <div className="rec-foot">
            <span className="pos small">+{usd(r.deltaProfit)}/day once built up</span>
            <button className="btn btn-small" disabled={state.status !== "playing"} onClick={() => onSetPlan(r.zone, r.to)}>
              {r.cut ? "Cut" : r.from.level === 0 ? "Buy" : "Change"} · {r.to.level === 0 ? "$0" : usd(r.costPerDay)}/day
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
    .filter((z) => state.levels[z.index] > 0 || state.lastDay.customers[z.index] > 0.05)
    .map((z) => ({
      z,
      level: state.levels[z.index],
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
            <th scope="col">Level</th>
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
                <div className="muted small">
                  {FORMAT_NAMES[state.formats[r.z.index]]} ads
                </div>
              </th>
              <td>
                <select
                  aria-label={`Ad level in ${r.z.name}`}
                  value={r.level}
                  disabled={state.status !== "playing"}
                  onChange={(e) => onSetPlan(r.z.index, { level: Number(e.target.value) as Level })}
                >
                  {LEVEL_NAMES.map((n, l) => (
                    <option key={n} value={l}>
                      {n}
                    </option>
                  ))}
                </select>
              </td>
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
            <th scope="row" colSpan={3}>
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

export function Events({ world, state, onSelect }: Pick<Props, "world" | "state" | "onSelect">) {
  if (!state.eventLog.length) return <p className="muted">Nothing has happened yet. Events come every week or two.</p>;
  return (
    <ul className="event-log">
      {[...state.eventLog].reverse().map((e, i) => {
        const d = describeEvent(world, e);
        const active = state.events.some((a) => a.day === e.day && a.kind === e.kind);
        return (
          <li key={i}>
            <span className="muted small">
              Day {e.day}
              {active ? " · now" : ""}
            </span>
            <br />
            {e.zone >= 0 ? (
              <button className="link" onClick={() => onSelect(e.zone)}>
                {d.title}
              </button>
            ) : (
              <b>{d.title}</b>
            )}
            <div className="muted small">{d.detail}</div>
          </li>
        );
      })}
    </ul>
  );
}
