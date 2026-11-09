// Films one page during a real run, plus the agent's Chrome via Windows Graphics Capture.
// Every source is stamped against one wall clock so the edit can line them up.
//   node live.js <name> [--start] [--minutes N] [--path /] [--ready <selector>] [--do scene.js]
// --start clicks the first "Start" button on camera. --do runs a scene module's default export
// ({ page, log }) after rolling, for the user's on-camera actions. Stop early by creating takes/<name>/STOP.
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { click, ENCODER, hideCursor, open, roll } from "./cam.js";

// Regex matched against chrome.exe command lines to find the agent's own browser.
const AGENT_BROWSER = process.env.TEASER_AGENT_BROWSER || "playwright-mcp|mcp-chrome|ms-playwright";
// Optional health endpoint polled into the event log, to find the moments later.
const HEALTH_URL = process.env.TEASER_HEALTH_URL || "";
const args = process.argv.slice(2);
const name = args[0];
const flag = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const MINUTES = Number(opt("--minutes", 30));
const PAGE_PATH = opt("--path", "/");
const READY = opt("--ready", null);

const dir = path.resolve("takes", name);
fs.mkdirSync(dir, { recursive: true });
const STOP = path.join(dir, "STOP");
fs.rmSync(STOP, { force: true });
const events = fs.createWriteStream(path.join(dir, "events.log"), { flags: "a" });
const t0 = Date.now();
const log = (msg) => {
  const line = `${((Date.now() - t0) / 1000).toFixed(2)}\t${new Date().toISOString()}\t${msg}`;
  events.write(`${line}\n`);
  console.log(line);
};
log(`t0 epoch_ms=${t0}`);

const cam = await open({ path: PAGE_PATH, ready: READY });
const { browser, page } = cam;
let frames = 0;
const stopWeb = await roll(page, path.join(dir, "web.mkv"), cam, () => {
  if (frames === 0) {
    log("web first frame");
  }
  frames++;
});
log("web recording");

const windowTakes = [];
let current = null;
function findAgentWindow() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match '${AGENT_BROWSER}' -and $_.CommandLine -notmatch '--type=' } | ForEach-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($p -and $p.MainWindowHandle -ne 0) { "$($p.Id)|$($p.MainWindowHandle)|$($p.MainWindowTitle)" } }`;
  return new Promise((resolve) =>
    execFile("powershell", ["-NoProfile", "-Command", ps], (_e, out) =>
      resolve((out || "").trim().split(/\r?\n/).filter(Boolean)[0] || null),
    ),
  );
}
function startWindowCapture(hwnd) {
  // MPEG-TS, not MKV: the capture is killed when the window idles, and a killed MKV loses its tail.
  const file = path.join(dir, `agent-${windowTakes.length}.ts`);
  const proc = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-filter_complex",
      // Windows can have odd pixel sizes; yuv420p needs even ones or the encoder stalls silently.
      `gfxcapture=hwnd=${hwnd}:capture_cursor=0:max_framerate=30,hwdownload,format=bgra,crop=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
      ...ENCODER,
      file,
    ],
    { stdio: ["pipe", "ignore", "inherit"] },
  );
  windowTakes.push(file);
  log(`agent window capture start hwnd=${hwnd} -> ${path.basename(file)}`);
  proc.on("exit", (code) => log(`agent window capture exit ${code} ${path.basename(file)}`));
  return { proc, hwnd };
}
const watchWindow = setInterval(async () => {
  const found = await findAgentWindow();
  const hwnd = found ? found.split("|")[1] : null;
  if (current && current.proc.exitCode !== null) {
    current = null;
  }
  if (hwnd && (!current || current.hwnd !== hwnd)) {
    if (current) {
      current.proc.stdin.write("q");
    }
    log(`agent window: ${found}`);
    current = startWindowCapture(hwnd);
  }
}, 2000);

let lastStatus = "";
const watchHost = setInterval(async () => {
  try {
    if (!HEALTH_URL) {
      return;
    }
    const s = JSON.stringify(await (await fetch(HEALTH_URL)).json());
    if (s !== lastStatus) {
      log(`host ${s}`);
      lastStatus = s;
    }
  } catch {}
}, 1500);

if (flag("--start")) {
  // A held beat before the cursor moves gives the edit a lead-in.
  await page.waitForTimeout(2500);
  await click(page, page.getByRole("button", { name: /^start$/i }).first(), { ms: 1100 });
  log("click Start");
  await page.waitForTimeout(1500);
  await hideCursor(page);
}

if (opt("--do", null)) {
  const scene = await import(pathToFileURL(path.resolve(opt("--do"))).href);
  await scene.default({ page, log });
}

const deadline = Date.now() + MINUTES * 60_000;
while (Date.now() < deadline && !fs.existsSync(STOP)) {
  await new Promise((r) => setTimeout(r, 1000));
}

log("stopping");
clearInterval(watchWindow);
clearInterval(watchHost);
if (current) {
  current.proc.stdin.write("q");
}
await stopWeb();
await new Promise((r) => setTimeout(r, 3000));
// gfxcapture only reads "q" between frames; an idle window never yields one.
if (current && current.proc.exitCode === null) {
  current.proc.kill();
}
await browser.close();
log(`done frames=${frames} agentTakes=${windowTakes.length}`);
events.end();
