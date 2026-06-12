import { updateUpworkProfileSchema } from "@/api/contracts/upwork";
import { upworkChannel } from "@/lib/sse/channels/upwork";
import { publish } from "@/lib/sse/server";
import { api } from "@/server/api/route";
import { getUpworkProfile, upsertUpworkProfile } from "@/server/upwork/profile";

export const GET = api.route({}, ({ profileId }) => getUpworkProfile(profileId));

export const PUT = api.route({ body: updateUpworkProfileSchema }, async ({ body, profileId }) => {
  const profile = await upsertUpworkProfile(profileId, body);
  publish(upworkChannel, { profileId }, { type: "profile.updated" });
  return profile;
});
