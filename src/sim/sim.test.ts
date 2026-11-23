import { describe, expect, it } from "vitest";
import zonesFile from "../../public/data/zones.json";
import categories from "../../scripts/categories.json";
import {
  C,
  buildWorld,
  estimate,
  explain,
  hasName,
  initGame as initGameAlone,
  isOn,
  OFF,
  fixedCosts,
  hire,
  openShop,
  shopCost,
  shopRent,
  shopsIn,
  shopGain,
  salaries,
  estimateAt,
  nextHire,
  allowed,
  hireGain,
  labelName,
  percentiles,
  productLabels,
  reach,
  recommend,
  roles,
  steadyPressure,
  step,
  keepPlaying,
  adCostPerDay,
  awareness,
  type Action,
  type CategoriesData,
  type GameState,
  type Level,
  type Plan,
  type World,
  type ZoneData,
} from "./index";

/**
 * Most tests check the ad economy itself, so they start with the whole team hired (every
 * channel and level open). Tests of the team and shops use initGameAlone.
 */
const FULL_TEAM = { ooh: 3, digital: 3 } as const;
const initGame: typeof initGameAlone = (w, seed, d) => ({ ...initGameAlone(w, seed, d), staff: { ...FULL_TEAM } });

const ZONES = (zonesFile as unknown as { zones: ZoneData[] }).zones;
const CATS = categories as unknown as CategoriesData;
const PRODUCTS = Object.keys(CATS.products);

function run(world: World, state: GameState, days: number, actions: Action[] = []): GameState {
  let s = step(world, state, actions);
  for (let d = 1; d < days; d++) s = step(world, s);
  return s;
}
/** Tests of the ad economy with lots of cash: the loan counts as already paid, so the run doesn't end on day 1. */
const noLoan = (s: GameState): GameState => ({ ...s, paidDay: 0, endless: true });
/** Out-of-home ads at a level in every zone. */
const setAll = (world: World, level: Level): Action[] =>
  world.zones.map((z) => ({ type: "setPlan", zone: z.index, plan: { ooh: level } }));
