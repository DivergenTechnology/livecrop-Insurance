'use client';

// SVG preview of plot polygons. Projects the union bbox of all polygons
// onto a fixed viewBox. Overlapping plots (per the API-provided overlappingIds)
// are colored red; isolated plots are colored sage green.

import { useMemo } from 'react';

interface PlotPreviewProps {
  plots: { id: string; plotName: string; boundaryGeoJson: string; overlappingIds?: string[] }[];
  height?: number;
}

interface ParsedPoly {
  id: string;
  plotName: string;
  rings: number[][][]; // array of rings, each ring is array of [lon, lat]
  overlapping: boolean;
}

function parseGeoJson(geoJson: string): number[][][] | null {
  try {
    const obj = JSON.parse(geoJson) as unknown;
    let poly: GeoJSON.Polygon | null = null;
    if (typeof obj !== 'object' || obj === null) return null;
    if ((obj as GeoJSON.Feature).type === 'Feature') {
      const g = (obj as GeoJSON.Feature<GeoJSON.Polygon>).geometry;
      if (g && g.type === 'Polygon') poly = g;
    } else if ((obj as GeoJSON.Polygon).type === 'Polygon') {
      poly = obj as GeoJSON.Polygon;
    } else if ((obj as GeoJSON.FeatureCollection).type === 'FeatureCollection') {
      const f = (obj as GeoJSON.FeatureCollection<GeoJSON.Polygon>).features[0];
      if (f && f.geometry?.type === 'Polygon') poly = f.geometry;
    }
    if (!poly) return null;
    return poly.coordinates;
  } catch {
    return null;
  }
}

export function PlotPreview({ plots, height = 280 }: PlotPreviewProps) {
  const { parsed, bbox, viewBox, w, h } = useMemo(() => {
    const parsed: ParsedPoly[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const p of plots) {
      const rings = parseGeoJson(p.boundaryGeoJson);
      if (!rings) continue;
      const overlapping = (p.overlappingIds?.length ?? 0) > 0;
      parsed.push({ id: p.id, plotName: p.plotName, rings, overlapping });
      for (const ring of rings) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 1; maxY = 1;
    }
    // Pad the bbox slightly.
    const padX = (maxX - minX) * 0.08 || 0.001;
    const padY = (maxY - minY) * 0.08 || 0.001;
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;
    const w = maxX - minX;
    const h = maxY - minY;
    // SVG viewBox: width 800, height scaled.
    const VB_W = 800;
    const VB_H = Math.max(120, Math.round(VB_W * (h / Math.max(w, 1e-9))));
    return { parsed, bbox: { minX, minY, maxX, maxY }, viewBox: `0 0 ${VB_W} ${VB_H}`, w, h };
  }, [plots]);

  // We use the bbox in the closure; silence unused-var warnings.
  void bbox; void w; void h;

  if (parsed.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400"
        style={{ height }}
      >
        No plots registered yet.
      </div>
    );
  }

  const VB_W = 800;
  const VB_H = Number(viewBox.split(' ')[3]) || 400;
  const scale = (val: number, min: number, range: number, target: number) =>
    range === 0 ? target / 2 : ((val - min) / range) * target;

  function projectRing(ring: number[][]): string {
    return ring
      .map(([lon, lat]) => {
        const x = scale(lon, bbox.minX, bbox.maxX - bbox.minX, VB_W);
        // SVG y is flipped (top-down), and lat is north-up.
        const y = VB_H - scale(lat, bbox.minY, bbox.maxY - bbox.minY, VB_H);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
      style={{ height }}
    >
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {/* subtle grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#grid)" />

        {parsed.map((p) => {
          const outer = p.rings[0];
          const points = projectRing(outer);
          const holes = p.rings.slice(1).map((r) => projectRing(r));
          const fill = p.overlapping ? 'rgba(185, 28, 28, 0.25)' : 'rgba(42, 122, 101, 0.25)';
          const stroke = p.overlapping ? '#B91C1C' : '#2A7A65';
          return (
            <g key={p.id}>
              <polygon
                points={points}
                fill={fill}
                stroke={stroke}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {holes.map((hpts, i) => (
                <polygon key={i} points={hpts} fill="#f8fafc" stroke={stroke} strokeWidth={1} strokeDasharray="4 3" />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
