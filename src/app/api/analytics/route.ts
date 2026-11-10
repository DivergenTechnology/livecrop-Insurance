import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics
// Returns aggregated statistics for crop categories, livestock categories,
// regions, claims, payouts, and time-series trends.
// ──────────────────────────────────────────────────────────────────────────

interface CropCategoryStat {
  cropType: string;
  plotCount: number;
  totalAreaHectares: number;
  avgAreaHectares: number;
  policyCount: number;
  totalSumInsured: number;
  totalPremium: number;
  claimCount: number;
  totalPayout: number;
  avgNdvi: number | null;
}

interface LivestockCategoryStat {
  livestockType: string;
  category: string;
  assetCount: number;
  totalHeadCount: number;
  totalDeclaredValue: number;
  avgDeclaredValuePerHead: number;
  policyCount: number;
  totalSumInsured: number;
  totalPremium: number;
  claimCount: number;
  totalPayout: number;
}

interface RegionStat {
  region: string;
  farmerCount: number;
  plotCount: number;
  livestockCount: number;
  totalAreaHectares: number;
  policyCount: number;
  totalSumInsured: number;
  totalPremium: number;
  totalPayout: number;
}

interface MonthlyTrend {
  month: string;
  claims: number;
  payouts: number;
  registrations: number;
}

interface ClaimSeverityBucket {
  bucket: string;
  count: number;
  totalPayout: number;
}