/** Out-of-home ads at a level in one zone. */
const ooh = (zone: number, level: Level): Action => ({ type: "setPlan", zone, plan: { ooh: level } });
const apply = (zone: number, p: Plan): Action[] => [{ type: "setPlan", zone, plan: p }];
/** Profit per zone with out-of-home ads, at each level. */
const oohAt = (z: World["zones"][number]) => z.est.map((row) => row[0].profit);

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
  it.each(PRODUCTS)("%s: calibrated so perfect play makes the target profit per day (before the sales boost)", (key) => {
    const w = buildWorld(ZONES, CATS, key, 1);
    const perfect = w.zones.reduce((a, z) => a + Math.max(0, z.bestProfit), 0) - C.calibrationOverhead;
    expect(perfect).toBeCloseTo(C.perfectDailyProfit, 0);
  });

  it.each(PRODUCTS)("%s: some zones are worth advertising in and some aren't", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    const good = w.zones.filter((z) => z.bestProfit > 0).length;
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
  const best = [...world.zones].sort((a, b) => oohAt(b)[2] - oohAt(a)[2])[0];

  it("starts with the starting cash on day 0, nothing running", () => {
    const s = initGame(world, 1);
    expect(s.cash).toBe(C.startCash);
    expect(s.day).toBe(0);
    expect(s.plans.every((p) => !isOn(p))).toBe(true);
    expect(s.difficulty).toBe("hard");
    expect(s.known).toEqual(world.product.hints ?? []);
  });

  it("doing nothing just pays the fixed overhead", () => {
    const s = run(world, initGame(world, 1), 5);
    expect(s.cash).toBeCloseTo(C.startCash - 5 * fixedCosts(world, s), 6);
    expect(s.history.every((d) => d.revenue === 0 && d.adSpend === 0)).toBe(true);
  });

  it("ads build up over days, then fade a fixed share each day after stopping", () => {
    const on = run(world, initGame(world, 2), 10, [ooh(best.index, 2)]);
    const cust = on.history.map((d) => d.customers);
    expect(cust[9]).toBeGreaterThan(cust[0]);
    const off1 = step(world, on, [ooh(best.index, 0)]);
    expect(off1.pressure[best.index]).toBeCloseTo(on.pressure[best.index] * C.adDecay, 9);
    const off5 = run(world, off1, 4);
    expect(off5.pressure[best.index]).toBeCloseTo(on.pressure[best.index] * C.adDecay ** 5, 9);
    expect(off5.lastDay.customers[best.index]).toBeLessThan(on.lastDay.customers[best.index]);
    expect(off5.lastDay.adSpend[best.index]).toBe(0);
  });

  it("ads spill over into neighbors only", () => {
    const z = world.zones.find((x) => x.neighbors.length > 0)!;
    const s = step(world, initGame(world, 3), [ooh(z.index, 3)]);
    for (const other of world.zones) {
      if (other.index === z.index) continue;
      if (z.neighbors.includes(other.index)) expect(s.pressure[other.index]).toBeCloseTo(C.spillover * 4, 9);
      else expect(s.pressure[other.index]).toBe(0);
    }
  });

  it("good zones pay off: Medium in the best zone beats doing nothing", () => {
    const idle = run(world, initGame(world, 4), 30);
    const ads = run(world, initGame(world, 4), 30, [ooh(best.index, 2)]);
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

  it("finishes after the last day and then stops", () => {
    // Too little to repay the loan: the deadline ends it.
    const s = run(world, { ...initGame(world, 6), cash: 1e5 }, C.days, [ooh(best.index, 2)]);
    expect(s.day).toBe(C.days);
    expect(s.history).toHaveLength(C.days);
    expect(["finished", "bankrupt"]).toContain(s.status);
    expect(step(world, s)).toBe(s);
  });

  it("the same seed gives the same run; a different seed doesn't", () => {
    const plan: Action[] = [
      ooh(best.index, 2),
      ooh(world.zones[0].index, 1),
    ];
    const a = run(world, initGame(world, 42), 60, plan);
    const b = run(world, initGame(world, 42), 60, plan);
    const c = run(world, initGame(world, 43), 60, plan);
    expect(a).toEqual(b);
    expect(a.cash).not.toBe(c.cash);
  });

  it("survives a save/load round trip through JSON (localStorage)", () => {
    const plan: Action[] = [ooh(best.index, 2)];
    const mid = run(world, initGame(world, 7), 20, plan);
    const restored = JSON.parse(JSON.stringify(mid)) as GameState;
    expect(run(world, restored, 20)).toEqual(run(world, mid, 20));
  });

  it("ad costs never change from day to day (no random price events)", () => {
    const s = run(world, initGame(world, 8), 60, [ooh(best.index, 2)]);
    const spend = s.history.map((d) => d.adSpend);
    expect(Math.max(...spend) - Math.min(...spend)).toBeLessThan(1e-9);
  });
});

describe("balance guards (DESIGN.md 8 targets)", () => {
  it.each(PRODUCTS)("%s: smart play wins, blanketing the city goes bankrupt, nobody is rich by day 20", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    const perfect = run(w, initGame(w, 12), C.days, w.zones.flatMap((z) => apply(z.index, z.best)));
    const blanket = run(w, initGame(w, 12), C.days, setAll(w, 1));
    expect(perfect.status).toBe("paid");
    expect(perfect.cash + C.loan).toBeGreaterThan(C.startCash * 5);
    expect(perfect.history[19].cash).toBeLessThan(C.startCash * 4);
    expect(blanket.status).toBe("bankrupt");
  });
});

