'use client';

import { Sprout, LayoutDashboard, Map, Beef, FileText, Satellite, Gavel, Banknote, Leaf, CloudSun, MapPinned } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import { DashboardTab } from '@/components/agri/dashboard-tab';
import { PlotsTab } from '@/components/agri/plots-tab';
import { LivestockTab } from '@/components/agri/livestock-tab';
import { PoliciesTab } from '@/components/agri/policies-tab';
import { TelemetryTab } from '@/components/agri/telemetry-tab';
import { ClaimsTab } from '@/components/agri/claims-tab';
import { SettlementsTab } from '@/components/agri/settlements-tab';
import { WeatherTab } from '@/components/agri/weather-tab';

// Leaflet requires window — load the DamageMap only on the client.
const DamageMapTab = dynamic(() => import('@/components/agri/damage-map-tab').then((m) => m.DamageMapTab), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-sm text-slate-500">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0C3B2E]" />
      <span className="ml-2">Loading Leaflet map…</span>
    </div>
  ),
});

const TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'plots', label: 'Plots', icon: Map },
  { value: 'livestock', label: 'Livestock', icon: Beef },
  { value: 'policies', label: 'Policies', icon: FileText },
  { value: 'telemetry', label: 'Telemetry', icon: Satellite },
  { value: 'weather', label: 'Weather', icon: CloudSun },
  { value: 'damagemap', label: 'Damage Map', icon: MapPinned },
  { value: 'claims', label: 'Claims', icon: Gavel },
  { value: 'settlements', label: 'Settlements', icon: Banknote },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-[#0C3B2E] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3DDBB5]/20 ring-1 ring-[#3DDBB5]/40">
              <Sprout className="h-6 w-6 text-[#3DDBB5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight sm:text-xl">Agricultural Insurance System</h1>
              <p className="text-xs text-emerald-100/80 sm:text-sm">Crop &amp; Livestock Platform · parametric &amp; indemnity cover</p>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-emerald-100/70 sm:text-xs">
            <span className="inline-flex items-center gap-1"><Leaf className="h-3 w-3" /> Spatial plot registry</span>
            <span className="inline-flex items-center gap-1"><Beef className="h-3 w-3" /> Biometric livestock identity</span>
            <span className="inline-flex items-center gap-1"><Satellite className="h-3 w-3" /> Sentinel-2 telemetry oracle</span>
            <span className="inline-flex items-center gap-1"><CloudSun className="h-3 w-3" /> Real-time weather (Open-Meteo)</span>
            <span className="inline-flex items-center gap-1"><Gavel className="h-3 w-3" /> Stage × depth loss engine</span>
            <span className="inline-flex items-center gap-1"><Banknote className="h-3 w-3" /> Mobile money settlement</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <div className="mb-5 overflow-x-auto">
            <TabsList className="flex h-auto w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-[#0C3B2E] data-[state=active]:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none"><DashboardTab /></TabsContent>
          <TabsContent value="plots" className="mt-0 focus-visible:outline-none"><PlotsTab /></TabsContent>
          <TabsContent value="livestock" className="mt-0 focus-visible:outline-none"><LivestockTab /></TabsContent>
          <TabsContent value="policies" className="mt-0 focus-visible:outline-none"><PoliciesTab /></TabsContent>
          <TabsContent value="telemetry" className="mt-0 focus-visible:outline-none"><TelemetryTab /></TabsContent>
          <TabsContent value="weather" className="mt-0 focus-visible:outline-none"><WeatherTab /></TabsContent>
          <TabsContent value="damagemap" className="mt-0 focus-visible:outline-none"><DamageMapTab /></TabsContent>
          <TabsContent value="claims" className="mt-0 focus-visible:outline-none"><ClaimsTab /></TabsContent>
          <TabsContent value="settlements" className="mt-0 focus-visible:outline-none"><SettlementsTab /></TabsContent>
        </Tabs>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p className="flex items-center gap-1.5">
            <Sprout className="h-3.5 w-3.5 text-[#2A7A65]" />
            Agricultural Insurance System · demo build · mock telemetry &amp; mobile money rails
          </p>
          <p>FAO Ky factors · Sentinel-2 NDVI · M-Pesa / MTN / Airtel</p>
        </div>
      </footer>
    </div>
  );
}
