import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  listOwnedDocuments,
  listSharedDocuments,
  type Document,
} from "@/lib/db";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [owned, shared] = await Promise.all([
    listOwnedDocuments(user.id),
    listSharedDocuments(user.id),
  ]);
  return (
    <DashboardClient
      user={user}
      ownedInitial={owned}
      sharedInitial={shared as (Document & { permission: string; owner_email: string })[]}
    />
  );
}
