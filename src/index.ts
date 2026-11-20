import { readFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import { expireFailedSources, openPlannerDatabase } from "./db.js";
import { createConfiguredExtraction } from "./extraction-factory.js";
import { createSmtpTransport, deliverDueReminders } from "./notifications.js";
import { buildServer } from "./server.js";
import { backupDatabase } from "./backup.js";
import { scheduleZoomJobs, checkRecordingLimits, checkRecordingDiskSpace, getActiveRecordingJob, type ZoomSchedulerConfig } from "./zoom.js";

const config = loadConfig();
if (!config.plannerPassword) throw new Error("PLANNER_PASSWORD is required to serve the planner");
if (!config.sessionKeyFile) throw new Error("SESSION_KEY_FILE is required to serve the planner");

const sessionKey = readFileSync(config.sessionKeyFile);
if (sessionKey.length !== 32) throw new Error("SESSION_KEY_FILE must contain exactly 32 bytes");

const db = openPlannerDatabase(config.databasePath);
const extractor = createConfiguredExtraction(config);

const zoomSchedulerConfig: ZoomSchedulerConfig = {
  zoomAccountEmail: config.zoomAccountEmail,
  webtopAgentToken: config.webtopAgentToken,
  plannerBaseUrl: config.plannerOrigin || `http://${config.host}:${config.port}`,
  recordingPath: config.recordingPath,
  maximumRecordingHours: config.maximumRecordingHours,
  diskPausePercent: config.diskPausePercent,
  minimumFreeDiskGiB: config.minimumFreeDiskGiB,
};

const app = await buildServer({
  db,
  plannerPassword: config.plannerPassword,
  sessionKey,
  extractionEnabled: config.extractionEnabled,
  extractor,
  secureCookies: config.plannerOrigin.startsWith("https://"),
  ...(config.plannerOrigin ? { plannerOrigin: config.plannerOrigin } : {}),
  webtopAgentToken: config.webtopAgentToken,
  zoomSchedulerConfig,
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
    const expired = expireFailedSources(db);
    if (expired > 0) console.log(`Expired ${expired} retained source message(s)`);

    const created = scheduleZoomJobs(db, zoomSchedulerConfig);
    if (created > 0) console.log(`Scheduled ${created} Zoom job(s)`);

    const activeJob = getActiveRecordingJob(db);
    if (activeJob) {
      const { shouldStop, reason } = checkRecordingLimits(db, activeJob.id, zoomSchedulerConfig);
      if (shouldStop) {
        console.log(`Stopping recording for job ${activeJob.id}: ${reason}`);
      } else {
        const { shouldStop: diskStop, reason: diskReason } = await checkRecordingDiskSpace(zoomSchedulerConfig);
        if (diskStop) {
          console.log(`Stopping recording for job ${activeJob.id}: ${diskReason}`);
        }
      }
    }

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

// Daily encrypted backup tick. Runs only when BACKUP_PATH is configured.
if (config.backupPath) {
  const backupDestination = config.backupPath;
  const runBackupTick = async (): Promise<void> => {
    try {
      const result = backupDatabase(config.databasePath, backupDestination, config.backupEncryptionKeyFile);
      console.log(
        `Daily backup written: ${result.path} (${result.bytes} bytes; integrity: ${result.integrity}; encrypted: ${result.encrypted})`,
      );
    } catch {
      console.error("Daily backup tick failed");
    }
  };
  void runBackupTick();
  setInterval(() => { void runBackupTick(); }, 24 * 60 * 60 * 1000);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    clearInterval(reminderTimer);
    await app.close();
    db.close();
    process.exit(0);
  });
}
