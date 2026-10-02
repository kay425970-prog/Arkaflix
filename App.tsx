import { useEffect, useRef, useState } from "react";
import {
  Item, MediaType, SERVERS, embedUrl, getList, img, titleOf, tmdb, toggleList, typeOf, yearOf,
  getPref, setPref, getHistory, pushHistory, removeHistory, HistItem, subtitleLinks, MOVIE_GENRES, TV_GENRES, PROVIDERS, srcSet, themeOf, BRAND,
} from "./tmdb";
import { User, currentUser, signOut, getFavs, isFav, toggleFav, getPlaylists, deletePlaylist, Playlist } from "./store";
import { useParty } from "./party";
import Splash from "./Splash";
import { Profile, AvatarImg } from "./Profiles";
import { AppCtx, useApp, AuthModal, PersonModal, PartyLobby, PartyDock, Reactions, Reviews, PlaylistPicker, Avatar, Spinner } from "./Extras";
import { Downloads } from "./DownloadsView";

type Tab = "home" | "movie" | "tv" | "discover" | "list" | "downloads";
interface Sel { item: Item; type: MediaType }
interface Play { item: Item; type: MediaType; s?: number; e?: number }

const TABS: [Tab, string][] = [["home", "Home"], ["movie", "Movies"], ["tv", "TV Shows"], ["discover", "Discover"], ["list", "My List"], ["downloads", "Downloads"]];

const ROWS: Record<"home" | "movie" | "tv", [string, string, Record<string, string>?, boolean?][]> = {
  home: [
    ["Trending Now", "/trending/all/week"],
    ["Top 10 Movies Today", "/trending/movie/day", undefined, true],
    ["Popular Movies", "/movie/popular"],
    ["Top 10 Shows Today", "/trending/tv/day", undefined, true],
    ["Popular TV Shows", "/tv/popular"],
    ["Top Rated Movies", "/movie/top_rated"],
    ["Now Playing in Theaters", "/movie/now_playing"],
    ["Critically Acclaimed TV", "/tv/top_rated"],
    ["Blockbuster Action", "/discover/movie", { with_genres: "28", sort_by: "revenue.desc" }],
    ["Anime", "/discover/tv", { with_genres: "16", with_original_language: "ja", sort_by: "popularity.desc" }],
  ],
  movie: [
    ["Trending Movies", "/trending/movie/week"],
    ["Top 10 Movies Today", "/trending/movie/day", undefined, true],
    ["Action", "/discover/movie", { with_genres: "28" }],
    ["Comedy", "/discover/movie", { with_genres: "35" }],
    ["Horror", "/discover/movie", { with_genres: "27" }],
    ["Sci‑Fi", "/discover/movie", { with_genres: "878" }],
    ["Thriller", "/discover/movie", { with_genres: "53" }],
    ["Romance", "/discover/movie", { with_genres: "10749" }],
    ["Animation", "/discover/movie", { with_genres: "16" }],
    ["Documentaries", "/discover/movie", { with_genres: "99" }],
    ["Upcoming", "/movie/upcoming"],
  ],
  tv: [
    ["Trending Shows", "/trending/tv/week"],
    ["Top 10 Shows Today", "/trending/tv/day", undefined, true],
    ["Airing Today", "/tv/airing_today"],
    ["On The Air", "/tv/on_the_air"],
    ["Drama", "/discover/tv", { with_genres: "18" }],
    ["Crime", "/discover/tv", { with_genres: "80" }],
    ["Sci‑Fi & Fantasy", "/discover/tv", { with_genres: "10765" }],
    ["Comedy", "/discover/tv", { with_genres: "35" }],
    ["K‑Drama", "/discover/tv", { with_original_language: "ko", sort_by: "popularity.desc" }],
    ["Anime", "/discover/tv", { with_genres: "16", with_original_language: "ja" }],
  ],
};

