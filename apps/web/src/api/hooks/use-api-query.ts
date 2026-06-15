"use client";

import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ClientResult } from "@/api/client";
import { useToast } from "@/providers/notification-provider";

type QueryFn<T> = () => Promise<ClientResult<T>>;

type ApiQueryKey = readonly unknown[];

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
  queryKey: ApiQueryKey,
  queryFn: QueryFn<TData>,
  options?: UseApiQueryOptions<NoInfer<TData>, TSelected>,
): ApiQueryResult<TSelected> {
  const { errorMessage, ...queryOptions } = options ?? {};
  const toast = useToast();

  const result = useQuery<TData, Error, TSelected, ApiQueryKey>({
    queryKey,
    queryFn: async (): Promise<TData> => {
      const { data, error } = await queryFn();
      if (error) {
        throw new Error(error.message);
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
