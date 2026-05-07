import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { credentialPatchSchema } from "@/lib/schemas/credential";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const credId = Number(id);
  if (!Number.isInteger(credId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  const body = await req.json();
  const parsed = credentialPatchSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid patch", 422, parsed.error.issues);
  }
  try {
    const cred = await db.credential.update({ where: { id: credId }, data: parsed.data });
    return ok(cred);
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Credential not found", 404);
    }
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const credId = Number(id);
  if (!Number.isInteger(credId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  try {
    await db.credential.delete({ where: { id: credId } });
    return ok({ deleted: credId });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Credential not found", 404);
    }
    throw e;
  }
}
