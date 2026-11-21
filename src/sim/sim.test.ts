import { describe, expect, it } from "vitest";
import zonesFile from "../../public/data/zones.json";
import categories from "../../scripts/categories.json";
import {
  C,
  buildWorld,
  explain,
  initGame,
  percentiles,
  reach,
  recommend,
  steadyPressure,
  step,
  type Action,
  type CategoriesData,
  type GameState,
  type Level,
  type World,
  type ZoneData,
} from "./index";

const ZONES = (zonesFile as unknown as { zones: ZoneData[] }).zones;
const CATS = categories as unknown as CategoriesData;
const PRODUCTS = Object.keys(CATS.products);

function run(world: World, state: GameState, days: number, actions: Action[] = []): GameState {
  let s = step(world, state, actions);
  for (let d = 1; d < days; d++) s = step(world, s);
  return s;
}
const setAll = (world: World, level: Level): Action[] =>
  world.zones.map((z) => ({ type: "setLevel", zone: z.index, level }));

describe("data", () => {
  it("loads the zones built from Overture", () => {
    expect(ZONES.length).toBeGreaterThan(30);
    expect(ZONES.every((z) => z.area > 0 && z.floorArea >= 0)).toBe(true);
  });

  it("neighbors are symmetric", () => {
    const byId = new Map(ZONES.map((z) => [z.id, z]));
    for (const z of ZONES) for (const nb of z.neighbors) expect(byId.get(nb)!.neighbors).toContain(z.id);
  });
});

describe("percentiles", () => {
  it("ranks 0..1 with ties averaged", () => {
    expect(percentiles([10, 20, 30])).toEqual([0, 0.5, 1]);
    expect(percentiles([5, 5, 10])).toEqual([0.25, 0.25, 1]);
  });

  it("can treat zero as no signal", () => {
    expect(percentiles([0, 0, 3, 4], true)).toEqual([0, 0, 2 / 3, 1]);
  });
});

describe("reach", () => {
  it("rises with spend, with diminishing returns per dollar", () => {
    const r = ([1, 2, 3] as Level[]).map((l) => reach(steadyPressure(l)));
    expect(r[0]).toBeLessThan(r[1]);
    expect(r[1]).toBeLessThan(r[2]);
    expect(r[2]).toBeLessThan(1);
    const perDollar = r.map((x, i) => x / C.levelMult[i + 1]);
    expect(perDollar[0]).toBeGreaterThan(perDollar[1]);
    expect(perDollar[1]).toBeGreaterThan(perDollar[2]);
  });

  it("matches the design's steady-state figures (Low ~46%, Medium ~71%, High ~92%)", () => {
    expect(reach(steadyPressure(1))).toBeCloseTo(0.46, 2);
    expect(reach(steadyPressure(2))).toBeCloseTo(0.71, 2);
    expect(reach(steadyPressure(3))).toBeCloseTo(0.92, 2);
  });
});

describe("world", () => {
  it.each(PRODUCTS)("%s: calibrated so perfect play makes the target profit per day", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    const perfect = w.zones.reduce((a, z) => a + Math.max(0, ...z.steadyProfit), 0) - C.fixedOverhead;
    expect(perfect).toBeCloseTo(C.perfectDailyProfit, 0);
  });

  it.each(PRODUCTS)("%s: some zones are worth advertising in and some aren't", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    const good = w.zones.filter((z) => Math.max(...z.steadyProfit.slice(1)) > 0).length;
    expect(good).toBeGreaterThan(w.zones.length * 0.1);
    expect(good).toBeLessThan(w.zones.length * 0.6);
  });

  it("scores are 0..100 with both ends used", () => {
    const w = buildWorld(ZONES, CATS, "cold_brew");
    const scores = w.zones.map((z) => z.score);
    expect(Math.min(...scores)).toBe(0);
    expect(Math.max(...scores)).toBe(100);
  });

  it("competition lowers potential", () => {
    const base: ZoneData = {
      id: "a", name: "A", hexes: 1, center: [0, 0], area: 1, floorArea: 600_000, buildings: 100,
      transit: 5, nAll: 100, n: { gym: 10 }, nBranded: {}, neighbors: [],
    };
    const zones = [
      base,
      { ...base, id: "b", name: "B", n: { gym: 10, sporting_goods_store: 8 } },
      { ...base, id: "c", name: "C", n: { gym: 10, sporting_goods_store: 8 }, nBranded: { sporting_goods_store: 8 } },
    ];
    const w = buildWorld(zones, CATS, "supplements");
    expect(w.zones[1].pmax).toBeLessThan(w.zones[0].pmax);
    // Chains count extra.
    expect(w.zones[2].pmax).toBeLessThan(w.zones[1].pmax);
  });

  it("rejects an unknown product", () => {
    expect(() => buildWorld(ZONES, CATS, "nope")).toThrow();
  });
});

