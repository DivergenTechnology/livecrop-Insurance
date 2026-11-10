import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkOverlap, isValidPolygon } from '@/lib/spatial';

export const dynamic = 'force-dynamic';

/**
 * POST /api/plots/check-overlap
 * Body: { boundaryGeoJson: object | string, excludePlotId?: string }
 * Returns: { overlaps: boolean, overlappingIds: string[], valid: boolean, error?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { boundaryGeoJson, excludePlotId } = body ?? {};

  if (!boundaryGeoJson) {
    return NextResponse.json({ error: 'boundaryGeoJson is required' }, { status: 400 });
  }

  let geoJsonObj: unknown = boundaryGeoJson;
  if (typeof boundaryGeoJson === 'string') {
    try {
      geoJsonObj = JSON.parse(boundaryGeoJson);
    } catch {
      return NextResponse.json({ error: 'boundaryGeoJson is not valid JSON' }, { status: 400 });
    }
  }

  const validation = isValidPolygon(geoJsonObj);
  if (!validation.valid) {
    return NextResponse.json({
      overlaps: false,
      overlappingIds: [],
      valid: false,
      error: validation.error,
    });
  }

  let existingRows = await db.farmPlot.findMany({ select: { id: true, boundaryGeoJson: true } });
  if (excludePlotId) {
    existingRows = existingRows.filter((p) => p.id !== excludePlotId);
  }
  const existing = existingRows.map((p) => ({ id: p.id, geoJson: p.boundaryGeoJson }));

  const { overlaps, overlappingIds } = checkOverlap(geoJsonObj as never, existing);
  return NextResponse.json({
    overlaps,
    overlappingIds,
    valid: true,
  });
}
