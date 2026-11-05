"use client";

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { type EdenResult, unwrap } from "@/api/error";
import { useToast } from "@/providers/toast-provider";

type MutationFn<TData, TVariables> = (vars: TVariables) => Promise<EdenResult<TData>>;

type UseApiMutationOptions<TData, TVariables, TContext = unknown> = Omit<
  UseMutationOptions<TData, Error, TVariables, TContext>,
  "mutationFn" | "onSuccess" | "onError"
> & {
  successMessage?: string | ((data: TData, vars: TVariables) => string);
  errorMessage?: string | ((error: Error, vars: TVariables) => string);
  /** Set false when the caller renders the error inline (avoids the duplicate toast). */
  showErrorToast?: boolean;
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
  const {
    successMessage,
    errorMessage,
    showErrorToast = true,
    invalidate,
    onSuccess,
    onError,
    ...rest
  } = options ?? {};
  const toast = useToast();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: (vars: TVariables) => unwrap(mutationFn(vars)),
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
      if (showErrorToast) {
        const msg =
          typeof errorMessage === "function"
            ? errorMessage(error, vars)
            : (errorMessage ?? error.message);
        toast.error(msg);
      }
      onError?.(error, vars);
    },
    ...rest,
  }) as ApiMutationResult<TData, TVariables, TContext>;
}
