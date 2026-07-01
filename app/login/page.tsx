"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import Logo from "@/app/components/logo";

const kineticRows = [
  ["CAMPAIGNREPO", "LORE", "CANON"],
  ["MAPS", "NPCS", "SESSIONS"],
  ["QUESTS", "FACTIONS", "TIMELINE"],
  ["ARTIFACTS", "REALMS", "SECRETS"],
  ["ENCOUNTERS", "CHRONICLE", "HEROES"],
  ["CAMPAIGNREPO", "MAPS", "CANON"]
];

function KineticAuthBackground() {
  return (
    <div className="auth-kinetic" aria-hidden="true">
      <div className="auth-kinetic-stack">
        {kineticRows.map((row, rowIndex) => (
          <div className={`auth-kinetic-row ${rowIndex % 2 ? "auth-kinetic-reverse" : ""}`} key={row.join("-")}>
            {[...row, ...row].map((word, wordIndex) => (
              <span className={wordIndex % 2 ? "auth-kinetic-outline" : "auth-kinetic-fill"} key={`${word}-${wordIndex}`}>
                {word}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: form.get("login"), password: form.get("password") })
    });
    if (!res.ok) {
      setError((await res.json()).error || "Login failed.");
      return;
    }
    const data = await res.json();
    router.push(data.mustChangePassword ? "/change-password" : safeNext || "/dashboard");
  }

  return (
    <main className="auth-shell">
      <KineticAuthBackground />
      <section className="auth-panel">
        <div>
          <Logo href={null} size={40} />
          <h1>Sign in</h1>
          <p className="muted">Manage GitHub-backed RPG campaign wikis from one private dashboard.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Email or username<input name="login" required /></label>
          <label>Password<input name="password" type="password" required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Sign in</button>
        </form>
        <p className="muted">No account yet? <Link href="/register">Create one</Link>.</p>
        <p className="muted">New here? <Link href="/getting-started">Read the getting-started guide</Link>.</p>
        <p className="muted">Just browsing? <Link href="/site">Explore public worlds</Link> — no account needed.</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
