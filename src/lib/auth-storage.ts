import type { Session, User } from "@supabase/supabase-js";

export function authStorageKey() {
  const url = import.meta.env.VITE_SUPABASE_URL || "";
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "local";
  return `sb-${ref}-auth-token`;
}

export function persistSession(data: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: User;
}) {
  const session: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    token_type: data.token_type ?? "bearer",
    user: data.user,
  };
  localStorage.setItem(authStorageKey(), JSON.stringify(session));
  return session;
}

export function readCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(authStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.access_token && parsed?.user?.id) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function readCachedAccessToken(): string | null {
  return readCachedSession()?.access_token ?? null;
}
