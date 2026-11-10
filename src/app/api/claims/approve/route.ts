import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/claims/approve
 * Body: { claimId: string }
 * Moves an ASSESSED claim to APPROVED.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { claimId } = body ?? {};
  if (!claimId) return NextResponse.json({ error: 'claimId is required' }, { status: 400 });

  const claim = await db.insuranceClaim.findUnique({ where: { id: claimId } });
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  if (claim.status !== 'ASSESSED') {
    return NextResponse.json(
      { error: `Claim must be ASSESSED before approval (current: ${claim.status})` },
      { status: 400 },
    );
  }

  const updated = await db.insuranceClaim.update({
    where: { id: claimId },
    data: { status: 'APPROVED' },
    include: {
      policy: { include: { farmer: true, plot: true, livestock: true, variety: true } },
      settlement: true,
    },
  });
  return NextResponse.json(updated);
}
