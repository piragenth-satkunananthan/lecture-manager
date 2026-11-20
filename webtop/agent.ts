import { spawn, ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captureScreenAudio } from "./capture.js";
import { waitForAdmission, waitForMeetingEnd, ZoomUIError } from "./zoom-ui.js";

interface PlannerConfig {
  plannerBaseUrl: string;
  webtopAgentToken: string;
  agentId: string;
  zoomAccountEmail: string;
  recordingPath: string;
  maximumRecordingHours: number;
}

interface Job {
  jobId: number;
  itemId: number;
  leaseId: string;
  meetingLink: string;
  scheduledStart: string;
  leaseExpiresAt: string;
  item: {
    id: number;
    title: string;
    classDate: string | null;
    classTime: string | null;
    zoomUrl: string | null;
  };
}

interface HealthCheck {
  state: "ready" | "unhealthy";
  account_email: string;
  display_available: boolean;
  audio_source_available: boolean;
}

class ZoomAgent {
  private config: PlannerConfig;
  private currentJob: Job | null = null;
  private captureProcess: ChildProcess | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private zoomProcess: ChildProcess | null = null;
  private meetingEnded = false;

  constructor(config: PlannerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    console.log(`[Agent ${this.config.agentId}] Starting Zoom agent...`);

    // Verify display and audio
    const displayOk = await this.checkDisplay();
    const audioOk = await this.checkAudio();

    const health: HealthCheck = {
      state: displayOk && audioOk ? "ready" : "unhealthy",
      account_email: this.config.zoomAccountEmail,
      display_available: displayOk,
      audio_source_available: audioOk,
    };

    console.log(`[Agent ${this.config.agentId}] Health:`, health);

    if (health.state !== "ready") {
      console.error(`[Agent ${this.config.agentId}] Health check failed, not accepting jobs`);
      // Still report health so planner knows
      await this.reportHealth(health);
      return;
    }

    await this.reportHealth(health);

    // Main loop: claim jobs
    while (true) {
      try {
        await this.claimAndRunJob();
      } catch (error) {
        console.error(`[Agent ${this.config.agentId}] Job loop error:`, error);
        await this.sleep(10000); // Back off before retry
      }
    }
  }

