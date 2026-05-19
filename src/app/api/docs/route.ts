import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSessionUser } from "@/lib/auth";
import {
  createDocument,
  listOwnedDocuments,
  listSharedDocuments,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [owned, shared] = await Promise.all([
    listOwnedDocuments(user.id),
    listSharedDocuments(user.id),
  ]);
  return NextResponse.json({ owned, shared });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "Untitled document";
  const content =
    typeof body?.content === "string" ? body.content : "<p></p>";
  const doc = await createDocument(nanoid(12), user.id, title, content);
  return NextResponse.json({ doc }, { status: 201 });
}
