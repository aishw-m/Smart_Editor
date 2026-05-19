import { createClient, type Client } from "@libsql/client";

// Single libSQL client used for both local dev (file:) and remote (libsql://) Turso.
// The same API works in both, which lets us deploy to Vercel by swapping env vars.
let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const url = process.env.DATABASE_URL || "file:./local.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  _client = createClient({ url, authToken });
  return _client;
}

let _initialized = false;

async function init(): Promise<void> {
  if (_initialized) return;
  const db = getClient();
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
         id TEXT PRIMARY KEY,
         email TEXT UNIQUE NOT NULL,
         created_at TEXT NOT NULL
       )`,
      `CREATE TABLE IF NOT EXISTS documents (
         id TEXT PRIMARY KEY,
         title TEXT NOT NULL,
         content TEXT NOT NULL,
         owner_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         FOREIGN KEY (owner_id) REFERENCES users(id)
       )`,
      `CREATE TABLE IF NOT EXISTS shares (
         id TEXT PRIMARY KEY,
         document_id TEXT NOT NULL,
         user_id TEXT NOT NULL,
         permission TEXT NOT NULL DEFAULT 'edit',
         created_at TEXT NOT NULL,
         UNIQUE(document_id, user_id),
         FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       )`,
      `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shares_doc ON shares(document_id)`,
    ],
    "write"
  );
  _initialized = true;
}

export async function db(): Promise<Client> {
  await init();
  return getClient();
}

// ---------- domain helpers ----------

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Share {
  id: string;
  document_id: string;
  user_id: string;
  permission: "view" | "edit";
  created_at: string;
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    email: String(r.email),
    created_at: String(r.created_at),
  };
}

function rowToDocument(r: Record<string, unknown>): Document {
  return {
    id: String(r.id),
    title: String(r.title),
    content: String(r.content),
    owner_id: String(r.owner_id),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email.toLowerCase()],
  });
  return r.rows[0] ? rowToUser(r.rows[0] as Record<string, unknown>) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });
  return r.rows[0] ? rowToUser(r.rows[0] as Record<string, unknown>) : null;
}

export async function createUser(id: string, email: string): Promise<User> {
  const client = await db();
  const now = new Date().toISOString();
  const normalized = email.toLowerCase();
  await client.execute({
    sql: "INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)",
    args: [id, normalized, now],
  });
  return { id, email: normalized, created_at: now };
}

export async function listUsers(): Promise<User[]> {
  const client = await db();
  const r = await client.execute("SELECT * FROM users ORDER BY email");
  return r.rows.map((row) => rowToUser(row as Record<string, unknown>));
}

export async function getDocument(id: string): Promise<Document | null> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM documents WHERE id = ?",
    args: [id],
  });
  return r.rows[0]
    ? rowToDocument(r.rows[0] as Record<string, unknown>)
    : null;
}

export async function createDocument(
  id: string,
  ownerId: string,
  title: string,
  content: string
): Promise<Document> {
  const client = await db();
  const now = new Date().toISOString();
  await client.execute({
    sql: "INSERT INTO documents (id, title, content, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, title, content, ownerId, now, now],
  });
  return {
    id,
    title,
    content,
    owner_id: ownerId,
    created_at: now,
    updated_at: now,
  };
}

export async function updateDocument(
  id: string,
  patch: { title?: string; content?: string }
): Promise<void> {
  const client = await db();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const args: (string | null)[] = [];
  if (patch.title !== undefined) {
    fields.push("title = ?");
    args.push(patch.title);
  }
  if (patch.content !== undefined) {
    fields.push("content = ?");
    args.push(patch.content);
  }
  if (!fields.length) return;
  fields.push("updated_at = ?");
  args.push(now);
  args.push(id);
  await client.execute({
    sql: `UPDATE documents SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM documents WHERE id = ?",
    args: [id],
  });
}

export async function listOwnedDocuments(ownerId: string): Promise<Document[]> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM documents WHERE owner_id = ? ORDER BY updated_at DESC",
    args: [ownerId],
  });
  return r.rows.map((row) => rowToDocument(row as Record<string, unknown>));
}

export async function listSharedDocuments(
  userId: string
): Promise<(Document & { permission: string; owner_email: string })[]> {
  const client = await db();
  const r = await client.execute({
    sql: `SELECT d.*, s.permission, u.email AS owner_email
          FROM documents d
          JOIN shares s ON s.document_id = d.id
          JOIN users u ON u.id = d.owner_id
          WHERE s.user_id = ?
          ORDER BY d.updated_at DESC`,
    args: [userId],
  });
  return r.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...rowToDocument(r),
      permission: String(r.permission),
      owner_email: String(r.owner_email),
    };
  });
}

export async function getShares(
  documentId: string
): Promise<(Share & { email: string })[]> {
  const client = await db();
  const r = await client.execute({
    sql: `SELECT s.*, u.email
          FROM shares s
          JOIN users u ON u.id = s.user_id
          WHERE s.document_id = ?
          ORDER BY u.email`,
    args: [documentId],
  });
  return r.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      document_id: String(r.document_id),
      user_id: String(r.user_id),
      permission: r.permission === "view" ? "view" : "edit",
      created_at: String(r.created_at),
      email: String(r.email),
    };
  });
}

export async function addShare(
  id: string,
  documentId: string,
  userId: string,
  permission: "view" | "edit"
): Promise<void> {
  const client = await db();
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO shares (id, document_id, user_id, permission, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(document_id, user_id)
          DO UPDATE SET permission = excluded.permission`,
    args: [id, documentId, userId, permission, now],
  });
}

export async function removeShare(
  documentId: string,
  userId: string
): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM shares WHERE document_id = ? AND user_id = ?",
    args: [documentId, userId],
  });
}

export async function getUserPermission(
  documentId: string,
  userId: string
): Promise<"owner" | "edit" | "view" | null> {
  const client = await db();
  const doc = await client.execute({
    sql: "SELECT owner_id FROM documents WHERE id = ?",
    args: [documentId],
  });
  if (!doc.rows[0]) return null;
  if (String((doc.rows[0] as Record<string, unknown>).owner_id) === userId) {
    return "owner";
  }
  const share = await client.execute({
    sql: "SELECT permission FROM shares WHERE document_id = ? AND user_id = ?",
    args: [documentId, userId],
  });
  if (!share.rows[0]) return null;
  const p = String((share.rows[0] as Record<string, unknown>).permission);
  return p === "view" ? "view" : "edit";
}
