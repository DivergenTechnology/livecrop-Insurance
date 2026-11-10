import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateParametricTriggers } from '@/lib/ndvi-simulator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telemetry/alerts
 * Evaluate the parametric trigger for every plot and return a list of alerts.
 */
export async function GET() {
  const plots = await db.farmPlot.findMany({
    include: { farmer: true },
  });

  const results = [];
  for (const plot of plots) {
    const readings = await db.telemetryReading.findMany({
      where: { plotId: plot.id },
      orderBy: { timestamp: 'asc' },
    });
    const trigger = evaluateParametricTriggers(
      readings.map((r) => ({ timestamp: r.timestamp, ndvi: r.ndvi, rainfall: r.rainfall })),
    );
    results.push({
      plotId: plot.id,
      plotName: plot.plotName,
      farmerName: plot.farmer?.name ?? null,
      region: plot.farmer?.region ?? null,
      readingsCount: readings.length,
      ...trigger,
    });
  }

  return NextResponse.json(results);
}
