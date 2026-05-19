"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Editor from "@/components/Editor";
import ShareDialog from "@/components/ShareDialog";

interface DocData {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  updated_at: string;
}

interface ShareEntry {
  id: string;
  user_id: string;
  email: string;
  permission: "view" | "edit";
}

interface Props {
  user: { id: string; email: string };
  doc: DocData;
  permission: "owner" | "edit" | "view";
  initialShares: ShareEntry[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 800;

export default function DocumentClient({
  user,
  doc,
  permission,
  initialShares,
}: Props) {
  const editable = permission === "owner" || permission === "edit";
  const [title, setTitle] = useState(doc.title);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [content, setContent] = useState(doc.content);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showShare, setShowShare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced save tracking
  const pendingContent = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContent = useRef(doc.content);

  const saveContent = useCallback(
    async (next: string) => {
      if (!editable) return;
      if (next === lastSavedContent.current) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/docs/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Save failed");
        }
        lastSavedContent.current = next;
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        setError(err instanceof Error ? err.message : "Save failed");
      }
    },
    [doc.id, editable]
  );

  const onContentChange = useCallback(
    (html: string) => {
      setContent(html);
      if (!editable) return;
      pendingContent.current = html;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (pendingContent.current !== null) {
          saveContent(pendingContent.current);
        }
      }, AUTOSAVE_MS);
    },
    [editable, saveContent]
  );

  // Save on unmount / tab close.
  useEffect(() => {
    function flush() {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (pendingContent.current !== null) {
        const payload = JSON.stringify({ content: pendingContent.current });
        navigator.sendBeacon?.(
          `/api/docs/${doc.id}`,
          new Blob([payload], { type: "application/json" })
        );
      }
    }
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [doc.id]);

  async function commitTitle() {
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(title);
      setEditingTitle(false);
      return;
    }
    if (next === title) {
      setEditingTitle(false);
      return;
    }
    try {
      const res = await fetch(`/api/docs/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rename failed");
      setTitle(data.doc.title);
      setTitleDraft(data.doc.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
      setTitleDraft(title);
    } finally {
      setEditingTitle(false);
    }
  }

  const saveLabel = (() => {
    switch (saveState) {
      case "saving":
        return "Saving…";
      case "saved":
        return "All changes saved";
      case "error":
        return "Save failed — retrying on next edit";
      default:
        return editable ? "Ready" : "View only";
    }
  })();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Docs
          </Link>
          <div className="flex-1 min-w-0">
            {editingTitle && editable ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setTitleDraft(title);
                    setEditingTitle(false);
                  }
                }}
                className="w-full text-lg font-semibold border-b border-brand-500 focus:outline-none bg-transparent"
              />
            ) : (
              <button
                onClick={() => editable && setEditingTitle(true)}
                className={
                  "text-lg font-semibold truncate text-left " +
                  (editable ? "hover:bg-gray-50 rounded px-1" : "px-1")
                }
                title={editable ? "Click to rename" : ""}
              >
                {title || "Untitled"}
              </button>
            )}
          </div>
          <span
            className={
              "text-xs " +
              (saveState === "error" ? "text-red-600" : "text-gray-500")
            }
            aria-live="polite"
          >
            {saveLabel}
          </span>
          {permission === "owner" && (
            <button
              onClick={() => setShowShare(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded-md"
            >
              Share
            </button>
          )}
          {permission !== "owner" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {permission === "edit" ? "Shared (edit)" : "Shared (view)"}
            </span>
          )}
        </div>
        {error && (
          <div className="max-w-3xl mx-auto px-6 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
            {error}
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        <Editor
          initialContent={content}
          editable={editable}
          onChange={onContentChange}
        />
        <p className="text-xs text-gray-400 mt-3">
          Signed in as {user.email}. Edits autosave a moment after you stop
          typing.
        </p>
      </main>

      {showShare && permission === "owner" && (
        <ShareDialog
          documentId={doc.id}
          initialShares={initialShares}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
