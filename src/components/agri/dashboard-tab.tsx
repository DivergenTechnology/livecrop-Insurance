'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Sprout, MapPin, Beef, FileText, Clock, Banknote, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch, fmtMoney, fmtDateTime, type Dashboard, type AlertEntry } from './shared';

export function DashboardTab() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        apiFetch<Dashboard>('/api/dashboard'),
        apiFetch<AlertEntry[]>('/api/telemetry/alerts'),
      ]);
      setData(d);
      setAlerts(a);
    } catch (e) {
      toast.error('Failed to load dashboard', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeAlerts = alerts.filter((a) => a.ndviAlert || a.droughtAlert);

  const kpis = [
    { label: 'Total Farmers', value: data?.counts.farmers ?? 0, icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Plots', value: data?.counts.plots ?? 0, icon: MapPin, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Livestock Registered', value: data?.counts.livestock ?? 0, icon: Beef, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Policies', value: data?.counts.activePolicies ?? 0, icon: FileText, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Pending Claims', value: data?.counts.pendingClaims ?? 0, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Total Disbursed', value: fmtMoney(data?.counts.totalDisbursed), icon: Banknote, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{k.value}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${k.bg}`}>
                    <Icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Claims by status</h3>
              <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {(['SUBMITTED', 'ASSESSED', 'APPROVED', 'PAID', 'REJECTED'] as const).map((s) => {
                const count = data?.counts.claimsByStatus[s] ?? 0;
                return (
                  <div key={s} className="flex min-w-[120px] flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-xs font-medium uppercase text-slate-500">{s}</span>
                    <span className="text-2xl font-bold text-slate-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-base font-semibold text-slate-900">Active telemetry alerts</h3>
            </div>
            {activeAlerts.length === 0 ? (
              <p className="text-sm text-slate-500">No parametric triggers fired. All plots healthy.</p>
            ) : (
              <ul className="space-y-2">
                {activeAlerts.map((a) => (
                  <li key={a.plotId} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{a.plotName}</span>
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                        {a.ndviAlert && a.droughtAlert ? 'DUAL' : a.ndviAlert ? 'NDVI' : 'DROUGHT'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{a.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Recent activity</h3>
          {loading && !data ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent claims</h4>
                {data?.recentActivity.claims.length === 0 ? (
                  <p className="text-sm text-slate-400">None yet</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data?.recentActivity.claims.map((c) => (
                      <li key={c.id} className="text-sm">
                        <span className="font-medium text-slate-900">{c.policy?.farmer?.name ?? 'Unknown'}</span>
                        <span className="text-slate-500"> · {c.assetType.toLowerCase()} claim · </span>
                        <span className="text-slate-400">{fmtDateTime(c.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent plots</h4>
                {data?.recentActivity.plots.length === 0 ? (
                  <p className="text-sm text-slate-400">None yet</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data?.recentActivity.plots.map((p) => (
                      <li key={p.id} className="text-sm">
                        <span className="font-medium text-slate-900">{p.plotName}</span>
                        <span className="text-slate-500"> · {p.areaHectares} ha · </span>
                        <span className="text-slate-400">{fmtDateTime(p.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent livestock</h4>
                {data?.recentActivity.livestock.length === 0 ? (
                  <p className="text-sm text-slate-400">None yet</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data?.recentActivity.livestock.map((l) => (
                      <li key={l.id} className="text-sm">
                        <span className="font-medium text-slate-900">{l.uniqueTagId}</span>
                        <span className="text-slate-500"> · {l.category} · </span>
                        <span className="text-slate-400">{fmtDateTime(l.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
