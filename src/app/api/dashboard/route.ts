import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard
 * Aggregate KPIs across the entire platform.
 */
export async function GET() {
  const [
    farmersCount,
    plotsCount,
    livestockCount,
    activePoliciesCount,
    claimsByStatusRows,
    settlements,
    recentClaims,
    recentPlots,
    recentLivestock,
  ] = await Promise.all([
    db.farmer.count(),
    db.farmPlot.count(),
    db.livestockAsset.count(),
    db.policy.count({ where: { status: 'ACTIVE' } }),
    db.insuranceClaim.groupBy({
      by: ['status'],
      _count: true,
    }),
    db.settlement.findMany({ where: { status: 'PAID' }, select: { amount: true } }),
    db.insuranceClaim.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { policy: { include: { farmer: true } } },
    }),
    db.farmPlot.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { farmer: true },
    }),
    db.livestockAsset.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { farmer: true },
    }),
  ]);

  const totalDisbursed = settlements.reduce((s, x) => s + x.amount, 0);

  const claimsByStatus: Record<string, number> = {};
  for (const row of claimsByStatusRows) {
    claimsByStatus[row.status] = row._count;
  }

  return NextResponse.json({
    counts: {
      farmers: farmersCount,
      plots: plotsCount,
      livestock: livestockCount,
      activePolicies: activePoliciesCount,
      claimsByStatus,
      totalDisbursed: Number(totalDisbursed.toFixed(2)),
      pendingClaims: (claimsByStatus['SUBMITTED'] ?? 0) + (claimsByStatus['ASSESSED'] ?? 0),
    },
    recentActivity: {
      claims: recentClaims,
      plots: recentPlots,
      livestock: recentLivestock,
    },
  });
}