  private async checkDisplay(): Promise<boolean> {
    try {
      // Check if X11 display is available
      const result = await this.runCommand("xdpyinfo", ["-display", process.env.DISPLAY || ":0"]);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  private async checkAudio(): Promise<boolean> {
    try {
      // Check if PulseAudio source is available
      const result = await this.runCommand("pactl", ["info"]);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  async reportHealth(health: HealthCheck): Promise<void> {
    try {
      const response = await globalThis.fetch(`${this.config.plannerBaseUrl}/agent/health`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.webtopAgentToken}`,
        },
        body: JSON.stringify(health),
      });
      if (!response.ok) {
        console.error("Health report failed:", response.status);
      }
    } catch (error) {
      console.error("Failed to report health:", error);
    }
  }

  private async claimAndRunJob(): Promise<void> {
    // Only claim if no current job
    if (this.currentJob) return;

    const job = await this.claimJob();
    if (!job) {
      await this.sleep(30000); // No jobs available, wait before retry
      return;
    }

    this.currentJob = job;
    console.log(`[Agent ${this.config.agentId}] Claimed job ${job.jobId} for item ${job.itemId}`);

    try {
      await this.runJob(job);
    } finally {
      this.currentJob = null;
      this.cleanup();
    }
  }

  private async claimJob(): Promise<Job | null> {
    try {
      const response = await globalThis.fetch(`${this.config.plannerBaseUrl}/agent/jobs/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.webtopAgentToken}`,
          "X-Agent-Id": this.config.agentId,
        },
        body: JSON.stringify({}),
      });

      if (response.status === 204) return null; // No jobs
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(`Claim failed: ${response.status} ${err.error || ""}`);
      }

      return await response.json() as Job;
    } catch (error) {
      console.error("Claim job error:", error);
      return null;
    }
  }

  private async runJob(job: Job): Promise<void> {
    const leaseExpiresAt = new Date(job.leaseExpiresAt).valueOf();
    const scheduledStart = new Date(job.scheduledStart).valueOf();
    const now = Date.now();

    // Wait until scheduled start (5 minutes early)
    const waitUntilStart = scheduledStart - now;
    if (waitUntilStart > 0) {
      console.log(`[Agent ${this.config.agentId}] Waiting ${Math.round(waitUntilStart / 1000)}s until scheduled start`);
      await this.sleep(waitUntilStart);
    }

    // State: joining
    await this.updateJobStatus(job.jobId, "joining");

    // Skip launching Zoom - message will open Zoom externally
    console.log(`[Agent ${this.config.agentId}] Waiting for Zoom meeting window...`);

    // State: waiting (for admission)
    await this.updateJobStatus(job.jobId, "waiting");

      // Wait for admission (up to 20 minutes)
      // waitForAdmission now throws ZoomUIError with a clear reason on failure
      try {
        await waitForAdmission(this.config.agentId, 20 * 60 * 1000);

      console.log(`[Agent ${this.config.agentId}] Admitted to meeting`);

      // State: recording
      await this.updateJobStatus(job.jobId, "recording");

      // Start screen+audio capture
      const recordingPath = join(this.config.recordingPath, `job_${job.jobId}_${Date.now()}.mkv`);
      await this.startCapture(recordingPath);

      // Start heartbeat
      this.startHeartbeat(job.jobId);

      // Wait for meeting end (with 4-hour cap)
      const maxEndTime = Date.now() + this.config.maximumRecordingHours * 3600 * 1000;
      const ended = await waitForMeetingEnd(this.config.agentId, maxEndTime - Date.now());

      if (ended) {
        console.log(`[Agent ${this.config.agentId}] Meeting ended detected`);
      } else {
        console.log(`[Agent ${this.config.agentId}] Maximum recording time (${this.config.maximumRecordingHours}h) reached`);
      }

      // Stop capture
      await this.stopCapture();

      // State: completed
      await this.updateJobStatus(job.jobId, "completed", { recording_path: recordingPath });
      console.log(`[Agent ${this.config.agentId}] Job ${job.jobId} completed`);

    } catch (error) {
      console.error(`[Agent ${this.config.agentId}] Job failed:`, error);
      await this.updateJobStatus(job.jobId, "failed", { failure_code: error instanceof Error ? error.message : "unknown" });
      throw error;
    }
  }



  private async startCapture(outputPath: string): Promise<void> {
    // Use the capture module to start FFmpeg
    await captureScreenAudio(outputPath);
    console.log(`[Agent ${this.config.agentId}] Capture started: ${outputPath}`);
  }

  private async stopCapture(): Promise<void> {
    if (this.captureProcess) {
      this.captureProcess.kill("SIGINT");
      await new Promise<void>((resolve) => {
        this.captureProcess?.on("exit", () => resolve());
        setTimeout(resolve, 5000); // Force kill after 5s
      });
      this.captureProcess = null;
    }
  }

  private startHeartbeat(jobId: number): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const response = await globalThis.fetch(`${this.config.plannerBaseUrl}/agent/jobs/${jobId}/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.webtopAgentToken}`,
            "X-Agent-Id": this.config.agentId,
          },
        });
        if (!response.ok) {
          console.error("Heartbeat failed:", response.status);
        }
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    }, 60000); // Every minute
  }

  private async updateJobStatus(
    jobId: number,
    state: string,
    extras: { recording_path?: string; failure_code?: string } = {}
  ): Promise<void> {
    try {
      const response = await globalThis.fetch(`${this.config.plannerBaseUrl}/agent/jobs/${jobId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.webtopAgentToken}`,
          "X-Agent-Id": this.config.agentId,
        },
        body: JSON.stringify({
          state,
          occurred_at: new Date().toISOString(),
          ...extras,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(`Status update failed: ${response.status} ${err.error || ""}`);
      }
    } catch (error) {
      console.error("Status update error:", error);
      throw error;
    }
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.zoomProcess) {
      this.zoomProcess.kill("SIGTERM");
      this.zoomProcess = null;
    }
    if (this.captureProcess) {
      this.captureProcess.kill("SIGTERM");
      this.captureProcess = null;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runCommand(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(cmd, args);
      let stdout = "", stderr = "";
      proc.stdout.on("data", (d) => stdout += d.toString());
      proc.stderr.on("data", (d) => stderr += d.toString());
      proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
      proc.on("error", (err) => resolve({ code: 1, stdout, stderr: err.message }));
    });
  }
}

// Load config from environment
function loadConfig(): PlannerConfig {
  const required = (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is required`);
    return v;
  };

  return {
    plannerBaseUrl: required("PLANNER_BASE_URL"),
    webtopAgentToken: required("WEBTOP_AGENT_TOKEN"),
    agentId: required("AGENT_ID"),
    zoomAccountEmail: required("ZOOM_ACCOUNT_EMAIL"),
    recordingPath: required("RECORDING_PATH"),
    maximumRecordingHours: parseInt(process.env.MAX_RECORDING_HOURS || "4", 10),
  };
}

// Main
const config = loadConfig();
const agent = new ZoomAgent(config);

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  process.exit(0);
});

agent.start().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});