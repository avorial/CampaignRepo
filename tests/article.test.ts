import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { prepareArticleHtml, renderArticle } from "@/lib/article";
import { defaultFrontmatter } from "@/lib/templates";
import { parsePage } from "@/lib/markdown";
import { sanitizePlayerPage } from "@/lib/public-site";
import { playerSecretRisks } from "@/lib/page-privacy";
import { buildRepositoryManifestFromSearchDocuments, manifestPageFromWikiPage } from "@/lib/repository-manifest";
import type { SearchDocument } from "@/lib/types";

const metadata = { ...defaultFrontmatter("Example Person", "npc", "players"), summary: "A physician and sculptor.", cover: "/wiki/media/portrait.png" };
const media = (name: string) => "/campaign-media/1/" + name;
const documentFor = (html: string) => new JSDOM(html).window.document;

describe("shared article presentation", () => {
  it("opens authored sidebar pictures and galleries in new tabs without download attributes", () => {
    const html = prepareArticleHtml('<aside class="wiki-infobox"><img src="/portrait.png" alt="Portrait"></aside><a class="gallery-item" href="/scene.png" download><img src="/scene.png"></a><button data-roll="2d6"><img src="/dice.png"></button>', { ...metadata, cover: undefined });
    const document = documentFor(html);
    const portrait = document.querySelector(".wiki-infobox a")!;
    expect(portrait.getAttribute("href")).toBe("/portrait.png");
    expect(portrait.getAttribute("target")).toBe("_blank");
    expect(portrait.getAttribute("aria-label")).toContain("new tab");
    expect(document.querySelector(".gallery-item")?.hasAttribute("download")).toBe(false);
    expect(document.querySelector("[data-roll] a")).toBeNull();
  });
  it("keeps the existing sidebar portrait without adding a duplicate cover", () => {
    const content = '# Example Person\n\n<div class="wiki-layout"><div class="wiki-main"><h2>Public Face</h2><p>Public facts.</p></div><aside class="wiki-infobox"><img src="/wiki/media/portrait.png" alt="Portrait" /></aside></div>';
    const document = documentFor(renderArticle(content, metadata, "player", undefined, media));
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(document.querySelector(".wiki-infobox img")?.getAttribute("src")).toBe(media("portrait.png"));
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector(".article-summary")?.textContent).toBe(metadata.summary);
  });

  it("places a cover-only character image in the sidebar", () => {
    const document = documentFor(renderArticle("# Example Person\n\nPublic description.", metadata, "gm", undefined, media));
    expect(document.querySelector(".wiki-layout .wiki-infobox img")).not.toBeNull();
    expect(document.querySelector(".article-banner")).toBeNull();
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("makes banners opt-in and retains the original image aspect ratio", () => {
    const document = documentFor(renderArticle("# Harbor\n\nA waterfront.", { ...metadata, name: "Harbor", category: "location", coverDisplay: "banner" }, "player", undefined, media));
    expect(document.querySelector(".article-banner img")).not.toBeNull();
    expect(document.querySelector(".article-portrait")).toBeNull();
    expect(document.querySelector("img")?.hasAttribute("height")).toBe(false);
  });

  it("supports metadata-only images without hiding images authored in the body", () => {
    const hidden = renderArticle("Public facts.", { ...metadata, coverDisplay: "none" }, "player", undefined, media);
    expect(documentFor(hidden).querySelector("img")).toBeNull();
    const bodyImage = renderArticle("![Portrait](/wiki/media/portrait.png)", { ...metadata, coverDisplay: "none" }, "player", undefined, media);
    expect(documentFor(bodyImage).querySelectorAll("img")).toHaveLength(1);
  });

  it("does not display an unfilled template placeholder", () => {
    expect(documentFor(renderArticle("Description.", { ...metadata, cover: "/wiki/media/REPLACE.jpg" }, "gm")).querySelector("img")).toBeNull();
  });

  it("removes a duplicated standalone image while keeping the sidebar and other pictures", () => {
    const document = documentFor(prepareArticleHtml('<p><img src="/same.png"></p><aside class="wiki-infobox"><img src="/same.png"></aside><p><img src="/different.png"></p>', { ...metadata, cover: "/same.png" }));
    expect(document.querySelectorAll('img[src="/same.png"]')).toHaveLength(1);
    expect(document.querySelector('img[src="/different.png"]')).not.toBeNull();
  });

  it("normalizes section headings without removing character-sheet headings or roll controls", () => {
    const document = documentFor(prepareArticleHtml('<h1>Example Person</h1><h1>History</h1><div class="tsheet"><h1>Sheet identity</h1><button data-roll="2d6" data-mod="2">Roll</button></div>', { ...metadata, cover: undefined }));
    expect(document.querySelector("h2")?.textContent).toBe("History");
    expect(document.querySelector(".tsheet h1")?.textContent).toBe("Sheet identity");
    expect(document.querySelector("[data-roll]")?.getAttribute("data-mod")).toBe("2");
  });

  it("strips protected content and summary markup in player and handout views", () => {
    for (const mode of ["player", "handout"] as const) {
      const html = renderArticle("Public facts.\n\n:::gm\nSecret treatment.\n:::", { ...metadata, summary: "Public. :::gmHidden identity.:::" }, mode);
      expect(html).toContain("Public");
      expect(html).not.toContain("Secret treatment");
      expect(html).not.toContain("Hidden identity");
    }
    expect(renderArticle(":::gm\nSecret treatment.\n:::", metadata, "gm")).toContain("Secret treatment");
  });

  it("sanitizes the assembled HTML and safely renders metadata as text", () => {
    const html = renderArticle('<img src="x" onerror="alert(1)"><script>alert(2)</script>', { ...metadata, name: '<script>alert(3)</script>', cover: "javascript:alert(4)" }, "player");
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain('src="javascript:');
    expect(documentFor(html).querySelector("script")).toBeNull();
    expect(documentFor(html).querySelector("h1")?.textContent).toBe("<script>alert(3)</script>");
  });
});

describe("player privacy and future cleanup", () => {
  it("uses player-only links for metadata snapshots and hides legacy unfiltered links", () => {
    const page = parsePage("example", "---\nname: Example\nvisibility: players\n---\nPublic [[Public Person]].\n:::gm\n[[Hidden Person]]\n:::");
    const snapshot = { ...page, content: "", raw: "", playerOutgoingLinks: [{ target: "Public Person", label: "Public Person" }] };
    expect(sanitizePlayerPage(snapshot).outgoingLinks).toEqual(snapshot.playerOutgoingLinks);
    expect(sanitizePlayerPage({ ...snapshot, playerOutgoingLinks: undefined }).outgoingLinks).toEqual([]);
  });
  it("removes private metadata, hidden relationships, and GM-only links from player payloads", () => {
    const page = parsePage("example", "---\nname: Example\ncategory: npc\nvisibility: players\nsourceImport: secret-source\nsummary: 'Public :::gmsecret summary:::'\nrelationships:\n  - type: allied-with\n    target: Hidden Person\n    hidden: true\n  - type: allied-with\n    target: Public Person\n---\nPublic [[Public Person]].\n:::gm\nSecret [[Hidden Person]].\n:::");
    const safe = sanitizePlayerPage(page);
    expect(safe.raw).not.toContain("secret-source");
    expect(safe.raw).not.toContain("Hidden Person");
    expect(safe.raw).not.toContain("secret summary");
    expect(safe.frontmatter.relationships).toHaveLength(1);
    expect(safe.outgoingLinks.map((link) => link.target)).toEqual(["Public Person"]);
  });

  it("flags explicit private references outside GM blocks, but respects protected blocks", () => {
    const page = parsePage("example", "---\nname: Example\nvisibility: players\n---\n<table><tr><th>Private Pressure</th><td>Secret</td></tr></table>\n\n## Scene Use\n\nInstructions.");
    expect(playerSecretRisks(page)).toEqual(["Private Pressure", "Scene Use"]);
    expect(playerSecretRisks({ ...page, content: ":::gm\n" + page.content + "\n:::" })).toEqual([]);
    expect(playerSecretRisks({ ...page, frontmatter: { ...page.frontmatter, visibility: "gm" } })).toEqual([]);
  });

  it("keeps image placement in immediate and rebuilt repository manifests", () => {
    const page = parsePage("example", "---\nname: Example\ncategory: location\ncover: /wiki/media/harbor.png\ncoverDisplay: banner\n---\nHarbor.");
    expect(manifestPageFromWikiPage(page.slug, "wiki/pages/example.md", page).coverDisplay).toBe("banner");
    const doc = { slug: page.slug, title: page.frontmatter.name, category: "location", cover: page.frontmatter.cover, coverDisplay: "banner", links: [] } as unknown as SearchDocument;
    expect(buildRepositoryManifestFromSearchDocuments([doc]).pages[0]).toMatchObject({ cover: "/wiki/media/harbor.png", coverDisplay: "banner" });
  });
});
