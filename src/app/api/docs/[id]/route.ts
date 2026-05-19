import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteDocument,
  getDocument,
  getShares,
  getUserPermission,
  updateDocument,
} from "@/lib/db";

export const runtime = "nodejs";

interface Ctx {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perm = await getUserPermission(params.id, user.id);
  if (!perm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await getDocument(params.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const shares = perm === "owner" ? await getShares(params.id) : [];
  return NextResponse.json({ doc, permission: perm, shares });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perm = await getUserPermission(params.id, user.id);
  if (!perm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (perm === "view")
    return NextResponse.json(
      { error: "You have view-only access to this document" },
      { status: 403 }
    );

  const body = await req.json().catch(() => ({}));
  const patch: { title?: string; content?: string } = {};
  if (typeof body?.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    patch.title = t.slice(0, 200);
  }
  if (typeof body?.content === "string") patch.content = body.content;
  await updateDocument(params.id, patch);
  const doc = await getDocument(params.id);
  return NextResponse.json({ doc });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perm = await getUserPermission(params.id, user.id);
  if (perm !== "owner")
    return NextResponse.json(
      { error: "Only the owner can delete this document" },
      { status: 403 }
    );
  await deleteDocument(params.id);
  return NextResponse.json({ ok: true });
}
