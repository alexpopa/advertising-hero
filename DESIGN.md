# Ad Empire SF — v1 design

> Working title. One-sentence pitch: **Launch a brand and grow it by buying ads across San Francisco's real neighborhoods, where every neighborhood's value comes from Overture's map of what is actually there.**

## 1. Why this, and who it's for

- **Player:** people who like tycoon and sim games, and anyone curious how location-targeted advertising works. San Francisco players recognize the neighborhoods, which makes the decisions feel real.
- **Why a game, not a tool:** Overture has no revenue, rent, foot-traffic or demographic data. A "where should my business advertise" *tool* would have to present invented revenue as a forecast, which would be misleading. In a *game*, a synthetic economy is expected. What we keep honest is the **input**: every neighborhood's score comes from real Overture data, and the game always shows why.
- **Why ads:** the core question of the game ("where is my next ad dollar worth the most, and why?") is the everyday question of anyone buying local ads, and it maps cleanly onto what open map data can and can't tell you.

## 2. Scope of v1

**In**
- San Francisco only, data precomputed into static files.
- An online-only brand: no storefronts, no property.
- 6 product types to pick from (section 5).
- Ads bought per neighborhood at 4 levels (Off / Low / Medium / High).
- Daily income, overhead, a bit of randomness. (Occasional events were cut on 2026-11-23, see 6.8.)
- Two difficulty modes, chosen at the start, **Hard by default**. Easy adds top-5 recommendations (where to place ads, with plain-language reasons). Hard shows no recommendations; the player reads the map and works it out.
- A 180-day run (90 until 2026-11-23, see 6.14) with an end-of-game summary. Progress saved in the browser.

**Cut (and why), to be repeated in the README**
| Cut | Why |
|---|---|
| Physical storefronts and buying land | Doubles the scope (placement UI, rent model, cannibalization). It's the first stretch goal once v1 is solid. |
| Pricing existing businesses / land | No data to price it credibly; it would be pure invention. |
| Employees, salaries, inventory | Micromanagement isn't the fun part. Rolled into one "overhead" line. |
| Multiple cities | SF keeps the data small and lets us tune the balance against one map. |
| Accounts, leaderboards, multiplayer | Needs a backend. Save to localStorage instead. |
| Census demographics | A good v2 addition ("Overture + one dataset"), but v1 proves the idea on Overture alone. |
| Live Overture queries in the browser | Slow and fragile. Precompute once, ship small files. |

**Stretch goals, in order:** storefront unlock at a revenue milestone → census income layer → shareable end-of-run card → second city.

## 3. Core loop

1. **Start:** name your brand (or take a random one), pick a product, and pick **Easy or Hard** (Hard preselected). Starting cash: $3,000 (was $5,000; see 6.11).
2. **Read the map:** every neighborhood is colored by its **score** (0–100) for your product. On Easy, the sidebar also lists the **top 5 recommendations** with reasons.
3. **Buy ads:** click a neighborhood, choose Low / Medium / High. Ads cost money every day while active.
4. **Earn:** each day, customers arrive from neighborhoods where your ads are running. Revenue minus ad spend minus overhead is your daily profit. It can be negative.
5. **Reinvest:** move budget toward what works, expand to new neighborhoods, cut what doesn't pay.
6. **End:** after day 90, show final net worth, best and worst neighborhoods, and total ad spend. Bankrupt if cash stays below $0 for 3 days in a row.

Time runs on its own: 1 game day every 3 s at 1×, with Pause, 1×, 2× and 4×. A full run is about 4–5 minutes at 1×.

## 4. Screens and UX

- **Start screen:** one sentence on what the game is, the 6 product cards (icon, name, one-line "who buys this"), a brand-name field, a **difficulty toggle: Hard (default) / Easy** with one line each ("Hard: read the map and decide for yourself" / "Easy: get suggestions on where to place ads"), and Start. No signup.
- **Main screen**
  - Full-screen MapLibre map of SF with neighborhood polygons colored by score (sequential scale). Neighborhoods with active ads get an outline and a small level badge.
  - **Top bar:** brand name, day X/90, cash, profit per day (green/red), speed controls.
  - **Sidebar, "Recommended" tab (Easy only; default tab on Easy):** top 5 actions, e.g. "Medium ads in Mission — +$41/day, $60/day cost", each with a one-line reason and a Buy button.
  - **Sidebar, "Your campaigns" tab (both modes; the only/default tab on Hard):** each active neighborhood with level, cost, customers/day and profit/day, sortable. This is where you find losers to cut.
  - **Neighborhood panel (on click):** score, "why" breakdown (section 6.6), price per level, projected customers and profit per level, the 3 most relevant real places as examples ("Equinox, Barry's, 29 other gyms").
  - **Event toasts** in a corner, with a log.
- **First-run hints:** three short tooltips: "Colors show where your product fits", then on Easy "Start with a recommendation" / on Hard "Click a neighborhood to see why it scores that way", then "Watch profit per day; cut what's red". Dismissible, shown once.
- **Difficulty** is fixed for the run (no switching mid-game) and shown on the end screen.
- **End screen:** summary stats, a line chart of cash over time, Play again.

