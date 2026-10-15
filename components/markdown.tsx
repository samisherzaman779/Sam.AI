"use client";
import { useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function Pre({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(ref.current?.innerText ?? ""); setOk(true); setTimeout(() => setOk(false), 1500); } catch {}
  };
  return (
    <div className="relative my-3">
      <button onClick={copy} aria-label="Copy code" title="Copy code" className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-teal-500">
        {ok ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre ref={ref} className="overflow-x-auto rounded-xl bg-zinc-950 p-4 pr-12 text-sm text-zinc-100">{children}</pre>
    </div>
  );
}

const components: Components = {
  pre: ({ children }) => <Pre>{children}</Pre>,
  code: ({ className, children }) => (
    <code className={className ?? "rounded bg-zinc-200/70 px-1.5 py-0.5 text-[0.9em] dark:bg-zinc-800"}>{children}</code>
  ),
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>,
  table: ({ children }) => <div className="my-3 overflow-x-auto"><table>{children}</table></div>,
};

export function Markdown({ text }: { text: string }) {
  return <div className="md break-words"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown></div>;
}
