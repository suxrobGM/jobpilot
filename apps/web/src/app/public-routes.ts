/**
 * A new page must ALSO go in `proxy.ts`'s `config.matcher` (Next needs a literal), or it 307s to
 * /login. Dynamic pages stay out; `sitemap.ts` emits them.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/docs",
  "/install",
  "/jobs",
  "/leaderboard",
  "/login",
  "/register",
] as const;
