import { useEffect, useRef, useState } from "react";
import { storage, isPersistent } from "./safeStore";
import { inFrame } from "./tmdb";

export interface Profile { id: string; name: string; avatar: string }

const base = ((import.meta as any).env?.BASE_URL as string) || "/";
/** unavatar.io — universal avatar API (https://unavatar.io/docs). fallback=false → 404 so we can chain to a local image. */
const una = (path: string) => `https://unavatar.io/${path}?fallback=false`;
const local = (f: string) => `${base}avatars/${f}`;
/** Illustrated fallback when unavatar has no image — muted, desaturated palette */
const dice = (seed: string) => `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=1a1d21,22262b,2a2f35,1c2226&backgroundType=solid`;

export const ANIME_AVATARS: { id: string; label: string; src: string; fallback?: string }[] = [
  { id: "luffy", label: "Luffy", src: una("x/Eiichiro_Staff"), fallback: local("luffy.jpg") },
  { id: "naruto", label: "Naruto", src: una("x/NARUTO_kousiki"), fallback: local("naruto.jpg") },
  { id: "zoro", label: "Zoro", src: una("x/OnePieceAnime"), fallback: local("zoro.jpg") },
  { id: "sailor", label: "Sailor Moon", src: una("x/sailormoon_20th"), fallback: local("sailor.jpg") },
  { id: "goku", label: "Goku", src: una("x/DB_official_en"), fallback: "svg:goku" },
  { id: "anya", label: "Anya", src: una("x/spyfamily_anime"), fallback: local("anya.jpg") },
  { id: "jjk", label: "Gojo", src: una("x/animejujutsu"), fallback: local("kai.jpg") },
  { id: "tanjiro", label: "Tanjiro", src: una("x/kimetsu_off"), fallback: dice("Tanjiro") },
  { id: "eren", label: "Eren", src: una("x/anime_shingeki"), fallback: dice("Eren") },
  { id: "deku", label: "Deku", src: una("x/heroaca_anime"), fallback: dice("Deku") },
  { id: "denji", label: "Denji", src: una("x/CHAINSAWMAN_PR"), fallback: dice("Denji") },
  { id: "frieren", label: "Frieren", src: una("x/Anime_Frieren"), fallback: dice("Frieren") },
  { id: "ichigo", label: "Ichigo", src: una("x/bleachanime"), fallback: dice("Ichigo") },
  { id: "gon", label: "Gon", src: una("x/hxh_official"), fallback: dice("Gon") },
  { id: "saitama", label: "Saitama", src: una("x/opm_anime"), fallback: dice("Saitama") },
  { id: "pikachu", label: "Pikachu", src: una("x/Pokemon"), fallback: dice("Pikachu") },
  { id: "totoro", label: "Totoro", src: una("x/JP_GHIBLI"), fallback: dice("Totoro") },
  { id: "conan", label: "Conan", src: una("x/conan_file"), fallback: dice("Conan") },
  { id: "rem", label: "Rem", src: una("x/Rezero_official"), fallback: dice("Rem") },
  { id: "crunchy", label: "Crunchyroll", src: una("x/Crunchyroll"), fallback: dice("Crunchy") },
  { id: "guest", label: "Guest", src: "svg:guest" },
];
const FALLBACKS: Record<string, string> = Object.fromEntries(ANIME_AVATARS.filter((a) => a.fallback).map((a) => [a.src, a.fallback!]));

const SEED: Profile[] = [
  { id: "p-luffy", name: "Luffy", avatar: ANIME_AVATARS[0].src },
  { id: "p-guest", name: "Guest", avatar: "svg:guest" },
];
const KEY = "ark_profiles";
export const loadProfiles = (): Profile[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return Array.isArray(v) && v.length ? v : SEED; } catch { return SEED; } };