const PlayIcon = ({ c = "w-5 h-5" }) => <svg className={c} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Item[] | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [play, setPlay] = useState<Play | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [ver, setVer] = useState(0);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", f);
    const k = (e: KeyboardEvent) => { if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("scroll", f); window.removeEventListener("keydown", k); };
  }, []);

  useEffect(() => {
    if (!q.trim()) return setResults(null);
    const t = setTimeout(() => {
      tmdb("/search/multi", { query: q, include_adult: "false" }).then((d) =>
        setResults(d.results.filter((r: Item) => r.media_type !== "person" && r.poster_path))
      );
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const [user, setUser] = useState<User | null>(currentUser());
  const [splash, setSplash] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);
  const [lobby, setLobby] = useState(!!new URLSearchParams(location.search).get("party"));
  const [menu, setMenu] = useState(false);
  const [people, setPeople] = useState<any[]>([]);

  /* ---- Theme switchboard: hovered card → root accent variables ---- */
  useEffect(() => {
    const root = document.documentElement;
    let resetTimer: number | undefined;
    const apply = (primary: string, glow: string) => {
      root.style.setProperty("--accent-primary", primary);
      root.style.setProperty("--accent-glow", glow);
    };
    const reset = () => apply(BRAND.primary, BRAND.glow);

    // mouseenter/mouseleave don't bubble, so listen in the capture phase
    const onEnter = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!(el instanceof HTMLElement)) return;
      if (el.matches("[data-primary]")) {
        window.clearTimeout(resetTimer);
        apply(el.dataset.primary!, el.dataset.glow || BRAND.glow);
      }
    };
    const onLeave = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!(el instanceof HTMLElement) || !el.matches("[data-theme-grid]")) return;
      // tiny grace period so moving between adjacent grids doesn't flicker
      resetTimer = window.setTimeout(reset, 120);
    };

    document.addEventListener("mouseenter", onEnter, true);
    document.addEventListener("mouseleave", onLeave, true);
    return () => {
      document.removeEventListener("mouseenter", onEnter, true);
      document.removeEventListener("mouseleave", onLeave, true);
      window.clearTimeout(resetTimer);
      reset();
    };
  }, []);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const open = (item: Item, fb: MediaType = "movie") => { setPersonId(null); setSel({ item, type: typeOf(item, fb) }); };
  const localPlay = (p: Play) => { pushHistory({ item: p.item, type: p.type, s: p.s, e: p.e, at: Date.now() }); setSel(null); setPlay(p); setVer((v) => v + 1); };
  const me = user ? { id: user.id, name: user.name, avatar: user.avatar, color: user.color } : { id: "guest", name: "Guest", avatar: "👤", color: "#555" };
  const party = useParty(me, (pp) => { localPlay(pp); notify(`🍿 Party is watching ${titleOf(pp.item)}`); }, (e) => window.dispatchEvent(new CustomEvent("cs-react", { detail: e })));
  const startPlay = (p: Play) => { localPlay(p); if (party.status === "live") party.send("play", { play: { ...p, title: titleOf(p.item) + (p.type === "tv" ? ` S${p.s ?? 1}E${p.e ?? 1}` : "") } }); };
  const requireAuth = () => { if (user) return true; setAuthOpen(true); return false; };
  const ctx = { user, openPerson: (id: number) => setPersonId(id), open, notify, requireAuth, party, openParty: () => setLobby(true) };

  useEffect(() => {
    if (!q.trim()) return setPeople([]);
    const t = setTimeout(() => tmdb("/search/person", { query: q }).then((d) => setPeople(d.results.filter((p: any) => p.profile_path).slice(0, 8))), 300);
    return () => clearTimeout(t);
  }, [q]);
  const go = (t: Tab) => { setTab(t); setQ(""); window.scrollTo(0, 0); };

  return (
    <AppCtx.Provider value={ctx}>
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <div aria-hidden className="ambient-glow pointer-events-none fixed inset-0 z-0" />
      <nav className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${scrolled || results || tab === "discover" || tab === "list" ? "bg-[#0b0b0f]/90 backdrop-blur-xl border-b border-white/5" : "bg-gradient-to-b from-black/80 to-transparent"}`}>
        <div className="flex items-center gap-8 px-4 md:px-12 h-16">
          <button onClick={() => go("home")} className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d2ff] to-[#0077b6] flex items-center justify-center shadow-lg shadow-cyan-900/50"><PlayIcon c="w-4 h-4" /></span>
            <span className="ark-font text-3xl tracking-wider bg-gradient-to-b from-white to-[#5ce8ff] bg-clip-text text-transparent">ARKAFLIX</span>
          </button>
          <div className="hidden lg:flex gap-6 text-sm">
            {TABS.map(([t, l]) => (
              <button key={t} onClick={() => go(t)} className={`relative py-1 transition ${tab === t && !results ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}>
                {l}{tab === t && !results && <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-red-600 rounded" />}
              </button>
            ))}
          </div>
          <div className="ml-auto relative">
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search movies & shows…  ( / )" className="bg-white/5 border border-white/10 rounded-full pl-10 pr-9 py-2 text-sm w-48 md:w-80 focus:outline-none focus:border-red-600 focus:bg-black/60 transition" />
            <svg className="w-4 h-4 absolute left-3.5 top-2.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            {q && <button onClick={() => setQ("")} className="absolute right-3 top-1.5 text-gray-400 hover:text-white">✕</button>}
          </div>
          <button onClick={() => setLobby(true)} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${party.status === "live" ? "bg-red-600 animate-pulse-slow" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}>🍿 <span className="hidden md:inline">{party.status === "live" ? `Party ${party.room}` : "Watch Party"}</span></button>
          {profile && (
            <button onClick={() => setSplash(true)} title={`Watching as ${profile.name} — switch profile`} className="group flex items-center gap-2">
              <span className="w-9 h-9 rounded-lg overflow-hidden ring-2 ring-transparent group-hover:ring-[#00d2ff] group-hover:shadow-[0_0_14px_#00d2ffaa] transition"><AvatarImg src={profile.avatar} alt={profile.name} /></span>
              <span className="hidden xl:inline text-sm text-gray-300 group-hover:text-white">{profile.name}</span>
            </button>
          )}
          <div className="relative">
            {user ? (
              <button onClick={() => setMenu(!menu)} className="flex items-center gap-1"><Avatar u={user} size={34} /><span className="text-xs text-gray-400 hidden md:inline">▾</span></button>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap">Sign In</button>
            )}
            {menu && user && (
              <div className="absolute right-0 top-12 w-56 bg-[#141418]/95 backdrop-blur-xl rounded-xl ring-1 ring-white/10 shadow-2xl py-2 animate-fade" onMouseLeave={() => setMenu(false)}>
                <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 mb-1"><Avatar u={user} size={36} /><div><p className="font-semibold text-sm">{user.name}</p><p className="text-[11px] text-gray-500">Member since {new Date(user.created).getFullYear()}</p></div></div>
                {[["📋 My List", () => go("list")], ["🍿 Watch Party", () => setLobby(true)], ["👥 Switch Profile", () => setAuthOpen(true)]].map(([l, f]: any) => <button key={l} onClick={() => { f(); setMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-white/5">{l}</button>)}
                <button onClick={() => { signOut(); setUser(null); setMenu(false); party.leave(); setVer((v) => v + 1); notify("Signed out"); }} className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 text-red-400 border-t border-white/10 mt-1">Sign Out</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex lg:hidden gap-5 px-4 pb-2 text-sm overflow-x-auto no-scrollbar">
          {TABS.map(([t, l]) => <button key={t} onClick={() => go(t)} className={`whitespace-nowrap ${tab === t ? "text-white font-semibold" : "text-gray-400"}`}>{l}</button>)}
        </div>
      </nav>

      {results ? (
        <div className="pt-32 px-4 md:px-12 pb-16 min-h-screen">
          <h2 className="text-2xl font-bold mb-6">Results for <span className="text-red-500">“{q}”</span> <span className="text-gray-500 text-base font-normal">· {results.length} titles</span></h2>
          {people.length > 0 && (
            <div className="mb-8">
              <p className="text-sm text-gray-400 mb-3">People</p>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {people.map((p) => (
                  <button key={p.id} onClick={() => setPersonId(p.id)} className="shrink-0 w-24 text-center group">
                    <img src={img(p.profile_path, "w185")} className="w-24 h-24 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-red-600 transition" alt="" />
                    <p className="text-xs font-semibold mt-2 line-clamp-1">{p.name}</p><p className="text-[11px] text-gray-500">{p.known_for_department}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Grid items={results} onOpen={(i) => open(i)} />
          {!results.length && <p className="text-gray-400">No titles found.</p>}
        </div>
      ) : tab === "list" ? (
        <MyList key={ver} onOpen={open} onPlay={startPlay} />
      ) : tab === "discover" ? (
        <Discover onOpen={open} />
      ) : tab === "downloads" ? (
        <Downloads profile={profile} go={go} />
      ) : (
        <Browse key={tab} tab={tab} onOpen={open} onPlay={startPlay} ver={ver} refresh={() => setVer((v) => v + 1)} />
      )}

      <footer className="px-4 md:px-12 py-12 border-t border-white/5 text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div>
            <p className="ark-font text-3xl tracking-wider text-[#5ce8ff]">ARKAFLIX</p>
            <p className="mt-2 max-w-md text-xs">Personal streaming hub. Metadata by TMDB. Subtitles via OpenSubtitles & friends. This product uses the TMDB API but is not endorsed or certified by TMDB. No files are hosted on this site.</p>
          </div>
          <a href="https://unavatar.io" target="_blank" className="text-xs hover:text-white">Avatars provided by Unavatar</a>
          <div className="flex gap-8 text-xs">{TABS.map(([t, l]) => <button key={t} onClick={() => go(t)} className="hover:text-white">{l}</button>)}</div>
        </div>
      </footer>

      {sel && <Details sel={sel} onClose={() => { setSel(null); setVer((v) => v + 1); }} onPlay={startPlay} onOpen={open} notify={notify} />}
      {play && <Player p={play} onClose={() => setPlay(null)} onChange={startPlay} />}
      {personId && <PersonModal id={personId} onClose={() => setPersonId(null)} />}
      {lobby && <PartyLobby onClose={() => setLobby(false)} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuth={(u) => { setUser(u); setAuthOpen(false); setVer((v) => v + 1); notify(`Welcome, ${u.name}! ${u.avatar}`); }} />}
      <PartyDock />
      <Reactions />
      {splash && <Splash onDone={(p) => { setProfile(p); setSplash(false); notify(`Welcome back, ${p.name}! 🐋`); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-white text-black px-5 py-2.5 rounded-full font-semibold shadow-2xl animate-fade">{toast}</div>}
    </div>
    </AppCtx.Provider>
  );
}

function Browse({ tab, onOpen, onPlay, ver, refresh }: { tab: "home" | "movie" | "tv"; onOpen: (i: Item, fb?: MediaType) => void; onPlay: (p: Play) => void; ver: number; refresh: () => void }) {
  const fb: MediaType = tab === "tv" ? "tv" : "movie";
  const [heroes, setHeroes] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    tmdb(ROWS[tab][0][1]).then((d) => setHeroes(d.results.filter((r: Item) => r.backdrop_path).slice(0, 6)));
  }, [tab]);
  useEffect(() => {
    if (!heroes.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % heroes.length), 9000);
    return () => clearInterval(t);
  }, [heroes]);
  const hero = heroes[idx];
  const [video, setVideo] = useState<string | null>(null);
  const [videoOn, setVideoOn] = useState(false);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    if (!hero) return;
    setVideo(null); setVideoOn(false);
    if (window.innerWidth < 768) return;
    const t = setTimeout(() => {
      tmdb(`/${typeOf(hero, fb)}/${hero.id}/videos`).then((d) => {
        const v = d.results.find((x: any) => x.site === "YouTube" && x.type === "Trailer") || d.results.find((x: any) => x.site === "YouTube");
        if (v) setVideo(v.key);
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [hero?.id]);
  useEffect(() => {
    if (!hero) return;
    setLogo(null);
    tmdb(`/${typeOf(hero, fb)}/${hero.id}/images`, { language: "", include_image_language: "en,null" })
      .then((d) => setLogo(d.logos?.[0]?.file_path || null)).catch(() => {});
  }, [hero?.id]);
  const history = getHistory().filter((h) => tab === "home" || h.type === tab);

  return (
    <>
      {hero ? (
        <header className="relative h-[92vh] min-h-[560px] overflow-hidden">
          {heroes.map((h, i) => (
            <img key={h.id} src={img(h.backdrop_path, "w1280")} srcSet={srcSet(h.backdrop_path)} sizes="100vw" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "low"} className={`absolute inset-0 w-full h-full object-cover transition-all duration-[1500ms] ${i === idx && !videoOn ? "opacity-100 scale-105" : "opacity-0 scale-100"}`} alt="" />
          ))}
          {video && (
            <div className={`absolute inset-0 hidden md:block transition-opacity duration-1000 pointer-events-none ${videoOn ? "opacity-100" : "opacity-0"}`}>
              <iframe key={video + muted} onLoad={() => setTimeout(() => setVideoOn(true), 1800)} className="absolute top-1/2 left-1/2 w-[177.78vh] min-w-full h-[56.25vw] min-h-full -translate-x-1/2 -translate-y-1/2 scale-[1.35]" src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${video}&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1`} allow="autoplay; encrypted-media" />
            </div>
          )}
          {videoOn && (
            <button onClick={() => setMuted(!muted)} className="absolute bottom-[22vh] right-4 md:right-12 z-10 hidden md:flex w-11 h-11 rounded-full border-2 border-white/60 bg-black/30 hover:bg-black/60 items-center justify-center text-lg">{muted ? "🔇" : "🔊"}</button>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] via-transparent to-black/30" />
          <div key={hero.id} className="relative h-full flex flex-col justify-end pb-[22vh] px-4 md:px-12 max-w-2xl animate-fade">
            <span className="inline-flex w-fit items-center gap-2 text-xs font-bold tracking-[0.25em] mb-4 bg-red-600/90 px-3 py-1 rounded">#{idx + 1} {typeOf(hero, fb) === "tv" ? "SERIES" : "FILM"} TRENDING</span>
            {logo ? <img src={img(logo, "w500")} className="max-h-36 max-w-[80%] object-contain object-left drop-shadow-2xl" alt={titleOf(hero)} />
              : <h1 className="text-4xl md:text-7xl font-black leading-none drop-shadow-lg">{titleOf(hero)}</h1>}
            <div className="flex items-center gap-3 text-sm text-gray-300 mt-5">
              <span className="text-green-400 font-bold">{Math.round(hero.vote_average * 10)}% Match</span><span>{yearOf(hero)}</span>
              <span className="border border-white/40 px-1.5 text-xs rounded">HD</span><span className="border border-white/40 px-1.5 text-xs rounded">CC</span>
            </div>
            <p className="mt-4 text-gray-200 line-clamp-3 md:text-lg leading-relaxed">{hero.overview}</p>
            <div className="flex gap-3 mt-7">
              <button onClick={() => onPlay({ type: typeOf(hero, fb), item: hero, s: 1, e: 1 })} className="flex items-center gap-2 bg-white text-black font-bold px-8 py-3 rounded-md hover:bg-white/80 transition hover:scale-105"><PlayIcon />Play</button>
              <button onClick={() => onOpen(hero, fb)} className="flex items-center gap-2 bg-white/20 backdrop-blur font-semibold px-7 py-3 rounded-md hover:bg-white/30 transition">ⓘ More Info</button>
            </div>
          </div>
          <div className="absolute bottom-[16vh] right-4 md:right-12 flex gap-2">
            {heroes.map((_, i) => <button key={i} onClick={() => setIdx(i)} className={`h-1 rounded-full transition-all ${i === idx ? "w-8 bg-red-600" : "w-4 bg-white/40 hover:bg-white/70"}`} />)}
          </div>
        </header>
      ) : <div className="h-[92vh] bg-gradient-to-b from-zinc-900 to-[#0b0b0f] animate-pulse" />}
      <div className="-mt-32 relative z-10 space-y-10 pb-12">
        {history.length > 0 && <ContinueRow key={ver} items={history} onPlay={onPlay} onOpen={onOpen} refresh={refresh} />}
        <Showcase tab={tab} onOpen={onOpen} />
        {ROWS[tab].map(([t, p, params, top]) => <Row key={t} title={t} path={p} params={params} fb={fb} onOpen={onOpen} top={top} />)}
      </div>
    </>
  );
}

/* Editorial, asymmetric showcase — each tile carries its own palette */
const SHOWCASE_LAYOUT = [
  "col-span-2 md:col-span-7 row-span-2",
  "col-span-1 md:col-span-5",
  "col-span-1 md:col-span-5",
  "col-span-1 md:col-span-4",
  "col-span-1 md:col-span-3",
  "col-span-2 md:col-span-5",
];
function Showcase({ tab, onOpen }: { tab: "home" | "movie" | "tv"; onOpen: (i: Item, fb?: MediaType) => void }) {
  const kind: MediaType = tab === "tv" ? "tv" : "movie";
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    tmdb(`/${kind}/top_rated`, { page: String(1 + Math.floor(Math.random() * 3)) }).then((d) =>
      setItems(d.results.filter((r: Item) => r.backdrop_path).slice(0, SHOWCASE_LAYOUT.length).map((r: Item) => ({ ...r, media_type: kind })))
    );
  }, [kind]);
  if (!items.length) return null;
  return (
    <section className="px-4 md:px-12">
      <div className="flex items-end justify-between gap-6 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Curated · {kind === "tv" ? "Series" : "Films"}</p>
          <h2 className="ark-serif text-4xl md:text-5xl tracking-[-0.03em] mt-1">The <em className="accent-text">Showcase</em></h2>
        </div>
        <span className="hidden md:block h-px flex-1 max-w-xs mb-3 accent-line" />
      </div>
      <div data-theme-grid className="grid grid-cols-2 md:grid-cols-12 auto-rows-[150px] sm:auto-rows-[190px] md:auto-rows-[210px] gap-3 md:gap-4">
        {items.map((it, i) => {
          const t = themeOf(it);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onOpen(it, kind)}
              data-primary={t.primary}
              data-glow={t.glow}
              style={{ "--card-primary": t.primary, "--card-glow": t.glow } as React.CSSProperties}
              className={`movie-card show-card group relative overflow-hidden rounded-lg bg-zinc-900 text-left focus:outline-none ${SHOWCASE_LAYOUT[i]}`}
            >
              <img src={img(it.backdrop_path, i === 0 ? "w1280" : "w780")} alt={titleOf(it)} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <span className="absolute left-3 top-3 md:left-4 md:top-4 text-[10px] tabular-nums tracking-[0.2em] text-white/60">{String(i + 1).padStart(2, "0")}</span>
              <div className="absolute inset-x-0 bottom-0 p-3 md:p-5">
                <p className={`ark-serif leading-[0.95] tracking-[-0.02em] text-white ${i === 0 ? "text-3xl md:text-5xl" : "text-xl md:text-2xl"} line-clamp-2`}>{titleOf(it)}</p>
                <div className="show-meta">
                  <div className="flex items-center gap-3 mt-2 text-[11px] md:text-xs text-white/70">
                    <span className="font-semibold" style={{ color: "var(--card-primary)" }}>★ {it.vote_average.toFixed(1)}</span>
                    <span>{yearOf(it)}</span>
                    <span className="h-px w-6" style={{ background: "var(--card-primary)" }} />
                  </div>
                  {i < 3 && it.overview && <p className="mt-2 max-w-md text-xs md:text-[13px] leading-snug text-white/65 line-clamp-2">{it.overview}</p>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Scroller({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="group/row">
      <h2 className="px-4 md:px-12 text-lg md:text-xl font-bold mb-3 flex items-center gap-3">{title}{badge && <span className="text-[10px] tracking-widest bg-red-600 px-2 py-0.5 rounded">{badge}</span>}</h2>
      <div className="relative">
        <button onClick={() => scroll(-1)} className="absolute left-0 top-0 bottom-0 z-30 w-12 bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition text-4xl hidden md:block">‹</button>
        <div ref={ref} data-theme-grid className="flex gap-2 md:gap-3 overflow-x-auto no-scrollbar px-4 md:px-12 py-3 scroll-smooth">{children}</div>
        <button onClick={() => scroll(1)} className="absolute right-0 top-0 bottom-0 z-30 w-12 bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition text-4xl hidden md:block">›</button>
      </div>
    </section>
  );
}

function ContinueRow({ items, onPlay, onOpen, refresh }: { items: HistItem[]; onPlay: (p: Play) => void; onOpen: (i: Item, fb?: MediaType) => void; refresh: () => void }) {
  return (
    <Scroller title="Continue Watching">
      {items.map((h) => (
        <div key={h.item.id} className="shrink-0 w-64 md:w-80 group relative rounded-md overflow-hidden bg-zinc-900 ring-1 ring-white/5 hover:ring-red-600 transition">
          <button onClick={() => onPlay({ item: h.item, type: h.type, s: h.s, e: h.e })} className="block w-full aspect-video relative">
            <img src={img(h.item.backdrop_path || h.item.poster_path, "w780")} className="w-full h-full object-cover" alt="" loading="lazy" />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition flex items-center justify-center">
              <span className="w-12 h-12 rounded-full border-2 border-white bg-black/50 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 transition"><PlayIcon /></span>
            </div>
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20"><div className="h-full bg-red-600" style={{ width: `${30 + (h.item.id % 60)}%` }} /></div>
          </button>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0"><p className="text-sm font-semibold truncate">{titleOf(h.item)}</p><p className="text-xs text-gray-400">{h.type === "tv" ? `S${h.s} · E${h.e}` : "Movie"}</p></div>
            <div className="flex gap-1">
              <button title="Info" onClick={() => onOpen(h.item, h.type)} className="w-7 h-7 rounded-full border border-white/30 hover:border-white text-xs">ⓘ</button>
              <button title="Remove" onClick={() => { removeHistory(h.item.id); refresh(); }} className="w-7 h-7 rounded-full border border-white/30 hover:border-white text-xs">✕</button>
            </div>
          </div>
        </div>
      ))}
    </Scroller>
  );
}

function Row({ title, path, params, fb, onOpen, top }: { title: string; path: string; params?: Record<string, string>; fb: MediaType; onOpen: (i: Item, fb?: MediaType) => void; top?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const rowFb: MediaType = path.includes("/tv") ? "tv" : path.includes("/movie") ? "movie" : fb;
  useEffect(() => { tmdb(path, params).then((d) => setItems(d.results.filter((r: Item) => r.poster_path))); }, [path]);
  return (
    <Scroller title={title} badge={top ? "TOP 10" : undefined}>
      {items.length ? (top ? items.slice(0, 10) : items).map((i, n) => top ? (
        <div key={i.id} className="shrink-0 flex items-end">
          <span className="text-[7rem] md:text-[10rem] font-black leading-[0.8] -mr-4 md:-mr-6 text-transparent select-none" style={{ WebkitTextStroke: "3px #555" }}>{n + 1}</span>
          <Card item={i} onClick={() => onOpen(i, rowFb)} />
        </div>
      ) : <Card key={i.id} item={i} onClick={() => onOpen(i, rowFb)} />)
        : Array.from({ length: 8 }).map((_, k) => <div key={k} className="shrink-0 w-32 md:w-44 aspect-[2/3] rounded-md bg-zinc-800 animate-pulse" />)}
    </Scroller>
  );
}

function Card({ item, onClick, grid }: { item: Item; onClick: () => void; grid?: boolean }) {
  const theme = themeOf(item);
  return (
    <button
      type="button"
      onClick={onClick}
      data-primary={theme.primary}
      data-glow={theme.glow}
      style={{ "--card-primary": theme.primary, "--card-glow": theme.glow } as React.CSSProperties}
      aria-label={`${titleOf(item)}${yearOf(item) ? ` (${yearOf(item)})` : ""}`}
      className={`movie-card ${grid ? "w-full" : "shrink-0 w-36 md:w-48"} group relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 text-left
        hover:-translate-y-1.5 hover:scale-[1.04] hover:z-20 focus:outline-none`}
    >
      <img
        src={img(item.poster_path, "w342")}
        srcSet={item.poster_path ? `${img(item.poster_path, "w342")} 342w, ${img(item.poster_path, "w500")} 500w` : undefined}
        sizes="(min-width:768px) 192px, 144px"
        loading="lazy"
        decoding="async"
        alt={titleOf(item)}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />

      {/* always-visible rating chip */}
      {item.vote_average > 0 && (
        <span className="absolute top-2 left-2 flex items-center gap-1 text-[11px] font-bold bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full ring-1 ring-white/10 transition-opacity duration-300 group-hover:opacity-0">
          <span className="text-yellow-400">★</span>{item.vote_average.toFixed(1)}
        </span>
      )}

      {/* soft darkening for legibility */}
      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100" />

      {/* translucent info panel: fade + slide-up */}
      <div className="absolute inset-x-0 bottom-0 p-3 md:p-3.5 bg-black/55 backdrop-blur-md border-t border-white/10
        opacity-0 translate-y-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]
        group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
        <p className="font-bold text-sm md:text-[15px] leading-tight line-clamp-2 text-white">{titleOf(item)}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[11px] md:text-xs">
          {item.vote_average > 0 && <span className="flex items-center gap-0.5 font-semibold text-yellow-400">★ <span className="text-white">{item.vote_average.toFixed(1)}</span></span>}
          {yearOf(item) && <span className="text-gray-300">{yearOf(item)}</span>}
          <span className="ml-auto text-[10px] uppercase tracking-wider" style={{ color: "var(--card-primary)" }}>{typeOf(item) === "tv" ? "Series" : "Movie"}</span>
        </div>
        {item.overview && <p className="mt-1.5 text-[11px] md:text-xs text-gray-300/90 leading-snug line-clamp-3">{item.overview}</p>}
        <span className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold bg-white text-black rounded-full pl-1.5 pr-3 py-1">
          <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center"><PlayIcon c="w-3 h-3" /></span>Watch now
        </span>
      </div>
    </button>
  );
}

function Grid({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  return <div data-theme-grid className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">{items.map((i) => <Card grid key={i.id + (i.media_type || "")} item={i} onClick={() => onOpen(i)} />)}</div>;
}

function Discover({ onOpen }: { onOpen: (i: Item, fb?: MediaType) => void }) {
  const [type, setType] = useState<MediaType>("movie");
  const [genre, setGenre] = useState<number | null>(null);
  const [sort, setSort] = useState("popularity.desc");
  const [year, setYear] = useState("");
  const [rating, setRating] = useState(0);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(0);
  const [actorQ, setActorQ] = useState("");
  const [actorHits, setActorHits] = useState<any[]>([]);
  const [actor, setActor] = useState<any>(null);
  const genres = type === "movie" ? MOVIE_GENRES : TV_GENRES;

  useEffect(() => {
    if (actorQ.length < 2) return setActorHits([]);
    const t = setTimeout(() => tmdb("/search/person", { query: actorQ }).then((d) => setActorHits(d.results.slice(0, 6))), 250);
    return () => clearTimeout(t);
  }, [actorQ]);
  useEffect(() => { setPage(1); setItems([]); }, [type, genre, sort, year, rating, provider, actor?.id]);
  useEffect(() => {
    setLoading(true);
    const p: Record<string, string> = { sort_by: sort, page: String(page), "vote_count.gte": actor ? "0" : "50", "vote_average.gte": String(rating) };
    if (provider) { p.with_watch_providers = String(provider); p.watch_region = "US"; }
    if (actor) p[type === "movie" ? "with_cast" : "with_people"] = String(actor.id);
    if (genre) p.with_genres = String(genre);
    if (year) p[type === "movie" ? "primary_release_year" : "first_air_date_year"] = year;
    tmdb(`/discover/${type}`, p).then((d) => {
      const r = d.results.filter((x: Item) => x.poster_path).map((x: Item) => ({ ...x, media_type: type }));
      setItems((prev) => (page === 1 ? r : [...prev, ...r]));
    }).finally(() => setLoading(false));
  }, [type, genre, sort, year, rating, page]);

  const years = Array.from({ length: 50 }, (_, i) => String(new Date().getFullYear() - i));
  const sel = "bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-600";

  return (
    <div className="pt-28 px-4 md:px-12 pb-16 min-h-screen">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h1 className="text-3xl md:text-4xl font-black">Discover</h1><p className="text-gray-400 mt-1">Filter thousands of titles to find your next watch.</p></div>
        <div className="flex bg-zinc-900 rounded-full p-1 border border-white/10">
          {(["movie", "tv"] as MediaType[]).map((t) => <button key={t} onClick={() => { setType(t); setGenre(null); }} className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${type === t ? "bg-red-600" : "text-gray-400 hover:text-white"}`}>{t === "movie" ? "Movies" : "TV Shows"}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setGenre(null)} className={`px-4 py-1.5 rounded-full text-sm border transition ${genre === null ? "bg-white text-black border-white" : "border-white/15 text-gray-300 hover:border-white/50"}`}>All</button>
        {genres.map(([id, n]) => <button key={id} onClick={() => setGenre(id)} className={`px-4 py-1.5 rounded-full text-sm border transition ${genre === id ? "bg-white text-black border-white" : "border-white/15 text-gray-300 hover:border-white/50"}`}>{n}</button>)}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>
          <option value="popularity.desc">Most Popular</option>
          <option value="vote_average.desc">Highest Rated</option>
          <option value={type === "movie" ? "primary_release_date.desc" : "first_air_date.desc"}>Newest</option>
          <option value={type === "movie" ? "revenue.desc" : "vote_count.desc"}>{type === "movie" ? "Box Office" : "Most Voted"}</option>
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className={sel}><option value="">Any Year</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <select value={rating} onChange={(e) => setRating(+e.target.value)} className={sel}>{[0, 5, 6, 7, 8].map((r) => <option key={r} value={r}>{r ? `★ ${r}+` : "Any Rating"}</option>)}</select>
        <div className="relative">
          {actor ? (
            <button onClick={() => { setActor(null); setActorQ(""); }} className="flex items-center gap-2 bg-red-600/20 border border-red-600 rounded-lg pl-1 pr-3 py-1 text-sm">
              {actor.profile_path && <img src={img(actor.profile_path, "w45")} className="w-7 h-7 rounded object-cover" alt="" />}{actor.name} ✕
            </button>
          ) : (
            <input value={actorQ} onChange={(e) => setActorQ(e.target.value)} placeholder="🎭 Filter by actor…" className={sel + " w-48"} />
          )}
          {!actor && actorHits.length > 0 && (
            <div className="absolute top-11 left-0 z-20 w-64 bg-[#1a1a20] rounded-xl ring-1 ring-white/10 shadow-2xl py-1">
              {actorHits.map((a) => (
                <button key={a.id} onClick={() => { setActor(a); setActorHits([]); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left">
                  <span className="w-8 h-8 rounded bg-zinc-700 overflow-hidden">{a.profile_path && <img src={img(a.profile_path, "w45")} className="w-full h-full object-cover" alt="" />}</span>
                  <span className="text-sm">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <span className="text-xs uppercase tracking-widest text-gray-500 mr-1">Streaming on</span>
        <button onClick={() => setProvider(0)} className={`px-3 py-1.5 rounded-lg text-xs border ${!provider ? "bg-white text-black border-white" : "border-white/15 text-gray-300"}`}>Any</button>
        {PROVIDERS.map(([id, n]) => <button key={id} onClick={() => setProvider(id)} className={`px-3 py-1.5 rounded-lg text-xs border transition ${provider === id ? "bg-red-600 border-red-600" : "border-white/15 text-gray-300 hover:border-white/40"}`}>{n}</button>)}
      </div>
      {!loading && !items.length && <p className="text-gray-400 text-center py-10">No titles match these filters.</p>}
      <Grid items={items} onOpen={(i) => onOpen(i, type)} />
      <div className="flex justify-center mt-10">
        <button disabled={loading} onClick={() => setPage((p) => p + 1)} className="px-8 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 font-semibold disabled:opacity-50">{loading ? "Loading…" : "Load More"}</button>
      </div>
    </div>
  );
}

function MyList({ onOpen, onPlay }: { onOpen: (i: Item, fb?: MediaType) => void; onPlay: (p: Play) => void }) {
  const { user, requireAuth } = useApp();
  const [view, setView] = useState<"watch" | "favs" | "lists" | "hist">("watch");
  const [pls, setPls] = useState<Playlist[]>(getPlaylists());
  const [openPl, setOpenPl] = useState<string | null>(null);
  const l = getList();
  const f = getFavs();
  const h = getHistory();
  const empty = (t: string) => <div className="border border-dashed border-white/15 rounded-2xl p-14 text-center text-gray-400">{t}</div>;
  const cur = pls.find((p) => p.id === openPl);
  return (
    <div className="pt-28 px-4 md:px-12 pb-16 min-h-screen space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        {user && <Avatar u={user} size={56} />}
        <div><h2 className="text-3xl md:text-4xl font-black">{user ? `${user.name}'s Library` : "My Library"}</h2><p className="text-gray-400 text-sm">{l.length} saved · {f.length} favorites · {pls.length} playlists · {h.length} watched</p></div>
        {!user && <button onClick={requireAuth} className="ml-auto bg-red-600 px-5 py-2 rounded-full font-bold text-sm">Sign in to sync your profile</button>}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-white/10">
        {([["watch", "Watchlist", l.length], ["favs", "Favorites", f.length], ["lists", "Playlists", pls.length], ["hist", "History", h.length]] as const).map(([k, n, c]) => (
          <button key={k} onClick={() => { setView(k); setOpenPl(null); }} className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition ${view === k ? "border-red-600 text-white" : "border-transparent text-gray-400 hover:text-white"}`}>{n} <span className="text-xs text-gray-500">{c}</span></button>
        ))}
      </div>
      {view === "watch" && (l.length ? <Grid items={l} onOpen={(i) => onOpen(i, typeOf(i))} /> : empty("Your watchlist is empty. Tap + on any title to save it."))}
      {view === "favs" && (f.length ? <Grid items={f} onOpen={(i) => onOpen(i, typeOf(i))} /> : empty("No favorites yet. Tap ♡ on titles you love."))}
      {view === "lists" && (cur ? (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setOpenPl(null)} className="w-9 h-9 rounded-full bg-white/10">←</button>
            <h3 className="text-2xl font-bold">{cur.name}</h3><span className="text-gray-500">{cur.items.length} titles</span>
            <button onClick={() => { deletePlaylist(cur.id); setPls(getPlaylists()); setOpenPl(null); }} className="ml-auto text-sm text-red-400 hover:text-red-300">Delete playlist</button>
          </div>
          {cur.items.length ? <Grid items={cur.items} onOpen={(i) => onOpen(i, typeOf(i))} /> : empty("This playlist is empty. Use ≡+ on a title to add it.")}
        </div>
      ) : pls.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {pls.map((p) => (
            <button key={p.id} onClick={() => setOpenPl(p.id)} className="group text-left">
              <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-red-900/50 to-zinc-900 grid grid-cols-2 grid-rows-2 ring-1 ring-white/10 group-hover:ring-red-600 transition">
                {p.items.slice(0, 4).map((x) => <img key={x.id} src={img(x.poster_path, "w185")} className="w-full h-full object-cover" alt="" />)}
                {!p.items.length && <span className="col-span-2 row-span-2 flex items-center justify-center text-5xl">🎞️</span>}
              </div>
              <p className="font-semibold mt-2">{p.name}</p><p className="text-xs text-gray-500">{p.items.length} titles</p>
            </button>
          ))}
        </div>
      ) : empty("No playlists yet. Open any title and tap ≡+ to create one."))}
      {view === "hist" && !h.length && empty("Nothing watched yet.")}
      {view === "hist" && h.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Watch History</h2>
          <div className="divide-y divide-white/5">
            {h.map((x) => (
              <button key={x.item.id} onClick={() => onPlay({ item: x.item, type: x.type, s: x.s, e: x.e })} className="w-full flex items-center gap-4 py-3 hover:bg-white/5 px-2 rounded text-left">
                <img src={img(x.item.poster_path, "w92")} className="w-10 rounded" alt="" />
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{titleOf(x.item)}</p><p className="text-xs text-gray-400">{x.type === "tv" ? `Season ${x.s} · Episode ${x.e}` : "Movie"}</p></div>
                <span className="text-xs text-gray-500">{new Date(x.at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Details({ sel, onClose, onPlay, onOpen, notify }: { sel: Sel; onClose: () => void; onPlay: (p: Play) => void; onOpen: (i: Item, fb?: MediaType) => void; notify: (m: string) => void }) {
  const { item, type } = sel;
  const [d, setD] = useState<any>(null);
  const [season, setSeason] = useState(1);
  const [eps, setEps] = useState<any[]>([]);
  const [inList, setInList] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const [fav, setFav] = useState(false);
  const [picker, setPicker] = useState(false);
  const { openPerson, requireAuth, party, openParty } = useApp();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setD(null); setTrailer(false); box.current?.scrollTo(0, 0);
    setInList(getList().some((x) => x.id === item.id));
    setFav(isFav(item.id));
    tmdb(`/${type}/${item.id}`, { append_to_response: "credits,recommendations,videos,external_ids,release_dates,content_ratings,reviews,watch/providers,keywords" }).then((r) => {
      setD(r);
      if (type === "tv") {
        const h = getHistory().find((x) => x.item.id === item.id);
        setSeason(h?.s ?? r.seasons?.find((s: any) => s.season_number > 0)?.season_number ?? 1);
      }
    });
  }, [item.id, type]);
  useEffect(() => {
    if (type === "tv") tmdb(`/tv/${item.id}/season/${season}`).then((r) => setEps(r.episodes || [])).catch(() => setEps([]));
  }, [season, item.id, type]);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, []);

  const full: Item = d ? { ...item, ...d, media_type: type } : item;
  const title = titleOf(item);
  const runtime = d?.runtime ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m` : d?.number_of_seasons ? `${d.number_of_seasons} Season${d.number_of_seasons > 1 ? "s" : ""}` : "";
  const yt = d?.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || d?.videos?.results?.find((v: any) => v.site === "YouTube");
  const cert = type === "movie"
    ? d?.release_dates?.results?.find((r: any) => r.iso_3166_1 === "US")?.release_dates?.find((x: any) => x.certification)?.certification
    : d?.content_ratings?.results?.find((r: any) => r.iso_3166_1 === "US")?.rating;
  const imdb = d?.imdb_id || d?.external_ids?.imdb_id;
  const hist = getHistory().find((x) => x.item.id === item.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center overflow-hidden animate-fade" onClick={onClose}>
      <div ref={box} onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl md:my-8 bg-[#141418] md:rounded-2xl overflow-y-auto shadow-2xl ring-1 ring-white/10">
        <div className="relative aspect-video max-h-[62vh] w-full bg-black">
          {trailer && yt ? (
            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt.key}?autoplay=1&rel=0`} allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
          ) : (
            <>
              <img src={img(item.backdrop_path || item.poster_path, "original")} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141418] via-[#141418]/30 to-transparent" />
            </>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-lg z-10">✕</button>
          {!trailer && (
            <div className="absolute bottom-6 left-6 md:left-10 right-6">
              <h2 className="text-3xl md:text-5xl font-black drop-shadow-lg">{title}</h2>
              {d?.tagline && <p className="text-gray-300 italic mt-1">{d.tagline}</p>}
              <div className="flex flex-wrap gap-3 mt-5">
                <button onClick={() => onPlay({ type, item: full, s: hist?.s ?? season, e: hist?.e ?? 1 })} className="flex items-center gap-2 bg-white text-black font-bold px-7 py-2.5 rounded-md hover:bg-white/80">
                  <PlayIcon />{hist ? (type === "tv" ? `Resume S${hist.s} E${hist.e}` : "Resume") : type === "tv" ? `Play S${season} E1` : "Play"}
                </button>
                <button onClick={() => { const a = toggleList(full, type); setInList(a); notify(a ? "Added to My List" : "Removed from My List"); }} className="w-11 h-11 rounded-full border-2 border-white/50 bg-black/40 hover:border-white text-lg" title="My List">{inList ? "✓" : "+"}</button>
                {yt && <button onClick={() => setTrailer(true)} className="flex items-center gap-2 border-2 border-white/50 bg-black/40 px-5 py-2 rounded-md hover:border-white font-semibold">🎬 Trailer</button>}
                <button onClick={() => { if (!requireAuth()) return; const a = toggleFav(full, type); setFav(a); notify(a ? "❤️ Added to Favorites" : "Removed from Favorites"); }} className={`w-11 h-11 rounded-full border-2 bg-black/40 text-lg ${fav ? "border-red-600 text-red-500" : "border-white/50 hover:border-white"}`} title="Favorite">{fav ? "♥" : "♡"}</button>
                <button onClick={() => requireAuth() && setPicker(true)} className="w-11 h-11 rounded-full border-2 border-white/50 bg-black/40 hover:border-white" title="Add to playlist">≡+</button>
                <button onClick={() => { if (party.status !== "live") { openParty(); notify("Start or join a party first"); } else onPlay({ type, item: full, s: hist?.s ?? season, e: hist?.e ?? 1 }); }} className="flex items-center gap-2 border-2 border-red-600/70 bg-red-600/20 px-4 py-2 rounded-md hover:bg-red-600/40 font-semibold">🍿 Watch Together</button>
                <button onClick={() => { navigator.clipboard?.writeText(`${title} — https://www.themoviedb.org/${type}/${item.id}`); notify("Link copied"); }} className="w-11 h-11 rounded-full border-2 border-white/50 bg-black/40 hover:border-white" title="Share">⤴</button>
              </div>
            </div>
          )}
          {trailer && <button onClick={() => setTrailer(false)} className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-full text-sm z-10">← Back</button>}
        </div>

        <div className="px-6 md:px-10 py-6 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mb-4">
              <span className="text-green-400 font-bold">{Math.round(item.vote_average * 10)}% Match</span>
              <span>{yearOf(item)}</span>{cert && <span className="border border-gray-500 px-1.5 text-xs rounded">{cert}</span>}{runtime && <span>{runtime}</span>}
              <span className="border border-gray-500 px-1.5 text-xs rounded">HD</span><span className="border border-gray-500 px-1.5 text-xs rounded">CC</span>
              {d?.status && <span className="text-gray-500">{d.status}</span>}
            </div>
            <p className="text-gray-200 leading-relaxed">{d?.overview || item.overview}</p>
          </div>
          <div className="text-sm space-y-2 text-gray-400">
            {d?.genres && <p><span className="text-gray-500">Genres: </span><span className="text-gray-200">{d.genres.map((g: any) => g.name).join(", ")}</span></p>}
            {d?.credits?.crew?.find((c: any) => c.job === "Director") && <p><span className="text-gray-500">Director: </span><span className="text-gray-200">{d.credits.crew.find((c: any) => c.job === "Director").name}</span></p>}
            {d?.created_by?.length > 0 && <p><span className="text-gray-500">Created by: </span><span className="text-gray-200">{d.created_by.map((c: any) => c.name).join(", ")}</span></p>}
            {d?.spoken_languages && <p><span className="text-gray-500">Audio: </span><span className="text-gray-200">{d.spoken_languages.map((l: any) => l.english_name).slice(0, 3).join(", ")}</span></p>}
            {imdb && <a href={`https://www.imdb.com/title/${imdb}`} target="_blank" rel="noreferrer" className="inline-block mt-1 bg-yellow-400 text-black font-black px-2 py-0.5 rounded text-xs">IMDb ↗</a>}
          </div>
        </div>

        {d?.credits?.cast?.length > 0 && (
          <div className="px-6 md:px-10 pb-8">
            <h3 className="text-xl font-bold mb-4">Cast</h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {d.credits.cast.slice(0, 15).map((c: any) => (
                <div key={c.credit_id} onClick={() => openPerson(c.id)} className="shrink-0 w-24 text-center cursor-pointer group hover:[&_div]:ring-red-600">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 ring-2 ring-white/10">{c.profile_path ? <img src={img(c.profile_path, "w185")} className="w-full h-full object-cover" alt="" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-2xl text-gray-600">👤</div>}</div>
                  <p className="text-xs font-semibold mt-2 line-clamp-1">{c.name}</p><p className="text-[11px] text-gray-500 line-clamp-1">{c.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {type === "tv" && d?.seasons && (
          <div className="px-6 md:px-10 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Episodes</h3>
              <select value={season} onChange={(e) => setSeason(+e.target.value)} className="bg-zinc-800 border border-white/20 rounded-lg px-3 py-2 text-sm">
                {d.seasons.filter((s: any) => s.season_number > 0).map((s: any) => <option key={s.id} value={s.season_number}>{s.name} ({s.episode_count} eps)</option>)}
              </select>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {eps.map((ep) => {
                const cur = hist?.s === season && hist?.e === ep.episode_number;
                return (
                  <button key={ep.id} onClick={() => onPlay({ type, item: full, s: season, e: ep.episode_number })} className={`w-full flex gap-4 py-4 text-left hover:bg-white/5 px-2 rounded group ${cur ? "bg-red-600/10" : ""}`}>
                    <span className="text-2xl text-gray-500 w-8 self-center text-center">{ep.episode_number}</span>
                    <div className="relative w-32 md:w-44 shrink-0 aspect-video bg-zinc-800 rounded overflow-hidden">
                      {ep.still_path && <img src={img(ep.still_path, "w300")} loading="lazy" className="w-full h-full object-cover" alt="" />}
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50"><PlayIcon c="w-8 h-8" /></span>
                      {cur && <span className="absolute bottom-0 inset-x-0 h-1 bg-red-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2"><p className="font-semibold">{ep.name}</p>{ep.runtime && <span className="text-gray-500 text-sm shrink-0">{ep.runtime}m</span>}</div>
                      <p className="text-sm text-gray-400 line-clamp-2 mt-1">{ep.overview}</p>
                      {ep.air_date && <p className="text-xs text-gray-600 mt-1">{new Date(ep.air_date).toLocaleDateString()}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {d?.["watch/providers"]?.results?.US && (() => {
          const pr = d["watch/providers"].results.US;
          const groups: [string, any[]][] = [["Stream", pr.flatrate], ["Rent", pr.rent], ["Buy", pr.buy]].filter(([, l]) => l?.length) as any;
          return groups.length ? (
            <div className="px-6 md:px-10 pb-8">
              <h3 className="text-xl font-bold mb-4">Where to Watch <span className="text-xs text-gray-500 font-normal">(US · via JustWatch)</span></h3>
              <div className="flex flex-wrap gap-6">
                {groups.map(([g, l]) => (
                  <div key={g}><p className="text-xs uppercase tracking-widest text-gray-500 mb-2">{g}</p>
                    <div className="flex gap-2">{l.slice(0, 6).map((p: any) => <a key={p.provider_id} href={pr.link} target="_blank" rel="noreferrer" title={p.provider_name}><img src={img(p.logo_path, "w92")} className="w-11 h-11 rounded-xl ring-1 ring-white/10 hover:scale-110 transition" alt={p.provider_name} /></a>)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {d?.keywords && (d.keywords.keywords || d.keywords.results)?.length > 0 && (
          <div className="px-6 md:px-10 pb-8 flex flex-wrap gap-2">
            {(d.keywords.keywords || d.keywords.results).slice(0, 14).map((k: any) => <span key={k.id} className="text-xs px-3 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-gray-300">#{k.name}</span>)}
          </div>
        )}

        {d ? <Reviews type={type} id={item.id} data={d} /> : <div className="flex justify-center py-10"><Spinner /></div>}
        {picker && <PlaylistPicker item={full} type={type} onClose={() => setPicker(false)} />}

        {d?.recommendations?.results?.length > 0 && (
          <div className="px-6 md:px-10 pb-10">
            <h3 className="text-xl font-bold mb-4">More Like This</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {d.recommendations.results.filter((r: Item) => r.poster_path).slice(0, 12).map((r: Item) => <Card grid key={r.id} item={r} onClick={() => onOpen(r, type)} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Player({ p, onClose, onChange }: { p: Play; onClose: () => void; onChange: (p: Play) => void }) {
  const [server, setServer] = useState(getPref());
  const [panel, setPanel] = useState<"" | "servers" | "subs" | "eps">("");
  const [d, setD] = useState<any>(null);
  const [eps, setEps] = useState<any[]>([]);
  const [ui, setUi] = useState(true);
  const [ready, setReady] = useState(false);
  const [warn, setWarn] = useState("");
  const s = p.s ?? 1, e = p.e ?? 1;

  /* A nested or sandboxed frame blocks popups, storage and third-party cookies.
     That is why most embed providers fail here while one happens to get through. */
  const framed = typeof window !== "undefined" && window.self !== window.top;
  const openTab = () => {
    try { window.open(embedUrl(p.type, p.item.id, s, e, server), "_blank", "noopener"); setWarn(""); }
    catch { setWarn("This frame blocks new windows — copy the link instead."); }
  };

  useEffect(() => {
    tmdb(`/${p.type}/${p.item.id}`, { append_to_response: "external_ids" }).then(setD).catch(() => {});
  }, [p.item.id]);
  useEffect(() => { setReady(false); }, [server, s, e]);
  useEffect(() => {
    if (ready || !framed) return;
    const t = setTimeout(() => setWarn(`Still nothing? ${srv.name} may be blocked inside this preview frame. Open it in a new tab, or switch server.`), 7000);
    return () => clearTimeout(t);
  }, [ready, framed, server]);
  useEffect(() => {
    if (p.type === "tv") tmdb(`/tv/${p.item.id}/season/${s}`).then((r) => setEps(r.episodes || [])).catch(() => {});
  }, [p.item.id, s]);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && (panel ? setPanel("") : onClose());
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [panel]);
  useEffect(() => {
    let t: any;
    const m = () => { setUi(true); clearTimeout(t); t = setTimeout(() => setUi(false), 3500); };
    m(); window.addEventListener("mousemove", m);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", m); };
  }, []);

  const pick = (id: string) => { setServer(id); setPref(id); setPanel(""); };
  const seasons = d?.seasons?.filter((x: any) => x.season_number > 0) || [];
  const curSeason = seasons.find((x: any) => x.season_number === s);
  const hasNext = p.type === "tv" && (e < (curSeason?.episode_count ?? eps.length) || seasons.some((x: any) => x.season_number === s + 1));
  const next = () => {
    if (e < (curSeason?.episode_count ?? eps.length)) onChange({ ...p, e: e + 1 });
    else onChange({ ...p, s: s + 1, e: 1 });
  };
  const prev = () => { if (e > 1) onChange({ ...p, e: e - 1 }); else if (s > 1) onChange({ ...p, s: s - 1, e: 1 }); };
  const imdb = d?.imdb_id || d?.external_ids?.imdb_id;
  const epName = eps.find((x) => x.episode_number === e)?.name;
  const srv = SERVERS.find((x) => x.id === server) || SERVERS[0];
  const btn = "flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition";

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className={`absolute top-0 inset-x-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 bg-gradient-to-b from-black via-black/80 to-transparent transition-opacity duration-300 ${ui || panel ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-xl">←</button>
        <div className="min-w-0 mr-auto">
          <p className="font-bold truncate">{titleOf(p.item)}</p>
          {p.type === "tv" && <p className="text-xs text-gray-400 truncate">S{s} · E{e}{epName ? ` — ${epName}` : ""}</p>}
        </div>
        {p.type === "tv" && (
          <>
            <button disabled={s === 1 && e === 1} onClick={prev} className={`${btn} bg-white/10 hover:bg-white/20 disabled:opacity-30`}>⏮ Prev</button>
            <button disabled={!hasNext} onClick={next} className={`${btn} bg-white/10 hover:bg-white/20 disabled:opacity-30`}>Next ⏭</button>
            <button onClick={() => setPanel(panel === "eps" ? "" : "eps")} className={`${btn} ${panel === "eps" ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>☰ Episodes</button>
          </>
        )}
        <button onClick={() => setPanel(panel === "subs" ? "" : "subs")} className={`${btn} ${panel === "subs" ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>CC Subtitles</button>
        <button onClick={() => setPanel(panel === "servers" ? "" : "servers")} className={`${btn} ${panel === "servers" ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />{srv.name} ▾
        </button>
      </div>

      <iframe key={server + s + e} src={embedUrl(p.type, p.item.id, s, e, server)} frameBorder="0" className="flex-1 w-full" allowFullScreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerPolicy="origin" />

      {panel && (
        <aside className="absolute top-20 right-4 z-30 w-[min(380px,calc(100vw-2rem))] max-h-[calc(100vh-7rem)] overflow-y-auto bg-[#141418]/95 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 shadow-2xl p-4 animate-fade">
          {panel === "servers" && (
            <>
              <h4 className="font-bold mb-1">Choose Server</h4>
              <p className="text-xs text-gray-400 mb-3">If a source fails or buffers, try another. Your choice is remembered.</p>
              <div className="grid grid-cols-2 gap-2">
                {SERVERS.map((x, i) => (
                  <button key={x.id} onClick={() => pick(x.id)} className={`text-left p-3 rounded-xl border transition ${server === x.id ? "border-red-600 bg-red-600/15" : "border-white/10 hover:border-white/30 bg-white/5"}`}>
                    <p className="text-sm font-semibold flex items-center gap-2">{server === x.id && <span className="w-2 h-2 rounded-full bg-green-400" />}{x.name}</p>
                    <p className="text-[11px] text-gray-400">Server {i + 1}{x.tag ? ` · ${x.tag}` : ""}</p>
                  </button>
                ))}
              </div>
            </>
          )}
          {panel === "subs" && (
            <>
              <h4 className="font-bold mb-1">Subtitles</h4>
              <p className="text-xs text-gray-400 mb-3">Most servers have built‑in subtitles — use the <b>CC</b> / ⚙ button inside the player. Need another language? Grab one below.</p>
              <div className="space-y-2">
                {subtitleLinks(imdb, titleOf(p.item), p.type === "tv" ? s : undefined, p.type === "tv" ? e : undefined).map((l) => (
                  <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">
                    <span className="text-sm font-semibold">{l.name}</span><span className="text-xs text-gray-400">Open ↗</span>
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">Tip: VidLink & Videasy servers offer the widest built‑in subtitle selection.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => pick("vidlink")} className="flex-1 text-xs py-2 rounded-lg bg-red-600 hover:bg-red-700 font-semibold">Switch to VidLink</button>
                <button onClick={() => pick("videasy")} className="flex-1 text-xs py-2 rounded-lg bg-white/10 hover:bg-white/20 font-semibold">Switch to Videasy</button>
              </div>
            </>
          )}
          {panel === "eps" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold">Episodes</h4>
                <select value={s} onChange={(ev) => onChange({ ...p, s: +ev.target.value, e: 1 })} className="bg-zinc-800 border border-white/20 rounded-lg px-2 py-1 text-sm">
                  {seasons.map((x: any) => <option key={x.id} value={x.season_number}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                {eps.map((ep) => (
                  <button key={ep.id} onClick={() => { onChange({ ...p, e: ep.episode_number }); setPanel(""); }} className={`w-full flex gap-3 p-2 rounded-lg text-left ${ep.episode_number === e ? "bg-red-600/20 ring-1 ring-red-600" : "hover:bg-white/5"}`}>
                    <div className="w-24 shrink-0 aspect-video bg-zinc-800 rounded overflow-hidden">{ep.still_path && <img src={img(ep.still_path, "w185")} className="w-full h-full object-cover" alt="" loading="lazy" />}</div>
                    <div className="min-w-0"><p className="text-sm font-semibold line-clamp-1">{ep.episode_number}. {ep.name}</p><p className="text-xs text-gray-400 line-clamp-2">{ep.overview}</p></div>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      )}
      {warn && (
        <div className="absolute bottom-4 left-4 right-4 z-30 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/90 p-3 text-sm backdrop-blur">
          <span className="text-gray-300">{warn}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={openTab} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black">Open in new tab ↗</button>
            <button onClick={() => pick(SERVERS[(SERVERS.findIndex((x) => x.id === server) + 1) % SERVERS.length].id)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Next server</button>
            <button onClick={() => { navigator.clipboard?.writeText(embedUrl(p.type, p.item.id, s, e, server)); setWarn("Link copied to clipboard."); }} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Copy link</button>
            <button onClick={() => setWarn("")} className="rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:text-white">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
