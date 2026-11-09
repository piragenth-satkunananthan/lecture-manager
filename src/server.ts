import { timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import Fastify, { type FastifyInstance } from "fastify";
import secureSession from "@fastify/secure-session";
import { getClarification, getPlannerItem, updatePlannerItem } from "./db.js";
import {
  applyUserCorrection,
  archivePlannerItem,
  cancelPlannerItem,
  clearUserCorrection,
  confirmPlannerItem,
  listPlannerItems,
  resolveClarification,
  type EditableField,
} from "./planner.js";

export interface ServerOptions {
  db: Database.Database;
  plannerPassword: string;
  sessionKey: Buffer;
  plannerOrigin?: string;
  extractionEnabled?: boolean;
  secureCookies?: boolean;
}

interface AuthenticatedSession {
  get(key: "authenticated"): boolean | undefined;
  set(key: "authenticated", value: boolean): void;
  delete(): void;
}

const editableFields = new Set<EditableField>([
  "title",
  "details",
  "course",
  "location",
  "dueDate",
  "dueTime",
  "classDate",
  "classTime",
  "changeType",
  "changeDetails",
]);

function isEditableField(value: string): value is EditableField {
  return editableFields.has(value as EditableField);
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCorrections(value: unknown): Partial<Record<EditableField, string | null>> | null {
  const record = asRecord(value);
  if (!record) return null;
  const corrections: Partial<Record<EditableField, string | null>> = {};
  for (const [field, raw] of Object.entries(record)) {
    if (!isEditableField(field)) return null;
    if (raw !== null && typeof raw !== "string") return null;
    if (field === "changeType" && raw !== null && raw !== "cancelled" && raw !== "rescheduled") return null;
    corrections[field] = raw;
  }
  return corrections;
}

export async function buildServer(options: ServerOptions): Promise<FastifyInstance> {
  if (!options.plannerPassword) throw new Error("PLANNER_PASSWORD is required");
  if (options.sessionKey.length !== 32) throw new Error("Session key must be exactly 32 bytes");

  const app = Fastify({ logger: false });
  const db = options.db;

  await app.register(secureSession, {
    key: options.sessionKey,
    cookieName: "session",
    cookie: {
      path: "/",
      httpOnly: true,
      secure: options.secureCookies ?? true,
      sameSite: "strict",
      maxAge: 6 * 60 * 60,
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!options.plannerOrigin) return;
    if (!request.url.startsWith("/api/")) return;
    if (!["POST", "PATCH", "DELETE"].includes(request.method)) return;
    if (request.headers.origin !== options.plannerOrigin) {
      return reply.code(403).send({ error: "invalid_origin" });
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    const path = request.url.split("?")[0];
    if (path === "/api/session" || path === "/api/health") return;
    const session = request.session as unknown as AuthenticatedSession;
    if (session.get("authenticated") !== true) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.setErrorHandler((_error, _request, reply) => {
    return reply.code(500).send({ error: "internal_error" });
  });

  app.get("/api/health", async () => {
    db.prepare("SELECT 1 AS ok").get();
    return { status: "ok", extractionEnabled: options.extractionEnabled ?? false };
  });

  app.post<{ Body: unknown }>("/api/session", async (request, reply) => {
    const body = asRecord(request.body);
    if (!body || typeof body.password !== "string") {
      return reply.code(400).send({ error: "password_required" });
    }
    if (!safeEqual(body.password, options.plannerPassword)) {
      return reply.code(401).send({ error: "invalid_password" });
    }
    const session = request.session as unknown as AuthenticatedSession;
    session.set("authenticated", true);
    return { ok: true };
  });

  app.delete("/api/session", async (_request, reply) => {
    _request.session.delete();
    return reply.code(204).send();
  });

  app.get<{ Querystring: { includeArchived?: string } }>("/api/items", async (request) => ({
    items: listPlannerItems(db, { includeArchived: request.query.includeArchived === "true" }),
  }));

  app.get<{ Params: { id: string } }>("/api/items/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) return reply.code(400).send({ error: "invalid_id" });
    const item = getPlannerItem(db, id);
    if (!item) return reply.code(404).send({ error: "not_found" });
    return { item };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/items/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) return reply.code(400).send({ error: "invalid_id" });
    if (!getPlannerItem(db, id)) return reply.code(404).send({ error: "not_found" });

    const body = asRecord(request.body);
    if (!body) return reply.code(400).send({ error: "invalid_body" });

    try {
      const corrections = body.corrections === undefined ? undefined : parseCorrections(body.corrections);
      if (body.corrections !== undefined && corrections === null) {
        return reply.code(400).send({ error: "invalid_corrections" });
      }
      for (const [field, value] of Object.entries(corrections ?? {})) {
        applyUserCorrection(db, id, field as EditableField, value);
      }

      if (body.clearCorrections !== undefined) {
        if (!Array.isArray(body.clearCorrections) || body.clearCorrections.some((field) => typeof field !== "string" || !isEditableField(field))) {
          return reply.code(400).send({ error: "invalid_clear_corrections" });
        }
        for (const field of body.clearCorrections as EditableField[]) {
          clearUserCorrection(db, id, field);
        }
      }

      if (body.status !== undefined) {
        if (body.status === "cancelled") cancelPlannerItem(db, id);
        else if (body.status === "archived") archivePlannerItem(db, id);
        else if (body.status === "confirmed") confirmPlannerItem(db, id);
        else return reply.code(400).send({ error: "invalid_status" });
      }
    } catch {
      return reply.code(400).send({ error: "invalid_update" });
    }

    return { item: getPlannerItem(db, id) };
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/api/items/:id/recording-permission", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) return reply.code(400).send({ error: "invalid_id" });
    if (!getPlannerItem(db, id)) return reply.code(404).send({ error: "not_found" });
    const body = asRecord(request.body);
    if (!body || (body.decision !== "confirmed" && body.decision !== "declined")) {
      return reply.code(400).send({ error: "invalid_decision" });
    }
    const item = updatePlannerItem(db, id, {
      recordingPermission: body.decision,
      permissionConfirmedBy: "planner-user",
      permissionConfirmedAt: new Date().toISOString(),
    });
    return { item };
  });

  app.get("/api/clarifications", async () => {
    const rows = db.prepare(
      "SELECT id, item_id, question, requested_fields, created_at FROM clarifications WHERE state = 'open' ORDER BY created_at",
    ).all() as Array<{
      id: number;
      item_id: number;
      question: string;
      requested_fields: string;
      created_at: string;
    }>;
    return {
      clarifications: rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        question: row.question,
        requestedFields: JSON.parse(row.requested_fields) as string[],
        createdAt: row.created_at,
      })),
    };
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/api/clarifications/:id/answer", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) return reply.code(400).send({ error: "invalid_id" });
    const clarification = getClarification(db, id);
    if (!clarification) return reply.code(404).send({ error: "not_found" });
    if (clarification.state !== "open") return reply.code(409).send({ error: "clarification_not_open" });

    const body = asRecord(request.body);
    if (!body || typeof body.answer !== "string" || !body.answer.trim()) {
      return reply.code(400).send({ error: "answer_required" });
    }
    const updates = body.updates === undefined ? {} : parseCorrections(body.updates);
    if (updates === null) return reply.code(400).send({ error: "invalid_updates" });

    try {
      const result = resolveClarification(db, id, body.answer, updates);
      return { clarification: result.clarification, item: result.item };
    } catch {
      return reply.code(409).send({ error: "clarification_update_failed" });
    }
  });

  return app;
}
