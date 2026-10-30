import { NextResponse } from "next/server";

import {
  checkAdminPassword,
  startAdminSession,
  isAdmin,
  endAdminSession,
  validOrigin,
} from "../../../../lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
};

// GET: Check if the administrator is logged in.
export async function GET() {
  try {
    const authenticated = await isAdmin();

    return NextResponse.json(
      { authenticated },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error(
      "Admin session verification failed:",
      error.message
    );

    return NextResponse.json(
      {
        authenticated: false,
        error: "Session configuration error",
      },
      {
        status: 503,
        headers: responseHeaders,
      }
    );
  }
}

// POST: Administrator login.
export async function POST(request) {
  if (!validOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    if (
      typeof body.password !== "string" ||
      body.password.length > 1024
    ) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = checkAdminPassword(
      body.password
    );

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    await startAdminSession();

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        message: "Administrator authenticated",
      },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error(
      "Admin login failed:",
      error.message
    );

    return NextResponse.json(
      {
        success: false,
        error: "Authentication unavailable",
      },
      { status: 503 }
    );
  }
}

// DELETE: Log out the administrator.
export async function DELETE(request) {
  if (!validOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  await endAdminSession();

  return NextResponse.json(
    {
      success: true,
      authenticated: false,
      message: "Logged out successfully",
    },
    { headers: responseHeaders }
  );
}