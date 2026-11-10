'use client';

// Leaflet map component for crop damage visualization.
// Renders plot boundaries as polygons colored by damage level, with popups
// showing plot details, claims, telemetry, and VLM image analysis results.
//
// Must be dynamically imported with ssr: false (Leaflet requires window).

import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CloudSun, AlertTriangle, ScanLine, Droplets, Sprout, MapPin } from 'lucide-react';
import { apiFetch, fmtMoney, fmtDate, type DamageMapResponse, type DamageMapFeature } from './shared';

// ──────────────────────────────────────────────────────────────────────────
// Damage level → color mapping (agricultural palette)
// ──────────────────────────────────────────────────────────────────────────

const DAMAGE_COLORS: Record<DamageMapFeature['properties']['damageLevel'], string> = {
  none: '#22c55e',      // green-500 — healthy
  low: '#facc15',       // yellow-400 — minor stress
  moderate: '#f97316',  // orange-500 — moderate damage
  severe: '#dc2626',    // red-600 — severe damage
  total: '#7f1d1d',     // red-900 — total loss
};

const DAMAGE_LABELS: Record<DamageMapFeature['properties']['damageLevel'], string> = {
  none: 'No damage',
  low: 'Low damage',
  moderate: 'Moderate damage',
  severe: 'Severe damage',
  total: 'Total loss',
};

// ──────────────────────────────────────────────────────────────────────────
// Style function for GeoJSON polygons
// ──────────────────────────────────────────────────────────────────────────

function styleFeature(feature: L.GeoJSON.Feature): L.PathOptions {
  const props = (feature.properties ?? {}) as DamageMapFeature['properties'];
  const isOverlapping = (props.overlappingIds?.length ?? 0) > 0;
  const color = DAMAGE_COLORS[props.damageLevel ?? 'none'];
  return {
    fillColor: color,
    weight: isOverlapping ? 3 : 2,
    opacity: 1,
    color: isOverlapping ? '#7f1d1d' : '#1e293b',
    dashArray: isOverlapping ? '4 3' : undefined,
    fillOpacity: 0.45,
  };
}

function onEachFeature(feature: L.GeoJSON.Feature, layer: L.Layer) {
  const props = (feature.properties ?? {}) as DamageMapFeature['properties'];
  if (!props) return;
  const popupHtml = `
    <div style="font-family: system-ui, sans-serif; font-size: 12px; min-width: 220px;">
      <div style="font-weight: 600; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
        ${props.plotName}
      </div>
      <div style="color: #475569; margin-bottom: 6px;">
        ${props.farmerName ? `${props.farmerName}` : 'Unknown farmer'}${props.region ? ` · ${props.region}` : ''}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; color: #334155;">
        <span>_crop:</span><strong>${props.cropType ?? '—'}</strong>
        <span>_area:</span><strong>${props.areaHectares} ha</strong>
        <span>_damage:</span><strong style="color: ${DAMAGE_COLORS[props.damageLevel]};">${DAMAGE_LABELS[props.damageLevel]} (${(props.damageScore * 100).toFixed(0)}%)</strong>
        <span>_claims:</span><strong>${props.claimCount}</strong>
        <span>_payout:</span><strong>${fmtMoney(props.calculatedPayout)}</strong>
        <span>_NDVI:</span><strong style="color: ${props.ndviAlert ? '#dc2626' : '#16a34a'};">${props.latestNdvi?.toFixed(2) ?? '—'}${props.ndviAlert ? ' ⚠' : ''}</strong>
        <span>_rain14d:</span><strong style="color: ${props.droughtAlert ? '#dc2626' : '#0ea5e9'};">${props.rainfall14d} mm${props.droughtAlert ? ' ⚠' : ''}</strong>
        ${props.imageAnalysisSeverity != null ? `<span>_VLM:</span><strong>${(props.imageAnalysisSeverity * 100).toFixed(0)}% · ${props.imageAnalysisDamageType}</strong>` : ''}
      </div>
    </div>
  `;
  layer.bindPopup(popupHtml, { maxWidth: 320 });
}

