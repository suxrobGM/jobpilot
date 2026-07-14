"use client";

import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiErrorMessage, type EdenResult } from "@/api/error";
import { useToast } from "@/providers/notification-provider";

type ApiQueryKey = readonly unknown[];

/** A per-endpoint (queryKey, queryFn) pair; built by the factories in `@/api/queries`. */
export interface ApiQueryDef<TData> {
  queryKey: ApiQueryKey;
  queryFn: () => Promise<EdenResult<TData>>;
}

type UseApiQueryOptions<TData, TSelected = TData> = Omit<
  UseQueryOptions<TData, Error, TSelected, ApiQueryKey>,
  "queryKey" | "queryFn"
> & {
  errorMessage?: string | ((error: Error) => string);
};

export type ApiQueryResult<TData> = Omit<UseQueryResult<TData, Error>, "data" | "error"> & {
  data: TData | undefined;
  error: Error | null;
};

export function useApiQuery<TData, TSelected = TData>(
  def: ApiQueryDef<TData>,
  options?: UseApiQueryOptions<NoInfer<TData>, TSelected>,
): ApiQueryResult<TSelected> {
  const { queryKey, queryFn } = def;
  const { errorMessage, ...queryOptions } = options ?? {};
  const toast = useToast();

  const result = useQuery<TData, Error, TSelected, ApiQueryKey>({
    queryKey,
    queryFn: async (): Promise<TData> => {
      const { data, error } = await queryFn();
      if (error) {
        throw new Error(apiErrorMessage(error));
      }
      return data as TData;
    },
    ...queryOptions,
  });

  useEffect(() => {
    if (result.error && errorMessage !== undefined) {
      const msg = typeof errorMessage === "function" ? errorMessage(result.error) : errorMessage;
      toast.error(msg);
    }
  }, [result.error, errorMessage, toast]);

  return result as ApiQueryResult<TSelected>;
}
