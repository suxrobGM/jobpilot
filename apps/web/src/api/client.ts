import { createApiClient } from "@jobpilot/api-client";
import { API_ORIGIN } from "./base-url";

/** Calls the API directly; the cookie rides cross-origin via credentials + same-site + CORS. */
export const api = createApiClient(API_ORIGIN, { fetch: { credentials: "include" } }).api;
