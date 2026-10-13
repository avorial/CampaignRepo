export const repoRefreshEvent = "campaignrepo:repo-refreshed";

type RefreshDetail = { campaignId: number; tasks: Promise<unknown>[] };

export function campaignIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/campaigns\/(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

export function subscribeToRepoRefresh(
  campaignId: number,
  reload: () => unknown | Promise<unknown>,
  target: EventTarget = window
) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<RefreshDetail>).detail;
    if (detail?.campaignId !== campaignId) return;
    detail.tasks.push(Promise.resolve().then(reload));
  };
  target.addEventListener(repoRefreshEvent, handler);
  return () => target.removeEventListener(repoRefreshEvent, handler);
}

export async function notifyRepoRefreshed(campaignId: number, target: EventTarget = window) {
  const detail: RefreshDetail = { campaignId, tasks: [] };
  target.dispatchEvent(new CustomEvent(repoRefreshEvent, { detail }));
  const results = await Promise.allSettled(detail.tasks);
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Repo rebuilt, but a view could not reload. Try refreshing again.");
  }
}

export async function refreshRepository(
  campaignId: number,
  request: typeof fetch = fetch,
  target: EventTarget = window
) {
  const pages = await request(`/api/campaigns/${campaignId}/pages?refresh=wait`, { cache: "no-store" });
  const pageData = await pages.json();
  // The page endpoint can return a cached fallback with HTTP 200 after a failed refresh.
  if (!pages.ok || pageData.error || pageData.cache?.refreshError) {
    throw new Error(pageData.error || pageData.cache?.refreshError || "Page refresh failed.");
  }
  const index = await request(`/api/campaigns/${campaignId}/search-index`, { method: "POST", cache: "no-store" });
  const indexData = await index.json();
  if (!index.ok || indexData.error) throw new Error(indexData.error || "Index rebuild failed.");
  await notifyRepoRefreshed(campaignId, target);
}
