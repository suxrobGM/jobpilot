// Pause + submit: open the chosen job, hover then click Apply now, and watch the run in Pilot.
// This sends a real application. Rehearse with rehearse-apply.js first.
//   TEASER_JOB="<company>" node live.js apply --path "/pipeline?feed=<id>" --ready "text=Best match first" --do scene-apply.js
import { center, click, glide, go } from "./cam.js";
import { jobRow, openAgentDrawer } from "./pilot-ui.js";

const JOB = process.env.TEASER_JOB;

export default async function apply({ page, log }) {
  await page.waitForTimeout(2500);
  await click(page, jobRow(page, JOB), { ms: 1300 });
  log("open job");
  await page.waitForTimeout(2200);

  // A held hover gives the edit its "your call" beat before the click.
  const applyNow = page.getByRole("button", { name: "Apply now" }).first();
  const target = await center(applyNow);
  await glide(page, target.x - 3, target.y - 2, 900);
  await page.waitForTimeout(700);
  await click(page, applyNow, { ms: 300 });
  log("click Apply now (You: 2)");

  await page.waitForTimeout(2500);
  await go(page, "/pilot", { ready: "main", settleMs: 1500 });
  log("back to pilot");
  await openAgentDrawer(page, log);
}
