import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const varieties = await db.cropVariety.findMany({
    include: { stages: { orderBy: { startDayOffset: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(varieties);
}
