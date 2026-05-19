"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface DocSummary {
  id: string;
  title: string;
  updated_at: string;
}

interface SharedDocSummary extends DocSummary {
  permission: string;
  owner_email: string;
}

interface Props {
  user: { id: string; email: string };
  ownedInitial: DocSummary[];
  sharedInitial: SharedDocSummary[];
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function DashboardClient({
  user,
  ownedInitial,
  sharedInitial,
}: Props) {
  const router = useRouter();
  const [owned, setOwned] = useState(ownedInitial);
  const [shared] = useState(sharedInitial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function createDoc() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled document" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create document");
      router.push(`/doc/${data.doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      router.push(`/doc/${data.doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    const res = await fetch(`/api/docs/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOwned((prev) => prev.filter((d) => d.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Collab Docs</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{user.email}</span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-900 underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        <section>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={createDoc}
              disabled={busy}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              New document
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-md"
            >
              Upload (.txt, .md, .docx)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
            <span className="text-xs text-gray-500">
              Supported uploads: .txt, .md, .docx (max 5 MB)
            </span>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
              {error}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Your documents
          </h2>
          {owned.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No documents yet. Create one or upload a file to get started.
            </p>
          ) : (
            <ul className="bg-white rounded-lg border divide-y">
              {owned.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <Link
                    href={`/doc/${d.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3 group"
                  >
                    <span className="text-gray-900 font-medium truncate group-hover:text-brand-700">
                      {d.title || "Untitled"}
                    </span>
                    <span className="text-xs text-gray-400">
                      updated {formatDate(d.updated_at)}
                    </span>
                  </Link>
                  <button
                    onClick={() => deleteDoc(d.id)}
                    className="text-xs text-gray-400 hover:text-red-600 ml-3"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Shared with you
          </h2>
          {shared.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Nothing shared yet. Owners of other documents can grant you
              access.
            </p>
          ) : (
            <ul className="bg-white rounded-lg border divide-y">
              {shared.map((d) => (
                <li
                  key={d.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <Link
                    href={`/doc/${d.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3 group"
                  >
                    <span className="text-gray-900 font-medium truncate group-hover:text-brand-700">
                      {d.title || "Untitled"}
                    </span>
                    <span className="text-xs text-gray-400">
                      from {d.owner_email}
                    </span>
                  </Link>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 ml-3">
                    {d.permission}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
