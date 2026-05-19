# Collab Docs

A lightweight collaborative document editor inspired by Google Docs. Built as a single Next.js app with SQLite persistence, a TipTap rich-text editor, multi-format file import, and a per-user sharing model.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# (defaults are fine for local dev — the DB file is created automatically)

# 3. Run
npm run dev
# open http://localhost:3000
```

To try sharing: open two browsers (or one regular + one private window), sign in with two different emails, share a document from owner A to owner B's email, then refresh B's dashboard.

## What it does

**Documents**

- Create, rename, edit, and delete documents.
- Rich-text editing with bold, italic, underline, strikethrough, H1/H2/H3, bulleted lists, numbered lists, blockquotes, code, undo/redo.
- Autosave kicks in 800 ms after you stop typing, and a final save fires on tab close via `sendBeacon`.
- Re-open at any time — content (HTML) and title are persisted.

**File upload**

- Upload `.txt`, `.md`/`.markdown`, or `.docx` to create a new editable document.
- 5 MB size cap (enforced server-side).
- Markdown is rendered to HTML via `marked`; Word docs via `mammoth`; plain text is paragraphed and HTML-escaped.
- All resulting HTML is sanitized through an allowlist before storage so an uploaded file can't inject scripts.
- The supported types are also listed in the upload button hint in the UI.

**Sharing**

- Every document has a single `owner_id`. Owners can share with any email via a Share dialog.
- Two permission levels: `edit` (default) and `view` (read-only — the editor renders but the toolbar is disabled and the PATCH endpoint rejects writes).
- The dashboard splits documents into "Your documents" and "Shared with you," and shared rows display the owner's email and the permission level.
- Sharing with an email that hasn't signed up yet auto-provisions the account so the share is waiting for them when they log in.
- Owners can revoke access at any time from the same dialog.

**Auth**

- Lightweight email-only sign-in. No password — submitting an email creates an account (if new) and sets a signed HttpOnly session cookie.
- The cookie is an HMAC-signed user id; verification uses `crypto.timingSafeEqual`. The signing secret comes from `SESSION_SECRET` (see `.env.example`).
- This is deliberately demo-grade auth; a real product would layer on magic-link emails, OAuth, or password+session tables. The boundary is well-isolated in `src/lib/auth.ts`.

## Architecture

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    login/                 — email sign-in page
    dashboard/             — owned + shared docs list
    doc/[id]/              — editor view with autosave + share dialog
    api/
      auth/{login,logout,me,users}/route.ts
      docs/route.ts             — GET (list), POST (create)
      docs/[id]/route.ts        — GET, PATCH (rename/content), DELETE
      docs/[id]/share/route.ts  — GET, POST, DELETE (owner-only)
      upload/route.ts           — POST multipart, converts + creates doc
  components/
    Editor.tsx, Toolbar.tsx, ShareDialog.tsx
  lib/
    db.ts      — libSQL client + domain helpers (users, documents, shares)
    auth.ts    — session cookie sign/verify, loginOrSignup, logout
    upload.ts  — .txt/.md/.docx → sanitized TipTap-ready HTML
tests/
  upload.test.ts   — conversion + sanitization
  sharing.test.ts  — owner/edit/view/no-access permission matrix
```

**Storage.** `@libsql/client` is used for both local dev (a `file:./local.db` URL pointing at a SQLite file) and production (a remote `libsql://…` URL pointing at Turso). The schema lives in `db.ts` and is created on first call via `CREATE TABLE IF NOT EXISTS`. Three tables: `users`, `documents`, `shares`, with a unique `(document_id, user_id)` constraint on `shares` and FKs that `ON DELETE CASCADE` from documents to their shares.

**Editor.** TipTap (ProseMirror under the hood) with `StarterKit` + the `Underline` extension. Content is stored as HTML, which keeps the storage format human-readable and lets uploaded files round-trip cleanly.

