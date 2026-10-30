import 'server-only';
export function backendConfig() {
  const url = process.env.BACKEND_API_URL;
  const token = process.env.ADMIN_API_TOKEN;
  if (!url || !token) throw new Error('BACKEND_API_URL or ADMIN_API_TOKEN not configured');
  return { base: url.replace(/\/+$/, '').replace(/\/api$/, ''), token };
}
export async function relay(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : { error: 'Backend returned an invalid response' };
  return Response.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
}
