import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";

export const runtime = "nodejs";

// Used by the share dialog to auto-suggest known emails. Requires a session.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await listUsers();
  return NextResponse.json({
    users: users.map((u) => ({ id: u.id, email: u.email })),
  });
}
