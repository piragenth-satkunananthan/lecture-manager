import { openPlannerDatabase } from "../src/db.js";

const dbPath = process.env.DATABASE_PATH?.trim() || "./storage/planner.sqlite";
const db = openPlannerDatabase(dbPath);

const total = db.prepare("SELECT COUNT(*) AS count FROM source_messages").get() as { count: number };
console.log(`Database: ${dbPath}`);
console.log(`Source messages: ${total.count}`);
if (total.count === 0) {
  console.log("No source messages recorded yet.");
} else {
  const byState = db.prepare(`
    SELECT extraction_state, COUNT(*) AS count
    FROM source_messages
    GROUP BY extraction_state
    ORDER BY extraction_state
  `).all() as Array<{ extraction_state: string; count: number }>;
  console.log("By state:");
  for (const row of byState) console.log(`  ${row.extraction_state}: ${row.count}`);

  const bySender = db.prepare(`
    SELECT group_id, sender_id, COUNT(*) AS count
    FROM source_messages
    GROUP BY group_id, sender_id
    ORDER BY count DESC
  `).all() as Array<{ group_id: string; sender_id: string; count: number }>;
  console.log("By sender:");
  for (const row of bySender) {
    console.log(`  ${row.sender_id} in ${row.group_id}: ${row.count}`);
  }

  const failures = db.prepare(`
    SELECT failure_code, COUNT(*) AS count
    FROM source_messages
    WHERE extraction_state = 'failed'
    GROUP BY failure_code
  `).all() as Array<{ failure_code: string | null; count: number }>;
  if (failures.length > 0) {
    console.log("Failures:");
    for (const row of failures) console.log(`  ${row.failure_code ?? "unknown"}: ${row.count}`);
  }
}
db.close();
