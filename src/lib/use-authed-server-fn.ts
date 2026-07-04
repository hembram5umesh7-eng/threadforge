import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAuthRequestHeaders } from "@/lib/server-fn-auth";
import { formatServerFnError } from "@/lib/server-fn-error";

type ServerFn = (...args: unknown[]) => Promise<unknown>;

/** Wraps useServerFn and attaches Supabase Bearer token on every call. */
export function useAuthedServerFn<T extends ServerFn>(serverFn: T) {
  const fn = useServerFn(serverFn);
  return useCallback(
    async (...args: Parameters<T>) => {
      try {
        const headers = await getAuthRequestHeaders();
        const first = args[0];
        if (first && typeof first === "object" && !Array.isArray(first)) {
          return await fn({ ...(first as object), headers }) as ReturnType<T>;
        }
        return await fn({ headers }) as ReturnType<T>;
      } catch (err) {
        throw new Error(formatServerFnError(err));
      }
    },
    [fn],
  );
}
