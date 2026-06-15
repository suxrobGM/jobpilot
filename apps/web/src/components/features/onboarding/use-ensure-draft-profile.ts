"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type {
  ActiveProfileResponse,
  CreateProfileResponse,
  ProfileListItemDto,
  SetActiveProfileResponse,
} from "@/api/types";
import { isProfileEmpty } from "@/utils/profile";

interface DraftProfileState {
  ready: boolean;
  draftProfileId: number | null;
  previousActiveId: number | null;
}

/**
 * Ensures an empty draft profile exists and is marked active. Reuses an
 * existing empty draft if one is found, otherwise creates a new one. Captures
 * the previously-active profile so the wizard can restore it on cancel.
 */
export function useEnsureDraftProfile(): DraftProfileState {
  const [state, setState] = useState<DraftProfileState>({
    ready: false,
    draftProfileId: null,
    previousActiveId: null,
  });
  const ranRef = useRef(false);

  const createProfile = useApiMutation<CreateProfileResponse, void>(() =>
    apiClient.post<CreateProfileResponse>("/api/profiles", {}),
  );

  const setActive = useApiMutation<SetActiveProfileResponse, number>(
    (profileId) => apiClient.post("/api/profiles/active", { profileId }),
    { invalidate: [queryKeys.profiles.all] },
  );

  useEffect(() => {
    if (ranRef.current) {
      return;
    }
    ranRef.current = true;

    const bootstrap = async (): Promise<void> => {
      const activeRes = await apiClient.get<ActiveProfileResponse>("/api/profiles/active");
      const previousActiveId = activeRes.data?.profileId ?? null;

      const list = await apiClient.get<ProfileListItemDto[]>("/api/profiles");
      const reusable = list.data?.find(isProfileEmpty);
      const draftId = reusable ? reusable.id : (await createProfile.mutateAsync()).id;

      const prior =
        previousActiveId !== null && previousActiveId !== draftId ? previousActiveId : null;

      if (!reusable || !reusable.isActive) {
        await setActive.mutateAsync(draftId);
      }

      setState({ ready: true, draftProfileId: draftId, previousActiveId: prior });
    };

    void bootstrap();
    // Runs exactly once (guarded by ranRef); the mutation handles are stable
    // for that single invocation.
  }, [createProfile, setActive]);

  return state;
}
