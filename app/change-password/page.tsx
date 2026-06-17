"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword
      })
    });
    if (!res.ok) {
      setError((await res.json()).error || "Could not change password.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">CampaignRepo</p>
          <h1>Change password</h1>
          <p className="muted">The default admin password must be changed before using the app.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Current password<input name="currentPassword" type="password" required /></label>
          <label>New password<input name="newPassword" type="password" minLength={8} required /></label>
          <label>Confirm new password<input name="confirmPassword" type="password" minLength={8} required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Change password</button>
        </form>
      </section>
    </main>
  );
}
