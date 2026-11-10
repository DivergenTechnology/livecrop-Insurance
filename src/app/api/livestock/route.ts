import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateMuzzleHash, findDuplicate } from '@/lib/muzzle';

export const dynamic = 'force-dynamic';

export async function GET() {
  const livestock = await db.livestockAsset.findMany({
    orderBy: { createdAt: 'desc' },
    include: { farmer: true },
  });
  return NextResponse.json(livestock);
}

const CATEGORIES = ['DAIRY', 'BEEF', 'POULTRY', 'SMALL_RUMINANT'] as const;
type Category = (typeof CATEGORIES)[number];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { farmerId, category, uniqueTagId, declaredValue } = body ?? {};

  if (!farmerId || !category || !uniqueTagId || typeof declaredValue !== 'number') {
    return NextResponse.json(
      { error: 'farmerId, category, uniqueTagId, declaredValue are required' },
      { status: 400 },
    );
  }
  if (!CATEGORIES.includes(category as Category)) {
    return NextResponse.json(
      { error: `category must be one of ${CATEGORIES.join(', ')}` },
      { status: 400 },
    );
  }

  // Uniqueness check on tag ID.
  const existingByTag = await db.livestockAsset.findUnique({ where: { uniqueTagId } });
  if (existingByTag) {
    return NextResponse.json(
      { error: `Livestock with tag ID ${uniqueTagId} already exists`, duplicate: true },
      { status: 409 },
    );
  }

  // Muzzle hash + duplicate scan.
  const muzzle = generateMuzzleHash(uniqueTagId);
  const existing = await db.livestockAsset.findMany({
    select: { id: true, uniqueTagId: true, muzzlePrintHash: true },
  });
  const dup = findDuplicate(muzzle, existing, 0.95);

  const created = await db.livestockAsset.create({
    data: {
      farmerId,
      category,
      uniqueTagId,
      declaredValue,
      muzzlePrintHash: JSON.stringify(muzzle),
    },
    include: { farmer: true },
  });

  return NextResponse.json(
    {
      ...created,
      duplicateWarning: dup
        ? {
            message: `Potential duplicate detected: similarity ${dup.similarity.toFixed(4)} with tag ${dup.uniqueTagId}`,
            matchedTagId: dup.uniqueTagId,
            matchedId: dup.id,
            similarity: dup.similarity,
          }
        : null,
    },
    { status: 201 },
  );
}
