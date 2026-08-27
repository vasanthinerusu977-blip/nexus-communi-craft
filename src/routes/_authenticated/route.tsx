import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Assistant } from "@/components/Assistant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      if (!session) navigate({ to: "/auth", search: { mode: "login" } });
      else setEmail(session.user.email ?? "");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) navigate({ to: "/auth", search: { mode: "login" } });
      else {
        setEmail(data.session.user.email ?? "");
        setReady(true);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready)
    return (
      <div className="mono flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Verifying session…
      </div>
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-5 py-3 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <span className="h-5 w-1.5 bg-primary" />
          <Link to="/" className="font-serif text-base font-bold">
            GenNexus
          </Link>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          {[
            { to: "/workspace", label: "Workspace" },
            { to: "/history", label: "History" },
            { to: "/admin", label: "Knowledge Base" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-sm px-3 py-1.5 text-muted-foreground hover:text-foreground [&.active]:border-b-2 [&.active]:border-primary [&.active]:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <span className="mono ml-2 hidden text-[11px] text-muted-foreground lg:inline">{email}</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="ml-2 rounded-sm border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
          >
            Log out
          </button>
        </nav>
      </header>
      <div className="border-b border-border bg-card px-5 py-2 text-center text-[11px] text-muted-foreground md:px-8">
        All generated content is an <strong className="text-primary">unreviewed draft</strong> and
        requires authorized review before distribution. GenNexus is not affiliated with NTRO or any
        government agency.
      </div>
      <Outlet />
      <Assistant />
    </div>
  );
}
