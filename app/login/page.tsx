"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    if (!res.ok) {
      setError((await res.json()).error || "Login failed.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">CampaignRepo</p>
          <h1>Sign in</h1>
          <p className="muted">Manage GitHub-backed RPG campaign wikis from one private dashboard.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Sign in</button>
        </form>
        <p className="muted">No account yet? <Link href="/register">Create one</Link>.</p>
      </section>
    </main>
  );
}
