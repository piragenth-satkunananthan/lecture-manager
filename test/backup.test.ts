import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { backupDatabase, restoreDatabase } from "../src/backup.js";
import {
  createPlannerItem,
  getPlannerItem,
  insertSourceMessage,
  openPlannerDatabase,
} from "../src/db.js";

function seedDatabase(dbPath: string): number {
  const db = openPlannerDatabase(dbPath);
  try {
    insertSourceMessage(db, {
      groupId: "group-1",
      messageId: "backup-1",
      senderId: "lecturer-1",
      sentAt: "2026-11-07T03:30:00.000Z",
      rawText: "synthetic backup text",
    });
    return createPlannerItem(db, {
      sourceGroupId: "group-1",
      sourceMessageId: "backup-1",
      kind: "assignment",
      title: "Backed-up assignment",
      details: null,
      course: "Databases",
      location: null,
      dueDate: "2026-11-20",
      dueTime: null,
      classDate: null,
      classTime: null,
      changeType: null,
      changeDetails: null,
      zoomUrl: null,
      ambiguousFields: [],
      fieldEvidence: { kind: [{ quote: "assignment" }] },
    });
  } finally {
    db.close();
  }
}

test("backs up and restores a planner database", () => {
  const dir = mkdtempSync(join(tmpdir(), "planner-backup-"));
  const dbPath = join(dir, "planner.sqlite");
  try {
    const itemId = seedDatabase(dbPath);
    const result = backupDatabase(dbPath, join(dir, "backups"));
    assert.equal(result.integrity, "ok");
    assert.ok(result.bytes > 0);

    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
    const restored = restoreDatabase(result.path, dbPath);
    assert.equal(restored.safetyCopy, null);

    const db = openPlannerDatabase(dbPath);
    try {
      assert.equal(getPlannerItem(db, itemId)?.title, "Backed-up assignment");
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps a safety copy when restoring over an existing database", () => {
  const dir = mkdtempSync(join(tmpdir(), "planner-backup-"));
  const dbPath = join(dir, "planner.sqlite");
  try {
    seedDatabase(dbPath);
    const result = backupDatabase(dbPath, join(dir, "backups"));
    const restored = restoreDatabase(result.path, dbPath);
    assert.ok(restored.safetyCopy);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects a backup that is not a valid database", () => {
  const dir = mkdtempSync(join(tmpdir(), "planner-backup-"));
  try {
    const bad = join(dir, "bad.sqlite");
    writeFileSync(bad, "not a sqlite database");
    assert.throws(() => restoreDatabase(bad, join(dir, "planner.sqlite")));
    assert.throws(() => backupDatabase(join(dir, "missing.sqlite"), join(dir, "backups")), /not found/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
