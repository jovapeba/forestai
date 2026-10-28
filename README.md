# VERDANT — National Environmental Intelligence

**Zero-device sovereign environmental intelligence platform.**
`Vidi. Predvidi. Zaštiti.` — See. Predict. Protect.

VERDANT replaces physical IoT hardware (tree sensors, stream probes, GPS collars, LoRaWAN gateways)
with **real public-API data feeds** — €0 CapEx, instant territory deployment, 100% Earth coverage.

## Data policy — no simulated data anywhere

Every value displayed in the UI comes from a **real public API** or is a **transparent,
deterministic derivation of real API data** (labelled `DERIVED:*`). There is no seeded,
random or mocked fallback anywhere in the codebase: when a feed is unreachable the UI
renders an explicit **`UNAVAILABLE`** state and shows nothing rather than inventing values.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle → dist/
npx tsx scripts/smoke.ts   # real-feed smoke test (live-or-unavailable assertions)
```

## The Zero-Device Virtual Grid

| Traditional Hardware IoT | VERDANT |
|---|---|
| Millions (€ device fleets) | **€0** — public APIs only |
| Months to deploy | **Instant** — territory ingestion |
| Limited reach | **100% Earth coverage** |
| Battery swaps & maintenance | **Zero maintenance** |

**Lifecycle:** `Territory Ingestion → API Stream Normalization → Multi-Agency Dashboard`

## Data feeds (all open, all real)

| Layer | Feed | Availability logic |
|---|---|---|
| IGNIS · hotspots | **NASA FIRMS** SUOMI-VIIRS C2 global CSV — 24h window, then 48h (dev: proxied via `/firms-csv`) · optional bbox-scoped area API with a free MAP_KEY (`VITE_FIRMS_MAP_KEY`, register at firms.modaps.eosdis.nasa.gov/api/area) | `LIVE:NASA-FIRMS` · empty bbox = real zero · transport failure = `UNAVAILABLE` |
| IGNIS · weather | **Open-Meteo** current weather (global, no key) | `LIVE:OPEN-METEO` or `UNAVAILABLE` |
| IGNIS · FWI | Transparent Nesterov-style derivation from the live weather | `DERIVED:OPEN-METEO` |
| FLUVIA · global | **Copernicus GloFAS** modelled discharge via `flood-api.open-meteo.com` (7-day ensemble + climatological mean) | `LIVE:GLOFAS` — always labelled *model output, not an observed gauge* |
| FLUVIA · official gauges | 🇺🇸 **USGS NWIS IV** (`waterservices.usgs.gov`, param 00065) · 🇩🇪 **WSV Pegelonline v2** (`pegelonline.wsv.de`) · 🇬🇧 **UK Environment Agency** (`environment.data.gov.uk`) · 🇫🇷 **Hub'Eau hydrometrie** (`hubeau.eaufrance.fr`, anonymous/CORS-open; some datacenter egress gets 403) · 🇵🇱 **IMGW hydro** (`danepubliczne.imgw.pl`, ~913 stations, CORS-open, real per-station alarm/warning thresholds) · 🇨🇿 **CHMI Open Data** (`opendata.chmi.cz`, 563 stations, 10-min series + official 4-stage danger thresholds) · 🇳🇴 **NVE HydAPI** (`hydapi.nve.no`, free key — `VITE_NVE_API_KEY`) — all verified live | per-gauge `LIVE:*` · territories with no anonymous open network (🇸🇮 ARSO, 🇧🇷 ANA Hidroweb, 🇦🇺 BoM) show `UNAVAILABLE` — no readings are invented |
| FAUNA | **GBIF** species-match + occurrence search (global backbone) · **iNaturalist** recent georeferenced observations (`api.inaturalist.org`) · **OBIS** marine biodiversity (`api.obis.org` — Ocean Biodiversity Information System, >25 M records from museums/surveys/community datasets, CORS-open, no key) — all scoped to the territory bbox | `LIVE:GBIF` / `LIVE:INATURALIST` / `LIVE:OBIS` or `UNAVAILABLE` · **no collar telemetry is simulated** |
| Map · ocean (CMEMS) | **Copernicus Marine Service WMTS** (`wmts.marine.copernicus.eu/teroWmts`) — real ocean layers, anonymous, no key needed for visualization: sea-surface temperature (daily global forecast), sea-surface currents (vector style), sea-level anomaly — plus **GetFeatureInfo** click-readouts returning the real forecast value in physical units | tile layers + click popups · verified live incl. today's forecast step |
| ORBITA | **NASA GIBS** `MODIS_Terra_CorrectedReflectance_TrueColor` WMTS (real daily imagery) | always live imagery |
| CANOPY | **Open-Meteo** ERA5/CMAAS 4-layer soil moisture (0–1 / 1–3 / 3–9 / 9–27 cm) · **CAMS air quality** — EU AQI + PM2.5/PM10/O₃/NO₂/SO₂/CO (global, no key) · **CAMS city grid** — real EU-AQI/PM at 33 world cities from one batched request (map layer, all views) | `LIVE:OPEN-METEO` / `LIVE:CAMS-AQ-GRID` or `UNAVAILABLE` |
| Map · satellite AQ | **NASA GIBS VIIRS SNPP Deep Blue AOD** — daily aerosol optical depth (smoke · dust · haze column), global, no key | tile layer, verified live incl. same-day tiles |
| SENTRY | Incidents derived **only from real live data** — FIRMS detections, GloFAS exceedance, gauge trends · **USGS earthquake FDSN** (`earthquake.usgs.gov`, global, no key) · **NASA EONET** open natural events (`eonet.gsfc.nasa.gov`, global) · **GDACS** EU/JRC global alerts — cyclones · EQ · wildfires · volcanoes, incl. Africa/Asia (`www.gdacs.org/gdacsapi`, no key; flood-type endpoint is 404 upstream) · **MeteoAlarm CAP** official warnings for ~37 European countries incl. Czechia (`feeds.meteoalarm.org`, no key; proxy-first fetch) · **NOAA NWS active alerts** (US severe thunderstorm / tornado / flood warnings, no key) · **JMA Japan warnings** (`www.jma.go.jp/bosai`, official text-only — no geometry, so they surface in the SENTRY list, never plotted) | `no active incidents` when nothing qualifies — never a placeholder scenario · events without coordinates are listed, not fabricated onto the map |
| Map · rain radar | **RainViewer** public radar mosaic — global precipitation/thunderstorm cells, ~10-min refresh, no key (toggle `RAIN RADAR`) | `LIVE:RAINVIEWER` or `UNAVAILABLE` |
| Map · thunderstorm | WMO weather code 95–99 from the live Open-Meteo reading → ⚡ badge in IGNIS · radar cells on the map · official CAP/NWS warnings · **Open-Meteo `lightning_potential`** (J/kg, CAMS 15-min slots) → explicit lightning badge when > 0 | derived from live feeds |
| Map · US fire incidents | **NIFC/WFIGS** current wildland fire incidents (name, acres, % contained, cause) via `wildfiredata.dev` — hourly, public domain | `LIVE:US-FIRE-INCIDENTS` |
| Map · fire perimeters | **WFIGS** current perimeters — real GeoJSON polygons of the largest US fires via `wildfiredata.dev` | `LIVE:US-FIRE-PERIMETERS` |
| Map · drought | **US Drought Monitor** (weekly) — D0–D4 share of county area via `waterdata.dev drought-county` | `LIVE:US-DROUGHT-MONITOR` |
| Map · air quality | **US EPA** daily county AQI with category + defining pollutant via `airdata.dev` | `LIVE:EPA-AQI` |
| Map · JMA AMeDAS | **JMA AMeDAS** nationwide 10-min observation frame — all 1,286 Japanese stations with temp / rain 10m·1h·24h / wind / humidity and per-value quality flags (`www.jma.go.jp/bosai`, one request per frame, CORS-open, no key) | `LIVE:JMA-AMEDAS` (Japan view) · `NOT-APPLICABLE` in the global view and all other territories |
| Map · imagery/terrain | **Sentinel-2 cloudless 10 m** 2024 mosaic (EOX, free) · **Esri World Imagery** — real high-res satellite to ~0.3 m/px in cities (zoom 19; free access with attribution for non-commercial apps) · **OpenTopoMap** contour overlay (free) | tile layers with attribution · imagery toggles default OFF |

### Free API catalog — verified October 2026

**Anonymous, no registration (verified live):**
Open-Meteo (weather · soil · air quality · GloFAS flood) · NASA FIRMS CSV · NASA GIBS · NASA EONET ·
GDACS global alerts (TC/EQ/WF/VO) · USGS NWIS gauges · USGS earthquake FDSN · NOAA NWS active alerts ·
RainViewer radar · WSV Pegelonline v2 (DE) · UK Environment Agency (GB) · Hub'Eau (FR) ·
IMGW hydro (PL — 913 stations, CORS-open) · JMA bosai warnings (JP, CORS-open) ·
JMA AMeDAS observations (JP — 1,286 stations, CORS-open) ·
Open-Meteo CAMS air-quality city grid (33 cities, one batched request) ·
NASA GIBS VIIRS Deep Blue AOD (satellite aerosols, CORS-open) ·
**OBIS marine biodiversity** (`api.obis.org`, CORS-open) ·
**CMEMS WMTS ocean layers + GetFeatureInfo** (anonymous — a Copernicus Marine
account is only needed for bulk Toolbox downloads, not for map layers/point values) ·
SMHI metobs open catalog (SE, no key needed for station obs) · GBIF · iNaturalist.

**Free with registration (wire the key into `.env.local`):**
CARTO Basemaps (`VITE_CARTO_API_KEY`, carto.com/basemaps/apikey — used for the map canvas; raster tiles
require a key since 25 Sep 2026) · NASA FIRMS MAP_KEY (`VITE_FIRMS_MAP_KEY` — bbox-scoped fire API) ·
NVE HydAPI (`VITE_NVE_API_KEY`, Norway gauges) · eBird (`api.ebird.org`, recent real bird observations,
free key) · OpenAQ v3 (`api.openaq.org`, ground-station air quality, free key) · Copernicus Data Space
(free registration — real Sentinel-2 NDVI, replaces the visual filter) · Movebank (free research accounts
for collar telemetry — the only legitimate source for animal tracks).

**Verified not-anonymously-accessible:** 🇸🇮 ARSO (portal redirects to website, no anonymous API),
🇧🇷 ANA Hidroweb, 🇦🇺 BoM Water Data, CH hydrodaten (HTML only), CA Water Office, NL RWS (DOME API),
KR WAMIS (unreachable from public egress). SMHI metobs *data* is open keyless (verified) — only its
national hydrology (stage) lives elsewhere; Sweden still has no integrated stage network.

### Country sweep — Europe & Asia (probed October 2026)

**National open feeds verified live this round:** 🇨🇿 CHMI hydro (563 gauges, integrated) ·
🇱🇹 meteo.lt (station obs + forecasts, open, no key) · 🇮🇩 BMKG earthquakes (felt reports,
open) · 🇭🇰 HKO open data (CORS-open).

**Anonymous-national-source exists but integration pending (open, verified):** 🇸🇪 SMHI metobs
(weather obs), 🇱🇹 meteo.lt obs, 🇮🇩 BMKG, 🇭🇰 HKO — small national scope vs. the global feeds
already covering them; add on demand.

**Probed with no anonymous national API (404 / SPA shell / HTML-only / egress-blocked):**
🇦🇹 GeoSphere datahub, 🇧🇪 waterinfo, 🇧🇬 NIMH, 🇭🇷 DHMZ, 🇨🇾, 🇩🇰 DMI (key), 🇪🇪 ilmateenistus
(legacy 000), 🇬🇷 OGA/YPEKA, 🇭🇺 vizugy, 🇮🇪 Met Éireann/EPA hydronet, 🇮🇹 regional SAIH APIs,
🇱🇻 LVĢMC, 🇱🇺, 🇲🇪 IHMS, 🇲🇰, 🇲🇹, 🇵🇹 SNIRH, 🇷🇴 INHGA, 🇷🇸 RHMZ, 🇷🇺 Roshydromet, 🇸🇰 SHMÚ,
🇪🇸 basin SAIHs, 🇹🇷 AFAD/MGM (SPA), 🇺🇦 UHMI, 🇱🇮, 🇦🇲, 🇦🇿, 🇰🇿, 🇰🇬, 🇹🇯, 🇹🇲, 🇲🇳, 🇲🇻, 🇧🇹,
🇦🇫, 🇸🇦, 🇦🇪, 🇴🇲, 🇱🇧, 🇯🇴, 🇹🇼 CWA (key), 🇰🇷 KMA (key), 🇸🇬 NEA (key), 🇮🇳 WRIS (key),
🇵🇭 PAGASA, 🇹🇭 RID, 🇻🇳, 🇲🇾, 🇳🇵, 🇮🇱 IMS (key).

**Reality check:** a dedicated anonymous national feed does NOT exist for every country —
closed systems dominate the Balkans, Central Asia, the Gulf, and much of South/Southeast Asia.
However, **every country on Earth is covered by the platform's global feeds**: NASA FIRMS
fire detections · USGS earthquakes · NASA EONET · GDACS alerts · RainViewer radar ·
Open-Meteo CAMS weather/soil/AQ (incl. the 33-city air grid) · NASA GIBS imagery+AOD ·
GBIF species records (per-country country-scoped query). Registration-free, verified,
coordinate-true — the honest baseline is planet-wide even where no national API exists.

**No usable file feed (probed):** wildfiredata.dev `smoke` (NOAA HMS) publishes metadata but no
files; direct NOAA HMS endpoints (satepsanone/ospo) answer 403 to server fetches — smoke plumes stay
`UNAVAILABLE` until an accessible mirror exists. GDACS flood-type event list returns 404 upstream.
EFFIS (EU fire danger) moved to `forest-fire.emergency.copernicus.eu` app-hosts — no documented
anonymous API (portal offers a manual data-request form instead). CH hydrodaten / AT eHYD / CZ CHMI
hydrodata / BE waterinfo / FI SYKE serve HTML or SPA bundles without a documented anonymous JSON API.

Note: MeteoAlarm emits no CORS headers — in production host the `/meteoalarm` proxy on your server
(same for the FIRMS CSV unless the MAP_KEY path is used). The bundled nginx image handles all four
(`/firms-csv`, `/meteoalarm`, `/hubeau`, `/chmi`, `/gdacs`). The feed orchestrator additionally
re-tries any feed that ended genuinely `UNAVAILABLE` twice (at +4 s and +13 s) before giving up,
so a cold CDN edge or a brief proxy hiccup doesn't strand a feed for the session.

### Docker deploy (bundled)

The image is a two-stage build: Node compiles the SPA (`tsc --noEmit && vite build`), then
nginx serves `dist/` **plus the same-origin feed proxies** (`/firms-csv`, `/meteoalarm`,
`/hubeau`, `/chmi`, `/gdacs`) — so the no-CORS feeds resolve live in production. Without the
proxy paths the app still runs and degrades honestly.

**Routes:** the marketing site lives at `/` (hash anchors `#virtual-grid`, `#modules`, …) and the
dedicated full-screen map at **`/#global-map`** — worldwide fires, earthquakes, GDACS alerts, the
CAMS air grid and every official gauge network edge-to-edge (mobile-friendly: floating LAYERS
sheet + scrollable legend).

