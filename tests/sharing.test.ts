import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

// Point the DB at a throwaway file before any module imports it.
const TEST_DB = path.resolve(process.cwd(), `test-${nanoid(6)}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;

import {
  addShare,
  createDocument,
  createUser,
  getUserPermission,
  listOwnedDocuments,
  listSharedDocuments,
  removeShare,
} from "@/lib/db";

beforeAll(async () => {
  // Wipe any leftover db file so each run starts clean.
  await fs.rm(TEST_DB, { force: true });
});

describe("sharing permission model", () => {
  it("owner has owner permission, strangers have none", async () => {
    const alice = await createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
    const bob = await createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
    const doc = await createDocument(
      nanoid(8),
      alice.id,
      "Alice's doc",
      "<p>hi</p>"
    );

    expect(await getUserPermission(doc.id, alice.id)).toBe("owner");
    expect(await getUserPermission(doc.id, bob.id)).toBeNull();
  });

  it("granting a share gives the user the right permission and surfaces it in their shared list", async () => {
    const alice = await createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
    const bob = await createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
    const doc = await createDocument(
      nanoid(8),
      alice.id,
      "Plan",
      "<p>plan</p>"
    );

    await addShare(nanoid(8), doc.id, bob.id, "edit");
    expect(await getUserPermission(doc.id, bob.id)).toBe("edit");

    const shared = await listSharedDocuments(bob.id);
    expect(shared.find((d) => d.id === doc.id)).toBeTruthy();

    // Bob shouldn't see this in his "owned" list.
    const bobOwned = await listOwnedDocuments(bob.id);
    expect(bobOwned.find((d) => d.id === doc.id)).toBeFalsy();
  });

  it("addShare upserts when re-shared with a new permission", async () => {
    const alice = await createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
    const bob = await createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
    const doc = await createDocument(
      nanoid(8),
      alice.id,
      "Doc",
      "<p></p>"
    );
    await addShare(nanoid(8), doc.id, bob.id, "view");
    expect(await getUserPermission(doc.id, bob.id)).toBe("view");
    await addShare(nanoid(8), doc.id, bob.id, "edit");
    expect(await getUserPermission(doc.id, bob.id)).toBe("edit");
  });

  it("removing a share revokes access", async () => {
    const alice = await createUser(nanoid(8), `alice-${nanoid(4)}@x.test`);
    const bob = await createUser(nanoid(8), `bob-${nanoid(4)}@x.test`);
    const doc = await createDocument(
      nanoid(8),
      alice.id,
      "Doc",
      "<p></p>"
    );
    await addShare(nanoid(8), doc.id, bob.id, "edit");
    expect(await getUserPermission(doc.id, bob.id)).toBe("edit");

    await removeShare(doc.id, bob.id);
    expect(await getUserPermission(doc.id, bob.id)).toBeNull();
  });
});
