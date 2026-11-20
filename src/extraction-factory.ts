import type { AppConfig } from "./config.js";
import { createNvidiaAnnouncementExtractor, createOpenRouterAnnouncementExtractor, type OpenRouterConfig } from "./ai.js";
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
    if (!config.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required when EXTRACTION_PROVIDER=openrouter and extraction is enabled");
    }
    if (!config.openRouterModel) {
      throw new Error("OPENROUTER_MODEL is required when EXTRACTION_PROVIDER=openrouter and extraction is enabled");
    }
    const openRouterConfig: OpenRouterConfig = {
      apiKey: config.openRouterApiKey,
      model: config.openRouterModel,
      timeZone: config.timeZone,
    };
    return createOpenRouterAnnouncementExtractor(openRouterConfig);
  }
  return null;
}