describe("products", () => {
  it("there are about 20, in groups", () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(PRODUCTS.map((k) => CATS.products[k].group)).size).toBeGreaterThanOrEqual(4);
  });

  it.each(PRODUCTS)("%s: well-formed (a decoy, hints that matter, every label in the data and on the map)", (key) => {
    const p = CATS.products[key];
    const r = roles(p);
    expect(p.decoys.length).toBeGreaterThan(0);
    for (const d of p.decoys) expect(r.get(d)).toBe("decoy");
    for (const h of p.hints) expect(["customers", "stockist", "competitor", "both"]).toContain(r.get(h));
    const onMap = new Set((CATS.layers ?? []).flatMap((g) => g.labels));
    for (const l of productLabels(p)) {
      expect(ZONES.reduce((a, z) => a + (z.n[l] ?? 0), 0), l).toBeGreaterThan(0);
      expect(onMap.has(l), l).toBe(true);
      expect(hasName(l), l).toBe(true);
    }
  });

  it("every map layer has a plain-English name", () => {
    for (const g of CATS.layers ?? []) for (const l of g.labels) expect(hasName(l), l).toBe(true);
  });
});

describe("stockists and ad formats", () => {
  const base: ZoneData = {
    id: "a", name: "A", hexes: 1, center: [0, 0], area: 1, floorArea: 600_000, buildings: 100,
    transit: 5, nAll: 100, n: { gym: 10 }, nBranded: {}, neighbors: [],
  };

  it("stockists raise potential and make out-of-home ads stronger", () => {
    const zones = [base, { ...base, id: "b", name: "B", n: { gym: 10, pharmacy_and_drug_store: 6 } }];
    const w = buildWorld(zones, CATS, "supplements");
    expect(w.zones[1].stockFactor).toBeGreaterThan(1);
    expect(w.zones[1].pmax).toBeGreaterThan(w.zones[0].pmax);
    expect(w.zones[1].formatEff.ooh).toBeGreaterThan(w.zones[0].formatEff.ooh);
  });

  it("digital ads are stronger where your buyers' places are dense", () => {
    const zones: ZoneData[] = [
      { ...base, n: {} },
      { ...base, id: "b", name: "B", n: { gym: 2 } },
      { ...base, id: "c", name: "C", n: { gym: 20 } },
    ];
    const w = buildWorld(zones, CATS, "supplements");
    expect(w.zones[1].formatEff.digital).toBeGreaterThan(w.zones[0].formatEff.digital);
    expect(w.zones[2].formatEff.digital).toBeGreaterThan(w.zones[1].formatEff.digital);
  });

  it("both channels stay within their ranges", () => {
    for (const key of PRODUCTS)
      for (const z of buildWorld(ZONES, CATS, key).zones)
        for (const ch of ["ooh", "digital"] as const) {
          expect(z.formatEff[ch]).toBeGreaterThanOrEqual(C.formats[ch].effMin);
          expect(z.formatEff[ch]).toBeLessThanOrEqual(C.formats[ch].effMin + C.formats[ch].effSpan);
        }
  });

  it("digital ads have no busy-area premium: cheaper than out-of-home in busy areas", () => {
    const w = buildWorld(ZONES, CATS, "pet_food");
    const busiest = [...w.zones].sort((a, b) => b.busyness - a.busyness)[0];
    expect(busiest.priceDigital).toBeLessThan(busiest.price);
  });

  it("digital ads follow the fit; out-of-home ads follow busyness", () => {
    const w = buildWorld(ZONES, CATS, "supplements");
    const byFit = [...w.zones].sort((a, b) => b.fit - a.fit);
    expect(byFit[0].formatEff.digital).toBeGreaterThan(byFit[byFit.length - 1].formatEff.digital);
    const byBusy = [...w.zones].sort((a, b) => b.busyness - a.busyness);
    expect(byBusy[0].formatEff.ooh).toBeGreaterThan(byBusy[byBusy.length - 1].formatEff.ooh);
  });

  it("out-of-home, digital and both each win somewhere", () => {
    const won = new Set<string>();
    for (const key of PRODUCTS)
      for (const z of buildWorld(ZONES, CATS, key).zones)
        if (isOn(z.best)) won.add(z.best.ooh && z.best.digital ? "both" : z.best.ooh ? "ooh" : "digital");
    expect([...won].sort()).toEqual(["both", "digital", "ooh"]);
  });

  it("each channel's level is chosen separately, and mixed levels win somewhere", () => {
    const mixed = PRODUCTS.flatMap((key) => buildWorld(ZONES, CATS, key).zones).filter(
      (z) => z.best.ooh > 0 && z.best.digital > 0 && z.best.ooh !== z.best.digital,
    );
    expect(mixed.length).toBeGreaterThan(0);
  });

  it("running both costs both, and never brings fewer customers than either alone", () => {
    const prices = { ooh: 10, digital: 7 };
    for (const a of [1, 2, 3] as Level[])
      for (const b of [1, 2, 3] as Level[])
        expect(adCostPerDay(prices, { ooh: a, digital: b })).toBeCloseTo(
          adCostPerDay(prices, { ooh: a, digital: 0 }) + adCostPerDay(prices, { ooh: 0, digital: b }),
          9,
        );
    for (const key of PRODUCTS)
      for (const z of buildWorld(ZONES, CATS, key).zones)
        for (const a of [1, 2, 3] as Level[])
          for (const b of [1, 2, 3] as Level[]) {
            const both = estimate(z, { ooh: a, digital: b }).customers;
            expect(both).toBeGreaterThanOrEqual(estimate(z, { ooh: a, digital: 0 }).customers);
            expect(both).toBeGreaterThanOrEqual(estimate(z, { ooh: 0, digital: b }).customers);
          }
  });

  it("digital ads don't spill into neighbors; out-of-home ads do", () => {
    const w = buildWorld(ZONES, CATS, "pet_food");
    const z = w.zones.find((x) => x.neighbors.length > 0)!;
    const s = step(w, initGame(w, 3), apply(z.index, { ooh: 2, digital: 2 }));
    expect(s.pressure[z.index]).toBeCloseTo(C.levelMult[2], 9);
    expect(s.pressureDigital[z.index]).toBeCloseTo(C.levelMult[2] * C.digitalPressureScale, 9);
    expect(s.pressure[z.neighbors[0]]).toBeGreaterThan(0);
    expect(s.pressureDigital[z.neighbors[0]]).toBe(0);
    expect(awareness(s, z.index)).toBeGreaterThan(awareness({ ...s, pressureDigital: s.pressureDigital.map(() => 0) }, z.index));
  });

  it("digital builds and fades faster than out-of-home, to the same full strength", () => {
    const w = buildWorld(ZONES, CATS, "pet_food");
    const z = w.zones.find((x) => x.neighbors.length > 0)!;
    const share = (s: ReturnType<typeof initGame>) => [
      reach(s.pressure[z.index]) / reach(steadyPressure(2)),
      reach(s.pressureDigital[z.index]) / reach(steadyPressure(2)),
    ];
    const on = run(w, noLoan({ ...initGame(w, 3), cash: 1e9 }), 10, apply(z.index, { ooh: 2, digital: 2 }));
    const [ooh10, dig10] = share(on);
    expect(dig10).toBeGreaterThan(0.85);
    expect(ooh10).toBeLessThan(0.75);
    // Same full strength once both have built up.
    const full = run(w, on, 100);
    expect(reach(full.pressureDigital[z.index])).toBeCloseTo(reach(steadyPressure(2)), 3);
    // Stopping: digital is mostly gone after 10 days, out-of-home lingers.
    const off = run(w, full, 10, apply(z.index, { ooh: 0, digital: 0 }));
    const [oohOff, digOff] = [reach(off.pressure[z.index]) / reach(full.pressure[z.index]), reach(off.pressureDigital[z.index]) / reach(full.pressureDigital[z.index])];
    expect(digOff).toBeLessThan(oohOff);
  });

  it("the sim charges what the estimate says", () => {
    const w = buildWorld(ZONES, CATS, "cold_brew");
    const z = [...w.zones].sort((a, b) => b.bestProfit - a.bestProfit)[0];
    const plan: Plan = { ooh: 2, digital: 0 };
    const s = run(w, initGame(w, 21), 30, apply(z.index, plan));
    const spend = s.history.slice(-10).map((d) => d.adSpend);
    // No price event in that zone: every day costs exactly the estimate.
    expect(Math.min(...spend)).toBeCloseTo(estimate(z, plan).cost, 6);
  });
});

