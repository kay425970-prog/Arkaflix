import { useEffect, useRef, useState } from "react";
import { img, titleOf, MediaType, Item, tmdb } from "./tmdb";
import { Profile } from "./Profiles";
import {
  capabilities, Capabilities, downloadDirectFile, downloadImage, exportLibrary, importLibrary,
  installApp, onInstallChange, Progress, registerServiceWorker, state as installState, InstallState, SaveResult,
} from "./downloads";
import { RELEASE, checkFile, FileStatus } from "./release";

const Row = ({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] py-5">
    <div className="min-w-[220px] flex-1">
      <p className="text-[15px] text-[#E2E8F0]">{label}</p>
      {note && <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-white/45">{note}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const Btn = ({ onClick, children, kind = "ghost", disabled }: { onClick?: () => void; children: React.ReactNode; kind?: "solid" | "ghost"; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`h-10 rounded-[6px] px-4 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
      kind === "solid" ? "bg-[#F1F5F9] font-medium text-[#050505] hover:bg-white" : "border border-white/15 text-white/70 hover:border-white/50 hover:text-white"
    }`}
  >
    {children}
  </button>
);

const Note = ({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" }) => (
  <p className={`max-w-2xl text-[13px] leading-relaxed ${tone === "warn" ? "text-amber-300/80" : "text-white/45"}`}>{children}</p>
);

const flash = (setMsg: (s: string) => void) => (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
const say = (r: SaveResult, name: string) => r === "saved" ? `Saved to your chosen folder as ${name}` : r === "cancelled" ? "Cancelled" : `Downloaded ${name}`;

export function Downloads({ profile, go }: { profile: Profile | null; go: (t: "home") => void }) {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [hits, setHits] = useState<Item[]>([]);
  const [looking, setLooking] = useState("");
  const [apkStatus, setApk] = useState<FileStatus>("checking");
  const [exeStatus, setExe] = useState<FileStatus>("checking");
  const [install, setInstall] = useState<InstallState>(installState);
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState("");
  const [prog, setProg] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<{ id: number; title: string; type: MediaType; poster: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("ark_saved_files") || "[]"); } catch { return []; }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const tell = flash(setMsg);

  useEffect(() => {
    setCaps(capabilities()); setInstall(installState()); registerServiceWorker();
    const off = onInstallChange(setInstall);
    // Probe the release server so the native-installer buttons only enable for real files.
    checkFile(RELEASE.apkUrl).then(setApk);
    checkFile(RELEASE.exeUrl).then(setExe);
    return () => { off(); };
  }, []);
  useEffect(() => {
    if (looking.trim().length < 2) return setHits([]);
    const t = setTimeout(() => tmdb("/search/multi", { query: looking, include_adult: "false" })
      .then((d) => setHits(d.results.filter((r: Item) => r.media_type !== "person" && r.poster_path).slice(0, 8))), 300);
    return () => clearTimeout(t);
  }, [looking]);
  useEffect(() => { try { localStorage.setItem("ark_saved_files", JSON.stringify(items.slice(0, 24))); } catch {} }, [items]);

  const remember = (i: Item, t: MediaType, kind: string) =>
    setItems((prev) => [{ id: i.id, title: titleOf(i), type: t, poster: i.poster_path || "", ...(kind ? {} : {}) } as any, ...prev.filter((x) => x.id !== i.id)].slice(0, 24));

  const grabImage = async (i: Item, t: MediaType, what: "poster" | "backdrop") => {
    const path = what === "poster" ? i.poster_path : i.backdrop_path;
    if (!path) return setErr(`No ${what} available for this title`);
    setBusy(true);
    try {
      const r = await downloadImage(img(path, "original"), `${titleOf(i)} (${what}).jpg`);
      tell(say(r, `${titleOf(i)} ${what}`));
      remember(i, t, what);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const grabUrl = async () => {
    if (!url.trim()) return;
    setBusy(true); setErr(""); setProg(null);
    const name = safeFileFrom(url);
    try {
      const r = await downloadDirectFile(url.trim(), name, setProg);
      tell(say(r, name));
    } catch (e: any) { setErr(e.message); }
    setProg(null); setBusy(false);
  };

  const doInstall = async () => {
    const r = await installApp();
    if (r === "accepted") tell("Arkaflix installed — look for it in your apps.");
    else if (r === "dismissed") tell("Install dismissed.");
    else setErr(`Your browser isn't offering an install right now. ${manualHint(install.platform)}`);
  };

  const doExport = async () => {
    try { const r = await exportLibrary(profile?.name || "guest"); tell(say(r, "your library")); }
    catch (e: any) { setErr(e.message); }
  };

  const doImport = async (f?: File) => {
    if (!f) return;
    try { const n = await importLibrary(f, profile?.name || "guest"); tell(`Imported ${n} entries into ${profile?.name || "guest"}.`); go("home"); }
    catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="ark-ed mx-auto max-w-[1100px] px-6 pt-28 pb-24 sm:px-10">
      <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">Offline · Device</p>
      <h1 className="ark-serif mt-3 text-[52px] leading-[0.95] tracking-[-0.035em] text-[#F1F5F9] sm:text-[72px]">
        Downloads <em className="text-white/55">&amp; app.</em>
      </h1>

      {msg && <div className="mt-6 rounded-[6px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-[#E2E8F0]">{msg}</div>}
      {err && <div className="mt-6 rounded-[6px] border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-[13px] text-amber-200/90">{err}</div>}

      {/* ---- Native installers, once they have actually been built ---- */}
      <section className="mt-12">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/45">Native installers</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([["Android", ".apk", apkStatus, RELEASE.apkUrl], ["Windows", ".exe", exeStatus, RELEASE.exeUrl]] as const).map(([os, ext, st, url]) => (
            <div key={ext} className="rounded-[8px] border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-[15px] text-[#E2E8F0]">Arkaflix for {os}</p>
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/35">{ext}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-white/45">
                {st === "ready" ? `Version ${RELEASE.version}. Signed build from the official release.`
                 : st === "checking" ? "Checking the release server…"
                 : st === "missing" ? "Not published yet."
                 : "No release address configured yet."}
              </p>
              <div className="mt-4">
                <Btn kind="solid" disabled={st !== "ready"} onClick={() => { location.href = url; }}>
                  {st === "ready" ? `Download for ${os}` : "Unavailable"}
                </Btn>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/45">
          These buttons only light up once real installers have been built and published — until then they refuse to hand out dead
          links. <code>BUILD-INSTALLERS.md</code> in the repo walks through the whole thing: push a git tag and GitHub builds both
          files automatically, then you paste their addresses into <code>src/release.ts</code>.
        </p>
      </section>

      {/* ---- Install the app ---- */}
      <section className="mt-12">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/45">Install as an app</h2>
        <div className="mt-2">
          <Row
            label={install.installed ? "Arkaflix is installed" : `Install Arkaflix on ${install.platform}`}
            note={install.installed
              ? "You're running the installed app."
              : "Installs a real standalone app: own window, home-screen icon, offline shell. No store account, no binary download."}
          >
            {install.installed
              ? <span className="text-[13px] text-white/40">Already installed</span>
              : <Btn kind="solid" onClick={doInstall} disabled={!install.available}>{install.available ? "Install" : "Not offered yet"}</Btn>}
          </Row>
          <Row
            label="Looking for an .apk or .exe?"
            note={`I can't produce those binaries here — a real APK needs the Android SDK and a signing key, and a Windows EXE needs an installer build. Both would be large opaque files I have no way to verify. What I can do is make this an installable app, which is the same end result on ${install.platform}. If you want a store-grade package, build it from this code with one of the commands below.`}
          >
            <Btn onClick={() => { navigator.clipboard?.writeText(buildApk); tell("Android build commands copied."); }}>Copy Android steps</Btn>
            <Btn onClick={() => { navigator.clipboard?.writeText(buildExe); tell("Windows build commands copied."); }}>Copy Windows steps</Btn>
          </Row>
          <details className="border-b border-white/[0.06] py-5">
            <summary className="cursor-pointer text-[13px] text-white/50 hover:text-white">Show the build commands</summary>
            <pre className="mt-4 overflow-x-auto rounded-[6px] border border-white/10 bg-black/60 p-4 text-[12px] leading-relaxed text-white/70">{buildApk}</pre>
            <pre className="mt-3 overflow-x-auto rounded-[6px] border border-white/10 bg-black/60 p-4 text-[12px] leading-relaxed text-white/70">{buildExe}</pre>
          </details>
        </div>
      </section>

      {/* ---- Downloading titles ---- */}
      <section className="mt-14">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/45">Save a title's artwork</h2>
        <div className="mt-2">
          <div className="border-b border-white/[0.06] py-5">
            <p className="text-[15px] text-[#E2E8F0]">Save posters &amp; backdrops to your device</p>
            <Note>Written straight to storage through the File System Access API, or downloaded if your browser lacks it. Find a title, then grab its artwork.</Note>
            <div className="relative mt-4 max-w-md">
              <input
                value={looking}
                onChange={(e) => setLooking(e.target.value)}
                placeholder="Search a film or series…"
                className="w-full rounded-[6px] border border-white/15 bg-transparent px-4 py-2.5 text-[14px] text-[#E2E8F0] placeholder-white/25 outline-none transition-colors focus:border-[#7DD3D8]"
              />
              {!!hits.length && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[6px] border border-white/10 bg-[#0c0c0e]">
                  {hits.map((h) => (
                    <button key={h.id} onClick={() => { grabImage(h, h.media_type === "tv" ? "tv" : "movie", "poster"); setHits([]); setLooking(""); }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5">
                      <img src={img(h.poster_path, "w92")} alt="" className="h-12 w-8 rounded object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[#E2E8F0]">{titleOf(h)}</span>
                        <span className="block text-[11px] text-white/40">{h.release_date?.slice(0, 4) || h.first_air_date?.slice(0, 4)} · {h.media_type === "tv" ? "Series" : "Film"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn onClick={() => go("home")}>Browse all titles</Btn>
                {!!hits.length && <Btn onClick={async () => { const h = hits[0]; await grabImage(h, h.media_type === "tv" ? "tv" : "movie", "backdrop"); }}>Backdrop of first result</Btn>}
              </div>
            </div>
          </div>
          <div className="border-b border-white/[0.06] py-5">
            <Row label="Recently saved" note="Kept on this device only.">
              <span className="text-[13px] text-white/40">{items.length ? `${items.length} item${items.length > 1 ? "s" : ""}` : "Nothing yet"}</span>
              {!!items.length && <Btn onClick={() => setItems([])}>Clear</Btn>}
            </Row>
            {!!items.length && (
              <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
                {items.map((it) => (
                  <div key={it.id} className="group">
                    <div className="aspect-[2/3] overflow-hidden rounded-[6px] outline outline-1 outline-transparent transition group-hover:outline-white/80">
                      <img src={img(it.poster, "w185")} alt="" className="h-full w-full object-cover" />
                    </div>
                    <p className="mt-2 truncate text-[11px] text-white/50">{it.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- Direct file downloader ---- */}
      <section className="mt-14">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/45">Direct file downloader</h2>
        <div className="mt-4 rounded-[8px] border border-white/[0.08] bg-white/[0.02] p-5">
          <Note tone="warn">
            This is the part I have to be straight with you about: the film files aren't on this site. They stream from the embed
            providers' own servers on other origins, and browsers refuse cross-origin reads of those streams (CORS) — plus protected
            streams are unreadable by design. So there is no button I can add that pulls a full movie down without leaving the page.
            What this tool does do is download any file that <em>is</em> openly served: a direct <code>.mp4</code>, a subtitle <code>.srt</code>,
            artwork, or your own links. It never redirects — bytes come to the page and are written to your storage.
          </Note>
          <div className="mt-5 flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setErr(""); }}
              placeholder="https://example.com/file.mp4"
              className="min-w-[240px] flex-1 rounded-[6px] border border-white/15 bg-transparent px-4 py-2.5 text-[14px] text-[#E2E8F0] placeholder-white/25 outline-none transition-colors focus:border-[#7DD3D8]"
            />
            <Btn kind="solid" onClick={grabUrl} disabled={busy || !url.trim()}>{busy ? "Downloading…" : "Download"}</Btn>
          </div>
          {prog && (
            <div className="mt-4">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-[#7DD3D8] transition-[width] duration-300" style={{ width: `${prog.pct ?? 8}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-white/45">
                {prog.pct !== null ? `${prog.pct}%` : `${(prog.received / 1e6).toFixed(1)} MB`}{prog.total ? ` of ${(prog.total / 1e6).toFixed(1)} MB` : ""}
              </p>
            </div>
          )}
          <p className="mt-4 text-[12px] text-white/35">
            {caps?.filePicker
              ? "Your browser supports “Save to folder”, so files go exactly where you pick."
              : "Your browser lacks the folder-picker API, so files land in your downloads folder instead."}
          </p>
        </div>
      </section>

      {/* ---- Your data ---- */}
      <section className="mt-14">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/45">Your library</h2>
        <div className="mt-2">
          <Row label="Export watchlist, favourites, playlists & history"
            note={`One JSON file for ${profile?.name || "guest"}. Take it to another device and bring it back in — nothing leaves your machine.`}>
            <Btn kind="solid" onClick={doExport}>Export JSON</Btn>
          </Row>
          <Row label="Import a library file" note="Merges into the current profile without overwriting what's already here.">
            <Btn onClick={() => fileRef.current?.click()}>Choose file…</Btn>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          </Row>
          <Row label="Storage on this device" note={caps?.persists ? "Data persists across reloads." : "Storage is blocked in this frame, so data lasts only this session."}>
            <span className="text-[13px] text-white/40">{caps?.persists ? "Persistent" : "Session only"}</span>
          </Row>
        </div>
      </section>
    </div>
  );
}

const safeFileFrom = (u: string) => {
  try { const p = new URL(u).pathname.split("/").filter(Boolean).pop(); if (p) return decodeURIComponent(p).slice(0, 80); } catch {}
  return "arkaflix-download";
};

const manualHint = (p: string) =>
  p === "iOS" || p === "macOS"
    ? "In Safari, use Share → Add to Home Screen."
    : p === "Android"
    ? "In Chrome, open the ⋮ menu and tap “Install app” / “Add to Home screen”."
    : "In Chrome or Edge, open the address-bar install icon, or the ⋮ → Cast/Save menu.";

const buildApk = `# Android package (.apk / .aab) — built from this exact app
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://YOUR-DOMAIN/manifest.webmanifest
bubblewrap build          # -> app-release-signed.apk + .aab
# You need JDK 17 + an Android signing key; bubblewrap generates one on first run.`;

const buildExe = `# Windows .exe — wraps this app in a native shell
npm i -D electron electron-builder
# add to package.json:  "main":"electron.cjs", "build":{"appId":"app.arkaflix","files":["dist/**"]}
npm run build
npx electron-builder --win nsis   # -> Arkaflix Setup .exe
# Alternative, smaller binary:  npx tauri build`;
