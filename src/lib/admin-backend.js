import "server-only";

export async function adminBackendRequest(path, options = {}) {
  const backend = process.env.BACKEND_API_URL;
  const token = process.env.ADMIN_API_TOKEN;

  if (!backend || !token) {
    throw new Error("Backend API credentials are not configured");
  }

  const base = backend
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");

  const response = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({
    error: "Invalid backend response",
  }));

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}