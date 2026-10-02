/**
 * Storage that never throws.
 *
 * Sandboxed iframes, some private-browsing modes and blocked third-party
 * cookies all make `localStorage` raise a SecurityError the moment it is
 * touched — which would take the whole profile screen down with it. This
 * wrapper probes once, then quietly degrades to in-memory storage so the app
 * keeps running either way.
 */
const mem = new Map<string, string>();
let ok: boolean | null = null;

const probe = (): boolean => {
  if (ok !== null) return ok;
  try {
    const k = "__ark_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    ok = true;
  } catch {
    ok = false;
  }
  return ok;
};

/** True when data survives a reload; false when we're on the in-memory fallback. */
export const isPersistent = () => probe();

export const storage = {
  getItem(key: string): string | null {
    if (probe()) {
      try { return localStorage.getItem(key); } catch { ok = false; }
    }
    return mem.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    if (probe()) {
      try { localStorage.setItem(key, value); return; } catch { ok = false; }
    }
    mem.set(key, value);
  },
  removeItem(key: string): void {
    if (probe()) {
      try { localStorage.removeItem(key); return; } catch { ok = false; }
    }
    mem.delete(key);
  },
};
