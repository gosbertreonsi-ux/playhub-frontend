import { isAdmin, validOrigin } from '@/lib/admin-auth';
import { backendConfig, relay } from '@/lib/admin-backend';
export const runtime = 'nodejs';
export async function DELETE(request, { params }) {
  if (!(await isAdmin())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!validOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  let cfg;
  try { cfg = backendConfig(); } catch { return Response.json({ error: 'Backend not configured' }, { status: 503 }); }
  const { id } = await params;
  try {
    return await relay(await fetch(`${cfg.base}/api/videos/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${cfg.token}` },
      cache: 'no-store', signal: AbortSignal.timeout(20000)
    }));
  } catch { return Response.json({ error: 'Backend unavailable' }, { status: 502 }); }
}
