import assert from "node:assert/strict";
import test from "node:test";
import {
  createClarification,
  createPlannerItem,
  insertSourceMessage,
  openPlannerDatabase,
  type NewPlannerItem,
} from "../src/db.js";
import { buildServer, type ServerOptions } from "../src/server.js";

const sessionKey = Buffer.alloc(32, 7);
const password = "correct horse battery staple";

const baseItem: Omit<NewPlannerItem, "sourceGroupId" | "sourceMessageId"> = {
  kind: "assignment",
  title: "Data Structures assignment 2",
  details: "submit",
  course: "Data Structures",
  location: null,
  dueDate: "2026-11-10",
  dueTime: null,
  classDate: null,
  classTime: null,
  changeType: null,
  changeDetails: null,
  zoomUrl: null,
  ambiguousFields: [],
  fieldEvidence: { kind: [{ quote: "assignment" }] },
};

function seedItem(
  db: ReturnType<typeof openPlannerDatabase>,
  messageId = "message-1",
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

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") throw new Error("expected a session cookie");
  return value.split(";")[0]!;
}

async function login(app: Awaited<ReturnType<typeof buildServer>>, origin?: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: { password },
    ...(origin ? { headers: { origin } } : {}),
  });
  assert.equal(response.statusCode, 200);
  return cookieFrom(response);
}

async function makeApp(
  db: ReturnType<typeof openPlannerDatabase>,
  overrides: Partial<ServerOptions> = {},
): Promise<Awaited<ReturnType<typeof buildServer>>> {
  const app = await buildServer({
    db,
    plannerPassword: password,
    sessionKey,
    secureCookies: false,
    extractionEnabled: false,
    ...overrides,
  });
  await app.ready();
  return app;
}

test("health is public and reports extraction state", async () => {
  const db = openPlannerDatabase(":memory:");
  const app = await makeApp(db);
  try {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok", extractionEnabled: false });
  } finally {
    await app.close();
    db.close();
  }
});

test("requires a session for planner routes and accepts the configured password", async () => {
  const db = openPlannerDatabase(":memory:");
  const app = await makeApp(db);
  try {
    seedItem(db);
    const unauthorized = await app.inject({ method: "GET", url: "/api/items" });
    assert.equal(unauthorized.statusCode, 401);

    const wrong = await app.inject({
      method: "POST",
      url: "/api/session",
      payload: { password: "wrong" },
    });
    assert.equal(wrong.statusCode, 401);

    const cookie = await login(app);
    const items = await app.inject({ method: "GET", url: "/api/items", headers: { cookie } });
    assert.equal(items.statusCode, 200);
    assert.equal((items.json() as { items: unknown[] }).items.length, 1);

    const logout = await app.inject({ method: "DELETE", url: "/api/session", headers: { cookie } });
    assert.equal(logout.statusCode, 204);
  } finally {
    await app.close();
    db.close();
  }
});

test("applies user corrections and archives items through the API", async () => {
  const db = openPlannerDatabase(":memory:");
  const app = await makeApp(db);
  try {
    const itemId = seedItem(db);
    const cookie = await login(app);

    const corrected = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie },
      payload: { corrections: { title: "User title" } },
    });
    assert.equal(corrected.statusCode, 200);
    assert.equal((corrected.json() as { item: { title: string } }).item.title, "User title");

    const invalid = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie },
      payload: { corrections: { notAField: "x" } },
    });
    assert.equal(invalid.statusCode, 400);

    const archived = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie },
      payload: { status: "archived" },
    });
    assert.equal(archived.statusCode, 200);
    assert.equal((archived.json() as { item: { status: string } }).item.status, "archived");

    const defaultView = await app.inject({ method: "GET", url: "/api/items", headers: { cookie } });
    assert.equal((defaultView.json() as { items: unknown[] }).items.length, 0);
  } finally {
    await app.close();
    db.close();
  }
});

test("lists and resolves clarifications through the API", async () => {
  const db = openPlannerDatabase(":memory:");
  const app = await makeApp(db);
  try {
    const itemId = seedItem(db, "class-1", {
      kind: "class",
      title: "Online lecture",
      classDate: "2026-11-10",
      classTime: null,
      dueDate: null,
      dueTime: null,
    });
    const clarificationId = createClarification(db, itemId, {
      question: "What time does the class start?",
      requestedFields: ["classTime"],
    });
    const cookie = await login(app);

    const listed = await app.inject({ method: "GET", url: "/api/clarifications", headers: { cookie } });
    assert.equal(listed.statusCode, 200);
    assert.equal((listed.json() as { clarifications: unknown[] }).clarifications.length, 1);

    const answered = await app.inject({
      method: "POST",
      url: `/api/clarifications/${clarificationId}/answer`,
      headers: { cookie },
      payload: { answer: "2 PM", updates: { classTime: "14:00" } },
    });
    assert.equal(answered.statusCode, 200);
    const body = answered.json() as { item: { classTime: string; status: string } };
    assert.equal(body.item.classTime, "14:00");
    assert.equal(body.item.status, "confirmed");

    const again = await app.inject({
      method: "POST",
      url: `/api/clarifications/${clarificationId}/answer`,
      headers: { cookie },
      payload: { answer: "3 PM" },
    });
    assert.equal(again.statusCode, 409);
  } finally {
    await app.close();
    db.close();
  }
});

test("sets recording permission and rejects invalid decisions", async () => {
  const db = openPlannerDatabase(":memory:");
  const app = await makeApp(db);
  try {
    const itemId = seedItem(db, "class-1", {
      kind: "class",
      title: "Online lecture",
      classDate: "2026-11-10",
      classTime: "14:00",
      dueDate: null,
      dueTime: null,
    });
    const cookie = await login(app);

    const confirmed = await app.inject({
      method: "POST",
      url: `/api/items/${itemId}/recording-permission`,
      headers: { cookie },
      payload: { decision: "confirmed" },
    });
    assert.equal(confirmed.statusCode, 200);
    const body = confirmed.json() as { item: { recordingPermission: string; permissionConfirmedBy: string } };
    assert.equal(body.item.recordingPermission, "confirmed");
    assert.equal(body.item.permissionConfirmedBy, "planner-user");

    const invalid = await app.inject({
      method: "POST",
      url: `/api/items/${itemId}/recording-permission`,
      headers: { cookie },
      payload: { decision: "maybe" },
    });
    assert.equal(invalid.statusCode, 400);
  } finally {
    await app.close();
    db.close();
  }
});

test("enforces the configured origin on state-changing routes", async () => {
  const db = openPlannerDatabase(":memory:");
  const origin = "https://planner.test";
  const app = await makeApp(db, { plannerOrigin: origin });
  try {
    const noOrigin = await app.inject({
      method: "POST",
      url: "/api/session",
      payload: { password },
    });
    assert.equal(noOrigin.statusCode, 403);

    const cookie = await login(app, origin);
    const itemId = seedItem(db);
    const wrongOrigin = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie, origin: "https://evil.test" },
      payload: { corrections: { title: "x" } },
    });
    assert.equal(wrongOrigin.statusCode, 403);

    const rightOrigin = await app.inject({
      method: "PATCH",
      url: `/api/items/${itemId}`,
      headers: { cookie, origin },
      payload: { corrections: { title: "x" } },
    });
    assert.equal(rightOrigin.statusCode, 200);
  } finally {
    await app.close();
    db.close();
  }
});
