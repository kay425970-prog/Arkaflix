import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Item, MediaType, img, titleOf, tmdb, yearOf } from "./tmdb";
import { AVATARS, COLORS, User, users, signIn, signUp, getReviews, addReview, Review, getPlaylists, createPlaylist, togglePlaylistItem } from "./store";
import type { Party } from "./party";

export interface Ctx {
  user: User | null;
  openPerson: (id: number) => void;
  open: (i: Item, fb?: MediaType) => void;
  notify: (m: string) => void;
  requireAuth: () => boolean;
  party: Party;
  openParty: () => void;
}
export const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

export const Avatar = ({ u, size = 36 }: { u: { avatar: string; color: string; name?: string }; size?: number }) => (
  <span title={u.name} className="inline-flex items-center justify-center rounded-lg shrink-0 shadow-md" style={{ width: size, height: size, background: `linear-gradient(135deg, ${u.color}, ${u.color}99)`, fontSize: size * 0.55 }}>{u.avatar}</span>
);

/* ---------------- Auth ---------------- */
export function AuthModal({ onClose, onAuth }: { onClose: () => void; onAuth: (u: User) => void }) {
  const existing = users();
  const [mode, setMode] = useState<"pick" | "in" | "up">(existing.length ? "pick" : "up");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = mode === "up" ? signUp(name, pass, avatar, color) : signIn(name, pass);
    if (typeof r === "string") setErr(r); else onAuth(r);
  };
  const input = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-gradient-to-b from-[#1a1a20] to-[#111115] rounded-3xl p-8 ring-1 ring-white/10 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
        <div className="text-center mb-6">
          <p className="ark-font text-4xl tracking-wider text-[#5ce8ff]">ARKAFLIX</p>
          <p className="text-gray-400 text-sm mt-1">{mode === "pick" ? "Who's watching?" : mode === "in" ? "Welcome back" : "Create your profile"}</p>
        </div>
        {mode === "pick" ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              {existing.map((u) => (
                <button key={u.id} onClick={() => { setName(u.name); setMode("in"); }} className="group flex flex-col items-center gap-2">
                  <span className="group-hover:ring-4 ring-white rounded-lg transition"><Avatar u={u} size={72} /></span>
                  <span className="text-sm text-gray-300 group-hover:text-white truncate max-w-full">{u.name}</span>
                </button>
              ))}
              <button onClick={() => setMode("up")} className="group flex flex-col items-center gap-2">
                <span className="w-[72px] h-[72px] rounded-lg border-2 border-dashed border-white/30 group-hover:border-white flex items-center justify-center text-3xl text-gray-400">+</span>
                <span className="text-sm text-gray-400">Add profile</span>
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <div>
                <div className="flex justify-center mb-4"><Avatar u={{ avatar, color }} size={80} /></div>
                <div className="flex flex-wrap justify-center gap-1.5 mb-2">{AVATARS.map((a) => <button type="button" key={a} onClick={() => setAvatar(a)} className={`w-9 h-9 rounded-lg text-xl ${avatar === a ? "bg-white/20 ring-2 ring-white" : "bg-white/5 hover:bg-white/10"}`}>{a}</button>)}</div>
                <div className="flex justify-center gap-2">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a1a20]" : ""}`} style={{ background: c }} />)}</div>
              </div>
            )}
            <input autoFocus className={input} placeholder="Profile name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
            {err && <p className="text-red-400 text-sm">{err}</p>}
            <button className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-xl font-bold transition shadow-lg shadow-red-900/40">{mode === "up" ? "Create Account" : "Sign In"}</button>
            <p className="text-center text-sm text-gray-400">
              {mode === "up" ? <>Have a profile? <button type="button" onClick={() => { setMode(existing.length ? "pick" : "in"); setErr(""); }} className="text-white hover:underline">Sign in</button></>
                : <>New here? <button type="button" onClick={() => { setMode("up"); setErr(""); }} className="text-white hover:underline">Create profile</button></>}
            </p>
          </form>
        )}
        <p className="text-[11px] text-gray-600 text-center mt-6">Accounts are stored privately on this device.</p>
      </div>
    </div>
  );
}

