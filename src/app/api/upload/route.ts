import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSessionUser } from "@/lib/auth";
import { createDocument } from "@/lib/db";
import { convertUpload, MAX_UPLOAD_BYTES } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size === 0)
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES)
    return NextResponse.json(
      {
        error: `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`,
      },
      { status: 400 }
    );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { title, html } = await convertUpload(file.name, buffer);
    const doc = await createDocument(nanoid(12), user.id, title, html);
    return NextResponse.json({ doc }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
