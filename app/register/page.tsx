"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";
  const [error, setError] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/invites/${inviteToken}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.invite) setInviteLabel(`${data.invite.campaignName} as ${data.invite.role}`);
      });
  }, [inviteToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), name: form.get("name"), password: form.get("password"), inviteToken: inviteToken || undefined })
    });
    if (!res.ok) {
      setError((await res.json()).error || "Registration failed.");
      return;
    }
    const data = await res.json();
    router.push(data.campaignId ? `/campaigns/${data.campaignId}` : "/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">CampaignRepo</p>
          <h1>Create account</h1>
          <p className="muted">{inviteLabel ? `Create an account to join ${inviteLabel}.` : "App login is separate from GitHub. Connect GitHub after signing in."}</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Name<input name="name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Create account</button>
        </form>
        <p className="muted">Already registered? <Link href={inviteToken ? `/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}` : "/login"}>Sign in</Link>.</p>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
