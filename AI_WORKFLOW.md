# AI Workflow

A candid account of how I used AI to build this take-home, what I delegated and what I owned, and the things I verified by hand rather than trusted the model on.

## Tool used

Claude (in Cowork mode) — Anthropic's desktop product that wraps Claude with file-system tools, a sandboxed Linux shell, and skill plugins. I used it as a pair-programmer: I described the requirements, made the product decisions, and reviewed each step; Claude did most of the typing.

## The shape of the session

1. **Spec in, scoping questions out.** I pasted the full take-home spec. Before writing any code, Claude asked four clarifying questions — stack choice, auth approach, deployment target, upload formats — with a recommended option for each. I picked Next.js + SQLite, lightweight email login, Vercel, and "all of .txt/.md/.docx." That single round of clarification was worth more than 20 minutes of post-hoc rewrites would have been.
2. **Plan with task list.** Claude created a tracked task list (scaffold → DB + auth → API routes → UI → upload → tests → README → verify) and worked through them, marking each one in-progress / complete. Useful for me to see what was still outstanding; useful for Claude to keep its place across long contexts.
3. **Build in order.** Database schema and helpers first (so everything downstream had types and operations to call), then auth (so endpoints could ask `who is this?`), then API routes (so the UI had something to call), then the editor + dashboard + share dialog. Tests written after the corresponding modules. README and architecture note last, once the actual shape was settled rather than the imagined one.
4. **Verify.** Tests run, TypeScript checked on the lib files, source scanned for malformed bytes (found and fixed an artifact of the Write tool that left trailing null padding on one file).

## What I delegated to AI

- **Almost all the code.** The Next.js project structure, the libSQL data layer, the cookie-auth utility, the eight API routes, the TipTap editor component, the dashboard, the share dialog, the upload pipeline, the README. I read every file and made small corrections, but the typing was Claude's.
- **The schema.** Three tables with the right indices, FKs, and the `UNIQUE(document_id, user_id)` constraint that makes "reshare with new permission" an upsert. I checked it, didn't write it.
- **The autosave debounce + `sendBeacon` pattern.** I asked for autosave; Claude proposed the 800 ms debounce and the beforeunload flush. I sanity-checked that `sendBeacon` actually works for PATCH-equivalent payloads (it does — it POSTs a Blob with the content-type we set) and accepted it.
- **The upload sanitization design.** Claude suggested funneling all three formats through a single `sanitize-html` allowlist after parsing. I noticed it had originally written separate sanitization for each path and asked it to unify — one pass means one place to audit.
- **Test cases.** I asked for "tests that cover something meaningful," and Claude proposed the seven upload cases (txt/md conversion, injection attempts, size/empty guards, unknown extensions) and four sharing cases (owner detection, grant + visibility, upsert on re-share, revoke). I added the upsert case after reviewing the list — the original had only "grant" and "revoke," and the upsert behavior was non-obvious enough to be worth a test.

## What I owned

- **Product decisions.** Whether to do lightweight email vs. password auth, whether to support `.docx` (more impressive but heavier dep), whether autosave or save-button (autosave, even though it's harder to demo). These were my calls, made up front in the clarification round.
- **The "share before signup" feature.** I asked Claude to make share-by-email auto-provision an account so the recipient sees the doc on first login. This wasn't in the spec but felt like the right product move.
- **The permission-seam discipline.** When reviewing the first cut, I noticed two routes were doing ad-hoc owner checks. I asked Claude to consolidate everything behind a single `getUserPermission` helper that returns `'owner' | 'edit' | 'view' | null`. Same logic, much easier to argue about.
- **Trade-off prose in the README.** Claude drafted, I edited. I removed two bullets that were over-claiming and reframed one as a future-work item instead of a delivered feature.

## Things AI got wrong that I caught

- **Write tool null-padding.** Several files came out of Claude's `Write` tool with trailing null bytes (the tool padded ends with `\x00`). One file (`tests/_node/sharing.node.test.mjs`) was non-parseable as a result. I scanned every source file with Python and re-wrote the affected ones via bash heredoc, which produces clean files.
- **Initial install order.** First test run failed with `Cannot find module 'dayjs'` because `sanitize-html`'s transitive dep wasn't present in a partially-installed `node_modules`. Not a code bug, but Claude wanted to declare victory before I made it re-run from a clean state.
- **TypeScript compilation of `auth.ts`.** Claude's `tsc` check didn't initially include `next/headers` types because the workspace I used to run tsc was deliberately minimal. Not a real bug, but a reminder that "tsc says OK" depends on which tsconfig and which types you give it.
- **Over-claiming "deployment done."** Claude initially summarized as if the app were deployed. I corrected the framing — the code is *deploy-ready*, but I can't click the Vercel deploy button from this sandbox. The README has step-by-step instructions.

## Things I verified by hand, not by AI assertion

- The 11 automated tests actually pass (4 sharing + 7 upload). Ran `node --experimental-sqlite --test` against the `_node/` versions of the suite and watched all 11 print `ok`.
- TypeScript strict-mode compiles for the data-layer files (`db.ts`, `upload.ts`). `auth.ts` requires `next/headers` so its check needs a full install.
- The permission helper's branches actually match what the API routes call. I traced each of the eight route handlers to confirm none of them does its own owner check anymore.
- The schema includes `ON DELETE CASCADE` from `documents` to `shares` so deleting a doc doesn't leave orphaned share rows.
- The sanitizer allowlist actually strips `<script>` and `onclick` (one of the test cases asserts this).
- The Vercel deploy path I documented (Turso + libSQL) is real. `@libsql/client` does accept both `file:` and `libsql://` URLs with the same API.

## Things I did NOT verify, by name

- That `npm run build` produces a green Next.js production build. The sandbox's 45-second cap per shell call wasn't enough to complete a full `npm install` of Next + TipTap + mammoth in one go. I expect it to build cleanly — the imports are normal, no exotic config — but a reviewer running locally is the canonical check.
- That the app actually renders correctly in a browser. I have no headless browser in the sandbox. I'll do this manually before recording the walkthrough video.
- That Turso works end-to-end. The libSQL client docs and Vercel docs both describe this path; I haven't personally exercised it for this app.

## Cost of using AI for this build

Roughly two hours of elapsed time, end-to-end, including the clarification round, the build, the verification, and writing this note. Most of the typing — the literal characters in the source files — came from Claude. Most of the decisions — what to build, what to skip, where to draw seams — were mine.

If I'd built this without AI, I'd guess 6–10 hours: maybe two on scaffolding/auth, two on the editor and share UX, two on the upload pipeline + sanitization (especially fighting `mammoth` for the first time), one on tests, and the rest on README + deployment friction. AI didn't change *what* I built, but it compressed the implementation phase significantly.

## What I'd want to ask AI to do next

- Add a real-time collab layer (Y.js + WebSocket). Probably another half-day.
- Replace email-only auth with magic-link email (Resend or similar). An hour, mostly because the seam is already isolated.
- Add a comments sidebar tied to selections in TipTap. Half a day.
- Write Playwright tests for the share flow that exercise it through the real UI. An hour or two, plus another for fixing whatever the tests find.
