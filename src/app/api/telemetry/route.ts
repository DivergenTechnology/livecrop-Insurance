import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReadings, evaluateParametricTriggers } from '@/lib/ndvi-simulator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telemetry?plotId=...
 * Returns the readings + the evaluated parametric triggers for that plot.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plotId = searchParams.get('plotId');

  if (!plotId) {
    return NextResponse.json({ error: 'plotId query param is required' }, { status: 400 });
  }

  const readings = await db.telemetryReading.findMany({
    where: { plotId },
    orderBy: { timestamp: 'asc' },
  });

  const trigger = evaluateParametricTriggers(
    readings.map((r) => ({ timestamp: r.timestamp, ndvi: r.ndvi, rainfall: r.rainfall })),
  );

  return NextResponse.json({
    plotId,
    readings,
    trigger,
  });
}
