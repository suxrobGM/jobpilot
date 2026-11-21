import { createApiClient } from "@jobpilot/api-client";
import { API_ORIGIN } from "./base-url";

/** Calls the API directly; the cookie rides cross-origin via credentials + same-site + CORS.
 * `parseDate` off: treaty revives ANY date-shaped string, so user text like "11/09/2001" would
 * arrive as a `Date` and crash components rendering it raw. Formatters take `string | Date`. */
export const api = createApiClient(API_ORIGIN, {
  fetch: { credentials: "include" },
  parseDate: false,
}).api;
