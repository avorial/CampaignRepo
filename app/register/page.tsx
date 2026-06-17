"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), name: form.get("name"), password: form.get("password") })
    });
    if (!res.ok) {
      setError((await res.json()).error || "Registration failed.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">CampaignRepo</p>
          <h1>Create account</h1>
          <p className="muted">App login is separate from GitHub. Connect GitHub after signing in.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Name<input name="name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Create account</button>
        </form>
        <p className="muted">Already registered? <Link href="/login">Sign in</Link>.</p>
      </section>
    </main>
  );
}
