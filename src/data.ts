/** Loads the precomputed files in public/data/ (built by scripts/build_zones.py). */
import categories from "../scripts/categories.json";
import type { CategoriesData, ZoneData } from "./sim";

export interface Meta {
  overtureRelease: string;
  built: string;
  counts: Record<string, unknown>;
  attribution: string;
}

export interface GameData {
  zones: ZoneData[];
  geojson: GeoJSON.FeatureCollection;
  /** zone id -> label -> up to 5 real place names */
  examples: Record<string, Record<string, string[]>>;
  meta: Meta;
  categories: CategoriesData;
}

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadGameData(): Promise<GameData> {
  const [zones, geojson, examples, meta] = await Promise.all([
    getJson<{ zones: ZoneData[] }>("zones.json"),
    getJson<GeoJSON.FeatureCollection>("zones.geojson"),
    getJson<GameData["examples"]>("examples.json"),
    getJson<Meta>("meta.json"),
  ]);
  return { zones: zones.zones, geojson, examples, meta, categories: categories as unknown as CategoriesData };
}