interface AnalyticsResponse {
  crops: CropCategoryStat[];
  livestock: LivestockCategoryStat[];
  regions: RegionStat[];
  monthlyTrends: MonthlyTrend[];
  claimSeverityBuckets: ClaimSeverityBucket[];
  claimStatusDistribution: { status: string; count: number; totalPayout: number }[];
  summary: {
    totalPlots: number;
    totalLivestock: number;
    totalPolicies: number;
    totalSumInsured: number;
    totalPremium: number;
    totalPayout: number;
    totalAreaHectares: number;
    totalLivestockHeadCount: number;
    totalLivestockValue: number;
    avgDamageDepth: number | null;
    avgImageSeverity: number | null;
  };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function severityBucket(severity: number): string {
  if (severity < 0.2) return '0-20%';
  if (severity < 0.4) return '20-40%';
  if (severity < 0.6) return '40-60%';
  if (severity < 0.8) return '60-80%';
  return '80-100%';
}

export async function GET() {
  const [plots, livestock, policies, claims] = await Promise.all([
    db.farmPlot.findMany({
      include: {
        farmer: { select: { region: true } },
        policies: { select: { sumInsured: true, premium: true, status: true } },
        telemetry: { select: { ndvi: true }, orderBy: { timestamp: 'desc' }, take: 1 },
      },
    }),
    db.livestockAsset.findMany({
      include: {
        farmer: { select: { region: true } },
        policies: { select: { sumInsured: true, premium: true, status: true } },
      },
    }),
    db.policy.findMany({
      include: {
        farmer: { select: { region: true } },
        plot: { select: { cropType: true, areaHectares: true } },
        livestock: { select: { livestockType: true, category: true, headCount: true, declaredValue: true } },
        claims: { select: { calculatedPayout: true, status: true, damageDepthRatio: true, imageAnalysisSeverity: true } },
      },
    }),
    db.insuranceClaim.findMany({
      include: {
        policy: {
          include: {
            farmer: { select: { region: true } },
            plot: { select: { cropType: true } },
            livestock: { select: { livestockType: true, category: true } },
          },
        },
      },
    }),
  ]);

  // ── Crop category stats ──
  const cropMap = new Map<string, CropCategoryStat>();
  for (const plot of plots) {
    const cropType = plot.cropType ?? 'Unspecified';
    if (!cropMap.has(cropType)) {
      cropMap.set(cropType, {
        cropType, plotCount: 0, totalAreaHectares: 0, avgAreaHectares: 0,
        policyCount: 0, totalSumInsured: 0, totalPremium: 0,
        claimCount: 0, totalPayout: 0, avgNdvi: null,
      });
    }
    const s = cropMap.get(cropType)!;
    s.plotCount += 1;
    s.totalAreaHectares += plot.areaHectares;
    s.policyCount += plot.policies.length;
    for (const p of plot.policies) {
      s.totalSumInsured += p.sumInsured;
      s.totalPremium += p.premium;
    }
    if (plot.telemetry[0]) {
      if (s.avgNdvi == null) s.avgNdvi = 0;
      s.avgNdvi = (s.avgNdvi + plot.telemetry[0].ndvi) / 2;
    }
  }
  for (const claim of claims) {
    const cropType = claim.policy?.plot?.cropType;
    if (!cropType) continue;
    const s = cropMap.get(cropType);
    if (!s) continue;
    s.claimCount += 1;
    if (claim.status === 'APPROVED' || claim.status === 'PAID') {
      s.totalPayout += claim.calculatedPayout;
    }
  }
  for (const s of cropMap.values()) {
    s.avgAreaHectares = s.plotCount > 0 ? Number((s.totalAreaHectares / s.plotCount).toFixed(2)) : 0;
    s.totalAreaHectares = Number(s.totalAreaHectares.toFixed(2));
    s.totalSumInsured = Number(s.totalSumInsured.toFixed(2));
    s.totalPremium = Number(s.totalPremium.toFixed(2));
    s.totalPayout = Number(s.totalPayout.toFixed(2));
    s.avgNdvi = s.avgNdvi != null ? Number(s.avgNdvi.toFixed(3)) : null;
  }
  const crops = Array.from(cropMap.values()).sort((a, b) => b.plotCount - a.plotCount);

  // ── Livestock category stats ──
  const livestockMap = new Map<string, LivestockCategoryStat>();
  for (const l of livestock) {
    const key = `${l.livestockType}|${l.category}`;
    if (!livestockMap.has(key)) {
      livestockMap.set(key, {
        livestockType: l.livestockType, category: l.category,
        assetCount: 0, totalHeadCount: 0, totalDeclaredValue: 0, avgDeclaredValuePerHead: 0,
        policyCount: 0, totalSumInsured: 0, totalPremium: 0,
        claimCount: 0, totalPayout: 0,
      });
    }
    const s = livestockMap.get(key)!;
    s.assetCount += 1;
    s.totalHeadCount += l.headCount;
    s.totalDeclaredValue += l.declaredValue * l.headCount;
    s.policyCount += l.policies.length;
    for (const p of l.policies) {
      s.totalSumInsured += p.sumInsured;
      s.totalPremium += p.premium;
    }
  }
  for (const claim of claims) {
    const ls = claim.policy?.livestock;
    if (!ls) continue;
    const key = `${ls.livestockType}|${ls.category}`;
    const s = livestockMap.get(key);
    if (!s) continue;
    s.claimCount += 1;
    if (claim.status === 'APPROVED' || claim.status === 'PAID') {
      s.totalPayout += claim.calculatedPayout;
    }
  }
  for (const s of livestockMap.values()) {
    s.avgDeclaredValuePerHead = s.totalHeadCount > 0 ? Number((s.totalDeclaredValue / s.totalHeadCount).toFixed(2)) : 0;
    s.totalDeclaredValue = Number(s.totalDeclaredValue.toFixed(2));
    s.totalSumInsured = Number(s.totalSumInsured.toFixed(2));
    s.totalPremium = Number(s.totalPremium.toFixed(2));
    s.totalPayout = Number(s.totalPayout.toFixed(2));
  }
  const livestockArr = Array.from(livestockMap.values()).sort((a, b) => b.totalHeadCount - a.totalHeadCount);

  // ── Region stats ──
  const regionMap = new Map<string, RegionStat>();
  // Farmers
  const farmerRegionCounts = new Map<string, number>();
  for (const p of policies) {
    const region = p.farmer?.region || 'Unknown';
    farmerRegionCounts.set(region, (farmerRegionCounts.get(region) ?? 0) + 1);
  }
  // Use unique farmers per region from plots + livestock
  const farmersByRegion = new Map<string, Set<string>>();
  for (const p of plots) {
    const region = p.farmer?.region || 'Unknown';
    if (!farmersByRegion.has(region)) farmersByRegion.set(region, new Set());
    farmersByRegion.get(region)!.add(p.farmerId);
  }
  for (const l of livestock) {
    const region = l.farmer?.region || 'Unknown';
    if (!farmersByRegion.has(region)) farmersByRegion.set(region, new Set());
    farmersByRegion.get(region)!.add(l.farmerId);
  }
  for (const [region, farmerSet] of farmersByRegion) {
    regionMap.set(region, {
      region, farmerCount: farmerSet.size, plotCount: 0, livestockCount: 0,
      totalAreaHectares: 0, policyCount: 0, totalSumInsured: 0, totalPremium: 0, totalPayout: 0,
    });
  }
  for (const p of plots) {
    const region = p.farmer?.region || 'Unknown';
    const s = regionMap.get(region);
    if (!s) continue;
    s.plotCount += 1;
    s.totalAreaHectares += p.areaHectares;
  }
  for (const l of livestock) {
    const region = l.farmer?.region || 'Unknown';
    const s = regionMap.get(region);
    if (!s) continue;
    s.livestockCount += 1;
  }
  for (const p of policies) {
    const region = p.farmer?.region || 'Unknown';
    const s = regionMap.get(region);
    if (!s) continue;
    s.policyCount += 1;
    s.totalSumInsured += p.sumInsured;
    s.totalPremium += p.premium;
  }
  for (const claim of claims) {
    const region = claim.policy?.farmer?.region || 'Unknown';
    const s = regionMap.get(region);
    if (!s) continue;
    if (claim.status === 'APPROVED' || claim.status === 'PAID') {
      s.totalPayout += claim.calculatedPayout;
    }
  }
  for (const s of regionMap.values()) {
    s.totalAreaHectares = Number(s.totalAreaHectares.toFixed(2));
    s.totalSumInsured = Number(s.totalSumInsured.toFixed(2));
    s.totalPremium = Number(s.totalPremium.toFixed(2));
    s.totalPayout = Number(s.totalPayout.toFixed(2));
  }
  const regions = Array.from(regionMap.values()).sort((a, b) => b.farmerCount - a.farmerCount);

  // ── Monthly trends (last 12 months) ──
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const trendMap = new Map<string, MonthlyTrend>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    const mk = monthKey(d);
    trendMap.set(mk, { month: mk, claims: 0, payouts: 0, registrations: 0 });
  }
  for (const c of claims) {
    if (c.createdAt >= twelveMonthsAgo) {
      const mk = monthKey(c.createdAt);
      const t = trendMap.get(mk);
      if (t) {
        t.claims += 1;
        if (c.status === 'APPROVED' || c.status === 'PAID') {
          t.payouts += c.calculatedPayout;
        }
      }
    }
  }
  for (const p of plots) {
    if (p.createdAt >= twelveMonthsAgo) {
      const mk = monthKey(p.createdAt);
      const t = trendMap.get(mk);
      if (t) t.registrations += 1;
    }
  }
  for (const l of livestock) {
    if (l.createdAt >= twelveMonthsAgo) {
      const mk = monthKey(l.createdAt);
      const t = trendMap.get(mk);
      if (t) t.registrations += 1;
    }
  }
  const monthlyTrends = Array.from(trendMap.values()).map(t => ({
    ...t,
    payouts: Number(t.payouts.toFixed(2)),
  }));

