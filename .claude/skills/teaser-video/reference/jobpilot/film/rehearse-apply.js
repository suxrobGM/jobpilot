// Dry run of scene-apply.js: opens the job drawer and screenshots it, never clicks Apply now.
//   TEASER_PATH="/pipeline?feed=<id>" TEASER_READY="text=Best match first" TEASER_JOB="<company>" node rehearse-apply.js
import { open } from "./cam.js";
import { jobRow } from "./pilot-ui.js";

const cam = await open({
  path: process.env.TEASER_PATH,
  ready: process.env.TEASER_READY || "main",
  settleMs: 2500,
});
await cam.page.screenshot({ path: "scout/apply-list.png", scale: "css" });
await jobRow(cam.page, process.env.TEASER_JOB).click();
await cam.page.waitForTimeout(2200);
await cam.page.screenshot({ path: "scout/apply-drawer.png", scale: "css" });
console.log("apply buttons:", await cam.page.getByRole("button", { name: "Apply now" }).count());
await cam.browser.close();
