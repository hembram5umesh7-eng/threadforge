import { readCachedAccessToken } from "@/lib/auth-storage";

/** Bearer token for TanStack server function calls (requireSupabaseAuth middleware). */
export async function getAuthRequestHeaders(): Promise<HeadersInit> {
  const token = readCachedAccessToken();
  if (!token) throw new Error("Not signed in — please log in again");
  return { Authorization: `Bearer ${token}` };
}
