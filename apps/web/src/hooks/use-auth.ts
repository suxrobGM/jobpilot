"use client";

import type { DeleteAccountInput, LoginInput, RegisterInput } from "@jobpilot/contracts/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { authQueries } from "@/api/queries";
import type {
  AuthSessionResponse,
  AuthUserDto,
  DeleteAccountResponse,
  LogoutResponse,
} from "@/api/types";
import { type ApiMutationResult, useApiMutation } from "@/api/use-api-mutation";

export interface UseSessionResult {
  /** Null while loading and when signed out. */
  user: AuthUserDto | null;
}

export interface UseAuthActionsResult {
  login: ApiMutationResult<AuthSessionResponse, LoginInput>;
  register: ApiMutationResult<AuthSessionResponse, RegisterInput>;
  logout: ApiMutationResult<LogoutResponse, void>;
  deleteAccount: ApiMutationResult<DeleteAccountResponse, DeleteAccountInput>;
}

/** Separate from `useAuthActions` so signed-out pages don't drag in a guaranteed-401 `me` fetch. */
export function useSession(): UseSessionResult {
  const meQuery = useQuery({ ...authQueries.me(), retry: false });

  return { user: meQuery.data ?? null };
}

/** Login and register land on `/pilot`; the proxy routes an empty profile on to onboarding. */
export function useAuthActions(): UseAuthActionsResult {
  const router = useRouter();
  const queryClient = useQueryClient();

  const onSession = () => {
    queryClient.invalidateQueries({ queryKey: authQueries.me().queryKey });
    router.push("/pilot");
  };

  // The forms render these errors inline - no toast on top.
  const login = useApiMutation((body: LoginInput) => api.auth.login.post(body), {
    onSuccess: onSession,
    showErrorToast: false,
  });

  const register = useApiMutation((body: RegisterInput) => api.auth.register.post(body), {
    onSuccess: onSession,
    showErrorToast: false,
  });

  const onSignedOut = () => {
    queryClient.clear();
    router.push("/login");
  };

  const logout = useApiMutation(() => api.auth.logout.post(), { onSuccess: onSignedOut });

  const deleteAccount = useApiMutation(
    (body: DeleteAccountInput) => api.auth.account.delete(body),
    { onSuccess: onSignedOut, showErrorToast: false },
  );

  return { login, register, logout, deleteAccount };
}
