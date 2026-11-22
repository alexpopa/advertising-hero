/**
 * Cash over the run: one series, 2px line, recessive grid, a $0 baseline, and a hover
 * readout (crosshair + value) so the exact numbers are always reachable.
 */
import { useState } from "react";
import type { DayResult } from "./sim";
import { usd } from "./scale";

const W = 560;
const H = 200;
const PAD = { top: 12, right: 28, bottom: 24, left: 56 };

export function CashChart({ history, startCash }: { history: DayResult[]; startCash: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = [{ day: 0, cash: startCash }, ...history.map((h) => ({ day: h.day, cash: h.cash }))];
  const maxDay = Math.max(1, points[points.length - 1].day);
  const lo = Math.min(0, ...points.map((p) => p.cash));
  const hi = Math.max(...points.map((p) => p.cash)) * 1.05;
  const x = (d: number) => PAD.left + (d / maxDay) * (W - PAD.left - PAD.right);
  const y = (c: number) => PAD.top + (1 - (c - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
  const ticks = niceTicks(lo, hi, 4);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.cash).toFixed(1)}`).join("");
  const hp = hover !== null ? points[hover] : null;

  return (
    <figure className="cash-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Cash over ${maxDay} days, from ${usd(startCash)} to ${usd(points[points.length - 1].cash)}`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const day = Math.round((((e.clientX - r.left) / r.width) * W - PAD.left) / ((W - PAD.left - PAD.right) / maxDay));
          setHover(Math.max(0, Math.min(points.length - 1, day)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
            <text x={PAD.left - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {usd(t)}
            </text>
          </g>
        ))}
        {[0, Math.round(maxDay / 2), maxDay].map((d) => (
          <text key={d} x={x(d)} y={H - 6} className="tick" textAnchor="middle">
            Day {d}
          </text>
        ))}
        <path d={path} className="line" />
        {hp && (
          <g>
            <line x1={x(hp.day)} x2={x(hp.day)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
            <circle cx={x(hp.day)} cy={y(hp.cash)} r={4} className="dot" />
          </g>
        )}
      </svg>
      <figcaption className="small muted">
        {hp ? (
          <>
            Day {hp.day}: <b className="ink">{usd(hp.cash)}</b>
          </>
        ) : (
          "Cash at the end of each day. Hover for exact values."
        )}
      </figcaption>
    </figure>
  );
}

function niceTicks(lo: number, hi: number, n: number): number[] {
  const step0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(step0 || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(Math.round(t));
  return out;
}
