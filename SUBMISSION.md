# Submission Index

Everything included in this submission, where to find it, and what state it's in.

## Required deliverables

| Deliverable | File / Location | Status |
|---|---|---|
| Source code | `src/`, `tests/`, root config files | Complete |
| Local setup and run instructions | `README.md` | Complete |
| Architecture note | `ARCHITECTURE.md` | Complete |
| AI workflow note | `AI_WORKFLOW.md` | Complete |
| Submission index (this file) | `SUBMISSION.md` | Complete |
| Live product URL | `DEPLOY_URL.txt` (see `DEPLOYMENT_GUIDE.md` for steps) | **TBD — see file** |
| Walkthrough video URL | `VIDEO_URL.txt` | **TBD — see file** |
| Screenshots / demo GIF | n/a | Not needed — setup is `npm install && npm run dev` |

## How to run it locally (full reference is in `README.md`)

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
npm test             # Vitest suite
npm run test:node    # Same coverage with no third-party test runner
```

## Source code structure

```
collab-docs/
├── README.md                ← setup, scripts, deploy guide
├── ARCHITECTURE.md          ← system design, data model, trade-offs
├── AI_WORKFLOW.md           ← how AI was used to build this
├── SUBMISSION.md            ← you are here
├── DEPLOY_URL.txt           ← live URL (TBD until deployed)
├── VIDEO_URL.txt            ← walkthrough URL (TBD until recorded)
├── package.json, tsconfig.json, next.config.js,
│   tailwind.config.ts, postcss.config.js, vitest.config.ts
├── .env.example             ← environment variables (DB URL, session secret)
├── .gitignore
│
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx, globals.css
│   │   ├── login/page.tsx                       ← email sign-in
│   │   ├── dashboard/
│   │   │   ├── page.tsx                         ← server component
│   │   │   └── DashboardClient.tsx              ← owned + shared lists, upload, create
│   │   ├── doc/[id]/
│   │   │   ├── page.tsx                         ← server component, perm check
│   │   │   └── DocumentClient.tsx               ← editor, autosave, rename, share dialog
│   │   └── api/
│   │       ├── auth/{login,logout,me,users}/route.ts
│   │       ├── docs/route.ts                    ← GET list, POST create
│   │       ├── docs/[id]/route.ts               ← GET, PATCH (title/content), DELETE
│   │       ├── docs/[id]/share/route.ts         ← GET, POST, DELETE (owner only)
│   │       └── upload/route.ts                  ← multipart upload → new doc
│   ├── components/
│   │   ├── Editor.tsx                           ← TipTap wrapper
│   │   ├── Toolbar.tsx                          ← formatting buttons
│   │   └── ShareDialog.tsx                      ← share-by-email modal
│   └── lib/
│       ├── db.ts                                ← libSQL client, schema, queries
│       ├── auth.ts                              ← HMAC cookie session
│       └── upload.ts                            ← .txt / .md / .docx → sanitized HTML
│
└── tests/
    ├── upload.test.ts                           ← Vitest, conversion + sanitization (7)
    ├── sharing.test.ts                          ← Vitest, permission matrix (4)
    └── _node/
        ├── upload.node.test.mjs                 ← same coverage, node:test runner
        └── sharing.node.test.mjs                ← same coverage, node:sqlite + node:test
```

## Features mapped to spec requirements

| Spec requirement | Implementation |
|---|---|
| Create a new document | "New document" button on dashboard → `POST /api/docs` |
| Rename a document | Click-to-edit title in editor header → `PATCH /api/docs/[id]` |
| Edit content in a browser | TipTap editor on `/doc/[id]` |
| Save and reopen | Autosave (800 ms debounce + `sendBeacon` on unload); content persists in `documents.content` |
| Bold | Toolbar + Cmd/Ctrl-B |
| Italic | Toolbar + Cmd/Ctrl-I |
| Underline | Toolbar + Cmd/Ctrl-U |
| Headings | H1 / H2 / H3 toolbar buttons |
| Bulleted lists | • List toolbar button |
| Numbered lists | 1. List toolbar button |
| File upload — turn into editable doc | "Upload" button on dashboard accepts `.txt`, `.md`, `.docx`; creates a new doc with the file's content rendered as TipTap HTML |
| Stated allowed types in UI | Hint text below the upload button + accepted attribute on the file input |
| Stated allowed types in README | "Supported file types" section in README + 5 MB cap |
| Owner field on documents | `documents.owner_id` |
| Grant another user access | Share dialog (owner-only), email + permission, auto-provisions account if needed |
| Visible distinction between owned and shared | Dashboard has two sections, "Your documents" and "Shared with you"; shared rows show owner email and permission badge |
| Documents survive refresh | SQLite persistence; pages re-render from DB on every load |
| Formatting preserved | TipTap HTML round-trips through the DB; sanitizer allowlist matches TipTap's tag set |
| Shared access behavior demonstrable | Sign in with two different emails in two browsers, share from one, refresh the other |
| Setup and run instructions | `README.md` |
| Working deployment | Vercel + Turso path documented in `README.md`; live URL pending (`DEPLOY_URL.txt`) |
| Validation and error handling | Email regex, size cap, type allowlist on upload; HTML sanitizer; permission seam; explicit 400/401/403/404 responses with JSON error bodies |
| At least one meaningful automated test | 11 tests across two files — see `tests/` |
| Short architecture note | `ARCHITECTURE.md` |

## Tests verified

11 tests, all passing:

```
ok  owner has owner permission, strangers have none
ok  granting a share gives the user the right permission and surfaces it in their shared list
ok  addShare upserts when re-shared with a new permission
ok  removing a share revokes access
ok  converts plain text into paragraphs with the filename stem as title
ok  renders markdown headings and lists
ok  strips disallowed HTML to prevent injection
ok  escapes HTML special chars in .txt uploads
ok  rejects unknown extensions
ok  rejects empty uploads
ok  rejects files over the size limit
```

## Notes for the reviewer

- The two `tests/_node/*.mjs` files are not duplicate work — they're a mirror of the Vitest suite that uses Node 22's built-in `node:test` and `node:sqlite`. The intent is to make the tests runnable without installing third-party test infrastructure, which is occasionally useful in CI or sandboxed environments. The Vitest suite is the canonical one.
- `_testenv/` may appear during local development; it's listed in `.gitignore` and isn't part of the deliverable.
- See `AI_WORKFLOW.md` for a candid description of what was AI-generated vs. human-decided.
