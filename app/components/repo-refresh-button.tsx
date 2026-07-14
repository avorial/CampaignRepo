"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const HIDDEN_PREFIXES = ["/login", "/register", "/change-password"];

function campaignIdFromPath(pathname: string) {
  const match = pathname.match(/^\/campaigns\/(\d+)(?:\/|$)/);
  return match?.[1] || null;
}

export default function RepoRefreshButton() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const campaignId = useMemo(() => campaignIdFromPath(pathname), [pathname]);

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  if (!campaignId) return null;

  async function refresh() {
    if (!campaignId || busy) return;
    setBusy(true);
    setMessage("Refreshing repo...");
    try {
      const pages = await fetch(`/api/campaigns/${campaignId}/pages?refresh=wait`, { cache: "no-store" });
      if (!pages.ok) throw new Error("Page refresh failed.");
      await fetch(`/api/campaigns/${campaignId}/graph`, { cache: "no-store" }).catch(() => undefined);
      window.dispatchEvent(new CustomEvent("campaignrepo:repo-refreshed"));
      router.refresh();
      setMessage("Repo refreshed.");
      window.setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="repo-refresh-fab">
      {message && <span className={message.includes("failed") ? "repo-refresh-status error" : "repo-refresh-status"}>{message}</span>}
      <button type="button" className="repo-refresh-btn" onClick={refresh} disabled={busy} title="Force a full repo refresh from storage">
        {busy ? "Refreshing..." : "Refresh repo"}
      </button>
    </div>
  );
}
