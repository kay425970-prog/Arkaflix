import { storage } from "./safeStore";

const TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzNzEyMWY4MDU3NGM0ODBlNzAwY2FjMTNlYjIzODNlNiIsIm5iZiI6MTc5MDg4MTA4Ny45MzI5OTk4LCJzdWIiOiI2YWJlYWQzZmMwYjI3ZWUyYmNkNzM0YTgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.6WYzMu7W4t4xdIaZADDE2aYUGWqjxIyn1pfyRdCgb-A";
const KEY = "37121f80574c480e700cac13eb2383e6";

export type MediaType = "movie" | "tv";
export interface Item {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre_ids?: number[];
}

export const img = (p: string | null, size = "w500") =>
  p ? `https://image.tmdb.org/t/p/${size}${p}` : "";

export async function tmdb<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ language: "en-US", ...params });
  const url = `https://api.themoviedb.org/3${path}?${qs}`;
  let r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, accept: "application/json" } });
  if (!r.ok) {
    qs.set("api_key", KEY);
    r = await fetch(`https://api.themoviedb.org/3${path}?${qs}`);
  }
  if (!r.ok) throw new Error("TMDB error " + r.status);
  return r.json();
}

export const titleOf = (i: Item) => i.title || i.name || "Untitled";
export const yearOf = (i: Item) => (i.release_date || i.first_air_date || "").slice(0, 4);
export const typeOf = (i: Item, fallback: MediaType = "movie"): MediaType =>
  i.media_type === "tv" || i.media_type === "movie" ? (i.media_type as MediaType) : i.first_air_date ? "tv" : fallback;

export interface ServerDef { id: string; name: string; tag?: string; movie: (id: number) => string; tv: (id: number, s: number, e: number) => string }
export const SERVERS: ServerDef[] = [
  { id: "vidcore", name: "VidCore", tag: "Fast", movie: (i) => `https://vidcore.org/embed/movie/${i}`, tv: (i, s, e) => `https://vidcore.org/embed/series/${i}/${s}/${e}` },
  { id: "vidking", name: "VidKing", tag: "4K", movie: (i) => `https://www.vidking.net/embed/movie/${i}?color=e50914&autoPlay=true`, tv: (i, s, e) => `https://www.vidking.net/embed/tv/${i}/${s}/${e}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true` },
  { id: "vidlink", name: "VidLink", tag: "Subs", movie: (i) => `https://vidlink.pro/movie/${i}?primaryColor=e50914&autoplay=true`, tv: (i, s, e) => `https://vidlink.pro/tv/${i}/${s}/${e}?primaryColor=e50914&autoplay=true&nextbutton=true` },
  { id: "videasy", name: "Videasy", tag: "Subs", movie: (i) => `https://player.videasy.net/movie/${i}?color=e50914`, tv: (i, s, e) => `https://player.videasy.net/tv/${i}/${s}/${e}?color=e50914&nextEpisode=true&episodeSelector=true` },
  { id: "vidsrccc", name: "VidSrc CC", movie: (i) => `https://vidsrc.cc/v2/embed/movie/${i}`, tv: (i, s, e) => `https://vidsrc.cc/v2/embed/tv/${i}/${s}/${e}` },
  { id: "vidsrcto", name: "VidSrc TO", movie: (i) => `https://vidsrc.to/embed/movie/${i}`, tv: (i, s, e) => `https://vidsrc.to/embed/tv/${i}/${s}/${e}` },
  { id: "embedsu", name: "Embed.su", movie: (i) => `https://embed.su/embed/movie/${i}`, tv: (i, s, e) => `https://embed.su/embed/tv/${i}/${s}/${e}` },
  { id: "autoembed", name: "AutoEmbed", movie: (i) => `https://player.autoembed.cc/embed/movie/${i}`, tv: (i, s, e) => `https://player.autoembed.cc/embed/tv/${i}/${s}/${e}` },
  { id: "multi", name: "MultiEmbed", movie: (i) => `https://multiembed.mov/?video_id=${i}&tmdb=1`, tv: (i, s, e) => `https://multiembed.mov/?video_id=${i}&tmdb=1&s=${s}&e=${e}` },
  { id: "2embed", name: "2Embed", movie: (i) => `https://www.2embed.cc/embed/${i}`, tv: (i, s, e) => `https://www.2embed.cc/embedtv/${i}&s=${s}&e=${e}` },
  { id: "smashy", name: "Smashy", movie: (i) => `https://player.smashy.stream/movie/${i}`, tv: (i, s, e) => `https://player.smashy.stream/tv/${i}?s=${s}&e=${e}` },
];
export const embedUrl = (type: MediaType, id: number, s = 1, e = 1, server = "vidcore") => {
  const sv = SERVERS.find((x) => x.id === server) || SERVERS[0];
  return type === "movie" ? sv.movie(id) : sv.tv(id, s, e);
};
export const getPref = () => localStorage.getItem("cs_server") || "vidcore";
export const setPref = (s: string) => localStorage.setItem("cs_server", s);

