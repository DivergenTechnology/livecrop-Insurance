// src/lib/spatial.ts
// Polygon validation and overlap detection using @turf/turf.

import * as turf from '@turf/turf';

export type GeoJsonPolygon = GeoJSON.FeatureCollection<GeoJSON.Polygon> | GeoJSON.Feature<GeoJSON.Polygon> | GeoJSON.Polygon;

/**
 * Normalize whatever polygon-ish GeoJSON object was passed into a turf Feature<Polygon>.
 */
export function toTurfPolygon(input: GeoJsonPolygon): turf.Feature<turf.Polygon> | null {
  try {
    if (input.type === 'FeatureCollection') {
      const f = input.features[0];
      if (!f || f.geometry.type !== 'Polygon') return null;
      return f as turf.Feature<turf.Polygon>;
    }
    if (input.type === 'Feature') {
      if (input.geometry.type !== 'Polygon') return null;
      return input as turf.Feature<turf.Polygon>;
    }
    if (input.type === 'Polygon') {
      return turf.feature(input) as turf.Feature<turf.Polygon>;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Validate a GeoJSON polygon. Uses turf.booleanValid + a basic ring check.
 */
export function isValidPolygon(input: unknown): { valid: boolean; error?: string; feature?: turf.Feature<turf.Polygon> } {
  if (typeof input !== 'object' || input === null) {
    return { valid: false, error: 'GeoJSON input is not an object' };
  }
  const feature = toTurfPolygon(input as GeoJsonPolygon);
  if (!feature) {
    return { valid: false, error: 'Could not parse a Polygon from the GeoJSON' };
  }
  // Must have at least 4 positions (closed ring).
  const ring = feature.geometry.coordinates[0];
  if (!ring || ring.length < 4) {
    return { valid: false, error: 'Outer ring must have at least 4 coordinates (closed ring)' };
  }
  // Ring must be closed (first === last).
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return { valid: false, error: 'Outer ring is not closed (first coordinate must equal last)' };
  }
  try {
    if (!turf.booleanValid(feature)) {
      return { valid: false, error: 'turf.booleanValid returned false' };
    }
  } catch (e) {
    return { valid: false, error: `Validation error: ${(e as Error).message}` };
  }
  return { valid: true, feature };
}

/**
 * Check the new polygon against a list of existing polygon GeoJSON strings.
 * Returns the IDs of overlapping polygons (and a boolean).
 *
 * Uses turf.booleanOverlap when possible, falls back to turf.booleanContains / intersect
 * to cover edge cases (contains / containedBy).
 */
export function checkOverlap(
  newGeoJson: GeoJsonPolygon,
  existing: { id: string; geoJson: string }[],
): { overlaps: boolean; overlappingIds: string[] } {
  const newFeature = toTurfPolygon(newGeoJson);
  if (!newFeature) return { overlaps: false, overlappingIds: [] };

  const overlappingIds: string[] = [];
  for (const ex of existing) {
    let parsed: GeoJsonPolygon;
    try {
      parsed = JSON.parse(ex.geoJson) as GeoJsonPolygon;
    } catch {
      continue;
    }
    const exFeature = toTurfPolygon(parsed);
    if (!exFeature) continue;

    let overlap = false;
    try {
      // Partial overlap (boundaries cross but neither contains the other).
      overlap = turf.booleanOverlap(newFeature, exFeature);
    } catch {
      overlap = false;
    }
    if (!overlap) {
      try {
        // One fully contains the other — also a conflict.
        overlap = turf.booleanContains(newFeature, exFeature) || turf.booleanContains(exFeature, newFeature);
      } catch {
        // ignore
      }
    }
    if (!overlap) {
      try {
        // Final fallback: actual intersection of areas.
        const intersect = turf.intersect(
          turf.featureCollection([newFeature, exFeature]),
        );
        overlap = !!intersect;
      } catch {
        overlap = false;
      }
    }
    if (overlap) overlappingIds.push(ex.id);
  }

  return { overlaps: overlappingIds.length > 0, overlappingIds };
}

/**
 * Compute bounding box of a polygon (for SVG projection).
 */
export function getBBox(input: GeoJsonPolygon): turf.BBox | null {
  const f = toTurfPolygon(input);
  if (!f) return null;
  try {
    return turf.bbox(f);
  } catch {
    return null;
  }
}
