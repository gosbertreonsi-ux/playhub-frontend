import "server-only";

export async function adminBackendRequest(
  path,
  options = {}
) {
  const backendUrl = process.env.BACKEND_API_URL;
  const adminToken = process.env.ADMIN_API_TOKEN;

  if (!backendUrl || !adminToken) {
    throw new Error(
      "BACKEND_API_URL or ADMIN_API_TOKEN is missing"
    );
  }

  const base = backendUrl
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");

  const response = await fetch(
    `${base}/api${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${adminToken}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => ({
    error: "Backend returned an invalid response",
  }));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}