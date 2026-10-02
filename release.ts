/**
 * Release configuration — the single place your repository is named.
 *
 * GitHub username: kay425970-prog
 *
 * Every download URL below is derived from REPO, so if you name the repository
 * something other than "arkaflix", change that one string and everything
 * follows. The Downloads page HEAD-requests these addresses and only enables
 * its buttons once the files really exist — so until you push your first tag,
 * they honestly say "not published yet" instead of offering dead links.
 */
export const GITHUB_USER = "kay425970-prog";
export const REPO = "arkaflix";

export const REPO_URL = `https://github.com/${GITHUB_USER}/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
/** "latest/download/…" always serves the newest release — no need to bump versions here. */
export const LATEST = `${RELEASES_URL}/latest/download`;

export const RELEASE = {
  version: "1.0.0",
  apkUrl: `${LATEST}/arkaflix.apk`,
  exeUrl: `${LATEST}/Arkaflix-Setup.exe`,
  notesUrl: RELEASES_URL,
  repoUrl: REPO_URL,
};

export type FileStatus = "unknown" | "checking" | "ready" | "missing";

/** HEAD-requests a release file to see whether it has actually been published. */
export async function checkFile(url: string): Promise<FileStatus> {
  if (!url) return "unknown";
  try {
    const res = await fetch(url, { method: "HEAD", mode: "cors" });
    if (res.ok) return "ready";
    // Some hosts reject HEAD — retry with a ranged GET.
    const get = await fetch(url, { headers: { Range: "bytes=0-0" } });
    return get.ok || get.status === 206 ? "ready" : "missing";
  } catch {
    // CORS-blocked or offline. The link may still be valid, so don't call it missing.
    return "unknown";
  }
}

export const bytes = (n: number) =>
  n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${(n / 1e3).toFixed(0)} KB` : `${n} B`;
