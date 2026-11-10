import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/claims/reject
 * Body: { claimId: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { claimId } = body ?? {};
  if (!claimId) return NextResponse.json({ error: 'claimId is required' }, { status: 400 });

  const updated = await db.insuranceClaim.update({
    where: { id: claimId },
    data: { status: 'REJECTED' },
    include: {
      policy: { include: { farmer: true, plot: true, livestock: true, variety: true } },
      settlement: true,
    },
  });
  return NextResponse.json(updated);
}
