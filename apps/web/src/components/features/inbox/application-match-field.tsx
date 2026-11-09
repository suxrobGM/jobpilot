"use client";

import { type ReactElement, useState } from "react";
import { Autocomplete, Link, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { applicationQueries, emailQueries } from "@/api/queries";
import type { ApplicationDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { applicationHref } from "@/utils/routes";

type MatchedApplication = Pick<ApplicationDto, "id" | "title" | "company">;

interface ApplicationMatchFieldProps {
  messageId: string;
  /** Seed only; key by message to reseed. */
  initial: MatchedApplication | null;
}

export function ApplicationMatchField(props: ApplicationMatchFieldProps): ReactElement {
  const { messageId, initial } = props;
  const [application, setApplication] = useState(initial);
  const [search, setSearch] = useState(initial?.company ?? "");
  const options = useQuery(applicationQueries.search(useDebouncedValue(search, 300)));
  const patchMatch = useApiMutation(
    (applicationId: string | null) =>
      api.email.messages({ id: messageId }).patch({ applicationId }),
    { invalidate: [emailQueries.all] },
  );

  return (
    <>
      <Autocomplete<MatchedApplication>
        options={options.data?.items ?? []}
        getOptionLabel={(o) => `${o.title} · ${o.company}`}
        value={application}
        onChange={(_, v) => {
          setApplication(v);
          patchMatch.mutate(v ? v.id : null);
        }}
        onInputChange={(_, v) => setSearch(v)}
        renderInput={(params) => <TextField {...params} label="Matches your application" />}
        isOptionEqualToValue={(a, b) => a.id === b.id}
      />
      {application && (
        <Link href={applicationHref(application.id)} variant="body2">
          Open the application for the documents sent and the posting
        </Link>
      )}
    </>
  );
}
