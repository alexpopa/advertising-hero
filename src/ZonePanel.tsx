/**
 * "Why does this neighborhood score the way it does?" — the panel shown on click.
 * Everything here is generated from the numbers; nothing is written per neighborhood.
 */
import { C, LEVEL_NAMES, explain, labelName, levelCost, reach, steadyPressure, type Level, type World } from "./sim";
import { scoreBin, usd } from "./scale";

interface Props {
  world: World;
  zone: number;
  examples: Record<string, string[]> | undefined;
  onClose: () => void;
}

export function ZonePanel({ world, zone, examples, onClose }: Props) {
  const z = world.zones[zone];
  const e = explain(world, zone);
  const bin = scoreBin(z.score);
  const best = z.steadyProfit.indexOf(Math.max(...z.steadyProfit));

  const exampleLines = [
    ...e.signals.map((s) => ({ label: s.label, kind: "Customers near" })),
    ...z.compParts.filter((p) => p.count > 0).slice(0, 2).map((p) => ({ label: p.label, kind: "Competing" })),
  ]
    .map((x) => ({ ...x, names: examples?.[x.label] ?? [] }))
    .filter((x) => x.names.length);

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

      <div className="score-row">
        <span className="swatch" style={{ background: bin.color }} aria-hidden />
        <span className="score-num">{z.score}</span>
        <span>
          <b>{bin.label}</b> for {world.product.name.toLowerCase()}
          <br />
          <span className="muted small">Return per ad dollar, ranked against the rest of SF</span>
        </span>
      </div>

      <h3>Why</h3>
      <ul className="why">
        <li>{e.fitLine}</li>
        <li>{e.competitionLine}</li>
        <li>{e.priceLine}</li>
      </ul>

      <h3>Ad options</h3>
      <table className="levels">
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Cost/day</th>
            <th scope="col">Customers/day</th>
            <th scope="col">Profit/day</th>
          </tr>
        </thead>
        <tbody>
          {([1, 2, 3] as Level[]).map((l) => {
            const profit = z.steadyProfit[l];
            return (
              <tr key={l} className={l === best ? "best" : undefined}>
                <th scope="row">{LEVEL_NAMES[l]}</th>
                <td>{usd(levelCost(z.price, l))}</td>
                <td>{(z.pmax * reach(steadyPressure(l))).toFixed(1)}</td>
                <td className={profit >= 0 ? "pos" : "neg"}>
                  {profit >= 0 ? "+" : ""}
                  {usd(profit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        Estimates once ads have fully built up (about 10 days). Cost includes the {usd(C.campaignFee)}/day campaign
        fee. Profit is after product costs and a {C.variableOverhead * 100}% fulfillment share.
      </p>

      {exampleLines.length > 0 && (
        <>
          <h3>Real places here</h3>
          <ul className="examples">
            {exampleLines.map((x) => (
              <li key={x.kind + x.label}>
                <span className="muted small">
                  {x.kind === "Competing" ? "Competitors" : "Signals"} · {labelName(x.label)}
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
