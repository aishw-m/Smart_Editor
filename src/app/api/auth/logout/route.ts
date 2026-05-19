import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  logout();
  return NextResponse.json({ ok: true });
}
