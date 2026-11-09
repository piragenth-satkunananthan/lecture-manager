import { restoreDatabase } from "../src/backup.js";

const backupPath = process.argv[2];
if (!backupPath) throw new Error("Usage: npm run restore -- <backup.sqlite>");
const dbPath = process.env.DATABASE_PATH?.trim() || "./storage/planner.sqlite";
const result = restoreDatabase(backupPath, dbPath);
console.log(`Restored ${dbPath}`);
console.log(result.safetyCopy ? `Previous database saved at ${result.safetyCopy}` : "No previous database existed");
