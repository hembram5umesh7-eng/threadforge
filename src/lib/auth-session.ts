import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authStorageKey, persistSession, readCachedSession } from "@/lib/auth-storage";

export type AppRole = "user" | "admin" | "staff" | "manufacturer";

const VALID_ROLES = new Set<AppRole>(["user", "admin", "staff", "manufacturer"]);

export { authStorageKey, persistSession, readCachedSession };

export function rolesFromUser(user: User | null | undefined): AppRole[] {
  if (!user) return [];
  const meta = user.app_metadata?.roles;
  if (!Array.isArray(meta)) return [];
  return meta.filter((r): r is AppRole => typeof r === "string" && VALID_ROLES.has(r as AppRole));
}

export function canAccessAdminPanel(roles: AppRole[]) {
  return roles.includes("admin") || roles.includes("staff");
}

export function isSuperAdmin(roles: AppRole[]) {
  return roles.includes("admin");
}

export function resolvePostLoginRedirect(requested: string, roles: AppRole[]): string {
  if (requested && requested !== "/") return requested;
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("staff")) return "/staff";
  if (roles.includes("manufacturer")) return "/partner";
  return "/";
}

let syncPromise: Promise<Session | null> | null = null;

/** Sync localStorage session into supabase-js so RLS requests include JWT. */
export async function syncSupabaseSession(): Promise<Session | null> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing?.access_token) return existing;

    const cached = readCachedSession();
    if (!cached) return null;

    const setSessionPromise = supabase.auth.setSession({
      access_token: cached.access_token,
      refresh_token: cached.refresh_token,
    });

    const timeout = new Promise<{ data: { session: Session | null }; error: Error | null }>((resolve) => {
      window.setTimeout(
        () => resolve({ data: { session: cached }, error: null }),
        4000,
      );
    });

    const { data, error } = await Promise.race([setSessionPromise, timeout]);
    if (!error && data.session?.access_token) return data.session;

    const { data: { session: after } } = await supabase.auth.getSession();
    return after ?? cached;
  })();

  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
}

export async function loginWithPassword(email: string, password: string) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured. Check .env file.");

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      signal: controller.signal,
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || data.message || "Invalid email or password");
    }
    persistSession(data);
    await syncSupabaseSession();
    return data as { user: User; access_token: string; refresh_token: string };
  } finally {
    window.clearTimeout(timer);
  }
}
