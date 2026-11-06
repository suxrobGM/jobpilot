// @ts-check
// Calls the JobPilot API as the session's user. Node's fetch does TLS through OpenSSL, so it works
// inside the Codex Windows sandbox, where Schannel-based HTTP clients cannot get credentials.
import { readFileSync, writeFileSync } from "node:fs";

const USAGE = `usage: jobpilot-api <METHOD> <path> [--query key=value]... [--data <json>|@<file>|-] [--out <file>]

  jobpilot-api GET /api/user
  jobpilot-api GET /api/applications --query search=Acme --query limit=100
  jobpilot-api POST /api/feeds --data @body.json
  jobpilot-api GET /api/resumes/3/pdf --out resume-3.pdf`;

const REQUEST_TIMEOUT_MS = 120_000;

/**
 * @typedef {object} ApiRequest
 * @property {string} method HTTP method, upper-cased.
 * @property {string} path API-relative path as given on the command line.
 * @property {[string, string][]} query Query parameters, URL-encoded when the URL is built.
 * @property {string | null} data Inline JSON, `@<file>`, or `-` for stdin.
 * @property {string | null} out File that receives the response body instead of stdout.
 */

/** A usage or request failure reported on stderr without a stack trace. */
class CliError extends Error {
  /**
   * @param {string} message
   * @param {number} exitCode 2 for bad usage, 1 for a failed request.
   */
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

/**
 * @param {string} message
 * @param {number} [exitCode]
 * @returns {never}
 */
function fail(message, exitCode = 2) {
  throw new CliError(message, exitCode);
}

/**
 * The error body's stable `code` plus a trailing space, or "" when the body has none.
 * @param {string} body
 * @returns {string}
 */
function errorCode(body) {
  try {
    const code = JSON.parse(body)?.code;
    return typeof code === "string" ? `${code} ` : "";
  } catch {
    return "";
  }
}

/**
 * @param {string[]} argv Arguments after the script path.
 * @returns {ApiRequest}
 */
function parseArgs(argv) {
  const [method, path, ...rest] = argv;
  if (!method || !path || method === "--help" || method === "-h") fail(USAGE);

  /** @type {ApiRequest} */
  const request = { method: method.toUpperCase(), path, query: [], data: null, out: null };
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    const value = rest[i + 1] ?? null;
    if (value === null) fail(`${flag} needs a value\n\n${USAGE}`);

    if (flag === "--query" || flag === "-q") {
      const separator = value.indexOf("=");
      if (separator < 1) fail(`--query takes key=value, got "${value}"`);
      request.query.push([value.slice(0, separator), value.slice(separator + 1)]);
    } else if (flag === "--data" || flag === "-d") {
      request.data = value;
    } else if (flag === "--out" || flag === "-o") {
      request.out = value;
    } else {
      fail(`unknown option ${flag}\n\n${USAGE}`);
    }
  }
  return request;
}

/**
 * Resolves `--data` to the JSON text to send, rejecting invalid JSON before any request.
 * @param {string | null} data
 * @returns {string | null}
 */
function readBody(data) {
  if (data === null) return null;

  let text = data;
  if (data === "-") text = readFileSync(0, "utf8");
  else if (data.startsWith("@")) text = readFileSync(data.slice(1), "utf8");

  // Windows PowerShell 5.1 writes UTF-8 files with a BOM, which JSON.parse rejects.
  text = text.replace(/^﻿/, "");
  try {
    JSON.parse(text);
  } catch (error) {
    fail(`request body is not valid JSON: ${/** @type {Error} */ (error).message}`);
  }
  return text;
}

/**
 * @param {string} base The JOBPILOT_API origin.
 * @param {string} rawPath
 * @param {[string, string][]} query
 * @returns {URL}
 */
function buildUrl(base, rawPath, query) {
  // Git Bash rewrites a leading-slash argument into a Windows path, so "api/user" is accepted too.
  const path = rawPath.startsWith("api/") ? `/${rawPath}` : rawPath;
  // Only API-relative paths, so the bearer token can never reach another origin.
  if (!path.startsWith("/") || path.startsWith("//")) {
    fail(`path must be API-relative, like /api/user - got "${rawPath}"`);
  }
  const url = new URL(base.replace(/\/+$/, "") + path);
  if (url.origin !== new URL(base).origin) fail(`path "${path}" leaves ${base}`);
  for (const [key, value] of query) url.searchParams.append(key, value);
  return url;
}

/** @returns {Promise<void>} */
async function main() {
  const request = parseArgs(process.argv.slice(2));
  const base = process.env.JOBPILOT_API;
  if (!base)
    fail("JOBPILOT_API is unset - this session is not running inside the JobPilot terminal host");

  const url = buildUrl(base, request.path, request.query);
  const body = readBody(request.data);
  /** @type {Record<string, string>} */
  const headers = { accept: "application/json" };
  if (process.env.JOBPILOT_API_TOKEN)
    headers.authorization = `Bearer ${process.env.JOBPILOT_API_TOKEN}`;
  if (body !== null) headers["content-type"] = "application/json";

  /** @type {Response} */
  let response;
  try {
    response = await fetch(url, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const failure = /** @type {Error & { cause?: Error }} */ (error);
    fail(
      `${request.method} ${request.path} failed: ${failure.cause?.message ?? failure.message}`,
      1,
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    fail(
      `HTTP ${response.status} ${errorCode(detail)}${request.method} ${request.path}${detail ? `\n${detail}` : ""}`,
      1,
    );
  }

  if (request.out !== null) {
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(request.out, bytes);
    process.stderr.write(`saved ${bytes.length} bytes to ${request.out}\n`);
    return;
  }

  process.stdout.write(await response.text());
}

// process.exit() with fetch handles still open aborts Node on Windows, so only set the exit code.
try {
  await main();
} catch (error) {
  if (!(error instanceof CliError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode;
}
