"use client";

import type { ApiResponse } from "./api";

export type ClientResult<T> = { data: T | null; error: { code: string; message: string } | null };

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<ClientResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok || !json.ok) {
      const e = !json.ok
        ? json.error
        : { code: `HTTP_${res.status}`, message: res.statusText };
      return { data: null, error: { code: e.code, message: e.message } };
    }
    return { data: json.data, error: null };
  } catch (e) {
    return {
      data: null,
      error: { code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Request failed" },
    };
  }
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
      const res = await fetch(url, { method: "POST", body: formData });
      const json = (await res.json()) as ApiResponse<T>;
      if (!res.ok || !json.ok) {
        const e = !json.ok
          ? json.error
          : { code: `HTTP_${res.status}`, message: res.statusText };
        return { data: null, error: { code: e.code, message: e.message } };
      }
      return { data: json.data, error: null };
    } catch (e) {
      return {
        data: null,
        error: { code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Upload failed" },
      };
    }
  },
};
