"use client";

import { useEffect, useRef } from "react";
import { subscribeToRepoRefresh } from "@/lib/repo-refresh";

export function useRepoRefresh(campaignId: number | null, reload: () => unknown | Promise<unknown>) {
  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; });
  useEffect(() => {
    if (campaignId === null) return;
    return subscribeToRepoRefresh(campaignId, () => reloadRef.current());
  }, [campaignId]);
}
