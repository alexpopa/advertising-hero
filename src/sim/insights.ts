/**
 * What the player knows about their product (DESIGN.md 6.13). Easy shows every signal;
 * Normal starts with the product's hints; Hard starts with only the audience line. Two weeks
 * of ads in a neighborhood teaches one new thing: the unknown place type that matters most
 * there (decoys come last, and are revealed as "doesn't matter").
 */
import { labelName } from "./labels";
import { productLabels, roles } from "./world";
import type { Difficulty, ProductData, Role, World } from "./types";

export function initialKnown(product: ProductData, difficulty: Difficulty): string[] {
  if (difficulty === "easy") return productLabels(product);
  return [...(product.hints ?? [])];
}

/** How much a label shapes results in a zone, 0..1-ish; 0 when the zone has none. */
function influence(world: World, zone: number, label: string, role: Role): number {
  const z = world.zones[zone];
  const count = z.data.n[label] ?? 0;
  if (count === 0) return 0;
  const p = world.product;
  const sat = Math.min(1, count / 3);
  switch (role) {
    case "customers":
      return p.demand[label] * (z.fitParts.find((f) => f.label === label)?.pct ?? 0);
    case "stockist":
      return p.stockists[label] * sat;
    case "competitor":
      return p.competitors[label] * sat;
    case "both":
      return Math.max(p.stockists[label], p.competitors[label]) * sat;
    case "decoy":
      return 0.2 * sat;
  }
}

/** The next thing two weeks of ads in this zone teach, or null if there's nothing new here. */
export function nextInsight(world: World, known: string[], zone: number): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const [label, role] of roles(world.product)) {
    if (known.includes(label)) continue;
    const s = influence(world, zone, label, role);
    if (s > bestScore) {
      bestScore = s;
      best = label;
    }
  }
  return best;
}

/** How many labels still matter (or pretend to) that the player hasn't learned. */
export function unknownCount(world: World, known: string[]): number {
  return productLabels(world.product).filter((l) => !known.includes(l)).length;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "Juice bars compete with you: they take sales nearby." */
export function roleSentence(world: World, label: string): string {
  const role = roles(world.product).get(label);
  const name = cap(labelName(label));
  const what = world.product.name.toLowerCase();
  switch (role) {
    case "customers":
      return `${name} are a good sign: your buyers are around them.`;
    case "stockist":
      return `${name} carry ${what}: sales rise near them, and your out-of-home ads work better there.`;
    case "competitor":
      return `${name} compete with you: they take sales nearby.`;
    case "both":
      return `${name} carry ${what}, but they sell rival brands too. They help a little overall.`;
    case "decoy":
      return `${name} don't seem to matter for ${what}.`;
    default:
      return `${name} don't matter for ${what}.`;
  }
}

export const ROLE_TITLES: Record<Role, string> = {
  customers: "Your buyers are near",
  stockist: "Stores that carry you",
  both: "Carry you, but sell rivals too",
  competitor: "Competitors",
  decoy: "Don't matter",
};
