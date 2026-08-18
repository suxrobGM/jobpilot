import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { NetworkingMessagesTable } from "@/components/features/networking";
import { PaginationControls } from "@/components/ui/data";
import { one, type PaginationSearchParams, paginationQuery } from "@/utils/search-params";

export const metadata: Metadata = { title: "Outreach messages" };

interface NetworkingMessagesPageProps {
  searchParams: Promise<PaginationSearchParams & { message?: string }>;
}

export default async function NetworkingMessagesPage(
  props: NetworkingMessagesPageProps,
): Promise<ReactElement> {
  const search = await props.searchParams;

  const { data } = await api.networking.messages.get({
    query: paginationQuery(search),
    ...(await getFetchOptions()),
  });

  if (!data) {
    notFound();
  }

  return (
    <>
      {/* The pilot's approval question deep-links straight to one draft. */}
      <NetworkingMessagesTable messages={data.items} openMessageId={one(search.message)} />
      <PaginationControls pagination={data.pagination} />
    </>
  );
}
