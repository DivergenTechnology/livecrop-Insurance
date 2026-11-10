// src/lib/muzzle.ts
// Simulated muzzle-print biometric engine.
//
// Since we can't run a real CNN, we simulate a 512-dim embedding by seeding a
// deterministic PRNG from the animal's tag ID + a fixed salt and generating
// 512 floats in [-1, 1]. The resulting vector is stored as a JSON string.
// Cosine similarity is used to flag duplicate registrations.

const SALT = 'AGRI-MUZZLE-v1';

/**
 * Mulberry32 — a small, fast, deterministic PRNG.
 */
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

/**
 * FNV-1a hash → uint32 seed.
 */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Generate a deterministic 512-dim "muzzle embedding" from a tag ID.
 * Returns the raw number array; callers store JSON.stringify(...) in the DB.
 */
export function generateMuzzleHash(tagId: string): number[] {
  const seed = hashString(SALT + '|' + tagId);
  const rand = mulberry32(seed);
  const vec = new Array<number>(512);
  for (let i = 0; i < 512; i++) {
    vec[i] = Number((rand() * 2 - 1).toFixed(6));
  }
  return vec;
}

/**
 * Cosine similarity between two equal-length numeric vectors.
 * Returns 0 when either vector has zero magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Scan an existing list of livestock for potential duplicates.
 * Returns the best match (tag ID + similarity) if similarity > threshold.
 */
export function findDuplicate(
  candidate: number[],
  existing: { id: string; uniqueTagId: string; muzzlePrintHash: string | null }[],
  threshold = 0.95,
): { id: string; uniqueTagId: string; similarity: number } | null {
  let best: { id: string; uniqueTagId: string; similarity: number } | null = null;
  for (const ex of existing) {
    if (!ex.muzzlePrintHash) continue;
    let exVec: number[];
    try {
      exVec = JSON.parse(ex.muzzlePrintHash) as number[];
    } catch {
      continue;
    }
    const sim = cosineSimilarity(candidate, exVec);
    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { id: ex.id, uniqueTagId: ex.uniqueTagId, similarity: Number(sim.toFixed(4)) };
    }
  }
  return best;
}
