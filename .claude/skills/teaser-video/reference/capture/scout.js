// Screenshots candidate screens (1x CSS scale) into scout/ with the saved session.
//   node scout.js name=/path [name=/path ...]
// Set TEASER_READY to a selector when the first <main> is hidden or never goes network-idle.
import fs from "node:fs";
import { go, open } from "./cam.js";

const READY = process.env.TEASER_READY || "main";
fs.mkdirSync("scout", { recursive: true });
const cam = await open({ path: "/", ready: READY, settleMs: 2500 });
for (const entry of process.argv.slice(2)) {
  // Split on the first "=" only, so query strings like ?tab=applied survive.
  const at = entry.indexOf("=");
  const name = entry.slice(0, at);
  const target = entry.slice(at + 1);
  try {
    await go(cam.page, target, { ready: READY, settleMs: 3000 });
    await cam.page.screenshot({ path: `scout/${name}.png`, scale: "css" });
    console.log("ok", name, cam.page.url());
  } catch (err) {
    console.log("fail", name, err.message);
  }
}
await cam.browser.close();
