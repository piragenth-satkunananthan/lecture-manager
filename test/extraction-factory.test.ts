import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { createConfiguredExtraction } from "../src/extraction-factory.js";

const validEnv: NodeJS.ProcessEnv = {
  DATABASE_PATH: "./storage/planner.sqlite",
  RECORDING_PATH: "./storage/recordings",
  OPENROUTER_API_KEY: "test-openrouter-api-key",
  SMTP_HOST: "smtp.example.test",
  SMTP_FROM: "planner@example.test",
  WEBTOP_AGENT_TOKEN: "a-random-token-for-local-tests-0123456789",
};

test("returns no extractor while extraction is disabled", () => {
  const config = loadConfig(validEnv);
  assert.equal(createConfiguredExtraction(config), null);
});

test("builds the configured NVIDIA extractor with the pinned model", () => {
  const config = loadConfig({
    ...validEnv,
    EXTRACTION_ENABLED: "true",
    EXTRACTION_PROVIDER: "nvidia",
    NVIDIA_API_KEY: "test-nvidia-key",
    NVIDIA_MODEL: "nvidia/nemotron-3-ultra-550b-a55b",
  });
  const extractor = createConfiguredExtraction(config);
  assert.equal(typeof extractor, "function");
});

test("rejects the OpenRouter provider until a model is configured", () => {
  const config = loadConfig({
    ...validEnv,
    EXTRACTION_ENABLED: "true",
    EXTRACTION_PROVIDER: "openrouter",
  });
  assert.throws(() => createConfiguredExtraction(config), /OpenRouter extraction is not configured/);
});
