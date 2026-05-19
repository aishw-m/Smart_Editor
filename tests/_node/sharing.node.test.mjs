import { test, before } from "node:test";
import assert from "node:assert/strict";
import sqlite from "node:sqlite";
import { nanoid } from "nanoid";

// Mirror of the SQL in src/lib/db.ts run against Node's built-in SQLite.
// Verifies the exact permission model the production module relies on.
// Note: production uses @libsql/client (async). This test uses node:sqlite
// (sync) — same SQL dialect, same constraints, same logic.

const db = new sqlite.DatabaseSync(":memory:");

before(() => {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );
    CREATE TABLE shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'edit',
      created_at TEXT NOT NULL,
      UNIQUE(document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
});

function createUser(id, email) {
  const now = new Date().toISOString();
  const normalized = email.toLowerCase();
  db.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").run(
    id,
    normalized,
    now
  );
  return { id, email: normalized, created_at: now };
}

function createDocument(id, ownerId, title, content) {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO documents (id, title, content, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, title, content, ownerId, now, now);
  return { id, title, content, owner_id: ownerId };
}

function addShare(id, documentId, userId, permission) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO shares (id, document_id, user_id, permission, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(document_id, user_id)
     DO UPDATE SET permission = excluded.permission`
  ).run(id, documentId, userId, permission, now);
}

function removeShare(documentId, userId) {
  db.prepare(
    "DELETE FROM shares WHERE document_id = ? AND user_id = ?"
  ).run(documentId, userId);
}

function getUserPermission(documentId, userId) {
  const doc = db
    .prepare("SELECT owner_id FROM documents WHERE id = ?")
    .get(documentId);
  if (!doc) return null;
  if (String(doc.owner_id) === userId) return "owner";
  const share = db
    .prepare(
      "SELECT permission FROM shares WHERE document_id = ? AND user_id = ?"
    )
    .get(documentId, userId);
  if (!share) return null;
  const p = String(share.permission);
  return p === "view" ? "view" : "edit";
}

function listSharedDocuments(userId) {
  return db
    .prepare(
      `SELECT d.*, s.permission, u.email AS owner_email
       FROM documents d
       JOIN shares s ON s.document_id = d.id
       JOIN users u ON u.id = d.owner_id
       WHERE s.user_id = ?`
    )
    .all(userId);
}

function listOwnedDocuments(ownerId) {
  return db
    .prepare("SELECT * FROM documents WHERE owner_id = ?")
    .all(ownerId);
}

test("owner has owner permission, strangers have none", () => {
  const alice = createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
  const bob = createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
  const doc = createDocument(nanoid(8), alice.id, "Alice's doc", "<p>hi</p>");
  assert.equal(getUserPermission(doc.id, alice.id), "owner");
  assert.equal(getUserPermission(doc.id, bob.id), null);
});

test("granting a share gives the user the right permission and surfaces it in their shared list", () => {
  const alice = createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
  const bob = createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
  const doc = createDocument(nanoid(8), alice.id, "Plan", "<p>plan</p>");
  addShare(nanoid(8), doc.id, bob.id, "edit");
  assert.equal(getUserPermission(doc.id, bob.id), "edit");
  const shared = listSharedDocuments(bob.id);
  assert.ok(shared.find((d) => d.id === doc.id));
  const bobOwned = listOwnedDocuments(bob.id);
  assert.ok(!bobOwned.find((d) => d.id === doc.id));
});

test("addShare upserts when re-shared with a new permission", () => {
  const alice = createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
  const bob = createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
  const doc = createDocument(nanoid(8), alice.id, "Doc", "<p></p>");
  addShare(nanoid(8), doc.id, bob.id, "view");
  assert.equal(getUserPermission(doc.id, bob.id), "view");
  addShare(nanoid(8), doc.id, bob.id, "edit");
  assert.equal(getUserPermission(doc.id, bob.id), "edit");
});

test("removing a share revokes access", () => {
  const alice = createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
  const bob = createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
  const doc = createDocument(nanoid(8), alice.id, "Doc", "<p></p>");
  addShare(nanoid(8), doc.id, bob.id, "edit");
  assert.equal(getUserPermission(doc.id, bob.id), "edit");
  removeShare(doc.id, bob.id);
  assert.equal(getUserPermission(doc.id, bob.id), null);
});
