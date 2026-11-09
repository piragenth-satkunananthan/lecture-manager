import { readFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import { openPlannerDatabase } from "./db.js";
import { createSmtpTransport, deliverDueReminders } from "./notifications.js";
import { buildServer } from "./server.js";

const config = loadConfig();
if (!config.plannerPassword) throw new Error("PLANNER_PASSWORD is required to serve the planner");
if (!config.sessionKeyFile) throw new Error("SESSION_KEY_FILE is required to serve the planner");

const sessionKey = readFileSync(config.sessionKeyFile);
if (sessionKey.length !== 32) throw new Error("SESSION_KEY_FILE must contain exactly 32 bytes");

const db = openPlannerDatabase(config.databasePath);
const app = await buildServer({
  db,
  plannerPassword: config.plannerPassword,
  sessionKey,
  extractionEnabled: config.extractionEnabled,
  secureCookies: config.plannerOrigin.startsWith("https://"),
  ...(config.plannerOrigin ? { plannerOrigin: config.plannerOrigin } : {}),
});

await app.listen({ host: config.host, port: config.port });
console.log(`Planner listening on ${config.plannerOrigin || `http://${config.host}:${config.port}`}`);

const transport = createSmtpTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  user: config.smtpUser,
  password: config.smtpPassword,
  from: config.smtpFrom,
  to: config.smtpTo,
});
const runReminderTick = async (): Promise<void> => {
  try {
    const result = await deliverDueReminders(db, transport, {
      from: config.smtpFrom,
      to: config.smtpTo,
    });
    if (result.delivered > 0 || result.failed > 0) {
      console.log(`Reminders: ${result.delivered} delivered, ${result.failed} failed`);
    }
  } catch {
    console.error("Reminder delivery tick failed");
  }
};
void runReminderTick();
const reminderTimer = setInterval(() => { void runReminderTick(); }, 60_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    clearInterval(reminderTimer);
    await app.close();
    db.close();
    process.exit(0);
  });
}
