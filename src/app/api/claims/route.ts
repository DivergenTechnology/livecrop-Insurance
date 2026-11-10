import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const claims = await db.insuranceClaim.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      policy: {
        include: {
          farmer: true,
          plot: true,
          livestock: true,
          variety: true,
        },
      },
      settlement: true,
    },
  });
  return NextResponse.json(claims);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { policyId, incidentDate, damageDepthRatio, evidenceUrl } = body ?? {};

  if (!policyId || !incidentDate || typeof damageDepthRatio !== 'number') {
    return NextResponse.json(
      { error: 'policyId, incidentDate, damageDepthRatio are required' },
      { status: 400 },
    );
  }
  if (damageDepthRatio < 0 || damageDepthRatio > 1) {
    return NextResponse.json({ error: 'damageDepthRatio must be in [0, 1]' }, { status: 400 });
  }

  const policy = await db.policy.findUnique({ where: { id: policyId } });
  if (!policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  const claim = await db.insuranceClaim.create({
    data: {
      policyId,
      assetType: policy.assetType,
      incidentDate: new Date(incidentDate),
      damageDepthRatio,
      evidenceUrl: evidenceUrl ?? null,
      status: 'SUBMITTED',
    },
    include: {
      policy: { include: { farmer: true, plot: true, livestock: true, variety: { include: { stages: true } } } },
    },
  });

  return NextResponse.json(claim, { status: 201 });
}
