# Sam.AI — Your personal AI assistant
*Think smarter. Build faster.* Next.js (App Router) + Groq, streaming chat.

## Setup
```bash
npm install
cp .env.example .env.local     # then set GROQ_API_KEY (https://console.groq.com/keys)
npm run dev                    # http://localhost:3000
npm run lint && npm run typecheck && npm test && npm run build
```
| Variable | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | yes | Server-only. Never use a `NEXT_PUBLIC_` prefix. |
| `GROQ_MODEL` | no | Defaults to `llama-3.3-70b-versatile` (listed as a Groq production model). |

**Vercel:** import the repo, add both variables under Project Settings → Environment Variables, redeploy.

## How conversation storage works (audited from the source)
- **Where:** browser `localStorage`, key `nexa-ai:conversations:v1` (old name kept on purpose so existing browsers keep their chats). Theme: separate key `nexa-theme`. Nothing is stored server-side, and the API key is never stored in the browser.
- **What:** per conversation `id`, `title`, `updated`, and messages (`id`, `role`, `content`, `ts`, optional `error`/`streaming`). The 50 most recent are kept. Data survives refresh and browser restart (until the user clears site data); it is not synced between devices, not encrypted, and readable by anyone with access to the browser profile.
- **Isolation:** each chat is its own record; streamed chunks are written by conversation and message id, so switching chats during a reply does not mix content.
- **Context sent to Groq:** on every request the client sends the current conversation's messages (last 40, only user/assistant text) and the server prepends one system prompt. A new chat starts with no history from other chats.
- **Conversation history is not long-term memory.** The model only "remembers" what is re-sent within the same chat. Nothing carries across chats and no memory feature exists yet. `lib/conversations.ts` isolates parsing/search so a future memory layer can be added.
- **Failure handling:** corrupt JSON, wrong shapes and invalid entries are dropped on load; storage write errors are ignored (chat still works, just not saved). A reply cut off by closing the tab is shown as "interrupted" on reload. Known limit: two tabs use last-write-wins and can overwrite each other.
- **Send flow:** the draft is cleared only after the server accepts the request. If the request fails before that, the optimistic message is rolled back and the draft stays in the box. If a reply fails or is empty after acceptance, Retry regenerates from the existing user message (no duplicates). Stop aborts the request.
- **Rename/search:** rename via the pencil on each chat (Enter/blur saves, Esc cancels, max 80 chars); titles are set only at creation, so a rename is never overwritten. Search filters titles and message text in memory; nothing leaves the browser.

## Security notes
Key read only in `app/api/chat/route.ts`; `.env*.local` is git-ignored; `.env.example` has placeholders. Request body ≤300 KB, ≤40 messages, ≤16,000 chars each, roles limited to user/assistant. Markdown does not render raw HTML, and react-markdown's default URL filter blocks `javascript:` links; links open with `noopener noreferrer nofollow`. Provider errors are mapped to generic messages.
**Rate limiting is not implemented.** Add it before public launch, e.g. Upstash Redis + `@upstash/ratelimit` (free tier available; requires `UPSTASH_REDIS_REST_URL/TOKEN`), keyed by IP in the route handler or middleware.

## Known limitations
No syntax highlighting (code blocks are plain, with copy). No accounts or cross-device sync. Real Groq calls and browser/mobile UI were not exercised in the build environment.
