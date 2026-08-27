import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s["mode"] === "signup" ? ("signup" as const) : ("login" as const),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — GenNexus Communications Workspace" },
      {
        name: "description",
        content: "Sign in or create an account to draft source-grounded official communications.",
      },
      { property: "og:title", content: "Sign in — GenNexus" },
      { property: "og:description", content: "Access the GenNexus communications workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/workspace" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/workspace`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        const { data: session } = await supabase.auth.getSession();
        if (session.session) navigate({ to: "/workspace" });
        else setInfo("Account created. Check your email to confirm, then log in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/workspace" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again or use email.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/workspace" });
  }

  return (
    <div className="gn-grid-bg flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md border border-border bg-card p-8">
        <div className="flex items-center gap-3">
          <span className="h-5 w-1.5 bg-primary" />
          <span className="font-serif text-lg font-bold">GenNexus</span>
        </div>
        <h1 className="mt-6 font-serif text-2xl font-bold">
          {isSignup ? "Create your account" : "Log in to the console"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access is per-account. Your source material and drafts are visible only to you.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {isSignup && (
            <Field label="Display name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="A. Officer"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@example.gov"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="Minimum 8 characters"
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-accent">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-primary py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Working…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <button
          onClick={google}
          className="w-full rounded-sm border border-border py-3 text-sm font-semibold hover:border-primary hover:text-primary"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? "Already registered?" : "Need an account?"}{" "}
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="font-semibold text-primary hover:underline"
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
