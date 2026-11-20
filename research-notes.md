# Overture Maps research notes

Collected 2026-11-20. Data release at the time: 2026-11-18.0.

## The data in plain English
- **Places (~88M):** businesses/POIs. Fields: name, `basic_category` (~280) / `taxonomy` (~2,300), website, phone, email, socials, brand, address, operating_status, confidence (0-1, existence only). No hours, reviews, ratings, prices, photos, foot traffic. Known duplicates and junk; filter by confidence. Mostly from Meta, then BrightQuery, Microsoft, Foursquare. No OSM data. License CDLA Permissive 2.0 / Apache 2.0.
- **Buildings (~2.6B):** footprints, some heights, building parts. Many ML-derived (less precise). ODbL.
- **Transportation (~740M km):** routable road/path/rail graph (segments + connectors), road class, speed limits, access restrictions. OSM + TomTom. ODbL.
- **Addresses (~475M, alpha):** 41 countries, partial in US. IDs unstable.
- **Divisions (~5.8M):** countries down to neighborhoods (neighborhoods patchy). ODbL.
- **Base:** water, land, land use, land cover, infrastructure incl. transit stops, bathymetry. ODbL.
- **GERS:** stable IDs for places, buildings, roads, divisions, so other data can be attached.
- Access: GeoParquet on S3/Azure (query by bbox with DuckDB), STAC catalog for latest release, PMTiles via overture-tiles.
- Independent audit (Echo Analytics, 2024): 0-50% of places "reliable" (conf > 0.85) in top countries; ~half of mid-confidence places >100 m off; brands undercounted.

## How companies use it
- Meta: Facebook/Instagram basemaps (base, buildings).
- Microsoft: Bing/Azure Maps buildings layer replaced July 2024; addresses, divisions, base.
- Esri: default buildings/boundaries in ArcGIS; joined FEMA USA Structures by GERS ID (98% match).
- TomTom: supplies transportation; uses places in Orbis.
- Addresscloud: per-building flood risk scores for insurers (300M buildings, <200 ms).
- Precisely: GERS link tables for data merging.
- Startups (Overture 2026 roundup): Shovels (roof permits to buildings), Monarcha (natural-language map search), Aino (site analysis), Atlas (AI GIS), Zephr (imagery validation of places), inHotel, Contour, VOYGR, Fused, Seer.ai.

## Personal GitHub projects (129 repos across topics overture-maps / overturemaps / overture; ~35 build something)
Verified in README (Overture actually used): Vela (2.8k stars, Android nav), place2mc (Minecraft worlds), next-gen/WorldSeed (3D worlds), Onward-generator (VR maps), dioramap (pixel-art posters), building-explorer, leadshoot (business leads), AeroScan (rooftop ROI), foul-flock (ALPR cameras vs siting laws), neighborhood-dna (neighborhood profile).
Others by description: green-city-map (street livability score), kartograf (ask-a-city LLM SQL), di-dau-day (where to go, Vietnam), ascension-smartwalk (AI walk planner), overture-route-search-api (drive-time reach), phantom-hospitals-overture, resist-one-road-out (wildfire escape routes), geotoon (anime 3D streets), many lead-gen tools.

Takeaways:
- Crowded: lead gen, 3D/game worlds, plain POI viewers.
- Open: routing/reachability, livability/accessibility scoring, civic investigations.
- Few are polished, deployed products. A deployed, clean app with a clear user is rarer than you'd expect.
- A common pattern in the stronger projects: Overture + one outside dataset (flood, census, permits).