describe("game", () => {
  const world = buildWorld(ZONES, CATS, "supplements");
  const best = [...world.zones].sort((a, b) => b.steadyProfit[2] - a.steadyProfit[2])[0];

  it("starts with the starting cash on day 0, nothing running", () => {
    const s = initGame(world, 1);
    expect(s.cash).toBe(C.startCash);
    expect(s.day).toBe(0);
    expect(s.levels.every((l) => l === 0)).toBe(true);
    expect(s.difficulty).toBe("hard");
  });

  it("doing nothing just pays the fixed overhead", () => {
    const s = run(world, initGame(world, 1), 5);
    expect(s.cash).toBeCloseTo(C.startCash - 5 * C.fixedOverhead, 6);
    expect(s.history.every((d) => d.revenue === 0 && d.adSpend === 0)).toBe(true);
  });

  it("ads build up over days, then fade a fixed share each day after stopping", () => {
    const on = run(world, initGame(world, 2), 10, [{ type: "setLevel", zone: best.index, level: 2 }]);
    const cust = on.history.map((d) => d.customers);
    expect(cust[9]).toBeGreaterThan(cust[0]);
    const off1 = step(world, on, [{ type: "setLevel", zone: best.index, level: 0 }]);
    expect(off1.pressure[best.index]).toBeCloseTo(on.pressure[best.index] * C.adDecay, 9);
    const off5 = run(world, off1, 4);
    expect(off5.pressure[best.index]).toBeCloseTo(on.pressure[best.index] * C.adDecay ** 5, 9);
    expect(off5.lastDay.customers[best.index]).toBeLessThan(on.lastDay.customers[best.index]);
    expect(off5.lastDay.adSpend[best.index]).toBe(0);
  });

  it("ads spill over into neighbors only", () => {
    const z = world.zones.find((x) => x.neighbors.length > 0)!;
    const s = step(world, initGame(world, 3), [{ type: "setLevel", zone: z.index, level: 3 }]);
    for (const other of world.zones) {
      if (other.index === z.index) continue;
      if (z.neighbors.includes(other.index)) expect(s.pressure[other.index]).toBeCloseTo(C.spillover * 4, 9);
      else expect(s.pressure[other.index]).toBe(0);
    }
  });

  it("good zones pay off: Medium in the best zone beats doing nothing", () => {
    const idle = run(world, initGame(world, 4), 30);
    const ads = run(world, initGame(world, 4), 30, [{ type: "setLevel", zone: best.index, level: 2 }]);
    expect(ads.cash).toBeGreaterThan(idle.cash);
  });

  it("goes bankrupt after 3 days below $0, not before", () => {
    let s = run(world, initGame(world, 5), 1, setAll(world, 3));
    while (s.status === "playing" && s.cash >= 0) s = step(world, s);
    expect(s.status).toBe("playing");
    expect(s.daysBelowZero).toBe(1);
    s = run(world, s, 2);
    expect(s.status).toBe("bankrupt");
    expect(step(world, s)).toBe(s);
  });

  it("finishes after day 90 and then stops", () => {
    const s = run(world, initGame(world, 6), C.days, [{ type: "setLevel", zone: best.index, level: 2 }]);
    expect(s.day).toBe(C.days);
    expect(s.history).toHaveLength(C.days);
    expect(["finished", "bankrupt"]).toContain(s.status);
    expect(step(world, s)).toBe(s);
  });

  it("the same seed gives the same run; a different seed doesn't", () => {
    const plan: Action[] = [
      { type: "setLevel", zone: best.index, level: 2 },
      { type: "setLevel", zone: world.zones[0].index, level: 1 },
    ];
    const a = run(world, initGame(world, 42), 60, plan);
    const b = run(world, initGame(world, 42), 60, plan);
    const c = run(world, initGame(world, 43), 60, plan);
    expect(a).toEqual(b);
    expect(a.cash).not.toBe(c.cash);
  });

  it("survives a save/load round trip through JSON (localStorage)", () => {
    const plan: Action[] = [{ type: "setLevel", zone: best.index, level: 2 }];
    const mid = run(world, initGame(world, 7), 20, plan);
    const restored = JSON.parse(JSON.stringify(mid)) as GameState;
    expect(run(world, restored, 20)).toEqual(run(world, mid, 20));
  });

  it("events happen every 8-12 days", () => {
    const s = run(world, initGame(world, 8), C.days, [{ type: "setLevel", zone: best.index, level: 2 }]);
    const days = s.eventLog.map((e) => e.day);
    expect(days.length).toBeGreaterThanOrEqual(6);
    expect(days[0]).toBeGreaterThanOrEqual(C.eventGapMin);
    for (let i = 1; i < days.length; i++) {
      expect(days[i] - days[i - 1]).toBeGreaterThanOrEqual(C.eventGapMin);
      expect(days[i] - days[i - 1]).toBeLessThanOrEqual(C.eventGapMax);
    }
  });
});

