"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { campaignIdFromPath, refreshRepository } from "@/lib/repo-refresh";

const HIDDEN_PREFIXES = ["/login", "/register", "/change-password"];

export default function RepoRefreshButton() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const campaignId = useMemo(() => campaignIdFromPath(pathname), [pathname]);

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  if (!campaignId) return null;

  async function refresh() {
    if (!campaignId || busy) return;
    setBusy(true);
    setMessage("Refreshing repo and indexes...");
    setFailed(false);
    try {
      await refreshRepository(campaignId);
      router.refresh();
      setMessage("Repo refreshed.");
      window.setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="repo-refresh-fab">
      {message && <span className={failed ? "repo-refresh-status error" : "repo-refresh-status"}>{message}</span>}
      <button type="button" className="repo-refresh-btn" onClick={refresh} disabled={busy} title="Reload repo content, rebuild indexes, and update the current view" aria-busy={busy}>
        <RefreshCw size={16} aria-hidden="true" />
        {busy ? "Refreshing..." : "Refresh repo"}
      </button>
    </div>
  );
}
