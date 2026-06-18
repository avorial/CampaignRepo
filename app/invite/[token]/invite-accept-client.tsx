"use client";

import { useState } from "react";

export default function InviteAcceptClient({ token }: { token: string }) {
  const [message, setMessage] = useState("");

  async function acceptInvite() {
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      window.location.href = `/campaigns/${data.campaignId}`;
    } else {
      setMessage(data.error || "Could not accept invite.");
    }
  }

  return (
    <div className="stack">
      <button type="button" onClick={acceptInvite}>Accept invite</button>
      {message && <p className="error">{message}</p>}
    </div>
  );
}
