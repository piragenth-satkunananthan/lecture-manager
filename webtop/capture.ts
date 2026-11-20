import { spawn, ChildProcess } from "node:child_process";

let captureProcess: ChildProcess | null = null;

interface CaptureOptions {
  display?: string;
  audioSource?: string;
  videoSize?: string;
  frameRate?: number;
}

export async function captureScreenAudio(
  outputPath: string,
  options: CaptureOptions = {}
): Promise<void> {
  const {
    display = process.env.DISPLAY || ":0",
    audioSource = getDefaultAudioSource(),
    videoSize = "1920x1080",
    frameRate = 30,
  } = options;

  // Ensure output directory exists
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Build FFmpeg command
  // -f x11grab: X11 screen capture
  // -f pulse: PulseAudio capture
  // -c:v libx264: H.264 video encoding
  // -c:a aac: AAC audio encoding
  // -preset ultrafast: Fast encoding for real-time
  // -crf 23: Good quality/size balance
  const args = [
    "-y", // Overwrite output
    "-f", "x11grab",
    "-draw_mouse", "1",
    "-video_size", videoSize,
    "-framerate", String(frameRate),
    "-i", display,
    "-f", "pulse",
    "-i", audioSource,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath,
  ];

  console.log(`[Capture] Starting FFmpeg: ffmpeg ${args.join(" ")}`);

  const proc = spawn("ffmpeg", args, {
    env: { ...process.env },
    detached: false,
  });

  let ffmpegStderr = "";
  proc.stderr?.on("data", (data) => {
    const text = data.toString();
    ffmpegStderr += text;
    // Log progress occasionally
    if (text.includes("frame=") || text.includes("fps=")) {
      console.log(`[Capture] ${text.trim()}`);
    }
  });

  proc.on("error", (err) => {
    console.error("[Capture] FFmpeg spawn error:", err);
  });

  proc.on("close", (code, signal) => {
    console.log(`[Capture] FFmpeg exited: code=${code}, signal=${signal}`);
  });

  // Give FFmpeg a moment to start and verify it's running
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("FFmpeg startup timeout")), 5000);
    proc.stderr?.once("data", () => {
      clearTimeout(timeout);
      resolve();
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Store process reference for later termination
  // Note: In practice, the agent module holds the process reference
  // This is a simplified version - the actual process management is in agent.ts
}

function getDefaultAudioSource(): string {
  // Try to find a PulseAudio monitor source for system audio
  // Common names: "alsa_output.pci-0000_00_1b.0.analog-stereo.monitor"
  // or use default
  return process.env.PULSE_SOURCE || "default";
}

export async function stopCapture(): Promise<void> {
  // This is a placeholder - the actual process is managed in agent.ts
  // FFmpeg is terminated via SIGINT there
}

export function getCaptureProcess(): import("node:child_process").ChildProcess | null {
  // Placeholder for process management
  return null;
}