  // ── Claim severity buckets ──
  const bucketMap = new Map<string, ClaimSeverityBucket>([
    ['0-20%', { bucket: '0-20%', count: 0, totalPayout: 0 }],
    ['20-40%', { bucket: '20-40%', count: 0, totalPayout: 0 }],
    ['40-60%', { bucket: '40-60%', count: 0, totalPayout: 0 }],
    ['60-80%', { bucket: '60-80%', count: 0, totalPayout: 0 }],
    ['80-100%', { bucket: '80-100%', count: 0, totalPayout: 0 }],
  ]);
  for (const c of claims) {
    const severity = c.imageAnalysisSeverity ?? c.damageDepthRatio;
    const b = bucketMap.get(severityBucket(severity));
    if (b) {
      b.count += 1;
      if (c.status === 'APPROVED' || c.status === 'PAID') {
        b.totalPayout += c.calculatedPayout;
      }
    }
  }
  for (const b of bucketMap.values()) {
    b.totalPayout = Number(b.totalPayout.toFixed(2));
  }
  const claimSeverityBuckets = Array.from(bucketMap.values());

  // ── Claim status distribution ──
  const statusMap = new Map<string, { status: string; count: number; totalPayout: number }>();
  for (const c of claims) {
    if (!statusMap.has(c.status)) {
      statusMap.set(c.status, { status: c.status, count: 0, totalPayout: 0 });
    }
    const s = statusMap.get(c.status)!;
    s.count += 1;
    if (c.status === 'APPROVED' || c.status === 'PAID') {
      s.totalPayout += c.calculatedPayout;
    }
  }
  for (const s of statusMap.values()) {
    s.totalPayout = Number(s.totalPayout.toFixed(2));
  }
  const claimStatusDistribution = Array.from(statusMap.values()).sort((a, b) => b.count - a.count);

  // ── Summary ──
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);
  const totalPayout = claims
    .filter(c => c.status === 'APPROVED' || c.status === 'PAID')
    .reduce((s, c) => s + c.calculatedPayout, 0);
  const totalAreaHectares = plots.reduce((s, p) => s + p.areaHectares, 0);
  const totalLivestockHeadCount = livestock.reduce((s, l) => s + l.headCount, 0);
  const totalLivestockValue = livestock.reduce((s, l) => s + l.declaredValue * l.headCount, 0);
  const avgDamageDepth = claims.length > 0
    ? Number((claims.reduce((s, c) => s + c.damageDepthRatio, 0) / claims.length).toFixed(3))
    : null;
  const claimsWithVlm = claims.filter(c => c.imageAnalysisSeverity != null);
  const avgImageSeverity = claimsWithVlm.length > 0
    ? Number((claimsWithVlm.reduce((s, c) => s + (c.imageAnalysisSeverity ?? 0), 0) / claimsWithVlm.length).toFixed(3))
    : null;

  const response: AnalyticsResponse = {
    crops,
    livestock: livestockArr,
    regions,
    monthlyTrends,
    claimSeverityBuckets,
    claimStatusDistribution,
    summary: {
      totalPlots: plots.length,
      totalLivestock: livestock.length,
      totalPolicies: policies.length,
      totalSumInsured: Number(totalSumInsured.toFixed(2)),
      totalPremium: Number(totalPremium.toFixed(2)),
      totalPayout: Number(totalPayout.toFixed(2)),
      totalAreaHectares: Number(totalAreaHectares.toFixed(2)),
      totalLivestockHeadCount,
      totalLivestockValue: Number(totalLivestockValue.toFixed(2)),
      avgDamageDepth,
      avgImageSeverity,
    },
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
