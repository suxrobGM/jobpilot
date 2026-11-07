"use client";

import type { ReactElement } from "react";
import { LinkedIn, MailOutlined } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { networkingQueries } from "@/api/queries";
import { TooltipIconButton } from "@/components/ui/buttons";
import { ListCell, ListHeader, ListLead, ListRow, PagedList } from "@/components/ui/data";
import { StatusChip } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { usePaginationParams } from "@/hooks/use-pagination";
import { initials } from "@/utils/format";
import { FOUND_VIA } from "./found-via";

export function ContactsList(): ReactElement {
  const pagination = usePaginationParams();
  const contacts = useQuery(networkingQueries.contacts(pagination.query));
  const rows = contacts.data?.items ?? [];

  return (
    <PagedList
      query={contacts}
      pager={pagination}
      isEmpty={rows.length === 0}
      errorTitle="Couldn't load contacts."
      empty={
        <EmptyState
          variant="inline"
          title="No contacts yet."
          description="Use Find contacts, or turn on networking in the pilot settings."
        />
      }
      header={<ListHeader>Hiring managers and recruiters, most recently found first</ListHeader>}
    >
      {rows.map((contact) => (
        <ListRow
          key={contact.id}
          lead={<ListLead>{initials(contact.name)}</ListLead>}
          title={contact.name}
          meta={[contact.title, contact.company].filter(Boolean).join(" · ")}
          columns={
            <>
              <ListCell width={260}>{contact.email ?? "No email"}</ListCell>
              <ListCell width={110}>
                {contact.discoverySource ? FOUND_VIA[contact.discoverySource] : ""}
              </ListCell>
            </>
          }
          actions={
            <>
              {contact.email && (
                <TooltipIconButton title="Email" href={`mailto:${contact.email}`} size="small">
                  <MailOutlined fontSize="sm" />
                </TooltipIconButton>
              )}
              {contact.linkedinUrl && (
                <TooltipIconButton title="LinkedIn profile" href={contact.linkedinUrl} size="small">
                  <LinkedIn fontSize="sm" />
                </TooltipIconButton>
              )}
            </>
          }
          status={<StatusChip domain="connection" value={contact.linkedinConnection} />}
        />
      ))}
    </PagedList>
  );
}
