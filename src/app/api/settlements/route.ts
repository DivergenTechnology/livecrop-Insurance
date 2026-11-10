import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settlements = await db.settlement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      claim: {
        include: {
          policy: { include: { farmer: true, plot: true, livestock: true, variety: true } },
        },
      },
    },
  });
  return NextResponse.json(settlements);
}

const RAILS = ['MPESA', 'MTN', 'AIRTEL'] as const;
type Rail = (typeof RAILS)[number];

/**
 * Generate a random 10-char alphanumeric transaction reference.
 * Format: {RAIL}-{10 chars}
 */
function generateReference(rail: Rail): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  for (let i = 0; i < 10; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${rail}-${ref}`;
}

/**
 * POST /api/settlements
 * Body: { claimId: string, rail?: 'MPESA' | 'MTN' | 'AIRTEL' }
 * Disburse the calculated payout of an APPROVED claim via the mock mobile money rail.
 * 90% success / 10% failure.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { claimId, rail: railOverride } = body ?? {};
  if (!claimId) return NextResponse.json({ error: 'claimId is required' }, { status: 400 });

  const claim = await db.insuranceClaim.findUnique({
    where: { id: claimId },
    include: { policy: { include: { farmer: true } }, settlement: true },
  });
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  if (claim.status !== 'APPROVED') {
    return NextResponse.json(
      { error: `Claim must be APPROVED before disbursement (current: ${claim.status})` },
      { status: 400 },
    );
  }
  if (claim.settlement) {
    return NextResponse.json(
      { error: 'Claim already has a settlement', settlement: claim.settlement },
      { status: 400 },
    );
  }

  const rail: Rail = railOverride && RAILS.includes(railOverride) ? railOverride : RAILS[Math.floor(Math.random() * RAILS.length)];
  const reference = generateReference(rail);
  const success = Math.random() < 0.9;
  const status = success ? 'PAID' : 'FAILED';

  const settlement = await db.settlement.create({
    data: {
      claimId,
      payee: claim.policy.farmer?.phone ?? 'UNKNOWN',
      amount: claim.calculatedPayout,
      rail,
      status,
      reference,
    },
    include: {
      claim: { include: { policy: { include: { farmer: true } } } },
    },
  });

  // If paid, mark the claim as PAID. If failed, the claim stays APPROVED so it can be retried.
  if (success) {
    await db.insuranceClaim.update({ where: { id: claimId }, data: { status: 'PAID' } });
  }

  return NextResponse.json(settlement, { status: 201 });
}
