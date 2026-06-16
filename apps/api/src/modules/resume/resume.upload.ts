import { badRequest } from "@/common/errors";

/** Pull a single `File` (and optional string field) out of a multipart request. */
export async function readUpload(
  request: Request,
  field = "file",
  textField?: string,
): Promise<{ file: File; text?: string }> {
  const form = await request.formData();
  const file = form.get(field);
  if (!(file instanceof File)) {
    throw badRequest(`${field} field is required`);
  }
  const text = textField ? form.get(textField) : null;
  return { file, text: typeof text === "string" ? text : undefined };
}
