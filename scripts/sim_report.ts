/**
 * A quick look at the economy: per product, the best and worst zones, what a few simple ad
 * plans earn with the whole team hired from day 1, and how three growth strategies do when
 * you start alone (hires, shops, monthly goals). A sanity check, not a full balance script.
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
  planName,
  topLevel,
  isOn,
  type Action,
  type CategoriesData,
  type GameState,

  type Plan,
  type World,
  CHANNELS,
  bestAllowed,
  hireGain,
  nextHire,
  shopCost,
  shopGain,
  type ZoneData,
} from "../src/sim/index";

const root = new URL("..", import.meta.url);
const zones = (JSON.parse(readFileSync(new URL("public/data/zones.json", root), "utf8")) as { zones: ZoneData[] }).zones;
const cats = JSON.parse(readFileSync(new URL("scripts/categories.json", root), "utf8")) as CategoriesData;

const usd = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
type Strategy = (w: World, s: GameState) => Action[];
const apply = (zone: number, p: Plan): Action[] => [{ type: "setPlan", zone, plan: p }];
const setEach = (w: World, f: (z: World["zones"][number]) => Plan): Action[] => w.zones.flatMap((z) => apply(z.index, f(z)));
const everywhere = (p: Plan): Strategy => (w, s) => (s.day === 0 ? setEach(w, () => p) : []);

const plans: Record<string, Strategy> = {
  "Do nothing": () => [],
  "Low out-of-home everywhere": everywhere({ ooh: 1, digital: 0 }),
  "Low digital everywhere": everywhere({ ooh: 0, digital: 1 }),
  "High out-of-home everywhere": everywhere({ ooh: 3, digital: 0 }),
  "Medium out-of-home, top-10 by score": (w, s) => {
    if (s.day > 0) return [];
    const top = new Set([...w.zones].sort((a, b) => b.score - a.score).slice(0, 10).map((z) => z.index));
    return setEach(w, (z) => ({ ooh: top.has(z.index) ? 2 : 0, digital: 0 }));
  },
  "Perfect plan from day 1": (w, s) => (s.day === 0 ? setEach(w, (z) => z.best) : []),
  "Easy mode: take top suggestion daily": (w, s) => {
    const r = recommend(w, s, 1)[0];
    return r ? apply(r.zone, r.to) : [];
  },
};

function play(w: World, plan: Strategy, seed: number, alone = false): GameState {
  let s = initGame(w, seed);
  if (!alone) s = { ...s, staff: { ooh: 3, digital: 3 } };
  while (s.status === "playing") s = step(w, s, plan(w, s));
  return s;
}

/**
 * Growth strategies, starting alone. Every day each zone runs its best plan the team allows
 * (perfect knowledge, like Easy). They differ in when they buy.
 */
const runBest = (w: World, s: GameState): Action[] =>
  w.zones.flatMap((z) => {
    const p = bestAllowed(w, s.staff, z.index, s.shops.includes(z.index)).plan;
    const now = s.plans[z.index];
    return p.ooh === now.ooh && p.digital === now.digital ? [] : apply(z.index, p);
  });
const grow = (cushion: number, onlyIfGain: boolean): Strategy => (w, s) => {
  const acts: Action[] = [];
  let cash = s.cash;
  const hires = CHANNELS.map((ch) => ({ ch, h: nextHire(s.staff, ch), gain: hireGain(w, s, ch) ?? -Infinity }))
    .filter((x) => x.h && (!onlyIfGain || x.gain > 0))
    .sort((a, b) => b.gain - a.gain);
  const pick = hires[0];
  if (pick && cash - pick.h!.signing >= cushion) {
    acts.push({ type: "hire", channel: pick.ch });
    cash -= pick.h!.signing;
  } else if (!pick || !onlyIfGain) {
    const z = [...w.zones]
      .filter((z) => !s.shops.includes(z.index))
      .sort((a, b) => shopGain(w, s, b.index) - shopGain(w, s, a.index))[0];
    if (z && shopGain(w, s, z.index) > 0 && cash - shopCost(s) >= cushion) acts.push({ type: "openShop", zone: z.index });
  }
  // Plans are set after the purchases in step; pick them for the staff after this day's hire.
  const after = { ...s, staff: acts[0]?.type === "hire" ? { ...s.staff, [acts[0].channel]: s.staff[acts[0].channel] + 1 } : s.staff, shops: acts[0]?.type === "openShop" ? [...s.shops, acts[0].zone] : s.shops };
  return [...acts, ...runBest(w, after as GameState)];
};
const growth: Record<string, Strategy> = {
  "Stay alone (best digital Low plans)": (w, s) => runBest(w, s),
  "Grow when it pays, keep $1,500 spare": grow(1500, true),
  "Buy everything as soon as possible": grow(0, false),
};

