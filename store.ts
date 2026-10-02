import { Item, MediaType, sk } from "./tmdb";
import { storage } from "./safeStore";

export interface User { id: string; name: string; avatar: string; color: string; pass: string; created: number }
export type Saved = Item & { media_type: MediaType };
export interface Playlist { id: string; name: string; items: Saved[]; created: number }
export interface Review { user: string; avatar: string; color: string; rating: number; text: string; at: number }

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); };

export const AVATARS = ["🦊", "🐼", "🐯", "🦁", "🐸", "🐙", "👽", "🤖", "🦄", "🐲", "🎃", "🐵"];
export const COLORS = ["#e50914", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export const users = () => read<User[]>("cs_users", []);
export const currentUser = (): User | null => users().find((u) => u.id === localStorage.getItem("cs_user")) || null;

export function signUp(name: string, pass: string, avatar: string, color: string): User | string {
  name = name.trim();
  if (name.length < 2) return "Name must be at least 2 characters";
  if (pass.length < 4) return "Password must be at least 4 characters";
  if (users().some((u) => u.name.toLowerCase() === name.toLowerCase())) return "That name is taken";
  const u: User = { id: Math.random().toString(36).slice(2, 10), name, avatar, color, pass: hash(pass), created: Date.now() };
  write("cs_users", [...users(), u]);
  // migrate guest data on first signup
  ["list", "hist", "favs", "playlists"].forEach((k) => { const g = storage.getItem(`cs_guest_${k}`); if (g && !storage.getItem(`cs_${u.id}_${k}`)) storage.setItem(`cs_${u.id}_${k}`, g); });
  storage.setItem("cs_user", u.id);
  return u;
}
export function signIn(name: string, pass: string): User | string {
  const u = users().find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  if (!u) return "No account with that name";
  if (u.pass !== hash(pass)) return "Incorrect password";
  localStorage.setItem("cs_user", u.id);
  return u;
}
export const signOut = () => localStorage.removeItem("cs_user");

// Favorites
export const getFavs = () => read<Saved[]>(sk("favs"), []);
export const isFav = (id: number) => getFavs().some((x) => x.id === id);
export const toggleFav = (i: Item, t: MediaType) => {
  const l = getFavs(); const ex = l.some((x) => x.id === i.id);
  write(sk("favs"), ex ? l.filter((x) => x.id !== i.id) : [{ ...i, media_type: t }, ...l]);
  return !ex;
};

// Playlists
export const getPlaylists = () => read<Playlist[]>(sk("playlists"), []);
export const savePlaylists = (p: Playlist[]) => write(sk("playlists"), p);
export const createPlaylist = (name: string) => { const p: Playlist = { id: Math.random().toString(36).slice(2, 9), name, items: [], created: Date.now() }; savePlaylists([...getPlaylists(), p]); return p; };
export const togglePlaylistItem = (pid: string, i: Item, t: MediaType) => {
  let added = false;
  savePlaylists(getPlaylists().map((p) => {
    if (p.id !== pid) return p;
    const ex = p.items.some((x) => x.id === i.id); added = !ex;
    return { ...p, items: ex ? p.items.filter((x) => x.id !== i.id) : [...p.items, { ...i, media_type: t }] };
  }));
  return added;
};
export const deletePlaylist = (pid: string) => savePlaylists(getPlaylists().filter((p) => p.id !== pid));

// Community reviews (shared across local accounts)
export const getReviews = (t: MediaType, id: number) => read<Review[]>(`cs_reviews_${t}_${id}`, []);
export const addReview = (t: MediaType, id: number, r: Review) => write(`cs_reviews_${t}_${id}`, [r, ...getReviews(t, id).filter((x) => x.user !== r.user)]);
