import { useEffect, useRef, useState } from "react";
import Peer, { DataConnection } from "peerjs";

export interface Member { id: string; name: string; avatar: string; color: string; host?: boolean }
export interface Msg { kind: "chat" | "system" | "react" | "play" | "hello" | "members" | "bye"; from?: Member; text?: string; play?: any; members?: Member[]; at: number; id?: string }

const PREFIX = "cinestream-party-";
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

export function useParty(me: Member, onPlay: (p: any) => void, onReact: (emoji: string) => void) {
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [room, setRoom] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState("");
  const peer = useRef<Peer | null>(null);
  const conns = useRef<DataConnection[]>([]);
  const lastPlay = useRef<any>(null);
  const memRef = useRef<Member[]>([]);
  const cb = useRef({ onPlay, onReact });
  cb.current = { onPlay, onReact };

  const push = (m: Msg) => setMessages((p) => [...p.slice(-150), { ...m, id: Math.random().toString(36) }]);
  const setMem = (m: Member[]) => { memRef.current = m; setMembers(m); };

  const handle = (m: Msg, src?: DataConnection) => {
    if (m.kind === "members") return setMem(m.members || []);
    if (m.kind === "play") { lastPlay.current = m.play; cb.current.onPlay(m.play); }
    if (m.kind === "react") cb.current.onReact(m.text || "🔥");
    if (m.kind === "hello" && src) {
      (src as any).member = m.from;
      setMem([...memRef.current.filter((x) => x.id !== m.from!.id), m.from!]);
      broadcast({ kind: "members", members: memRef.current, at: Date.now() });
      broadcast({ kind: "system", text: `${m.from!.name} joined the party`, at: Date.now() });
      push({ kind: "system", text: `${m.from!.name} joined the party`, at: Date.now() });
      if (lastPlay.current) src.send({ kind: "play", play: lastPlay.current, from: me, at: Date.now() });
      return;
    }
    push(m);
    if (src) conns.current.filter((c) => c !== src).forEach((c) => c.open && c.send(m)); // host relays
  };

  const broadcast = (m: Msg) => conns.current.forEach((c) => c.open && c.send(m));

  const wire = (c: DataConnection) => {
    c.on("data", (d: any) => handle(d, isHostRef.current ? c : undefined));
    c.on("close", () => {
      conns.current = conns.current.filter((x) => x !== c);
      if (isHostRef.current) {
        const who = (c as any).member as Member | undefined;
        if (who) {
          setMem(memRef.current.filter((x) => x.id !== who.id));
          broadcast({ kind: "members", members: memRef.current, at: Date.now() });
          push({ kind: "system", text: `${who.name} left`, at: Date.now() });
        }
      } else { push({ kind: "system", text: "Host ended the party", at: Date.now() }); setStatus("error"); setError("Disconnected from host"); }
    });
  };
  const isHostRef = useRef(false);

  const create = () => {
    leave(); setStatus("connecting"); setError("");
    const r = code(); isHostRef.current = true; setIsHost(true);
    const p = new Peer(PREFIX + r); peer.current = p;
    p.on("open", () => { setRoom(r); setStatus("live"); setMem([{ ...me, host: true }]); push({ kind: "system", text: `Party ${r} created — share the code!`, at: Date.now() }); });
    p.on("connection", (c) => { conns.current.push(c); wire(c); });
    p.on("error", (e) => { setError(String((e as any).type || e)); setStatus("error"); });
  };

  const join = (r: string) => {
    leave(); setStatus("connecting"); setError("");
    r = r.trim().toUpperCase(); isHostRef.current = false; setIsHost(false);
    const p = new Peer(); peer.current = p;
    p.on("open", () => {
      const c = p.connect(PREFIX + r, { reliable: true });
      conns.current = [c]; wire(c);
      c.on("open", () => { setRoom(r); setStatus("live"); c.send({ kind: "hello", from: me, at: Date.now() }); push({ kind: "system", text: `Joined party ${r}`, at: Date.now() }); });
    });
    p.on("error", (e: any) => { setError(e.type === "peer-unavailable" ? "Party not found. Check the code." : String(e.type || e)); setStatus("error"); });
  };

  const leave = () => {
    conns.current.forEach((c) => c.close()); conns.current = [];
    peer.current?.destroy(); peer.current = null;
    setStatus("idle"); setRoom(""); setMem([]); setMessages([]); lastPlay.current = null;
  };

  const send = (kind: Msg["kind"], extra: Partial<Msg> = {}) => {
    const m: Msg = { kind, from: me, at: Date.now(), ...extra };
    if (kind === "play") lastPlay.current = m.play;
    broadcast(m);
    if (kind === "chat" || kind === "play") push(m);
  };

  useEffect(() => () => { peer.current?.destroy(); }, []);
  return { status, room, isHost, members, messages, error, create, join, leave, send };
}
export type Party = ReturnType<typeof useParty>;
