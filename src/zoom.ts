import type Database from "better-sqlite3";
import { statfs } from "node:fs/promises";
import {
  getPlannerItem,
  getZoomJob,
  createZoomJob,
  updateZoomJobState,
  expireZoomJobLeases,
  type ZoomJob,
  type ZoomJobState,
  type RecordingFileStatus,
  type PlannerItem,
} from "./db.js";
import { listPlannerItems } from "./planner.js";
import { sriLankaDateTimeToUtc } from "./time.js";

export const ZOOM_JOB_LEASE_SECONDS = 300; // 5 minutes
export const ZOOM_JOIN_EARLY_MINUTES = 5;
export const ZOOM_WAIT_MINUTES = 20;
export const ZOOM_MAX_RECORDING_HOURS = 4;
export const ZOOM_MAX_RECORDING_SECONDS = ZOOM_MAX_RECORDING_HOURS * 3600;

export interface ZoomSchedulerConfig {
  zoomAccountEmail: string;
  webtopAgentToken: string;
  plannerBaseUrl: string;
  recordingPath: string;
  maximumRecordingHours: number;
  diskPausePercent: number;
  minimumFreeDiskGiB: number;
}

export function buildScheduledStart(item: PlannerItem): string | null {
  if (item.kind !== "class" || !item.classDate || !item.classTime) return null;
  const joinTime = new Date(sriLankaDateTimeToUtc(item.classDate, item.classTime));
  joinTime.setUTCMinutes(joinTime.getUTCMinutes() - ZOOM_JOIN_EARLY_MINUTES);
  return joinTime.toISOString();
}

export function scheduleZoomJobs(
  db: Database.Database,
  config: ZoomSchedulerConfig,
  at = new Date().toISOString(),
): number {
  let created = 0;

  const items = listPlannerItems(db, { includeArchived: false });
  for (const item of items) {
    if (item.kind !== "class") continue;
    if (item.status !== "confirmed") continue;
    if (item.recordingPermission !== "confirmed") continue;
    if (!item.classDate || !item.classTime) continue;
    if (!item.zoomUrl) continue;

    const existing = getZoomJobByItem(db, item.id);
    if (existing) continue;

    const scheduledStart = buildScheduledStart(item);
    if (!scheduledStart) continue;

    createZoomJob(db, {
      itemId: item.id,
      scheduledStart,
      meetingLink: item.zoomUrl,
    }, at);
    created++;
  }

  return created;
}

export function getNextClaimableJob(
  db: Database.Database,
  agentId: string,
  at = new Date().toISOString(),
): ZoomJob | null {
  expireZoomJobLeases(db, at);

  const leaseExpiresAt = new Date(new Date(at).valueOf() + ZOOM_JOB_LEASE_SECONDS * 1000).toISOString();
  const job = db.prepare(`
    SELECT * FROM zoom_jobs
    WHERE state = 'queued'
      AND scheduled_start <= ?
    ORDER BY scheduled_start, id
    LIMIT 1
  `).get(at) as { id: number } | undefined;

  if (!job) return null;

  const claimed = updateZoomJobState(db, job.id, "claimed", {
    leaseOwner: agentId,
    leaseExpiresAt,
  }, at);

  return claimed;
}

export function heartbeatZoomJob(
  db: Database.Database,
  jobId: number,
  agentId: string,
  at = new Date().toISOString(),
): ZoomJob | null {
  const job = getZoomJob(db, jobId);
  if (!job) return null;
  if (job.leaseOwner !== agentId) return null;
  if (job.leaseExpiresAt && job.leaseExpiresAt <= at) return null;

  const newLeaseExpiresAt = new Date(new Date(at).valueOf() + ZOOM_JOB_LEASE_SECONDS * 1000).toISOString();
  return updateZoomJobState(db, jobId, job.state, { leaseExpiresAt: newLeaseExpiresAt }, at);
}

