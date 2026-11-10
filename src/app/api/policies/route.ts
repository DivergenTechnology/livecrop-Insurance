import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const policies = await db.policy.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      farmer: true,
      plot: { include: { farmer: true } },
      livestock: { include: { farmer: true } },
      variety: { include: { stages: true } },
      _count: { select: { claims: true } },
    },
  });
  return NextResponse.json(policies);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    farmerId,
    assetType, // 'CROP' | 'LIVESTOCK'
    plotId,
    livestockId,
    varietyId,
    sumInsured,
    inputCost,
    coverageStart,
    coverageEnd,
  } = body ?? {};

  if (!farmerId || !assetType || typeof sumInsured !== 'number') {
    return NextResponse.json(
      { error: 'farmerId, assetType, sumInsured are required' },
      { status: 400 },
    );
  }
  if (!['CROP', 'LIVESTOCK'].includes(assetType)) {
    return NextResponse.json({ error: 'assetType must be CROP or LIVESTOCK' }, { status: 400 });
  }
  if (assetType === 'CROP' && !plotId) {
    return NextResponse.json({ error: 'plotId is required for CROP policies' }, { status: 400 });
  }
  if (assetType === 'LIVESTOCK' && !livestockId) {
    return NextResponse.json({ error: 'livestockId is required for LIVESTOCK policies' }, { status: 400 });
  }

  const start = coverageStart ? new Date(coverageStart) : new Date();
  const end = coverageEnd
    ? new Date(coverageEnd)
    : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

  // Premium: 5% crop, 8% livestock.
  const premiumRate = assetType === 'CROP' ? 0.05 : 0.08;
  const premium = Number((sumInsured * premiumRate).toFixed(2));

  const policy = await db.policy.create({
    data: {
      farmerId,
      assetType,
      plotId: assetType === 'CROP' ? plotId : null,
      livestockId: assetType === 'LIVESTOCK' ? livestockId : null,
      varietyId: assetType === 'CROP' ? varietyId ?? null : null,
      sumInsured,
      inputCost: typeof inputCost === 'number' ? inputCost : 0,
      premium,
      coverageStart: start,
      coverageEnd: end,
      status: 'ACTIVE',
    },
    include: {
      farmer: true,
      plot: { include: { farmer: true } },
      livestock: { include: { farmer: true } },
      variety: { include: { stages: true } },
    },
  });

  return NextResponse.json(policy, { status: 201 });
}
