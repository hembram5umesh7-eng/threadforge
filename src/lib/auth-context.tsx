import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  type AppRole,
  readCachedSession,
  rolesFromUser,
  syncSupabaseSession,
  canAccessAdminPanel,
  isSuperAdmin,
} from "@/lib/auth-session";

export type { AppRole };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  ready: boolean;
  /** Super admin (full control incl. staff management) */
  isAdmin: boolean;
  /** Store worker — admin panel access on behalf of admin */
  isStaff: boolean;
  /** Admin or staff — can open admin panel */
  canAccessAdmin: boolean;
  isManufacturer: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function applyAuth(session: Session | null) {
  const nextUser = session?.user ?? null;
  const roles = rolesFromUser(nextUser);
  return { session, user: nextUser, roles };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = readCachedSession();
  const [session, setSession] = useState<Session | null>(cached);
  const [user, setUser] = useState<User | null>(cached?.user ?? null);
  const [roles, setRoles] = useState<AppRole[]>(() => rolesFromUser(cached?.user));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const commit = (next: Session | null) => {
      if (!active) return;
      const state = applyAuth(next);
      setSession(state.session);
      setUser(state.user);
      setRoles(state.roles);
    };

    void (async () => {
      const synced = await syncSupabaseSession();
      if (!active) return;
      commit(synced ?? readCachedSession());
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      commit(nextSession ?? readCachedSession());
      if (active) setReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
  };

  const value = useMemo(() => {
    const effectiveRoles = roles.length > 0 ? roles : rolesFromUser(user);
    return {
      user,
      session,
      roles: effectiveRoles,
      ready,
      isAdmin: isSuperAdmin(effectiveRoles),
      isStaff: effectiveRoles.includes("staff"),
      canAccessAdmin: canAccessAdminPanel(effectiveRoles),
      isManufacturer: effectiveRoles.includes("manufacturer"),
      signOut,
    };
  }, [user, session, roles, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
