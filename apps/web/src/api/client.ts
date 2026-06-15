"use client";

export type ClientResult<T> = { data: T | null; error: { code: string; message: string } | null };

async function parseError(res: Response): Promise<{ code: string; message: string }> {
  const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  return {
    code: body?.code ?? `HTTP_${res.status}`,
    message: body?.message ?? res.statusText,
  };
}

async function readBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function request<T>(url: string, init?: RequestInit): Promise<ClientResult<T>> {
  try {
    const res = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      return { data: null, error: await parseError(res) };
    }
    // The backend returns the bare payload (no { ok, data } envelope).
    return { data: await readBody<T>(res), error: null };
  } catch (e) {
    return {
      data: null,
      error: { code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Request failed" },
    };
  }
}

/**
 * Adapt an Eden Treaty call's `{ data, error }` result to the `ClientResult`
 * shape the TanStack Query wrappers expect, so `useApiQuery`/`useApiMutation`
 * stay unchanged. Usage: `() => unwrap(api.credentials.get())`. The response
 * type flows from the backend `App` through Eden — no manual generic needed.
 */
export async function unwrap<T>(
  call: Promise<{ data: T | null; error: { status: unknown; value: unknown } | null }>,
): Promise<ClientResult<T>> {
  const { data, error } = await call;
  if (error) {
    const body = (error.value ?? null) as { code?: string; message?: string } | null;
    const status = String(error.status);
    return {
      data: null,
      error: {
        code: body?.code ?? `HTTP_${status}`,
        message: body?.message ?? `Request failed (${status})`,
      },
    };
  }
  return { data: data as T, error: null };
}

export const apiClient = {
  get: <T>(url: string) => request<T>(url),

  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),

  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),

  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),

  upload: async <T>(url: string, formData: FormData): Promise<ClientResult<T>> => {
    try {
      const res = await fetch(url, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        return { data: null, error: await parseError(res) };
      }
      return { data: await readBody<T>(res), error: null };
    } catch (e) {
      return {
        data: null,
        error: { code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Upload failed" },
      };
    }
  },
};
