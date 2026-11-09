// Start + handoff: type one request in the Pilot composer, send it, open the Agent drawer.
//   TEASER_REQUEST="..." node live.js ask --path /pilot --ready main --do scene-ask.js
import { click } from "./cam.js";
import { openAgentDrawer } from "./pilot-ui.js";

const REQUEST = process.env.TEASER_REQUEST;

export default async function ask({ page, log }) {
  await page.waitForTimeout(3000);
  await click(page, page.getByPlaceholder(/Ask the pilot/), { ms: 1200 });
  log("click composer");
  await page.waitForTimeout(400);
  await page.keyboard.type(REQUEST, { delay: 55 });
  log("typed request");
  await page.waitForTimeout(900);
  await page.keyboard.press("Enter");
  log("sent request (You: 1)");
  await page.waitForTimeout(3500);
  await openAgentDrawer(page, log);
}