// Continue watching
export interface HistItem { item: Item; type: MediaType; s?: number; e?: number; at: number }
export const getHistory = (): HistItem[] => { try { return JSON.parse(storage.getItem(sk("hist")) || "[]"); } catch { return []; } };
export const pushHistory = (h: HistItem) => {
  const l = getHistory().filter((x) => x.item.id !== h.item.id);
  storage.setItem(sk("hist"), JSON.stringify([h, ...l].slice(0, 30)));
};
export const removeHistory = (id: number) => storage.setItem(sk("hist"), JSON.stringify(getHistory().filter((x) => x.item.id !== id)));

// ---- Per-title accent identity (derived from primary genre) ----
export const BRAND = { primary: "#38bdf8", glow: "rgba(56, 189, 248, 0.15)" };
const GENRE_HUE: Record<number, string> = {
  878: "#a855f7", 10765: "#a855f7", // sci-fi / cyberpunk → violet
  12: "#f59e0b", 10759: "#f59e0b", 37: "#d97706", // adventure sagas → amber/gold
  28: "#f97316", // action → ember
  27: "#dc2626", 80: "#ef4444", // horror / crime → blood red
  53: "#22d3ee", 9648: "#6366f1", // thriller → ice, mystery → indigo
  14: "#818cf8", 16: "#f472b6", 10762: "#34d399", 10751: "#34d399",
  35: "#facc15", 10749: "#fb7185", 18: "#e7b98a", 36: "#b45309",
  10752: "#a8a29e", 10768: "#a8a29e", 99: "#a3e635", 10402: "#ec4899", 10764: "#fbbf24",
};
const toGlow = (hex: string, a = 0.2) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
export const themeOf = (i: { genre_ids?: number[]; genres?: { id: number }[] }) => {
  const ids = i.genre_ids || i.genres?.map((g) => g.id) || [];
  const hit = ids.find((g) => GENRE_HUE[g]);
  const primary = hit ? GENRE_HUE[hit] : BRAND.primary;
  return { primary, glow: toGlow(primary) };
};

/** True when running nested in a frame — several embed providers refuse to load there. */
export const inFrame = () => { try { return window.self !== window.top; } catch { return true; } };

export const PROVIDERS: [number, string][] = [[8, "Netflix"], [9, "Prime Video"], [337, "Disney+"], [1899, "Max"], [15, "Hulu"], [350, "Apple TV+"], [531, "Paramount+"], [386, "Peacock"], [283, "Crunchyroll"]];
export const srcSet = (p: string | null) => p ? `${img(p, "w780")} 780w, ${img(p, "w1280")} 1280w, ${img(p, "original")} 2400w` : undefined;

// Subtitles
export const subtitleLinks = (imdb: string | undefined, title: string, s?: number, e?: number) => {
  const q = encodeURIComponent(title);
  const im = imdb?.replace("tt", "");
  return [
    { name: "OpenSubtitles", url: im ? `https://www.opensubtitles.org/en/search/sublanguageid-all/imdbid-${im}${s ? `/season-${s}/episode-${e}` : ""}` : `https://www.opensubtitles.org/en/search2/moviename-${q}` },
    { name: "OpenSubtitles.com", url: `https://www.opensubtitles.com/en/search-all/q-${imdb || q}/hearing_impaired-include/machine_translated-/trusted_sources-` },
    { name: "SubDL", url: `https://subdl.com/search/${q}` },
    { name: "Subscene", url: `https://subscene.com/subtitles/searchbytitle?query=${q}` },
    { name: "YIFY Subtitles", url: imdb ? `https://yifysubtitles.ch/movie-imdb/${imdb}` : `https://yifysubtitles.ch/search?q=${q}` },
  ];
};

export const MOVIE_GENRES: [number, string][] = [[28,"Action"],[12,"Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[10751,"Family"],[14,"Fantasy"],[36,"History"],[27,"Horror"],[10402,"Music"],[9648,"Mystery"],[10749,"Romance"],[878,"Sci-Fi"],[53,"Thriller"],[10752,"War"],[37,"Western"]];
export const TV_GENRES: [number, string][] = [[10759,"Action & Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[10751,"Family"],[10762,"Kids"],[9648,"Mystery"],[10764,"Reality"],[10765,"Sci-Fi & Fantasy"],[10768,"War & Politics"]];

// My List (localStorage)
export const sk = (n: string) => `cs_${localStorage.getItem("cs_user") || "guest"}_${n}`;
export const getList = (): (Item & { media_type: MediaType })[] => {
  try { return JSON.parse(localStorage.getItem(sk("list")) || "[]"); } catch { return []; }
};
export const toggleList = (i: Item, t: MediaType) => {
  const l = getList();
  const exists = l.some((x) => x.id === i.id);
  const n = exists ? l.filter((x) => x.id !== i.id) : [{ ...i, media_type: t }, ...l];
  localStorage.setItem(sk("list"), JSON.stringify(n));
  return !exists;
};
