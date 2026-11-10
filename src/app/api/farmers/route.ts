import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const farmers = await db.farmer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { plots: true, livestock: true, policies: true } },
    },
  });
  return NextResponse.json(farmers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, region } = body ?? {};
  if (!name || !phone || !region) {
    return NextResponse.json({ error: 'name, phone, region are required' }, { status: 400 });
  }
  const farmer = await db.farmer.create({
    data: { name, phone, region },
  });
  return NextResponse.json(farmer, { status: 201 });
}
