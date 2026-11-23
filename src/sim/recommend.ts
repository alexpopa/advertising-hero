/**
 * Easy-mode suggestions (DESIGN.md 6.7): the best one-step campaign changes by estimated
 * steady-state profit. A step moves one channel (out-of-home or digital) in one zone one
 * level up or down, among what your team can buy. The UI only shows these on Easy; the
 * economy is the same on every difficulty.
 */
import { explain } from "./explain";
import { allowed, estimateFor } from "./team";
import { CHANNELS, CHANNEL_NAMES, LEVEL_NAMES, type Channel, type GameState, type Level, type Plan, type World } from "./types";

export interface Recommendation {
  zone: number;
  zoneName: string;
  /** The channel that changes. */
  channel: Channel;
  from: Plan;
  to: Plan;
  /** Estimated change in profit per day once the change has fully taken effect. */
  deltaProfit: number;
  /** Ad cost per day with the new plan. */
  costPerDay: number;
  /** "Medium digital ads in Mission" / "Cut out-of-home in Marina from High to Medium" / "Stop digital in Mission" */
  title: string;
  reason: string;
  /** True when the change lowers spend or stops ads. */
  cut: boolean;
}

export function recommend(world: World, state: GameState, count = 5): Recommendation[] {
  const out: Recommendation[] = [];
  for (const z of world.zones) {
    const from = state.plans[z.index];
    const est = (p: Plan) => estimateFor(world, state, z.index, p);
    const fromProfit = est(from).profit;
    let best: { to: Plan; channel: Channel; delta: number } | null = null;
    for (const channel of CHANNELS)
      for (const step of [-1, 1]) {
        const level = from[channel] + step;
        if (level < 0 || level > 3) continue;
        const to = { ...from, [channel]: level as Level };
        if (!allowed(state.staff, to)) continue;
        const delta = est(to).profit - fromProfit;
        if (delta > 0.5 && (!best || delta > best.delta)) best = { to, channel, delta };
      }
    if (!best) continue;
    const { to, channel } = best;
    const a = from[channel];
    const b = to[channel];
    const cut = b < a;
    const ch = CHANNEL_NAMES[channel].toLowerCase();
    const title =
      a === 0
        ? `${LEVEL_NAMES[b]} ${ch} ads in ${z.name}`
        : b === 0
          ? `Stop ${ch} in ${z.name}`
          : `${cut ? "Cut" : "Raise"} ${ch} in ${z.name} from ${LEVEL_NAMES[a]} to ${LEVEL_NAMES[b]}`;
    out.push({
      zone: z.index,
      zoneName: z.name,
      channel,
      from,
      to,
      deltaProfit: best.delta,
      costPerDay: est(to).cost,
      title,
      reason: cut ? "Costs more than it brings in" : explain(world, z.index).summary,
      cut,
    });
  }
  return out.sort((a, b) => b.deltaProfit - a.deltaProfit).slice(0, count);
}
