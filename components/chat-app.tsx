"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Copy, Menu, Moon, Pencil, Plus, RefreshCw, Search, Send, Square, Sun, Trash2, X } from "lucide-react";
import { Markdown } from "./markdown";
import { Logo } from "./logo";
import { BRAND } from "@/lib/brand";
import { MAX_TITLE, STORAGE_KEY, filterConversations, parseStored } from "@/lib/conversations";
import type { Conv, Msg } from "@/lib/types";

const EMPTY: Msg[] = [];
const uid = () => crypto.randomUUID();
const SUGGESTIONS = [
  "Explain a complex topic simply: how do vaccines train the immune system?",
  "Help me debug a programming problem in TypeScript",
  "Write and improve a short product announcement",
  "Help me plan a small software project from scratch",
];

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button aria-label={label} title={label} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}>
      {ok ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

export function ChatApp() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const active = convs.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? EMPTY;
  const busy = busyId !== null;
  const shown = filterConversations(convs, query);

  useEffect(() => {
    try { setConvs(parseStored(localStorage.getItem(STORAGE_KEY))); } catch {}
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, 50))); } catch {}
  }, [convs, ready]);
  useEffect(() => { if (atBottom) scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages, atBottom]);
  useEffect(() => {
    const el = area.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (cid: string, fn: (c: Conv) => Conv) => setConvs((cs) => cs.map((c) => (c.id === cid ? fn(c) : c)));

  // userId + draft are passed only for a fresh send: a failure before the server accepts the request
  // rolls the optimistic messages back and keeps the draft. Regenerate/retry keep the user message.
  async function generate(cid: string, history: Msg[], userId?: string, draft?: string) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusyId(cid); setAtBottom(true); setSendError(null);
    const aid = uid();
    patch(cid, (c) => ({ ...c, messages: [...c.messages, { id: aid, role: "assistant", content: "", ts: Date.now(), streaming: true }] }));
    const setA = (fn: (m: Msg) => Msg) => patch(cid, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === aid ? fn(m) : m)) }));
    let accepted = false;
    try {
      const payload = history.filter((m) => m.content.trim()).slice(-40).map(({ role, content }) => ({ role, content }));
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: payload }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Request failed.");
      }
      accepted = true;
      if (draft !== undefined) setInput((cur) => (cur === draft ? "" : cur));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let got = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const t = dec.decode(value, { stream: true });
        if (t) { got = true; setA((m) => ({ ...m, content: m.content + t })); }
      }
      if (!got) setA((m) => ({ ...m, error: "The model returned an empty response." }));
    } catch (e) {
      if (ctrl.signal.aborted) {
        patch(cid, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== aid || m.content) }));
      } else {
        const msg = accepted ? "The response was interrupted."
          : e instanceof TypeError ? "Network error. Check your connection and try again."
          : e instanceof Error ? e.message : "Something went wrong.";
        if (!accepted && userId) {
          setConvs((cs) => cs.flatMap((c) => {
            if (c.id !== cid) return [c];
            const ms = c.messages.filter((m) => m.id !== aid && m.id !== userId);
            return ms.length ? [{ ...c, messages: ms }] : [];
          }));
          setSendError(msg);
        } else setA((m) => ({ ...m, error: msg }));
      }
    } finally {
      setA((m) => ({ ...m, streaming: false }));
      if (abortRef.current === ctrl) { abortRef.current = null; setBusyId(null); }
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const um: Msg = { id: uid(), role: "user", content: t, ts: Date.now() };
    let cid = active?.id;
    let hist: Msg[];
    if (!cid || !active) {
      cid = uid();
      const c: Conv = { id: cid, title: t.slice(0, 48), messages: [um], updated: Date.now() };
      setConvs((cs) => [c, ...cs]); setActiveId(cid); hist = [um];
    } else {
      hist = [...active.messages, um];
      patch(cid, (c) => ({ ...c, messages: [...c.messages, um], updated: Date.now() }));
    }
    void generate(cid, hist, um.id, text);
  }

  function regenerate() {
    if (!active || busy) return;
    const ms = active.messages;
    const base = ms.at(-1)?.role === "assistant" ? ms.slice(0, -1) : ms;
    if (base.at(-1)?.role !== "user") return;
    patch(active.id, (c) => ({ ...c, messages: base }));
    void generate(active.id, base);
  }

  function remove(id: string) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    if (busyId === id) abortRef.current?.abort();
    setConvs((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function commitRename() {
    if (!renamingId) return;
    const t = renameText.trim().slice(0, MAX_TITLE);
    if (t) patch(renamingId, (c) => ({ ...c, title: t }));
    setRenamingId(null);
  }

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("nexa-theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  }

  const lastId = messages.at(-1)?.id;
  const btn = "rounded-lg p-2 text-zinc-600 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-teal-500 dark:text-zinc-300 dark:hover:bg-zinc-800";
  const mini = "mr-0.5 rounded-md p-1.5 text-zinc-500 hover:text-zinc-900 focus-visible:opacity-100 dark:hover:text-zinc-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100";

  return (
    <div className="flex h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside aria-label="Conversations" className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200 bg-zinc-50 pt-[env(safe-area-inset-top)] transition-transform dark:border-zinc-800 dark:bg-zinc-900 md:static ${open ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:hidden" : "md:translate-x-0"}`}>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 font-semibold"><Logo size={28} />{BRAND.name}</div>
          <button className={`${btn} md:hidden`} aria-label="Close sidebar" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="space-y-2 px-3 pb-2">
          <button onClick={() => { setActiveId(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"><Plus size={16} />New chat</button>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500 dark:border-zinc-700">
            <Search size={15} className="shrink-0 text-zinc-500" aria-hidden />
            <span className="sr-only">Search conversations</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm" />
          </label>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {convs.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">No conversations yet.</p>}
          {convs.length > 0 && shown.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">No chats match “{query.trim()}”.</p>}
          {shown.map((c) => (
            <div key={c.id} className={`group flex items-center rounded-lg ${c.id === activeId ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"}`}>
              {renamingId === c.id ? (
                <input autoFocus aria-label="Conversation title" value={renameText} maxLength={MAX_TITLE} onChange={(e) => setRenameText(e.target.value)} onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                  className="m-1 min-w-0 flex-1 rounded-md border border-teal-500 bg-white px-2 py-1.5 text-base outline-none dark:bg-zinc-950 md:text-sm" />
              ) : (
                <>
                  <button onClick={() => { setActiveId(c.id); setOpen(false); }} aria-current={c.id === activeId} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm">{c.title}</button>
                  <button onClick={() => { setRenamingId(c.id); setRenameText(c.title); }} aria-label={`Rename ${c.title}`} title="Rename" className={mini}><Pencil size={14} /></button>
                  <button onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`} title="Delete" className={`${mini} hover:text-red-600`}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </nav>
        <p className="border-t border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800">Chats are saved only in this browser (not synced or encrypted).</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-zinc-200 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] dark:border-zinc-800">
          <button className={btn} aria-label="Toggle sidebar" onClick={() => (window.innerWidth < 768 ? setOpen(true) : setCollapsed((v) => !v))}><Menu size={18} /></button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{active?.title ?? BRAND.name}</h1>
          <span className="hidden rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 sm:inline">Powered by Groq</span>
          <button className={btn} onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); }} className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
              {messages.length === 0 ? (
                <div className="flex min-h-[50dvh] flex-col items-center justify-center text-center">
                  <Logo size={52} />
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{BRAND.tagline}</h2>
                  <p className="mt-2 max-w-md text-sm text-zinc-500">{BRAND.name} is {BRAND.description.charAt(0).toLowerCase() + BRAND.description.slice(1)} Ask questions, debug code, refine writing, or plan your next project.</p>
                  <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} disabled={busy} className="rounded-xl border border-zinc-200 p-3 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900">{s}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <ol className="space-y-6">
                  {messages.map((m) => (
                    <li key={m.id}>
                      {m.role === "user" ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-teal-600 px-4 py-2.5 text-white">{m.content}</div>
                          {m.id === lastId && !busy && <button onClick={regenerate} className="text-xs font-medium text-teal-700 underline dark:text-teal-400">No reply yet. Get a response</button>}
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <span className="mt-0.5"><Logo size={26} /></span>
                          <div className="min-w-0 flex-1">
                            {m.content ? <Markdown text={m.content} /> : !m.error && <span className="inline-flex gap-1 py-2" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="size-1.5 animate-pulse rounded-full bg-zinc-400" style={{ animationDelay: `${i * 150}ms` }} />)}</span>}
                            {m.error && (
                              <div role="alert" className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                <span>{m.error}</span>
                                {m.id === lastId && !busy && <button onClick={regenerate} className="shrink-0 font-medium underline">Retry</button>}
                              </div>
                            )}
                            {m.content && !m.streaming && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                                <CopyBtn text={m.content} label="Copy response" />
                                {m.id === lastId && !busy && <button className="rounded-md p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800" aria-label="Regenerate response" title="Regenerate" onClick={regenerate}><RefreshCw size={15} /></button>}
                                <time dateTime={new Date(m.ts).toISOString()}>{new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <p className="sr-only" role="status">{busyId === activeId && busy ? "Generating response" : ""}</p>
            </div>
          </div>
          {!atBottom && messages.length > 0 && (
            <button onClick={() => { setAtBottom(true); scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }} aria-label="Scroll to latest message" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-zinc-300 bg-white p-2 shadow dark:border-zinc-700 dark:bg-zinc-900"><ArrowDown size={16} /></button>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
          {sendError && (
            <div role="alert" className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <span>{sendError} Your message is still in the box, so you can send it again.</span>
              <button type="button" onClick={() => setSendError(null)} aria-label="Dismiss error" className="shrink-0"><X size={16} /></button>
            </div>
          )}
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 focus-within:ring-2 focus-within:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-900">
            <label htmlFor="composer" className="sr-only">Message</label>
            <textarea id="composer" ref={area} rows={1} value={input} maxLength={8000} placeholder={`Message ${BRAND.name}…`} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
              className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-zinc-400" />
            {busyId !== null && busyId === activeId ? (
              <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop generating" title="Stop" className="grid size-10 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"><Square size={15} fill="currentColor" /></button>
            ) : (
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send message" title="Send" className="grid size-10 place-items-center rounded-xl bg-teal-600 text-white disabled:opacity-40"><Send size={17} /></button>
            )}
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-xs text-zinc-500">AI can make mistakes. Check important information.</p>
        </form>
      </div>
    </div>
  );
}
