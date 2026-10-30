import { NextResponse } from "next/server";

import {
  isAdmin,
  validOrigin,
} from "../../../../../lib/admin-auth";

import {
  adminBackendRequest,
} from "../../../../../lib/admin-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  // Authentication check.
  if (!(await isAdmin())) {
    return NextResponse.json(
      {
        success: false,
        error: "Administrator authentication required",
      },
      { status: 401 }
    );
  }

  // Origin validation.
  if (!validOrigin(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request origin",
      },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (
    typeof id !== "string" ||
    !id.trim()
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "A valid video ID is required",
      },
      { status: 400 }
    );
  }

  try {
    const result = await adminBackendRequest(
      `/videos/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );

    return NextResponse.json(
      result.data,
      { status: result.status }
    );
  } catch (error) {
    console.error(
      "Video deletion error:",
      error.message
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to delete video",
      },
      { status: 502 }
    );
  }
}