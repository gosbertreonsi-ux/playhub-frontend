import { NextResponse } from 'next/server';
import { checkAdminPassword, startAdminSession, isAdmin, endAdminSession, validOrigin } from '@/lib/admin-auth';
export const runtime = 'nodejs';

// Local-development rate limiting. Use Redis/shared store and named accounts for production.
const attempts = new Map();
export async function GET() {
  return NextResponse.json({ authenticated: await isAdmin() }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const current = attempts.get(ip) || { count: 0, until: now + 15 * 60_000 };
  if (now > current.until) { current.count = 0; current.until = now + 15 * 60_000; }
  if (current.count >= 10) return NextResponse.json({ error: 'Too many attempts. Try later.' }, { status: 429 });
  try {
    const body = await request.json();
    if (!checkAdminPassword(body?.password)) {
      current.count++;
      attempts.set(ip, current);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    attempts.delete(ip);
    await startAdminSession();
    return NextResponse.json({ authenticated: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Authentication configuration error' }, { status: 503 });
  }
}
export async function DELETE(request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  await endAdminSession();
  return NextResponse.json({ authenticated: false });
}
