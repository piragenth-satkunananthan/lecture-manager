import Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface BackupResult {
  path: string;
  bytes: number;
  integrity: string;
  encrypted: boolean;
}

export interface RestoreResult {
  safetyCopy: string | null;
}

const BACKUP_FORMAT_VERSION = 1;
const HEADER = Buffer.from("PLANNER-BACKUP-V1");
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

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

function readEncryptionKey(keyFile: string): Buffer {
  const key = readFileSync(keyFile);
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Backup encryption key must be exactly ${KEY_LENGTH} bytes`);
  }
  return key;
}

function encryptSnapshot(plaintextPath: string, keyFile: string): Buffer {
  const key = readEncryptionKey(keyFile);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(HEADER);

  const plaintext = readFileSync(plaintextPath);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const output = Buffer.alloc(
    HEADER.length + 4 + NONCE_LENGTH + TAG_LENGTH + ciphertext.length,
  );
  let offset = 0;
  HEADER.copy(output, offset);
  offset += HEADER.length;
  output.writeUInt32BE(BACKUP_FORMAT_VERSION, offset);
  offset += 4;
  nonce.copy(output, offset);
  offset += NONCE_LENGTH;
  tag.copy(output, offset);
  offset += TAG_LENGTH;
  ciphertext.copy(output, offset);

  return output;
}

export function backupDatabase(dbPath: string, backupDir: string, keyFile?: string): BackupResult {
  const sourcePath = resolve(dbPath);
  if (!existsSync(sourcePath)) throw new Error(`Database not found: ${sourcePath}`);
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const destination = join(backupDir, `planner-${timestamp()}.sqlite`);
  const encrypted = Boolean(keyFile);

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

  let finalPath = destination;
  let finalBytes = statSync(destination).size;

  if (encrypted && keyFile) {
    try {
      const encryptedBuffer = encryptSnapshot(destination, keyFile);
      const encryptedPath = `${destination}.enc`;
      writeFileSync(encryptedPath, encryptedBuffer, { mode: 0o600 });
      finalBytes = statSync(encryptedPath).size;
      finalPath = encryptedPath;
    } finally {
      // Always remove the plaintext temp snapshot after encryption (or on failure)
      rmSync(destination, { force: true });
    }
  }

  return { path: finalPath, bytes: finalBytes, integrity, encrypted };
}

export function restoreDatabase(backupPath: string, dbPath: string, keyFile?: string): RestoreResult {
  const source = resolve(backupPath);
  const target = resolve(dbPath);
  if (source === target) throw new Error("Backup and target database are the same file");
  if (!existsSync(source)) throw new Error(`Backup not found: ${source}`);

  const isEncrypted = source.endsWith(".enc");
  let workingPath = source;

  if (isEncrypted) {
    if (!keyFile) throw new Error("Encrypted backup requires a decryption key file");
    const key = readEncryptionKey(keyFile);
    const data = readFileSync(source);

    // Parse header
    const header = data.subarray(0, HEADER.length);
    if (!header.equals(HEADER)) throw new Error("Invalid backup header");
    const version = data.readUInt32BE(HEADER.length);
    if (version !== BACKUP_FORMAT_VERSION) {
      throw new Error(`Unsupported backup format version: ${version}`);
    }
    const nonce = data.subarray(HEADER.length + 4, HEADER.length + 4 + NONCE_LENGTH);
    const tag = data.subarray(HEADER.length + 4 + NONCE_LENGTH, HEADER.length + 4 + NONCE_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(HEADER.length + 4 + NONCE_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    decipher.setAAD(HEADER);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const decryptedPath = `${source}.decrypted-${timestamp()}.sqlite`;
    writeFileSync(decryptedPath, plaintext, { mode: 0o600 });
    workingPath = decryptedPath;
  }

  if (integrityOf(workingPath) !== "ok") {
    if (isEncrypted) rmSync(workingPath, { force: true });
    throw new Error("Backup integrity check failed");
  }

  mkdirSync(dirname(target), { recursive: true });
  let safetyCopy: string | null = null;
  if (existsSync(target)) {
    safetyCopy = `${target}.pre-restore-${timestamp()}`;
    copyFileSync(target, safetyCopy);
  }

  copyFileSync(workingPath, target);
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${target}${suffix}`;
    if (existsSync(sidecar)) rmSync(sidecar);
  }

  if (isEncrypted) rmSync(workingPath, { force: true });

  const integrity = integrityOf(target);
  if (integrity !== "ok") {
    if (safetyCopy) copyFileSync(safetyCopy, target);
    throw new Error(`Restored database integrity check failed: ${integrity}`);
  }
  return { safetyCopy };
}