describe("balance guards (DESIGN.md 8 targets)", () => {
  const best = (z: World["zones"][number]) => {
    const m = Math.max(...z.steadyProfit);
    return (m > 0 ? z.steadyProfit.indexOf(m) : 0) as Level;
  };
  it.each(PRODUCTS)("%s: smart play wins, blanketing the city goes bankrupt, nobody is rich by day 20", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    const perfect = run(w, initGame(w, 12), C.days, w.zones.map((z) => ({ type: "setLevel", zone: z.index, level: best(z) })));
    const blanket = run(w, initGame(w, 12), C.days, setAll(w, 1));
    expect(perfect.status).toBe("finished");
    expect(perfect.cash).toBeGreaterThan(C.startCash * 5);
    expect(perfect.history[19].cash).toBeLessThan(C.startCash * 4);
    expect(blanket.status).toBe("bankrupt");
  });
});

describe("recommendations (Easy mode)", () => {
  it.each(PRODUCTS)("%s: never suggest a change that lowers estimated profit", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    let s = initGame(w, 9, "easy");
    for (let i = 0; i < 15; i++) {
      const recs = recommend(w, s);
      expect(recs.length).toBeLessThanOrEqual(5);
      for (const r of recs) {
        expect(r.deltaProfit).toBeGreaterThan(0);
        expect(Math.abs(r.to - r.from)).toBe(1);
      }
      if (!recs.length) break;
      s = step(w, s, [{ type: "setLevel", zone: recs[0].zone, level: recs[0].to }]);
    }
  });

  it("suggests cutting a money-losing campaign", () => {
    const w = buildWorld(ZONES, CATS, "supplements");
    const worst = [...w.zones].sort((a, b) => a.steadyProfit[3] - b.steadyProfit[3])[0];
    const s = { ...initGame(w, 10), levels: w.zones.map((z) => (z.index === worst.index ? 3 : 0)) as Level[] };
    const cut = recommend(w, s, 100).find((r) => r.zone === worst.index);
    expect(cut?.to).toBe(2);
  });

  it("following them beats doing nothing", () => {
    const w = buildWorld(ZONES, CATS, "pet_food");
    let s = initGame(w, 11, "easy");
    while (s.status === "playing") {
      const r = recommend(w, s, 1)[0];
      s = step(w, s, r && s.day % 3 === 0 ? [{ type: "setLevel", zone: r.zone, level: r.to }] : []);
    }
    expect(s.status).toBe("finished");
    expect(s.cash).toBeGreaterThan(C.startCash);
  });
});

describe("explanations", () => {
  it.each(PRODUCTS)("%s: every zone gets readable lines", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    for (const z of w.zones) {
      const e = explain(w, z.index);
      for (const line of [e.fitLine, e.competitionLine, e.priceLine, e.peopleLine, e.summary]) {
        expect(line.length).toBeGreaterThan(2);
        expect(line).not.toMatch(/undefined|NaN|_/);
      }
    }
  });
});
