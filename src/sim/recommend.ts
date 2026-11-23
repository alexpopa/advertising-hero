/**
 * Easy-mode suggestions (DESIGN.md 6.7): the best one-step campaign changes by estimated
 * steady-state profit. A step is one level up or down, or ticking or unticking
 * out-of-home or digital ads. The UI only shows these on Easy; the economy is the same on every difficulty.
 */
import { explain } from "./explain";
import { estimate } from "./world";
import { FORMATS, FORMAT_NAMES, LEVEL_NAMES, type GameState, type Level, type Plan, type World } from "./types";

export interface Recommendation {
  zone: number;
  zoneName: string;
  from: Plan;
  to: Plan;
  /** Estimated change in profit per day once the change has fully taken effect. */
  deltaProfit: number;
  /** Ad cost per day with the new plan. */
  costPerDay: number;
  /** "Medium digital ads in Mission" / "Cut Marina from High to Medium" / "Switch Mission to out-of-home ads" */
  title: string;
  reason: string;
  /** True when the change lowers spend or stops ads. */
  cut: boolean;
}

export function recommend(world: World, state: GameState, count = 5): Recommendation[] {
  const out: Recommendation[] = [];
  for (const z of world.zones) {
    const from: Plan = { level: state.levels[z.index], format: state.formats[z.index] };
    const fromProfit = estimate(z, from).profit;
    const candidates: Plan[] = [];
    if (from.level === 0) for (const format of FORMATS) candidates.push({ level: 1, format });
    else {
      for (const level of [from.level - 1, from.level + 1] as Level[])
        if (level >= 0 && level <= 3) candidates.push({ ...from, level });
      for (const format of FORMATS) if (format !== from.format) candidates.push({ ...from, format });
    }
    let best: { to: Plan; delta: number } | null = null;
    for (const to of candidates) {
      const delta = estimate(z, to).profit - fromProfit;
      if (delta > 0.5 && (!best || delta > best.delta)) best = { to, delta };
    }
    if (!best) continue;
    const { to } = best;
    const cut = to.level < from.level;
    const fmt = FORMAT_NAMES[to.format].toLowerCase();
    let title: string;
    if (from.level === 0) title = `${LEVEL_NAMES[to.level]} ${fmt} ads in ${z.name}`;
    else if (to.level === 0) title = `Stop ads in ${z.name}`;
    else if (to.level !== from.level)
      title = `${cut ? "Cut" : "Raise"} ${z.name} from ${LEVEL_NAMES[from.level]} to ${LEVEL_NAMES[to.level]}`;
    else title = `Switch ${z.name} to ${fmt} ads`;
    out.push({
      zone: z.index,
      zoneName: z.name,
      from,
      to,
      deltaProfit: best.delta,
      costPerDay: estimate(z, to).cost,
      title,
      reason: cut ? "Costs more than it brings in" : explain(world, z.index).summary,
      cut,
    });
  }
  return out.sort((a, b) => b.deltaProfit - a.deltaProfit).slice(0, count);
}
