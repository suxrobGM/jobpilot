import { type Treaty, treaty } from "@elysiajs/eden";
import type { App } from "@jobpilot/api";

/** Create an Eden Treaty client bound to the JobPilot backend `App` type. */
export function createApiClient(
  baseUrl: string,
  options?: NonNullable<Parameters<typeof treaty<App>>[1]>,
) {
  return treaty<App>(baseUrl, options);
}

/**
 * Resolved success-data type of an Eden endpoint method.
 *   Data<(typeof client)["api"]["resumes"]["get"]>
 */
// biome-ignore lint/suspicious/noExplicitAny: Treaty.Data constrains T to `(...a: any) => any`
export type Data<T extends (...args: any[]) => any> = NonNullable<Treaty.Data<T>>;

/** Request-body type of an Eden POST/PATCH/PUT endpoint. */
export type Body<T extends (...args: never[]) => unknown> = NonNullable<Parameters<T>[0]>;
