import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlannerItem,
  getPlannerItem,
  insertSourceMessage,
  openPlannerDatabase,
  type NewPlannerItem,
} from "../src/db.js";
import {
  scheduleZoomJobs,
  getNextClaimableJob,
  heartbeatZoomJob,
  updateJobStatus,
  getActiveRecordingJob,
  checkRecordingLimits,
  expireZoomJobLeases,
  buildScheduledStart,
  ZOOM_JOIN_EARLY_MINUTES,
  ZOOM_WAIT_MINUTES,
} from "../src/zoom.js";
import { confirmPlannerItem } from "../src/planner.js";
import type { PlannerItem } from "../src/db.js";

const baseItem: Omit<NewPlannerItem, "sourceGroupId" | "sourceMessageId"> = {
  kind: "class",
  title: "Data Structures lecture",
  details: "Zoom class",
  course: "Data Structures",
  location: null,
  dueDate: null,
  dueTime: null,
  classDate: "2026-11-10",
  classTime: "14:00",
  changeType: null,
  changeDetails: null,
  zoomUrl: "https://zoom.us/j/123456789",
  ambiguousFields: [],
  fieldEvidence: {
    kind: [{ quote: "class" }],
    title: [{ quote: "Data Structures lecture" }],
    class_date: [{ quote: "2026-11-10" }],
    class_time: [{ quote: "14:00" }],
  },
  recordingPermission: "confirmed",
  permissionConfirmedBy: "planner-user",
  permissionConfirmedAt: "2026-11-07T03:30:00.000Z",
};

function seed(
  db: ReturnType<typeof openPlannerDatabase>,
  messageId: string,
  overrides: Partial<NewPlannerItem> = {},
): number {
  insertSourceMessage(db, {
    groupId: "group-1",
    messageId,
    senderId: "lecturer-1",
    sentAt: "2026-11-07T03:30:00.000Z",
    rawText: "synthetic source text",
  });
  return createPlannerItem(db, {
    ...baseItem,
    sourceGroupId: "group-1",
    sourceMessageId: messageId,
    ...overrides,
  });
}

function zoomConfig() {
  return {
    zoomAccountEmail: "user@example.com",
    webtopAgentToken: "test-token-0123456789abcdef0123456789abcdef",
    plannerBaseUrl: "http://localhost:3000",
    recordingPath: "/tmp/test-recordings",
    maximumRecordingHours: 4,
    diskPausePercent: 80,
    minimumFreeDiskGiB: 10,
  };
}

test("buildScheduledStart returns class time minus 5 minutes", () => {
  const item = { ...baseItem, classDate: "2026-11-10", classTime: "14:00" } as unknown as PlannerItem;
  const start = buildScheduledStart(item);
  assert.equal(start, "2026-11-10T08:25:00.000Z");
});

test("buildScheduledStart returns null for non-class items", () => {
  const item = { ...baseItem, kind: "assignment" as const, classDate: null, classTime: null } as unknown as PlannerItem;
  assert.equal(buildScheduledStart(item), null);
});

test("scheduleZoomJobs creates a job for confirmed class with permission", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-1");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    const created = scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");
    assert.equal(created, 1);

    const item = getPlannerItem(db, itemId)!;
    // Job should exist for this item
    const row = db.prepare("SELECT * FROM zoom_jobs WHERE item_id = ?").get(itemId) as { state: string } | undefined;
    assert.ok(row, "Zoom job should exist");
    assert.equal(row.state, "queued");
  } finally {
    db.close();
  }
});

test("scheduleZoomJobs does not create duplicate jobs", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-2");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");
    const createdAgain = scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");
    assert.equal(createdAgain, 0);
  } finally {
    db.close();
  }
});

test("scheduleZoomJobs skips items without recording permission", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-3", {
      recordingPermission: null,
      permissionConfirmedBy: null,
      permissionConfirmedAt: null,
    });
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    const created = scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");
    assert.equal(created, 0);
  } finally {
    db.close();
  }
});

test("scheduleZoomJobs skips unconfirmed items", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-4");
    // Not confirmed - status stays "pending"
    const created = scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");
    assert.equal(created, 0);
  } finally {
    db.close();
  }
});

test("getNextClaimableJob claims a queued job", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-5");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const job = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(job, "Should claim a job");
    assert.equal(job.state, "claimed");
    assert.equal(job.leaseOwner, "agent-1");
  } finally {
    db.close();
  }
});

test("getNextClaimableJob returns null when no jobs are due", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-6");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    // Class is at 14:00, scheduled start is 08:55. Query before that time.
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const job = getNextClaimableJob(db, "agent-1", "2026-11-09T00:00:00.000Z");
    assert.equal(job, null);
  } finally {
    db.close();
  }
});

