import { parse, resolve } from "node:path";

export interface AppConfig {
  host: string;
  port: number;
  timeZone: string;
  databasePath: string;
  recordingPath: string;
  ollamaUrl: URL;
  ollamaModel: string;
  whatsappGroupIds: string[];
  lecturerIds: string[];
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  webtopAgentToken: string;
  diskPausePercent: number;
  minimumFreeDiskGiB: number;
  maximumRecordingHours: number;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function storagePath(env: NodeJS.ProcessEnv, name: string): string {
  const value = required(env, name);
  const absolutePath = resolve(value);
  if (value.includes("\0") || absolutePath === parse(absolutePath).root) {
    throw new Error(`${name} must be a non-root filesystem path`);
  }
  return value;
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim() || String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function positiveNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim() || String(fallback);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero`);
  return value;
}

function ids(env: NodeJS.ProcessEnv, name: string): string[] {
  return [...new Set((env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
}

function httpUrl(env: NodeJS.ProcessEnv, name: string, fallback: string): URL {
  let url: URL;
  try {
    url = new URL(env[name]?.trim() || fallback);
  } catch {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL`);
  }
  return url;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const timeZone = env.TIME_ZONE?.trim() || "Asia/Colombo";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw new Error("TIME_ZONE must be a supported IANA time zone");
  }

  const smtpUser = env.SMTP_USER?.trim() || "";
  const smtpPassword = env.SMTP_PASSWORD?.trim() || "";
  if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be set together");
  }
  const databasePath = storagePath(env, "DATABASE_PATH");
  const recordingPath = storagePath(env, "RECORDING_PATH");
  if (resolve(databasePath) === resolve(recordingPath)) {
    throw new Error("DATABASE_PATH and RECORDING_PATH must be different paths");
  }
  const webtopAgentToken = required(env, "WEBTOP_AGENT_TOKEN");
  if (webtopAgentToken.length < 32) {
    throw new Error("WEBTOP_AGENT_TOKEN must be at least 32 characters");
  }

  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port: integer(env, "PORT", 3000, 1, 65535),
    timeZone,
    databasePath,
    recordingPath,
    ollamaUrl: httpUrl(env, "OLLAMA_URL", "http://127.0.0.1:11434"),
    ollamaModel: required(env, "OLLAMA_MODEL"),
    whatsappGroupIds: ids(env, "WHATSAPP_GROUP_IDS"),
    lecturerIds: ids(env, "LECTURER_IDS"),
    smtpHost: required(env, "SMTP_HOST"),
    smtpPort: integer(env, "SMTP_PORT", 587, 1, 65535),
    smtpUser,
    smtpPassword,
    smtpFrom: required(env, "SMTP_FROM"),
    webtopAgentToken,
    diskPausePercent: integer(env, "DISK_PAUSE_PERCENT", 80, 1, 99),
    minimumFreeDiskGiB: positiveNumber(env, "MIN_FREE_DISK_GIB", 10),
    maximumRecordingHours: positiveNumber(env, "MAX_RECORDING_HOURS", 4),
  };
}
