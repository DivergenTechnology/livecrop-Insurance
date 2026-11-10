'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPinned, Layers, Crosshair } from 'lucide-react';
import { SectionCard } from './shared';

// Leaflet requires window — dynamic import with ssr: false
const DamageMap = dynamic(() => import('./damage-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-sm text-slate-500">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0C3B2E]" />
      <span className="ml-2">Loading spatial database + Leaflet map…</span>
    </div>
  ),
});

export function DamageMapTab() {
  const [selectedPlotName, setSelectedPlotName] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Spatial damage assessment map"
        description="Interactive Leaflet map overlay of all registered plots, colored by composite damage score. Integrates spatial data (PostGIS or turf.js fallback), claim severity, VLM image analysis, and Sentinel-2 NDVI telemetry."
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="h-4 w-4" />
            <span>OSM + Esri satellite overlay</span>
          </div>
        }
      >
        <DamageMap onPlotSelect={(_id, name) => setSelectedPlotName(name)} />
        {selectedPlotName && (
          <p className="mt-3 text-xs text-emerald-700">
            <Crosshair className="mr-1 inline h-3 w-3" />
            Selected: <strong>{selectedPlotName}</strong> — file a claim or view telemetry for this plot using the other tabs.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="How the spatial damage assessment works"
        description="The composite damage score combines four data sources into a single 0–1 severity per plot."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MapPinned className="h-4 w-4 text-[#0C3B2E]" /> Spatial database layer
            </h4>
            <p className="text-xs text-slate-600">
              The <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">src/lib/spatial-db.ts</code> module
              auto-detects the database backend. On Postgres+PostGIS it issues raw SQL using
              <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">ST_Intersects</code>,
              <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">ST_Centroid</code>, and
              <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">ST_Contains</code> for spatial queries.
              On SQLite (dev), it falls back to <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">turf.js</code>
              for the same operations. The application code is identical either way.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Crosshair className="h-4 w-4 text-[#0C3B2E]" /> Composite damage score
            </h4>
            <p className="text-xs text-slate-600">
              Each plot&apos;s damage level is the average of up to four normalized components (0–1 each):
              VLM image analysis severity, claim damage depth ratio, NDVI deviation from healthy (0.6 baseline),
              and drought severity (14-day rainfall deficit). Plots are colored green (healthy) → yellow → orange → red (severe).
              Overlapping plots (spatial conflicts) get a dashed dark-red border.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
          <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
            <strong>Green (0–0.15):</strong> No damage. Healthy NDVI, no claims, no alerts.
          </div>
          <div className="rounded border border-yellow-200 bg-yellow-50 p-2 text-yellow-800">
            <strong>Yellow (0.15–0.4):</strong> Low damage. Minor stress or low-severity claim.
          </div>
          <div className="rounded border border-orange-200 bg-orange-50 p-2 text-orange-800">
            <strong>Orange (0.4–0.7):</strong> Moderate. Active claim or NDVI below 0.4.
          </div>
          <div className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-800">
            <strong>Red (0.7+):</strong> Severe. High-severity claim, VLM &gt; 70%, or NDVI &lt; 0.2.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
