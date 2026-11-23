/** The results card shown over the map when a run ends. */
import { CashChart } from "./CashChart";
import { C, hiredOf, zoneTotalProfit, type GameState, type World } from "./sim";
import { usd } from "./scale";
import { DIFFICULTIES } from "./Menu";
import { bestDays, type Win } from "./storage";

interface Props {
  world: World;
  brand: string;
  state: GameState;
  /** Every paid-off run in this browser, for the record. */
  wins: Win[];
  onKeepPlaying: () => void;
  onPlayAgain: () => void;
  onViewMap: () => void;
}

export function EndScreen({ world, brand, state, wins, onKeepPlaying, onPlayAgain, onViewMap }: Props) {
  const bankrupt = state.status === "bankrupt";
  const justPaid = state.status === "paid";
  const won = state.paidDay !== undefined;
  const best = bestDays(wins).get(state.productKey);
  const record = won && best && best.seed === state.seed;
  const title = justPaid
    ? `🏦 ${brand} paid off the bank on day ${state.paidDay}`
    : won
      ? `${brand} went bankrupt on day ${state.day}`
      : bankrupt
        ? `${brand} went bankrupt on day ${state.day}. The bank takes everything.`
        : `Day ${C.days}: the bank takes everything`;
  const adSpend = state.history.reduce((a, h) => a + h.adSpend, 0);
  const customers = state.history.reduce((a, h) => a + h.customers, 0);
  const used = world.zones
    .filter((z) => state.totals.adSpend[z.index] > 0)
    .map((z) => ({ z, profit: zoneTotalProfit(state, z.index) }))
    .sort((a, b) => b.profit - a.profit);
  const top = used.slice(0, 3);
  const team = hiredOf(state.staff);
  const invested = state.purchases.reduce((a, p) => a + p.cost, 0);
  const earlyBuys = state.purchases.filter((p) => p.day <= 10).length;
  const worst = used.length > 3 ? used.slice(-3).reverse().filter((r) => r.profit < 0) : [];

  return (
    <div className="menu-layer">
      <div className="float-card end-card" role="dialog" aria-label="Results">
        <p className="muted">
          {world.product.name} · {DIFFICULTIES.find((d) => d.key === state.difficulty)?.name}
        </p>
        <h1>{title}</h1>
        <p className={"record" + (record ? " new" : "")}>
          {won && !justPaid && <>🏦 Paid off on day {state.paidDay} · </>}
          {!won && state.status === "finished" && (
            <>
              🏦 {usd(Math.max(0, state.cash))} of {usd(C.loan)} ·{" "}
            </>
          )}
          {record ? (
            <>🏆 Best for {world.product.name.toLowerCase()}</>
          ) : best ? (
            <>
              🏆 Best: day {best.day} ({best.brand})
            </>
          ) : (
            <span className="muted">🏆 No payoff yet for {world.product.name.toLowerCase()}</span>
          )}
        </p>
        <p className="small">
          {team.length ? `Team: you + ${team.length} hire${team.length === 1 ? "" : "s"}` : "Team: just you"}
          {state.shops.length > 0 &&
            ` · ${state.shops.length} shop${state.shops.length === 1 ? "" : "s"} (${state.shops.map((z) => world.zones[z].name).join(", ")})`}
          {invested > 0 && ` · ${usd(invested)} invested`}
        </p>
        <div className="stats">
          <div>
            <span className="muted small">Final cash</span>
            <b className={won ? "" : state.cash >= C.startCash ? "pos" : "neg"}>{usd(state.cash)}</b>
          </div>
          <div>
            <span className="muted small">Profit</span>
            <b>{usd(state.cash + (won ? C.loan : 0) - C.startCash)}</b>
          </div>
          <div>
            <span className="muted small">Spent on ads</span>
            <b>{usd(adSpend)}</b>
          </div>
          <div>
            <span className="muted small">Customers</span>
            <b>{Math.round(customers).toLocaleString("en-US")}</b>
          </div>
        </div>
        <CashChart
          // On the day it's paid, show the cash that paid it: the line meets the bank's line.
          history={justPaid ? state.history.map((h) => (h.day === state.paidDay ? { ...h, cash: h.cash + C.loan } : h)) : state.history}
          startCash={C.startCash}
          goal={won && !justPaid ? undefined : C.loan}
        />
        {used.length > 0 && (
          <div className="end-cols">
            <div>
              <h3>Best neighborhoods</h3>
              <ol>
                {top.map((r) => (
                  <li key={r.z.index}>
                    {r.z.name} <span className={r.profit >= 0 ? "pos" : "neg"}>{usd(r.profit)}</span>
                  </li>
                ))}
              </ol>
            </div>
            {worst.length > 0 && (
              <div>
                <h3>Money losers</h3>
                <ol>
                  {worst.map((r) => (
                    <li key={r.z.index}>
                      {r.z.name} <span className="neg">{usd(r.profit)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
        {bankrupt && !won && (
          <p className="muted">
            {earlyBuys > 0
              ? "Tip: hires and shops are paid for up front, and new ads lose money for weeks while they build up. Keep some cash spare, and hire once your profit per day can carry the salary."
              : used.length < 4
                ? `Tip: running the business costs ${usd(C.fixedOverhead)}/day plus salaries and rent, even with no ads. Aim for several strong neighborhoods, added a few at a time as cash allows.`
                : `Tip: every campaign costs a ${usd(C.formats.ooh.fee)}/day fee (${usd(C.formats.digital.fee)} digital) on top of the ads, so weak neighborhoods lose money. Check the campaigns list and cut anything that's still red after a month.`}
          </p>
        )}
        <div className="row">
          {justPaid && (
            <button className="btn btn-primary" onClick={onKeepPlaying}>
              Keep playing
            </button>
          )}
          <button className={"btn " + (justPaid ? "btn-ghost" : "btn-primary")} onClick={onPlayAgain}>
            Play again
          </button>
          <button className="btn btn-ghost" onClick={onViewMap}>
            Look at the map
          </button>
        </div>
      </div>
    </div>
  );
}