const only = process.argv[2];
const summary: Record<string, { cash: number[]; stars: number[]; bankrupt: number; months: number[][] }> = {};
for (const key of Object.keys(cats.products)) {
  if (only && key !== only) continue;
  const w = buildWorld(zones, cats, key);
  const p = w.product;
  console.log(`\n=== ${p.name} ($${p.orderValue} order, ${Math.round(p.margin * 100)}% margin) ===`);
  const sorted = [...w.zones].sort((a, b) => b.score - a.score);
  const tally = (f: (z: World["zones"][number]) => string) => {
    const m = new Map<string, number>();
    for (const z of w.zones.filter((z) => isOn(z.best))) m.set(f(z), (m.get(f(z)) ?? 0) + 1);
    return [...m].map(([k, v]) => `${k} ${v}`).join(", ");
  };
  const counts = [0, 1, 2, 3].map((l) => w.zones.filter((z) => topLevel(z.best) === l).length);
  console.log(`Best top level per zone: ${counts.map((c, l) => `${LEVEL_NAMES[l]} ${c}`).join(", ")}`);
  console.log(`  channels: ${tally((z) => (z.best.ooh && z.best.digital ? "both" : z.best.ooh ? "out-of-home" : "digital"))}`);
  console.log(`  plans: ${tally((z) => planName(z.best))}`);
  console.log("Top zones by score:");
  for (const z of sorted.slice(0, 5)) {
    const e = explain(w, z.index);
    console.log(
      `  ${String(z.score).padStart(3)}  ${z.name.padEnd(26)} Low ${usd(z.price).padStart(4)}/day  best ${planName(z.best).padEnd(30)} ${usd(z.bestProfit).padStart(5)}/day  | ${e.summary}`,
    );
  }
  console.log("Bottom zones:");
  for (const z of sorted.slice(-2)) {
    console.log(`  ${String(z.score).padStart(3)}  ${z.name.padEnd(26)} ${explain(w, z.index).summary}`);
  }
  console.log(`${C.days}-day plans, whole team hired from day 1 (median of 5 seeds):`);
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
  console.log("Starting alone (median of 5 seeds):");
  for (const [name, plan] of Object.entries(growth)) {
    const runs = [1, 2, 3, 4, 5].map((seed) => play(w, plan, seed, true));
    const mid = runs.sort((a, b) => a.cash - b.cash)[2];
    const stars = mid.goalsMet.map((m) => (m ? "★" : "☆")).join("");
    const buys = mid.purchases
      .map((p) => (p.kind === "shop" ? `shop d${p.day}` : `${p.channel === "ooh" ? "O" : "D"}${p.level} d${p.day}`))
      .join(" ");
    const months = [1, 2, 3, 4, 5, 6].map((m) => {
      const h = mid.history.slice((m - 1) * C.monthDays, m * C.monthDays);
      return h.length ? Math.round(h.reduce((a, x) => a + x.profit, 0) / h.length) : NaN;
    });
    const sm = (summary[name] ??= { cash: [], stars: [], bankrupt: 0, months: [] });
    sm.months.push(months);
    sm.cash.push(mid.cash);
    sm.stars.push(mid.goalsMet.filter(Boolean).length);
    sm.bankrupt += runs.filter((r) => r.status === "bankrupt").length;
    console.log(
      `  ${name.padEnd(38)} end ${usd(mid.cash).padStart(8)} ${stars.padEnd(6)} avg/day by month ${months.join(" ")}  | ${buys}` +
        (mid.status === "bankrupt" ? ` BANKRUPT day ${mid.day}` : ""),
    );
  }
}
if (!only) {
  console.log(`\nGrowth summary over ${Object.keys(cats.products).length} products (goals ${C.goals.join(", ")} $/day):`);
  for (const [name, sm] of Object.entries(summary)) {
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const starCount = [0, 1, 2, 3, 4, 5, 6].map((k) => sm.stars.filter((x) => x === k).length);
    console.log(
      `  ${name.padEnd(38)} median end ${usd(med(sm.cash))}, stars (0-6) ${starCount.join("/")}, bankrupt runs ${sm.bankrupt}`,
    );
    const q = (m: number, f: number) => {
      const v = sm.months.map((x) => x[m]).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
      return v.length ? Math.round(v[Math.floor(f * (v.length - 1))]) : NaN;
    };
    console.log(`    profit/day by month, 25th / median / 75th pct of products: ${[0, 1, 2, 3, 4, 5].map((m) => `${q(m, 0.25)}/${q(m, 0.5)}/${q(m, 0.75)}`).join("  ")}`);
  }
}
console.log(`\nStart cash ${usd(C.startCash)}, ${C.days} days, base overhead ${usd(C.fixedOverhead)}/day plus salaries and rent.`);
