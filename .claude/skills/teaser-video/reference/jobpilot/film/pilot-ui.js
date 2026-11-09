// JobPilot UI moves shared by the scenes. Copy next to cam.js.
import { click, glide, hideCursor } from "./cam.js";

/** A Pipeline row's open button. The row title is a stretched button over the whole row. */
export function jobRow(page, text) {
  return page
    .getByText(text)
    .first()
    .locator("xpath=ancestor::*[.//button[@data-row-open]][1]//button[@data-row-open]");
}

/** Open the Agent drawer on the terminal, then park the cursor out of the way. */
export async function openAgentDrawer(page, log) {
  await click(page, page.getByText("Agent", { exact: true }).first(), { ms: 1100 });
  log("open agent drawer");
  await page.waitForTimeout(1000);
  await glide(page, 1300, 600, 700);
  await hideCursor(page);
}
