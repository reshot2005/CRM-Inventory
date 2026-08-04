import { NextResponse } from 'next/server';
import { seedForUser } from '@/lib/seed/seed-for-user';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { userId?: string };
    if (!body.userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    const result = await seedForUser(body.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Seed failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
