import { NextResponse } from "next/server";

import {
  isAdmin,
  validOrigin,
} from "@/lib/admin-auth";

import {
  adminBackendRequest,
} from "@/lib/admin-backend";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
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

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Video ID is required" },
      { status: 400 }
    );
  }

  try {
    const result = await adminBackendRequest(
      `/videos/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    return NextResponse.json(result.data, {
      status: result.status,
    });
  } catch (error) {
    console.error("Admin video deletion failed:", error.message);

    return NextResponse.json(
      { error: "Deleting video failed" },
      { status: 502 }
    );
  }
}