/** A single email header name/value pair as returned by Gmail's API. */
export interface EmailHeader {
  name?: string | null;
  value?: string | null;
}

/**
 * Extract the lowercased host portion of an email address.
 *
 * Returns an empty string if the input does not contain an `@`. Trims any
 * trailing whitespace or stray `>` characters so callers can pass raw header
 * values without sanitising first.
 */
export function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 0) return "";
  return address
    .slice(at + 1)
    .toLowerCase()
    .replace(/[>\s].*$/, "");
}

/**
 * Parse an RFC-5322 `From` / `To` header value into `{ email, name }`.
 *
 * Handles the common `"Name" <addr@host>` form and the bare `addr@host`
 * form. The email portion is lowercased; the display name (if any) is
 * trimmed of surrounding whitespace and quotes.
 */
export function parseAddress(headerValue: string): { email: string; name: string | null } {
  const match = headerValue.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]?.trim() || null;
    return { email: match[2].trim().toLowerCase(), name };
  }
  return { email: headerValue.trim().toLowerCase(), name: null };
}

/** Decode a Gmail base64url-encoded body part into a UTF-8 string. */
function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

/** Encode a UTF-8 string as base64url (no padding) - Gmail's `raw` format. */
export function encodeBase64Url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 2047 encode a header value when it contains non-ASCII characters. */
function encodeHeaderValue(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: RFC 2047 defines the ASCII range by codepoint
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/** A single file part for {@link buildMimeMessage}. `contentBase64` is std base64. */
export interface MimeAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

/**
 * Build a complete RFC822 message string (headers + body). With no
 * attachments it is a single `text/plain` part; with attachments it is a
 * `multipart/mixed` envelope. The `From` is left to the provider (Gmail fills
 * it from the authenticated account). Pass the result through
 * {@link encodeBase64Url} for Gmail's `raw` field.
 */
export function buildMimeMessage(input: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  attachments?: MimeAttachment[];
}): string {
  const headers: string[] = [
    `To: ${input.to}`,
    `Subject: ${encodeHeaderValue(input.subject)}`,
    "MIME-Version: 1.0",
  ];
  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`);
  }

  if (!input.attachments || input.attachments.length === 0) {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    return `${headers.join("\r\n")}\r\n\r\n${input.body}`;
  }

  const boundary = `jobpilot_${input.to.replace(/[^a-z0-9]/gi, "")}_boundary`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts: string[] = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.body,
  ];
  for (const att of input.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      att.contentBase64.replace(/(.{76})/g, "$1\r\n"),
    );
  }
  parts.push(`--${boundary}--`);

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}

/**
 * Walk a Gmail message payload tree and return the best text representation.
 *
 * Prefers any `text/plain` part. Falls back to the first `text/html` part
 * with HTML tags and common entities stripped so downstream consumers
 * (regex extractors, LLM classifiers) get readable plain text.
 */
export function extractPlainText(payload: unknown): string {
  const stack: unknown[] = [payload];
  let html: string | null = null;
  while (stack.length > 0) {
    const node = stack.pop() as
      | { mimeType?: string; body?: { data?: string }; parts?: unknown[] }
      | undefined;

    if (!node) {
      continue;
    }
    if (node.mimeType === "text/plain" && node.body?.data) {
      return decodeBase64Url(node.body.data);
    }
    if (node.mimeType === "text/html" && node.body?.data && !html) {
      html = decodeBase64Url(node.body.data);
    }
    if (node.parts) {
      for (const p of node.parts) stack.push(p);
    }
  }

  if (html) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
}

/**
 * Remove quoted reply chains ("On <date> ... wrote:" and `>`-prefixed lines)
 * so only the new content of a message remains. Used to keep email bodies
 * small before passing to classifiers.
 */
export function stripQuotedReplies(body: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:$/.test(line.trim())) {
      break;
    }
    if (line.trim().startsWith(">")) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Case-insensitive lookup of a header value by name. Returns an empty
 * string when the header is not present.
 */
export function headerValue(headers: EmailHeader[] | undefined, name: string): string {
  if (!headers) {
    return "";
  }
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.name?.toLowerCase() === lower) {
      return h.value ?? "";
    }
  }
  return "";
}