/* ---------------- Person ---------------- */
export function PersonModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { open } = useApp();
  const [p, setP] = useState<any>(null);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  useEffect(() => { setP(null); tmdb(`/person/${id}`, { append_to_response: "combined_credits,external_ids,images" }).then(setP); }, [id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const credits: any[] = p ? [...(p.combined_credits?.cast || []), ...(p.combined_credits?.crew || [])] : [];
  const seen = new Set<string>();
  const film = credits.filter((c) => { const k = c.media_type + c.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .filter((c) => filter === "all" || c.media_type === filter)
    .sort((a, b) => (b.release_date || b.first_air_date || "0").localeCompare(a.release_date || a.first_air_date || "0"));
  const known = [...credits].filter((c) => c.poster_path).sort((a, b) => b.vote_count - a.vote_count).filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i).slice(0, 10);
  const age = p?.birthday ? Math.floor(((p.deathday ? new Date(p.deathday) : new Date()).getTime() - new Date(p.birthday).getTime()) / 3.156e10) : null;
  return (
    <div className="fixed inset-0 z-[55] bg-black/85 backdrop-blur-sm flex justify-center overflow-hidden animate-fade" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl md:my-8 bg-[#141418] md:rounded-2xl overflow-y-auto ring-1 ring-white/10">
        <button onClick={onClose} className="sticky top-4 float-right mr-4 w-10 h-10 rounded-full bg-black/70 hover:bg-black z-10">✕</button>
        {!p ? <div className="h-96 flex items-center justify-center"><Spinner /></div> : (
          <div className="p-6 md:p-10">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-48 md:w-64 shrink-0 mx-auto md:mx-0">
                <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-800 shadow-2xl">{p.profile_path && <img src={img(p.profile_path, "h632")} className="w-full h-full object-cover" alt="" />}</div>
                <div className="mt-4 space-y-2 text-sm">
                  <Info k="Known For" v={p.known_for_department} />
                  <Info k="Born" v={p.birthday && `${new Date(p.birthday).toLocaleDateString(undefined, { dateStyle: "long" })}${age && !p.deathday ? ` (age ${age})` : ""}`} />
                  {p.deathday && <Info k="Died" v={`${new Date(p.deathday).toLocaleDateString(undefined, { dateStyle: "long" })} (age ${age})`} />}
                  <Info k="Birthplace" v={p.place_of_birth} />
                  <Info k="Credits" v={String(seen.size)} />
                  <div className="flex gap-2 pt-2">
                    {p.external_ids?.imdb_id && <a target="_blank" rel="noreferrer" href={`https://imdb.com/name/${p.external_ids.imdb_id}`} className="bg-yellow-400 text-black text-xs font-black px-2 py-1 rounded">IMDb</a>}
                    {p.external_ids?.instagram_id && <a target="_blank" rel="noreferrer" href={`https://instagram.com/${p.external_ids.instagram_id}`} className="bg-white/10 text-xs px-2 py-1 rounded">Instagram</a>}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-3xl md:text-5xl font-black">{p.name}</h2>
                <h3 className="font-bold mt-6 mb-2">Biography</h3>
                <p className={`text-gray-300 leading-relaxed whitespace-pre-line ${more ? "" : "line-clamp-6"}`}>{p.biography || "No biography available."}</p>
                {p.biography?.length > 500 && <button onClick={() => setMore(!more)} className="text-red-500 text-sm mt-1 font-semibold">{more ? "Show less" : "Read more"}</button>}
                <h3 className="font-bold mt-8 mb-3">Known For</h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {known.map((c) => (
                    <button key={c.credit_id} onClick={() => open(c, c.media_type)} className="shrink-0 w-28 text-left group">
                      <img src={img(c.poster_path, "w185")} className="rounded-lg aspect-[2/3] object-cover group-hover:ring-2 ring-red-600 transition" alt="" loading="lazy" />
                      <p className="text-xs mt-1 line-clamp-1">{titleOf(c)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold">Filmography</h3>
                <div className="flex bg-white/5 rounded-full p-1 text-xs">{(["all", "movie", "tv"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full ${filter === f ? "bg-red-600" : "text-gray-400"}`}>{f === "all" ? "All" : f === "movie" ? "Movies" : "TV"}</button>)}</div>
              </div>
              <div className="divide-y divide-white/5 rounded-xl ring-1 ring-white/10 overflow-hidden">
                {film.slice(0, 80).map((c) => (
                  <button key={c.credit_id} onClick={() => open(c, c.media_type)} className="w-full flex items-center gap-4 px-4 py-2.5 hover:bg-white/5 text-left">
                    <span className="w-12 text-sm text-gray-500">{yearOf(c) || "—"}</span>
                    <img src={c.poster_path ? img(c.poster_path, "w92") : ""} className="w-8 h-12 rounded object-cover bg-zinc-800" alt="" loading="lazy" />
                    <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{titleOf(c)}</p><p className="text-xs text-gray-400 truncate">{c.character ? `as ${c.character}` : c.job}</p></div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">{c.media_type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
const Info = ({ k, v }: { k: string; v?: string }) => v ? <p><span className="text-gray-500 block text-xs">{k}</span><span className="text-gray-200">{v}</span></p> : null;
export const Spinner = () => <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />;

/* ---------------- Score ring & reviews ---------------- */
export function ScoreRing({ value, label, size = 64 }: { value: number; label: string; size?: number }) {
  const pct = Math.round(value);
  const c = pct >= 70 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90"><circle cx="18" cy="18" r="16" fill="#0b0b0f" stroke="#ffffff15" strokeWidth="3" /><circle cx="18" cy="18" r="16" fill="none" stroke={c} strokeWidth="3" strokeDasharray={`${pct} 100`} pathLength="100" strokeLinecap="round" /></svg>
        <span className="absolute inset-0 flex items-center justify-center font-black text-sm">{pct ? `${pct}%` : "—"}</span>
      </div>
      <span className="text-[11px] text-gray-400 text-center leading-tight">{label}</span>
    </div>
  );
}
const consensus = (v: number) => v >= 8 ? ["Universal Acclaim", "text-green-400"] : v >= 7 ? ["Generally Favorable", "text-green-400"] : v >= 5.5 ? ["Mixed Reviews", "text-yellow-400"] : v > 0 ? ["Generally Unfavorable", "text-red-400"] : ["Not enough ratings", "text-gray-400"];

export function Reviews({ type, id, data }: { type: MediaType; id: number; data: any }) {
  const { user, requireAuth, notify } = useApp();
  const [list, setList] = useState<Review[]>(getReviews(type, id));
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { setList(getReviews(type, id)); }, [id]);
  const tmdbReviews: any[] = data?.reviews?.results || [];
  const authorRatings = tmdbReviews.map((r) => r.author_details?.rating).filter(Boolean);
  const critic = authorRatings.length ? (authorRatings.reduce((a, b) => a + b, 0) / authorRatings.length) * 10 : 0;
  const community = list.length ? (list.reduce((a, b) => a + b.rating, 0) / list.length) * 20 : 0;
  const [label, col] = consensus(data?.vote_average || 0);
  const submit = () => {
    if (!requireAuth()) return;
    if (!rating) return notify("Pick a star rating first");
    addReview(type, id, { user: user!.name, avatar: user!.avatar, color: user!.color, rating, text, at: Date.now() });
    setList(getReviews(type, id)); setText(""); setRating(0); notify("Review posted!");
  };
  return (
    <div className="px-6 md:px-10 pb-10">
      <h3 className="text-xl font-bold mb-4">Ratings & Reviews</h3>
      <div className="grid md:grid-cols-[auto_1fr] gap-6 bg-white/[0.03] ring-1 ring-white/10 rounded-2xl p-5">
        <div className="flex gap-5 justify-center">
          <ScoreRing value={(data?.vote_average || 0) * 10} label={`Audience\n${(data?.vote_count || 0).toLocaleString()} votes`} />
          <ScoreRing value={critic} label={`Critics\n${authorRatings.length} reviews`} />
          <ScoreRing value={community} label={`Arkaflix\n${list.length} ratings`} />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-gray-500">Consensus</p>
          <p className={`text-xl font-black ${col}`}>{label}</p>
          <p className="text-sm text-gray-400 mt-1">Rated {(data?.vote_average || 0).toFixed(1)}/10 by {(data?.vote_count || 0).toLocaleString()} TMDB members{data?.popularity ? ` · Popularity ${Math.round(data.popularity)}` : ""}.</p>
        </div>
      </div>
      <div className="mt-5 bg-white/[0.03] ring-1 ring-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          {user ? <Avatar u={user} size={32} /> : <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">👤</span>}
          <span className="text-sm font-semibold">{user ? "Rate this title" : "Sign in to review"}</span>
          <div className="ml-auto flex">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} className={`text-2xl transition hover:scale-125 ${n <= rating ? "text-yellow-400" : "text-gray-600"}`}>★</button>)}</div>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onFocus={() => !user && requireAuth()} placeholder="Share your thoughts (no spoilers!)" rows={2} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-600 resize-none" />
        <div className="flex justify-end mt-2"><button onClick={submit} className="bg-red-600 hover:bg-red-700 px-5 py-2 rounded-lg text-sm font-bold">Post Review</button></div>
      </div>
      <div className="mt-5 space-y-3">
        {list.map((r) => (
          <div key={r.user + r.at} className="flex gap-3 p-4 rounded-xl bg-white/[0.03] ring-1 ring-red-600/20">
            <Avatar u={r} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-sm">{r.user}</span><span className="text-[10px] bg-red-600 px-1.5 rounded">COMMUNITY</span><span className="text-yellow-400 text-sm">{"★".repeat(r.rating)}<span className="text-gray-600">{"★".repeat(5 - r.rating)}</span></span><span className="text-xs text-gray-500 ml-auto">{new Date(r.at).toLocaleDateString()}</span></div>
              {r.text && <p className="text-sm text-gray-300 mt-1">{r.text}</p>}
            </div>
          </div>
        ))}
        {tmdbReviews.slice(0, 6).map((r) => (
          <div key={r.id} className="flex gap-3 p-4 rounded-xl bg-white/[0.03] ring-1 ring-white/5">
            <span className="w-9 h-9 rounded-lg bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center font-bold">{r.author_details?.avatar_path ? <img src={img(r.author_details.avatar_path, "w92")} className="w-full h-full object-cover" alt="" /> : r.author[0]?.toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-sm">{r.author}</span><span className="text-[10px] bg-sky-600 px-1.5 rounded">CRITIC</span>{r.author_details?.rating && <span className="text-xs bg-white/10 px-1.5 rounded">★ {r.author_details.rating}/10</span>}<span className="text-xs text-gray-500 ml-auto">{new Date(r.created_at).toLocaleDateString()}</span></div>
              <p className={`text-sm text-gray-300 mt-1 whitespace-pre-line ${expanded === r.id ? "" : "line-clamp-4"}`}>{r.content.replace(/<[^>]+>/g, "")}</p>
              {r.content.length > 350 && <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-xs text-red-500 font-semibold mt-1">{expanded === r.id ? "Less" : "Read full review"}</button>}
            </div>
          </div>
        ))}
        {!list.length && !tmdbReviews.length && <p className="text-sm text-gray-500">No reviews yet — be the first!</p>}
      </div>
    </div>
  );
}

/* ---------------- Playlist picker ---------------- */
export function PlaylistPicker({ item, type, onClose }: { item: Item; type: MediaType; onClose: () => void }) {
  const { notify } = useApp();
  const [lists, setLists] = useState(getPlaylists());
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/70 animate-fade" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[#1a1a20] rounded-2xl p-5 ring-1 ring-white/10">
        <h4 className="font-bold mb-1">Save to playlist</h4>
        <p className="text-xs text-gray-400 mb-4 truncate">{titleOf(item)}</p>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {lists.map((p) => {
            const has = p.items.some((x) => x.id === item.id);
            return (
              <button key={p.id} onClick={() => { const a = togglePlaylistItem(p.id, item, type); setLists(getPlaylists()); notify(a ? `Added to ${p.name}` : `Removed from ${p.name}`); }} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 text-left">
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${has ? "bg-red-600 border-red-600" : "border-white/30"}`}>{has && "✓"}</span>
                <span className="flex-1 text-sm">{p.name}</span><span className="text-xs text-gray-500">{p.items.length}</span>
              </button>
            );
          })}
          {!lists.length && <p className="text-sm text-gray-500 py-2">No playlists yet.</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; const p = createPlaylist(name.trim()); togglePlaylistItem(p.id, item, type); setLists(getPlaylists()); setName(""); notify(`Created “${p.name}”`); }} className="flex gap-2 mt-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-600" />
          <button className="bg-red-600 px-4 rounded-lg text-sm font-bold">Create</button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Watch Party ---------------- */
export function PartyLobby({ onClose }: { onClose: () => void }) {
  const { party, user, requireAuth } = useApp();
  const [codeIn, setCodeIn] = useState(new URLSearchParams(location.search).get("party") || "");
  const live = party.status === "live";
  const link = `${location.origin}${location.pathname}?party=${party.room}`;
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-gradient-to-br from-[#2a0a10] via-[#151519] to-[#111115] rounded-3xl p-8 ring-1 ring-white/10 shadow-2xl overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-red-600/30 blur-3xl rounded-full" />
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10">✕</button>
        <div className="relative">
          <p className="text-4xl mb-2">🍿</p>
          <h3 className="text-2xl font-black">Watch Party</h3>
          <p className="text-gray-400 text-sm mt-1">Watch together with friends anywhere. Chat, react, and stay on the same title and episode, all in real time.</p>
          {live ? (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest text-gray-500">Party code</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-4xl font-black tracking-[0.3em] text-red-500">{party.room}</span>
                <button onClick={() => navigator.clipboard?.writeText(link)} className="ml-auto bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-sm">Copy link</button>
              </div>
              <div className="flex -space-x-2 mt-5">{party.members.map((m) => <span key={m.id} className="ring-2 ring-[#151519] rounded-lg"><Avatar u={m} size={36} /></span>)}</div>
              <p className="text-xs text-gray-400 mt-2">{party.members.length} watching · {party.isHost ? "You're the host" : "Joined"}</p>
              <button onClick={() => party.leave()} className="mt-6 w-full border border-white/20 hover:bg-white/5 py-3 rounded-xl font-semibold">Leave Party</button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <button disabled={party.status === "connecting"} onClick={() => requireAuth() && party.create()} className="w-full bg-red-600 hover:bg-red-700 py-3.5 rounded-xl font-bold shadow-lg shadow-red-900/50 disabled:opacity-50">{party.status === "connecting" ? "Connecting…" : "Start a Party"}</button>
              <div className="flex items-center gap-3 text-xs text-gray-500"><span className="flex-1 h-px bg-white/10" />OR JOIN<span className="flex-1 h-px bg-white/10" /></div>
              <form onSubmit={(e) => { e.preventDefault(); if (requireAuth() && codeIn.trim()) party.join(codeIn); }} className="flex gap-2">
                <input value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase())} maxLength={6} placeholder="ENTER CODE" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 tracking-[0.3em] font-bold text-center focus:outline-none focus:border-red-600" />
                <button className="bg-white text-black px-5 rounded-xl font-bold">Join</button>
              </form>
              {party.error && <p className="text-red-400 text-sm">{party.error}</p>}
              {!user && <p className="text-xs text-gray-500">You'll need to sign in so friends know who you are.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PartyDock() {
  const { party, user } = useApp();
  const [openChat, setOpenChat] = useState(true);
  const [text, setText] = useState("");
  const [seen, setSeen] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); if (openChat) setSeen(party.messages.length); }, [party.messages.length, openChat]);
  if (party.status !== "live") return null;
  const unread = party.messages.length - seen;
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2">
      {openChat && (
        <div className="w-[min(340px,calc(100vw-2rem))] h-[min(460px,60vh)] flex flex-col bg-[#141418]/95 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 shadow-2xl animate-fade overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-red-600/20 to-transparent">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="font-bold text-sm">Party {party.room}</span>
            <div className="flex -space-x-1.5 ml-auto">{party.members.slice(0, 5).map((m) => <Avatar key={m.id} u={m} size={22} />)}</div>
            <button onClick={() => setOpenChat(false)} className="text-gray-400 hover:text-white ml-2">–</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {party.messages.map((m) => m.kind === "system" ? <p key={m.id} className="text-center text-xs text-gray-500">{m.text}</p>
              : m.kind === "play" ? <p key={m.id} className="text-center text-xs text-red-400">▶ {m.from?.name} started <b>{m.play?.title}</b></p>
              : (
                <div key={m.id} className={`flex gap-2 ${m.from?.id === user?.id ? "flex-row-reverse" : ""}`}>
                  <Avatar u={m.from!} size={26} />
                  <div className={`max-w-[75%] px-3 py-1.5 rounded-2xl ${m.from?.id === user?.id ? "bg-red-600 rounded-tr-sm" : "bg-white/10 rounded-tl-sm"}`}>
                    {m.from?.id !== user?.id && <p className="text-[10px] font-bold" style={{ color: m.from?.color }}>{m.from?.name}</p>}
                    <p className="break-words">{m.text}</p>
                  </div>
                </div>
              ))}
            <div ref={end} />
          </div>
          <div className="flex justify-around px-2 py-1 border-t border-white/10">
            {["😂", "❤️", "🔥", "😱", "👏", "😭", "🍿"].map((e) => <button key={e} onClick={() => { party.send("react", { text: e }); window.dispatchEvent(new CustomEvent("cs-react", { detail: e })); }} className="text-xl hover:scale-125 transition p-1">{e}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { party.send("chat", { text: text.trim() }); setText(""); } }} className="flex gap-2 p-3 pt-1">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-red-600" />
            <button className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center">➤</button>
          </form>
        </div>
      )}
      {!openChat && (
        <button onClick={() => setOpenChat(true)} className="relative flex items-center gap-2 bg-red-600 hover:bg-red-700 pl-3 pr-4 py-2.5 rounded-full shadow-2xl shadow-red-900/50 font-bold text-sm">
          🍿 Party · {party.members.length}
          {unread > 0 && <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{unread}</span>}
        </button>
      )}
    </div>
  );
}

export function Reactions() {
  const [list, setList] = useState<{ id: number; e: string; x: number }[]>([]);
  useEffect(() => {
    const h = (ev: Event) => {
      const id = Math.random(); const e = (ev as CustomEvent).detail;
      setList((l) => [...l, { id, e, x: 10 + Math.random() * 80 }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3000);
    };
    window.addEventListener("cs-react", h);
    return () => window.removeEventListener("cs-react", h);
  }, []);
  return <div className="fixed inset-0 pointer-events-none z-[95] overflow-hidden">{list.map((r) => <span key={r.id} className="absolute bottom-0 text-5xl animate-float" style={{ left: `${r.x}%` }}>{r.e}</span>)}</div>;
}
