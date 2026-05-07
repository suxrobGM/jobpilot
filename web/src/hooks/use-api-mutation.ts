"use client";

import { useMutation, useQueryClient, type UseMutationOptions, type UseMutationResult } from "@tanstack/react-query";
import type { ClientResult } from "@/lib/api-client";
import { useToast } from "@/providers/notification-provider";

type MutationFn<TData, TVariables> = (vars: TVariables) => Promise<ClientResult<TData>>;

interface UseApiMutationOptions<TData, TVariables>
  extends Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn"> {
  successMessage?: string | ((data: TData, vars: TVariables) => string);
  errorMessage?: string | ((error: Error, vars: TVariables) => string);
  invalidate?: readonly unknown[][];
}

export function useApiMutation<TData, TVariables>(
  mutationFn: MutationFn<TData, TVariables>,
  options?: UseApiMutationOptions<TData, TVariables>,
): UseMutationResult<TData, Error, TVariables> {
  const opts = options ?? {};
  const { successMessage, errorMessage, invalidate, onSuccess, onError, ...rest } = opts;
  const toast = useToast();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (vars) => {
      const { data, error } = await mutationFn(vars);
      if (error) throw new Error(error.message);
      return data as TData;
    },
    onSuccess: (data, vars, ctx) => {
      if (invalidate) {
        for (const key of invalidate) queryClient.invalidateQueries({ queryKey: key });
      }
      if (successMessage !== undefined) {
        const msg = typeof successMessage === "function" ? successMessage(data, vars) : successMessage;
        toast.success(msg);
      }
      onSuccess?.(data, vars, ctx);
    },
    onError: (error, vars, ctx) => {
      if (errorMessage !== undefined) {
        const msg = typeof errorMessage === "function" ? errorMessage(error, vars) : errorMessage;
        toast.error(msg);
      } else {
        toast.error(error.message);
      }
      onError?.(error, vars, ctx);
    },
    ...rest,
  });
}
