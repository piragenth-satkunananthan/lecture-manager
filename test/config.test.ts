import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

const validEnv: NodeJS.ProcessEnv = {
  DATABASE_PATH: "./storage/planner.sqlite",
  RECORDING_PATH: "./storage/recordings",
  OPENROUTER_API_KEY: "test-openrouter-api-key",
  SMTP_HOST: "smtp.example.test",
  SMTP_FROM: "planner@example.test",
  WEBTOP_AGENT_TOKEN: "a-random-token-for-local-tests-0123456789",
};

test("loads design defaults and numeric limits", () => {
  const config = loadConfig(validEnv);
  assert.equal(config.timeZone, "Asia/Colombo");
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 3000);
  assert.equal(config.diskPausePercent, 80);
  assert.equal(config.minimumFreeDiskGiB, 10);
  assert.equal(config.maximumRecordingHours, 4);
});

test("requires database and recording paths", () => {
  assert.throws(() => loadConfig({ ...validEnv, DATABASE_PATH: " " }), /DATABASE_PATH is required/);
  assert.throws(() => loadConfig({ ...validEnv, RECORDING_PATH: undefined }), /RECORDING_PATH is required/);
  assert.throws(() => loadConfig({ ...validEnv, RECORDING_PATH: "/" }), /non-root filesystem path/);
  assert.throws(() => loadConfig({ ...validEnv, DATABASE_PATH: "same", RECORDING_PATH: "same" }), /must be different paths/);
  assert.throws(() => loadConfig({ ...validEnv, DATABASE_PATH: "bad\0path" }), /non-root filesystem path/);
});

test("rejects invalid timezone and numeric limits", () => {
  assert.throws(() => loadConfig({ ...validEnv, TIME_ZONE: "Mars/Olympus" }), /TIME_ZONE/);
  assert.throws(() => loadConfig({ ...validEnv, PORT: "65536" }), /PORT/);
  assert.throws(() => loadConfig({ ...validEnv, DISK_PAUSE_PERCENT: "100" }), /DISK_PAUSE_PERCENT/);
  assert.throws(() => loadConfig({ ...validEnv, MIN_FREE_DISK_GIB: "0" }), /MIN_FREE_DISK_GIB/);
});

test("requires an OpenRouter API key", () => {
  assert.throws(() => loadConfig({ ...validEnv, OPENROUTER_API_KEY: " " }), /OPENROUTER_API_KEY is required/);
  assert.equal(loadConfig(validEnv).openRouterApiKey, "test-openrouter-api-key");
});

test("normalizes and deduplicates configured IDs", () => {
  const config = loadConfig({
    ...validEnv,
    WHATSAPP_GROUP_IDS: " group-1, group-2,group-1 ",
    LECTURER_IDS: "lecturer-1, lecturer-1",
  });
  assert.deepEqual(config.whatsappGroupIds, ["group-1", "group-2"]);
  assert.deepEqual(config.lecturerIds, ["lecturer-1"]);
});

test("requires SMTP credentials as a pair", () => {
  assert.throws(() => loadConfig({ ...validEnv, SMTP_USER: "planner" }), /must be set together/);
  assert.throws(() => loadConfig({ ...validEnv, SMTP_PASSWORD: "secret" }), /must be set together/);
});

test("requires a sufficiently long worker token", () => {
  assert.throws(() => loadConfig({ ...validEnv, WEBTOP_AGENT_TOKEN: "short" }), /at least 32 characters/);
});
