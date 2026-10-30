import { NextResponse } from "next/server";

import {
  isAdmin,
  validOrigin,
} from "@/lib/admin-auth";

import {
  adminBackendRequest,
} from "@/lib/admin-backend";

export const runtime = "nodejs";

export async function POST(request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!validOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    if (
      !body ||
      typeof body.title !== "string" ||
      typeof body.channel !== "string" ||
      !body.title.trim() ||
      !body.channel.trim()
    ) {
      return NextResponse.json(
        { error: "Title and channel are required" },
        { status: 400 }
      );
    }

    const result = await adminBackendRequest("/videos", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return NextResponse.json(result.data, {
      status: result.status,
    });
  } catch (error) {
    console.error("Admin video publish failed:", error.message);

    return NextResponse.json(
      { error: "Publishing failed" },
      { status: 502 }
    );
  }
}