Accessibility: the color scale also has number labels on hover and in the panel; nothing depends on color alone.

## 5. Products

*Rewritten 2026-11-22 (was 6 products with demand and competitor signals only).*

20 products in 5 groups, each tagged Starter, Tricky or Expert. All of them live in `scripts/categories.json`, which is the source of truth; this section explains the shape. Labels are Overture `basic_category` values or `taxonomy.hierarchy` entries (taxonomy 2026-10-21.0). A place matches a label if the label is its `basic_category` or appears anywhere in its hierarchy.

Every product has four kinds of place:

| Role | What it does | Example (protein & supplements) |
|---|---|---|
| **Customers** (`demand`) | Where buyers are. Sets fit, as before. | gyms, fitness studios, martial arts gyms |
| **Stockists** (`stockists`) | Stores that carry you. Raise potential (6.12) and allow storefront ads. | sporting-goods stores, pharmacies, grocery stores |
| **Competitors** (`competitors`) | Take sales, as before. | juice bars, health food stores |
| **Decoys** (`decoys`) | Look relevant, do nothing. Exist so the map can mislead. | yoga studios |

A label can be a stockist and a competitor at once ("carries you, but sells rivals too"): sporting-goods stores for supplements, beauty stores for skincare, pet stores for pet food, bike shops for e-bikes. Its stockist weight is higher, so it helps a little overall. Some deliberate traps: juice bars look like gym-goers but compete with protein; cafés and coffee shops look like cold brew buyers but are rivals; laundromats look like laundry customers but compete; condos look like laundry customers but have in-unit washers (decoy); vegan restaurants compete with plant-based meal kits.

Each product also has `who` (the one-line audience shown on every difficulty), `hints` (1–2 labels Hard mode tells you up front) and an icon and group for the menu.

| Group | Products |
|---|---|
| Food & drink | Cold brew subscription, Craft hard seltzer, Plant-based meal kits, Late-night snack delivery, Craft kombucha |
| Health & fitness | Protein & supplements, Running shoes, Sleep & calm gummies, Contact lens subscription |
| Beauty & style | Clean skincare, Men's grooming kit, Sustainable fashion label |
| Pets & family | Premium pet food, Kids & baby gear, Tutoring app for teens |
| Home & going out | Houseplant delivery, Laundry pickup, E-bike rental, Event ticket app, City tours for visitors |

Seven products have no stockists (delivery and app products), so storefront ads are never possible for them. These weights are design choices, not facts. The README says so, and they live in one JSON file so they're easy to tune.

## 6. Scoring model

Everything is computed per **zone** (a neighborhood) and per **product**. All inputs except the tuning constants come from Overture.

### 6.1 Zones
- Source: Overture `divisions` → `division_area`, `is_land = true`, inside the San Francisco locality, `subtype` in (`neighborhood`, `macrohood`).
- Pick the level that gives roughly 30–120 zones. Neighborhood coverage is patchy in some places. If SF's set is incomplete or overlapping, fall back to H3 resolution-8 hexes (~0.7 km² each) labeled with the neighborhood they mostly fall in.
- Precompute zone adjacency (zones that share a border) for the spillover rule.

### 6.2 Per-zone raw inputs (precomputed)
| Symbol | Meaning | Source |
|---|---|---|
| `area` | land area, km² | divisions |
| `floorArea` | Σ footprint area × floors over buildings in the zone. Floors = `num_floors`, else `height / 3.5 m`, else 2 | buildings |
| `n[label]` | count of places matching each category label | places |
| `nAll` | count of all places | places |
| `transit` | count of transit stops/stations (`infrastructure`, `subtype = transit`, `class` in bus_stop, bus_station, platform, stop_position, railway_station, railway_halt, ferry_terminal, subway_station) | base |

Place filtering: `operating_status` ≠ `permanently_closed`/`temporarily_closed`, `confidence ≥ 0.5`, and dedupe places with the same normalized name within 30 m. Known Overture issues (duplicates, junk) are why this matters.

### 6.3 Derived zone values
- **People** `H = floorArea / 60` — "estimated people who live or work here". It's a proxy and the UI says "estimated from building floor space".
- **Busyness** `B = pct(transit / area) · 0.5 + pct(nAll / area) · 0.5`, where `pct()` is the percentile rank across all SF zones (0..1).

### 6.4 Product fit and competition
- **Fit** (0..1): how much the zone looks like your audience.
  `Fit = Σ_g w_g · pct(n_g / area) / Σ_g w_g` over the product's demand signals g.
- **Competition** `C = Σ_c v_c · n_c` over competitor labels c, where branded places (non-null `brand`) count 1.5×.
  `compFactor = 1 / (1 + C / κ)`, with κ = 6. So 6 weighted competitors halve your potential.

### 6.5 Potential, ad price, reach
- **Max customers/day** if everyone in the zone knew your brand:
  `Pmax = H · r · (0.2 + 0.8 · Fit) · compFactor`, base purchase rate `r = 0.002`.
- **Ad price per day** for the Low level:
  `price = c0 · (H / 10,000)^0.9 · (0.75 + 0.5 · B)`, `c0 = $20`.
  Bigger zones cost more because they hold more people. Busy zones charge a premium. That creates the core tension: prime areas are expensive; high-fit, low-busyness areas are hidden gems.
