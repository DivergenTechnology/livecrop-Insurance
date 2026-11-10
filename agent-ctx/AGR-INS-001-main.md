# Task ID: AGR-INS-001
# Agent: main (Z.ai Code)
# Project: Agricultural Insurance System (Next.js 16 + TypeScript)

## Summary

Built a complete full-stack Agricultural Insurance System per the implementation
plan: 5 modules (Spatial Plot Registry, Livestock Biometrics, Satellite Telemetry
Oracle, Stage × Depth Loss Engine, Mobile Money Settlement) integrated into a
single Next.js 16 app served from the `/` route via a 7-tab UI.

## Files created

### Prisma schema
- `prisma/schema.prisma` — 9 models: Farmer, FarmPlot, LivestockAsset,
  CropVariety, CropStageVulnerability, Policy, TelemetryReading,
  InsuranceClaim, Settlement.

### Lib utilities (`src/lib/`)
- `loss-engine.ts` — `calculateCropClaimPayout` (EXACT algorithm from the
  plan: replant cap check + FAO Ky scoring) and `determineStage`.
- `spatial.ts` — `toTurfPolygon`, `isValidPolygon`, `checkOverlap` (using
  turf.booleanOverlap + booleanContains + intersect fallbacks), `getBBox`.
- `muzzle.ts` — `generateMuzzleHash` (512-dim deterministic vector via
  FNV-1a + Mulberry32 PRNG), `cosineSimilarity`, `findDuplicate` (>0.95).
- `ndvi-simulator.ts` — `generateReadings` (60-day seasonal NDVI curve:
  0.2 emergence → 0.8 peak → 0.5 maturity, with Gaussian noise; daily
  rainfall with mostly low + occasional spikes) and `evaluateParametricTriggers`
  (NDVI < 0.30 OR 14-day rainfall < 5mm).

### API routes (`src/app/api/`)
- `farmers/route.ts` — GET (list with counts), POST (create)
- `plots/route.ts` — GET (list with overlap detection per plot), POST
  (validate polygon, run turf overlap check, 409 on collision, auto-compute
  area from polygon)
- `plots/check-overlap/route.ts` — POST preview endpoint
- `livestock/route.ts` — GET (list), POST (uniqueness check, muzzle
  generation, cosine-similarity duplicate scan)
- `varieties/route.ts` — GET (list with stages)
- `policies/route.ts` — GET (list with relations), POST (premium =
  sumInsured × 5% crop / 8% livestock, 1-year coverage default)
- `telemetry/route.ts` — GET (readings + trigger evaluation per plot)
- `telemetry/seed/route.ts` — POST (regenerate 60 days for all plots)
- `telemetry/alerts/route.ts` — GET (parametric triggers across all plots)
- `claims/route.ts` — GET (list with policy+settlement), POST (file claim)
- `claims/assess/route.ts` — POST (run loss engine, update claim to ASSESSED)
- `claims/approve/route.ts` — POST (ASSESSED → APPROVED)
- `claims/reject/route.ts` — POST (any → REJECTED)
- `settlements/route.ts` — GET (list), POST (disburse via mock rail:
  random 10-char ref, 90% success / 10% failure, mark claim PAID on success)
- `dashboard/route.ts` — GET (aggregate KPIs + recent activity)

### Seed script
- `scripts/seed.ts` — idempotent (clears first), creates 4 varieties × 4
  stages each (Maize/Wheat/Rice/Soybean with FAO Ky factors), 3 farmers
  (Central Highlands, Rift Valley, Coastal Region), 4 plots (2 deliberately
  overlapping in Nyeri), 3 livestock (dairy/beef/poultry), 2 policies
  (1 crop on Maize/Nyeri Block A with 75-day-old coverage, 1 livestock),
  240 telemetry readings (60 days × 4 plots).

