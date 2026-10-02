import { storage } from "./safeStore";

/* ======================================================================
   What this module can and cannot do — read before extending.

   CAN (genuinely works, fully offline of any third party):
     • saveBlob()            → writes any bytes we already hold to a file the
                               user picks, via the File System Access API.
     • downloadImage()       → TMDB images send Access-Control-Allow-Origin:*
                               so their posters/backdrops are truly fetchable.
     • exportLibrary()       → our own watchlist / playlists / history as JSON.
     • downloadDirectFile()  → any URL that is CORS-open (plain .mp4/.srt/.jpg).

   CANNOT (and no front-end code can fix this):
     • The film files live on the embed providers' servers, on other origins,
       inside their own obfuscated players. A cross-origin fetch of them is
       refused by CORS, and DRM/stream-protected sources are unreadable by
       design. That is a browser security boundary, not a missing feature.
   ====================================================================== */

export interface Capabilities {
  filePicker: boolean;   // true → real "Save to…" into internal storage
  share: boolean;        // true → native share sheet
  persists: boolean;     // true → storage survives reloads
  secure: boolean;       // https / localhost, required by several APIs
}

export const capabilities = (): Capabilities => ({
  filePicker: typeof window !== "undefined" && "showSaveFilePicker" in window,
  share: typeof navigator !== "undefined" && !!navigator.share,
  persists: typeof window === "undefined" ? false : (() => { try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return true; } catch { return false; } })(),
  secure: typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost"),
});

export type SaveResult = "saved" | "downloaded" | "cancelled";

/**
 * Writes bytes to the user's device. Prefers the File System Access API so the
 * user chooses the exact folder on their internal storage. Falls back to a
 * plain anchor download. No redirects, no third-party pages.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  const anyWin = window as any;
  if (typeof anyWin.showSaveFilePicker === "function") {
    try {
      const handle = await anyWin.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (err: any) {
      if (err?.name === "AbortError") return "cancelled";
      // otherwise fall through to the anchor path
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "file";

/** Posters & backdrops come from TMDB with permissive CORS, so these really download. */
export async function downloadImage(url: string, filename: string): Promise<SaveResult> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Image server replied ${res.status}`);
  return saveBlob(await res.blob(), safeName(filename));
}

export interface Progress { received: number; total: number | null; pct: number | null }

/**
 * Fetches a direct media/subtitle URL that the server allows cross-origin.
 * Rejects with a plain-English reason when the origin blocks us — which is the
 * normal case for embed providers.
 */
export async function downloadDirectFile(
  url: string,
  filename: string,
  onProgress?: (p: Progress) => void,
  signal?: AbortSignal
): Promise<SaveResult> {
  let res: Response;
  try {
    res = await fetch(url, { mode: "cors", signal, credentials: "omit" });
  } catch (err: any) {
    if (err?.name === "AbortError") return "cancelled";
    throw new Error("That origin refused the request (CORS). The file can't be read from a browser.");
  }
  if (!res.ok) throw new Error(`Server replied ${res.status} ${res.statusText}`);

  const type = res.headers.get("content-type") || "application/octet-stream";
  if (/text\/html/i.test(type)) throw new Error("That link returned a web page, not a file.");

  const total = Number(res.headers.get("content-length")) || null;
  if (!res.body) return saveBlob(await res.blob(), filename);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.({ received, total, pct: total ? Math.round((received / total) * 100) : null });
    }
  }
  const blob = new Blob(chunks as BlobPart[], { type });
  onProgress?.({ received, total: total ?? received, pct: 100 });
  return saveBlob(blob, filename);
}

/* ---------------- Library export / import (always works) ---------------- */

export interface Library {
  app: "Arkaflix";
  version: 1;
  exportedAt: string;
  watchlist: unknown[];
  favourites: unknown[];
  playlists: unknown[];
  history: unknown[];
  account: string;
}

const read = (k: string) => { try { return JSON.parse(storage.getItem(k) || "[]"); } catch { return []; } };

export const collectLibrary = (account: string): Library => ({
  app: "Arkaflix",
  version: 1,
  exportedAt: new Date().toISOString(),
  account,
  watchlist: read(`cs_${account}_list`),
  favourites: read(`cs_${account}_favs`),
  playlists: read(`cs_${account}_playlists`),
  history: read(`cs_${account}_hist`),
});

export const exportLibrary = async (account: string) => {
  const data = JSON.stringify(collectLibrary(account), null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  return saveBlob(new Blob([data], { type: "application/json" }), `arkaflix-library-${account}-${stamp}.json`);
};

export const importLibrary = async (file: File, account: string) => {
  const parsed = JSON.parse(await file.text());
  if (parsed?.app !== "Arkaflix") throw new Error("That file isn't an Arkaflix library export.");
  const map: [string, unknown[]][] = [
    ["list", parsed.watchlist], ["favs", parsed.favourites],
    ["playlists", parsed.playlists], ["hist", parsed.history],
  ];
  let moved = 0;
  for (const [key, rows] of map) {
    if (!Array.isArray(rows)) continue;
    const existing = read(`cs_${account}_${key}`);
    const merged = [...rows.filter((r: any) => !existing.some((e: any) => e.id === r.id)), ...existing];
    storage.setItem(`cs_${account}_${key}`, JSON.stringify(merged));
    moved += rows.length;
  }
  return moved;
};

/* ---------------- Install as an app (the honest APK/EXE path) ---------------- */

export interface InstallState { available: boolean; installed: boolean; platform: string }

let deferred: any = null;
type Listener = (s: InstallState) => void;
const listeners = new Set<Listener>();

export const onInstallChange = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((l) => l(state()));

const platform = () => {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "this device";
};

export const state = (): InstallState => ({
  available: !!deferred,
  installed: window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true,
  platform: platform(),
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
}

/** Opens the browser's own install dialog — installs a real app, no store, no download. */
export async function installApp(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome === "accepted" ? "accepted" : "dismissed";
}

export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("sw.js").catch(() => { /* preview frames often block this */ });
};
