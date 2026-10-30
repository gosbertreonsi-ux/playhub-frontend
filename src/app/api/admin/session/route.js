import { NextResponse } from "next/server";

import {
  checkAdminPassword,
  startAdminSession,
  isAdmin,
  endAdminSession,
  validOrigin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    return NextResponse.json(
      { authenticated: await isAdmin() },
      { headers: noStore }
    );
  } catch {
    return NextResponse.json(
      { authenticated: false, error: "Session configuration error" },
      { status: 503, headers: noStore }
    );
  }
}

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

    if (!checkAdminPassword(body.password)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    await startAdminSession();

    return NextResponse.json(
      { authenticated: true },
      { headers: noStore }
    );
  } catch {
    return NextResponse.json(
      { error: "Authentication unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE(request) {
  if (!validOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  await endAdminSession();

  return NextResponse.json(
    { authenticated: false },
    { headers: noStore }
  );
}