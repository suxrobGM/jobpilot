"use client";

import type { LoginInput, RegisterInput } from "@jobpilot/contracts/auth";
import { type UseQueryResult, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { type ApiMutationResult, useApiMutation } from "@/api/hooks";
import { authQueries } from "@/api/queries";
import type { AuthSessionResponse, AuthUserDto, LogoutResponse, MeResponse } from "@/api/types";

export interface UseSessionResult {
  user: AuthUserDto | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  meQuery: UseQueryResult<MeResponse>;
}

export interface UseAuthActionsResult {
  login: ApiMutationResult<AuthSessionResponse, LoginInput>;
  register: ApiMutationResult<AuthSessionResponse, RegisterInput>;
  logout: ApiMutationResult<LogoutResponse, void>;
}

/**
 * The signed-in user, read from `/api/auth/me` (auth rides the httpOnly cookie).
 * Kept separate from `useAuthActions` so the signed-out pages that only need
 * login/register can't drag a guaranteed-401 `me` fetch onto themselves.
 */
export function useSession(): UseSessionResult {
  const meQuery = useQuery({ ...authQueries.me(), retry: false, staleTime: 30_000 });

  return {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    meQuery,
  };
}

/**
 * Login/register/logout mutations. On a successful login or register the `me`
 * query is invalidated and the user is sent to `/workspace` - the proxy
 * middleware then routes on to `/onboarding` when the profile is empty.
 */
export function useAuthActions(): UseAuthActionsResult {
  const router = useRouter();
  const queryClient = useQueryClient();

  const onSession = () => {
    queryClient.invalidateQueries({ queryKey: authQueries.me().queryKey });
    router.push("/workspace");
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

  const logout = useApiMutation(() => api.auth.logout.post(), {
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
  });

  return { login, register, logout };
}
