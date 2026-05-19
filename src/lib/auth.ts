import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { findUserById, createUser, findUserByEmail, type User } from "./db";
import { nanoid } from "nanoid";

const COOKIE_NAME = "collab_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return process.env.SESSION_SECRET || "dev-only-secret-do-not-use-in-prod-32b";
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function makeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function verifyToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(userId);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? userId : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<User | null> {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const userId = verifyToken(cookie.value);
  if (!userId) return null;
  return findUserById(userId);
}

export async function loginOrSignup(rawEmail: string): Promise<User> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address");
  }
  let user = await findUserByEmail(email);
  if (!user) {
    user = await createUser(nanoid(12), email);
  }
  cookies().set(COOKIE_NAME, makeToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return user;
}

export function logout(): void {
  cookies().delete(COOKIE_NAME);
}

// Test-only export so we can verify token signing/verification without
// pulling in Next's cookie store.
export const __test__ = { sign, verifyToken, makeToken };
