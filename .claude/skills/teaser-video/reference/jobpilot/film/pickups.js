// Payoff + trust pickups after the run: the Pilot thread (its side panel holds the rules card)
// and the Pipeline's Applied tab. Never film Goals & rules: it shows the standing answers.
//   node pickups.js
import fs from "node:fs";
import { click, go, hideCursor, open, roll } from "./cam.js";

const DIR = "takes/pickups";
fs.mkdirSync(DIR, { recursive: true });
const t0 = Date.now();
const log = (msg) => {
  const line = `${((Date.now() - t0) / 1000).toFixed(2)}\t${msg}`;
  fs.appendFileSync(`${DIR}/events.log`, `${line}\n`);
  console.log(line);
};

const cam = await open({ path: "/pilot", ready: "main", settleMs: 2500 });
const { page } = cam;
const stop = await roll(page, `${DIR}/web.mkv`, cam);
await hideCursor(page);
log("pilot thread");
await page.waitForTimeout(7000);

await go(page, "/pipeline", { ready: "text=Best match first", settleMs: 1500 });
log("pipeline");
await page.waitForTimeout(1500);
await click(page, page.getByRole("tab", { name: /Applied/ }).first(), { ms: 1100 });
log("applied tab");
await page.waitForTimeout(5000);

await stop();
await cam.browser.close();
log("done");