describe("insights (what the player knows)", () => {
  const w = buildWorld(ZONES, CATS, "supplements");

  it("Easy knows everything, Hard starts with the hints", () => {
    expect(initGame(w, 1, "easy").known.sort()).toEqual(productLabels(w.product).sort());
    expect(initGame(w, 1, "hard").known).toEqual(w.product.hints);
  });

  it("a week of ads in a neighborhood teaches one thing", () => {
    const z = [...w.zones].sort((a, b) => b.data.nAll - a.data.nAll)[0];
    const s0 = { ...initGame(w, 2, "hard"), known: [] };
    const s6 = run(w, s0, C.insightDays - 1, [ooh(z.index, 1)]);
    expect(s6.known).toHaveLength(0);
    const s7 = step(w, s6);
    expect(s7.known).toHaveLength(1);
    expect(s7.insights[0]).toMatchObject({ zone: z.index, day: C.insightDays });
    expect(z.data.n[s7.known[0]]).toBeGreaterThan(0);
    // Only once per neighborhood.
    expect(run(w, s7, 10).known).toHaveLength(1);
  });

  it("explanations don't mention place types the player hasn't learned", () => {
    for (const z of w.zones) {
      const e = explain(w, z.index, []);
      const text = [e.fitLine, e.stockLine, e.competitionLine].join(" ");
      for (const l of productLabels(w.product)) expect(text).not.toContain(labelName(l));
      expect(e.unknownLine).toBeTruthy();
    }
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
        expect(estimate(w.zones[r.zone], r.to).profit - estimate(w.zones[r.zone], r.from).profit).toBeCloseTo(r.deltaProfit, 6);
      }
      if (!recs.length) break;
      s = step(w, s, apply(recs[0].zone, recs[0].to));
    }
  });

  it("suggests cutting a money-losing campaign", () => {
    const w = buildWorld(ZONES, CATS, "supplements");
    const worst = [...w.zones].sort((a, b) => oohAt(a)[3] - oohAt(b)[3])[0];
    const s = { ...initGame(w, 10), plans: w.zones.map((z) => (z.index === worst.index ? { ooh: 3, digital: 0 } : OFF)) as Plan[] };
    const cut = recommend(w, s, 100).find((r) => r.zone === worst.index);
    expect(cut?.cut).toBe(true);
  });

  it("following them beats doing nothing", () => {
    const w = buildWorld(ZONES, CATS, "pet_food");
    let s = initGame(w, 11, "easy");
    while (s.status === "playing") {
      const r = recommend(w, s, 1)[0];
      s = step(w, s, r && s.day % 3 === 0 ? apply(r.zone, r.to) : []);
    }
    expect(["paid", "finished"]).toContain(s.status);
    expect(s.cash + (s.paidDay ? C.loan : 0)).toBeGreaterThan(C.startCash);
  });
});

