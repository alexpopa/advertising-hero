/**
 * What the map colors the neighborhoods by: nothing, the fit score (Easy only), or how
 * many places of one or more Overture categories a neighborhood has per km2. Several
 * categories are added together ("beauty stores + pharmacies"), so a player can map
 * everywhere their product sells.
 */
import { labelName, type World } from "./sim";
import { SCORE_BINS } from "./scale";

export type MapLayer = { kind: "none" } | { kind: "fit" } | { kind: "places"; labels: string[] };

/** Saved games from before multi-select stored a single `label`. */
export function normalizeLayer(l: unknown): MapLayer | undefined {
  const x = l as { kind?: string; label?: string; labels?: string[] } | undefined;
  if (!x?.kind) return undefined;
  if (x.kind === "places") {
    const labels = x.labels ?? (x.label ? [x.label] : []);
    return labels.length ? { kind: "places", labels } : { kind: "none" };
  }
  return x.kind === "fit" ? { kind: "fit" } : { kind: "none" };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "Gyms", "Beauty stores + pharmacies", "4 kinds of places". */
export function layerName(layer: MapLayer, world: World): string {
  if (layer.kind === "fit") return `Fit for ${world.product.name.toLowerCase()}`;
  if (layer.kind === "none") return "";
  const names = layer.labels.map((l) => labelName(l));
  return names.length > 3 ? `${names.length} kinds of places` : cap(names.join(" + "));
}

export interface Bin {
  color: string;
  label: string;
}

export interface ZonePaint {
  color: string;
  opacity: number;
}

export interface LayerView {
  title: string;
  /** Legend steps, light to dark. Empty when nothing is shown. */
  bins: Bin[];
  /** Shown before the bins when some neighborhoods have none. */
  noneBin?: Bin;
  /** Per zone index. */
  paint: ZonePaint[];
  /** One line for the hover tooltip, per zone index. */
  describe: (zone: number) => string | null;
}

/**
 * Place density steps: one orange hue, light to dark, so it never reads as the blue fit
 * score. Validated as an ordinal ramp (monotone lightness, visible gaps, light end >= 2:1).
 */
const PLACE_COLORS = ["#f09d72", "#e5612c", "#b8451a", "#7f2d0f"];
const NONE_COLOR = "#d6d5d0";
const FILL_OPACITY = 0.85;

const fmt = (n: number) => (n >= 10 ? Math.round(n).toString() : n >= 1 ? n.toFixed(1) : n.toFixed(2));

/** Total count of a label across the city, for the picker. */
export function cityCount(world: World, label: string): number {
  return world.zones.reduce((a, z) => a + (z.data.n[label] ?? 0), 0);
}

export function layerView(world: World, layer: MapLayer): LayerView {
  const blank: ZonePaint = { color: NONE_COLOR, opacity: 0 };

  if (layer.kind === "fit") {
    return {
      title: `Fit for ${world.product.name.toLowerCase()}`,
      bins: SCORE_BINS.map((b) => ({ color: b.color, label: `${b.min}–${b.max} ${b.label}` })),
      paint: world.zones.map((z) => ({
        color: (SCORE_BINS.find((b) => z.score <= b.max) ?? SCORE_BINS[SCORE_BINS.length - 1]).color,
        opacity: FILL_OPACITY,
      })),
      describe: (i) => `Score ${world.zones[i].score}/100`,
    };
  }

  if (layer.kind === "none") {
    return { title: "", bins: [], paint: world.zones.map(() => blank), describe: () => null };
  }

  const { labels } = layer;
  const per = world.zones.map((z) => labels.map((l) => z.data.n[l] ?? 0));
  const counts = per.map((c) => c.reduce((a, b) => a + b, 0));
  const density = world.zones.map((z, i) => (z.data.area > 0 ? counts[i] / z.data.area : 0));

  // Quartiles of the neighborhoods that have any, so each step holds about a quarter of
  // them. Rare categories can't fill four distinct steps, so duplicate breaks collapse.
  const nonzero = density.filter((d) => d > 0).sort((a, b) => a - b);
  const breaks: number[] = [];
  for (const q of [0.25, 0.5, 0.75]) {
    const v = nonzero[Math.floor(q * nonzero.length)];
    if (v !== undefined && v > (breaks[breaks.length - 1] ?? nonzero[0] ?? 0)) breaks.push(v);
  }
  // Color steps spread across the ramp so 2 or 3 steps still run light to dark.
  const nSteps = nonzero.length ? breaks.length + 1 : 0;
  const colorAt = (step: number) =>
    PLACE_COLORS[nSteps <= 1 ? PLACE_COLORS.length - 1 : Math.round((step * (PLACE_COLORS.length - 1)) / (nSteps - 1))];
  const stepOf = (d: number) => breaks.filter((b) => d >= b).length;

  const bins: Bin[] = [];
  for (let s = 0; s < nSteps; s++) {
    const lo = s === 0 ? nonzero[0] : breaks[s - 1];
    const hi = s === nSteps - 1 ? nonzero[nonzero.length - 1] : breaks[s];
    bins.push({ color: colorAt(s), label: s === nSteps - 1 ? `${fmt(lo)}+` : `${fmt(lo)}–${fmt(hi)}` });
  }

  return {
    title: `${layerName(layer, world)} per km²`,
    bins,
    noneBin: nonzero.length < world.zones.length ? { color: NONE_COLOR, label: "None" } : undefined,
    paint: density.map((d) => (d > 0 ? { color: colorAt(stepOf(d)), opacity: FILL_OPACITY } : { color: NONE_COLOR, opacity: 0.55 })),
    describe: (i) =>
      counts[i] === 0
        ? labels.length === 1
          ? `No ${labelName(labels[0])}`
          : "None of these"
        : `${labels
            .map((l, j) => `${per[i][j]} ${labelName(l, per[i][j])}`)
            .filter((_, j) => labels.length === 1 || per[i][j] > 0)
            .join(", ")} · ${fmt(density[i])} per km²`,
  };
}