export function updateJobStatus(
  db: Database.Database,
  jobId: number,
  agentId: string,
  state: ZoomJobState,
  options: { admission?: boolean; recordingPath?: string; failureCode?: string; occurredAt?: string } = {},
  at = new Date().toISOString(),
): ZoomJob | null {
  const job = getZoomJob(db, jobId);
  if (!job) return null;
  if (job.leaseOwner !== agentId) return null;

  const validTransitions: Record<ZoomJobState, ZoomJobState[]> = {
    queued: ["claimed", "failed", "expired"],
    claimed: ["joining", "failed", "expired"],
    joining: ["waiting", "failed", "expired"],
    waiting: ["recording", "failed", "expired"],
    recording: ["completed", "failed"],
    completed: [],
    failed: [],
    expired: ["queued"],
  };

  if (!validTransitions[job.state].includes(state)) return null;

  const updates: { leaseOwner?: string; leaseExpiresAt?: string; failureCode?: string; meetingLink?: string } = {};
  if (state === "claimed" || state === "joining" || state === "waiting" || state === "recording") {
    updates.leaseExpiresAt = new Date(new Date(at).valueOf() + ZOOM_JOB_LEASE_SECONDS * 1000).toISOString();
  }
  if (state === "failed") updates.failureCode = options.failureCode ?? "unknown";
  if (state === "completed" && options.recordingPath) updates.meetingLink = options.recordingPath;

  return updateZoomJobState(db, jobId, state, updates, at);
}

export function getActiveRecordingJob(db: Database.Database): ZoomJob | null {
  const job = db.prepare(`
    SELECT * FROM zoom_jobs
    WHERE state = 'recording'
    ORDER BY scheduled_start
    LIMIT 1
  `).get() as { id: number } | undefined;
  if (!job) return null;
  return getZoomJob(db, job.id);
}

export function checkRecordingLimits(
  db: Database.Database,
  jobId: number,
  config: ZoomSchedulerConfig,
  at = new Date().toISOString(),
): { shouldStop: boolean; reason: string | null } {
  const job = getZoomJob(db, jobId);
  if (!job || job.state !== "recording") return { shouldStop: false, reason: null };

  const startTime = new Date(at);
  // Use updatedAt (set when transitioning to "recording") as the recording start time.
  const recordingStart = new Date(job.updatedAt);
  const elapsedSeconds = (startTime.valueOf() - recordingStart.valueOf()) / 1000;

  if (elapsedSeconds >= config.maximumRecordingHours * 3600) {
    return { shouldStop: true, reason: `maximum_recording_hours_exceeded (${config.maximumRecordingHours}h)` };
  }

  return { shouldStop: false, reason: null };
}

export async function checkRecordingDiskSpace(
  config: ZoomSchedulerConfig,
): Promise<{ shouldStop: boolean; reason: string | null }> {
  try {
    const stats = await statfs(config.recordingPath);
    const freeGiB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
    if (freeGiB < config.minimumFreeDiskGiB) {
      return { shouldStop: true, reason: `low_disk_space (${freeGiB.toFixed(2)} GiB free, minimum ${config.minimumFreeDiskGiB} GiB)` };
    }
  } catch {
    // If we can't check disk space, don't stop recording
  }
  return { shouldStop: false, reason: null };
}

function getZoomJobByItem(db: Database.Database, itemId: number) {
  const row = db.prepare("SELECT * FROM zoom_jobs WHERE item_id = ?").get(itemId) as {
    id: number;
    item_id: number;
    lease_id: string;
    lease_owner: string | null;
    lease_expires_at: string | null;
    state: ZoomJobState;
    meeting_link: string | null;
    scheduled_start: string;
    failure_code: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    itemId: row.item_id,
    leaseId: row.lease_id,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    state: row.state,
    meetingLink: row.meeting_link,
    scheduledStart: row.scheduled_start,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { expireZoomJobLeases };