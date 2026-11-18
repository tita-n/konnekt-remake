"use client";

/** Browser helper: JSON fetch with the double-submit CSRF header. */
export function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)konnekt_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string } & T;
  if (!response.ok) throw new ApiError(data.error ?? "Something went wrong.", response.status, data.code);
  return data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-konnekt-csrf": csrfToken(),
    },
    body: JSON.stringify(body ?? {}),
  });
  return parse<T>(response);
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-konnekt-csrf": csrfToken() },
    body: JSON.stringify(body ?? {}),
  });
  return parse<T>(response);
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "x-konnekt-csrf": csrfToken() },
  });
  return parse<T>(response);
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<{ data: T; response: Response }> {
  const response = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
  const data = await parse<T>(response);
  return { data, response };
}
