import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDocument, getShares, getUserPermission } from "@/lib/db";
import DocumentClient from "./DocumentClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function DocPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const perm = await getUserPermission(params.id, user.id);
  if (!perm) notFound();
  const doc = await getDocument(params.id);
  if (!doc) notFound();
  const shares = perm === "owner" ? await getShares(params.id) : [];
  return (
    <DocumentClient
      user={user}
      doc={doc}
      permission={perm}
      initialShares={shares.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        email: s.email,
        permission: s.permission as "view" | "edit",
      }))}
    />
  );
}
