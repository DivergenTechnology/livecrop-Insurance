'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, BarChart3, PieChart as PieIcon, TrendingUp, MapPin, Beef, Sprout, AlertTriangle } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiFetch, fmtMoney } from './shared';
import { SectionCard } from './shared';

// ──────────────────────────────────────────────────────────────────────────
// Types
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

// ──────────────────────────────────────────────────────────────────────────
// Color palette (agricultural, no blue/indigo per skill rules)
// ──────────────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#0C3B2E', // deep forest green
  '#2A7A65', // sage
  '#3DDBB5', // mint
  '#facc15', // yellow
  '#f97316', // orange
  '#dc2626', // red
  '#7f1d1d', // dark red
  '#15803D', // green-700
  '#a16207', // amber-700
  '#92400e', // brown
];

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: '#facc15',
  ASSESSED: '#0ea5e9',
  APPROVED: '#14b8a6',
  PAID: '#22c55e',
  REJECTED: '#dc2626',
};

const SEVERITY_COLORS: Record<string, string> = {
  '0-20%': '#22c55e',
  '20-40%': '#facc15',
  '40-60%': '#f97316',
  '60-80%': '#dc2626',
  '80-100%': '#7f1d1d',
};

// ──────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<AnalyticsResponse>('/api/analytics');
      setData(result);
    } catch (e) {
      toast.error('Failed to load analytics', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0C3B2E]" />
        <span className="ml-2">Computing analytics…</span>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">No analytics data available.</p>;
  }

  const { summary, crops, livestock, regions, monthlyTrends, claimSeverityBuckets, claimStatusDistribution } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="Total plots" value={summary.totalPlots.toString()} icon={<Sprout className="h-4 w-4" />} color="emerald" />
        <KpiCard label="Total livestock" value={summary.totalLivestock.toString()} icon={<Beef className="h-4 w-4" />} color="amber" />
        <KpiCard label="Total area" value={`${summary.totalAreaHectares} ha`} icon={<MapPin className="h-4 w-4" />} color="teal" />
        <KpiCard label="Head count" value={summary.totalLivestockHeadCount.toString()} icon={<Beef className="h-4 w-4" />} color="stone" />
        <KpiCard label="Sum insured" value={fmtMoney(summary.totalSumInsured)} icon={<BarChart3 className="h-4 w-4" />} color="emerald" />
        <KpiCard label="Total payout" value={fmtMoney(summary.totalPayout)} icon={<TrendingUp className="h-4 w-4" />} color="rose" />
      </div>

      <SectionCard
        title="Statistical analytics & visualization"
        description="Aggregated summaries across crop categories, livestock categories, regions, and time. Charts powered by Recharts."
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      >
        {/* ── Crop category charts ── */}
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sprout className="h-4 w-4 text-[#0C3B2E]" /> Crop category analytics
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Crop plot count pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PieIcon className="h-4 w-4 text-[#2A7A65]" /> Plot distribution by crop type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {crops.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={crops}
                        dataKey="plotCount"
                        nameKey="cropType"
                        cx="50%" cy="50%"
                        outerRadius={90}
                        label={(entry: { cropType: string; plotCount: number }) => `${entry.cropType} (${entry.plotCount})`}
                      >
                        {crops.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} plots`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Crop area + sum insured bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-[#2A7A65]" /> Area & sum insured by crop
                </CardTitle>
              </CardHeader>
              <CardContent>
                {crops.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={crops} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="cropType" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit=" ha" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="K" />
                      <Tooltip
                        formatter={(v: number, name: string) =>
                          name === 'area' ? [`${v} ha`, 'Area'] : [`KES ${v.toLocaleString()}`, 'Sum insured']
                        }
                      />
                      <Legend formatter={(s: string) => s === 'totalAreaHectares' ? 'Area (ha)' : 'Sum insured (KES)'} />
                      <Bar yAxisId="left" dataKey="totalAreaHectares" fill="#2A7A65" name="totalAreaHectares" radius={[3, 3, 0, 0]} />
                      <Bar yAxisId="right" dataKey="totalSumInsured" fill="#0C3B2E" name="totalSumInsured" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Crop NDVI radar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-[#2A7A65]" /> Avg NDVI by crop (health indicator)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {crops.filter(c => c.avgNdvi != null).length === 0 ? (
                  <EmptyChart message="No NDVI data. Generate telemetry in the Telemetry tab." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={crops.filter(c => c.avgNdvi != null)}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="cropType" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
                      <Radar name="Avg NDVI" dataKey="avgNdvi" stroke="#2A7A65" fill="#2A7A65" fillOpacity={0.4} />
                      <Tooltip formatter={(v: number) => [v?.toFixed(3), 'NDVI']} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Crop claims + payouts bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-[#2A7A65]" /> Claims & payouts by crop
                </CardTitle>
              </CardHeader>
              <CardContent>
                {crops.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={crops} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="cropType" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="K" />
                      <Tooltip
                        formatter={(v: number, name: string) =>
                          name === 'claimCount' ? [`${v} claims`, 'Claims'] : [`KES ${v.toLocaleString()}`, 'Payout']
                        }
                      />
                      <Legend formatter={(s: string) => s === 'claimCount' ? 'Claim count' : 'Total payout (KES)'} />
                      <Bar yAxisId="left" dataKey="claimCount" fill="#f97316" name="claimCount" radius={[3, 3, 0, 0]} />
                      <Bar yAxisId="right" dataKey="totalPayout" fill="#dc2626" name="totalPayout" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Crop data table */}
          {crops.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Crop</TableHead>
                    <TableHead className="text-right">Plots</TableHead>
                    <TableHead className="text-right">Total area (ha)</TableHead>
                    <TableHead className="text-right">Avg area (ha)</TableHead>
                    <TableHead className="text-right">Policies</TableHead>
                    <TableHead className="text-right">Sum insured</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead className="text-right">Claims</TableHead>
                    <TableHead className="text-right">Payouts</TableHead>
                    <TableHead className="text-right">Avg NDVI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crops.map((c) => (
                    <TableRow key={c.cropType}>
                      <TableCell className="font-medium text-slate-900">{c.cropType}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.plotCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.totalAreaHectares}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.avgAreaHectares}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.policyCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(c.totalSumInsured)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(c.totalPremium)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.claimCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(c.totalPayout)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.avgNdvi != null ? (
                          <span className={c.avgNdvi < 0.3 ? 'font-semibold text-rose-600' : ''}>{c.avgNdvi.toFixed(3)}</span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* ── Livestock category charts ── */}
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Beef className="h-4 w-4 text-[#0C3B2E]" /> Livestock category analytics
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Livestock head count by type bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-[#2A7A65]" /> Head count by livestock type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {livestock.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={livestock} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="livestockType" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v} head`, 'Count']} />
                      <Bar dataKey="totalHeadCount" fill="#2A7A65" name="Head count" radius={[3, 3, 0, 0]}>
                        {livestock.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Livestock value by type pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PieIcon className="h-4 w-4 text-[#2A7A65]" /> Total value by livestock type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {livestock.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={livestock}
                        dataKey="totalDeclaredValue"
                        nameKey="livestockType"
                        cx="50%" cy="50%"
                        outerRadius={90}
                        label={(entry: { livestockType: string; totalDeclaredValue: number }) => `${entry.livestockType}`}
                      >
                        {livestock.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmtMoney(v), 'Total value']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Livestock sum insured + premium bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-[#2A7A65]" /> Sum insured & premium by livestock type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {livestock.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={livestock} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="livestockType" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} unit="K" />
                      <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, '']} />
                      <Legend formatter={(s: string) => s === 'totalSumInsured' ? 'Sum insured' : 'Premium'} />
                      <Bar dataKey="totalSumInsured" fill="#0C3B2E" name="totalSumInsured" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="totalPremium" fill="#3DDBB5" name="totalPremium" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Livestock claims + payouts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-[#2A7A65]" /> Claims & payouts by livestock type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {livestock.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={livestock} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="livestockType" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="K" />
                      <Tooltip
                        formatter={(v: number, name: string) =>
                          name === 'claimCount' ? [`${v} claims`, 'Claims'] : [`KES ${v.toLocaleString()}`, 'Payout']
                        }
                      />
                      <Legend formatter={(s: string) => s === 'claimCount' ? 'Claim count' : 'Total payout (KES)'} />
                      <Bar yAxisId="left" dataKey="claimCount" fill="#f97316" name="claimCount" radius={[3, 3, 0, 0]} />
                      <Bar yAxisId="right" dataKey="totalPayout" fill="#dc2626" name="totalPayout" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Livestock data table */}
          {livestock.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Assets</TableHead>
                    <TableHead className="text-right">Head count</TableHead>
                    <TableHead className="text-right">Avg value/head</TableHead>
                    <TableHead className="text-right">Total value</TableHead>
                    <TableHead className="text-right">Policies</TableHead>
                    <TableHead className="text-right">Sum insured</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead className="text-right">Claims</TableHead>
                    <TableHead className="text-right">Payouts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {livestock.map((l) => (
                    <TableRow key={`${l.livestockType}-${l.category}`}>
                      <TableCell className="font-medium text-slate-900">{l.livestockType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{l.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.assetCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.totalHeadCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.avgDeclaredValuePerHead)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.totalDeclaredValue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.policyCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.totalSumInsured)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.totalPremium)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.claimCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(l.totalPayout)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* ── Region analytics ── */}
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MapPin className="h-4 w-4 text-[#0C3B2E]" /> Regional analytics
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Farmers & plots by region</CardTitle>
              </CardHeader>
              <CardContent>
                {regions.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={regions} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="region" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend formatter={(s: string) => s === 'farmerCount' ? 'Farmers' : 'Plots'} />
                      <Bar dataKey="farmerCount" fill="#0C3B2E" name="farmerCount" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="plotCount" fill="#2A7A65" name="plotCount" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sum insured & payouts by region</CardTitle>
              </CardHeader>
              <CardContent>
                {regions.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={regions} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="region" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} unit="K" />
                      <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, '']} />
                      <Legend formatter={(s: string) => s === 'totalSumInsured' ? 'Sum insured' : 'Total payout'} />
                      <Bar dataKey="totalSumInsured" fill="#2A7A65" name="totalSumInsured" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="totalPayout" fill="#dc2626" name="totalPayout" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Time series + claim analytics ── */}
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <TrendingUp className="h-4 w-4 text-[#0C3B2E]" /> Time series & claim analytics
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Monthly trends area chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">12-month trend: claims, registrations, payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyTrends} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2A7A65" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#2A7A65" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="K" />
                    <Tooltip />
                    <Legend formatter={(s: string) => s === 'claims' ? 'Claims' : s === 'registrations' ? 'Registrations' : 'Payouts (KES)'} />
                    <Area yAxisId="left" type="monotone" dataKey="claims" stroke="#f97316" fill="url(#cGrad)" name="claims" />
                    <Area yAxisId="left" type="monotone" dataKey="registrations" stroke="#2A7A65" fill="url(#rGrad)" name="registrations" />
                    <Line yAxisId="right" type="monotone" dataKey="payouts" stroke="#dc2626" strokeWidth={2} dot={false} name="payouts" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Claim status pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Claim status distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {claimStatusDistribution.length === 0 ? (
                  <EmptyChart message="No claims filed yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={claimStatusDistribution}
                        dataKey="count"
                        nameKey="status"
                        cx="50%" cy="50%"
                        outerRadius={100}
                        label={(entry: { status: string; count: number }) => `${entry.status}: ${entry.count}`}
                      >
                        {claimStatusDistribution.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} claims`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Severity buckets bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Claim severity distribution (VLM or damage depth)</CardTitle>
              </CardHeader>
              <CardContent>
                {claimSeverityBuckets.every(b => b.count === 0) ? (
                  <EmptyChart message="No claims with severity data yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={claimSeverityBuckets} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="K" />
                      <Tooltip
                        formatter={(v: number, name: string) =>
                          name === 'count' ? [`${v} claims`, 'Count'] : [`KES ${v.toLocaleString()}`, 'Payout']
                        }
                      />
                      <Legend formatter={(s: string) => s === 'count' ? 'Claim count' : 'Total payout (KES)'} />
                      <Bar yAxisId="left" dataKey="count" name="count" radius={[3, 3, 0, 0]}>
                        {claimSeverityBuckets.map((b) => (
                          <Cell key={b.bucket} fill={SEVERITY_COLORS[b.bucket] ?? '#94a3b8'} />
                        ))}
                      </Bar>
                      <Bar yAxisId="right" dataKey="totalPayout" fill="#0C3B2E" name="totalPayout" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Avg severity gauge */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Average damage severity across all claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[260px] flex-col items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Avg damage depth</p>
                    <p className="mt-1 text-4xl font-bold text-slate-900">
                      {summary.avgDamageDepth != null ? `${(summary.avgDamageDepth * 100).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Avg VLM image severity</p>
                    <p className="mt-1 text-4xl font-bold text-[#0C3B2E]">
                      {summary.avgImageSeverity != null ? `${(summary.avgImageSeverity * 100).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-center">
                      <p className="text-slate-500">Loss ratio</p>
                      <p className="font-semibold text-emerald-700">
                        {summary.totalSumInsured > 0
                          ? `${((summary.totalPayout / summary.totalSumInsured) * 100).toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-2 text-center">
                      <p className="text-slate-500">Premium / payout</p>
                      <p className="font-semibold text-slate-700">
                        {summary.totalPayout > 0
                          ? `${(summary.totalPremium / summary.totalPayout).toFixed(2)}×`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon, color,
}: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    teal: 'border-teal-200 bg-teal-50 text-teal-800',
    stone: 'border-stone-200 bg-stone-50 text-stone-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] ?? colorMap.emerald}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide opacity-75">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyChart({ message }: { message?: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
      {message ?? 'No data to display yet.'}
    </div>
  );
}
