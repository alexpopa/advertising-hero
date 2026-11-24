# Advertising Hero

**Launch a brand and grow it by buying ads across San Francisco's real neighborhoods, where every neighborhood's value comes from an open map of what's actually there.**

Advertising Hero is a small tycoon game that runs in the browser. You borrowed $500,000 to build your product and $50,000 of it is left. You have 180 game days to pay the bank back, and the way to do it is to work out where your next ad dollar is worth the most. A gym-heavy corner of SoMa is great for protein powder and useless for baby gear. Downtown is packed with people, but its ads are priced to match. The quiet, cheap neighborhood with exactly your audience is the one worth finding.

**[Play it in your browser](https://ad-empire-sf.onrender.com)**: free, no account. (The address is from the game's working title, Ad Empire SF.)

## How it plays

1. **Pick a product:** 20 of them, from cold brew subscriptions and protein powder to houseplant delivery, e-bike rental and city tours. Each is tagged Starter, Tricky or Expert depending on how many surprises it hides.
2. **Pick a difficulty:** **Easy** shows everything: which places draw your buyers, which stores carry you, who you're up against, plus suggestions. **Hard** (the default) tells you who your buyers are and one or two places that matter, and you learn one new thing every time you run ads in a neighborhood for two weeks ("Juice bars compete with you: they take sales nearby").
3. **Read the map:** color it by any of ~110 kinds of places (gyms, bars, pharmacies, hotels, schools…), alone or added together. Some places draw your buyers, some stores sell your product, some compete with it, and some just look relevant. Click a neighborhood to see what's there and what ads cost.
4. **Buy ads:** for each neighborhood set **out-of-home** (billboards, bus shelters, posters: strongest in busy areas and near stores that sell you, priced at a downtown premium) and **digital** (targeted ads that follow where your buyers are, no downtown premium) separately to Off, Low, Medium or High. Each channel costs its own money and reaches its own people. Digital ads reach full strength in about a week and fade within days of stopping; out-of-home ads take about a month and linger for weeks. Both have diminishing returns; out-of-home ads also spill over a little into neighboring areas. Every campaign has a daily fee, so advertising everywhere is the fastest way to go broke.
5. **Grow:** you start alone, able to buy only Low digital ads. Profit pays for hires: an out-of-home buyer, then senior and lead buyers in each channel, each unlocking the next level for good, at a signing fee and a daily salary. Or open your own shops: the price depends on the neighborhood (busy downtown spots cost the most), each brings walk-ins and more sales there for daily rent, and you can open up to three in one neighborhood, though each extra one adds less than the last.
6. **Pay back the bank:** the day your cash reaches $500,000 the loan is paid automatically and you win. That day is your score, and your browser keeps your best day for each product. Afterwards you can keep playing with no deadline. Miss day 180, or run out of cash for three days, and the bank takes everything. The end screen shows your team and shops, your best and worst neighborhoods, and your cash over time.

## Where the numbers come from

The map comes from [Overture Maps](https://overturemaps.org/), an open dataset of places, buildings, transit and boundaries. For each neighborhood the game uses:

| Input | From |
|---|---|
| Estimated people who live or work there | building footprints × floors (96% of SF buildings have a height) |
| How well it fits your product | counts of related places, e.g. gyms, preschools, bars, pet services |
| Stores that carry your product | counts of stockists, e.g. pharmacies, grocery stores, pet stores; they raise sales and help out-of-home ads |
| Competition | counts of competing stores; chains count extra |
| Busyness (raises ad prices, helps out-of-home ads) | transit stops and overall place density |
| Example businesses in the "why" panel | real place names |

Overture has no sales, rent or foot-traffic figures, so the economy itself (prices, purchase rates) is invented. Each product is calibrated so that it's equally winnable, and the map data decides where the money is. The inputs are real, and the game always shows why a neighborhood scores the way it does. Full scoring model: [DESIGN.md](DESIGN.md).

## How neighborhoods are made

Overture names about 90 San Francisco neighborhoods but only draws outlines for about 16 of them, so the game builds its own:

1. Cover the city's land with ~0.74 km² hexagons ([H3](https://h3geo.org/)), clipped to the coastline.
2. Name each hexagon after the nearest Overture neighborhood point, or after a big park (Presidio, Golden Gate Park, Lake Merced, McLaren) if it's mostly park.
3. Drop nearly empty hexagons and ones too far from any named neighborhood.
4. Merge hexagons with the same name.

The result is **76 neighborhoods** in about 220 KB of data, small enough to ship straight to the browser.

## Design choices and things left out

- **Neighborhood names are approximate.** Boundaries follow the nearest named point, not official lines, so a few areas are bigger or smaller than locals would draw them.
- **Treasure Island isn't in the game.** Overture has no neighborhood name anywhere near it.
- **Money needed a reason.** Early versions were a puzzle you solved in the first few weeks: once your good neighborhoods were running, extra cash had nothing to buy. Now you start alone with cheap digital ads, and profit pays for buyers who unlock stronger ads, and for shops of your own. I tried monthly profit goals (a star and a bonus each month) to set the pace and cut them: they were arbitrary numbers that didn't connect to any decision on the map. Saving up for the next hire or shop is the goal.
- **One way to win: pay back the bank.** Making money had no finish line. I looked at how other tycoon games end (scenario targets with a deadline, star ratings, market share) and first considered "half of San Francisco knows your brand". I dropped it because it would reward advertising everywhere, which the rest of the game teaches you not to do. A loan does the opposite: $500,000 by day 180 explains the starting cash, the deadline and why the game ends, and it rewards exactly the skill the game is about. To tune it, I added a "realistic player" bot (finds good neighborhoods gradually, wastes money early, decides on hires only weekly) next to the perfect one, and raised sales in every neighborhood by 20% rather than lowering the target. Now a perfect run pays off around day 116, a realistic one wins a bit under half the time, and a player who never hires anyone can't win. The score is only the day you paid; nothing else counts.
- **Shops are a bet on a place, not a power-up.** A shop in the right neighborhood pays for itself in a couple of months; in most neighborhoods it never does, and a second or third shop in the same place usually loses money because it pays full rent for half the extra sales. That makes "where do I open?" a real question instead of "always buy the shop".
- **Numbers sized like a real small business.** $50,000 to start, buyers on roughly $75k–130k a year, storefronts at $3k–9k a month. Overture has no sales or rent data, so these are invented, but at this scale they read as plausible; earlier the same economy at a tenth of the size ($25/day salaries) felt like a toy.
- **Ads build up like real ones, at two speeds.** Costs start the day you buy; sales build as people see the ads again and again (what marketers call adstock or carryover). Billboards and posters build over about a month and linger; targeted digital ads work within days and stop soon after you do. So doubling a campaign means a short dip before the extra sales arrive. Easy mode shows a ↗ with the profit you're heading for while ads are still building.
- **Hiring stays simple.** A hire does one thing: it unlocks the next ad level in one channel. No skills, morale or firing. Hires are permanent, so each one is a real bet. Shops are one-off bets on a single neighborhood, with no stock or staff to manage.
- **Two difficulties, not three.** A third level that told you almost nothing was mostly guessing, not deduction. Hard (the default) gives you a starting clue and lets you learn the rest by advertising; Easy shows everything.
- **The neighborhood card stays short.** Your ads and the shop you're saving for are always visible; everything you've learned about the area folds away behind one click. Buy buttons fill up as you save towards them.
- **Difficulty changes what you know, not the numbers.** The economy is the same on every level. Harder levels hide which places matter, and you find out by advertising. That keeps the map honest: every clue is real Overture data.
- **Some places are red herrings on purpose.** Juice bars look like protein buyers but compete with you; condos look like laundry customers but have washers. Which place does what is a design choice for each product, kept in one file (`scripts/categories.json`), not a claim about the real world.
- **No random events for now.** Street fairs, rival campaigns and price spikes landed in random neighborhoods, usually ones you weren't advertising in, and were over before slow-building ads could react. They added noise, not decisions, so they're out until they can be made to matter.
- **Two ad channels, each with its own level and its own job.** Earlier versions had up to four formats plus a weekly schedule per campaign; they balanced, but every neighborhood became three decisions. Then a cut-down version made one channel a cheaper copy of the other that never won, which was pointless. Now out-of-home (the industry term for billboards and posters) follows foot traffic and stores, digital follows your buyers with no downtown premium, and the best neighborhoods are worth both, often at different levels.
- **One city.** San Francisco keeps the data small and lets the balance be tuned against one map.
- **No accounts or leaderboards.** Progress is saved in your browser, so there's no server to run.
- **The map shows about 110 of Overture's 260 place categories:** everything the products use, plus related places that give context (or mislead). Banks, law firms, places of worship and the long tail are left out to keep the picker short.
- **The data is precomputed,** not queried live: a one-time script turns millions of map records into a few small files.

## Run it

Needs Node.js.

```bash
npm install
npm run dev       # the game at http://localhost:5174
npm test          # 173 tests for the game rules
npm run report    # how a few simple strategies do over 180 days, per product, and when bots pay off the loan
```

## Run the data pipeline

Needs Python 3.9+.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/extract.py        # downloads the SF slice of Overture into data/raw/ (~1-2 min)
python scripts/inspect_sf.py     # optional: data-quality report
python scripts/build_zones.py    # writes public/data/
```

| File | What it is |
|---|---|
| `scripts/extract.py` | Reads Overture's cloud GeoParquet with DuckDB: places, buildings, transit stops, boundaries, parks |
| `scripts/build_zones.py` | Builds the neighborhoods and per-neighborhood inputs |
| `scripts/categories.json` | Products and what each place type does for them (customers, stockists, competitors, decoys), weights, map groups (easy to tune) |
| `public/data/` | `zones.geojson`, `zones.json`, `examples.json`, `meta.json` |

## Roadmap

- [x] Data pipeline and neighborhoods
- [x] Simulation engine with tests
- [x] Balance report: bots play each product to tune the economy (`npm run report`)
- [x] Map with fit colors and a "why this neighborhood" panel
- [x] Game loop: ad buying, campaigns, Easy-mode suggestions
- [x] Start and end screens, hints
- [x] Deployed as a static site
- [ ] More hand playtesting and polish

Later:
- [x] 20 products with stockists, red herrings, out-of-home and digital ads, and two difficulty levels
- [x] Growth: hire buyers to unlock ad levels, open your own shops
- [ ] Color the map by people and transit stops per km² (plan in DESIGN.md 11.1)

Built with Vite, React, TypeScript, MapLibre GL, hosted as a static site.

## Credits

Map data © [Overture Maps Foundation](https://overturemaps.org/), © OpenStreetMap contributors. Release `2026-11-18.0`.