describe("explanations", () => {
  it.each(PRODUCTS)("%s: every zone gets readable lines", (key) => {
    const w = buildWorld(ZONES, CATS, key);
    for (const z of w.zones) {
      const e = explain(w, z.index);
      for (const line of [e.fitLine, e.stockLine, e.competitionLine, e.priceLine, e.peopleLine, e.summary]) {
        if (line === null) continue;
        expect(line.length).toBeGreaterThan(2);
        expect(line).not.toMatch(/undefined|NaN|_/);
      }
    }
  });
});

describe("team and shops (DESIGN.md 6.15)", () => {
  const w = buildWorld(ZONES, CATS, "supplements");
  const best = [...w.zones].sort((a, b) => b.bestProfit - a.bestProfit)[0];

  it("you start alone: digital ads at Low only, no salaries", () => {
    const s = initGameAlone(w, 1);
    expect(s.staff).toEqual({ ooh: 0, digital: 1 });
    expect(fixedCosts(w, s)).toBe(C.fixedOverhead);
    const next = step(w, s, [
      ...apply(0, { ooh: 0, digital: 3 }),
      ...apply(1, { ooh: 1, digital: 0 }),
      ...apply(2, { ooh: 2, digital: 2 }),
    ]);
    expect(next.plans.slice(0, 3)).toEqual([
      { ooh: 0, digital: 1 },
      { ooh: 0, digital: 0 },
      { ooh: 0, digital: 1 },
    ]);
  });

  it("a hire costs its signing fee, adds its salary, and unlocks one level", () => {
    const s = initGameAlone(w, 1);
    const h = nextHire(s.staff, "digital")!;
    expect(h.level).toBe(2);
    const after = hire(s, "digital");
    expect(after.cash).toBe(s.cash - h.signing);
    expect(after.staff.digital).toBe(2);
    expect(fixedCosts(w, after)).toBe(C.fixedOverhead + h.salary);
    expect(allowed(after.staff, { ooh: 0, digital: 2 })).toBe(true);
    expect(allowed(after.staff, { ooh: 0, digital: 3 })).toBe(false);
    expect(allowed(after.staff, { ooh: 1, digital: 2 })).toBe(false);
    expect(after.purchases).toEqual([{ day: 0, kind: "hire", channel: "digital", level: 2, cost: h.signing }]);
  });

  it("hires go up the ladder in order, stop at the lead, and need the cash", () => {
    let s = noLoan({ ...initGameAlone(w, 1), cash: 1e6 });
    for (let i = 0; i < 5; i++) s = hire(s, "ooh");
    expect(s.staff.ooh).toBe(3);
    expect(nextHire(s.staff, "ooh")).toBeNull();
    expect(s.purchases.map((p) => p.level)).toEqual([1, 2, 3]);
    const broke = { ...initGameAlone(w, 1), cash: 100 };
    expect(hire(broke, "digital")).toBe(broke);
  });

  it("the whole team's salaries add up to the ladder in the constants", () => {
    expect(salaries({ ooh: 3, digital: 3 })).toBe(250 + 400 + 200 + 350 + 200);
  });

  it("hire actions work inside step too", () => {
    const s = step(w, noLoan({ ...initGameAlone(w, 1), cash: 1e6 }), [{ type: "hire", channel: "ooh" }, ...apply(best.index, { ooh: 1, digital: 1 })]);
    expect(s.staff.ooh).toBe(1);
    expect(s.plans[best.index]).toEqual({ ooh: 1, digital: 1 });
  });

  it("shop price and rent follow busyness, and a zone takes up to the max", () => {
    const byBusy = [...w.zones].sort((a, b) => a.busyness - b.busyness);
    const [quiet, busy] = [byBusy[0].index, byBusy[byBusy.length - 1].index];
    expect(shopCost(w, busy)).toBeGreaterThan(shopCost(w, quiet));
    expect(shopRent(w, busy)).toBeGreaterThan(shopRent(w, quiet));
    let s = noLoan({ ...initGameAlone(w, 1), cash: 1e7 });
    for (let k = 1; k <= C.shop.maxPerZone; k++) {
      const before = s.cash;
      s = openShop(w, s, best.index);
      expect(shopsIn(s, best.index)).toBe(k);
      // The same price every time in the same place.
      expect(s.cash).toBe(before - shopCost(w, best.index));
    }
    expect(openShop(w, s, best.index)).toBe(s);
    expect(fixedCosts(w, s)).toBeCloseTo(C.fixedOverhead + C.shop.maxPerZone * shopRent(w, best.index), 9);
  });

  it("each extra shop in a zone adds less than the one before", () => {
    const c = [0, 1, 2, 3].map((n) => estimateAt(w, best.index, OFF, n).customers);
    expect(c[1] - c[0]).toBeGreaterThan(c[2] - c[1]);
    expect(c[2] - c[1]).toBeGreaterThan(c[3] - c[2]);
    expect(c[3] - c[2]).toBeGreaterThan(0);
  });

  it("a first shop pays in some neighborhoods and loses money in most", () => {
    const s = { ...initGameAlone(w, 1), staff: { ooh: 2, digital: 2 } as const };
    const gains = w.zones.map((z) => shopGain(w, s, z.index));
    const paying = gains.filter((g) => g > 0).length;
    expect(paying).toBeGreaterThan(0);
    expect(paying).toBeLessThan(w.zones.length / 2);
    // A second shop in the best spot adds less than the first did.
    const top = w.zones[gains.indexOf(Math.max(...gains))].index;
    expect(shopGain(w, { ...s, shops: [top] }, top)).toBeLessThan(gains[top]);
  });

  it("a shop brings walk-in customers with no ads, close to its estimate", () => {
    let s = openShop(w, noLoan({ ...initGameAlone(w, 1), cash: 1e6 }), best.index);
    s = run(w, s, 120);
    expect(s.lastDay.customers[best.index]).toBeGreaterThan(0);
    // Average over the next 30 days, compared with the steady-state estimate.
    let sum = 0;
    let t = s;
    for (let d = 0; d < 30; d++) {
      t = step(w, t);
      sum += t.lastDay.customers[best.index];
    }
    const est = estimateAt(w, best.index, OFF, 1).customers;
    expect(sum / 30).toBeGreaterThan(est * 0.9);
    expect(sum / 30).toBeLessThan(est * 1.15);
  });

  it("a shop makes ads there stronger than the same ads without it", () => {
    const plan: Plan = { ooh: 0, digital: 2 };
    expect(estimateAt(w, best.index, plan, 1).customers).toBeGreaterThan(estimateAt(w, best.index, plan, 0).customers);
  });

  it("suggestions never offer something your team can't buy", () => {
    const s = initGameAlone(w, 1, "easy");
    const recs = recommend(w, s, 100);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) expect(allowed(s.staff, r.to)).toBe(true);
  });

  it("the first hires are worth more than the last ones (Easy mode's hire estimate)", () => {
    const s = initGameAlone(w, 1);
    expect(hireGain(w, s, "digital")!).toBeGreaterThan(0);
    expect(hireGain(w, { ...s, staff: { ooh: 3, digital: 3 } }, "digital")).toBeNull();
  });
});

