import type { AppConfig } from "./config.js";
import { createNvidiaAnnouncementExtractor } from "./ai.js";
import type { ExtractionRunner } from "./extraction.js";

export function createConfiguredExtraction(config: AppConfig): ExtractionRunner | null {
  if (!config.extractionEnabled) return null;
  if (config.extractionProvider === "nvidia") {
    return createNvidiaAnnouncementExtractor({
      apiKey: config.nvidiaApiKey,
      model: config.nvidiaModel,
      timeZone: config.timeZone,
    });
  }
  if (config.extractionProvider === "openrouter") {
    throw new Error("OpenRouter extraction is not configured for production; use the NVIDIA provider");
  }
  return null;
}
