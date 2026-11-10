import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkOverlap, isValidPolygon, toTurfPolygon } from '@/lib/spatial';
import * as turf from '@turf/turf';

export const dynamic = 'force-dynamic';

export async function GET() {
  const plots = await db.farmPlot.findMany({
    orderBy: { createdAt: 'desc' },
    include: { farmer: true },
  });

  // Determine which plots overlap with at least one other plot.
  const features = plots
    .map((p) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(p.boundaryGeoJson);
      } catch {
        return null;
      }
      const f = toTurfPolygon(parsed as never);
      return f ? { id: p.id, geoJson: p.boundaryGeoJson, feature: f } : null;
    })
    .filter(Boolean) as { id: string; geoJson: string; feature: turf.Feature<turf.Polygon> }[];

  const overlapMap: Record<string, string[]> = {};
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i];
      const b = features[j];
      let overlap = false;
      try {
        overlap = turf.booleanOverlap(a.feature, b.feature);
      } catch {
        overlap = false;
      }
      if (!overlap) {
        try {
          overlap = turf.booleanContains(a.feature, b.feature) || turf.booleanContains(b.feature, a.feature);
        } catch {
          overlap = false;
        }
      }
      if (!overlap) {
        try {
          const inter = turf.intersect(turf.featureCollection([a.feature, b.feature]));
          overlap = !!inter;
        } catch {
          overlap = false;
        }
      }
      if (overlap) {
        overlapMap[a.id] = [...(overlapMap[a.id] ?? []), b.id];
        overlapMap[b.id] = [...(overlapMap[b.id] ?? []), a.id];
      }
    }
  }

  return NextResponse.json(
    plots.map((p) => ({
      ...p,
      boundaryGeoJson: p.boundaryGeoJson,
      overlappingIds: overlapMap[p.id] ?? [],
    })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { farmerId, plotName, cropType, plotDate, areaHectares, boundaryGeoJson, soilType, fertilizerUsed } = body ?? {};

  if (!farmerId || !plotName || typeof areaHectares !== 'number' || !boundaryGeoJson) {
    return NextResponse.json(
      { error: 'farmerId, plotName, areaHectares, boundaryGeoJson are required' },
      { status: 400 },
    );
  }

  // Normalize the GeoJSON input — accept a raw GeoJSON object OR a JSON string.
  let geoJsonObj: unknown = boundaryGeoJson;
  if (typeof boundaryGeoJson === 'string') {
    try {
      geoJsonObj = JSON.parse(boundaryGeoJson);
    } catch {
      return NextResponse.json({ error: 'boundaryGeoJson is not valid JSON' }, { status: 400 });
    }
  }

  const validation = isValidPolygon(geoJsonObj);
  if (!validation.valid || !validation.feature) {
    return NextResponse.json(
      { error: `Invalid polygon: ${validation.error}` },
      { status: 400 },
    );
  }

  // Make sure the farmer exists.
  const farmer = await db.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    return NextResponse.json({ error: 'Farmer not found' }, { status: 404 });
  }

  // Overlap check against existing plots.
  const existingRows = await db.farmPlot.findMany({ select: { id: true, boundaryGeoJson: true } });
  const existing = existingRows.map((p) => ({ id: p.id, geoJson: p.boundaryGeoJson }));
  const { overlaps, overlappingIds } = checkOverlap(geoJsonObj as never, existing);
  if (overlaps) {
    return NextResponse.json(
      {
        error: 'Spatial overlap detected with existing plot(s)',
        overlappingIds,
      },
      { status: 409 },
    );
  }

  // Recompute area from the polygon if not provided accurately.
  let computedArea = areaHectares;
  try {
    const areaSqM = turf.area(validation.feature);
    computedArea = Number((areaSqM / 10000).toFixed(2)); // hectares
  } catch {
    // keep provided area
  }

  // Parse optional plot date.
  let parsedPlotDate: Date | null = null;
  if (plotDate) {
    const d = new Date(plotDate);
    if (!Number.isNaN(d.getTime())) parsedPlotDate = d;
  }

  const plot = await db.farmPlot.create({
    data: {
      farmerId,
      plotName,
      cropType: cropType || null,
      plotDate: parsedPlotDate,
      areaHectares: computedArea,
      boundaryGeoJson: JSON.stringify(geoJsonObj),
      soilType: soilType ?? null,
      fertilizerUsed: fertilizerUsed || null,
    },
    include: { farmer: true },
  });

  return NextResponse.json(plot, { status: 201 });
}
