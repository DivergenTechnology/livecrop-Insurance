'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Satellite, CloudRain, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ReferenceLine,
} from 'recharts';
import { apiFetch, fmtDateTime, type Plot, type TelemetryResponse, type AlertEntry } from './shared';
import { SectionCard } from './shared';

export function TelemetryTab() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load plots + alerts list.
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, a] = await Promise.all([
          apiFetch<Plot[]>('/api/plots'),
          apiFetch<AlertEntry[]>('/api/telemetry/alerts'),
        ]);
        setPlots(p);
        setAlerts(a);
        if (!selectedPlotId && p.length > 0) setSelectedPlotId(p[0].id);
      } catch (e) {
        toast.error('Failed to load telemetry', { description: (e as Error).message });
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey, selectedPlotId === '']);

  // Load telemetry for the selected plot.
  const loadTelemetry = useCallback(async () => {
    if (!selectedPlotId) {
      setData(null);
      return;
    }
    try {
      const d = await apiFetch<TelemetryResponse>(`/api/telemetry?plotId=${encodeURIComponent(selectedPlotId)}`);
      setData(d);
    } catch (e) {
      toast.error('Failed to load readings', { description: (e as Error).message });
    }
  }, [selectedPlotId]);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry, selectedPlotId]);

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await apiFetch<{ message: string; plots: number; generated: number }>('/api/telemetry/seed', { method: 'POST' });
      toast.success('Telemetry generated', { description: `${res.generated} readings across ${res.plots} plots` });
      setRefreshKey((k) => k + 1);
      await loadTelemetry();
    } catch (e) {
      toast.error('Failed to seed telemetry', { description: (e as Error).message });
    } finally {
      setSeeding(false);
    }
  }

  // Format chart data.
  const chartData = (data?.readings ?? []).map((r) => ({
    date: new Date(r.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    ndvi: r.ndvi,
    rainfall: r.rainfall,
    rawDate: r.timestamp,
  }));

  const trigger = data?.trigger;
  const hasAlert = trigger?.ndviAlert || trigger?.droughtAlert;

  const activeAlerts = alerts.filter((a) => a.ndviAlert || a.droughtAlert);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Satellite & telemetry oracle"
        description="Mock Sentinel-2 NDVI (5-day cadence) + daily rainfall. Parametric trigger: NDVI &lt; 0.30 OR 14-day rainfall &lt; 5mm."
        actions={
          <Button size="sm" onClick={handleSeed} disabled={seeding} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
            <RefreshCw className={`mr-2 h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? 'Generating…' : 'Generate / Refresh Telemetry'}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plots.map((p) => {
            const a = alerts.find((x) => x.plotId === p.id);
            const alerted = a && (a.ndviAlert || a.droughtAlert);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlotId(p.id)}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedPlotId === p.id
                    ? 'border-[#0C3B2E] bg-emerald-50 ring-1 ring-[#0C3B2E]'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{p.plotName}</span>
                  {alerted ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {a?.latestNdvi != null ? `Latest NDVI ${a.latestNdvi.toFixed(2)}` : 'No data'}
                  {' · '}
                  {a?.rainfall14d != null ? `14d rain ${a.rainfall14d.toFixed(1)}mm` : ''}
                </p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {selectedPlotId && (
        <SectionCard
          title="NDVI time series"
          description={`Plot: ${plots.find((p) => p.id === selectedPlotId)?.plotName ?? selectedPlotId}`}
          actions={
            trigger && (
              <Badge variant="outline" className={hasAlert ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-emerald-300 bg-emerald-100 text-emerald-800'}>
                {hasAlert ? <AlertTriangle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                {hasAlert ? 'TRIGGER FIRED' : 'NO TRIGGER'}
              </Badge>
            )
          }
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-slate-500">No telemetry yet. Click <strong>Generate / Refresh Telemetry</strong> above.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Satellite className="h-4 w-4 text-emerald-600" /> NDVI
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                        formatter={(v: number) => [v.toFixed(3), 'NDVI']}
                      />
                      <ReferenceLine y={0.3} stroke="#B91C1C" strokeDasharray="4 3" label={{ value: 'Trigger 0.30', fontSize: 10, fill: '#B91C1C', position: 'insideTopRight' }} />
                      <Line type="monotone" dataKey="ndvi" stroke="#2A7A65" strokeWidth={2} dot={{ r: 2, fill: '#2A7A65' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <CloudRain className="h-4 w-4 text-teal-600" /> Daily rainfall (mm)
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                        formatter={(v: number) => [`${v.toFixed(1)} mm`, 'Rainfall']}
                      />
                      <Bar dataKey="rainfall" fill="#3DDBB5" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {trigger && (
                <div className={`rounded-lg border p-4 text-sm ${hasAlert ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex items-start gap-2">
                    {hasAlert ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />}
                    <div>
                      <p className={`font-medium ${hasAlert ? 'text-amber-900' : 'text-emerald-900'}`}>
                        {hasAlert ? 'Parametric trigger fired' : 'No trigger'}
                      </p>
                      <p className="mt-1 text-slate-700">{trigger.message}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        <span>Latest NDVI: <strong>{trigger.latestNdvi?.toFixed(3) ?? '—'}</strong></span>
                        <span>14-day rainfall: <strong>{trigger.rainfall14d?.toFixed(1) ?? '—'} mm</strong></span>
                        <span>Readings: <strong>{data?.readings.length ?? 0}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="Active alerts across all plots"
        description={`${activeAlerts.length} parametric trigger(s) currently active`}
      >
        {activeAlerts.length === 0 ? (
          <p className="text-sm text-slate-500">No active alerts. All plots healthy.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto pr-1">
            <ul className="space-y-2">
              {activeAlerts.map((a) => (
                <li key={a.plotId} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-900">{a.plotName}</span>
                      <span className="text-slate-500"> · {a.farmerName} · {a.region}</span>
                    </div>
                    <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                      {a.ndviAlert && a.droughtAlert ? 'DUAL' : a.ndviAlert ? 'NDVI' : 'DROUGHT'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{a.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
