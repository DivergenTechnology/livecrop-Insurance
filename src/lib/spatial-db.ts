// src/lib/spatial-db.ts
// Spatial database abstraction layer.
//
// In production (Postgres + PostGIS), this module issues raw SQL queries that
// use ST_Intersects, ST_Area, ST_Contains, ST_Within, ST_Distance, etc.
// In dev (SQLite, no PostGIS), it falls back to turf.js for the same operations.
//
// The API is identical regardless of backend, so application code never needs
// to know which database is running.

import * as turf from '@turf/turf';
import { db } from '@/lib/db';
import { toTurfPolygon, type GeoJsonPolygon } from '@/lib/spatial';

// ──────────────────────────────────────────────────────────────────────────
// Detect backend: Postgres → PostGIS available; SQLite → use turf fallback.
// ──────────────────────────────────────────────────────────────────────────

let _isPostGIS: boolean | null = null;

async function isPostGIS(): Promise<boolean> {
  if (_isPostGIS !== null) return _isPostGIS;
  try {
    // Probe the datasource provider by attempting a PostGIS-only query.
    // On SQLite this will throw; on Postgres+PostGIS it returns a row.
    const result = await db.$queryRaw`SELECT PostGIS_Version() AS version` as Array<{ version?: string }>;
    _isPostGIS = !!(result[0]?.version);
  } catch {
    _isPostGIS = false;
  }
  return _isPostGIS;
}

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface PlotSpatialRecord {
  id: string;
  plotName: string;
  farmerId: string;
  farmerName: string | null;
  region: string | null;
  cropType: string | null;
  areaHectares: number;
  boundaryGeoJson: string; // raw GeoJSON string as stored
  centroid: { lon: number; lat: number };
  overlappingIds: string[];
}

export interface DamageMapFeature {
  type: 'Feature';
  geometry: GeoJSON.Polygon;
  properties: {
    plotId: string;
    plotName: string;
    farmerName: string | null;
    region: string | null;
    cropType: string | null;
    areaHectares: number;
    overlappingIds: string[];
    // Damage assessment (from claims + telemetry)
    hasActiveClaim: boolean;
    claimCount: number;
    latestClaimStatus: string | null;
    latestDamageDepth: number | null;
    latestPayout: number | null;
    calculatedPayout: number; // sum of all approved/paid claims
    imageAnalysisSeverity: number | null;
    imageAnalysisDamageType: string | null;
    // Telemetry
    latestNdvi: number | null;
    ndviAlert: boolean;
    rainfall14d: number | null;
    droughtAlert: boolean;
    // Composite damage score (0–1)
    damageScore: number;
    damageLevel: 'none' | 'low' | 'moderate' | 'severe' | 'total';
  };
}

