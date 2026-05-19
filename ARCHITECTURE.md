# Architecture

A short note on how Collab Docs is put together, what decisions drove the shape, and where the bodies are buried.

## Stack at a glance

A single Next.js 14 (App Router) app that serves both the UI and the API. SQLite for persistence via the libSQL client, so the same code runs on a local file in development and a remote Turso database in production. TipTap (ProseMirror) for the editor. No separate frontend/backend repos, no message bus, no background workers — everything is a request/response.

```
Browser  ──HTTP──>  Next.js app (React + Route Handlers)  ──SQL──>  SQLite / Turso
                              │
                              └─ @libsql/client  (file: URL locally, libsql:// in prod)
```

## Data model

Three tables. Foreign keys cascade from `documents` so deleting a doc removes its shares.

```
users
  id           TEXT PK            (nanoid)
  email        TEXT UNIQUE NOT NULL
  created_at   TEXT

documents
  id           TEXT PK
  title        TEXT NOT NULL
  content      TEXT NOT NULL      (TipTap HTML, sanitized on input)
  owner_id     TEXT NOT NULL  ──> users(id)
  created_at, updated_at

shares
  id           TEXT PK
  document_id  TEXT NOT NULL ──> documents(id) ON DELETE CASCADE
  user_id      TEXT NOT NULL ──> users(id)     ON DELETE CASCADE
  permission   TEXT NOT NULL  ('edit' | 'view')
  UNIQUE(document_id, user_id)
```

The `UNIQUE(document_id, user_id)` constraint plus an `ON CONFLICT ... DO UPDATE SET permission = excluded.permission` upsert makes "share again with a new permission level" idempotent and racy-safe — re-sharing simply updates the row.

## The permission seam

Every read/write endpoint resolves a single helper and branches on its result:

```ts
type Perm = 'owner' | 'edit' | 'view' | null
getUserPermission(documentId, userId): Promise<Perm>
```

- `null` → 404 (we don't leak the existence of docs the user can't see)
- `view` on a write endpoint → 403
- `owner` required for sharing, share-listing, and deletion

Having a single function the entire app routes through makes the permission rules easy to reason about and easy to test — see `tests/sharing.test.ts` / `tests/_node/sharing.node.test.mjs`, which exercises the full matrix.

## Auth

Email-only sign-in. Submitting an email creates the user if they don't exist, then sets an HttpOnly, SameSite=Lax cookie whose value is `<userId>.<HMAC-SHA256(userId, SESSION_SECRET)>`. Verification uses `crypto.timingSafeEqual` to avoid timing attacks. The whole layer is one file (`src/lib/auth.ts`) — a real product would replace `loginOrSignup` with magic-link email or OAuth, and the rest of the app wouldn't need to change.

## Editor and autosave

TipTap on the client, configured with `StarterKit` (paragraph, headings, bold/italic, strike, lists, blockquote, code, history, etc.) plus the `Underline` extension. Content is stored as HTML — readable in the DB, no custom serialization, and uploaded files round-trip naturally because they're already HTML after conversion.

Autosave is debounced 800 ms after the last keystroke. A `beforeunload` handler flushes any pending edit with `navigator.sendBeacon` so a tab close doesn't lose the last second of typing. The PATCH endpoint accepts partial updates (title-only, content-only, both) which means the rename flow and the autosave flow use the same route.

## Upload pipeline

```
File  ──>  /api/upload  ──>  convertUpload()  ──>  sanitize  ──>  createDocument
                                  │                    │
                          ┌───────┼───────────┐        └─ allowlisted tags + attrs
                          ▼       ▼           ▼
                        .txt     .md        .docx
                       (escape  (marked)   (mammoth)
                        + p/br)
```

Three branches in `src/lib/upload.ts`:
- `.txt` — escape HTML, split on blank lines into `<p>`s, treat single newlines as `<br>`. No external parser.
- `.md` / `.markdown` — `marked` to HTML.
- `.docx` — dynamic `import('mammoth')` so the heavy WASM-ish dep isn't loaded for non-upload routes. Returns HTML directly.

Then every branch funnels through the same `sanitize-html` allowlist (tags TipTap can round-trip + `<a>` with safe rel/target). This means even a malicious `.md` upload with `<script>` or inline event handlers can't sneak past — it's the same sanitizer pass regardless of source format. Size cap is 5 MB, enforced server-side.

## Request flow examples

**Renaming a doc:** UI sends `PATCH /api/docs/[id]` with `{ title }`. Route handler calls `getSessionUser` → `getUserPermission` → if `view`/`null`, reject. Otherwise `updateDocument({ title })`, return updated row. UI updates state. Same code path is used by autosave for `{ content }`.

**Sharing:** Owner submits email + permission to `POST /api/docs/[id]/share`. Route enforces `permission === 'owner'`. Looks up the target user by email — creates one with `nanoid()` if they don't exist, so pre-sharing works. Upserts the row in `shares`. Returns the refreshed share list.

**Re-opening a doc later:** Page is rendered server-side at `/doc/[id]` — `getSessionUser` resolves the cookie, `getUserPermission` decides visibility (404 if no access), `getDocument` loads the row. Permission and shares are passed to the client component as props so the share dialog can be hydrated immediately.

## Storage choice

`@libsql/client` reads `DATABASE_URL`:
- Local dev: `file:./local.db` → real SQLite file on disk, `CREATE TABLE IF NOT EXISTS` on first connect, persists across `npm run dev` restarts.
- Production (Vercel): `libsql://your-db.turso.io` with `DATABASE_AUTH_TOKEN` → identical SQL dialect, hosted, persistent. Zero code changes between the two.

This avoids Vercel's read-only filesystem problem (serverless functions can't write to disk except `/tmp`, which is ephemeral) without forcing a Postgres rewrite. If you'd rather use Render/Fly.io with a persistent volume, the same file-backed SQLite works there too — only the deploy target changes.

## What I prioritized

- **End-to-end real sharing** between two real accounts, not a hard-coded demo dropdown. Auto-provisioning recipients removes the "the other person has to sign up first" friction and made the demo flow feel natural.
- **Three upload formats** with a single sanitization pass — `.txt`/`.md` are cheap, `.docx` via `mammoth` was a small extra step that shows the pipeline generalizes.
- **HTML sanitization on every upload path** — script-injection from an uploaded file is a real risk even in a take-home. The allowlist matches the tags TipTap round-trips, so nothing useful is stripped.
- **Autosave + `sendBeacon` over a Save button** — closer to Google Docs and removes a class of "I forgot to save" bugs.
- **One permission helper** that every endpoint funnels through, so the access rules are in one place and one test covers them.

## What I skipped (and why)

- **Real-time multi-cursor collaboration.** Would need Y.js + a WebSocket relay (e.g. y-websocket, Hocuspocus). Significant scope, and the spec didn't require it.
- **Comments, suggestions, version history.** Each is a feature in its own right.
- **Magic-link or OAuth.** Email-only is honest about being demo auth; the seam is one file so swapping is small.
- **A `view` permission badge inside the editor toolbar.** The toolbar disables itself but doesn't show an explicit "read-only" banner. Easy add.
- **Server-side validation of TipTap content schema.** We accept any string for `content` and rely on sanitization on the upload path. A stricter setup would re-validate on PATCH too. Low-impact for this scope.