```bash
# quickest
docker build -t verdant .
docker run -d -p 8080:8080 --name verdant verdant

# with the optional free keys baked in (Vite envs are build-time)
docker build -t verdant \
  --build-arg VITE_CARTO_API_KEY=... \
  --build-arg VITE_FIRMS_MAP_KEY=... \
  --build-arg VITE_NVE_API_KEY=... .

# or compose (reads .env — copy .env.example to .env)
docker compose up -d --build
```

- Port `8080` (map to whatever you like), `/healthz` probe for orchestrators.
- Image ≈ 79 MB (`node:22-alpine` build → `nginx:1.27-alpine` runtime).
- Caveats: upstream rate limits still apply (a 429 shows `UNAVAILABLE`), and Hub'Eau's WAF
  403-blocks some hosting-provider egress ranges — from those networks French gauges stay
  honestly `UNAVAILABLE` while everything else runs. Keys end up in the image, so build
  privately rather than pushing the image publicly.

Every request races a timeout (`fetchWithTimeout`). Feed provenance is surfaced in the UI
via `SourceChip`: `● LIVE:*` (direct public-API link), `△ DERIVED:*` (pure derivation of
live inputs), `✕ UNAVAILABLE` (explicit no-data state).

## Architecture

```text
src/
├── components/
│   ├── layout/      Header · Footer · LanguageBar
│   ├── hero/        HeroSection (radar sweep, counters)
│   ├── scanner/     TerritoryScanner (6 sovereign presets)
│   ├── map/         EnvironmentalMap · LayerControl · Recenter
│   ├── modules/     CoreModulesGrid · ForestConsole · FireSentinel
│   │                WaterHydrograph · AnimalTelemetry · SatelliteViewer
│   ├── command/     CommandCenterSimulator (real-event SITREP engine UI)
│   ├── comparison/  HardwareVsVirtualTable
│   ├── sections/    BenefitsSection
│   ├── pilot/       PilotSection · PilotRequestModal (4-step + PDF)
│   └── ui/          bits (StatusBadge, SourceChip, SectionHeading, hooks)
├── services/
│   ├── api/         openMeteo · flood · waterLevel (USGS/WSV/UK-EA) · wildlife (GBIF/iNat) · satellite · hazard · http
│   ├── aiSynthesisService.ts   real-event incident derivation + SITREP
│   └── pdf.ts       minimal valid single-page PDF builder
├── data/            territoriesData (factual presets) · translations
├── hooks/           useLiveFeeds (concurrent live-feed orchestration, no fallbacks)
├── store/           useAppStore (Zustand: territory · lang · layers · modal)
└── types/           environmental.ts
```

## Territories

🇸🇮 Slovenia (Ptuj · Triglav · Drava) · 🇩🇪 Germany (Black Forest · Rhine) ·
🇺🇸 USA (Sierra Nevada · Colorado Basin) · 🇧🇷 Brazil (Amazon · Pantanal) ·
🇦🇺 Australia (NSW Bushfire Corridor) · 🇬🇧 United Kingdom (Thames · EA gauge network)

Languages: SR · SL · EN · DE · AR (RTL) · ZH.

> Disclaimer: VERDANT is an environmental intelligence platform powered by open satellite,
> meteorological, hydrological and biodiversity feeds. No proprietary hardware is required,
> and no measurement is ever simulated — unavailable feeds are stated as unavailable.
