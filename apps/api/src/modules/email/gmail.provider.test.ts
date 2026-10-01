// Scope-string and history-paging helpers in isolation - no Google client, no database.

import {
  GMAIL_READ_SCOPE,
  GMAIL_SCOPES,
  GMAIL_SEND_SCOPE,
  type HistoryPage,
  isQuotaError,
  nextHistoryCursor,
  readAddedMessageIds,
  rethrowGmailError,
  scopeCanRead,
  scopeCanSend,
} from "./gmail.provider";
import { describe, expect, it } from "bun:test";

const FULL_GRANT = GMAIL_SCOPES.join(" ");

describe("scopeCanRead", () => {
  it("accepts a full grant", () => {
    expect(scopeCanRead(FULL_GRANT)).toBe(true);
  });

  it("rejects a grant the user narrowed at the consent screen", () => {
    expect(scopeCanRead(`${GMAIL_SEND_SCOPE} openid email`)).toBe(false);
  });

  it("rejects a sign-in-only grant", () => {
    expect(scopeCanRead("openid email profile")).toBe(false);
  });

  it("rejects a missing scope", () => {
    expect(scopeCanRead(null)).toBe(false);
    expect(scopeCanRead(undefined)).toBe(false);
    expect(scopeCanRead("")).toBe(false);
  });

  it("does not match a scope that merely shares a prefix", () => {
    expect(scopeCanRead("https://www.googleapis.com/auth/gmail.readonly.extra")).toBe(false);
  });
});

describe("scopeCanSend", () => {
  it("accepts a full grant", () => {
    expect(scopeCanSend(FULL_GRANT)).toBe(true);
  });

  it("rejects a read-only grant", () => {
    expect(scopeCanSend(`${GMAIL_READ_SCOPE} openid email`)).toBe(false);
  });
});

describe("rethrowGmailError", () => {
  const disabled = {
    status: 403,
    response: { data: { error: { errors: [{ reason: "accessNotConfigured" }] } } },
  };

  it("turns a disabled Gmail API into an actionable 422", () => {
    expect(() => rethrowGmailError(disabled)).toThrow(/Gmail API is not enabled/);
  });

  it("passes any other failure through untouched", () => {
    const other = new Error("network down");
    expect(() => rethrowGmailError(other)).toThrow(other);
  });
});

describe("readAddedMessageIds", () => {
  function pager(pages: HistoryPage[]) {
    const requested: (string | undefined)[] = [];
    const fetchPage = (pageToken?: string): Promise<HistoryPage> => {
      requested.push(pageToken);
      const index = pageToken === undefined ? 0 : Number(pageToken);
      return Promise.resolve(pages[index] as HistoryPage);
    };
    return { fetchPage, requested };
  }

  it("reads every page before the cursor moves", async () => {
    const { fetchPage, requested } = pager([
      { messageIds: ["a", "b"], historyId: "900", nextPageToken: "1" },
      { messageIds: ["c"], historyId: "900", nextPageToken: "2" },
      { messageIds: ["d"], historyId: "900", nextPageToken: null },
    ]);
    const result = await readAddedMessageIds(fetchPage);
    expect(result).toEqual({ messageIds: ["a", "b", "c", "d"], historyId: "900" });
    expect(requested).toEqual([undefined, "1", "2"]);
  });

  it("keeps going past a page the type filter left empty", async () => {
    const { fetchPage } = pager([
      { messageIds: [], historyId: "900", nextPageToken: "1" },
      { messageIds: ["a"], historyId: "900", nextPageToken: null },
    ]);
    expect((await readAddedMessageIds(fetchPage)).messageIds).toEqual(["a"]);
  });

  it("lists a message once when several history records add it", async () => {
    const { fetchPage } = pager([
      { messageIds: ["a", "b", "a"], historyId: "900", nextPageToken: "1" },
      { messageIds: ["b", "c"], historyId: "900", nextPageToken: null },
    ]);
    expect((await readAddedMessageIds(fetchPage)).messageIds).toEqual(["a", "b", "c"]);
  });

  it("reports no cursor when Gmail returns none", async () => {
    const { fetchPage } = pager([{ messageIds: [], historyId: null, nextPageToken: null }]);
    expect(await readAddedMessageIds(fetchPage)).toEqual({ messageIds: [], historyId: null });
  });
});

describe("nextHistoryCursor", () => {
  it("advances to the fetched cursor when every message was read", () => {
    expect(nextHistoryCursor("100", "250", 0)).toBe("250");
  });

  it("holds the previous cursor when a fetch failed, so the next sync retries it", () => {
    expect(nextHistoryCursor("100", "250", 1)).toBe("100");
  });
});

describe("isQuotaError", () => {
  it("recognises a 429", () => {
    expect(isQuotaError({ status: 429, message: "Too Many Requests" })).toBe(true);
  });

  it("recognises Gmail's per-user quota refusal, which arrives as a 403", () => {
    const message =
      "Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user'";
    expect(isQuotaError({ status: 403, message })).toBe(true);
  });

  it("leaves other failures alone", () => {
    expect(isQuotaError({ status: 500, message: "Backend Error" })).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});
