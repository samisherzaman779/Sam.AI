import Groq from "groq-sdk";
import { BRAND } from "../../../lib/brand.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
const MAX_BODY = 300_000;
const MAX_MESSAGES = 40;
const MAX_CHARS = 16_000;
const SYSTEM = `You are ${BRAND.name}, a helpful, accurate assistant. Answer clearly and use Markdown when it helps.`;

type ChatMessage = { role: "user" | "assistant"; content: string };
const fail = (error: string, status: number) => Response.json({ error }, { status });

function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null) return null;
  const list = (body as { messages?: unknown }).messages;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_MESSAGES) return null;
  const out: ChatMessage[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > MAX_CHARS) return null;
    out.push({ role, content: text });
  }
  return out[out.length - 1].role === "user" ? out : null;
}

function providerError(e: unknown) {
  if (e instanceof Groq.APIError) {
    console.error("Groq API error", e.status);
    if (e.status === 401) return fail("The server's Groq credentials were rejected.", 502);
    if (e.status === 404) return fail("The configured model is unavailable.", 502);
    if (e.status === 429) return fail("Rate limit reached. Please wait a moment and try again.", 429);
    return fail("The AI provider had a problem. Please try again.", 502);
  }
  console.error("Chat route error");
  return fail("Could not reach the AI provider.", 502);
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fail("The server is missing GROQ_API_KEY. Add it to .env.local and restart.", 500);
  if (!/^[\w./:-]{1,100}$/.test(MODEL)) return fail("The server model configuration is invalid.", 500);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail("Request too large.", 413);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fail("Invalid JSON.", 400); }
  const messages = parseMessages(parsed);
  if (!messages) return fail("Invalid messages: send 1-40 non-empty user/assistant messages ending with a user message.", 400);

  try {
    const stream = await new Groq({ apiKey, maxRetries: 1 }).chat.completions.create(
      { model: MODEL, stream: true, temperature: 0.7, max_tokens: 2048, messages: [{ role: "system", content: SYSTEM }, ...messages] },
      { signal: req.signal },
    );
    const enc = new TextEncoder();
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const t = chunk.choices[0]?.delta?.content;
            if (t) controller.enqueue(enc.encode(t));
          }
          controller.close();
        } catch (e) {
          if (req.signal.aborted) { try { controller.close(); } catch {} } else controller.error(e);
        }
      },
      cancel() { stream.controller.abort(); },
    });
    return new Response(out, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
    });
  } catch (e) {
    return providerError(e);
  }
}