### UI (`src/app/page.tsx` + `src/components/agri/`)
- `page.tsx` — header (deep forest green #0C3B2E) + 7 Tabs + sticky footer.
- `agri/shared.tsx` — types, fetcher, money/date formatters, status badges.
- `agri/plot-preview.tsx` — SVG canvas projecting all polygons onto a
  shared bbox; overlapping polygons in red.
- `agri/dashboard-tab.tsx` — 6 KPI cards + claims-by-status + active
  telemetry alerts + recent activity feed.
- `agri/plots-tab.tsx` — plot table with overlap badges + Register dialog
  (farmer/name/area/soil/GeoJSON textarea) + SVG overview.
- `agri/livestock-tab.tsx` — livestock table + Register dialog + duplicate
  warning toast.
- `agri/policies-tab.tsx` — policy table + Underwrite dialog (CROP shows
  plot+variety, LIVESTOCK shows livestock) + live premium preview.
- `agri/telemetry-tab.tsx` — plot selector grid + NDVI line chart (with
  0.30 trigger reference line) + rainfall bar chart + alert summary +
  Generate/Refresh button.
- `agri/claims-tab.tsx` — claim table + File dialog (policy, incident date,
  damage depth slider) + Assess button (opens loss-engine breakdown dialog
  with sumInsured, Ky, stage, payout type, severity progress) + Approve/Reject.
- `agri/settlements-tab.tsx` — disbursement queue + Disburse dialog
  (rail picker) + settlement ledger + result dialog with reference.

## Key fixes during build

1. The `lucide-react` package does not export a `Cow` icon — replaced with
   `Beef` everywhere.
2. Prisma's `findMany({ select: { id, boundaryGeoJson } })` returns objects
   with the field name `boundaryGeoJson`, but my `checkOverlap` signature
   expected `geoJson`. Mapped the rows explicitly in `plots/route.ts` and
   `plots/check-overlap/route.ts` — the bug was silent because I'd used an
   `as never` cast that bypassed TypeScript.
3. Switched the layout's Toaster from the radix `@/components/ui/toaster`
   to `@/components/ui/sonner` so toast notifications render.

## End-to-end verification

Tested via curl after fixes:
- POST /api/plots with overlapping polygon → 409 with overlappingIds. ✓
- POST /api/plots with isolated polygon → 201. ✓
- POST /api/livestock with existing tag → 409. ✓
- POST /api/claims → claim created. ✓
- POST /api/claims/assess → stage=FLOWERING, Ky=1.3, daysSown=64,
  damageDepth=0.6 → effectiveLossRatio=0.78 → payout=93,600 (FULL_INDEMNITY).
  Verified manually: min(1.0, max(0, 0.6 × 1.3)) = 0.78; 120,000 × 0.78 = 93,600. ✓
- POST /api/claims/approve → status=APPROVED. ✓
- POST /api/settlements → 10-char reference returned; 90/10 success/fail. ✓

## Lint & runtime

- `bun run lint` → 0 errors, 0 warnings.
- `bun run db:push` → schema applied.
- `bun run scripts/seed.ts` → all demo data created.
- `dev.log` shows `GET / 200` and `POST /api/... 200/201/409` with no
  runtime errors after fixes.

## Limitations (documented for end user)

1. **Muzzle biometric**: per the spec, the 512-dim embedding is derived
   deterministically from tag ID + salt. Since the unique-tag constraint
   blocks re-registration of the same tag, the >0.95 cosine-similarity
   duplicate scan will essentially never fire in normal operation. A real
   CNN analysing muzzle pattern *images* of the same animal would produce
   near-identical embeddings even with different tag IDs — that behaviour
   is not reproduced here.
2. **Mobile money**: 90% PAID / 10% FAILED with random 10-char reference.
   No actual M-Pesa/MTN/Airtel API is called.
3. **Telemetry**: mock Sentinel-2 NDVI following a fixed seasonal curve
   with Gaussian noise. No real satellite imagery is processed.
4. **Spatial**: SQLite + turf.js is fine for plot-scale polygons but
   doesn't scale to millions of plots or use a real spatial index. The
   plan's `ST_Intersects` PostGIS approach is the production target.
5. **Area recompute**: the API recomputes areaHectares from the polygon
   via `turf.area`, overriding whatever the user typed. The seed script
   sets areaHectares directly (bypassing the API), so seeded plots show
   the curated "4.2 ha" while user-registered plots show the measured area.
