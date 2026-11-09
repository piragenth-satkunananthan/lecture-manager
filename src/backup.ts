import Database from "better-sqlite3";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface BackupResult {
  path: string;
  bytes: number;
  integrity: string;
}

export interface RestoreResult {
  safetyCopy: string | null;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function integrityOf(path: string): string {
  const db = new Database(path, { readonly: true });
  try {
    return String(db.pragma("integrity_check", { simple: true }));
  } finally {
    db.close();
  }
}

export function backupDatabase(dbPath: string, backupDir: string): BackupResult {
  const sourcePath = resolve(dbPath);
  if (!existsSync(sourcePath)) throw new Error(`Database not found: ${sourcePath}`);
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const destination = join(backupDir, `planner-${timestamp()}.sqlite`);

  const db = new Database(sourcePath);
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.prepare("VACUUM INTO ?").run(destination);
  } finally {
    db.close();
  }
  chmodSync(destination, 0o600);

  const integrity = integrityOf(destination);
  if (integrity !== "ok") throw new Error(`Backup integrity check failed: ${integrity}`);
  return { path: destination, bytes: statSync(destination).size, integrity };
}

export function restoreDatabase(backupPath: string, dbPath: string): RestoreResult {
  const source = resolve(backupPath);
  const target = resolve(dbPath);
  if (source === target) throw new Error("Backup and target database are the same file");
  if (!existsSync(source)) throw new Error(`Backup not found: ${source}`);
  if (integrityOf(source) !== "ok") throw new Error("Backup integrity check failed");

  mkdirSync(dirname(target), { recursive: true });
  let safetyCopy: string | null = null;
  if (existsSync(target)) {
    safetyCopy = `${target}.pre-restore-${timestamp()}`;
    copyFileSync(target, safetyCopy);
  }

  copyFileSync(source, target);
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${target}${suffix}`;
    if (existsSync(sidecar)) rmSync(sidecar);
  }

  const integrity = integrityOf(target);
  if (integrity !== "ok") {
    if (safetyCopy) copyFileSync(safetyCopy, target);
    throw new Error(`Restored database integrity check failed: ${integrity}`);
  }
  return { safetyCopy };
}
