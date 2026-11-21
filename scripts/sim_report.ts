/**
 * A quick look at the economy: per product, the best and worst zones and what a few
 * simple ad plans earn over a 90-day run. Not the balance script (that comes later);
 * just a sanity check that the numbers make sense.
 *
 * Usage: npm run report [-- product_key]
 */
import { readFileSync } from "node:fs";
import {
  C,
  LEVEL_NAMES,
  buildWorld,
  explain,
  initGame,
  recommend,
  step,
  type Action,
  type CategoriesData,
  type GameState,
  type Level,
  type World,
  type ZoneData,
} from "../src/sim/index";

const root = new URL("..", import.meta.url);
const zones = (JSON.parse(readFileSync(new URL("public/data/zones.json", root), "utf8")) as { zones: ZoneData[] }).zones;
const cats = JSON.parse(readFileSync(new URL("scripts/categories.json", root), "utf8")) as CategoriesData;

const usd = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const bestLevel = (z: World["zones"][number]) => {
  const m = Math.max(...z.steadyProfit);
  return (m > 0 ? z.steadyProfit.indexOf(m) : 0) as Level;
};

type Plan = (w: World, s: GameState) => Action[];
const setEach = (w: World, f: (z: World["zones"][number]) => Level): Action[] =>
  w.zones.map((z) => ({ type: "setLevel", zone: z.index, level: f(z) }));

const plans: Record<string, Plan> = {
  "Do nothing": () => [],
  "Low everywhere": (w, s) => (s.day === 0 ? setEach(w, () => 1) : []),
  "High everywhere": (w, s) => (s.day === 0 ? setEach(w, () => 3) : []),
  "Medium in top-10 by score": (w, s) => {
    if (s.day > 0) return [];
    const top = new Set([...w.zones].sort((a, b) => b.score - a.score).slice(0, 10).map((z) => z.index));
    return setEach(w, (z) => (top.has(z.index) ? 2 : 0));
  },
  "Perfect plan from day 1": (w, s) => (s.day === 0 ? setEach(w, bestLevel) : []),
  "Easy mode: take top suggestion daily": (w, s) => {
    const r = recommend(w, s, 1)[0];
    return r ? [{ type: "setLevel", zone: r.zone, level: r.to }] : [];
  },
};

function play(w: World, plan: Plan, seed: number): GameState {
  let s = initGame(w, seed);
  while (s.status === "playing") s = step(w, s, plan(w, s));
  return s;
}

const only = process.argv[2];
for (const key of Object.keys(cats.products)) {
  if (only && key !== only) continue;
  const w = buildWorld(zones, cats, key);
  const p = w.product;
  console.log(`\n=== ${p.name} ($${p.orderValue} order, ${Math.round(p.margin * 100)}% margin) ===`);
  const sorted = [...w.zones].sort((a, b) => b.score - a.score);
  const counts = [0, 1, 2, 3].map((l) => w.zones.filter((z) => bestLevel(z) === l).length);
  console.log(`Best level per zone: ${counts.map((c, l) => `${LEVEL_NAMES[l]} ${c}`).join(", ")}`);
  console.log("Top zones by score:");
  for (const z of sorted.slice(0, 5)) {
    const e = explain(w, z.index);
    console.log(
      `  ${String(z.score).padStart(3)}  ${z.name.padEnd(26)} Low ${usd(z.price).padStart(4)}/day  best ${LEVEL_NAMES[bestLevel(z)].padEnd(6)} ${usd(Math.max(...z.steadyProfit)).padStart(5)}/day  | ${e.summary}`,
    );
  }
  console.log("Bottom zones:");
  for (const z of sorted.slice(-2)) {
    console.log(`  ${String(z.score).padStart(3)}  ${z.name.padEnd(26)} ${explain(w, z.index).summary}`);
  }
  console.log("90-day plans (median of 5 seeds):");
  for (const [name, plan] of Object.entries(plans)) {
    const runs = [1, 2, 3, 4, 5].map((seed) => play(w, plan, seed));
    const cash = runs.map((r) => r.cash).sort((a, b) => a - b)[2];
    const bankrupt = runs.filter((r) => r.status === "bankrupt");
    const day20 = runs.map((r) => r.history[19]?.cash ?? r.cash).sort((a, b) => a - b)[2];
    const minCash = Math.min(...runs[2].history.map((h) => h.cash));
    const spend = runs[2].history[29]?.adSpend ?? 0;
    console.log(
      `  ${name.padEnd(38)} end ${usd(cash).padStart(8)}   day 20 ${usd(day20).padStart(7)}   lowest ${usd(minCash).padStart(7)}   ads day 30 ${usd(spend).padStart(6)}/day` +
        (bankrupt.length ? `   BANKRUPT ${bankrupt.length}/5 (day ${bankrupt.map((r) => r.day).join(", ")})` : ""),
    );
  }
}
console.log(`\nStart cash ${usd(C.startCash)}, ${C.days} days, fixed overhead ${usd(C.fixedOverhead)}/day.`);
