// src/lib/ndvi-simulator.ts
// Mock Sentinel-2 NDVI + daily rainfall telemetry generator.
//
// Seasonal pattern (60 days):
//   - emergence ~0.20  (day 0)
//   - peak vegetative ~0.80 (day 30)
//   - maturity ~0.50 (day 60)
// A simple quadratic bezier through those points, plus small Gaussian noise.
//
// Rainfall: 0–50mm, mostly low, with occasional spikes.
// NDVI is sampled every 5 days; rainfall is sampled daily (per the spec).
// To keep the data model consistent (one row per reading), we emit one row
// per day with both ndvi and rainfall. The "every 5 days" cadence is
// reflected in the NDVI values only being updated every 5 days; intermediate
// days carry the previous NDVI value forward (matching a real 5-day revisit).

export interface SimulatedReading {
  timestamp: Date;
  ndvi: number;
  rainfall: number;
}

/**
 * Generate `days` days of mock NDVI + rainfall readings ending at `endDate` (default: now).
 */
export function generateReadings(plotId: string, days = 60, endDate: Date = new Date()): SimulatedReading[] {
  // PlotId-derived seed so different plots get slightly different curves.
  const seed = hashString(plotId);
  const rand = mulberry32(seed);

  const readings: SimulatedReading[] = [];
  const end = new Date(endDate);
  end.setHours(12, 0, 0, 0);

  // Pre-compute the NDVI value at each 5-day tick.
  // Quadratic-like curve through (0, 0.20), (30, 0.80), (60, 0.50).
  // We'll just interpolate piecewise-linearly between these anchors for simplicity,
  // then add noise.
  const anchors: { day: number; ndvi: number }[] = [
    { day: 0, ndvi: 0.2 },
    { day: 14, ndvi: 0.45 }, // emergence → vegetative ramp
    { day: 30, ndvi: 0.8 },  // peak vegetative
    { day: 45, ndvi: 0.7 },  // flowering → early maturity
    { day: 60, ndvi: 0.5 },  // maturity
  ];

  function ndviAt(day: number): number {
    // Find the surrounding anchor pair.
    let lo = anchors[0];
    let hi = anchors[anchors.length - 1];
    for (let i = 0; i < anchors.length - 1; i++) {
      if (day >= anchors[i].day && day <= anchors[i + 1].day) {
        lo = anchors[i];
        hi = anchors[i + 1];
        break;
      }
    }
    if (day > anchors[anchors.length - 1].day) {
      lo = anchors[anchors.length - 2];
      hi = anchors[anchors.length - 1];
    }
    const t = hi.day === lo.day ? 0 : (day - lo.day) / (hi.day - lo.day);
    const base = lo.ndvi + (hi.ndvi - lo.ndvi) * t;
    // Small Gaussian-ish noise (sum of two uniforms).
    const noise = (rand() + rand() - 1) * 0.04;
    return clamp(base + noise, 0.05, 0.95);
  }

  for (let i = days - 1; i >= 0; i--) {
    const day = days - 1 - i; // 0 .. days-1, day index in the season
    const date = new Date(end);
    date.setDate(end.getDate() - i);

    // NDVI is updated every 5 days; carry forward otherwise.
    const isSampleDay = day % 5 === 0;
    const ndvi = ndviAt(day);
    // For non-sample days we still emit the value but with no extra noise.
    void isSampleDay;

    // Rainfall: 0–50mm. 80% of days dry or light (<5mm), 20% have a spike.
    let rainfall = 0;
    const r = rand();
    if (r > 0.8) {
      rainfall = Number((5 + rand() * 45).toFixed(2)); // 5–50mm
    } else if (r > 0.5) {
      rainfall = Number((rand() * 5).toFixed(2)); // 0–5mm
    } else {
      rainfall = 0;
    }

    readings.push({
      timestamp: date,
      ndvi: Number(ndvi.toFixed(3)),
      rainfall,
    });
  }

  return readings;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Parametric trigger rule:
 *   - NDVI drops below 0.30 (most recent reading), OR
 *   - Rainfall over the last 14 days < 5mm total
 */
export function evaluateParametricTriggers(
  readings: SimulatedReading[],
): { ndviAlert: boolean; latestNdvi: number | null; droughtAlert: boolean; rainfall14d: number | null; message: string } {
  if (readings.length === 0) {
    return {
      ndviAlert: false,
      latestNdvi: null,
      droughtAlert: false,
      rainfall14d: null,
      message: 'No telemetry available.',
    };
  }
  const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const latest = sorted[sorted.length - 1];
  const last14 = sorted.slice(-14);
  const rainfall14d = last14.reduce((s, r) => s + r.rainfall, 0);

  const ndviAlert = latest.ndvi < 0.3;
  const droughtAlert = rainfall14d < 5;

  let message = 'OK — no parametric trigger fired.';
  if (ndviAlert && droughtAlert) {
    message = `DUAL TRIGGER: NDVI ${latest.ndvi.toFixed(2)} < 0.30 AND 14-day rainfall ${rainfall14d.toFixed(1)}mm < 5mm.`;
  } else if (ndviAlert) {
    message = `NDVI TRIGGER: latest NDVI ${latest.ndvi.toFixed(2)} < 0.30 (crop stress detected).`;
  } else if (droughtAlert) {
    message = `DROUGHT TRIGGER: 14-day rainfall ${rainfall14d.toFixed(1)}mm < 5mm.`;
  }

  return {
    ndviAlert,
    latestNdvi: latest.ndvi,
    droughtAlert,
    rainfall14d: Number(rainfall14d.toFixed(2)),
    message,
  };
}