export interface DamageMapResponse {
  type: 'FeatureCollection';
  features: DamageMapFeature[];
  bbox: [number, number, number, number] | null; // [minLon, minLat, maxLon, maxLat]
  summary: {
    totalPlots: number;
    plotsWithClaims: number;
    plotsWithAlerts: number;
    totalPayout: number;
    averageDamageScore: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function parsePolygon(geoJsonStr: string): turf.Feature<turf.Polygon> | null {
  try {
    const obj = JSON.parse(geoJsonStr);
    return toTurfPolygon(obj as GeoJsonPolygon);
  } catch {
    return null;
  }
}

function computeCentroid(feature: turf.Feature<turf.Polygon>): { lon: number; lat: number } {
  try {
    const c = turf.centroid(feature);
    const [lon, lat] = c.geometry.coordinates;
    return { lon, lat };
  } catch {
    // Fallback: average of the outer ring coordinates
    const ring = feature.geometry.coordinates[0];
    if (!ring || ring.length === 0) return { lon: 0, lat: 0 };
    let sumLon = 0, sumLat = 0;
    for (const [lon, lat] of ring) { sumLon += lon; sumLat += lat; }
    return { lon: sumLon / ring.length, lat: sumLat / ring.length };
  }
}

function computeAreaHectares(feature: turf.Feature<turf.Polygon>): number {
  try {
    const sqMeters = turf.area(feature);
    return Number((sqMeters / 10000).toFixed(4));
  } catch {
    return 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// getPlotsSpatial — returns all plots with centroid + overlap info
// ──────────────────────────────────────────────────────────────────────────

export async function getPlotsSpatial(): Promise<PlotSpatialRecord[]> {
  const usePostGIS = await isPostGIS();

  if (usePostGIS) {
    // ── PostGIS path: ST_Intersects for overlap, ST_Centroid for centroid ──
    // We fetch all plots, then compute overlaps in SQL with a self-join.
    const rows = await db.$queryRaw`
      WITH plot_centroids AS (
        SELECT
          p.id, p."plotName", p."farmerId", f.name AS "farmerName", f.region,
          p."cropType", p."areaHectares", p."boundaryGeoJson",
          ST_Centroid(ST_GeomFromGeoJSON(p."boundaryGeoJson")) AS geom,
          ST_X(ST_Centroid(ST_GeomFromGeoJSON(p."boundaryGeoJson"))) AS lon,
          ST_Y(ST_Centroid(ST_GeomFromGeoJSON(p."boundaryGeoJson"))) AS lat
        FROM "FarmPlot" p
        LEFT JOIN "Farmer" f ON f.id = p."farmerId"
      )
      SELECT
        pc.id, pc."plotName", pc."farmerId", pc."farmerName", pc.region,
        pc."cropType", pc."areaHectares", pc."boundaryGeoJson",
        pc.lon, pc.lat,
        COALESCE(
          ARRAY_AGG(other.id) FILTER (WHERE other.id IS NOT NULL AND other.id != pc.id),
          ARRAY[]::text[]
        ) AS "overlappingIds"
      FROM plot_centroids pc
      LEFT JOIN plot_centroids other ON
        other.id != pc.id
        AND ST_Intersects(
          ST_GeomFromGeoJSON(pc."boundaryGeoJson"),
          ST_GeomFromGeoJSON(other."boundaryGeoJson")
        )
      GROUP BY pc.id, pc."plotName", pc."farmerId", pc."farmerName", pc.region,
               pc."cropType", pc."areaHectares", pc."boundaryGeoJson", pc.lon, pc.lat
      ORDER BY pc."plotName"
    ` as Array<{
      id: string; plotName: string; farmerId: string; farmerName: string | null;
      region: string | null; cropType: string | null; areaHectares: number;
      boundaryGeoJson: string; lon: number; lat: number; overlappingIds: string[];
    }>;
    return rows.map((r) => ({
      id: r.id, plotName: r.plotName, farmerId: r.farmerId, farmerName: r.farmerName,
      region: r.region, cropType: r.cropType, areaHectares: Number(r.areaHectares),
      boundaryGeoJson: r.boundaryGeoJson,
      centroid: { lon: Number(r.lon), lat: Number(r.lat) },
      overlappingIds: r.overlappingIds ?? [],
    }));
  }

  // ── SQLite fallback: compute centroid + overlaps with turf.js ──
  const plots = await db.farmPlot.findMany({
    orderBy: { plotName: 'asc' },
    include: { farmer: { select: { name: true, region: true } } },
  });

  // Parse all polygons once
  const features = plots
    .map((p) => {
      const feature = parsePolygon(p.boundaryGeoJson);
      if (!feature) return null;
      return { plot: p, feature };
    })
    .filter((x): x is { plot: typeof plots[number]; feature: turf.Feature<turf.Polygon> } => x !== null);

  // Compute pairwise overlaps using turf (same logic as the original checkOverlap)
  const overlapMap: Record<string, string[]> = {};
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i].feature;
      const b = features[j].feature;
      let overlap = false;
      try { overlap = turf.booleanOverlap(a, b); } catch { overlap = false; }
      if (!overlap) {
        try { overlap = turf.booleanContains(a, b) || turf.booleanContains(b, a); } catch { overlap = false; }
      }
      if (!overlap) {
        try {
          const inter = turf.intersect(turf.featureCollection([a, b]));
          overlap = !!inter;
        } catch { overlap = false; }
      }
      if (overlap) {
        const idA = features[i].plot.id;
        const idB = features[j].plot.id;
        overlapMap[idA] = [...(overlapMap[idA] ?? []), idB];
        overlapMap[idB] = [...(overlapMap[idB] ?? []), idA];
      }
    }
  }

  return features.map(({ plot, feature }) => {
    const centroid = computeCentroid(feature);
    return {
      id: plot.id,
      plotName: plot.plotName,
      farmerId: plot.farmerId,
      farmerName: plot.farmer?.name ?? null,
      region: plot.farmer?.region ?? null,
      cropType: plot.cropType,
      areaHectares: plot.areaHectares,
      boundaryGeoJson: plot.boundaryGeoJson,
      centroid,
      overlappingIds: overlapMap[plot.id] ?? [],
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────
// getDamageMap — returns a GeoJSON FeatureCollection with plot boundaries +
// claim/telemetry/damage properties for map overlay rendering.
// ──────────────────────────────────────────────────────────────────────────

export async function getDamageMap(): Promise<DamageMapResponse> {
  const [plots, claims, telemetryAlerts] = await Promise.all([
    getPlotsSpatial(),
    db.insuranceClaim.findMany({
      where: { policy: { plotId: { not: null } } },
      include: {
        policy: { select: { plotId: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.telemetryReading.findMany({
      orderBy: { timestamp: 'desc' },
      take: 500, // recent readings for trigger evaluation
    }),
  ]);

  // Group claims by plotId
  const claimsByPlot: Record<string, typeof claims> = {};
  for (const c of claims) {
    const plotId = c.policy?.plotId;
    if (!plotId) continue;
    if (!claimsByPlot[plotId]) claimsByPlot[plotId] = [];
    claimsByPlot[plotId].push(c);
  }

  // Group telemetry by plotId and compute triggers
  const telemetryByPlot: Record<string, typeof telemetryAlerts> = {};
  for (const t of telemetryAlerts) {
    if (!telemetryByPlot[t.plotId]) telemetryByPlot[t.plotId] = [];
    telemetryByPlot[t.plotId].push(t);
  }

  // Build features
  const features: DamageMapFeature[] = [];
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  let plotsWithClaims = 0;
  let plotsWithAlerts = 0;
  let totalPayout = 0;
  let sumDamageScore = 0;

  for (const plot of plots) {
    const feature = parsePolygon(plot.boundaryGeoJson);
    if (!feature) continue;

    // Update bbox
    try {
      const bb = turf.bbox(feature);
      if (bb[0] < minLon) minLon = bb[0];
      if (bb[1] < minLat) minLat = bb[1];
      if (bb[2] > maxLon) maxLon = bb[2];
      if (bb[3] > maxLat) maxLat = bb[3];
    } catch { /* ignore */ }

    // Claims for this plot
    const plotClaims = claimsByPlot[plot.id] ?? [];
    const hasActiveClaim = plotClaims.length > 0;
    if (hasActiveClaim) plotsWithClaims++;
    const latestClaim = plotClaims[0]; // already sorted desc
    const approvedPayouts = plotClaims
      .filter((c) => c.status === 'APPROVED' || c.status === 'PAID')
      .reduce((sum, c) => sum + c.calculatedPayout, 0);
    totalPayout += approvedPayouts;

    // Telemetry for this plot
    const plotTelemetry = telemetryByPlot[plot.id] ?? [];
    const latestReading = plotTelemetry[0];
    const last14Days = plotTelemetry.filter(
      (t) => Date.now() - new Date(t.timestamp).getTime() < 14 * 24 * 60 * 60 * 1000,
    );
    const rainfall14d = last14Days.reduce((sum, t) => sum + (t.rainfall ?? 0), 0);
    const ndviAlert = (latestReading?.ndvi ?? 1) < 0.30;
    const droughtAlert = rainfall14d < 5;
    if (ndviAlert || droughtAlert) plotsWithAlerts++;

    // ── Composite damage score (0–1) ──
    // Combine: VLM image analysis severity (if any), claim damage depth,
    // NDVI deviation from healthy (0.6+), drought conditions.
    let damageScore = 0;
    const components: number[] = [];
    if (latestClaim?.imageAnalysisSeverity != null) {
      components.push(latestClaim.imageAnalysisSeverity);
    }
    if (latestClaim?.damageDepthRatio != null) {
      components.push(latestClaim.damageDepthRatio);
    }
    if (latestReading?.ndvi != null) {
      // Healthy NDVI ~0.6–0.8. Below 0.3 = severe stress.
      const ndviScore = Math.max(0, Math.min(1, (0.6 - latestReading.ndvi) / 0.4));
      components.push(ndviScore);
    }
    if (droughtAlert) {
      components.push(Math.min(1, (5 - rainfall14d) / 5));
    }
    if (components.length > 0) {
      damageScore = components.reduce((a, b) => a + b, 0) / components.length;
    }
    sumDamageScore += damageScore;

    const damageLevel: DamageMapFeature['properties']['damageLevel'] =
      damageScore >= 0.7 ? 'severe' :
      damageScore >= 0.4 ? 'moderate' :
      damageScore >= 0.15 ? 'low' :
      damageScore > 0 ? 'none' : 'none';

    features.push({
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        plotId: plot.id,
        plotName: plot.plotName,
        farmerName: plot.farmerName,
        region: plot.region,
        cropType: plot.cropType,
        areaHectares: plot.areaHectares,
        overlappingIds: plot.overlappingIds,
        hasActiveClaim,
        claimCount: plotClaims.length,
        latestClaimStatus: latestClaim?.status ?? null,
        latestDamageDepth: latestClaim?.damageDepthRatio ?? null,
        latestPayout: latestClaim?.calculatedPayout ?? null,
        calculatedPayout: approvedPayouts,
        imageAnalysisSeverity: latestClaim?.imageAnalysisSeverity ?? null,
        imageAnalysisDamageType: latestClaim?.imageAnalysisDamageType ?? null,
        latestNdvi: latestReading?.ndvi ?? null,
        ndviAlert,
        rainfall14d: Number(rainfall14d.toFixed(2)),
        droughtAlert,
        damageScore: Number(damageScore.toFixed(3)),
        damageLevel,
      },
    });
  }

  const bbox: [number, number, number, number] | null =
    isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : null;

  return {
    type: 'FeatureCollection',
    features,
    bbox,
    summary: {
      totalPlots: plots.length,
      plotsWithClaims,
      plotsWithAlerts,
      totalPayout: Number(totalPayout.toFixed(2)),
      averageDamageScore: plots.length > 0 ? Number((sumDamageScore / plots.length).toFixed(3)) : 0,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// pointInPlot — check if a [lon, lat] point falls inside any registered plot.
// Useful for "click map to find the plot at this location".
// ──────────────────────────────────────────────────────────────────────────

export async function pointInPlot(lon: number, lat: number): Promise<PlotSpatialRecord | null> {
  const usePostGIS = await isPostGIS();

  if (usePostGIS) {
    const rows = await db.$queryRaw`
      SELECT
        p.id, p."plotName", p."farmerId", f.name AS "farmerName", f.region,
        p."cropType", p."areaHectares", p."boundaryGeoJson"
      FROM "FarmPlot" p
      LEFT JOIN "Farmer" f ON f.id = p."farmerId"
      WHERE ST_Contains(
        ST_GeomFromGeoJSON(p."boundaryGeoJson"),
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
      )
      LIMIT 1
    ` as Array<{
      id: string; plotName: string; farmerId: string; farmerName: string | null;
      region: string | null; cropType: string | null; areaHectares: number;
      boundaryGeoJson: string;
    }>;
    if (!rows[0]) return null;
    const r = rows[0];
    const feature = parsePolygon(r.boundaryGeoJson);
    return {
      ...r,
      farmerName: r.farmerName,
      region: r.region,
      cropType: r.cropType,
      areaHectares: Number(r.areaHectares),
      centroid: feature ? computeCentroid(feature) : { lon, lat },
      overlappingIds: [],
    };
  }

  // SQLite fallback: turf.booleanPointInPolygon
  const point = turf.point([lon, lat]);
  const plots = await getPlotsSpatial();
  for (const plot of plots) {
    const feature = parsePolygon(plot.boundaryGeoJson);
    if (!feature) continue;
    try {
      if (turf.booleanPointInPolygon(point, feature)) {
        return plot;
      }
    } catch { /* ignore */ }
  }
  return null;
}
