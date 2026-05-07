import { ok } from "@/lib/api";

const VERSION = "2.0.0";

export async function GET() {
  return ok({ version: VERSION, time: new Date().toISOString() });
}