- **Levels:** Low = 1× price, Medium = 2×, High = 4×.
- **Ad pressure** (memory of past ads), updated daily:
  `a_z ← 0.8 · a_z + spend_z + 0.15 · Σ_{neighbors} spend_n`
  Ads fade by 20% a day after you stop. Neighbors get 15% spillover.
- **Reach** (share of the zone's potential you capture):
  `ρ = 1 − exp(−a_z / (8 · price))`
  At steady state that's Low ≈ 46%, Medium ≈ 71%, High ≈ 92%. Doubling spend always buys less than double the result (diminishing returns).

### 6.6 Daily result
- **Brand awareness** multiplier: `brand = 1 + 0.02 · (zones with ρ > 0.5)`, capped at 1.25. Being in many places helps a bit everywhere.
- **Customers** `cust_z = Pmax · ρ · brand · noise_z` (events were removed 2026-11-23, 6.8), where `noise_z` is drawn from a seeded normal distribution with mean 1 and sd 0.08, clamped to 0.75–1.25.
- **Revenue** = Σ cust_z · orderValue · margin.
- **Costs** = Σ ad spend + overhead, where overhead = $120/day + 10% of revenue (rent, fulfillment, staff, all rolled into one line).
- **Profit/day** = revenue − costs. Can be negative.

### 6.7 Score and recommendations (recommendations: Easy mode only)
- **Score (0–100)** for the choropleth: steady-state profit per ad dollar at Medium, `(revenue_at_medium − 0.1 · revenue_at_medium − cost_at_medium) / cost_at_medium`, mapped to 0–100 by percentile across zones. It ignores current campaigns so the map stays stable.
- **Recommendations (Easy only):** for every zone and every one-step change (Off→Low, Low→Med, Med→High, and downgrades), compute the steady-state Δprofit/day. Show the 5 best positive ones. Downgrades appear when a campaign loses money ("Cut High ads in Marina: saves $32/day").
- **Reasons** shown with each: the two demand signals contributing most to Fit, with real counts ("31 gyms and fitness studios"), the competition line ("only 2 sporting-goods stores"), and the price line ("cheaper than 70% of SF"). Text comes from the numbers above, not hand-written per zone.

### 6.8 Events (removed 2026-11-23)

*Removed for now.* Events landed in random neighborhoods, usually ones the player wasn't advertising in, so they mostly did nothing; at 2–5 days they ended before slow-building campaigns could respond; and they asked for no decision. If they come back: favor neighborhoods where the player advertises, last weeks not days, and offer a choice ("A rival launched in Mission. Match their spend?"). The original design, for reference:


| Event | Effect | Data link |
|---|---|---|
| Street fair in [zone] | +40% customers there for 2 days | zone chosen weighted by event_venue + festival_venue + park counts |
| Rainy week | −10% citywide for 3 days | none |
| Competitor campaign in [zone] | −20% there for 5 days | weighted by competitor counts |
| Viral post | brand +10% for 3 days | none |
| Ad prices up in [zone] | +25% price for 4 days | weighted by busyness |

Events are fictional. They never name real businesses.

### 6.9 Sanity check of the numbers (original estimate, superseded by 6.11)
Example zone: 15,000 people, Fit 0.7, compFactor 0.6, product with $25 order at 40% margin.
- Pmax = 15,000 × 0.002 × 0.76 × 0.6 ≈ 13.7 customers/day.
- Medium: ρ ≈ 0.71 → 9.7 customers → $97 gross margin → $87 after the 10% overhead share.
- Price ≈ $20 × 1.44 × ~1.0 ≈ $29 → Medium costs $58/day → **+$29/day**.
- With 10 decent zones that's ~$290/day − $120 fixed overhead ≈ $170/day. Starting at $5,000, a good player who expands steadily ends around $20k or more; a careless one burns cash.

These constants are a starting point. The balance script (section 8) tunes them.

### 6.10 Tuning constants (all in `src/sim/constants.ts`)
Start values from this design, and what they are after the first run on real data (2026-11-21, section 6.11) and the slower-campaigns change (2026-11-23, section 6.14).

| Name | Start value | Now |
|---|---|---|
| startCash | $5,000 | **$5,000** ($3,000 from 6.11 until 6.14) |
| days | 90 | **180** (6.14) |
| m² per person | 60 | 60 |
| base purchase rate r | 0.002 | **calibrated per product** (6.11) |
| fit effect | 0.2 + 0.8·Fit | **0.05 + 0.95·Fit²** |
| κ (competition) | 6 weighted competitors | **6 weighted competitors per 10,000 people** |
| branded competitor weight | 1.5 | 1.5 |
| c0 (ad price base) | $20 | $20 before the money scale (6.11) |
| campaign fee | none | **$15/day per running campaign** |
| level multipliers | 1, 2, 4 | 1, 2, 4 |
| ad decay | 0.8/day | **0.93/day** (0.9 from 6.11 until 6.14) |
| reach scale | 8 | **1.6 / (1 − decay) ≈ 22.9** (same steady reach: Low 46%, Medium 71%, High 92%) |
| spillover | 0.15 of neighbor spend | **0.05 of each neighbor's ad intensity** |
| brand bonus | 0.02/zone, cap 1.25 | **0.01/zone, cap 1.10** |
| noise sd | 0.08 | 0.08 |
| fixed overhead | $120/day | $120/day |
| variable overhead | 10% of revenue | 10% of revenue |
| bankruptcy | 3 days below $0 | 3 days below $0 |

### 6.11 What changed after the first numbers, and why (2026-11-21)
Measured with `npm run report` (a few simple strategies per product, 5 seeds), before any UI.

1. **Competition per 10,000 people, not absolute counts.** Big zones hold more of everything, so absolute counts ranked the Financial District *last* for cold brew, a product for office workers.
2. **Purchase rate calibrated per product.** With the guessed rates, pet food, kids gear, skincare and supplements were profitable in all 76 zones while cold brew and late-night lost money almost everywhere. Overture has no sales data, so the rate is now set so the median zone's return at Medium is 0.8× its ad cost (`medianReturnAtMedium`).
3. **Money scale calibrated per product.** Customers and ad prices are scaled together (which never changes a zone's best level) so that perfect play makes $300/day at full strength (`perfectDailyProfit`). Every product is equally winnable; the data decides *where* the money is.
4. **Sharper fit (Fit²).** Great-fit zones were only ~1.5× better than average, so Medium and High were never worth it.
5. **Spillover and brand bonus cut.** At 0.15 per neighbor (~6 neighbors), blanketing the city at Low gave every zone nearly Medium reach for free, and "Low everywhere" nearly matched perfect play. Spillover is now in ad-intensity units, so an expensive downtown zone doesn't flood its cheap neighbors.
6. **$15/day campaign fee.** Even after 5, blanketing earned ~70% of perfect play, because weak zones are mostly cheap residential areas that lose only a few dollars each. A flat fee per campaign (creative, setup, management) makes *where* matter.
7. **Slower ads, less starting cash.** Ads take ~10 days to build and fade 10%/day; start with $3,000. Before this, perfect play never dropped below its starting cash and was rich by day 20.

Result (median of 5 seeds; ranges across the 6 products):

| Strategy | End of day 90 |
|---|---|
| Perfect plan from day 1 | $41k–47k (about $6–8k on day 20; cash dips to ~$1–2.5k in week 1) |
| Medium in the top 10 zones by score | $32k–43k |
| Easy mode: take the top suggestion every day | $32k–40k |
| Do nothing | bankrupt on day 28 |
| Low everywhere / High everywhere | bankrupt in 3–5 days |

**Known issues to revisit in the balance pass:**
- Only 11–16 of 76 zones are worth advertising in per product, and within a product one level usually wins everywhere (Medium for most, High for late-night), so the level choice is weak.
- "Medium in the top 10 by score" is close to perfect: the score colors nearly give the answer away. This matters for the open question of whether Hard mode shows them.
- Late-night ad prices are low ($5–13/day Low) because bars are concentrated in a few zones.

### 6.12 Stockists and ad channels (2026-11-22, reworked 2026-11-23)

*Naming:* the channels use advertising terms. **Out-of-home** (OOH) is the industry name for billboards, bus shelters and posters; it was called "Local" for a day, renamed because in advertising "local" usually means local TV. **Digital** was called "Online".

**Stockists.** `S` = weighted stockist count per 10,000 people. Potential gets `× (1 + 0.5 · S / (S + 3))`: up to +50%, half of that at 3 weighted stockists per 10k people.

**Ad channels.** Each neighborhood runs Out-of-home and Digital at separate levels: Off / Low / Medium / High each (since 2026-11-23, 6.15; before that, two checkboxes sharing one level). Both Off = no ads. How high each channel can go depends on who you've hired (6.15).

| Channel | Low price per day | Fee/day | Effectiveness (multiplies customers) | Spillover |
|---|---|---|---|---|
| Out-of-home (billboards, bus shelters, posters, displays in shops and venues) | the zone's ad price (6.5), with the busy-area premium | $15 | 0.6 + 0.9 × average of busyness and stockist percentile (stockists left out for products not sold in stores) | yes |
| Digital | same base price, no busy-area premium | $10 | 0.4 + 0.8 × fit | no (targeted) |

Each channel has its own awareness (pressure) track, building and fading as in 6.5. Customers = potential × `eL·rL + eO·rO − ½·min(eL, eO)·rL·rO`: each channel reaches its own people, and the overlap (people who see both) is counted once. Adding a channel never lowers customers (a test checks every zone, product and level). Cost of both = the sum of each. The awareness meter shows `1 − (1 − rL)(1 − rO)`.

So: busy downtown and areas full of stores that sell you favor out-of-home ads; quiet residential neighborhoods full of your buyers favor digital (no downtown premium, follows the fit); the best neighborhoods are often worth both. Across all 20 products, the best choice in profitable neighborhoods splits roughly both ~106, out-of-home ~85, digital ~54, and 18 of 20 products use all three.

**How we got here (2026-11-22 to 11-23).** Versions tried, in order:
1. Three formats (bus stops, storefronts, online) and a schedule per campaign (every day / Mon–Fri / Fri–Sun) driven by a weekly rhythm per neighborhood. It balanced only after several tries (fee per running day made Fri–Sun win everywhere; skipping days made "every day" win everywhere).
2. Four formats (street, venues, storefronts, online). Very sensitive to tuning: one setting gave venues 75% of neighborhoods, another gave street 50%.
3. Too complicated in play: every neighborhood was three decisions. Cut to Local or Online, pick one, no schedules, no weekly rhythm.
4. Online was then a weaker, cheaper copy of Local and never the best choice, so it had no reason to exist. Fixed by giving it a different job (follows the fit, no busy-area premium, no spillover) and making the two channels checkboxes that stack.

Tuning for (4): digital at 0.8× price won ~42% of neighborhoods alone and out-of-home alone only ~13%; at 1× price the three-way split above.

Balance (median of 5 seeds, all 20 products): perfect play $37k–44k; Easy's top suggestion daily $30k–38k; Medium out-of-home ads in the top 10 by score $21k–35k; Low or High everywhere, out-of-home or digital, bankrupt within a week.

### 6.14 Slower campaigns, longer run (2026-11-23)

Playtest finding: with ad decay 0.9, a campaign on both channels at High reached ~90% awareness by day 6. Every real decision happened in week 1 and the rest of the 90 days was watching. Changes:

- **Ad decay 0.93/day:** about 2/3 of full strength after 2 weeks and ~92% after 5 weeks; stopped ads fade over weeks. Reach scale is tied to the decay (`1.6 / (1 − decay)`) so each level's full-strength reach is unchanged.
- **180 days** (six months), with days at 2 s instead of 3 s at 1×: about 6 minutes per run at 1×.
- **Start cash $5,000** (was $3,000): the money-losing build-up now lasts weeks, and at $3,000 perfect play dipped to $0 and some runs went bankrupt. At $5,000 perfect play's lowest point across all 20 products is about $2,000, the same margin as before.
- **Insights every 14 days of ads** per neighborhood (was 7), and Hard unlocks estimates at the same point. Events were briefly set to every 12–18 days, then removed (6.8).

Balance (median of 5 seeds, all 20 products): perfect play $75k–91k; Easy's top suggestion daily $63k–83k, lowest cash ≥ ~$2k; Medium out-of-home in the top 10 by score $42k–72k; Low or High everywhere bankrupt within a week; doing nothing bankrupt on day 44.

### 6.15 A reason to make money: team, shops and monthly goals (2026-11-23; goals removed the same day)

**The problem.** Playtest: "great so far, but not fun". Money had nowhere to go. The only thing to buy was ads, and only 9–15 of 76 neighborhoods pay for any product, so once those ran at their best level, extra cash was just a score. The ceiling was fixed (perfect play tops out at a set profit per day) and since events were cut the world never changes, so the run was a puzzle solved in the first few weeks and then watched. Fun tycoon games turn money into something that raises what you can earn, and set a target that keeps rising. This adds both.

**You start alone.** Day 1 you can buy digital ads at Low only, and running the business costs $40/day (was a flat $120, which bankrupted Hard players before their first ads built up).

**Hires** unlock levels, one channel at a time. Each costs a signing fee once and a salary every day, and is permanent (no firing: each hire is a real commitment).

| Channel | Hire | Unlocks | Signing | Salary/day |
|---|---|---|---|---|
| Digital | (you) | Low | | |
| Digital | Senior digital buyer | Medium | $3,000 | $35 |
| Digital | Lead digital buyer | High | $6,000 | $20 |
| Out-of-home | Out-of-home buyer | Low | $2,500 | $25 |
| Out-of-home | Senior out-of-home buyer | Medium | $5,000 | $40 |
| Out-of-home | Lead out-of-home buyer | High | $6,000 | $20 |

Medium is where most of the money is; High rarely pays (6.11), so lead buyers are cheap to keep but often still not worth it. That's deliberate: for supplements, Easy shows the lead digital buyer at about −$20/day. Which ladder to climb first depends on the product: out-of-home for busy, store-heavy products, digital for scattered audiences.

**Separate levels per channel.** With buyers per channel, one level shared by both channels made no sense (a senior digital buyer alone couldn't run "Medium" if out-of-home was ticked). Each zone now has a level per channel, 16 plans in all, and the estimates, suggestions and calibration cover all of them. Mixed plans like Medium out-of-home + Low digital are the best plan in some zones (a test checks).

**Shops** (reworked 2026-11-23, see 6.16). Originally: open your own shop in any neighborhood: $8,000 for the first, ×1.6 for each one after; rent $20 + $60 × busyness per day. A shop works like a Low out-of-home ad that never stops (walk-ins, spills over like one) and raises that zone's sales by 40% (a store that carries you, that you own). It needs no buyer. Most products have one standout neighborhood for a shop (+$90–150/day after rent on Easy's estimate) and a few marginal ones, so finding it is the decision. Tuned down from $4,000 and +50%, when a perfect bot opened four shops by day 86.

**Monthly goals (removed 2026-11-23).** Playtest: "doesn't make any sense". The targets were numbers from a bot's run with no link to anything on the map, and the stars added a second scoreboard next to cash. Cut from the engine, the UI and the save. What they did: each 30-day month has a goal for average profit per day: $25, $150, $250, $320, $370, $400. Hires and shops are investments and don't count against it. Meeting it earns a ★ and a bonus of 10 days of the goal (at least $250). Missing one costs nothing (soft goals). The run ends with a rating out of 6 stars, so final cash finally reads as good or bad.

**Where it lives on screen.** A floating "Team" bubble top left shows how many people you have, your shops, and a green dot when you can afford a hire or a shop; click it for both hiring ladders (avatars per hire, L/M/H pips, the next hire with a Hire button that fills up as you save) (Easy shows what each hire adds per day at best) and your shops. Open a shop from a neighborhood's card. Locked levels show 🔒 and who to hire.

**Balance** (`npm run report`, starting alone, median of 5 seeds, 20 products). Bots use Easy's estimates, so they are upper bounds on a human:

| Strategy | Stars | Profit/day in month 6 | End cash |
|---|---|---|---|
| Never hire (best digital Low plans) | 0 on 18 products, 1 on 2 | ~$116 | ~$25k |
| Hire or open a shop when it pays, keep $1,500 spare | 6 on 16 products | ~$505 | ~$62k |
| Buy everything as soon as affordable | 6 on 17 products | ~$490 | ~$50k |

Signing fees were doubled from a first try ($1,500–2,500), when the grower had bought everything by month 3 and cash piled up again. Now purchases spread to around day 120. One product (pet food) bankrupts the "grow" bot: it hires an out-of-home buyer on day 0 and switches on every profitable zone at once with $2,500 left. A human can do the same; the end screen's tip names it.

Not yet: a late-game money sink once everything is bought (more shops only help where they pay), and a playtest by hand on Hard.

### 6.13 What the player knows (difficulty, 2026-11-22)

- **Easy:** every place type's role is listed ("What you know" tab), the fit-score map layer, suggestions, and each neighborhood's score and estimates.
- **Hard** (the default; called Normal until 2026-11-23): the audience line plus the product's `hints`. A neighborhood's score and estimates unlock after 14 days of ads there (7 until 2026-11-23).
- The old **Hard** (audience line only, never any estimates) was removed on 2026-11-23: with so little to go on it was guessing more than deduction. Saved games on it carry on as Hard.

On Hard, the 7th day of ads in a neighborhood teaches one thing: the unknown place type with the most influence there (customer weight × density percentile; stockist or competitor weight × presence, saturating at 3 places; decoys at 0.2, so they come last and are revealed as "don't seem to matter"). A toast and the "What you know" tab say what it means, in plain English. Explanations in the zone panel only name place types the player knows, plus a count of how many more could matter.

### 6.16 Believable money, shops priced by place (2026-11-23)

**Every dollar ×10.** Playtest: "$25/day salaries" and a "$5,000 company" didn't read as real. Start cash $50,000, campaign fees $150/$100 a day, base running cost $400/day, hires $25k–60k to sign and $200–400/day (a $350/day salary is ~$128k a year), and the money-scale target `perfectDailyProfit` $3,000. The engine already calibrates ad prices and customers together against that target, so customers rose ×10 too and every ratio, best level and bot result is unchanged in shape (checked with `npm run report`: the same curves ×10). Order values are untouched: they're real-world prices. Saved games (version 5) are migrated by multiplying every money and customer figure by 10.

**Shops priced by neighborhood, several per neighborhood.** Playtest: "shops should not cost the same per location; you should be able to open more than one per region; multiple ones might lose you money". Now:
- Opening cost = $70,000 × (0.6 + 0.8 × busyness): about $42k in a quiet area to $98k downtown (fit-out and deposit). No more "each shop costs more than the last".
- Rent = $100 + $200 × busyness per day ($3k–9k a month), per shop.
- Up to 3 shops per neighborhood. Each extra one adds half what the previous one added (walk-ins and the sales boost both stack 1, 1.5, 1.75) but pays full rent and full price.
- One shop: walk-ins like 1.2× a Low out-of-home ad that never stops, and sales potential ×1.8 there.

Tuning (an ad-hoc script over all 20 products with a mid-sized team): the old numbers ×10 ($80k, rent $200–800) paid back within the run in almost no neighborhood, because a good neighborhood makes only a few hundred dollars a day. Several settings were tried (`npm run report` plus the payback check); the chosen one gives, per product, a median of ~5 neighborhoods where a first shop pays back within 180 days, a first shop losing money in ~3/4 of neighborhoods, and a second shop in a top-5 spot paying back within 90 days only ~7% of the time. A stronger setting (boost 1.0) let the perfect growth bot more than double its late-game profit with shops alone; this one adds ~40% ($5k → $7k/day by month 4–6). Easy shows each shop's expected gain per day; Hard leaves it to you.

### 6.17 Two build-up speeds, and a "building up" hint (2026-11-23)

Playtest: following every Easy suggestion still lost ~$1,000/day at day 12, and switching everything from Low to Medium went negative again. Both were the build-up (6.14): cost arrives at once, awareness over weeks. That's realistic for TV and outdoor (adstock half-lives of one to a few weeks are typical), but not for targeted digital, which converts within days and stops soon after spend stops.

- **Digital decays at 0.8/day** (half-life ~3 days, ~90% of full strength in 10 days); out-of-home stays at 0.93 (half-life ~10 days). Each day's digital pressure is scaled by (1 − 0.8)/(1 − 0.93) so full-strength reach per level is unchanged: every estimate, best plan and score is the same; only the path there differs. Old saves keep their pressure values (same units).
- Effect (`npm run report`, 20 products): a bot that stays alone on Low digital makes a median $820/day in month 1 (was $61); the growth bots end ~15–20% richer and no longer go bankrupt in any run (5 before). Out-of-home keeps its own advantages: spillover into neighbors, strength in busy areas and near stockists, and awareness that lingers after you stop.
- **Easy: ↗ in the top bar** next to yesterday's profit while any campaign is below 95% of its full-strength reach, showing profit per day once everything has built up (after running costs). The launch tray's expected profit now also subtracts running costs, so the two numbers agree.

Open: month 1 is now much gentler than the "first month is a squeeze" intent of 6.1/6.14. Check on Hard by hand whether it's now too easy.

## 7. Data pipeline (in the repo)

```
scripts/
  extract.py        # DuckDB over Overture GeoParquet on S3, SF bbox, latest release from the STAC catalog
  build_zones.py    # clips to zones, computes the inputs in 6.2, writes public/data/*
  categories.json   # product → demand/competitor labels and weights (section 5)
public/data/
  zones.geojson     # simplified zone polygons + id + name   (target < 1 MB)
  zones.json        # per-zone inputs: area, floorArea, transit, nAll, n[label] for used labels only
  examples.json     # up to 5 example place names per zone per used label, for the "why" panel
  meta.json         # Overture release, extraction date, counts, attribution text
```

- SF bounding box: roughly −122.52, 37.70 to −122.35, 37.83, then clipped to the SF locality.
- Only the per-zone aggregates ship to the browser, not raw places or buildings. Target total < 3 MB.
- The scripts are reruns-from-scratch and record the Overture release in `meta.json`.
- Attribution: "© Overture Maps Foundation, © OpenStreetMap contributors" on the map, per Overture's attribution page (buildings, divisions and base are ODbL).

## 8. App architecture

- **Stack:** Vite + React + TypeScript, MapLibre GL JS, OpenFreeMap basemap (free, no key). No backend.
- **Simulation is a pure TypeScript module** (`src/sim/`, done 2026-11-21: `world.ts` static per-zone numbers and calibration, `game.ts` daily step and events, `recommend.ts`, `explain.ts`, 51 Vitest tests in `sim.test.ts`, `npm run report` for a quick economy check): `initGame(seed, product, difficulty)`, `step(state, actions) → state`, `recommend(state)`, `explain(zone)`. Difficulty only gates what the UI shows; the economy is identical in both modes. No React, no DOM, so it can be unit-tested and run headless.
- **Seeded RNG** so a run can be reproduced from its seed (useful for debugging and tests).
- **Persistence:** game state in localStorage, wrapped in try/catch. If storage fails, the game still runs.
- **Tests (Vitest):** reach curve monotonic with diminishing returns, ads decay after stopping, competition lowers potential, bankruptcy triggers, recommendations never suggest a negative Δprofit action, same seed gives the same run.
- **Balance script (later, once the economy is in place):** `npm run balance` plays 200 seeded runs per product with three bots (do nothing, random, always-take-top-recommendation) and prints final cash. Target: top-recommendation > random > do nothing, do-nothing slowly loses money, random sometimes goes bankrupt, nobody gets rich by day 20.
- **Hosting:** static site on Render's free tier. Static sites don't sleep, so the first load is fast.

## 9. Build order

1. Extraction script → inspect SF zones, category counts and building heights. Decide neighborhoods vs hexes. *(Check this first: it's the biggest data unknown.)*
2. Simulation module + tests, before any UI. Balance script once there's enough logic to be worth balancing.
3. Map with score choropleth and the neighborhood "why" panel.
4. Game loop: top bar, ad buying, campaigns tab, recommendations (Easy).
5. Start and end screens (incl. Easy/Hard choice), first-run hints, events.
6. Polish, mobile check, deploy, README.

## 10. Data decisions (settled 2026-11-20 from `scripts/inspect_sf.py`, release 2026-11-18.0)

**Neighborhoods vs hexes → hexes, merged by name.** Overture has `division_area` outlines for only ~16 SF neighborhoods (Hayes Valley, SoMa, Noe Valley...), plus plazas; Marina, Castro, Mission, North Beach, Financial District etc. have no outline. The SF city outline exists, but as the *county* "San Francisco" (consolidated city-county), not a locality. Overture does have ~90 neighborhood/macrohood/microhood **label points**. So `build_zones.py`:
1. covers SF land with H3 res-8 hexes (~0.74 km²), clipped to the coast (183 hexes);
2. names each hex after the nearest label point (plazas excluded), or after a big park (Presidio, Golden Gate Park, Lake Merced, McLaren) covering ≥ 50% of it — the smallest park wins, so the Presidio isn't called "Golden Gate National Recreation Area";
3. drops 18 hexes: 11 nearly empty (< 200 est. people and < 10 places: coast, slivers) and 7 more than 1.5 km from any label (Treasure Island / Yerba Buena Island, a few coastal edges);
4. merges hexes with the same name into one zone → **76 zones** (inside the 30–120 target).
Trade-off: names are approximate (nearest-point boundaries, not official ones), and zone sizes vary (1–7 hexes). Merging was chosen over 165 hex zones named "Mission · NE 2": players think "buy ads in the Mission". Ad prices scale with people, so bigger zones aren't a free lunch. Treasure Island is a cut.

**Building heights → good.** 96% of SF buildings have `height`, 2% have `num_floors`. Floors = `num_floors`, else `round(height / 3.5)`, else 2, so People (H) is a reasonable proxy.

**Sparse labels.** `campus` and `kindergarten` have 0 SF places in this release and were removed from `categories.json`. Thin but kept as minor weights: `dog_park` 25, `swimming_pool` 23, `department_store` 23, `toys_and_games_store` 34, `shopping_mall` 35. Every product still has ≥ 2 demand labels with 100+ places, except pet food, which leans on `animal_or_pet_service` (226) and `park` (637). Watch it in the balance script.

**Duplicates and junk → minor.** 77.5k places in the box → 64k after: inside SF, confidence ≥ 0.5, not closed (3.8k were permanently closed), and same-name-within-30 m dedupe (142 removed).

**Output size:** 220 KB total in `public/data/` (target < 3 MB).

## 11. Improvements and future builds

### 11.1 Show more of the Overture data on the map (noted 2026-11-22)

*Partly done 2026-11-22: the picker now lists ~110 place types in 12 theme groups (all product signals plus extra place types for context and decoys), defined in `scripts/categories.json` under `layers`. The rest of this section is the original note.*

The "Color the map" picker lists **38 place types**. That isn't everything Overture has: it's the set `scripts/categories.json` needs for scoring (each product's demand and competitor signals), which `build_zones.py` keeps and nothing else. The picker was built on the same list. Counted from the raw SF download (`data/raw/places.parquet`, release 2026-11-18.0):

| | In Overture's SF slice | In the game today |
|---|---|---|
| Places | ~77,500 | ~64,000 inside the 76 neighborhoods, after confidence / closed / duplicate filters (section 10) |
| `basic_category` values | **260** | **38** labels (some match through `hierarchy`, not `basic_category`) |
| Distinct categories at any hierarchy level | ~1,560 | n/a |
| Buildings | ~160,000 (96% with height) | Used for the people estimate (floor area); not a map option |
| Transit stops | ~7,700 | Used in Busyness (6.3); not a map option |

Places by Overture's top-level group: services & business 31.5k, food & drink 9.4k, health care 8.1k, shopping 7.2k, lifestyle services 3.5k, community & government 2.9k, travel & transportation 2.8k, sports & recreation 2.6k, arts & entertainment 2.5k, education 2.1k, cultural & historic 1.8k, lodging 1.0k, no category 1.9k.

Big categories players can't map today: restaurants (5,400, the largest in SF), financial services (4,300), professional services, real estate, home services, health care (1,700), law firms, beauty-adjacent clinics, dental clinics (770), art galleries (670), places of worship (650), banks (510), hotels (490), flower and gift shops (480), hardware stores (900).

**Why it matters.** On Hard, the point is to work out where customers are from what's around. Hotels and restaurants say a lot about late-night snacks, clinics about skincare, universities and offices about cold brew. A list of only the scoring signals also gives away which categories the game counts, a small hint Hard mode doesn't need.

**Plan.**
1. **No pipeline change:** add "People per km²" (from building floor area) and "Transit stops per km²" as map options. Both are already in `zones.json`.
2. **Pipeline change:** in `build_zones.py`, count every `basic_category` per zone (not just the used labels) into a separate `n` map, or a separate file loaded only when the picker opens. Keep `examples.json` to the scoring labels: it's already 141 KB for 38 labels and would pass 1 MB for all of them.
3. **Picker:** 260 rows is too many for a flat list. Group by Overture's top-level category (the first `hierarchy` entry) with collapsed sections, keep search, and put a short "popular" set at the top. Hide categories with very few SF places (< ~20), which only show noise.
4. **Names:** `src/sim/labels.ts` has hand-written names for the 38 labels; the rest would fall back to the category id with underscores replaced. Write names for the most common ~60 and accept the fallback for the long tail.

**Cost.** Counts are sparse (most zones have 0 of most categories); an estimated +50–100 KB to the map data, against a 220 KB total today and a 3 MB budget. Needs a re-run of `build_zones.py`; the raw download is already on disk, so no new Overture download.

**Open choices.** All 260, or a curated ~80? Deeper `hierarchy` levels (e.g. "Thai restaurant" under "restaurant") would mean ~1,560 options. Probably not worth it in a game; search could still match them by rolling each up to its `basic_category`.
