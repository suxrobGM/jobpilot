"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { ClientResult } from "@/api/client";
import { useToast } from "@/providers/notification-provider";

type MutationFn<TData, TVariables> = (vars: TVariables) => Promise<ClientResult<TData>>;

type UseApiMutationOptions<TData, TVariables, TContext = unknown> = Omit<
  UseMutationOptions<TData, Error, TVariables, TContext>,
  "mutationFn" | "onSuccess" | "onError"
> & {
  successMessage?: string | ((data: TData, vars: TVariables) => string);
  errorMessage?: string | ((error: Error, vars: TVariables) => string);
  invalidate?: ReadonlyArray<ReadonlyArray<unknown>>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
};

export type ApiMutationResult<TData, TVariables = void, TContext = unknown> = Omit<
  UseMutationResult<TData, Error, TVariables, TContext>,
  "data" | "error"
> & {
  data: TData | undefined;
  error: Error | null;
};

export function useApiMutation<TData, TVariables = void, TContext = unknown>(
  mutationFn: MutationFn<TData, TVariables>,
  options?: UseApiMutationOptions<NoInfer<TData>, NoInfer<TVariables>, TContext>,
): ApiMutationResult<TData, TVariables, TContext> {
  const { successMessage, errorMessage, invalidate, onSuccess, onError, ...rest } = options ?? {};
  const toast = useToast();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: async (vars: TVariables) => {
      const { data, error } = await mutationFn(vars);
      if (error) {
        throw new Error(error.message);
      }
      return data as TData;
    },
    onSuccess: (data: TData, vars: TVariables) => {
      if (invalidate) {
        for (const key of invalidate) {
          queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }
      if (successMessage) {
        const msg =
          typeof successMessage === "function" ? successMessage(data, vars) : successMessage;
        toast.success(msg);
      }
      onSuccess?.(data, vars);
    },
    onError: (error: Error, vars: TVariables) => {
      if (errorMessage) {
        const msg = typeof errorMessage === "function" ? errorMessage(error, vars) : errorMessage;
        toast.error(msg);
      } else {
        toast.error(error.message);
      }
      onError?.(error, vars);
    },
    ...rest,
  }) as ApiMutationResult<TData, TVariables, TContext>;
}
