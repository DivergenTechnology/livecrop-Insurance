'use client';

// Shared types + small UI helpers used across all agri tabs.

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------- Types ----------
export interface Farmer {
  id: string;
  name: string;
  phone: string;
  region: string;
  createdAt: string;
  _count?: { plots: number; livestock: number; policies: number };
}

export interface Plot {
  id: string;
  farmerId: string;
  plotName: string;
  areaHectares: number;
  boundaryGeoJson: string;
  soilType: string | null;
  createdAt: string;
  farmer?: { id: string; name: string; region: string };
  overlappingIds?: string[];
}

export interface Livestock {
  id: string;
  farmerId: string;
  category: 'DAIRY' | 'BEEF' | 'POULTRY' | 'SMALL_RUMINANT';
  uniqueTagId: string;
  muzzlePrintHash: string | null;
  declaredValue: number;
  createdAt: string;
  farmer?: { id: string; name: string; region: string };
}

export interface StageVuln {
  id: string;
  stage: 'EMERGENCE' | 'VEGETATIVE' | 'FLOWERING' | 'MATURITY';
  startDayOffset: number;
  endDayOffset: number;
  stageKyFactor: number;
  replantWindowFlag: boolean;
}
export interface Variety {
  id: string;
  name: string;
  stages: StageVuln[];
}

export interface Policy {
  id: string;
  farmerId: string;
  assetType: 'CROP' | 'LIVESTOCK';
  plotId: string | null;
  livestockId: string | null;
  varietyId: string | null;
  sumInsured: number;
  inputCost: number;
  premium: number;
  coverageStart: string;
  coverageEnd: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  farmer?: { id: string; name: string; region: string };
  plot?: Plot | null;
  livestock?: Livestock | null;
  variety?: Variety | null;
  _count?: { claims: number };
}

export interface TelemetryReading {
  id: string;
  plotId: string;
  timestamp: string;
  ndvi: number;
  rainfall: number;
  source: string;
}
export interface TriggerInfo {
  ndviAlert: boolean;
  latestNdvi: number | null;
  droughtAlert: boolean;
  rainfall14d: number | null;
  message: string;
}
export interface TelemetryResponse {
  plotId: string;
  readings: TelemetryReading[];
  trigger: TriggerInfo;
}
export interface AlertEntry {
  plotId: string;
  plotName: string;
  farmerName: string | null;
  region: string | null;
  readingsCount: number;
  ndviAlert: boolean;
  latestNdvi: number | null;
  droughtAlert: boolean;
  rainfall14d: number | null;
  message: string;
}

export interface Claim {
  id: string;
  policyId: string;
  assetType: string;
  incidentDate: string;
  growthStageAtLoss: string | null;
  damageDepthRatio: number;
  calculatedPayout: number;
  payoutType: 'REPLANT_ALLOWANCE' | 'FULL_INDEMNITY' | null;
  lossSeverityRatio: number | null;
  status: 'SUBMITTED' | 'ASSESSED' | 'APPROVED' | 'PAID' | 'REJECTED';
  evidenceUrl: string | null;
  createdAt: string;
  policy?: Policy;
  settlement?: Settlement | null;
}

export interface Settlement {
  id: string;
  claimId: string;
  payee: string;
  amount: number;
  rail: 'MPESA' | 'MTN' | 'AIRTEL';
  status: 'PAID' | 'FAILED';
  reference: string | null;
  createdAt: string;
  claim?: Claim;
}

export interface Dashboard {
  counts: {
    farmers: number;
    plots: number;
    livestock: number;
    activePolicies: number;
    claimsByStatus: Record<string, number>;
    totalDisbursed: number;
    pendingClaims: number;
  };
  recentActivity: {
    claims: Claim[];
    plots: Plot[];
    livestock: Livestock[];
  };
}

// ---------- Helpers ----------
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    const err = new Error(message) as Error & { status: number; data: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return '—';
  const d = typeof s === 'string' ? new Date(s) : s;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function fmtDateTime(s: string | Date | null | undefined): string {
  if (!s) return '—';
  const d = typeof s === 'string' ? new Date(s) : s;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------- Status badge ----------
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  // Policy
  ACTIVE: { label: 'Active', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  EXPIRED: { label: 'Expired', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  // Claim
  SUBMITTED: { label: 'Submitted', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  ASSESSED: { label: 'Assessed', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  APPROVED: { label: 'Approved', className: 'bg-teal-100 text-teal-800 border-teal-200' },
  PAID: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  // Settlement
  PAID_SETTLEMENT: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  FAILED: { label: 'Failed', className: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === 'PAID'
      ? STATUS_STYLES['PAID'] // ambiguous between claim & settlement; both green
      : STATUS_STYLES[status] ?? { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' };
  return (
    <Badge variant="outline" className={cn('font-medium', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    DAIRY: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    BEEF: 'bg-amber-100 text-amber-800 border-amber-200',
    POULTRY: 'bg-teal-100 text-teal-800 border-teal-200',
    SMALL_RUMINANT: 'bg-stone-100 text-stone-700 border-stone-200',
  };
  return (
    <Badge variant="outline" className={styles[category] ?? 'bg-slate-100 text-slate-700 border-slate-200'}>
      {category}
    </Badge>
  );
}

// ---------- Section card wrapper ----------
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
