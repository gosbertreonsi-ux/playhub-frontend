import { isAdmin, validOrigin } from '@/lib/admin-auth';
import { backendConfig, relay } from '@/lib/admin-backend';
export const runtime = 'nodejs';
export async function POST(request) {
  if (!(await isAdmin())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!validOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  let cfg;
  try { cfg = backendConfig(); } catch { return Response.json({ error: 'Backend not configured' }, { status: 503 }); }
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.title || !body?.channel) return Response.json({ error: 'Title and channel required' }, { status: 400 });
  try {
    return await relay(await fetch(`${cfg.base}/api/videos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000)
    }));
  } catch { return Response.json({ error: 'Backend unavailable' }, { status: 502 }); }
}
