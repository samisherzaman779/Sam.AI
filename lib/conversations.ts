import type { Conv, Msg } from "./types.ts";

export const STORAGE_KEY = "nexa-ai:conversations:v1"; // legacy name kept on purpose so existing browsers keep their chats
export const MAX_TITLE = 80;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function isMsg(m: unknown): m is Msg {
  return isRecord(m) && typeof m.id === "string" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && typeof m.ts === "number";
}

/** Defensively parse stored data: corrupt JSON, wrong shapes and bad entries are dropped, never thrown. */
export function parseStored(raw: string | null): Conv[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const out: Conv[] = [];
  for (const c of data) {
    if (!isRecord(c) || typeof c.id !== "string" || !Array.isArray(c.messages)) continue;
    // A message still flagged "streaming" was cut off by a reload/close: surface it as interrupted.
    const messages = c.messages.filter(isMsg).map((m) => (m.streaming ? { ...m, streaming: false, error: m.error ?? "This response was interrupted." } : m));
    const title = typeof c.title === "string" && c.title.trim() ? c.title.trim() : "New chat";
    out.push({ id: c.id, title: title.slice(0, MAX_TITLE), updated: Number(c.updated) || 0, messages });
  }
  return out;
}

/** Local, in-memory search over titles and message text. */
export function filterConversations(convs: Conv[], query: string): Conv[] {
  const q = query.trim().toLowerCase();
  if (!q) return convs;
  return convs.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
}
