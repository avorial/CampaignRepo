// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import ArticleContent from "@/app/components/article-content";
import MaintenanceMenu from "@/app/components/maintenance-menu";
import { readFileSync } from "node:fs";
import { parse } from "postcss";

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
  it("gives centered readers an explicit width despite article size containment", () => {
    const css = parse(readFileSync("app/globals.css", "utf8"));
    const sizing: Record<string, string> = {};
    css.walkRules(".reader-shell", rule => {
      rule.walkDecls(declaration => { sizing[declaration.prop] = declaration.value; });
    });
    expect(sizing).toMatchObject({ width: "100%", "min-width": "0", "max-width": "1200px" });
  });
  it("leaves image links native so they open in a new tab without a popup viewer", async () => {
    const click = vi.fn();
    await act(async () => root.render(createElement(ArticleContent, { html: '<a class="image-fullsize-link" href="/original.png" target="_blank" rel="noopener noreferrer"><img src="/original.png" alt="Portrait"></a>', onClick: click })));
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => container.querySelector("img")!.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(click).not.toHaveBeenCalled();
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_blank");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
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