// ──────────────────────────────────────────────────────────────────────────
// Auto-fit bounds helper — fits the map to all features
// ──────────────────────────────────────────────────────────────────────────

function FitBounds({ bbox }: { bbox: [number, number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bbox) return;
    // Leaflet uses [lat, lon] order; our bbox is [minLon, minLat, maxLon, maxLat]
    const bounds: L.LatLngBoundsExpression = [
      [bbox[1], bbox[0]], // southwest
      [bbox[3], bbox[2]], // northeast
    ];
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, bbox]);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Click handler — calls the point-in-plot API when the user clicks empty map
// ──────────────────────────────────────────────────────────────────────────

function ClickHandler({ onPlotFound }: { onPlotFound: (plotName: string) => void }) {
  const map = useMap();
  useEffect(() => {
    function handleClick(e: L.LeafletMouseEvent) {
      // Only fire if no GeoJSON feature was clicked (the GeoJSON layer handles its own clicks)
      // We use a small timeout to let GeoJSON click handlers fire first
      setTimeout(() => {
        const { lat, lng } = e.latlng;
        fetch(`/api/spatial/damage-map?lon=${lng.toFixed(6)}&lat=${lat.toFixed(6)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.plot) onPlotFound(data.plot.plotName);
          })
          .catch(() => { /* ignore click errors */ });
      }, 50);
    }
    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [map, onPlotFound]);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────

interface DamageMapProps {
  height?: number;
  onPlotSelect?: (plotId: string, plotName: string) => void;
}

export default function DamageMap({ height = 520, onPlotSelect }: DamageMapProps) {
  const [data, setData] = useState<DamageMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<DamageMapFeature['properties'] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mapRef = useRef<L.Map | null>(null);

  const loadMap = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<DamageMapResponse>('/api/spatial/damage-map');
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMap();
  }, [refreshKey]);

  const geoJsonData = useMemo(() => {
    if (!data) return null;
    return {
      type: 'FeatureCollection' as const,
      features: data.features.map((f) => ({
        type: 'Feature' as const,
        geometry: f.geometry,
        properties: f.properties,
      })),
    };
  }, [data]);

  const handlePlotFound = (plotName: string) => {
    // Called when the user clicks empty map area and a plot is found at that point
    // (rare — usually the GeoJSON layer handles clicks)
    console.log('Plot found at click:', plotName);
  };

  return (
    <div className="space-y-3">
      {/* Legend + summary bar */}
      {data && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <span className="font-semibold text-slate-700">Damage level:</span>
          {(['none', 'low', 'moderate', 'severe', 'total'] as const).map((level) => (
            <span key={level} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: DAMAGE_COLORS[level] }} />
              {DAMAGE_LABELS[level]}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-3 text-slate-500">
            <span><strong className="text-slate-700">{data.summary.totalPlots}</strong> plots</span>
            <span><strong className="text-amber-700">{data.summary.plotsWithClaims}</strong> with claims</span>
            <span><strong className="text-rose-700">{data.summary.plotsWithAlerts}</strong> with alerts</span>
            <span><strong className="text-emerald-700">{fmtMoney(data.summary.totalPayout)}</strong> total payout</span>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50"
            >
              Refresh
            </button>
          </span>
        </div>
      )}

      {/* Map */}
      <div
        className="relative overflow-hidden rounded-xl border border-slate-300"
        style={{ height }}
      >
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-100/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0C3B2E]" />
              Loading spatial damage map…
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-rose-50 text-sm text-rose-700">
            Failed to load map: {error}
          </div>
        )}
        {!loading && !error && data && data.features.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-500">
            No plots registered yet. Register plots in the Plots tab to see them on the map.
          </div>
        )}
        {!loading && !error && data && data.features.length > 0 && geoJsonData && (
          <MapContainer
            center={[ -0.5, 37.5 ]} // Default to Kenya center; FitBounds will adjust
            zoom={7}
            style={{ height: '100%', width: '100%' }}
            ref={(m) => { mapRef.current = m; }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Satellite overlay for crop damage visual assessment */}
            <TileLayer
              attribution='Tiles &copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              opacity={0.35}
            />
            <GeoJSON
              data={geoJsonData as never}
              style={styleFeature as never}
              onEachFeature={onEachFeature as never}
              eventHandlers={{
                click: (e) => {
                  const layer = e.sourceTarget as L.GeoJSON;
                  const feature = layer.feature as unknown as DamageMapFeature;
                  if (feature?.properties) {
                    setSelectedPlot(feature.properties);
                    onPlotSelect?.(feature.properties.plotId, feature.properties.plotName);
                  }
                },
              }}
            />
            <FitBounds bbox={data.bbox} />
            <ClickHandler onPlotFound={handlePlotFound} />
          </MapContainer>
        )}
      </div>

      {/* Selected plot details panel */}
      {selectedPlot && (
        <div className="rounded-lg border-2 border-[#0C3B2E]/30 bg-[#0C3B2E]/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-[#0C3B2E]">
              <MapPin className="h-4 w-4" />
              {selectedPlot.plotName}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedPlot(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <Detail label="Farmer" value={selectedPlot.farmerName ?? '—'} />
            <Detail label="Region" value={selectedPlot.region ?? '—'} />
            <Detail label="Crop" value={selectedPlot.cropType ?? '—'} />
            <Detail label="Area" value={`${selectedPlot.areaHectares} ha`} />
            <Detail label="Damage level" value={`${DAMAGE_LABELS[selectedPlot.damageLevel]} (${(selectedPlot.damageScore * 100).toFixed(0)}%)`} color={DAMAGE_COLORS[selectedPlot.damageLevel]} />
            <Detail label="Claims" value={`${selectedPlot.claimCount}`} />
            <Detail label="Latest claim status" value={selectedPlot.latestClaimStatus ?? '—'} />
            <Detail label="Total payout" value={fmtMoney(selectedPlot.calculatedPayout)} />
            <Detail label="Latest NDVI" value={selectedPlot.latestNdvi?.toFixed(2) ?? '—'} alert={selectedPlot.ndviAlert} />
            <Detail label="Rainfall (14d)" value={`${selectedPlot.rainfall14d} mm`} alert={selectedPlot.droughtAlert} />
            {selectedPlot.imageAnalysisSeverity != null && (
              <Detail label="VLM severity" value={`${(selectedPlot.imageAnalysisSeverity * 100).toFixed(0)}% · ${selectedPlot.imageAnalysisDamageType}`} />
            )}
          </div>
          {(selectedPlot.ndviAlert || selectedPlot.droughtAlert) && (
            <div className="mt-2 flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">
              <AlertTriangle className="h-3 w-3" />
              {selectedPlot.ndviAlert && 'NDVI below 0.30 — vegetation stress detected. '}
              {selectedPlot.droughtAlert && 'Rainfall below 5mm in 14 days — drought alert. '}
              Parametric trigger eligible.
            </div>
          )}
        </div>
      )}

      {/* Caption */}
      <p className="text-xs text-slate-400">
        <Sprout className="mr-1 inline h-3 w-3" />
        Click any plot polygon for details. Map shows OpenStreetMap base + Esri satellite imagery overlay (35% opacity) for visual crop damage assessment.
        Damage level is a composite score from VLM image analysis, claim damage depth, NDVI deviation, and drought conditions.
        Overlapping plots (spatial conflict) are shown with dashed dark-red borders.
      </p>
    </div>
  );
}

function Detail({ label, value, color, alert }: { label: string; value: string; color?: string; alert?: boolean }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold" style={{ color: alert ? '#dc2626' : (color ?? '#0f172a') }}>{value}</p>
    </div>
  );
}
