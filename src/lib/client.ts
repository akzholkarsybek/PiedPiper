"use client";

/** No login: the browser remembers which profile it is. Use an incognito window to be a second person. */
const KEY = "wingmate.profileId";

export function getMyId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setMyId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const me = getMyId();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(me ? { "x-profile-id": me } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Read an NDJSON stream line by line. */
export async function streamEvents<E>(path: string, body: unknown, onEvent: (e: E) => void | Promise<void>): Promise<void> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Stream failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) await onEvent(JSON.parse(line) as E);
    }
  }
  if (buf.trim()) await onEvent(JSON.parse(buf) as E);
}
