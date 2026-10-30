import { NextResponse } from "next/server";

import {
  isAdmin,
  validOrigin,
} from "../../../../lib/admin-auth";

import {
  adminBackendRequest,
} from "../../../../lib/admin-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  // Verify that the visitor has an admin session.
  if (!(await isAdmin())) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized administrator",
      },
      { status: 401 }
    );
  }

  // Protect against cross-origin form submissions.
  if (!validOrigin(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request origin",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const {
      id,
      title,
      channel,
      length,
      price,
      desc,
      thumb,
      uploadedAt,
    } = body;

    if (
      typeof title !== "string" ||
      typeof channel !== "string" ||
      !title.trim() ||
      !channel.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Title and channel are required",
        },
        { status: 400 }
      );
    }

    const numericPrice = Number(price ?? 0);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid video price",
        },
        { status: 400 }
      );
    }

    const payload = {
      id,
      title: title.trim(),
      channel: channel.trim(),
      length: length || "0:00",
      price: String(numericPrice),
      desc: desc || "",
      thumb: thumb || "",
      uploadedAt:
        uploadedAt || new Date().toISOString(),
    };

    const result = await adminBackendRequest(
      "/videos",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    return NextResponse.json(
      result.data,
      { status: result.status }
    );
  } catch (error) {
    console.error(
      "Video publishing error:",
      error.message
    );

    return NextResponse.json(
      {
        success: false,
        error: "Video publishing failed",
      },
      { status: 502 }
    );
  }
}