describe("the bank loan (DESIGN.md 6.18)", () => {
  const w = buildWorld(ZONES, CATS, "cold_brew");

  it("is paid back automatically the day cash reaches it, and the run stops there", () => {
    const s = step(w, { ...initGame(w, 1), cash: C.loan + 10000 });
    expect(s.status).toBe("paid");
    expect(s.paidDay).toBe(1);
    expect(s.cash).toBeLessThan(10000);
    expect(s.cash).toBeGreaterThan(0);
    expect(step(w, s)).toBe(s);
  });

  it("isn't paid while cash is short of it", () => {
    const s = step(w, { ...initGame(w, 1), cash: C.loan - 10000 });
    expect(s.status).toBe("playing");
    expect(s.paidDay).toBeUndefined();
  });

  it("after paying, you can play on past the deadline, and it is never charged twice", () => {
    let s = keepPlaying(step(w, { ...initGame(w, 2), cash: C.loan * 3 }));
    expect(s.status).toBe("playing");
    expect(s.endless).toBe(true);
    s = run(w, s, C.days + 20, w.zones.flatMap((z) => apply(z.index, z.best)));
    expect(s.status).toBe("playing");
    expect(s.day).toBe(C.days + 21);
    expect(s.paidDay).toBe(1);
    expect(s.cash).toBeGreaterThan(C.loan);
  });

  it("a perfect plan can pay it off within the run; never hiring anyone can't", () => {
    const perfect = run(w, initGame(w, 3), C.days, w.zones.flatMap((z) => apply(z.index, z.best)));
    expect(perfect.status).toBe("paid");
    const alone = run(w, initGameAlone(w, 3), C.days, w.zones.flatMap((z) => apply(z.index, { ooh: 0, digital: z.est[0][1].profit > 0 ? 1 : 0 })));
    expect(alone.paidDay).toBeUndefined();
  });
});
