export interface ApiRouteContext<PathParams extends Record<string, string> = Record<string, string>> {
  params: Promise<PathParams>;
}

type QueryParamMap<Keys extends readonly string[]> = {
  [Key in Keys[number]]: string | null;
};

/**
 * Reads named query parameters from a Request URL.
 */
export function parseQueryParams<const Keys extends readonly string[]>(
  req: Request,
  keys: Keys,
): QueryParamMap<Keys> {
  const searchParams = new URL(req.url).searchParams;
  return Object.fromEntries(keys.map((key) => [key, searchParams.get(key)])) as QueryParamMap<Keys>;
}

/**
 * Resolves typed dynamic route parameters from a Next.js API route context.
 */
export async function parsePathParams<PathParams extends Record<string, string>>(
  ctx: ApiRouteContext<PathParams>,
): Promise<PathParams> {
  return ctx.params;
}
