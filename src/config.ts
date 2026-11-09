import { parse, resolve } from "node:path";

export interface AppConfig {
  host: string;
  port: number;
  timeZone: string;
  databasePath: string;
  recordingPath: string;
  openRouterApiKey: string;
  nvidiaApiKey: string;
  nvidiaModel: string;
  extractionProvider: "disabled" | "openrouter" | "nvidia";
  extractionEnabled: boolean;
  plannerPassword: string;
  sessionKeyFile: string;
  plannerOrigin: string;
  whatsappGroupIds: string[];
  lecturerIds: string[];
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpTo: string;
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

  const extractionProvider = env.EXTRACTION_PROVIDER?.trim() || "disabled";
  if (extractionProvider !== "disabled" && extractionProvider !== "openrouter" && extractionProvider !== "nvidia") {
    throw new Error("EXTRACTION_PROVIDER must be disabled, openrouter, or nvidia");
  }
  const extractionEnabled = (env.EXTRACTION_ENABLED?.trim() || "false") === "true";
  if (extractionEnabled && extractionProvider === "disabled") {
    throw new Error("EXTRACTION_ENABLED requires EXTRACTION_PROVIDER to be openrouter or nvidia");
  }
  const nvidiaApiKey = env.NVIDIA_API_KEY?.trim() || "";
  const nvidiaModel = env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b";
  if (extractionEnabled && extractionProvider === "nvidia" && !nvidiaApiKey) {
    throw new Error("NVIDIA_API_KEY is required when EXTRACTION_PROVIDER=nvidia and extraction is enabled");
  }

  const plannerPassword = env.PLANNER_PASSWORD?.trim() || "";
  const sessionKeyFile = env.SESSION_KEY_FILE?.trim() || "./storage/session.key";
  const plannerOrigin = env.PLANNER_ORIGIN?.trim() || "";
  if (plannerOrigin) {
    try {
      const url = new URL(plannerOrigin);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
    } catch {
      throw new Error("PLANNER_ORIGIN must be an absolute http(s) URL");
    }
  }

  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port: integer(env, "PORT", 3000, 1, 65535),
    timeZone,
    databasePath,
    recordingPath,
    openRouterApiKey: required(env, "OPENROUTER_API_KEY"),
    nvidiaApiKey,
    nvidiaModel,
    extractionProvider,
    extractionEnabled,
    plannerPassword,
    sessionKeyFile,
    plannerOrigin,
    whatsappGroupIds: ids(env, "WHATSAPP_GROUP_IDS"),
    lecturerIds: ids(env, "LECTURER_IDS"),
    smtpHost: required(env, "SMTP_HOST"),
    smtpPort: integer(env, "SMTP_PORT", 587, 1, 65535),
    smtpUser,
    smtpPassword,
    smtpFrom: required(env, "SMTP_FROM"),
    smtpTo: env.SMTP_TO?.trim() || required(env, "SMTP_FROM"),
    webtopAgentToken,
    diskPausePercent: integer(env, "DISK_PAUSE_PERCENT", 80, 1, 99),
    minimumFreeDiskGiB: positiveNumber(env, "MIN_FREE_DISK_GIB", 10),
    maximumRecordingHours: positiveNumber(env, "MAX_RECORDING_HOURS", 4),
  };
}
