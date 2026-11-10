import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReadings } from '@/lib/ndvi-simulator';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telemetry/seed
 * Generate (or refresh) 60 days of mock NDVI + rainfall for all plots.
 * Idempotent: deletes existing readings first.
 */
export async function POST() {
  const plots = await db.farmPlot.findMany({ select: { id: true, plotName: true } });

  if (plots.length === 0) {
    return NextResponse.json({ message: 'No plots found', generated: 0 });
  }

  // Clear existing telemetry for these plots.
  await db.telemetryReading.deleteMany({
    where: { plotId: { in: plots.map((p) => p.id) } },
  });

  let total = 0;
  for (const plot of plots) {
    const readings = generateReadings(plot.id, 60);
    await db.telemetryReading.createMany({
      data: readings.map((r) => ({
        plotId: plot.id,
        timestamp: r.timestamp,
        ndvi: r.ndvi,
        rainfall: r.rainfall,
        source: 'SENTINEL_2',
      })),
    });
    total += readings.length;
  }

  return NextResponse.json({ message: 'Telemetry seeded', plots: plots.length, generated: total });
}
