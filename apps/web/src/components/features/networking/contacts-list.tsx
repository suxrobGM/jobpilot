"use client";

import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { networkingQueries } from "@/api/queries";
import { PaginationFooter } from "@/components/ui/data";
import { usePaginationParams } from "@/hooks/use-pagination";
import { ContactsTable } from "./contacts-table";

export function ContactsList(): ReactElement {
  const pagination = usePaginationParams();
  const contacts = useQuery(networkingQueries.contacts(pagination.query));

  return (
    <>
      <ContactsTable
        contacts={contacts.data?.items ?? []}
        loading={contacts.isPending}
        errorTitle={contacts.isError ? "Couldn't load contacts." : undefined}
        onRetry={() => void contacts.refetch()}
      />
      {contacts.data && (
        <PaginationFooter
          pagination={contacts.data.pagination}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </>
  );
}
