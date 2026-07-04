/** Turn TanStack/Zod server-fn errors into readable toast messages. */
export function formatServerFnError(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Response) {
    return fallback;
  }

  const raw = error instanceof Error ? error.message : String(error ?? "");

  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const issue = parsed[0] as { message?: string; path?: (string | number)[] };
        const field = issue.path?.[0];
        const msg = issue.message ?? "Invalid input";
        if (field === "email" && msg.toLowerCase().includes("email")) {
          return "Enter a valid email address (e.g. supplier@company.com)";
        }
        if (field) return `${String(field)}: ${msg}`;
        return msg;
      }
    } catch {
      /* not JSON */
    }
  }

  if (/invalid email/i.test(raw)) {
    return "Enter a valid email address (e.g. supplier@company.com)";
  }

  if (/unauthorized/i.test(raw)) return "Session expired — please sign in again";
  if (/forbidden/i.test(raw)) return "You don't have permission for this action";

  return raw.trim() || fallback;
}

export function parseEmailInput(email: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = email.trim().toLowerCase();
  if (!value) return { ok: false, message: "Email is required" };
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!valid) {
    return { ok: false, message: "Enter a valid email (e.g. supplier@company.com)" };
  }
  return { ok: true, value };
}
