"use client";

import type { LoginInput, RegisterInput } from "@jobpilot/contracts/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import {
  type ApiMutationResult,
  type ApiQueryResult,
  useApiMutation,
  useApiQuery,
} from "@/api/hooks";
import { authQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { AuthSessionResponse, AuthUserDto, LogoutResponse, MeResponse } from "@/api/types";

export interface UseAuthResult {
  user: AuthUserDto | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  meQuery: ApiQueryResult<MeResponse>;
  login: ApiMutationResult<AuthSessionResponse, LoginInput>;
  register: ApiMutationResult<AuthSessionResponse, RegisterInput>;
  logout: ApiMutationResult<LogoutResponse, void>;
}

/**
 * Current-session access. Reads the signed-in user from `/api/auth/me`
 * (auth rides the httpOnly cookie) and exposes login/register/logout
 * mutations. On a successful login or register the `me` query is
 * invalidated and the user is sent to `/workspace` - the proxy middleware
 * then routes on to `/onboarding` when the profile is empty.
 */
export function useAuth(): UseAuthResult {
  const router = useRouter();
  const queryClient = useQueryClient();

  const meQuery = useApiQuery(authQueries.me(), {
    retry: false,
    staleTime: 30_000,
  });

  const onSession = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    router.push("/workspace");
  };

  // The forms render these errors inline - no toast on top.
  const login = useApiMutation<AuthSessionResponse, LoginInput>(
    (body) => api.auth.login.post(body),
    { onSuccess: onSession, showErrorToast: false },
  );

  const register = useApiMutation<AuthSessionResponse, RegisterInput>(
    (body) => api.auth.register.post(body),
    { onSuccess: onSession, showErrorToast: false },
  );

  const logout = useApiMutation<LogoutResponse, void>(() => api.auth.logout.post(), {
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
  });

  return {
    user: meQuery.data?.user,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data?.user),
    meQuery,
    login,
    register,
    logout,
  };
}