**Autosave.** Debounced PATCH on the document content, 800 ms after the last keystroke. A `beforeunload` hook flushes any pending edit with `navigator.sendBeacon` so a tab close doesn't lose the last second of typing.

**Permission check.** Every read/write endpoint resolves a single `getUserPermission(documentId, userId)` that returns `"owner" | "edit" | "view" | null`, and the route handler chooses a status code from that. The dashboard `shared` query joins through `shares` so users only see docs they've actually been granted.

## Trade-offs and prioritization

Within the timebox I prioritized end-to-end product flow over depth in any single area:

- **Real sharing across two real accounts** (rather than a hard-coded demo dropdown) — sharing was the highest-leverage feature for showing I understood the spec, and auto-provisioning recipient accounts removes the friction of "the other person has to sign up first."
- **Three upload formats** instead of one — `.txt` and `.md` are cheap; adding `.docx` via `mammoth` was a small extra step and shows the conversion pipeline (sanitize → store as HTML) generalizes.
- **HTML sanitization on upload** — even in a take-home, accepting `<script>` from user uploads would be a real bug. The whitelist matches the tags TipTap can round-trip.
- **Autosave + sendBeacon over a Save button** — felt closer to the Google Docs experience and removed a class of "I forgot to hit save" bugs.
- **What I skipped:** real-time multi-cursor collaboration (would need a Y.js + WebSocket layer), comments, version history, magic-link email auth, and presence indicators. The auth layer is intentionally isolated so swapping in a real provider is a small change.

## Testing

```bash
npm test           # Vitest — the standard runner
npm run test:node  # Dependency-free fallback using node --test + node:sqlite
```

The Vitest suite is split into two files:

- `tests/upload.test.ts` — covers `.txt`, `.md`, and unsupported-type behavior, plus HTML-injection sanitization on both `.md` and `.txt` inputs and the empty/oversize guards.
- `tests/sharing.test.ts` — exercises the permission matrix end-to-end against a real (temporary) SQLite DB: owner detection, granting access, upserting a re-share with a new permission level, and revoking.

The sharing test sets `DATABASE_URL` before importing the DB module so it never touches the dev DB.

A mirrored, dependency-free version of both lives in `tests/_node/` and runs against Node 22's built-in `node:sqlite` and `node:test`. This was useful in CI/sandboxed environments where the third-party native modules can't be downloaded; `npm run test:node` runs all 11 cases (4 sharing + 7 upload) with **no third-party install required**.

## Deployment

The app is a single Next.js project, so it deploys to Vercel as-is. The only external piece is the database, because Vercel serverless functions have an ephemeral filesystem — local SQLite won't persist between requests.

**Recommended path: Vercel + Turso (free tier).**

1. Push the repo to GitHub.
2. Create a free Turso database at <https://turso.tech> and copy the database URL and auth token.
3. In Vercel, import the repo and set three environment variables on the project:
   - `DATABASE_URL` — your `libsql://…` URL
   - `DATABASE_AUTH_TOKEN` — the Turso token
   - `SESSION_SECRET` — a random 32-byte hex string (`openssl rand -hex 32`)
4. Deploy. Anyone with the URL can sign in by entering an email.

Because the app uses `@libsql/client`, the same code that reads `file:./local.db` locally talks to Turso in prod with zero refactor — only env vars change.

**Alternatives**

- Render or Fly.io with a persistent volume — keep the SQLite file as-is, no Turso needed.
- Vercel Postgres / Neon — swap `@libsql/client` for `pg` and rewrite `db.ts`. Probably half a day; not worth it unless you specifically want Postgres.

## Supported file types (also surfaced in the UI)

`.txt`, `.md`, `.markdown`, `.docx` — up to 5 MB. Anything else returns a 400 with a clear error.

## Project scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server on `:3000` |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:node` | Dep-free tests via `node:test` + `node:sqlite` |
| `npm run lint` | Next.js lint |
