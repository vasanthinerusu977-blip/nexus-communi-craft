import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquare, Send, X } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { assistantChat } from "@/lib/gen.functions";

type Msg = { role: "user" | "assistant"; content: string };

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "I'm the GenNexus assistant. Ask me how the workspace works, what each deliverable contains, or what the tool can and cannot do.",
    },
  ]);

  const { data: knowledge } = useQuery({
    queryKey: ["knowledge-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("knowledge_entries")
        .select("topic,question,answer")
        .eq("published", true);
      return (data ?? [])
        .map((k) => `[${k.topic}] Q: ${k.question}\nA: ${k.answer}`)
        .join("\n\n");
    },
  });

  const chat = useServerFn(assistantChat);
  const send = useMutation({
    mutationFn: async (history: Msg[]) =>
      chat({ data: { messages: history, knowledge: knowledge ?? "" } }),
    onSuccess: (res) => setMessages((m) => [...m, { role: "assistant", content: res.reply }]),
    onError: (e: Error) =>
      setMessages((m) => [
        ...m,
        { role: "assistant", content: e.message || "Something went wrong. Please try again." },
      ]),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || send.isPending) return;
    const next: Msg[] = [...messages.filter((_, i) => i > 0 || true), { role: "user", content: text }];
    setMessages(next);
    setInput("");
    send.mutate(next.slice(-10));
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:brightness-110"
      >
        <MessageSquare className="h-4 w-4" /> Assistant
      </button>
    );

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[520px] w-[min(94vw,380px)] flex-col border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="mono text-xs uppercase tracking-[0.18em] text-primary">
          GenNexus Assistant
        </span>
        <button onClick={() => setOpen(false)} aria-label="Close assistant">
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-sm bg-secondary px-3 py-2"
                : "max-w-[92%] whitespace-pre-wrap rounded-sm border-l-2 border-primary bg-background px-3 py-2 leading-relaxed text-muted-foreground"
            }
          >
            {m.content}
          </div>
        ))}
        {send.isPending && <p className="mono text-xs text-muted-foreground">Thinking…</p>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about GenNexus…"
          className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={send.isPending}
          className="rounded-sm bg-primary px-3 text-primary-foreground disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
