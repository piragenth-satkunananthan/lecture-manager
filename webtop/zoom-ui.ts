import { spawn } from "node:child_process";

export class ZoomUIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZoomUIError";
  }
}

/**
 * Detect the current Zoom UI state by window titles.
 */
export type ZoomUIState =
  | "sign_in_required"
  | "waiting_room"
  | "joining"
  | "in_meeting"
  | "meeting_ended"
  | "unknown";

export async function detectZoomUIState(): Promise<ZoomUIState> {
  const windows = await listWindows();

  for (const w of windows) {
    const name = w.name.toLowerCase();
    if (name.includes("sign in") || name.includes("log in") || name.includes("sign up")) {
      return "sign_in_required";
    }
    if (name.includes("waiting room") || name.includes("please wait") || name.includes("host will") || name.includes("admit you")) {
      return "waiting_room";
    }
    if (name.includes("meeting ended") || name.includes("ended by host") || name.includes("meeting summary")) {
      return "meeting_ended";
    }
    if (name.includes("zoom meeting") || name.includes("meeting id")) {
      // Large window = in meeting
      if (w.width > 800 && w.height > 600) return "in_meeting";
      return "joining";
    }
  }

  // Check if only "Zoom Workplace" main window exists (not signed in / not joined)
  if (windows.some((w) => w.name.toLowerCase() === "zoom workplace") && !windows.some((w) => w.name.toLowerCase().includes("meeting"))) {
    return "sign_in_required";
  }

  return "unknown";
}

interface WindowInfo {
  id: string;
  name: string;
  width: number;
  height: number;
}

async function listWindows(): Promise<WindowInfo[]> {
  const result = await runXdotool(["search", "--onlyvisible", ""]);
  if (result.code !== 0 || !result.stdout.trim()) return [];

  const windows: WindowInfo[] = [];
  for (const id of result.stdout.trim().split("\n").filter(Boolean)) {
    const nameResult = await runXdotool(["getwindowname", id]);
    const geomResult = await runXdotool(["getwindowgeometry", "--shell", id]);
    const name = nameResult.code === 0 ? nameResult.stdout.trim() : "";
    let width = 0, height = 0;
    if (geomResult.code === 0) {
      const wMatch = geomResult.stdout.match(/WIDTH=(\d+)/);
      const hMatch = geomResult.stdout.match(/HEIGHT=(\d+)/);
      width = wMatch ? parseInt(wMatch[1], 10) : 0;
      height = hMatch ? parseInt(hMatch[1], 10) : 0;
    }
    windows.push({ id, name, width, height });
  }
  return windows;
}

/**
 * Take a screenshot of the current screen and OCR it for debugging.
 */
export async function captureScreenText(): Promise<string> {
  try {
    await runXdotool(["getactivewindow", "windowactivate", "%@"]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
    const xwd = await runCommand("xwd", ["-root", "-silent", "-out", "/tmp/zoom-debug.xwd"]);
    if (xwd.code !== 0) return "";
    const ocr = await runCommand("tesseract", ["/tmp/zoom-debug.xwd", "stdout"]);
    return ocr.code === 0 ? ocr.stdout.trim() : "";
  } catch {
    return "";
  }
}

function runCommand(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    let stdout = "", stderr = "";
    proc.stdout?.on("data", (d) => stdout += d.toString());
    proc.stderr?.on("data", (d) => stderr += d.toString());
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    proc.on("error", (err) => resolve({ code: 1, stdout: "", stderr: err.message }));
  });
}

/**
 * Wait for Zoom meeting admission.
 * Detects sign-in required, waiting room, and meeting states.
 * Throws ZoomUIError with a clear reason on failure.
 */
export async function waitForAdmission(
  agentId: string,
  timeoutMs: number
): Promise<void> {
  console.log(`[ZoomUI ${agentId}] Waiting for admission (timeout: ${Math.round(timeoutMs / 60000)} min)`);

  const startTime = Date.now();
  let lastState: ZoomUIState = "unknown";
  let lastLog = 0;

  while (Date.now() - startTime < timeoutMs) {
    const state = await detectZoomUIState();

    if (state !== lastState || Date.now() - lastLog > 30000) {
      console.log(`[ZoomUI] State: ${state}`);
      const text = await captureScreenText();
      if (text) console.log(`[ZoomUI] Screen text: ${text.slice(0, 200)}`);
      lastState = state;
      lastLog = Date.now();
    }

    if (state === "sign_in_required") {
      throw new ZoomUIError("Zoom is not signed in. Sign in via the Webtop UI first, then retry.");
    }
    if (state === "in_meeting") {
      console.log(`[ZoomUI] Admitted to meeting`);
      return;
    }
    if (state === "meeting_ended") {
      throw new ZoomUIError("Meeting ended before admission");
    }

    await sleep(5000);
  }

  const text = await captureScreenText();
  throw new ZoomUIError(`Admission timeout after ${Math.round(timeoutMs / 60000)} minutes. Last screen: ${text.slice(0, 200) || "unknown"}`);
}

