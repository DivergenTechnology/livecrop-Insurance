import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateCropClaimPayout, determineStage, type StageVulnerability } from '@/lib/loss-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/claims/assess
 * Body: { claimId: string }
 * Runs the loss engine against the claim's policy and updates the claim with
 * the calculated payout, payout type, growth stage, and loss severity ratio.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { claimId } = body ?? {};
  if (!claimId) {
    return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
  }

  const claim = await db.insuranceClaim.findUnique({
    where: { id: claimId },
    include: {
      policy: {
        include: {
          variety: { include: { stages: true } },
          farmer: true,
          plot: true,
          livestock: true,
        },
      },
    },
  });
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }
  if (claim.policy.assetType !== 'CROP') {
    return NextResponse.json(
      { error: 'Loss engine currently only supports CROP policies. Livestock claims require manual assessment.' },
      { status: 400 },
    );
  }
  if (!claim.policy.variety) {
    return NextResponse.json({ error: 'Policy has no crop variety attached' }, { status: 400 });
  }

  // Days sown = days between coverage start and incident date.
  const daysSown = Math.max(
    0,
    Math.floor(
      (claim.incidentDate.getTime() - claim.policy.coverageStart.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const stages: StageVulnerability[] = claim.policy.variety.stages.map((s) => ({
    stage: s.stage as never,
    startDayOffset: s.startDayOffset,
    endDayOffset: s.endDayOffset,
    stageKyFactor: s.stageKyFactor,
    replantWindowFlag: s.replantWindowFlag,
  }));

  const stageInfo = determineStage(daysSown, stages);
  if (!stageInfo) {
    return NextResponse.json({ error: 'Could not determine growth stage' }, { status: 500 });
  }

  // Replant cutoff = the end of the EMERGENCE window.
  const emergence = stages.find((s) => s.stage === 'EMERGENCE');
  const replantCutoff = emergence ? emergence.endDayOffset : 14;

  const result = calculateCropClaimPayout(
    claim.policy.sumInsured,
    claim.policy.inputCost,
    stageInfo.stage,
    claim.damageDepthRatio,
    stageInfo.vulnerability.stageKyFactor,
    daysSown,
    replantCutoff,
  );

  const updated = await db.insuranceClaim.update({
    where: { id: claimId },
    data: {
      growthStageAtLoss: stageInfo.stage,
      calculatedPayout: result.payout,
      payoutType: result.type,
      lossSeverityRatio: result.lossSeverityRatio ?? null,
      status: 'ASSESSED',
    },
    include: {
      policy: { include: { farmer: true, plot: true, livestock: true, variety: { include: { stages: true } } } },
      settlement: true,
    },
  });

  return NextResponse.json({
    claim: updated,
    assessment: {
      stage: stageInfo.stage,
      stageKyFactor: stageInfo.vulnerability.stageKyFactor,
      daysSown,
      replantCutoff,
      damageDepthRatio: claim.damageDepthRatio,
      sumInsured: claim.policy.sumInsured,
      inputCost: claim.policy.inputCost,
      ...result,
    },
  });
}
