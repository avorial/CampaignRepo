// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { campaignIdFromPath, notifyRepoRefreshed, refreshRepository, subscribeToRepoRefresh } from "@/lib/repo-refresh";
import { useRepoRefresh } from "@/app/components/use-repo-refresh";
import RepoRefreshButton from "@/app/components/repo-refresh-button";
import CampaignClient from "@/app/campaigns/[id]/workspace-client";
import SessionsClient from "@/app/campaigns/[id]/sessions/sessions-client";
import SessionEditor from "@/app/campaigns/[id]/sessions/[slug]/session-editor";
import type { Campaign } from "@/lib/types";

const navigation = vi.hoisted(() => ({ pathname: "/campaigns/91", refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ refresh: navigation.refresh })
}));

let root: Root;
let container: HTMLDivElement;
const campaign = { id: 91, name: "New Campaign", role: "owner", gameType: "Traveller" } as Campaign;
const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));

beforeEach(() => {
  vi.clearAllMocks();
  navigation.pathname = "/campaigns/91";
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("repository refresh", () => {
  it("finds the refresh target for new campaigns and every nested campaign view", () => {
    for (const path of ["/campaigns/91", "/campaigns/91/sessions", "/campaigns/91/pages/New-Page", "/campaigns/92/health"]) {
      expect(campaignIdFromPath(path)).toBe(path.includes("/92") ? 92 : 91);
    }
    expect(campaignIdFromPath("/dashboard")).toBeNull();
    expect(campaignIdFromPath("/campaigns/91wrong")).toBeNull();
  });

  it("rebuilds before notifying views, waits for their reloads, and stays campaign-scoped", async () => {
    const target = new EventTarget();
    const order: string[] = [];
    let release!: () => void;
    const done = new Promise<void>((resolve) => { release = resolve; });
    const unsubscribe = subscribeToRepoRefresh(91, async () => { order.push("view"); await done; }, target);
    const other = vi.fn();
    const unsubscribeOther = subscribeToRepoRefresh(92, other, target);
    const request = vi.fn(async (url: RequestInfo | URL) => {
      order.push(String(url).includes("search-index") ? "index" : "source");
      return new Response(JSON.stringify({ ok: true }));
    });
    let finished = false;
    const refreshing = refreshRepository(91, request as typeof fetch, target).then(() => { finished = true; });
    await vi.waitFor(() => expect(order).toEqual(["source", "index", "view"]));
    expect(finished).toBe(false);
    expect(other).not.toHaveBeenCalled();
    release();
    await refreshing;
    expect(finished).toBe(true);
    unsubscribe();
    unsubscribeOther();
    await notifyRepoRefreshed(91, target);
    expect(order).toHaveLength(3);
  });

  it.each([
    { error: "Storage unavailable" },
    { cache: { refreshError: "Repository refresh failed" } }
  ])("rejects HTTP 200 cached fallbacks without rebuilding or notifying", async (fallback) => {
    const target = new EventTarget();
    const reload = vi.fn();
    const unsubscribe = subscribeToRepoRefresh(91, reload, target);
    const request = vi.fn(() => json(fallback));
    await expect(refreshRepository(91, request as typeof fetch, target)).rejects.toThrow();
    expect(request).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does not announce completion when the index rebuild fails", async () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const unsubscribe = subscribeToRepoRefresh(91, reload, target);
    const request = vi.fn().mockImplementationOnce(() => json({ pages: [] }))
      .mockImplementationOnce(() => json({ error: "Cannot rebuild" }, 500));
    await expect(refreshRepository(91, request, target)).rejects.toThrow("Cannot rebuild");
    expect(reload).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("lets other views finish even when one reload fails", async () => {
    const target = new EventTarget();
    const unsubscribe = subscribeToRepoRefresh(91, () => { throw new Error("broken view"); }, target);
    const reload = vi.fn();
    const unsubscribeOther = subscribeToRepoRefresh(91, reload, target);
    await expect(notifyRepoRefreshed(91, target)).rejects.toThrow("a view could not reload");
    expect(reload).toHaveBeenCalledOnce();
    unsubscribe();
    unsubscribeOther();
  });

  it("uses the latest view callback without retaining callbacks after unmount", async () => {
    const reload = vi.fn();
    function View({ version }: { version: number }) {
      useRepoRefresh(91, () => reload(version));
      return null;
    }
    await act(async () => root.render(createElement(View, { version: 1 })));
    await act(async () => root.render(createElement(View, { version: 2 })));
    await act(async () => notifyRepoRefreshed(92));
    expect(reload).not.toHaveBeenCalled();
    await act(async () => notifyRepoRefreshed(91));
    expect(reload).toHaveBeenCalledWith(2);
    await act(async () => root.render(null));
    await notifyRepoRefreshed(91);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("updates the actual workspace page list through the shared button on a new campaign", async () => {
    let rebuilt = false;
    const page = (name: string) => ({
      slug: name.replaceAll(" ", "-"),
      frontmatter: { name, category: "game", approvalStatus: "approved", visibility: "players", tags: [], aliases: [] },
      content: "", outgoingLinks: [], backlinks: []
    });
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/search-index")) { rebuilt = true; return json({ ok: true, count: 2 }); }
      if (url.includes("/pages")) return json({ pages: rebuilt ? [page("Session One"), page("Session Two")] : [page("Session One")] });
      return json({});
    }));
    await act(async () => root.render(createElement("div", null,
      createElement(CampaignClient, { campaign, categories: [{ id: "game", label: "Games" }] }),
      createElement(RepoRefreshButton)
    )));
    expect(container.textContent).toContain("Session One");
    expect(container.textContent).not.toContain("Session Two");
    const button = container.querySelector<HTMLButtonElement>(".repo-refresh-btn")!;
    expect(button.textContent).toContain("Refresh repo");
    await act(async () => button.click());
    await vi.waitFor(() => expect(container.textContent).toContain("Session Two"));
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });

  it("reloads the actual session list when a repository refresh completes", async () => {
    let sessions = [{ slug: "one", frontmatter: { title: "Session One", attendees: [], agenda: [], threads: [], status: "played" } }];
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.endsWith("/sessions") ? { sessions } : {})));
    await act(async () => root.render(createElement(SessionsClient, { campaign })));
    expect(container.textContent).toContain("Session One");
    sessions = [...sessions, { slug: "two", frontmatter: { title: "Session Two", attendees: [], agenda: [], threads: [], status: "played" } }];
    await act(async () => notifyRepoRefreshed(91));
    expect(container.textContent).toContain("Session Two");
  });

  it("refreshes saved sessions while preserving an unsaved session draft", async () => {
    let title = "Original title";
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.endsWith("/sessions/one")
      ? { session: { frontmatter: { title, status: "played" }, notes: "Saved notes" } }
      : { pages: [] })));
    await act(async () => root.render(createElement(SessionEditor, { campaign, slug: "one" })));
    const titleInput = () => container.querySelector<HTMLInputElement>("input")!;
    expect(titleInput().value).toBe("Original title");
    title = "Updated source title";
    await act(async () => notifyRepoRefreshed(91));
    expect(titleInput().value).toBe("Updated source title");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(titleInput(), "Unsaved draft");
      titleInput().dispatchEvent(new Event("input", { bubbles: true }));
    });
    title = "Another external change";
    await act(async () => notifyRepoRefreshed(91));
    expect(titleInput().value).toBe("Unsaved draft");
  });
});
