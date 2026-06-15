import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "@jobpilot/api";

/** Create an Eden Treaty client bound to the JobPilot backend `App` type. */
export function createApiClient(
  baseUrl: string,
  options?: NonNullable<Parameters<typeof treaty<App>>[1]>,
) {
  return treaty<App>(baseUrl, options);
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Resolved success-data type of an Eden endpoint method.
 *   Data<(typeof client)["api"]["resumes"]["get"]>
 */
export type Data<T extends (...args: any[]) => any> = NonNullable<Treaty.Data<T>>;

/** Request-body type of an Eden POST/PATCH/PUT endpoint. */
export type Body<T extends (...args: any[]) => any> = NonNullable<Parameters<T>[0]>;

/** Query type of an Eden GET endpoint. */
export type Query<T extends (...args: any[]) => any> = NonNullable<
  NonNullable<Parameters<T>[0]>["query"]
>;
