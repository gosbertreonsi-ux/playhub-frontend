export interface LeeHubVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  creator: string;
  isPremium: boolean;
}

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  "http://localhost:5001";

export async function getVideos(): Promise<LeeHubVideo[]> {
  const response = await fetch(`${API_URL}/api/videos`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch videos: ${response.status}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected video response format");
  }

  return data as LeeHubVideo[];
}