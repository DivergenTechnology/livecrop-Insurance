'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiFetch, fmtDate, fmtDateTime, type Farmer, type Plot } from './shared';
import { SectionCard } from './shared';
import { PlotPreview } from './plot-preview';

const SAMPLE_GEOJSON = `{
  "type": "Feature",
  "properties": {},
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [36.90, -0.45],
      [36.95, -0.45],
      [36.95, -0.40],
      [36.90, -0.40],
      [36.90, -0.45]
    ]]
  }
}`;

export function PlotsTab() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    farmerId: '',
    plotName: '',
    areaHectares: '',
    soilType: '',
    boundaryGeoJson: SAMPLE_GEOJSON,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, f] = await Promise.all([
        apiFetch<Plot[]>('/api/plots'),
        apiFetch<Farmer[]>('/api/farmers'),
      ]);
      setPlots(p);
      setFarmers(f);
    } catch (e) {
      toast.error('Failed to load plots', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.farmerId) return toast.error('Please select a farmer');
    if (!form.plotName) return toast.error('Plot name is required');
    if (!form.boundaryGeoJson) return toast.error('GeoJSON polygon is required');

    let parsed: unknown;
    try {
      parsed = JSON.parse(form.boundaryGeoJson);
    } catch {
      return toast.error('GeoJSON is not valid JSON');
    }

    setSubmitting(true);
    try {
      const created = await apiFetch<Plot>('/api/plots', {
        method: 'POST',
        body: JSON.stringify({
          farmerId: form.farmerId,
          plotName: form.plotName,
          areaHectares: Number(form.areaHectares) || 0,
          soilType: form.soilType || null,
          boundaryGeoJson: parsed,
        }),
      });
      toast.success('Plot registered', { description: `${created.plotName} · ${created.areaHectares} ha` });
      setForm({ farmerId: '', plotName: '', areaHectares: '', soilType: '', boundaryGeoJson: SAMPLE_GEOJSON });
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      const err = e as Error & { status?: number; data?: { overlappingIds?: string[] } };
      if (err.status === 409) {
        const ids = err.data?.overlappingIds ?? [];
        toast.error('Spatial overlap detected', {
          description: `Conflicts with ${ids.length} existing plot(s): ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '…' : ''}`,
          duration: 6000,
        });
      } else {
        toast.error('Failed to register plot', { description: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const overlapCount = plots.filter((p) => (p.overlappingIds?.length ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Plot registry"
        description={`${plots.length} plots registered${overlapCount > 0 ? ` · ${overlapCount} with spatial overlap` : ''}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                  <Plus className="mr-2 h-4 w-4" /> Register Plot
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Register farm plot</DialogTitle>
                  <DialogDescription>
                    Enter the plot details and a GeoJSON Polygon boundary (WGS84 lon/lat). The system validates the polygon and checks for spatial overlap.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="farmer">Farmer</Label>
                      <Select value={form.farmerId} onValueChange={(v) => setForm({ ...form, farmerId: v })}>
                        <SelectTrigger id="farmer"><SelectValue placeholder="Select farmer" /></SelectTrigger>
                        <SelectContent>
                          {farmers.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.name} · {f.region}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plotName">Plot name</Label>
                      <Input id="plotName" value={form.plotName} onChange={(e) => setForm({ ...form, plotName: e.target.value })} placeholder="e.g. Nyeri Highland Block C" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="area">Area (hectares)</Label>
                      <Input id="area" type="number" step="0.01" value={form.areaHectares} onChange={(e) => setForm({ ...form, areaHectares: e.target.value })} placeholder="auto-computed if omitted" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="soil">Soil type (optional)</Label>
                      <Input id="soil" value={form.soilType} onChange={(e) => setForm({ ...form, soilType: e.target.value })} placeholder="e.g. Volcanic loam" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="geojson">GeoJSON polygon boundary</Label>
                    <Textarea
                      id="geojson"
                      rows={8}
                      className="font-mono text-xs"
                      value={form.boundaryGeoJson}
                      onChange={(e) => setForm({ ...form, boundaryGeoJson: e.target.value })}
                    />
                    <p className="text-xs text-slate-500">
                      Tip: the polygon&apos;s outer ring must be closed (first point = last point) and use [lon, lat] order.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                      {submitting ? 'Registering…' : 'Register plot'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading plots…</p>
        ) : plots.length === 0 ? (
          <p className="text-sm text-slate-500">No plots registered yet. Click <strong>Register Plot</strong> to add one.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plot</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Area (ha)</TableHead>
                  <TableHead>Soil</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plots.map((p) => {
                  const overlap = (p.overlappingIds?.length ?? 0) > 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-slate-900">{p.plotName}</TableCell>
                      <TableCell>{p.farmer?.name ?? '—'}</TableCell>
                      <TableCell className="text-slate-600">{p.farmer?.region ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.areaHectares}</TableCell>
                      <TableCell className="text-slate-600">{p.soilType ?? '—'}</TableCell>
                      <TableCell className="text-slate-500">{fmtDate(p.createdAt)}</TableCell>
                      <TableCell>
                        {overlap ? (
                          <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-700">
                            <AlertCircle className="mr-1 h-3 w-3" /> Overlap
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            <MapPin className="mr-1 h-3 w-3" /> Clear
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Spatial overview"
        description="All plot boundaries projected onto a single SVG canvas. Overlapping plots are shown in red."
      >
        <PlotPreview plots={plots} />
        <p className="mt-3 text-xs text-slate-400">Last updated: {plots[0] ? fmtDateTime(plots[0].createdAt) : '—'}</p>
      </SectionCard>
    </div>
  );
}
