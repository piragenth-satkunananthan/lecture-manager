import { backupDatabase } from "../src/backup.js";

const dbPath = process.env.DATABASE_PATH?.trim() || "./storage/planner.sqlite";
const backupDir = process.env.BACKUP_DIR?.trim() || "./backups";
const result = backupDatabase(dbPath, backupDir);
console.log(`Backup written: ${result.path}`);
console.log(`Size: ${result.bytes} bytes; integrity: ${result.integrity}`);
