'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Fingerprint, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch, fmtMoney, fmtDate, fmtDateTime, type Farmer, type Livestock, CategoryBadge } from './shared';
import { SectionCard } from './shared';

const CATEGORIES = ['DAIRY', 'BEEF', 'POULTRY', 'SMALL_RUMINANT'] as const;
const LIVESTOCK_TYPES = ['Cattle', 'Goat', 'Sheep', 'Poultry', 'Pig', 'Donkey', 'Camel'] as const;

export function LivestockTab() {
  const [items, setItems] = useState<Livestock[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    farmerId: '',
    livestockType: 'Cattle' as (typeof LIVESTOCK_TYPES)[number],
    category: 'DAIRY' as (typeof CATEGORIES)[number],
    uniqueTagId: '',
    ageYears: '',
    headCount: '1',
    registrationDate: '',
    declaredValue: '',
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, f] = await Promise.all([
        apiFetch<Livestock[]>('/api/livestock'),
        apiFetch<Farmer[]>('/api/farmers'),
      ]);
      setItems(l);
      setFarmers(f);
    } catch (e) {
      toast.error('Failed to load livestock', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.farmerId) return toast.error('Please select an owner');
    if (!form.uniqueTagId) return toast.error('Tag ID is required');
    if (!form.declaredValue) return toast.error('Estimated price per head is required');

    setSubmitting(true);
    try {
      const created = await apiFetch<Livestock & { duplicateWarning: { message: string; matchedTagId: string; similarity: number } | null }>(
        '/api/livestock',
        {
          method: 'POST',
          body: JSON.stringify({
            farmerId: form.farmerId,
            livestockType: form.livestockType,
            category: form.category,
            uniqueTagId: form.uniqueTagId,
            ageYears: form.ageYears ? Number(form.ageYears) : null,
            headCount: Number(form.headCount) || 1,
            registrationDate: form.registrationDate || null,
            declaredValue: Number(form.declaredValue),
          }),
        },
      );

      if (created.duplicateWarning) {
        toast.warning('Livestock registered — but a duplicate was flagged', {
          description: created.duplicateWarning.message,
          duration: 8000,
        });
      } else {
        toast.success('Livestock registered', {
          description: `${created.livestockType} · ${created.uniqueTagId} · ${fmtMoney(created.declaredValue)}/head × ${created.headCount}`,
        });
      }
      setForm({ farmerId: '', livestockType: 'Cattle', category: 'DAIRY', uniqueTagId: '', ageYears: '', headCount: '1', registrationDate: '', declaredValue: '' });
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        toast.error('Tag ID already exists', { description: err.message });
      } else {
        toast.error('Failed to register livestock', { description: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Show a snippet of the muzzle hash (first 6 + last 4 dims).
  function muzzleSnippet(hash: string | null): string {
    if (!hash) return '—';
    try {
      const arr = JSON.parse(hash) as number[];
      if (!Array.isArray(arr) || arr.length === 0) return '—';
      const head = arr.slice(0, 6).map((n) => n.toFixed(2)).join(', ');
      return `[${head}, … ] (${arr.length}-dim)`;
    } catch {
      return '—';
    }
  }

  return (
    <SectionCard
      title="Livestock identity & biometrics"
      description={`${items.length} assets registered · muzzle-print embeddings are 512-dim simulated vectors`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                <Plus className="mr-2 h-4 w-4" /> Register Livestock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register livestock asset</DialogTitle>
                <DialogDescription>
                  The system simulates a muzzle-print embedding (512-dim) from the tag ID and runs a cosine-similarity scan against existing assets. Similarity &gt; 0.95 is flagged as a potential duplicate.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="farmer">Owner name</Label>
                  <Select value={form.farmerId} onValueChange={(v) => setForm({ ...form, farmerId: v })}>
                    <SelectTrigger id="farmer"><SelectValue placeholder="Select owner" /></SelectTrigger>
                    <SelectContent>
                      {farmers.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name} · {f.region}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="livestockType">Type of livestock</Label>
                    <Select value={form.livestockType} onValueChange={(v) => setForm({ ...form, livestockType: v as (typeof LIVESTOCK_TYPES)[number] })}>
                      <SelectTrigger id="livestockType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LIVESTOCK_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as (typeof CATEGORIES)[number] })}>
                      <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age (years)</Label>
                    <Input id="age" type="number" step="0.1" min="0" value={form.ageYears} onChange={(e) => setForm({ ...form, ageYears: e.target.value })} placeholder="e.g. 4.5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headCount">Numbers (head)</Label>
                    <Input id="headCount" type="number" min="1" value={form.headCount} onChange={(e) => setForm({ ...form, headCount: e.target.value })} placeholder="e.g. 1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationDate">Date</Label>
                    <Input id="registrationDate" type="date" value={form.registrationDate} onChange={(e) => setForm({ ...form, registrationDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tag">Unique tag ID</Label>
                    <Input id="tag" value={form.uniqueTagId} onChange={(e) => setForm({ ...form, uniqueTagId: e.target.value })} placeholder="e.g. COW-DAIRY-002" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">Estimated price (KES / head)</Label>
                    <Input id="value" type="number" value={form.declaredValue} onChange={(e) => setForm({ ...form, declaredValue: e.target.value })} placeholder="e.g. 75000" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                    {submitting ? 'Registering…' : 'Register livestock'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading livestock…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No livestock registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tag ID</TableHead>
                <TableHead className="text-right">Age (yrs)</TableHead>
                <TableHead className="text-right">Numbers</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Price/head</TableHead>
                <TableHead className="text-right">Total value</TableHead>
                <TableHead>Muzzle print</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => {
                const totalValue = (l.declaredValue ?? 0) * (l.headCount ?? 1);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-slate-900">{l.livestockType ?? '—'}</TableCell>
                    <TableCell><CategoryBadge category={l.category} /></TableCell>
                    <TableCell>{l.farmer?.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">{l.uniqueTagId}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.ageYears != null ? l.ageYears.toFixed(1) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.headCount}</TableCell>
                    <TableCell className="text-slate-600">{l.registrationDate ? fmtDate(l.registrationDate) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(l.declaredValue)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtMoney(totalValue)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
                        <Fingerprint className="h-3 w-3" />
                        {muzzleSnippet(l.muzzlePrintHash)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-slate-400">
            <Copy className="mr-1 inline h-3 w-3" />
            Muzzle embeddings are deterministic per tag ID — registering the same tag twice (with a different ID) will still produce a near-identical vector, which the duplicate detector catches. Total value = price/head × numbers.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
