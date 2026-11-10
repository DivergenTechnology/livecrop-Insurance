import { NextRequest, NextResponse } from 'next/server';
import { getDamageMap, pointInPlot } from '@/lib/spatial-db';

export const dynamic = 'force-dynamic';

// GET /api/spatial/damage-map
// Returns a GeoJSON FeatureCollection with plot boundaries + damage properties.
// Optional query params:
//   ?lon=...&lat=...  →  returns the single plot containing this point instead.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lon = url.searchParams.get('lon');
  const lat = url.searchParams.get('lat');

  // Point-in-plot lookup mode
  if (lon && lat) {
    const lonNum = Number(lon);
    const latNum = Number(lat);
    if (Number.isNaN(lonNum) || Number.isNaN(latNum)) {
      return NextResponse.json({ error: 'lon and lat must be numeric' }, { status: 400 });
    }
    const plot = await pointInPlot(lonNum, latNum);
    if (!plot) {
      return NextResponse.json({ error: 'No plot found at this location', plot: null }, { status: 404 });
    }
    return NextResponse.json({ plot });
  }

  // Default: return the full damage map
  const damageMap = await getDamageMap();
  return NextResponse.json(damageMap, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
