// src/lib/loss-engine.ts
// Dynamic Stage x Depth Loss Engine — ported from the implementation plan.

export type Stage = 'EMERGENCE' | 'VEGETATIVE' | 'FLOWERING' | 'MATURITY';

export interface PayoutResult {
  payout: number;
  type: 'REPLANT_ALLOWANCE' | 'FULL_INDEMNITY';
  lossSeverityRatio?: number;
}

export interface StageVulnerability {
  stage: Stage;
  startDayOffset: number;
  endDayOffset: number;
  stageKyFactor: number;
  replantWindowFlag: boolean;
}

/**
 * Calculate crop claim payout using the exact algorithm from the plan.
 *
 * 1. Early-stage replant cap check: if EMERGENCE or daysSown <= replantCutoff,
 *    payout = min(inputCost * damageDepth, sumInsured * 0.25), type REPLANT_ALLOWANCE.
 * 2. Otherwise, effectiveLossRatio = clamp(damageDepth * stageKy, 0, 1),
 *    payout = sumInsured * effectiveLossRatio, type FULL_INDEMNITY.
 */
export function calculateCropClaimPayout(
  sumInsured: number,
  inputCost: number,
  stage: Stage,
  damageDepth: number, // 0.00 to 1.00
  stageKy: number,     // FAO Ky factor, e.g. 1.30 for flowering
  daysSown: number,
  replantCutoff: number,
): PayoutResult {
  // 1. Early-stage replant cap check
  if (stage === 'EMERGENCE' || daysSown <= replantCutoff) {
    const replantPayout = Math.min(inputCost * damageDepth, sumInsured * 0.25);
    return {
      payout: Math.round(replantPayout * 100) / 100,
      type: 'REPLANT_ALLOWANCE',
    };
  }
  // 2. FAO Stage Sensitivity Factor Scoring
  const effectiveLossRatio = Math.min(1.0, Math.max(0.0, damageDepth * stageKy));
  const totalPayout = sumInsured * effectiveLossRatio;
  return {
    payout: Math.round(totalPayout * 100) / 100,
    type: 'FULL_INDEMNITY',
    lossSeverityRatio: Math.round(effectiveLossRatio * 10000) / 10000,
  };
}

/**
 * Determine the growth stage from days-since-coverage-start using the
 * stage day offsets in the vulnerability table.
 */
export function determineStage(
  daysSown: number,
  stages: StageVulnerability[],
): { stage: Stage; vulnerability: StageVulnerability } | null {
  for (const v of stages) {
    if (daysSown >= v.startDayOffset && daysSown <= v.endDayOffset) {
      return { stage: v.stage, vulnerability: v };
    }
  }
  // Default: if daysSown beyond last stage, use the last MATURITY stage.
  const maturity = stages.find((s) => s.stage === 'MATURITY');
  if (maturity) return { stage: 'MATURITY', vulnerability: maturity };
  // Fallback to whatever the last stage is.
  if (stages.length > 0) {
    return { stage: stages[stages.length - 1].stage, vulnerability: stages[stages.length - 1] };
  }
  return null;
}
