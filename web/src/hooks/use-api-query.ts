"use client";

import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ClientResult } from "@/lib/api-client";
import { useToast } from "@/providers/notification-provider";

type QueryFn<T> = () => Promise<ClientResult<T>>;

interface UseApiQueryOptions<T> extends Omit<UseQueryOptions<T>, "queryKey" | "queryFn"> {
  errorMessage?: string | ((error: Error) => string);
}

export function useApiQuery<T>(
  queryKey: readonly unknown[],
  queryFn: QueryFn<T>,
  options?: UseApiQueryOptions<T>,
): UseQueryResult<T> {
  const opts = options ?? {};
  const { errorMessage, ...queryOptions } = opts;
  const toast = useToast();

  const result = useQuery<T>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await queryFn();
      if (error) throw new Error(error.message);
      return data as T;
    },
    ...queryOptions,
  });

  useEffect(() => {
    if (result.error && errorMessage !== undefined) {
      const msg = typeof errorMessage === "function" ? errorMessage(result.error) : errorMessage;
      toast.error(msg);
    }
  }, [result.error, errorMessage, toast]);

  return result;
}
