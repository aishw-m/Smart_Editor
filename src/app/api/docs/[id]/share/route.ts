import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSessionUser } from "@/lib/auth";
import {
  addShare,
  createUser,
  findUserByEmail,
  getShares,
  getUserPermission,
  removeShare,
} from "@/lib/db";

export const runtime = "nodejs";

interface Ctx {
  params: { id: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perm = await getUserPermission(params.id, user.id);
  if (perm !== "owner")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const shares = await getShares(params.id);
  return NextResponse.json({ shares });
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perm = await getUserPermission(params.id, user.id);
  if (perm !== "owner")
    return NextResponse.json(
      { error: "Only the owner can share this document" },
      { status: 403 }
    );

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const permission: "view" | "edit" =
    body?.permission === "view" ? "view" : "edit";
  if (!EMAIL_RE.test(email))
    return NextResponse.json(
      { error: "Please enter a valid email address" },
      { status: 400 }
    );
  if (email === user.email)
    return NextResponse.json(
      { error: "You already have access (you're the owner)" },
      { status: 400 }
    );

  // Auto-provision target user so a doc can be shared before they sign in.
  let target = await findUserByEmail(email);
  if (!target) target = await createUser(nanoid(12), email);

  await addShare(nanoid(12), params.id, target.id, permission);
  const shares = await getShares(params.id);
  return NextResponse.json({ shares }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perm = await getUserPermission(params.id, user.id);
  if (perm !== "owner")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  await removeShare(params.id, userId);
  const shares = await getShares(params.id);
  return NextResponse.json({ shares });
}
