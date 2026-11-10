'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Banknote, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch, fmtMoney, fmtDateTime, type Settlement, type Claim, StatusBadge } from './shared';
import { SectionCard } from './shared';

const RAILS = ['MPESA', 'MTN', 'AIRTEL'] as const;

export function SettlementsTab() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [approvedClaims, setApprovedClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');
  const [rail, setRail] = useState<'AUTO' | (typeof RAILS)[number]>('AUTO');
  const [open, setOpen] = useState(false);

  const [result, setResult] = useState<Settlement | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        apiFetch<Settlement[]>('/api/settlements'),
        apiFetch<Claim[]>('/api/claims'),
      ]);
      setSettlements(s);
      setApprovedClaims(c.filter((cl) => cl.status === 'APPROVED'));
    } catch (e) {
      toast.error('Failed to load settlements', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  async function handleDisburse(claimIdOverride?: string) {
    const claimId = claimIdOverride ?? selectedClaimId;
    if (!claimId) {
      toast.error('Select an approved claim first');
      return;
    }
    setDisbursingId(claimId);
    setOpen(false);
    try {
      const res = await apiFetch<Settlement>('/api/settlements', {
        method: 'POST',
        body: JSON.stringify({
          claimId,
          rail: rail === 'AUTO' ? undefined : rail,
        }),
      });
      setResult(res);
      setResultOpen(true);
      if (res.status === 'PAID') {
        toast.success('Disbursement successful', {
          description: `${res.rail} · ${res.reference} · ${fmtMoney(res.amount)}`,
        });
      } else {
        toast.error('Disbursement failed', {
          description: `${res.rail} · ${res.reference} · the claim can be retried`,
        });
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error('Disbursement failed', { description: (e as Error).message });
    } finally {
      setDisbursingId(null);
      setSelectedClaimId('');
      setRail('AUTO');
    }
  }

  const totalPaid = settlements.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amount, 0);
  const totalFailed = settlements.filter((s) => s.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Disbursement queue"
        description={`${approvedClaims.length} approved claim(s) awaiting payment · select a rail and disburse`}
        actions={
          <Button size="sm" onClick={() => setOpen(true)} disabled={approvedClaims.length === 0} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
            <Banknote className="mr-2 h-4 w-4" /> Disburse
          </Button>
        }
      >
        {approvedClaims.length === 0 ? (
          <p className="text-sm text-slate-500">No approved claims. Approve a claim in the Claims tab first.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Payee phone</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedClaims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs text-slate-500">{c.id.slice(-8)}</TableCell>
                    <TableCell>{c.policy?.farmer?.name ?? '—'}</TableCell>
                    <TableCell>
                      <span className={c.assetType === 'CROP' ? 'text-emerald-700' : 'text-amber-700'}>{c.assetType}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.policy?.farmer?.phone ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-[#0C3B2E]">{fmtMoney(c.calculatedPayout)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90"
                        onClick={() => handleDisburse(c.id)}
                        disabled={disbursingId === c.id}
                      >
                        {disbursingId === c.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                        <span className="ml-1">Pay</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Settlement ledger"
        description={`${settlements.length} settlement(s) · ${fmtMoney(totalPaid)} paid · ${totalFailed} failed`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : settlements.length === 0 ? (
          <p className="text-sm text-slate-500">No settlements yet. Disburse an approved claim to populate the ledger.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Rail</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-medium text-slate-900">{s.reference ?? '—'}</TableCell>
                    <TableCell>
                      <RailBadge rail={s.rail} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{s.claimId.slice(-8)}</TableCell>
                    <TableCell className="font-mono text-xs">{s.payee}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(s.amount)}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-slate-500">{fmtDateTime(s.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Disbursement dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-[#0C3B2E]" /> Disburse via mobile money
              </span>
            </DialogTitle>
            <DialogDescription>
              Pick an approved claim and a mobile money rail. The mock API returns a 10-char reference and succeeds ~90% of the time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Approved claim</label>
              <Select value={selectedClaimId} onValueChange={setSelectedClaimId}>
                <SelectTrigger><SelectValue placeholder="Select claim" /></SelectTrigger>
                <SelectContent>
                  {approvedClaims.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.id.slice(-8)} · {c.policy?.farmer?.name} · {fmtMoney(c.calculatedPayout)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mobile money rail</label>
              <Select value={rail} onValueChange={(v) => setRail(v as 'AUTO' | (typeof RAILS)[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Auto (random)</SelectItem>
                  {RAILS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => handleDisburse()} disabled={!selectedClaimId} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
              <Banknote className="mr-2 h-4 w-4" /> Disburse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result dialog */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disbursement result</DialogTitle>
            <DialogDescription>
              The mock mobile money API has returned a transaction reference.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-4">
              <div className={`rounded-lg border-2 p-4 text-center ${result.status === 'PAID' ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                {result.status === 'PAID' ? (
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                ) : (
                  <XCircle className="mx-auto h-10 w-10 text-rose-600" />
                )}
                <p className="mt-2 text-sm uppercase tracking-wide text-slate-500">Status</p>
                <p className={`text-2xl font-bold ${result.status === 'PAID' ? 'text-emerald-700' : 'text-rose-700'}`}>{result.status}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Rail</p>
                  <p className="font-semibold text-slate-900">{result.rail}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-semibold text-slate-900">{fmtMoney(result.amount)}</p>
                </div>
                <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Reference</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">{result.reference}</p>
                </div>
                <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Payee</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">{result.payee}</p>
                </div>
              </div>
              {result.status === 'FAILED' && (
                <p className="text-xs text-rose-600">
                  The settlement was recorded as FAILED. The claim remains APPROVED so you can retry the disbursement.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultOpen(false)} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RailBadge({ rail }: { rail: string }) {
  const styles: Record<string, string> = {
    MPESA: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    MTN: 'border-amber-300 bg-amber-100 text-amber-800',
    AIRTEL: 'border-rose-300 bg-rose-100 text-rose-800',
  };
  return <Badge variant="outline" className={styles[rail] ?? ''}>{rail}</Badge>;
}
