import type { PropsWithChildren, ReactElement } from "react";

/**
 * Layout for the unauthenticated `(auth)` route group (login, register).
 *
 * The visual shell — full-height centered frame, surface background, and the
 * JobPilot wordmark — lives in `AuthCard`, so this layout is a passthrough that
 * only scopes the group and gives a home for future auth-only metadata or
 * providers. It deliberately omits `<html>`/`<body>` (owned by the root layout)
 * and the `AppShell` rail (dashboard-only). Route groups don't change URLs, so
 * the pages stay at `/login` and `/register`.
 */
export default function AuthLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return <>{children}</>;
}
