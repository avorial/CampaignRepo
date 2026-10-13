// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import ArticleContent from "@/app/components/article-content";
import MaintenanceMenu from "@/app/components/maintenance-menu";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("article image interaction", () => {
  it("opens the original image, closes with Escape, and restores keyboard focus", async () => {
    await act(async () => root.render(createElement(ArticleContent, { html: '<img tabindex="0" src="/original.png" alt="Portrait">' })));
    const image = container.querySelector("img")!;
    image.focus();
    await act(async () => image.click());
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/original.png");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close image");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(image);
  });

  it("keeps wiki and dice interactions delegated to the existing handler", async () => {
    const click = vi.fn();
    await act(async () => root.render(createElement(ArticleContent, { html: '<button data-roll="2d6"><img src="/dice.png">Roll</button>', onClick: click })));
    await act(async () => container.querySelector("img")!.click());
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe("maintenance menu", () => {
  it("groups the commands, closes when a command starts, and reports failures", async () => {
    const run = vi.fn(async () => { throw new Error("Storage unavailable"); });
    await act(async () => root.render(createElement(MaintenanceMenu, { actions: [{ label: "Repair indexes", kind: "repair", run }] })));
    const menu = container.querySelector("details")!;
    menu.open = true;
    await act(async () => container.querySelector("button")!.click());
    expect(menu.open).toBe(false);
    expect(run).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Storage unavailable");
  });
});
