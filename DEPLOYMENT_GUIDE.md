# Step-by-Step Deployment Guide

This walks you from "I have the code on my laptop" to "anyone with this URL can use the app." Aim for ~15 minutes if you've never used Vercel before, ~5 if you have.

There are three pieces:

1. **GitHub** — hosts your code. Vercel pulls from here.
2. **Turso** — hosts your database (since Vercel's filesystem is ephemeral, local SQLite won't work in production).
3. **Vercel** — runs the actual app.

All three have free tiers that comfortably cover this app.

---

## Part 1 — Get the code onto GitHub

You don't upload files to Vercel directly. Vercel watches a GitHub repo and re-deploys every time you push.

### 1.1 Make sure you have the tools

- A free GitHub account: <https://github.com/signup>
- Git installed on your machine. Check with `git --version` in a terminal. If it says "command not found":
  - macOS: install Xcode Command Line Tools (`xcode-select --install`)
  - Windows: <https://git-scm.com/download/win>
  - Linux: `sudo apt install git` or your distro's equivalent

### 1.2 Create a new empty repo on GitHub

1. Sign in to GitHub.
2. Click the **+** in the top-right → **New repository**.
3. Name it whatever you like, e.g. `collab-docs`.
4. Leave it set to **Public** (Vercel's free tier works for either, but public is simpler).
5. **Do NOT** check "Add a README" or any of the other init options — your local folder already has those files.
6. Click **Create repository**.
7. On the next page, copy the URL that looks like `https://github.com/YOUR_USERNAME/collab-docs.git`. You'll paste it in a moment.

### 1.3 Push the local folder to GitHub

Open a terminal and `cd` into the project folder. On your machine that's:

```
cd "C:\Users\aishw\AppData\Roaming\Claude\local-agent-mode-sessions\6a467801-29b3-49ea-ae49-cf95b365a935\e15102d7-2094-47cb-8b38-4fa8f661eb68\local_2322ccd2-5d0e-4ff5-8154-39f34d9608e6\outputs\collab-docs"
```

Then run these commands one at a time:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/collab-docs.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username. The last command will ask for authentication — use a GitHub personal access token (Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate, give it `repo` scope) as the password.

Refresh the GitHub page; you should see all your files there.

> The `.gitignore` already excludes `node_modules/`, `.env`, `local.db`, and `_testenv/`, so you won't accidentally push 200 MB of dependencies.

---

## Part 2 — Set up the database (Turso)

Turso is a hosted database that speaks the SQLite dialect — your code already supports it, you just need to give it a URL.

### 2.1 Create a Turso account

1. Go to <https://turso.tech>.
2. Sign up (GitHub login is fastest).
3. You'll land on the dashboard.

### 2.2 Create a database

1. Click **Create Database** (or follow the onboarding wizard).
2. Pick any name, e.g. `collab-docs`.
3. Pick a location near where most of your reviewers are (US East is a safe default).
4. Click **Create**.

### 2.3 Grab the connection details

On the database's page you'll see:

- **Database URL** — something like `libsql://collab-docs-yourname.turso.io`. Copy it.
- **Auth Token** — click **Generate Token** or **Create Token**, give it any name, click create. Copy the token that appears. (It only shows once; if you lose it, generate a new one.)

Keep these two values handy. You'll paste them into Vercel in a minute.

---

## Part 3 — Deploy to Vercel

### 3.1 Create a Vercel account

1. Go to <https://vercel.com/signup>.
2. **Sign up with GitHub** (this auto-connects the two services).
3. Approve Vercel's access when prompted.
4. Pick the **Hobby** plan (free, no credit card needed).

### 3.2 Import your repo

1. On the Vercel dashboard, click **Add New** → **Project**.
2. You'll see a list of your GitHub repos. Find `collab-docs` and click **Import**.
3. If you don't see it: click **Adjust GitHub App Permissions** at the bottom, give Vercel access to that repo (or "All repositories"), then refresh.

### 3.3 Configure the project

Vercel will auto-detect this is a Next.js project. You don't need to change the build settings. **But you do need to add three environment variables.**

Click **Environment Variables** (a section on the import page) and add these three, one at a time:

| Name | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | `libsql://collab-docs-yourname.turso.io` | Turso dashboard (Part 2.3) |
| `DATABASE_AUTH_TOKEN` | The long token string | Turso dashboard (Part 2.3) |
| `SESSION_SECRET` | A random 64-char hex string | Generate yourself (see below) |

To generate `SESSION_SECRET`: in a terminal, run

```bash
openssl rand -hex 32
```

Or use any random 32+ character string. Don't share it — it's what signs the auth cookies.

### 3.4 Deploy

Click **Deploy**.

Vercel will:

1. Pull your code from GitHub
2. Run `npm install` (takes ~1–2 minutes)
3. Run `npm run build` (~30 seconds)
4. Spin up your app

You'll watch the log scroll by. When it finishes, you'll see a confetti animation and a URL like `https://collab-docs-yourname.vercel.app`. **That's the URL anyone can use to access your app.**

### 3.5 Test it

1. Click the URL.
2. Sign in with any email — say `alice@test.com`. You'll land on an empty dashboard.
3. Click **New document**, type something, format it with the toolbar.
4. Go back to the dashboard, click **Share**, share with `bob@test.com`.
5. Open a private/incognito window, go to the same URL, sign in as `bob@test.com`. You should see Alice's doc under "Shared with you."

If that works, you're done. **Paste the URL into `DEPLOY_URL.txt`** in your project (just the URL on one line, replacing the placeholder text) and commit + push.

---

## Common issues

**`git push` asks for username and password and rejects my GitHub password.**
GitHub disabled password auth in 2021. Use a personal access token instead (Settings → Developer settings → Personal access tokens → Generate new (classic) → check `repo` scope → copy the token and paste it as the password).

**Build fails with "Cannot find module @libsql/client".**
You probably committed a partial `package.json`. Make sure the file looks complete by opening it on GitHub. If it's missing the `dependencies` block, fix it locally and `git push`.

**App loads but I get "Error: Cannot connect to database" on sign-in.**
Either `DATABASE_URL` is wrong (missing the `libsql://` prefix, or pointing at the wrong db) or `DATABASE_AUTH_TOKEN` is wrong/expired. Re-copy both from Turso, paste into Vercel (Settings → Environment Variables), and trigger a redeploy from the Deployments tab.

**App loads but my session is rejected immediately.**
Probably `SESSION_SECRET` is unset or changed between deploys. Set it once in Vercel and don't change it (changing it invalidates all existing sessions, which is fine — just sign in again).

**Vercel built it but the URL says "DEPLOYMENT_NOT_FOUND".**
Wait 30 seconds and refresh. First deploys sometimes take an extra minute to wire up DNS.

**I want to update the app.**
Just push to GitHub. Vercel auto-deploys every push to `main`. You can also click **Redeploy** from the Vercel dashboard if you change env vars without changing code.

---

## What you upload, what's automatic

| Thing | Where it lives | How it gets there |
|---|---|---|
| Source code | GitHub repo | `git push` (you do this once, manually) |
| Dependencies (`node_modules`) | Vercel build server | `npm install` (Vercel runs this automatically) |
| Database schema | Turso | The app creates tables on first connect (automatic) |
| Environment variables | Vercel project settings | You paste them in once during setup |
| The deployed website | Vercel's CDN | `npm run build` (Vercel runs this automatically) |
| User data (docs, shares) | Turso | The running app writes to it as users use it |

You never touch the build server, the CDN, or the database directly. You touch GitHub (code), Vercel (config), and Turso (data) — three control panels, but only two of them after the initial setup.

---

## After deploy: the last checklist item

Once you have the live URL:

1. Replace the entire content of `DEPLOY_URL.txt` with just that URL on a single line.
2. `git add DEPLOY_URL.txt && git commit -m "Add live URL" && git push`. (This triggers a redeploy, which is harmless.)
3. Record the walkthrough video using your deployed URL (the script is in `VIDEO_URL.txt`).
4. Replace `VIDEO_URL.txt` content with the video URL, push again.

Then you can submit.
