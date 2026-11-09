// Camera kit for choreographed takes: 2x device scale, CDP screencast piped
// straight into a GPU encoder with wall-clock timestamps, a film cursor, and
// eased scrolling of the app's inner scroll container.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

export const BASE = process.env.TEASER_BASE_URL || "http://localhost:3000";
// UI state to pin before any page script runs, e.g. '{"sidebar":"collapsed"}'.
const SEED = JSON.parse(process.env.TEASER_LOCAL_STORAGE || "{}");
const SCALE = 2;
// Paths that mean "not signed in". Adjust per app.
export const AUTH_PATHS = /\/(login|register|signin|sign-in|forgot-password|reset-password)/;
// Swap for ["-c:v", "libx264", "-crf", "16"] without an NVIDIA GPU.
export const ENCODER = ["-c:v", "h264_nvenc", "-preset", "p6", "-cq", "16"];

export async function open({
  w = 1600,
  h = 900,
  path: p = "/",
  ready = null,
  settleMs = 1000,
  seed = SEED,
} = {}) {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--force-device-scale-factor=2",
      "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests",
    ],
  });
  const ctx = await browser.newContext({
    storageState: "storageState.json",
    viewport: { width: w, height: h },
    deviceScaleFactor: SCALE,
  });
  await ctx.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) {
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    }
  }, seed);
  const page = await ctx.newPage();
  await go(page, p, { ready, settleMs });
  return { browser, ctx, page, w, h };
}

/**
 * Navigate and wait until `ready` (a selector for the content the shot needs)
 * is visible, then `settleMs` for entrance animations. Without `ready`, falls
 * back to network idle.
 */
export async function go(page, p, { ready = null, settleMs = 1000 } = {}) {
  await page.goto(BASE + p, { waitUntil: "load" });
  if (ready) {
    await page.locator(ready).first().waitFor({ timeout: 30_000 });
  } else {
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  await page.waitForTimeout(settleMs);
  if (AUTH_PATHS.test(new URL(page.url()).pathname)) {
    throw new Error("session expired - re-run login.js");
  }
  await installCursor(page);
}

/** Start filming. Returns stop() which resolves once the file is finalised. */
export async function roll(page, file, { w, h }, onFrame = () => {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const enc = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-use_wallclock_as_timestamps",
      "1",
      "-i",
      "-",
      "-fps_mode",
      "vfr",
      ...ENCODER,
      "-pix_fmt",
      "yuv420p",
      file,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const cdp = await page.context().newCDPSession(page);
  let last = null;
  cdp.on("Page.screencastFrame", (ev) => {
    last = Buffer.from(ev.data, "base64");
    onFrame();
    // Ack only once ffmpeg has taken the frame, so a slow encoder throttles the
    // screencast instead of growing Node's buffer through a long take.
    const ack = () =>
      cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
    if (enc.stdin.write(last)) {
      ack();
    } else {
      enc.stdin.once("drain", ack);
    }
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: w * SCALE,
    maxHeight: h * SCALE,
  });
  const t0 = Date.now();
  return async function stop() {
    // A settled page stops emitting frames; repeat the last one so the clip
    // really lasts as long as we filmed.
    if (last) {
      enc.stdin.write(last);
    }
    await cdp.send("Page.stopScreencast").catch(() => {});
    enc.stdin.end();
    await new Promise((r) => enc.on("exit", r));
    return (Date.now() - t0) / 1000;
  };
}

export async function installCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById("__filmCursor")) {
      return;
    }
    const c = document.createElement("div");
    c.id = "__filmCursor";
    c.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))"><path d="M4 2 L20 12 L12.5 13.8 L9 21 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity 250ms, scale 120ms",
    });
    document.body.appendChild(c);
    window.__cursorPos = { x: innerWidth * 0.6, y: innerHeight * 0.7 };
    c.style.transform = `translate(${window.__cursorPos.x}px, ${window.__cursorPos.y}px)`;
  });
}

export async function glide(page, x, y, ms = 900) {
  await page.evaluate(
    ({ x, y, ms }) =>
      new Promise((done) => {
        const c = document.getElementById("__filmCursor");
        c.style.opacity = "1";
        const from = { ...window.__cursorPos };
        const start = performance.now();
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms);
          const e = ease(t);
          window.__cursorPos = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
          c.style.transform = `translate(${window.__cursorPos.x}px, ${window.__cursorPos.y}px)`;
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            done();
          }
        };
        requestAnimationFrame(step);
      }),
    { x, y, ms },
  );
}

export async function center(locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("no bounding box");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Glide to the element, press, really click. Returns the click point. */
export async function click(page, locator, { ms = 900, hold = 90 } = {}) {
  const { x, y } = await center(locator);
  await glide(page, x - 3, y - 2, ms);
  await page.evaluate(() => (document.getElementById("__filmCursor").style.scale = "0.82"));
  await page.waitForTimeout(hold);
  await page.mouse.click(x, y);
  await page.evaluate(() => (document.getElementById("__filmCursor").style.scale = "1"));
  return { x, y };
}

export async function hideCursor(page) {
  await page.evaluate(() => (document.getElementById("__filmCursor").style.opacity = "0"));
}

/** Eased scroll of the main scroll container (the app scrolls inside main, not window). */
export async function scrollTo(page, y, ms = 1400) {
  await scrollEased(page, { y, dy: null, ms });
}

/** Scroll so the element's top sits `offset` px below the viewport top. */
export async function scrollToEl(page, locator, offset = 120, ms = 1400) {
  const dy = await locator.evaluate(
    (el, offset) => el.getBoundingClientRect().top - offset,
    offset,
  );
  await scrollEased(page, { y: null, dy, ms });
}

async function scrollEased(page, target) {
  await page.evaluate(
    ({ y, dy, ms }) =>
      new Promise((done) => {
        const all = [document.scrollingElement, ...document.querySelectorAll("main, main *")];
        const el =
          all.find(
            (e) =>
              e &&
              e.scrollHeight > e.clientHeight + 20 &&
              getComputedStyle(e).overflowY !== "visible",
          ) || document.scrollingElement;
        const from = el.scrollTop;
        const to = Math.max(0, dy === null ? y : from + dy);
        const start = performance.now();
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms);
          el.scrollTop = from + (to - from) * ease(t);
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            done();
          }
        };
        requestAnimationFrame(step);
      }),
    target,
  );
}
