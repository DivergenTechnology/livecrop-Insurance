'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch, fmtMoney, fmtDate, fmtDateTime, type Farmer, type Plot, type Livestock, type Variety, type Policy, StatusBadge } from './shared';
import { SectionCard } from './shared';

type AssetType = 'CROP' | 'LIVESTOCK';

export function PoliciesTab() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    farmerId: '',
    assetType: 'CROP' as AssetType,
    plotId: '',
    livestockId: '',
    varietyId: '',
    sumInsured: '',
    inputCost: '',
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, f, pl, l, v] = await Promise.all([
        apiFetch<Policy[]>('/api/policies'),
        apiFetch<Farmer[]>('/api/farmers'),
        apiFetch<Plot[]>('/api/plots'),
        apiFetch<Livestock[]>('/api/livestock'),
        apiFetch<Variety[]>('/api/varieties'),
      ]);
      setPolicies(p);
      setFarmers(f);
      setPlots(pl);
      setLivestock(l);
      setVarieties(v);
    } catch (e) {
      toast.error('Failed to load policies', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // Auto-compute premium preview.
  const premiumPreview = useMemo(() => {
    const sum = Number(form.sumInsured) || 0;
    if (sum <= 0) return null;
    const rate = form.assetType === 'CROP' ? 0.05 : 0.08;
    return {
      rate: (rate * 100).toFixed(0) + '%',
      premium: fmtMoney(sum * rate),
    };
  }, [form.sumInsured, form.assetType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.farmerId) return toast.error('Please select a farmer');
    if (!form.sumInsured) return toast.error('Sum insured is required');
    if (form.assetType === 'CROP' && !form.plotId) return toast.error('Please select a plot for crop policies');
    if (form.assetType === 'LIVESTOCK' && !form.livestockId) return toast.error('Please select a livestock asset');

    setSubmitting(true);
    try {
      const created = await apiFetch<Policy>('/api/policies', {
        method: 'POST',
        body: JSON.stringify({
          farmerId: form.farmerId,
          assetType: form.assetType,
          plotId: form.assetType === 'CROP' ? form.plotId : null,
          livestockId: form.assetType === 'LIVESTOCK' ? form.livestockId : null,
          varietyId: form.assetType === 'CROP' ? form.varietyId || null : null,
          sumInsured: Number(form.sumInsured),
          inputCost: form.inputCost ? Number(form.inputCost) : 0,
        }),
      });
      toast.success('Policy underwritten', {
        description: `${created.assetType} · Sum ${fmtMoney(created.sumInsured)} · Premium ${fmtMoney(created.premium)}`,
      });
      setForm({ farmerId: '', assetType: 'CROP', plotId: '', livestockId: '', varietyId: '', sumInsured: '', inputCost: '' });
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error('Failed to underwrite policy', { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard
      title="Policies"
      description={`${policies.length} policies · premium = sumInsured × 5% (crop) or 8% (livestock)`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                <Plus className="mr-2 h-4 w-4" /> Underwrite Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Underwrite a new policy</DialogTitle>
                <DialogDescription>
                  Premium is auto-computed from the sum insured: 5% for crop, 8% for livestock. Coverage runs for 1 year by default.
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
                    <Label htmlFor="assetType">Asset type</Label>
                    <Select value={form.assetType} onValueChange={(v) => setForm({ ...form, assetType: v as AssetType, plotId: '', livestockId: '', varietyId: '' })}>
                      <SelectTrigger id="assetType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CROP">CROP</SelectItem>
                        <SelectItem value="LIVESTOCK">LIVESTOCK</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.assetType === 'CROP' ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="plot">Plot</Label>
                      <Select value={form.plotId} onValueChange={(v) => setForm({ ...form, plotId: v })}>
                        <SelectTrigger id="plot"><SelectValue placeholder="Select plot" /></SelectTrigger>
                        <SelectContent>
                          {plots.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.plotName} · {p.areaHectares} ha</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="variety">Crop variety</Label>
                      <Select value={form.varietyId} onValueChange={(v) => setForm({ ...form, varietyId: v })}>
                        <SelectTrigger id="variety"><SelectValue placeholder="Select variety" /></SelectTrigger>
                        <SelectContent>
                          {varieties.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="livestock">Livestock asset</Label>
                    <Select value={form.livestockId} onValueChange={(v) => setForm({ ...form, livestockId: v })}>
                      <SelectTrigger id="livestock"><SelectValue placeholder="Select livestock" /></SelectTrigger>
                      <SelectContent>
                        {livestock.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.uniqueTagId} · {l.category} · {fmtMoney(l.declaredValue)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sum">Sum insured (KES)</Label>
                    <Input id="sum" type="number" value={form.sumInsured} onChange={(e) => setForm({ ...form, sumInsured: e.target.value })} placeholder="e.g. 120000" />
                  </div>
                  {form.assetType === 'CROP' && (
                    <div className="space-y-2">
                      <Label htmlFor="inputCost">Input cost (KES) — for replant cap</Label>
                      <Input id="inputCost" type="number" value={form.inputCost} onChange={(e) => setForm({ ...form, inputCost: e.target.value })} placeholder="e.g. 30000" />
                    </div>
                  )}
                </div>

                {premiumPreview && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <span className="text-slate-600">Premium preview: </span>
                    <span className="font-semibold text-emerald-800">{premiumPreview.premium}</span>
                    <span className="text-slate-500"> (rate {premiumPreview.rate})</span>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                    {submitting ? 'Underwriting…' : 'Underwrite policy'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading policies…</p>
      ) : policies.length === 0 ? (
        <p className="text-sm text-slate-500">No policies yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Asset type</TableHead>
                <TableHead>Underlying asset</TableHead>
                <TableHead>Farmer</TableHead>
                <TableHead className="text-right">Sum insured</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Claims</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs text-slate-500">{p.id.slice(-8)}</TableCell>
                  <TableCell>
                    <span className={p.assetType === 'CROP' ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>{p.assetType}</span>
                  </TableCell>
                  <TableCell>
                    {p.assetType === 'CROP'
                      ? `${p.plot?.plotName ?? '—'} · ${p.variety?.name ?? '—'}`
                      : `${p.livestock?.uniqueTagId ?? '—'} (${p.livestock?.category ?? '—'})`}
                  </TableCell>
                  <TableCell>{p.farmer?.name ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(p.sumInsured)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(p.premium)}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {fmtDate(p.coverageStart)} → {fmtDate(p.coverageEnd)}
                  </TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{p._count?.claims ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-slate-400">Last refreshed: {policies[0] ? fmtDateTime(policies[0].createdAt) : '—'}</p>
        </div>
      )}
    </SectionCard>
  );
}
