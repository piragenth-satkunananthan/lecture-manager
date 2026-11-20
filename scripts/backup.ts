import { backupDatabase } from "../src/backup.js";

const dbPath = process.env.DATABASE_PATH?.trim() || "./storage/planner.sqlite";
const backupDir = process.env.BACKUP_PATH?.trim() || "./backups";
const keyFile = process.env.BACKUP_ENCRYPTION_KEY_FILE?.trim() || undefined;
const result = backupDatabase(dbPath, backupDir, keyFile);
console.log(`Backup written: ${result.path}`);
console.log(`Size: ${result.bytes} bytes; integrity: ${result.integrity}; encrypted: ${result.encrypted}`);
