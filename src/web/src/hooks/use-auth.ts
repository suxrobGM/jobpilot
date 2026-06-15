"use client";

import type { LoginInput, RegisterInput } from "@jobpilot/contracts/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import {
  useApiMutation,
  useApiQuery,
  type ApiMutationResult,
  type ApiQueryResult,
} from "@/api/hooks";
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
 * invalidated and the user is sent to `/` — the proxy middleware then
 * routes on to `/onboarding` when the profile is empty.
 */
export function useAuth(): UseAuthResult {
  const router = useRouter();
  const queryClient = useQueryClient();

  const meQuery = useApiQuery<MeResponse>(
    queryKeys.auth.me(),
    () => apiClient.get<MeResponse>("/api/auth/me"),
    { retry: false, staleTime: 30_000 },
  );

  const onSession = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    router.push("/");
  };

  const login = useApiMutation<AuthSessionResponse, LoginInput>(
    (body) => apiClient.post<AuthSessionResponse>("/api/auth/login", body),
    { onSuccess: onSession },
  );

  const register = useApiMutation<AuthSessionResponse, RegisterInput>(
    (body) => apiClient.post<AuthSessionResponse>("/api/auth/register", body),
    { onSuccess: onSession },
  );

  const logout = useApiMutation<LogoutResponse, void>(
    () => apiClient.post<LogoutResponse>("/api/auth/logout"),
    {
      onSuccess: () => {
        queryClient.clear();
        router.push("/login");
      },
    },
  );

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
