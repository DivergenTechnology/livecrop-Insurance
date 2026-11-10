'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Gavel, Check, X, Calculator, ScanLine, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { apiFetch, fmtMoney, fmtDate, fmtDateTime, type Policy, type Claim, type ImageAnalysisResult, StatusBadge } from './shared';
import { SectionCard } from './shared';
import { ImageUpload } from './image-upload';

interface AssessmentResponse {
  claim: Claim;
  assessment: {
    stage: string;
    stageKyFactor: number;
    daysSown: number;
    replantCutoff: number;
    damageDepthRatio: number;
    sumInsured: number;
    inputCost: number;
    payout: number;
    type: 'REPLANT_ALLOWANCE' | 'FULL_INDEMNITY';
    lossSeverityRatio?: number;
  };
}

export function ClaimsTab() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    policyId: '',
    incidentDate: new Date().toISOString().slice(0, 10),
    damageDepth: 0.5,
  });
  const [imageAnalysisApplied, setImageAnalysisApplied] = useState(false);

  const [assessingId, setAssessingId] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [assessOpen, setAssessOpen] = useState(false);

  // Image analysis dialog for existing claims
  const [analyzeClaim, setAnalyzeClaim] = useState<Claim | null>(null);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        apiFetch<Claim[]>('/api/claims'),
        apiFetch<Policy[]>('/api/policies'),
      ]);
      setClaims(c);
      setPolicies(p);
    } catch (e) {
      toast.error('Failed to load claims', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // When the selected policy changes, reset the image-analysis-applied flag
  useEffect(() => {
    setImageAnalysisApplied(false);
  }, [form.policyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.policyId) return toast.error('Please select a policy');
    if (!form.incidentDate) return toast.error('Incident date is required');

    setSubmitting(true);
    try {
      const created = await apiFetch<Claim>('/api/claims', {
        method: 'POST',
        body: JSON.stringify({
          policyId: form.policyId,
          incidentDate: form.incidentDate,
          damageDepthRatio: form.damageDepth,
        }),
      });
      toast.success('Claim filed', {
        description: `${created.assetType} claim · damage depth ${(created.damageDepthRatio * 100).toFixed(0)}%`,
      });
      setForm({ ...form, policyId: '' });
      setImageAnalysisApplied(false);
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error('Failed to file claim', { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  // When the VLM image analysis completes, auto-fill the damage depth slider
  function handleImageAnalysisComplete(result: ImageAnalysisResult) {
    const recommended = result.aggregate.recommendedDamageDepth;
    setForm((f) => ({ ...f, damageDepth: recommended }));
    setImageAnalysisApplied(true);
    toast.info('Damage depth auto-filled from image analysis', {
      description: `Set to ${(recommended * 100).toFixed(0)}% — adjust the slider if needed before filing.`,
      duration: 6000,
    });
  }

  // For existing claims: open the analyze dialog
  function handleAnalyzeImage(claim: Claim) {
    setAnalyzeClaim(claim);
    setAnalyzeOpen(true);
  }

  // When the analyze dialog's VLM completes (for existing claims), refresh + close
  function handleExistingClaimAnalysisComplete(_result: ImageAnalysisResult) {
    setRefreshKey((k) => k + 1);
    // Keep the dialog open so the user sees the result, but refresh the underlying table
  }

  async function handleAssess(claimId: string) {
    setAssessingId(claimId);
    try {
      const res = await apiFetch<AssessmentResponse>('/api/claims/assess', {
        method: 'POST',
        body: JSON.stringify({ claimId }),
      });
      setAssessment(res);
      setAssessOpen(true);
      setRefreshKey((k) => k + 1);
      toast.success('Assessment complete', {
        description: `${res.assessment.type} · payout ${fmtMoney(res.assessment.payout)}`,
      });
    } catch (e) {
      toast.error('Assessment failed', { description: (e as Error).message });
    } finally {
      setAssessingId(null);
    }
  }

  async function handleApprove(claimId: string) {
    try {
      await apiFetch<Claim>('/api/claims/approve', {
        method: 'POST',
        body: JSON.stringify({ claimId }),
      });
      toast.success('Claim approved', { description: 'Ready for disbursement in the Settlements tab' });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error('Approval failed', { description: (e as Error).message });
    }
  }

  async function handleReject(claimId: string) {
    try {
      await apiFetch<Claim>('/api/claims/reject', {
        method: 'POST',
        body: JSON.stringify({ claimId }),
      });
      toast.info('Claim rejected');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error('Reject failed', { description: (e as Error).message });
    }
  }

  // Get context for the VLM from the selected policy
  const selectedPolicy = policies.find((p) => p.id === form.policyId);
  const imageLivestockType = analyzeClaim?.policy?.livestock?.livestockType ?? selectedPolicy?.livestock?.livestockType ?? '';
  const imageCategory = analyzeClaim?.policy?.livestock?.category ?? selectedPolicy?.livestock?.category ?? '';

  return (
    <>
      <SectionCard
        title="Claims"
        description={`${claims.length} claims filed · loss engine uses FAO Ky factors · VLM image analysis available for damage severity`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                  <Plus className="mr-2 h-4 w-4" /> File Claim
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>File an insurance claim</DialogTitle>
                  <DialogDescription>
                    The system auto-determines the growth stage from the incident date. Optionally upload livestock photos — the vision model assesses damage severity and auto-fills the slider below.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="policy">Policy</Label>
                    <Select value={form.policyId} onValueChange={(v) => setForm({ ...form, policyId: v })}>
                      <SelectTrigger id="policy"><SelectValue placeholder="Select policy" /></SelectTrigger>
                      <SelectContent>
                        {policies.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.assetType} · {p.farmer?.name} · {p.variety?.name ?? p.livestock?.uniqueTagId ?? '—'} · Sum {fmtMoney(p.sumInsured)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incident">Incident date</Label>
                    <Input id="incident" type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} />
                    <p className="text-xs text-slate-500">Used to compute days-since-coverage-start → growth stage.</p>
                  </div>

                  {/* Image upload + VLM analysis — shown for all claim types, most useful for LIVESTOCK */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <ScanLine className="h-4 w-4 text-[#0C3B2E]" />
                      Livestock damage photos (optional — AI-assisted severity)
                    </Label>
                    <ImageUpload
                      compact
                      livestockType={imageLivestockType}
                      category={imageCategory}
                      onAnalysisComplete={handleImageAnalysisComplete}
                    />
                    {imageAnalysisApplied && (
                      <p className="text-xs text-emerald-700">
                        ✓ Damage depth below auto-filled from the vision model&apos;s assessment. Adjust if needed.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="damage">Damage depth</Label>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-slate-700">
                        {(form.damageDepth * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      id="damage"
                      min={0}
                      max={100}
                      step={1}
                      value={[Math.round(form.damageDepth * 100)]}
                      onValueChange={(v) => setForm({ ...form, damageDepth: v[0] / 100 })}
                    />
                    <p className="text-xs text-slate-500">
                      0 = no damage · 1 = total loss. Multiplied by the stage Ky factor to get the effective loss ratio.
                      {imageAnalysisApplied && ' (auto-filled by VLM — adjust manually if needed)'}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">
                      {submitting ? 'Filing…' : 'File claim'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading claims…</p>
        ) : claims.length === 0 ? (
          <p className="text-sm text-slate-500">No claims filed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Incident</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Damage</TableHead>
                  <TableHead>VLM</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs text-slate-500">{c.id.slice(-8)}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{c.policyId.slice(-8)}</TableCell>
                    <TableCell>
                      <span className={c.assetType === 'CROP' ? 'text-emerald-700' : 'text-amber-700'}>{c.assetType}</span>
                    </TableCell>
                    <TableCell className="text-slate-500">{fmtDate(c.incidentDate)}</TableCell>
                    <TableCell className="text-slate-600">{c.growthStageAtLoss ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{(c.damageDepthRatio * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      {c.imageAnalysisSeverity != null ? (
                        <Badge variant="outline" className="border-[#0C3B2E]/30 bg-[#0C3B2E]/5 text-[#0C3B2E]" title={`VLM assessed: ${(c.imageAnalysisSeverity * 100).toFixed(0)}% severity, ${c.imageAnalysisDamageType}, ${c.imageAnalysisConfidence} confidence`}>
                          <ImageIcon className="mr-1 h-3 w-3" />
                          {(c.imageAnalysisSeverity * 100).toFixed(0)}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.calculatedPayout ? fmtMoney(c.calculatedPayout) : '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{c.payoutType ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.status === 'SUBMITTED' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAnalyzeImage(c)}
                              title="Upload photos for VLM damage analysis"
                              className="border-[#0C3B2E]/30 text-[#0C3B2E] hover:bg-[#0C3B2E]/5"
                            >
                              <ScanLine className="h-3.5 w-3.5" />
                              <span className="ml-1 hidden md:inline">Analyze</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAssess(c.id)}
                              disabled={assessingId === c.id}
                              title="Run loss engine"
                            >
                              {assessingId === c.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
                              <span className="ml-1 hidden sm:inline">Assess</span>
                            </Button>
                          </>
                        )}
                        {c.status === 'ASSESSED' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleAnalyzeImage(c)} title="Upload photos for VLM analysis" className="border-[#0C3B2E]/30 text-[#0C3B2E] hover:bg-[#0C3B2E]/5">
                              <ScanLine className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAssess(c.id)} title="Re-assess">
                              <Calculator className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => handleApprove(c.id)} title="Approve">
                              <Check className="h-3.5 w-3.5" />
                              <span className="ml-1 hidden sm:inline">Approve</span>
                            </Button>
                            <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => handleReject(c.id)} title="Reject">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {(c.status === 'APPROVED' || c.status === 'PAID') && (
                          <span className="text-xs text-slate-400">
                            {c.status === 'PAID' ? 'Settled' : 'Awaiting disbursement'}
                          </span>
                        )}
                        {c.status === 'REJECTED' && (
                          <span className="text-xs text-rose-600">Rejected</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-slate-400">Most recent: {claims[0] ? fmtDateTime(claims[0].createdAt) : '—'}</p>
          </div>
        )}
      </SectionCard>

      {/* VLM image analysis dialog for existing claims */}
      <Dialog open={analyzeOpen} onOpenChange={(v) => { setAnalyzeOpen(v); if (!v) setAnalyzeClaim(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-[#0C3B2E]" /> VLM Damage Severity Analysis
              </span>
            </DialogTitle>
            <DialogDescription>
              {analyzeClaim && (
                <>Claim {analyzeClaim.id.slice(-8)} · {analyzeClaim.assetType}
                {analyzeClaim.policy?.livestock && ` · ${analyzeClaim.policy.livestock.livestockType} (${analyzeClaim.policy.livestock.uniqueTagId})`}
                — upload photos and the vision model will assess the damage severity and update this claim.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {analyzeClaim && (
            <ImageUpload
              claimId={analyzeClaim.id}
              livestockType={imageLivestockType}
              category={imageCategory}
              onAnalysisComplete={handleExistingClaimAnalysisComplete}
            />
          )}
          {analyzeClaim?.imageAnalysisSeverity != null && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-medium text-slate-700">Previous analysis on this claim:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="outline">Severity: {(analyzeClaim.imageAnalysisSeverity * 100).toFixed(0)}%</Badge>
                <Badge variant="outline">Type: {analyzeClaim.imageAnalysisDamageType}</Badge>
                <Badge variant="outline">Confidence: {analyzeClaim.imageAnalysisConfidence}</Badge>
                <Badge variant="outline">Rec: {analyzeClaim.imageAnalysisRecommendation}</Badge>
                {analyzeClaim.imageAnalysisAt && (
                  <span className="text-slate-400">{fmtDateTime(analyzeClaim.imageAnalysisAt)}</span>
                )}
              </div>
              {analyzeClaim.imageAnalysisReasoning && (
                <p className="mt-2 text-slate-600">{analyzeClaim.imageAnalysisReasoning}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setAnalyzeOpen(false); setAnalyzeClaim(null); }} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assessment breakdown dialog */}
      <Dialog open={assessOpen} onOpenChange={setAssessOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <Gavel className="h-5 w-5 text-[#0C3B2E]" /> Loss engine breakdown
              </span>
            </DialogTitle>
            <DialogDescription>
              Calculated using the FAO Stage × Depth algorithm. Replant cap applies in EMERGENCE or before the replant cutoff day.
            </DialogDescription>
          </DialogHeader>
          {assessment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Sum insured" value={fmtMoney(assessment.assessment.sumInsured)} />
                <Field label="Input cost" value={fmtMoney(assessment.assessment.inputCost)} />
                <Field label="Days sown" value={`${assessment.assessment.daysSown}`} />
                <Field label="Replant cutoff" value={`Day ${assessment.assessment.replantCutoff}`} />
                <Field label="Growth stage" value={assessment.assessment.stage} />
                <Field label="FAO Ky factor" value={assessment.assessment.stageKyFactor.toFixed(2)} />
                <Field label="Damage depth" value={`${(assessment.assessment.damageDepthRatio * 100).toFixed(0)}%`} />
                <Field
                  label="Payout type"
                  value={assessment.assessment.type === 'REPLANT_ALLOWANCE' ? 'Replant allowance' : 'Full indemnity'}
                />
              </div>

              {/* Show VLM analysis if present on the claim */}
              {assessment.claim.imageAnalysisSeverity != null && (
                <div className="rounded-lg border border-[#0C3B2E]/30 bg-[#0C3B2E]/5 p-3">
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-[#0C3B2E]">
                    <ScanLine className="h-3.5 w-3.5" /> Vision model assessment
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Severity: {(assessment.claim.imageAnalysisSeverity * 100).toFixed(0)}%</Badge>
                    <Badge variant="outline">{assessment.claim.imageAnalysisDamageType}</Badge>
                    <Badge variant="outline">{assessment.claim.imageAnalysisConfidence} confidence</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{assessment.claim.imageAnalysisReasoning}</p>
                </div>
              )}

              {assessment.assessment.lossSeverityRatio !== undefined && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-600">Loss severity ratio</span>
                    <span className="font-semibold text-slate-900">{(assessment.assessment.lossSeverityRatio * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={assessment.assessment.lossSeverityRatio * 100} className="h-2 bg-slate-100 [&>div]:bg-[#2A7A65]" />
                  <p className="mt-1 text-xs text-slate-500">= damageDepth × Ky (clamped to [0, 1])</p>
                </div>
              )}

              {assessment.assessment.type === 'REPLANT_ALLOWANCE' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <strong>Replant cap applied:</strong> payout = min(inputCost × damageDepth, sumInsured × 25%).
                  This bounds early-stage claims to a replanting allowance rather than a full indemnity.
                </div>
              )}
              {assessment.assessment.type === 'FULL_INDEMNITY' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <strong>Full indemnity:</strong> payout = sumInsured × effectiveLossRatio.
                  Beyond the replant window, the policy pays out proportionally to the FAO-weighted loss.
                </div>
              )}

              <div className="rounded-lg border-2 border-[#0C3B2E] bg-[#0C3B2E]/5 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Calculated payout</p>
                <p className="mt-1 text-3xl font-bold text-[#0C3B2E]">{fmtMoney(assessment.assessment.payout)}</p>
              </div>

              <p className="text-xs text-slate-400">
                The claim has been moved to <strong>ASSESSED</strong>. Click <strong>Approve</strong> in the table to authorise disbursement.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setAssessOpen(false)} className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
