import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";
import { describe, expect, test } from "bun:test";

// Skills call the API by path in prose, so a renamed route breaks them silently; this pins every call.
const REPO = join(import.meta.dir, "../../..");
const PLACEHOLDER = /^(<[^>]*>|\[[^\]]*\]|\$\{?\w+\}?|:\w+|\{\w+\})$/;
const API_CALL = /\b(GET|POST|PATCH|PUT|DELETE) "?(\/api\/[^\s`"'?),;]+)/g;
const ROUTE = /prefix: "([^"]*)"|\.(get|post|patch|put|delete)\(\s*"([^"]*)"/g;
const WEB_LINK = /(?:\$JOBPILOT_WEB|<JOBPILOT_WEB>)(\/[^\s`"'?#),;]*)/g;

function segments(path: string): string[] {
  const parts = path
    .replace(/[.:]+$/, "")
    .split("/")
    .filter(Boolean);
  const last = parts.at(-1);
  // A path quoted inside prose like `<every domain from GET /api/job-boards>`.
  if (last?.endsWith(">") && !last.includes("<")) {
    parts[parts.length - 1] = last.slice(0, -1);
  }
  return parts;
}

function matches(pattern: string[], path: string[]): boolean {
  if (pattern.length !== path.length) {
    return false;
  }
  return pattern.every((part, i) => {
    const used = path[i];
    return part.startsWith(":") || PLACEHOLDER.test(used) || part === used;
  });
}

// Read from source: importing the controllers would construct their services in the shared container.
function apiRoutes(): string[][] {
  const routes: string[][] = [];
  for (const file of new Glob("modules/**/*.controller.ts").scanSync(import.meta.dir)) {
    const source = readFileSync(join(import.meta.dir, file), "utf8");
    let prefix = "";
    for (const [, declared, method, path] of source.matchAll(ROUTE)) {
      if (declared !== undefined) {
        prefix = declared;
      } else {
        routes.push([method.toUpperCase(), "api", ...segments(prefix + path)]);
      }
    }
  }
  return routes;
}

function webPages(): string[][] {
  const pages: string[][] = [];
  for (const file of new Glob("**/page.tsx").scanSync(join(REPO, "apps/web/src/app"))) {
    const parts = segments(file.replaceAll("\\", "/")).slice(0, -1);
    pages.push(parts.filter((p) => !p.startsWith("(")).map((p) => (p.startsWith("[") ? ":p" : p)));
  }
  return pages;
}

function pluginFiles(): { file: string; text: string }[] {
  return [...new Glob("plugin/**/*.md").scanSync(REPO)].map((file) => ({
    file,
    text: readFileSync(join(REPO, file), "utf8"),
  }));
}

describe("plugin links", () => {
  test("every API call in the plugin names a real route", () => {
    const routes = apiRoutes();
    const missing: string[] = [];
    for (const { file, text } of pluginFiles()) {
      for (const [, method, path] of text.matchAll(API_CALL)) {
        if (path.includes("...")) {
          continue;
        }
        const used = segments(path);
        if (!routes.some(([m, ...p]) => m === method && matches(p, used))) {
          missing.push(`${file}: ${method} ${path}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("every web link in the plugin names a real page", () => {
    const pages = webPages();
    const missing: string[] = [];
    for (const { file, text } of pluginFiles()) {
      for (const [, path] of text.matchAll(WEB_LINK)) {
        if (!pages.some((p) => matches(p, segments(path)))) {
          missing.push(`${file}: ${path}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
