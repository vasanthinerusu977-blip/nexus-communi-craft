import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Knowledge Base — GenNexus" },
      {
        name: "description",
        content:
          "Configure the organisational facts the GenNexus assistant is allowed to state. Nothing is invented.",
      },
      { property: "og:title", content: "Knowledge Base — GenNexus" },
      {
        property: "og:description",
        content: "Admin-editable about/knowledge entries used by the assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Entry = {
  id: string;
  topic: string;
  question: string;
  answer: string;
  published: boolean;
};

function Admin() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ topic: "About", question: "", answer: "" });
  const [error, setError] = useState("");

  const isAdmin = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const entries = useQuery({
    queryKey: ["knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_entries")
        .select("id,topic,question,answer,published")
        .order("topic");
      if (error) throw error;
      return data as Entry[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("knowledge_entries").insert({
        topic: form.topic.trim() || "About",
        question: form.question.trim(),
        answer: form.answer.trim(),
        published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ topic: "About", question: "", answer: "" });
      setError("");
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      qc.invalidateQueries({ queryKey: ["knowledge-public"] });
    },
    onError: (e: Error) =>
      setError(
        e.message.includes("policy")
          ? "Only administrators can edit the knowledge base."
          : e.message,
      ),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("knowledge_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      qc.invalidateQueries({ queryKey: ["knowledge-public"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <p className="mono text-[11px] uppercase tracking-[0.2em] text-primary">Administration</p>
      <h1 className="mt-1 font-serif text-2xl font-bold">Knowledge base & about</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The assistant answers organisational questions only from entries here. Anything not
        configured is reported as "not configured" — founders, ownership, affiliations and other
        facts are never invented.
      </p>

      {isAdmin.data === false && (
        <p className="mt-4 border-l-2 border-destructive bg-card p-3 text-sm text-muted-foreground">
          You are signed in as a standard user. You can read published entries; only administrators
          can add or delete them.
        </p>
      )}

      <section className="mt-6 border border-border bg-card p-5">
        <h2 className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-primary">
          Add entry
        </h2>
        <div className="grid gap-3">
          <input
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Topic (e.g. About, Usage, Policy)"
            className={inputCls}
          />
          <input
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            placeholder="Question users may ask"
            className={inputCls}
          />
          <textarea
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            rows={4}
            placeholder="The verified answer the assistant may state"
            className={inputCls}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending || !form.question.trim() || !form.answer.trim()}
            className="justify-self-start rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {add.isPending ? "Saving…" : "Save entry"}
          </button>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        {entries.data?.length === 0 && (
          <p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
            No knowledge configured yet. The assistant will say organisational information has not
            been configured.
          </p>
        )}
        {entries.data?.map((e) => (
          <div key={e.id} className="border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="mono text-[11px] uppercase tracking-wide text-primary">
                  {e.topic}
                </span>
                <p className="mt-1 font-semibold">{e.question}</p>
                <p className="mt-1 text-sm text-muted-foreground">{e.answer}</p>
              </div>
              <button
                onClick={() => remove.mutate(e.id)}
                className="rounded-sm border border-border px-2.5 py-1 text-xs hover:border-destructive hover:text-destructive"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

const inputCls =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
