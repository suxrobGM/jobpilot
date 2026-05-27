import type { ResumeBasics } from "@/lib/schemas/resume";
import { normalizeLinkUrl } from "@/utils/url";

type ProfileTextFieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "website"
  | "linkedin"
  | "github"
  | "city"
  | "state";

// Minimal slice of a TanStack form this helper needs — accepts the typed
// `useAppForm` instance without dragging in its full generic signature.
interface ProfileFieldWriter {
  getFieldValue: (name: ProfileTextFieldName) => unknown;
  setFieldValue: (name: ProfileTextFieldName, value: string) => void;
}

export function applyBasicsToForm(form: ProfileFieldWriter, basics: ResumeBasics): void {
  const [firstName, lastName] = splitName(basics.name);

  setIfEmpty(form, "firstName", firstName);
  setIfEmpty(form, "lastName", lastName);
  setIfEmpty(form, "email", basics.email);
  setIfEmpty(form, "phone", basics.phone);
  setIfEmpty(form, "website", basics.website && normalizeLinkUrl(basics.website));
  setIfEmpty(form, "linkedin", basics.linkedin && normalizeLinkUrl(basics.linkedin));
  setIfEmpty(form, "github", basics.github && normalizeLinkUrl(basics.github));

  const { city, state } = parseLocation(basics.location);
  setIfEmpty(form, "city", city);
  setIfEmpty(form, "state", state);
}

function setIfEmpty(
  form: ProfileFieldWriter,
  name: ProfileTextFieldName,
  next?: string | null,
): void {
  if (!next) {
    return;
  }

  const current = form.getFieldValue(name);
  if (typeof current === "string" && current.trim() !== "") {
    return;
  }
  form.setFieldValue(name, next);
}

function splitName(name: string): [string, string] {
  const trimmed = name.trim();
  if (!trimmed) {
    return ["", ""];
  }

  const idx = trimmed.indexOf(" ");
  if (idx === -1) {
    return [trimmed, ""];
  }
  return [trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim()];
}

function parseLocation(location?: string): { city: string; state: string } {
  if (!location) {
    return { city: "", state: "" };
  }

  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { city: "", state: "" };
  }
  if (parts.length === 1) {
    return { city: parts[0]!, state: "" };
  }

  const state = parts[parts.length - 1]!.split(/\s+/)[0]!;
  const city = parts.slice(0, -1).join(", ");
  return { city, state };
}
