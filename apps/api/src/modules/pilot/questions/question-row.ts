import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import type { PilotQuestion as PilotQuestionModel } from "@/generated/prisma/client";

const optionsSchema = z.array(z.string());

export function toPilotQuestion(row: PilotQuestionModel): PilotQuestion {
  return { ...row, options: optionsSchema.parse(row.options) };
}
