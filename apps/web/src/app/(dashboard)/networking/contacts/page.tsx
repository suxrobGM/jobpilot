import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { ContactsTable } from "@/components/features/networking";
import { PaginationControls } from "@/components/ui/data";
import { type PaginationSearchParams, paginationQuery } from "@/utils/search-params";

export const metadata: Metadata = { title: "Contacts" };

interface NetworkingContactsPageProps {
  searchParams: Promise<PaginationSearchParams>;
}

export default async function NetworkingContactsPage(
  props: NetworkingContactsPageProps,
): Promise<ReactElement> {
  const search = await props.searchParams;

  const { data } = await api.contacts.get({
    query: paginationQuery(search),
    ...(await getFetchOptions()),
  });

  if (!data) {
    notFound();
  }

  return (
    <>
      <ContactsTable contacts={data.items} />
      <PaginationControls pagination={data.pagination} />
    </>
  );
}
