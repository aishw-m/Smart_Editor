"use client";

import { useEffect, useState } from "react";

interface ShareEntry {
  id: string;
  user_id: string;
  email: string;
  permission: "view" | "edit";
}

interface Props {
  documentId: string;
  initialShares: ShareEntry[];
  onClose: () => void;
}

export default function ShareDialog({
  documentId,
  initialShares,
  onClose,
}: Props) {
  const [shares, setShares] = useState<ShareEntry[]>(initialShares);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/docs/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permission }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to share");
      setShares(data.shares);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(userId: string) {
    const res = await fetch(
      `/api/docs/${documentId}/share?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (res.ok) setShares(data.shares);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Share document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={add} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              value={permission}
              onChange={(e) =>
                setPermission(e.target.value === "view" ? "view" : "edit")
              }
              className="rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="edit">Can edit</option>
              <option value="view">View only</option>
            </select>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            {submitting ? "Sharing…" : "Add person"}
          </button>
        </form>

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            People with access
          </h3>
          {shares.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Only you have access so far.
            </p>
          ) : (
            <ul className="divide-y border rounded-md">
              {shares.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="truncate">{s.email}</span>
                  <div className="flex items-center gap-3 ml-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {s.permission}
                    </span>
                    <button
                      onClick={() => remove(s.user_id)}
                      className="text-xs text-gray-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Tip: if a person hasn't signed in yet, an account is auto-created so
          you can pre-share with them.
        </p>
      </div>
    </div>
  );
}
