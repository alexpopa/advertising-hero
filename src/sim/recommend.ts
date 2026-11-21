/**
 * Easy-mode suggestions (DESIGN.md 6.7): the best one-step ad changes by estimated
 * steady-state profit. The UI only shows these on Easy; the economy is the same on Hard.
 */
import { explain } from "./explain";
import { levelCost } from "./world";
import { LEVEL_NAMES, type GameState, type Level, type World } from "./types";

export interface Recommendation {
  zone: number;
  zoneName: string;
  from: Level;
  to: Level;
  /** Estimated change in profit per day once the change has fully taken effect. */
  deltaProfit: number;
  /** Ad cost per day at the new level. */
  costPerDay: number;
  /** "Medium ads in Mission" / "Cut High ads in Marina to Medium" */
  title: string;
  reason: string;
}

export function recommend(world: World, state: GameState, count = 5): Recommendation[] {
  const out: Recommendation[] = [];
  for (const z of world.zones) {
    const from = state.levels[z.index];
    for (const to of [from - 1, from + 1] as Level[]) {
      if (to < 0 || to > 3) continue;
      const deltaProfit = z.steadyProfit[to] - z.steadyProfit[from];
      if (deltaProfit <= 0.5) continue;
      const cut = to < from;
      out.push({
        zone: z.index,
        zoneName: z.name,
        from,
        to,
        deltaProfit,
        costPerDay: levelCost(z.price, to),
        title: cut
          ? to === 0
            ? `Stop ads in ${z.name}`
            : `Cut ${z.name} from ${LEVEL_NAMES[from]} to ${LEVEL_NAMES[to]}`
          : from === 0
            ? `${LEVEL_NAMES[to]} ads in ${z.name}`
            : `Raise ${z.name} from ${LEVEL_NAMES[from]} to ${LEVEL_NAMES[to]}`,
        reason: cut ? "Costs more than it brings in" : explain(world, z.index).summary,
      });
    }
  }
  return out.sort((a, b) => b.deltaProfit - a.deltaProfit).slice(0, count);
}
