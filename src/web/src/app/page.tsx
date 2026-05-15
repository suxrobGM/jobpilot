import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { PipelineView } from "@/components/features/pipeline";
import { apiGet } from "@/lib/api/api-server";
import type { ProfileResponse } from "@/types/api";

export default async function HomePage(): Promise<ReactElement> {
  const { data } = await apiGet<ProfileResponse>("/api/profile");
  if (data && data.profile === null) {
    redirect("/onboarding");
  }
  return <PipelineView />;
}
