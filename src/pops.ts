/**
 * The little bubbles that pop up over neighborhoods so you can see your ads working:
 * 🙂 leads (people who noticed you today, with a count), 🛍️ orders (with the money), 🎉 the first
 * sale ever, ✓ a neighborhood just added to your plan. Purely visual: nothing here changes
 * the game.
 */
import { awareness, type GameState, type World } from "./sim";

export type PopKind = "lead" | "order" | "first" | "added";

export interface Pop {
  id: number;
  zone: number;
  kind: PopKind;
  text?: string;
  /** Milliseconds to wait before showing it, so a day's pops are spread out. */
  delay: number;
}

let nextId = 1;
export const popId = () => nextId++;

/**
 * Most bubbles per day across the whole map, so it never turns into confetti soup. Bubbles
 * live ~2 seconds, so at faster speeds several days overlap: fewer per day.
 */
const maxPerDay = (dayMs: number) => (dayMs >= 2500 ? 12 : dayMs >= 1200 ? 8 : 5);
/** Share of each day's bubbles that go to leads (the rest to orders), so 🙂 outnumber 🛍️. */
const LEAD_SHARE = 0.65;
/**
 * Leads are the top of the funnel: people who noticed you today. Most don't buy that day,
 * so a zone makes about this many leads per order...
 */
const LEADS_PER_ORDER = 3;
/** ...plus extra while a campaign is still building awareness (per point of awareness gained). */
const LEADS_PER_AWARENESS_POINT = 2;

/**
 * Pops for the day that just happened (`after` is one day past `before`), spread over
 * `dayMs` so they arrive while the next day ticks by. A zone shows at most one 🙂 (with
 * how many people noticed you) and one 🛍️ (with the day's sales) per day.
 */
export function popsForDay(world: World, before: GameState, after: GameState, dayMs: number): Pop[] {
  const spread = () => Math.random() * dayMs * 0.85;
  const orders: { pop: Pop; weight: number }[] = [];
  const leads: { pop: Pop; weight: number }[] = [];
  const value = world.product.orderValue;

  for (const z of world.zones) {
    const i = z.index;
    const cust = after.lastDay.customers[i];
    const gain = Math.max(0, awareness(after, i) - awareness(before, i)) * 100;
    const noticed = cust * LEADS_PER_ORDER + (after.levels[i] > 0 ? gain * LEADS_PER_AWARENESS_POINT : 0);
    if (noticed >= 1)
      leads.push({ pop: { id: popId(), zone: i, kind: "lead", text: `+${Math.round(noticed)}`, delay: spread() }, weight: noticed });
    if (cust >= 0.3 && Math.random() < Math.min(1, cust))
      orders.push({
        pop: { id: popId(), zone: i, kind: "order", text: `+$${Math.max(1, Math.round(cust * value))}`, delay: spread() },
        weight: cust,
      });
  }

  // The busiest zones get their bubbles first; leads take most of the slots.
  const max = maxPerDay(dayMs);
  const byWeight = (a: { weight: number }, b: { weight: number }) => b.weight - a.weight;
  const leadSlots = Math.min(leads.length, Math.ceil(max * LEAD_SHARE));
  const orderSlots = Math.min(orders.length, max - leadSlots, Math.max(0, leadSlots - 1) || 1);
  const pops = [
    ...leads.sort(byWeight).slice(0, leadSlots).map((x) => x.pop),
    ...orders.sort(byWeight).slice(0, orderSlots).map((x) => x.pop),
  ];

  // The very first sale of the run gets its own celebration, in the zone that sold most.
  const soldBefore = before.history.reduce((a, h) => a + h.customers, 0);
  const soldNow = after.lastDay.customers.reduce((a, c) => a + c, 0);
  if (soldBefore < 0.3 && soldNow >= 0.3) {
    const top = after.lastDay.customers.indexOf(Math.max(...after.lastDay.customers));
    pops.push({ id: popId(), zone: top, kind: "first", text: "First sale!", delay: 0 });
  }
  return pops;
}