/** Flat, geometric fallbacks — no gradients */
function SvgAvatar({ kind }: { kind: string }) {
  if (kind === "goku") return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect width="100" height="100" fill="#1b2430" />
      <path d="M18 52 L10 22 L30 36 L32 8 L44 30 L52 4 L58 30 L72 10 L70 36 L92 24 L82 52 Z" fill="#0b0b0b" />
      <ellipse cx="50" cy="60" rx="22" ry="25" fill="#e8cdb3" />
      <path d="M28 46 L40 38 L46 46 L54 36 L60 46 L72 42 L72 52 L28 52Z" fill="#0b0b0b" />
      <circle cx="42" cy="63" r="2.3" fill="#0b0b0b" /><circle cx="58" cy="63" r="2.3" fill="#0b0b0b" />
      <path d="M44 74 Q50 78 56 74" stroke="#5a2a1a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M14 100 Q20 84 38 82 L50 92 L62 82 Q80 84 86 100Z" fill="#c2621f" />
    </svg>
  );
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect width="100" height="100" fill="#16181b" />
      <circle cx="50" cy="40" r="15" fill="none" stroke="#E2E8F0" strokeOpacity=".55" strokeWidth="1.2" />
      <path d="M22 88 Q24 62 50 62 Q76 62 78 88" fill="none" stroke="#E2E8F0" strokeOpacity=".55" strokeWidth="1.2" />
    </svg>
  );
}