/**
 * Wait for meeting to end (host ends meeting).
 * Returns true if meeting ended, false on timeout (4-hour cap).
 */
export async function waitForMeetingEnd(
  agentId: string,
  timeoutMs: number
): Promise<boolean> {
  console.log(`[ZoomUI ${agentId}] Waiting for meeting end (timeout: ${Math.round(timeoutMs / 60000)} min)`);

  const startTime = Date.now();
  let lastState: ZoomUIState = "unknown";

  while (Date.now() - startTime < timeoutMs) {
    const state = await detectZoomUIState();

    if (state !== lastState) {
      console.log(`[ZoomUI] State: ${state}`);
      lastState = state;
    }

    if (state === "meeting_ended" || state === "sign_in_required" || state === "unknown") {
      console.log(`[ZoomUI] Meeting ended or left (state: ${state})`);
      return true;
    }

    await sleep(10000); // Check every 10 seconds
  }

  console.log(`[ZoomUI] Meeting end timeout after ${Math.round(timeoutMs / 60000)} min`);
  return false;
}

/**
 * Check if we've been admitted to the meeting (not in waiting room).
 * Uses xdotool to find Zoom meeting window and check title/state.
 */
async function checkAdmitted(): Promise<boolean> {
  try {
    // Look for Zoom meeting window (not the main Zoom window)
    // Meeting window typically has title containing meeting name or "Zoom Meeting"
    const result = await runXdotool([
      "search",
      "--onlyvisible",
      "--name",
      "Zoom Meeting",
    ]);

    if (result.code === 0 && result.stdout.trim()) {
      const windowIds = result.stdout.trim().split("\n").filter(Boolean);
      if (windowIds.length > 0) {
        // Verify it's a meeting window (not main window) by checking size/position
        for (const id of windowIds) {
          const geom = await runXdotool(["getwindowgeometry", id]);
          if (geom.code === 0 && geom.stdout.includes("Geometry:")) {
            // Meeting windows are typically large
            const match = geom.stdout.match(/Geometry: (\d+)x(\d+)/);
            if (match) {
              const width = parseInt(match[1], 10);
              const height = parseInt(match[2], 10);
              if (width > 800 && height > 600) {
                return true; // Likely a meeting window
              }
            }
          }
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if we're in the waiting room.
 */
async function checkWaitingRoom(): Promise<boolean> {
  try {
    // Waiting room window typically has "Waiting Room" in title
    const result = await runXdotool([
      "search",
      "--onlyvisible",
      "--name",
      "Waiting Room",
    ]);
    return result.code === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if meeting has ended (host ended meeting).
 * Meeting ended state shows "Meeting ended" or similar dialog.
 */
async function checkMeetingEnded(): Promise<boolean> {
  try {
    // Check for "Meeting ended" or "The meeting has ended" dialog
    const result = await runXdotool([
      "search",
      "--onlyvisible",
      "--name",
      "Meeting ended",
    ]);

    if (result.code === 0 && result.stdout.trim()) {
      return true;
    }

    // Also check for "The meeting has been ended by host"
    const result2 = await runXdotool([
      "search",
      "--onlyvisible",
      "--name",
      "ended by host",
    ]);

    if (result2.code === 0 && result2.stdout.trim()) {
      return true;
    }

    // Check if main Zoom window is back (meeting window closed)
    const meetingWindows = await runXdotool([
      "search",
      "--onlyvisible",
      "--name",
      "Zoom Meeting",
    ]);

    if (meetingWindows.code === 0 && !meetingWindows.stdout.trim()) {
      // No meeting windows visible - meeting likely ended
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if we left the meeting (kicked, connection lost, etc.)
 */
async function checkLeftMeeting(): Promise<boolean> {
  try {
    // If no Zoom meeting window exists, we likely left
    const result = await runXdotool([
      "search",
      "--onlyvisible",
      "--name",
      "Zoom Meeting",
    ]);
    return result.code !== 0 || !result.stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Run xdotool command and return result.
 */
function runXdotool(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("xdotool", args);
    let stdout = "", stderr = "";
    proc.stdout?.on("data", (d) => stdout += d.toString());
    proc.stderr?.on("data", (d) => stderr += d.toString());
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    proc.on("error", (err) => resolve({ code: 1, stdout: "", stderr: err.message }));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}