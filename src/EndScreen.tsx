import { CashChart } from "./CashChart";
import { C, zoneTotalProfit, type GameState, type World } from "./sim";
import { usd } from "./scale";

interface Props {
  world: World;
  brand: string;
  state: GameState;
  onPlayAgain: () => void;
  onViewMap: () => void;
}

export function EndScreen({ world, brand, state, onPlayAgain, onViewMap }: Props) {
  const bankrupt = state.status === "bankrupt";
  const adSpend = state.history.reduce((a, h) => a + h.adSpend, 0);
  const customers = state.history.reduce((a, h) => a + h.customers, 0);
  const used = world.zones
    .filter((z) => state.totals.adSpend[z.index] > 0)
    .map((z) => ({ z, profit: zoneTotalProfit(state, z.index) }))
    .sort((a, b) => b.profit - a.profit);
  const best = used.slice(0, 3);
  const worst = used.length > 3 ? used.slice(-3).reverse().filter((r) => r.profit < 0) : [];

  return (
    <div className="end">
      <div className="end-inner">
        <p className="muted">
          {world.product.name} · {state.difficulty === "easy" ? "Easy" : "Hard"}
        </p>
        <h1>{bankrupt ? `${brand} went bankrupt on day ${state.day}` : `${brand} after ${C.days} days`}</h1>
        <div className="stats">
          <div>
            <span className="muted small">Final cash</span>
            <b className={state.cash >= C.startCash ? "pos" : "neg"}>{usd(state.cash)}</b>
          </div>
          <div>
            <span className="muted small">Profit</span>
            <b>{usd(state.cash - C.startCash)}</b>
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
        <CashChart history={state.history} startCash={C.startCash} />
        {used.length > 0 && (
          <div className="end-cols">
            <div>
              <h3>Best neighborhoods</h3>
              <ol>
                {best.map((r) => (
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
        {bankrupt && (
          <p className="muted">
            {used.length < 4
              ? `Tip: running the business costs ${usd(C.fixedOverhead)}/day even with no ads, so one or two campaigns can't cover it. Aim for five or six strong neighborhoods, added a few at a time as cash allows.`
              : `Tip: every campaign costs a ${usd(C.campaignFee)}/day fee on top of the ads, so weak neighborhoods lose money. Check the campaigns list and cut anything that's still red after a week.`}
          </p>
        )}
        <div className="row">
          <button className="btn btn-primary" onClick={onPlayAgain}>
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