test("heartbeatZoomJob extends lease for the owning agent", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-7");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);
    const originalExpiry = claimed.leaseExpiresAt;

    const heartbeat = heartbeatZoomJob(db, claimed.id, "agent-1", "2026-11-10T08:51:00.000Z");
    assert.ok(heartbeat);
    assert.notEqual(heartbeat.leaseExpiresAt, originalExpiry);
    assert.equal(heartbeat.leaseOwner, "agent-1");
  } finally {
    db.close();
  }
});

test("heartbeatZoomJob rejects different agent", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-8");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);
    const result = heartbeatZoomJob(db, claimed.id, "agent-2", "2026-11-10T08:51:00.000Z");
    assert.equal(result, null);
  } finally {
    db.close();
  }
});

test("updateJobStatus transitions queued -> claimed -> joining -> waiting -> recording -> completed", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-9");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);

    const joining = updateJobStatus(db, claimed.id, "agent-1", "joining", {}, "2026-11-10T08:52:00.000Z");
    assert.ok(joining);
    assert.equal(joining.state, "joining");

    const waiting = updateJobStatus(db, claimed.id, "agent-1", "waiting", { admission: true }, "2026-11-10T08:54:00.000Z");
    assert.ok(waiting);
    assert.equal(waiting.state, "waiting");

    const recording = updateJobStatus(db, claimed.id, "agent-1", "recording", {}, "2026-11-10T09:00:00.000Z");
    assert.ok(recording);
    assert.equal(recording.state, "recording");

    const completed = updateJobStatus(db, claimed.id, "agent-1", "completed", { recordingPath: "/data/recordings/class.mp4" }, "2026-11-10T10:00:00.000Z");
    assert.ok(completed);
    assert.equal(completed.state, "completed");
  } finally {
    db.close();
  }
});

test("updateJobStatus rejects invalid transitions", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-10");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);

    // Cannot go directly from claimed to completed
    const result = updateJobStatus(db, claimed.id, "agent-1", "completed", {}, "2026-11-10T09:00:00.000Z");
    assert.equal(result, null);
  } finally {
    db.close();
  }
});

test("expireZoomJobLeases expires leases past their expiry", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-11");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);

    // Advance time past lease expiry (5 minutes)
    const expired = expireZoomJobLeases(db, "2026-11-10T08:56:00.000Z");
    assert.equal(expired, 1);

    const job = db.prepare("SELECT state FROM zoom_jobs WHERE id = ?").get(claimed.id) as { state: string };
    assert.equal(job.state, "expired");
  } finally {
    db.close();
  }
});

test("getActiveRecordingJob returns the job in recording state", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-12");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);
    updateJobStatus(db, claimed.id, "agent-1", "joining", {}, "2026-11-10T08:52:00.000Z");
    updateJobStatus(db, claimed.id, "agent-1", "waiting", { admission: true }, "2026-11-10T08:54:00.000Z");
    const recording = updateJobStatus(db, claimed.id, "agent-1", "recording", {}, "2026-11-10T09:00:00.000Z");
    assert.ok(recording);

    const active = getActiveRecordingJob(db);
    assert.ok(active);
    assert.equal(active.state, "recording");
  } finally {
    db.close();
  }
});

test("checkRecordingLimits returns shouldStop after maximum recording hours", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-13");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);
    updateJobStatus(db, claimed.id, "agent-1", "joining", {}, "2026-11-10T08:52:00.000Z");
    updateJobStatus(db, claimed.id, "agent-1", "waiting", { admission: true }, "2026-11-10T08:54:00.000Z");
    updateJobStatus(db, claimed.id, "agent-1", "recording", {}, "2026-11-10T09:00:00.000Z");

    // 4 hours after recording start
    const result = checkRecordingLimits(db, claimed.id, zoomConfig(), "2026-11-10T13:00:00.000Z");
    assert.equal(result.shouldStop, true);
    assert.ok(result.reason!.includes("maximum_recording_hours_exceeded"));
  } finally {
    db.close();
  }
});

test("checkRecordingLimits returns shouldStop false before maximum recording hours", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-14");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    scheduleZoomJobs(db, zoomConfig(), "2026-11-07T03:30:00.000Z");

    const claimed = getNextClaimableJob(db, "agent-1", "2026-11-10T08:50:00.000Z");
    assert.ok(claimed);
    updateJobStatus(db, claimed.id, "agent-1", "recording", {}, "2026-11-10T09:00:00.000Z");

    // 2 hours after recording start
    const result = checkRecordingLimits(db, claimed.id, zoomConfig(), "2026-11-10T11:00:00.000Z");
    assert.equal(result.shouldStop, false);
    assert.equal(result.reason, null);
  } finally {
    db.close();
  }
});

test("ZOOM_JOIN_EARLY_MINUTES is 5 and ZOOM_WAIT_MINUTES is 20", () => {
  assert.equal(ZOOM_JOIN_EARLY_MINUTES, 5);
  assert.equal(ZOOM_WAIT_MINUTES, 20);
});
