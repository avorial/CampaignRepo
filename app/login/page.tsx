"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import Logo from "@/app/components/logo";

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
