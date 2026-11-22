import { useState } from "react";
import {
  LEVEL_NAMES,
  adCost,
  describeEvent,
  recommend,
  zoneDayProfit,
  type GameState,
  type Level,
  type World,
} from "./sim";
import { usd } from "./scale";

type Tab = "suggestions" | "campaigns" | "events";
type SortKey = "profit" | "cost" | "name";

interface Props {
  world: World;
  state: GameState;
  onSelect: (zone: number) => void;
  onSetLevel: (zone: number, level: Level) => void;
  onClose?: () => void;
}

export function Sidebar({ world, state, onSelect, onSetLevel, onClose }: Props) {
  const easy = state.difficulty === "easy";
  const [tab, setTab] = useState<Tab>(easy ? "suggestions" : "campaigns");
  const tabs: Tab[] = easy ? ["suggestions", "campaigns", "events"] : ["campaigns", "events"];
  const running = world.zones.filter((z) => state.levels[z.index] > 0).length;

  return (
    <aside className="sidebar" aria-label="Your business">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "suggestions" ? "Suggestions" : t === "campaigns" ? `Campaigns (${running})` : "Events"}
          </button>
        ))}
        {onClose && (
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>
      <div className="tab-body">
        {tab === "suggestions" && <Suggestions world={world} state={state} onSelect={onSelect} onSetLevel={onSetLevel} />}
        {tab === "campaigns" && <Campaigns world={world} state={state} onSelect={onSelect} onSetLevel={onSetLevel} />}
        {tab === "events" && <Events world={world} state={state} onSelect={onSelect} />}
      </div>
    </aside>
  );
}

function Suggestions({ world, state, onSelect, onSetLevel }: Omit<Props, "onClose">) {
  const recs = recommend(world, state);
  if (!recs.length) return <p className="muted">Nothing to change right now: your campaigns are where they should be.</p>;
  return (
    <ol className="recs">
      {recs.map((r) => (
        <li key={`${r.zone}-${r.to}`}>
          <button className="link" onClick={() => onSelect(r.zone)}>
            {r.title}
          </button>
          <div className="muted small">{r.reason}</div>
          <div className="rec-foot">
            <span className="pos small">+{usd(r.deltaProfit)}/day once built up</span>
            <button className="btn btn-small" disabled={state.status !== "playing"} onClick={() => onSetLevel(r.zone, r.to)}>
              {r.to < r.from ? "Cut" : "Buy"} · {r.to === 0 ? "$0" : usd(adCost(world, state, r.zone, r.to))}/day
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Campaigns({ world, state, onSelect, onSetLevel }: Omit<Props, "onClose">) {
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
              </th>
              <td>
                <select
                  aria-label={`Ad level in ${r.z.name}`}
                  value={r.level}
                  disabled={state.status !== "playing"}
                  onChange={(e) => onSetLevel(r.z.index, Number(e.target.value) as Level)}
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

function Events({ world, state, onSelect }: Pick<Props, "world" | "state" | "onSelect">) {
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
