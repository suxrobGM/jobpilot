import { createApiClient } from "@jobpilot/api-client";
import { API_BASE_URL } from "./base-url";

/** Eden Treaty client, typed from the backend `App`. Calls the API directly; cookie rides cross-origin via credentials + same-site + CORS. */
export const api = createApiClient(API_BASE_URL, { fetch: { credentials: "include" } }).api;
