import { cache, type ReactElement, Suspense } from "react";
import { Skeleton, Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { dataOrThrow } from "@/api/error";
import { getPublicFetchOptions } from "@/api/server";
import { PortfolioView } from "@/components/features/portfolio";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbLd, personLd } from "@/lib/structured-data";

interface PortfolioPageProps {
  params: Promise<{ username: string }>;
}

/** Called by both generateMetadata and the page; `cache` collapses that to one request. */
const getPortfolio = cache(async (username: string) =>
  dataOrThrow(
    await api.public.portfolio({ username }).get(await getPublicFetchOptions()),
    "Couldn't load this portfolio",
  ),
);

export async function generateMetadata(props: PortfolioPageProps): Promise<Metadata> {
  const { username } = await props.params;
  const portfolio = await getPortfolio(username);
  if (!portfolio) {
    return { title: "Portfolio not found" };
  }

  const title = portfolio.headline
    ? `${portfolio.displayName} · ${portfolio.headline}`
    : portfolio.displayName;
  const description =
    portfolio.summary ??
    `${portfolio.displayName}'s portfolio - ${portfolio.stats.applications} applications tracked with JobPilot.`;

  return {
    title,
    description,
    alternates: { canonical: `/u/${portfolio.username}` },
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function PortfolioPage(props: PortfolioPageProps): ReactElement {
  // Everything on the page is the profile, so the marketing shell is the shared App Shell.
  return (
    <Suspense fallback={<PortfolioSkeleton />}>
      <Portfolio params={props.params} />
    </Suspense>
  );
}

function PortfolioSkeleton(): ReactElement {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={180} />
      <Skeleton variant="rounded" height={120} />
      <Skeleton variant="rounded" height={320} />
    </Stack>
  );
}

async function Portfolio(props: PortfolioPageProps): Promise<ReactElement> {
  const { username } = await props.params;
  const portfolio = await getPortfolio(username);
  if (!portfolio) {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={[
          personLd({
            name: portfolio.displayName,
            username: portfolio.username,
            headline: portfolio.headline,
            links: portfolio.links,
          }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Leaderboard", path: "/leaderboard" },
            { name: portfolio.displayName, path: `/u/${portfolio.username}` },
          ]),
        ]}
      />
      <PortfolioView portfolio={portfolio} />
    </>
  );
}
