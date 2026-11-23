/**
 * Every tuning number in the game lives here (DESIGN.md section 6.10).
 * These are design choices, not facts: Overture gives us the inputs, not the economy.
 */
export const C = {
  /** Tight on purpose: the first month is a squeeze while ads build up. */
  startCash: 50000,
  /** Six months: long enough for campaigns to mature and be adjusted mid-run. */
  days: 180,

  /** Floor space per person, m2. People ("H") = floor area / this. */
  m2PerPerson: 60,
  /**
   * Overture has no sales data, so the economy is calibrated per product in two steps.
   * The data still decides *where* the money is; these decide how much there is.
   *
   * 1. Purchase rate (share of people who buy per day at full awareness): set so the
   *    median zone's gross profit at Medium is this multiple of its ad cost. Below 1, the
   *    median zone loses money at Medium, so only good zones justify Medium or High.
   */
  medianReturnAtMedium: 0.8,
  /**
   * Dollar amounts were multiplied by 10 on 2026-11-23 (with customers scaled to match, so
   * the balance didn't change): a $25/day salary or a $5,000 company didn't read as real.
   *
   * 2. Money scale: ad prices and customers are scaled together (which doesn't change any
   *    zone's best level) so that a perfect player, running the best level in every
   *    profitable zone at full strength, makes this much profit per day.
   */
  perfectDailyProfit: 3000,
  /** Potential multiplier = fitFloor + (1 - fitFloor) * fit^fitSharpness. */
  fitFloor: 0.05,
  fitSharpness: 2,

  /**
   * Competition is measured per 10,000 people, so big zones aren't punished for being big.
   * kappa = weighted competitors per 10,000 people that halve your potential.
   */
  kappa: 6,
  /** A branded (chain) competitor counts this much. */
  brandedCompetitorWeight: 1.5,

  /**
   * Stockists (stores that carry you) raise potential by up to stockBoost, with half of
   * that at stockHalf weighted stockists per 10,000 people.
   */
  stockBoost: 0.5,
  stockHalf: 3,

  /**
   * Ad formats. Price multiplies the zone's ad price; fee is the flat daily campaign fee;
   * effectiveness multiplies customers.
   * - Out-of-home (billboards, bus shelters, posters, displays in shops and venues): effMin + effSpan x the
   *   zone's out-of-home mix, the average of busyness and stockist percentile. Priced with the
   *   busy-area premium (6.4).
   * - Digital: effMin + effSpan x fit (it targets your buyers wherever they live). Priced per
   *   person with no busy-area premium, times `price`. No spillover into neighbors.
   */
  formats: {
    ooh: { price: 1, fee: 150, effMin: 0.6, effSpan: 0.9 },
    digital: { price: 1, fee: 100, effMin: 0.4, effSpan: 0.8 },
  },

  /** A neighborhood teaches you one thing after this many days of ads there (Normal and Hard). */
  insightDays: 14,

  /** Ad price for Low, $/day, for a zone of 10,000 people at average busyness, before the money scale. */
  adPriceBase: 20,
  adPriceExponent: 0.9,
  /** Price multiplier spans busynessMin .. busynessMin + busynessSpan. */
  busynessMin: 0.75,
  busynessSpan: 0.5,

  /**
   * Flat cost per day for every running campaign (creative, setup, management), on top of
   * the ad price; set per format above (out-of-home $150, digital $100). Without it,
   * blanketing the city at Low nearly matched smart play, because weak zones are cheap and
   * lose only a few dollars each.
   */

  /** Ad level multipliers: Off, Low, Medium, High. */
  levelMult: [0, 1, 2, 4] as const,
  /**
   * Ad pressure kept from one day to the next. At 0.93 a campaign reaches about 2/3 of its
   * full strength in 2 weeks and ~92% in 5 weeks, and stopped ads fade over weeks, like
   * real brand campaigns. (It was 0.9, which got to ~90% awareness in under a week, so all
   * the decisions happened in week 1.) Steady-state reach is set by reachScale below.
   */
  adDecay: 0.93,
  /**
   * Digital ads build and fade much faster (2026-11-23): targeted ads bring buyers within
   * days and stop soon after you stop paying, while billboards build familiarity over
   * weeks. At 0.8 digital reaches ~90% of full strength in 10 days (half-life ~3 days, vs ~10
   * for out-of-home). Full-strength reach per level is the same for both channels: each
   * day's digital ads are scaled by digitalPressureScale, so estimates don't change.
   */
  digitalDecay: 0.8,
  digitalPressureScale: (1 - 0.8) / (1 - 0.93),
  /**
   * Share of each neighbor's ad intensity that spills into a zone. Zones have ~6 neighbors,
   * so this is kept small: at 0.15, blanketing the city at Low gave every zone nearly
   * Medium reach for free.
   */
  spillover: 0.05,
  /**
   * Reach = 1 - exp(-pressure / reachScale). Scaled with adDecay so full-strength reach stays
   * the design's Low 46%, Medium 71%, High 92% (steady pressure = level / (1 - adDecay)).
   */
  reachScale: 1.6 / (1 - 0.93),

  /** Brand awareness: +1% customers everywhere per zone with reach > 50%, up to +10%. */
  brandPerZone: 0.01,
  brandCap: 1.1,
  brandReachThreshold: 0.5,

  /** Daily demand noise: normal(1, sd), clamped. */
  noiseSd: 0.08,
  noiseMin: 0.75,
  noiseMax: 1.25,

  /**
   * Running the business with nobody hired yet, $/day. Salaries and shop rent come on top
   * (DESIGN.md 6.15). It was a flat $120 before the team existed, which bankrupted Hard
   * players before their first ads had built up.
   */
  fixedOverhead: 400,
  /**
   * The overhead the money scale is calibrated against (see perfectDailyProfit). Kept at the
   * old $1,200 (×10) so the per-zone economy didn't change when the team was added.
   */
  calibrationOverhead: 1200,
  variableOverhead: 0.1,

  /**
   * Your team (DESIGN.md 6.15). You start alone, able to buy digital ads at Low. Each hire
   * unlocks the next level of one channel, costs a one-off signing fee and a salary per day,
   * and is permanent. Indexed by the level it unlocks (index 0 unused); digital Low is yours
   * from the start. Medium is where most of the money is; High only pays for some products,
   * so lead buyers are cheap to keep but not always worth it.
   */
  hires: {
    ooh: [
      null,
      { title: "Out-of-home buyer", signing: 25000, salary: 250 },
      { title: "Senior out-of-home buyer", signing: 50000, salary: 400 },
      { title: "Lead out-of-home buyer", signing: 60000, salary: 200 },
    ],
    digital: [
      null,
      null,
      { title: "Senior digital buyer", signing: 30000, salary: 350 },
      { title: "Lead digital buyer", signing: 60000, salary: 200 },
    ],
  },

  /**
   * Your own shops (DESIGN.md 6.15). Opening one costs `cost` x (costMin + costSpan x
   * busyness): fit-out and deposit are dearer where it's busy. Rent per day rises the same
   * way. Each shop has two permanent effects in its neighborhood: walk-ins (works like
   * 1.2x a Low out-of-home ad that never stops, and spills over like one) and more sales
   * (potential x (1 + boost)). Up to `maxPerZone` per neighborhood; each extra one there
   * adds `stack` times what the previous one added but pays full rent, so a second shop
   * rarely pays. Tuned (2026-11-23) so a first shop pays back within the run in
   * ~5 neighborhoods per product and loses money in ~3/4 of them (DESIGN.md 6.15).
   */
  shop: {
    cost: 70000,
    costMin: 0.6,
    costSpan: 0.8,
    rentMin: 100,
    rentSpan: 200,
    pressure: 1.2,
    boost: 0.8,
    stack: 0.5,
    maxPerZone: 3,
  },

  /** Days per month, for reports. */
  monthDays: 30,

  /** Game over after this many days in a row with cash below $0. */
  bankruptDays: 3,

} as const;