export function AvatarImg({ src, alt }: { src: string; alt: string }) {
  const [cur, setCur] = useState(src);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setCur(src); setLoaded(false); }, [src]);
  const fail = () => { const fb = FALLBACKS[cur]; setCur(fb && fb !== cur ? fb : "svg:guest"); };
  if (cur.startsWith("svg:")) return <SvgAvatar kind={cur.slice(4)} />;
  return (
    <span className="relative block w-full h-full bg-[#111214]">
      <img src={cur} alt={alt} loading="lazy" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={fail} className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`} draggable={false} />
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const EASE = "ease-[cubic-bezier(.22,.61,.36,1)]";

export default function Profiles({ onSelect }: { onSelect: (p: Profile) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [adding, setAdding] = useState(false);
  const [manage, setManage] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(ANIME_AVATARS[1].src);
  const [err, setErr] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { storage.setItem(KEY, JSON.stringify(profiles)); }, [profiles]);
  useEffect(() => {
    if (!adding) return;
    setTimeout(() => nameRef.current?.focus(), 60);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setAdding(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [adding]);

  const openForm = () => { setName(""); setErr(""); setAvatar(ANIME_AVATARS[profiles.length % ANIME_AVATARS.length].src); setAdding(true); };
  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = name.trim();
    if (!n) return setErr("A name is required.");
    if (profiles.some((p) => p.name.toLowerCase() === n.toLowerCase())) return setErr("That name is already in use.");
    setProfiles((prev) => [...prev, { id: `p-${Date.now()}`, name: n, avatar }]);
    setAdding(false);
  };
  const remove = (id: string) => setProfiles((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  const pick = (p: Profile) => {
    if (manage) return remove(p.id);
    if (chosen) return;
    setChosen(p.id);
    setTimeout(() => onSelect(p), 520);
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const [persistent] = useState(isPersistent);

  return (
    <div className="ark-ed absolute inset-0 overflow-y-auto bg-[#050505] text-[#E2E8F0] antialiased">
      {/* faint top-left light */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(1200px 700px at 0% 0%, rgba(148,163,184,0.07), transparent 60%)" }} />

      <div className="relative mx-auto max-w-[1400px] min-h-full flex flex-col px-6 sm:px-10 lg:px-16">
        {/* masthead */}
        <header className="flex items-center justify-between py-7 border-b border-white/[0.06]">
          <span className="ark-serif text-[22px] tracking-[-0.01em]">Arkaflix</span>
          <span className="hidden sm:block text-[11px] uppercase tracking-[0.28em] text-white/35">{today}</span>
        </header>

        <main className="flex-1 grid grid-cols-12 gap-x-6 lg:gap-x-10 pt-14 sm:pt-20 lg:pt-28 pb-20">
          {/* editorial column */}
          <section className="col-span-12 lg:col-span-5 lg:border-r lg:border-white/[0.06] lg:pr-10">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/40 mb-6">
              {manage ? "Edit · Remove profiles" : `Profiles · ${pad(profiles.length)}`}
            </p>
            <h1 className="ark-serif text-[56px] leading-[0.92] sm:text-[84px] lg:text-[104px] tracking-[-0.035em] text-[#F1F5F9]">
              {manage ? <>Manage<br /><em className="text-white/55">profiles.</em></> : <>Who’s<br /><em className="text-white/55">watching?</em></>}
            </h1>
            <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-white/50 tracking-[-0.005em]">
              {manage ? "Select a profile to remove it. At least one profile must remain." : "Each profile keeps its own history, list, and recommendations."}
            </p>

            {inFrame() && (
              <p className="mt-6 max-w-sm rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[12px] leading-relaxed text-white/45">
                You're viewing Arkaflix inside a preview frame. Playback providers mostly refuse to load here, so videos may need the “Open in new tab” button in the player.
              </p>
            )}

            <div className="mt-10 flex items-center gap-6 text-[13px]">
              <button onClick={() => setManage(!manage)} className={`group inline-flex items-center gap-3 tracking-[-0.005em] transition-colors duration-300 ${manage ? "text-[#E2E8F0]" : "text-white/55 hover:text-[#E2E8F0]"}`}>
                <span className={`h-px transition-all duration-500 ${EASE} ${manage ? "w-10 bg-[#E2E8F0]" : "w-6 bg-white/30 group-hover:w-10 group-hover:bg-[#E2E8F0]"}`} />
                {manage ? "Done" : "Manage profiles"}
              </button>
            </div>
          </section>

          {/* asymmetric grid */}
          <section className="col-span-12 lg:col-span-7 mt-16 lg:mt-2">
            <ol className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 sm:gap-x-7 gap-y-12">
              {profiles.map((p, i) => {
                const isChosen = chosen === p.id;
                const dim = chosen && !isChosen;
                return (
                  <li key={p.id} className={`ark-rise ${i % 3 === 1 ? "sm:translate-y-14" : ""} ${i % 2 === 1 ? "translate-y-8 sm:translate-y-0" : ""} ${i % 3 === 1 && i % 2 === 1 ? "sm:translate-y-14" : ""}`} style={{ animationDelay: `${120 + i * 60}ms` }}>
                    <button onClick={() => pick(p)} className="group block w-full text-left focus:outline-none" aria-label={manage ? `Remove ${p.name}` : `Continue as ${p.name}`}>
                      <span
                        className={`relative block aspect-[4/5] overflow-hidden rounded-[6px] outline outline-1 -outline-offset-1 transition-[transform,outline-color,filter,opacity] duration-500 ${EASE}
                          ${isChosen ? "outline-white scale-[1.03] brightness-110" : "outline-transparent group-hover:outline-white/90 group-focus-visible:outline-[#7DD3D8] group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"}
                          ${dim ? "opacity-30 brightness-50" : "brightness-[.92] group-hover:brightness-100"}`}
                      >
                        <AvatarImg src={p.avatar} alt="" />
                        {manage && (
                          <span className="absolute inset-0 flex items-end bg-black/55 p-3">
                            <span className="text-[11px] uppercase tracking-[0.24em] text-white/90">{profiles.length > 1 ? "Remove —" : "Required"}</span>
                          </span>
                        )}
                      </span>
                      <span className={`mt-4 flex items-baseline gap-3 transition-opacity duration-500 ${dim ? "opacity-30" : ""}`}>
                        <span className="text-[11px] tabular-nums text-white/30 tracking-[0.08em]">{pad(i + 1)}</span>
                        <span className="text-[15px] font-medium tracking-[-0.015em] text-[#E2E8F0] truncate">{p.name}</span>
                      </span>
                    </button>
                  </li>
                );
              })}

              {!manage && (
                <li className={`ark-rise ${profiles.length % 3 === 1 ? "sm:translate-y-14" : ""}`} style={{ animationDelay: `${120 + profiles.length * 60}ms` }}>
                  <button onClick={openForm} className="group block w-full text-left focus:outline-none" aria-label="Add a profile">
                    <span className={`relative flex aspect-[4/5] items-center justify-center rounded-[6px] border border-dashed border-white/[0.14] transition-[transform,border-color] duration-500 ${EASE} group-hover:scale-[1.03] group-hover:border-solid group-hover:border-white/90 group-focus-visible:border-[#7DD3D8]`}>
                      <svg width="28" height="28" viewBox="0 0 28 28" className="text-white/40 group-hover:text-white transition-colors duration-300"><path d="M14 4v20M4 14h20" stroke="currentColor" strokeWidth="1" /></svg>
                    </span>
                    <span className="mt-4 flex items-baseline gap-3">
                      <span className="text-[11px] tabular-nums text-white/30 tracking-[0.08em]">{pad(profiles.length + 1)}</span>
                      <span className="text-[15px] font-medium tracking-[-0.015em] text-white/60 group-hover:text-[#E2E8F0] transition-colors">Add profile</span>
                    </span>
                  </button>
                </li>
              )}
            </ol>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 py-6 border-t border-white/[0.06] text-[11px] tracking-[0.2em] uppercase text-white/30">
          <span>Arkaflix — Personal Cinema</span>
          {!persistent && <span className="text-white/40">Preview frame — profiles last this session only</span>}
          <a href="https://unavatar.io" target="_blank" className="normal-case tracking-normal hover:text-white/70 transition-colors">Avatars provided by Unavatar</a>
        </footer>
      </div>

      {/* Add profile modal */}
      {adding && (
        <div className="fixed inset-0 z-10 flex items-end sm:items-center justify-center sm:p-6 bg-black/40 ark-fade" onClick={() => setAdding(false)}>
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="ark-sheet w-full sm:max-w-[640px] max-h-[94vh] overflow-y-auto rounded-t-[14px] sm:rounded-[14px] border border-white/[0.08] bg-[rgba(10,10,10,0.85)] backdrop-blur-[16px]"
            style={{ WebkitBackdropFilter: "blur(16px)" }}
          >
            <div className="flex items-start justify-between px-7 sm:px-9 pt-8">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">New profile</p>
                <h2 className="ark-serif mt-3 text-[40px] sm:text-[48px] leading-none tracking-[-0.03em]">Add a <em className="text-white/55">viewer.</em></h2>
              </div>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="mt-1 text-white/40 hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1" /></svg>
              </button>
            </div>

            <div className="px-7 sm:px-9 mt-8 grid grid-cols-[88px_1fr] sm:grid-cols-[104px_1fr] gap-6 items-end">
              <span className="block aspect-[4/5] overflow-hidden rounded-[6px] outline outline-1 -outline-offset-1 outline-white/80"><AvatarImg src={avatar} alt="Selected avatar" /></span>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.28em] text-white/45">Name</span>
                <input
                  ref={nameRef}
                  maxLength={20}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErr(""); }}
                  placeholder="e.g. Mira"
                  className={`mt-2 block w-full bg-transparent border-0 border-b ${err ? "border-[#F87171]" : "border-white/15"} px-0 pb-2.5 pt-1 text-[22px] tracking-[-0.02em] text-[#F1F5F9] placeholder-white/20 outline-none ring-0 focus:border-[#7DD3D8] transition-colors duration-200`}
                />
                <span className={`block mt-2 text-[12px] h-4 ${err ? "text-[#F87171]" : "text-white/30"}`}>{err || `${name.length}/20`}</span>
              </label>
            </div>

            <div className="px-7 sm:px-9 mt-8">
              <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-white/45">Choose avatar</span>
                <span className="text-[11px] tabular-nums text-white/30">{pad(ANIME_AVATARS.length)} options</span>
              </div>
              <div className="mt-5 grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[38vh] overflow-y-auto p-1 -m-1">
                {ANIME_AVATARS.map((a) => {
                  const on = avatar === a.src;
                  return (
                    <button type="button" key={a.id} onClick={() => setAvatar(a.src)} aria-pressed={on} className="group text-left focus:outline-none">
                      <span className={`block aspect-square overflow-hidden rounded-[5px] outline outline-1 -outline-offset-1 transition-[transform,outline-color,filter] duration-300 ${EASE}
                        ${on ? "outline-white brightness-110" : "outline-transparent brightness-[.6] group-hover:brightness-100 group-hover:outline-white/60 group-focus-visible:outline-[#7DD3D8] group-hover:scale-[1.03]"}`}>
                        <AvatarImg src={a.src} alt={a.label} />
                      </span>
                      <span className={`mt-1.5 block truncate text-[11px] tracking-[-0.005em] transition-colors ${on ? "text-[#E2E8F0]" : "text-white/35 group-hover:text-white/70"}`}>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-2 border-t border-white/[0.06] px-7 sm:px-9 py-5">
              <button type="button" onClick={() => setAdding(false)} className="h-11 px-5 rounded-[6px] text-[14px] tracking-[-0.01em] text-white/60 hover:text-white border border-transparent focus:outline-none focus-visible:border-[#7DD3D8] transition-colors">Cancel</button>
              <button type="submit" className="h-11 px-7 rounded-[6px] text-[14px] font-medium tracking-[-0.01em] bg-[#F1F5F9] text-[#050505] hover:bg-white border border-transparent focus:outline-none focus-visible:border-[#7DD3D8] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#7DD3D8] transition-colors">Save profile</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
