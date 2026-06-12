import { upworkClientQualitySchema } from "@/api/contracts/upwork";
import { api } from "@/server/api/route";
import { scoreUpworkClient } from "@/server/scoring/upwork-quality";

// Deterministic Upwork client/job quality assessment used by the `upwork-search`
// skill to smart-filter postings. Profile-independent, like a calculator.
export const POST = api.route({ body: upworkClientQualitySchema, public: true }, ({ body }) =>
  scoreUpworkClient(body.client),
);
