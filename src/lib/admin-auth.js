import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";

const COOKIE_NAME = "leehub_admin";
const SESSION_DURATION = 60 * 60 * 8;

function secureCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  return (
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET must contain at least 32 characters"
    );
  }

  return secret;
}

function sign(payload) {
  return createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
}

export function checkAdminPassword(password) {
  const configured = process.env.ADMIN_PASSWORD;

  if (!configured || configured.length < 16) {
    throw new Error(
      "ADMIN_PASSWORD must contain at least 16 characters"
    );
  }

  return secureCompare(password ?? "", configured);
}

export function validOrigin(request) {
  const origin = request.headers.get("origin");

  return origin === new URL(request.url).origin;
}

export async function startAdminSession() {
  const expiresAt =
    Date.now() + SESSION_DURATION * 1000;

  const payload = String(expiresAt);
  const token = `${payload}.${sign(payload)}`;

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return false;

  const parts = token.split(".");

  if (parts.length !== 2) return false;

  const [payload, receivedSignature] = parts;
  const expiry = Number(payload);

  if (!Number.isSafeInteger(expiry)) return false;
  if (expiry <= Date.now()) return false;

  return secureCompare(
    receivedSignature,
    sign(payload)
  );
}

export async function endAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}