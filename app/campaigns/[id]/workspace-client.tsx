"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Campaign, CampaignGraphEdge, CampaignGraphNode, CampaignMedia, CampaignTimelineItem, WikiPage, WikiTemplate } from "@/lib/types";
import { gameTypeGroups, gameTypes } from "@/lib/templates";
import { defaultAccent, defaultAccent2, themeFontNames, type CampaignTheme } from "@/lib/theme";
import { themePresetForGame, themePresetLabels, themePresetNames } from "@/lib/game-pack-branding";

type RepoValidationCheck = {
  label: string;
  path: string;
  ok: boolean;
  status: "ok" | "missing" | "wrong-type" | "error";
  actualType?: string;
  error?: string;
};

type RepoValidation = {
  ok: boolean;
  checks: RepoValidationCheck[];
};

function publicLinkInput(value: string) {
  return value
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .toLowerCase();
}

function categoryIdInput(value: string) {
  return value
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .toLowerCase();
}

export default function CampaignClient({ campaign, categories }: { campaign: Campaign; categories: { id: string; label: string }[] }) {
  const [campaignCategories, setCampaignCategories] = useState(categories);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [templates, setTemplates] = useState<WikiTemplate[]>([]);
  const [media, setMedia] = useState<CampaignMedia[]>([]);
  const [graph, setGraph] = useState<{ nodes: CampaignGraphNode[]; edges: CampaignGraphEdge[]; timeline: CampaignTimelineItem[] }>({ nodes: [], edges: [], timeline: [] });
  const [validation, setValidation] = useState<RepoValidation | null>(null);
  const [setup, setSetup] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState<any[]>([]);
  const [pageCategory, setPageCategory] = useState(categories[0]?.id || "character");
  const [navFilter, setNavFilter] = useState("");
  const [mediaFilter, setMediaFilter] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [publicSite, setPublicSite] = useState<{ slug: string; enabled: boolean } | null>(null);
  const [publicLinkName, setPublicLinkName] = useState(publicLinkInput(campaign.name));
  const [theme, setTheme] = useState<CampaignTheme>({});
  const [tab, setTab] = useState(campaign.role === "owner" || campaign.role === "gm" ? "pages" : "world");
  const pendingReviews = pages.filter((page) => page.frontmatter.approvalStatus !== "approved").length;
  const pageTemplates = templates.filter((template) => template.category === pageCategory);

  async function load() {
    const canManage = campaign.role === "owner" || campaign.role === "gm";
    const [pagesRes, graphRes, setupRes, templatesRes, mediaRes, validationRes, publicRes, themeRes, categoriesRes] = await Promise.all([
      fetch(`/api/campaigns/${campaign.id}/pages`),
      fetch(`/api/campaigns/${campaign.id}/graph`),
      fetch(`/api/campaigns/${campaign.id}/setup`),
      canManage ? fetch(`/api/campaigns/${campaign.id}/templates`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/media`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/validation`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/public`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/theme`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/categories`) : Promise.resolve(null)
    ]);
    const pagesData = await pagesRes.json();
    const graphData = graphRes.ok ? await graphRes.json() : { nodes: [], edges: [], timeline: [] };
    const setupData = setupRes.ok ? await setupRes.json() : { markdown: "" };
    const templatesData = templatesRes && templatesRes.ok ? await templatesRes.json() : { templates: [] };
    const mediaData = mediaRes && mediaRes.ok ? await mediaRes.json() : { media: [] };
    const validationData = validationRes && validationRes.ok ? await validationRes.json() : null;
    const publicData = publicRes && publicRes.ok ? await publicRes.json() : { site: null };
    const themeData = themeRes && themeRes.ok ? await themeRes.json() : { theme: {} };
    const categoriesData = categoriesRes && categoriesRes.ok ? await categoriesRes.json() : { categories };
    setPages(pagesData.pages || []);
    setGraph({ nodes: graphData.nodes || [], edges: graphData.edges || [], timeline: graphData.timeline || [] });
    setSetup(setupData.markdown || "");
    setTemplates(templatesData.templates || []);
    setMedia(mediaData.media || []);
    setValidation(validationData);
    setPublicSite(publicData.site || null);
    setPublicLinkName(publicData.site?.slug || publicLinkInput(campaign.name));
    setTheme(themeData.theme || {});
    if (categoriesData.categories?.length) {
      setCampaignCategories(categoriesData.categories);
      if (!categoriesData.categories.some((category: { id: string }) => category.id === pageCategory)) setPageCategory(categoriesData.categories[0].id);
    }
    if (pagesData.cache?.cached) {
      void fetch(`/api/campaigns/${campaign.id}/pages?refresh=wait`)
        .then((response) => response.ok ? response.json() : null)
        .then((fresh) => {
          if (fresh?.pages) setPages(fresh.pages);
        })
        .catch(() => undefined);
    }
  }

  async function saveTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: CampaignTheme = {
      preset: String(form.get("preset") || "") as CampaignTheme["preset"],
      accent: String(form.get("accent") || ""),
      accent2: String(form.get("accent2") || ""),
      displayFont: String(form.get("displayFont") || "") || undefined,
      banner: String(form.get("banner") || "") || undefined,
      logo: String(form.get("logo") || "") || undefined
    };
    setMessage("Saving theme...");
    const res = await fetch(`/api/campaigns/${campaign.id}/theme`, { method: "PUT", body: JSON.stringify({ theme: next }) });
    const data = await res.json();
    if (res.ok) {
      setTheme(data.theme || {});
      setMessage("Theme saved to campaign.yaml. Reload to see it everywhere.");
    } else {
      setMessage(data.error || "Could not save theme.");
    }
  }

  async function setPublic(action: "publish" | "rotate" | "unpublish", slug?: string) {
    const res = await fetch(`/api/campaigns/${campaign.id}/public`, {
      method: action === "unpublish" ? "DELETE" : "POST",
      body: action === "unpublish" ? undefined : JSON.stringify({ action, slug })
    });
    const data = await res.json();
    if (res.ok) {
      setPublicSite(data.site || null);
      if (data.site?.slug) setPublicLinkName(data.site.slug);
      setMessage(action === "unpublish" ? "Public site taken offline." : action === "rotate" ? "Public link rotated - the old link no longer works." : "Public site published.");
    } else {
      setMessage(data.error || "Could not update public site.");
    }
  }

  async function savePublicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await setPublic("publish", publicLinkName);
  }

  async function saveCategories(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving categories...");
    const cleaned = campaignCategories
      .map((category) => ({ id: categoryIdInput(category.id || category.label), label: category.label.trim() }))
      .filter((category) => category.id && category.label);
    const res = await fetch(`/api/campaigns/${campaign.id}/categories`, { method: "PUT", body: JSON.stringify({ categories: cleaned }) });
    const data = await res.json();
    if (res.ok) {
      setCampaignCategories(data.categories || cleaned);
      setMessage("Categories saved to campaign.yaml.");
    } else {
      setMessage(data.error || "Could not save categories.");
    }
  }

  useEffect(() => { load(); }, []);

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Creating page...");
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/campaigns/${campaign.id}/pages`, {
      method: "POST",
      body: JSON.stringify({ name: form.get("name"), category: form.get("category"), visibility: form.get("visibility"), templatePath: form.get("templatePath") || undefined })
    });
    const data = await res.json();
    if ((res.ok || res.status === 409) && data.slug) {
      const editQuery = res.status === 409 ? "?edit=1" : "";
      window.location.href = `/campaigns/${campaign.id}/pages/${data.slug}${editQuery}`;
    }
    else setMessage(data.error || "Could not create page.");
  }

  async function importCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let sourceJson: unknown;
    try {
      sourceJson = JSON.parse(String(form.get("json") || "{}"));
    } catch {
      setMessage("Import JSON is invalid.");
      return;
    }
    const res = await fetch(`/api/campaigns/${campaign.id}/imports/characters`, {
      method: "POST",
      body: JSON.stringify({
        source: form.get("source"),
        visibility: form.get("visibility"),
        approvalStatus: form.get("approvalStatus"),
        mapping: {
          name: form.get("mapName"),
          biography: form.get("mapBiography"),
          items: form.get("mapItems"),
          category: form.get("mapCategory"),
          summary: form.get("mapSummary"),
          tags: form.get("mapTags")
        },
        sourceJson
      })
    });
    const data = await res.json();
    if (res.ok) window.location.href = `/campaigns/${campaign.id}/pages/${data.slug}`;
    else setMessage(data.error || "Import failed.");
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tags = String(form.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const res = await fetch(`/api/campaigns/${campaign.id}/templates`, {
      method: "POST",
      body: JSON.stringify({
        name: form.get("templateName"),
        gameType: form.get("gameType"),
        category: form.get("templateCategory"),
        summary: form.get("summary"),
        tags,
        content: form.get("content")
      })
    });
    const data = await res.json();
    if (res.ok) {
      setTemplates((current) => [...current, data.template].sort((a, b) => `${a.gameType}:${a.category}:${a.name}`.localeCompare(`${b.gameType}:${b.category}:${b.name}`)));
      setMessage("Template saved to the campaign repo.");
      event.currentTarget.reset();
    } else {
      setMessage(data.error || "Could not create template.");
    }
  }

  async function uploadMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) {
      setMessage("Choose a media file first.");
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        base64,
        alt: form.get("alt"),
        caption: form.get("caption"),
        tags: String(form.get("tags") || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => [data.media, ...current.filter((item) => item.path !== data.media.path)]);
      setMessage("Media uploaded to the campaign repo.");
      event.currentTarget.reset();
    } else {
      setMessage(data.error || "Could not upload media.");
    }
  }

  async function deleteMedia(item: CampaignMedia) {
    if (!window.confirm(`Delete ${item.name} from the campaign repo?`)) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "DELETE",
      body: JSON.stringify({ path: item.path })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => current.filter((mediaItem) => mediaItem.path !== item.path));
      setMessage("Media deleted from the campaign repo.");
    } else {
      setMessage(data.error || "Could not delete media.");
    }
  }

  async function renameMedia(item: CampaignMedia) {
    const nextName = window.prompt("Rename media file", item.name);
    if (!nextName || nextName === item.name) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "PATCH",
      body: JSON.stringify({ path: item.path, fileName: nextName })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => [data.media, ...current.filter((mediaItem) => mediaItem.path !== item.path)]);
      setMessage("Media renamed in the campaign repo.");
    } else {
      setMessage(data.error || "Could not rename media.");
    }
  }

  async function editMediaMetadata(item: CampaignMedia) {
    const alt = window.prompt("Alt text or link label", item.alt || item.name);
    if (alt === null) return;
    const caption = window.prompt("Caption", item.caption || "");
    if (caption === null) return;
    const tagsInput = window.prompt("Tags, comma separated", item.tags?.join(", ") || "");
    if (tagsInput === null) return;
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "PATCH",
      body: JSON.stringify({ path: item.path, alt, caption, tags })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => [data.media, ...current.filter((mediaItem) => mediaItem.path !== item.path)]);
      setMessage("Media metadata updated.");
    } else {
      setMessage(data.error || "Could not update media metadata.");
    }
  }

  async function repairRepo() {
    const res = await fetch(`/api/campaigns/${campaign.id}/validation`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setValidation(data);
      setMessage(data.ok ? "Repo structure is healthy." : "Repair ran, but some checks still need attention.");
    } else {
      setMessage(data.error || "Could not repair repo structure.");
    }
  }

  async function rebuildIndex() {
    const res = await fetch(`/api/campaigns/${campaign.id}/search-index`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Search rebuilt for ${data.count} page${data.count === 1 ? "" : "s"}.`);
      await load();
    } else {
      setMessage(data.error || "Could not rebuild search.");
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("Copied Markdown link.");
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    const res = await fetch(`/api/search?campaignId=${campaign.id}&q=${encodeURIComponent(String(q || ""))}`);
    const data = await res.json();
    setSearch(data.results || []);
  }

  const canManage = campaign.role === "owner" || campaign.role === "gm";
  const tabs = canManage
    ? [
        { id: "pages", label: "Pages" },
        { id: "world", label: "World" },
        { id: "media", label: "Media" },
        { id: "templates", label: "Templates" },
        { id: "settings", label: "Settings" }
      ]
    : [{ id: "world", label: "World" }];

  // Sidebar: category sections, each with the parent->child hierarchy nested inside.
  const navFilterLc = navFilter.trim().toLowerCase();
  const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
  const sortedPages = [...pages].sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  // A child nests under its parent only when both share a category.
  const childrenByParent = new Map<string, WikiPage[]>();
  for (const page of sortedPages) {
    const parentPage = page.frontmatter.parent ? pageBySlug.get(page.frontmatter.parent) : undefined;
    if (parentPage && parentPage.frontmatter.category === page.frontmatter.category) {
      childrenByParent.set(page.frontmatter.parent!, [...(childrenByParent.get(page.frontmatter.parent!) || []), page]);
    }
  }
  const catDot = (page: WikiPage) => <span className="cat-dot" style={{ background: `var(--cat-${page.frontmatter.category}, var(--gold))` }} />;
  const navCategories = [
    ...campaignCategories,
    ...Array.from(new Set(pages.map((page) => page.frontmatter.category)))
      .filter((id) => !campaignCategories.some((category) => category.id === id))
      .map((id) => ({ id, label: id }))
  ];
  const navLink = (page: WikiPage, depth: number): ReactNode => {
    const kids = childrenByParent.get(page.slug) || [];
    const isOpen = openNodes[page.slug] ?? false;
    return (
      <div className="nav-tree-item" key={page.slug}>
        <div className="nav-tree-row" style={{ paddingLeft: depth * 14 }}>
          {kids.length ? (
            <button
              type="button"
              className="nav-tree-toggle"
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${kids.length} child page${kids.length === 1 ? "" : "s"} under ${page.frontmatter.name}`}
              title={`${isOpen ? "Collapse" : "Expand"} ${kids.length} child page${kids.length === 1 ? "" : "s"}`}
              onClick={() => setOpenNodes((s) => ({ ...s, [page.slug]: !isOpen }))}
            >
              {isOpen ? <ChevronDown aria-hidden="true" size={18} /> : <ChevronRight aria-hidden="true" size={18} />}
            </button>
          ) : (
            <span className="nav-tree-spacer" />
          )}
          <Link className="nav-link nav-tree-link" href={`/campaigns/${campaign.id}/pages/${page.slug}`}>
            {catDot(page)}
            <span className="nav-tree-name">{page.frontmatter.name}</span>
            {kids.length > 0 && <span className="nav-tree-child-count" title={`${kids.length} direct child page${kids.length === 1 ? "" : "s"}`}>{kids.length}</span>}
          </Link>
        </div>
        {kids.length > 0 && isOpen && kids.map((child) => navLink(child, depth + 1))}
      </div>
    );
  };
  const navTree: ReactNode = navCategories.map((cat) => {
    const catPages = sortedPages.filter((page) => page.frontmatter.category === cat.id);
    const visible = navFilterLc ? catPages.filter((page) => page.frontmatter.name.toLowerCase().includes(navFilterLc)) : catPages;
    if (navFilterLc && visible.length === 0) return null;
    const open = navFilterLc ? true : (openCats[cat.id] ?? catPages.length > 0);
    const roots = catPages.filter((page) => {
      const parentPage = page.frontmatter.parent ? pageBySlug.get(page.frontmatter.parent) : undefined;
      return !(parentPage && parentPage.frontmatter.category === cat.id);
    });
    return (
      <div className="nav-group" key={cat.id}>
        <button type="button" className="nav-group-header" aria-expanded={open} onClick={() => setOpenCats((s) => ({ ...s, [cat.id]: !open }))}>
          <span className="nav-group-title">{open ? "▾" : "▸"} {cat.label}</span>
          <span className="nav-count">{catPages.length}</span>
        </button>
        {open && (navFilterLc
          ? visible.map((page) => (
              <Link className="nav-link nav-tree-link nav-tree-filtered" key={page.slug} href={`/campaigns/${campaign.id}/pages/${page.slug}`}>{catDot(page)}{page.frontmatter.name}</Link>
            ))
          : roots.map((page) => navLink(page, 0)))}
      </div>
    );
  });
  const mediaFilterLc = mediaFilter.trim().toLowerCase();
  const filteredMedia = media.filter((item) =>
    !mediaFilterLc || [item.name, item.path, item.mediaType, item.alt, item.caption, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase().includes(mediaFilterLc)
  );
  const templateFilterLc = templateFilter.trim().toLowerCase();
  const templatesByGame = gameTypes.map((gameType) => ({
    gameType,
    templates: templates.filter((template) =>
      template.gameType === gameType &&
      (!templateFilterLc || [template.name, template.category, template.summary, template.path].filter(Boolean).join(" ").toLowerCase().includes(templateFilterLc))
    )
  }));
  const visibleTemplateGroups = templateFilterLc ? templatesByGame.filter((group) => group.templates.length > 0) : templatesByGame;
  // Timeline grouped into eras, eras ordered by their earliest event date.
  const timelineEras = (() => {
    const groups = new Map<string, CampaignTimelineItem[]>();
    for (const item of graph.timeline) {
      const key = item.era?.trim() || "Unsorted";
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return [...groups.entries()]
      .map(([name, items]) => ({ name, items, first: [...items.map((i) => i.eventDate || "9999")].sort()[0] }))
      .sort((a, b) => a.first.localeCompare(b.first) || a.name.localeCompare(b.name))
      .map(({ name, items }) => ({ name, items }));
  })();
  const linkedNodes = graph.nodes
    .map((node) => ({
      ...node,
      linkCount: node.outgoingLinks.length + node.backlinks.length + node.keyLinks.length,
      missingLinks: graph.edges.filter((edge) => edge.source === node.slug && edge.missing).length
    }))
    .filter((node) => node.linkCount > 0 || node.missingLinks > 0)
    .sort((a, b) => b.linkCount - a.linkCount || a.name.localeCompare(b.name))
    .slice(0, 12);
  const graphMapNodes = linkedNodes.slice(0, 10).map((node, index, list) => {
    const angle = list.length === 1 ? -Math.PI / 2 : (index / list.length) * Math.PI * 2 - Math.PI / 2;
    const rx = 220;
    const ry = 105;
    return {
      ...node,
      x: 260 + Math.cos(angle) * rx,
      y: 145 + Math.sin(angle) * ry
    };
  });
  const graphMapNodeLookup = new Map(graphMapNodes.map((node) => [node.slug, node]));
  const graphMapEdges = graph.edges
    .filter((edge) => !edge.missing && graphMapNodeLookup.has(edge.source) && graphMapNodeLookup.has(edge.target))
    .slice(0, 28);
  const shortLabel = (value: string) => (value.length > 18 ? `${value.slice(0, 16)}...` : value);

  return (
    <section className="workspace">
      <aside className="side-nav">
        <form onSubmit={runSearch} className="stack">
          <input name="q" placeholder="Search this repo" />
          <button>Search</button>
        </form>
        {search.map((row) => (
          <Link key={row.id} href={row.category === "media" ? `/campaigns/${campaign.id}#media` : `/campaigns/${campaign.id}/pages/${row.slug}`} className="nav-link">
            {row.title}
          </Link>
        ))}
        <input className="nav-filter" value={navFilter} onChange={(event) => setNavFilter(event.target.value)} placeholder="Filter pages" />
        {navTree}
        {canManage && (
          <Link href={`/campaigns/${campaign.id}/generate`} className="nav-link nav-tool-link">⚙ Generate</Link>
        )}
        {canManage && (
          <Link href={`/campaigns/${campaign.id}/lexicon`} className="nav-link nav-tool-link">Ⓛ Lexicon</Link>
        )}
        {canManage && pendingReviews > 0 && (
          <Link href={`/campaigns/${campaign.id}/admin`} className="review-callout">
            {pendingReviews} review{pendingReviews === 1 ? "" : "s"} waiting
          </Link>
        )}
      </aside>

      <div className="workspace-main">
        {tabs.length > 1 && (
          <nav className="tabs">
            {tabs.map((t) => (
              <button type="button" key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
        )}
        {canManage && tab === "pages" && (
          <section className="dashboard-grid">
            <div className="panel" id="media">
              <h2>Create page</h2>
              <form onSubmit={createPage} className="stack">
                <label>Name<input name="name" required placeholder="Victor Mendes" /></label>
                <label>Category<select name="category" value={pageCategory} onChange={(event) => setPageCategory(event.target.value)}>{campaignCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select></label>
                <label>Template<select name="templatePath"><option value="">Starter default</option>{pageTemplates.map((template) => <option key={template.path} value={template.path}>{template.gameType} - {template.category} - {template.name}</option>)}</select></label>
                <label>Visibility<select name="visibility"><option value="gm">GM only</option><option value="players">Player visible</option></select></label>
                <button>Create page</button>
              </form>
            </div>

            <div className="panel">
              <h2>Import character JSON</h2>
              <form onSubmit={importCharacter} className="stack">
                <label>Source<select name="source"><option value="foundry">Foundry Actor JSON</option><option value="generic">Generic JSON</option></select></label>
                <label>Visibility<select name="visibility"><option value="gm">GM only</option><option value="players">Player visible</option></select></label>
                <label>Approval<select name="approvalStatus"><option value="approved">Approved</option><option value="unapproved">Unapproved</option></select></label>
                <div className="mapper-grid">
                  <label>Name path<input name="mapName" placeholder="name" /></label>
                  <label>Biography path<input name="mapBiography" placeholder="bio or system.biography.value" /></label>
                  <label>Items path<input name="mapItems" placeholder="items" /></label>
                  <label>Category path<input name="mapCategory" placeholder="type" /></label>
                  <label>Summary path<input name="mapSummary" placeholder="summary" /></label>
                  <label>Tags path<input name="mapTags" placeholder="tags" /></label>
                </div>
                <textarea name="json" rows={8} placeholder='{"name":"Victor Mendes","type":"npc"}' />
                <button>Import character</button>
              </form>
            </div>
          </section>
        )}

        {tab === "world" && (
        <section className="dashboard-grid lore-grid">
          <div className="panel relationship-map-panel">
            <h2>Relationship Map</h2>
            {graphMapNodes.length > 1 ? (
              <svg className="relationship-map" viewBox="0 0 520 290" role="img" aria-label="Campaign relationship map">
                {graphMapEdges.map((edge, index) => {
                  const source = graphMapNodeLookup.get(edge.source)!;
                  const target = graphMapNodeLookup.get(edge.target)!;
                  return (
                    <line
                      key={`${edge.source}-${edge.target}-${index}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      className={edge.label === "key link" ? "key-edge" : ""}
                    />
                  );
                })}
                {graphMapNodes.map((node) => (
                  <a key={node.slug} href={`/campaigns/${campaign.id}/pages/${node.slug}`}>
                    <g className={`graph-node graph-node-${node.category}`}>
                      <circle cx={node.x} cy={node.y} r="25" />
                      <text x={node.x} y={node.y + 43} textAnchor="middle">{shortLabel(node.name)}</text>
                    </g>
                  </a>
                ))}
              </svg>
            ) : (
              <p className="muted">Add wiki links or key links to draw the relationship map.</p>
            )}
          </div>

          <div className="panel">
            <h2>Timeline</h2>
            {timelineEras.length ? (
              <div className="timeline">
                {timelineEras.map((era) => (
                  <div className="timeline-era" key={era.name}>
                    <h3 className="timeline-era-head">{era.name}</h3>
                    <div className="timeline-track-line">
                      {era.items.map((item) => (
                        <Link key={item.slug} href={`/campaigns/${campaign.id}/pages/${item.slug}`} className="timeline-event">
                          <span className="timeline-dot" />
                          <span className="timeline-date">{item.eventDate || "—"}</span>
                          <span className="timeline-body">
                            <strong>{item.name}</strong>
                            {item.track && <span className="timeline-track-badge">{item.track}</span>}
                            {item.summary && <small>{item.summary}</small>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Create Event pages (set an Event date and optional Era) to build the campaign timeline.</p>
            )}
          </div>

          <div className="panel">
            <h2>Relationships</h2>
            <div className="relationship-list">
              {linkedNodes.map((node) => (
                <article key={node.slug} className="relationship-row">
                  <div>
                    <Link href={`/campaigns/${campaign.id}/pages/${node.slug}`}><strong>{node.name}</strong></Link>
                    <span>{node.category} · {node.linkCount} links{node.missingLinks ? ` · ${node.missingLinks} missing` : ""}</span>
                  </div>
                  <p>
                    Out: {node.outgoingLinks.length} · Back: {node.backlinks.length} · Key: {node.keyLinks.length}
                  </p>
                </article>
              ))}
              {!linkedNodes.length && <p className="muted">Use wiki links like [[Jardin]] to grow relationships.</p>}
            </div>
          </div>
        </section>
        )}

        {canManage && tab === "media" && (
          <section className="dashboard-grid media-grid">
            <div className="panel">
              <h2>Media Manager</h2>
              <form onSubmit={uploadMedia} className="stack">
                <label>Media file<input name="file" type="file" accept="image/*,application/pdf,audio/*" required /></label>
                <label>Alt text or link label<input name="alt" placeholder="Jardin subsector map" /></label>
                <label>Caption<input name="caption" placeholder="Player-facing map of Jardin highport" /></label>
                <label>Tags<input name="tags" placeholder="map, handout, jardin" /></label>
                <button>Upload to /wiki/media</button>
              </form>
            </div>

            <div className="panel media-library">
              <h2>Media Library</h2>
              <input type="search" className="library-filter" value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value)} placeholder="Filter media by name, type, caption, or tag" />
              <div className="media-list">
                {filteredMedia.map((item) => (
                  <article key={item.path} className="media-row">
                    <div className={`media-preview media-preview-${item.mediaType}`}>
                      {item.downloadUrl && item.mediaType === "image" && <img src={item.downloadUrl} alt={item.alt || item.name} />}
                      {item.downloadUrl && item.mediaType === "pdf" && <iframe title={item.alt || item.name} src={item.downloadUrl} />}
                      {item.downloadUrl && item.mediaType === "audio" && <audio controls src={item.downloadUrl} />}
                      {(!item.downloadUrl || item.mediaType === "other") && <span>{item.mediaType}</span>}
                    </div>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.mediaType} · {item.path}</span>
                      {item.caption && <span>{item.caption}</span>}
                      {Boolean(item.tags?.length) && <span>{item.tags?.join(", ")}</span>}
                      <code>{item.markdown}</code>
                    </div>
                    <div className="member-actions">
                      <button type="button" className="secondary" onClick={() => copyText(item.markdown)}>Copy Markdown</button>
                      <button type="button" className="secondary" onClick={() => editMediaMetadata(item)}>Edit Metadata</button>
                      <button type="button" className="secondary" onClick={() => renameMedia(item)}>Rename</button>
                      {item.downloadUrl && <a className="button secondary" href={item.downloadUrl}>Open</a>}
                      <button type="button" className="danger" onClick={() => deleteMedia(item)}>Delete</button>
                    </div>
                  </article>
                ))}
                {!media.length && <p className="muted">No media uploaded yet.</p>}
                {media.length > 0 && !filteredMedia.length && <p className="muted">No media matches this filter.</p>}
              </div>
            </div>
          </section>
        )}

        {canManage && tab === "templates" && (
          <section className="dashboard-grid">
            <div className="panel">
              <h2>Template Creator</h2>
              <form onSubmit={createTemplate} className="stack">
                <label>Template name<input name="templateName" required placeholder="Solomani Patron" /></label>
                <label>Game type<select name="gameType" defaultValue={campaign.gameType}>{gameTypeGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>{group.types.map((type) => <option key={type}>{type}</option>)}</optgroup>
                ))}</select></label>
                <label>Content type<select name="templateCategory">{campaignCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select></label>
                <label>Summary<input name="summary" placeholder="Reusable structure for..." /></label>
                <label>Tags<input name="tags" placeholder="traveller, patron, navy" /></label>
                <label>Markdown body<textarea name="content" rows={10} placeholder={"# {{name}}\n\n## Overview\n\n\n:::gm\nSecret notes.\n::: "} /></label>
                <button>Save template</button>
              </form>
            </div>

            <div className="panel template-library">
              <h2>Template Library</h2>
              <input type="search" className="library-filter" value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)} placeholder="Filter templates by name, category, or summary" />
              {visibleTemplateGroups.map((group) => (
                <div key={group.gameType} className="template-group">
                  <h3>{group.gameType}</h3>
                  {group.templates.map((template) => (
                    <article key={template.path} className="template-row">
                      <strong>{template.name}</strong>
                      <span>{template.category} · {template.path}</span>
                      {template.summary && <p>{template.summary}</p>}
                    </article>
                  ))}
                  {!group.templates.length && <p className="muted">No templates yet.</p>}
                </div>
              ))}
              {templateFilterLc && !visibleTemplateGroups.length && <p className="muted">No templates match this filter.</p>}
            </div>
          </section>
        )}

        {canManage && tab === "settings" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Public site</h2>
                <p className="muted">Publish a read-only, no-login world of your player-visible, approved pages at a shareable link.</p>
              </div>
              <div className="member-actions">
                {publicSite?.enabled ? (
                  <>
                    <a className="button secondary" href={`/site/${publicSite.slug}`} target="_blank" rel="noreferrer">Open public site</a>
                    <button type="button" className="danger" onClick={() => setPublic("unpublish")}>Unpublish</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setPublic("publish", publicLinkName)}>{publicSite ? "Re-publish" : "Publish public site"}</button>
                )}
              </div>
            </div>
            <form onSubmit={savePublicLink} className="public-link-form">
              <label htmlFor="public-link-name">Public link name</label>
              <div className="public-link-editor">
                <span>/site/</span>
                <input
                  id="public-link-name"
                  value={publicLinkName}
                  onChange={(event) => setPublicLinkName(publicLinkInput(event.target.value))}
                  placeholder="sparks-of-the-past"
                  autoComplete="off"
                />
                <button type="submit">{publicSite ? "Save link name" : "Publish public site"}</button>
              </div>
              <p className="muted">Use letters, numbers, and hyphens. Changing this updates the public URL.</p>
            </form>
            {publicSite?.enabled ? (
              <div className="public-share">
                <label>Shareable link</label>
                <div className="public-share-row">
                  <code>{`/site/${publicSite.slug}`}</code>
                  <button type="button" className="secondary" onClick={() => copyText(`${window.location.origin}/site/${publicSite.slug}`)}>Copy link</button>
                  <button type="button" className="secondary" onClick={() => { if (window.confirm("Rotate the link? The current public URL will stop working.")) setPublic("rotate"); }}>Rotate link</button>
                </div>
                <p className="muted">Anyone with this link can read player-visible pages — no account needed. GM-only blocks and unapproved pages are never exposed.</p>
              </div>
            ) : (
              <p className="muted">{publicSite ? "This world is currently offline. Re-publish to bring it back at its existing link." : "Not published yet."}</p>
            )}
          </section>
        )}

        {canManage && tab === "settings" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Theme</h2>
                <p className="muted">Accent colors, display font, and banner — stored in campaign.yaml and applied to the workspace, player portal, and public site.</p>
              </div>
            </div>
            <form onSubmit={saveTheme} className="theme-form">
              <div className="theme-fields">
                <label>Theme preset<select name="preset" defaultValue={theme.preset || themePresetForGame(campaign.gameType)} key={`p-${theme.preset || ""}`}>
                  {themePresetNames.map((preset) => <option key={preset || "base"} value={preset}>{themePresetLabels[preset]}</option>)}
                </select></label>
                <label>Accent (gold)<input type="color" name="accent" defaultValue={theme.accent || defaultAccent} key={`a-${theme.accent || ""}`} /></label>
                <label>Secondary (purple)<input type="color" name="accent2" defaultValue={theme.accent2 || defaultAccent2} key={`a2-${theme.accent2 || ""}`} /></label>
                <label>Display font<select name="displayFont" defaultValue={theme.displayFont || "Fraunces"} key={`f-${theme.displayFont || ""}`}>{themeFontNames.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
                <label>Banner image<select name="banner" defaultValue={theme.banner || ""} key={`b-${theme.banner || ""}`}>
                  <option value="">None</option>
                  {media.filter((item) => item.mediaType === "image").map((item) => {
                    const rel = item.path.replace(/^wiki\/media\//, "");
                    return <option key={item.path} value={rel}>{item.name}</option>;
                  })}
                </select></label>
                <label>Logo image<select name="logo" defaultValue={theme.logo || ""} key={`l-${theme.logo || ""}`}>
                  <option value="">None</option>
                  {media.filter((item) => item.mediaType === "image").map((item) => {
                    const rel = item.path.replace(/^wiki\/media\//, "");
                    return <option key={item.path} value={rel}>{item.name}</option>;
                  })}
                </select></label>
              </div>
              <div className="member-actions">
                <button type="submit">Save theme</button>
              </div>
            </form>
          </section>
        )}

        {canManage && tab === "settings" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Categories</h2>
                <p className="muted">Rename or add page categories for this campaign. These are stored in campaign.yaml and used by the workspace, player-facing lists, and public site.</p>
              </div>
              <div className="member-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCampaignCategories((current) => [...current, { id: `custom_${current.length + 1}`, label: "New category" }])}
                >
                  Add category
                </button>
              </div>
            </div>
            <form onSubmit={saveCategories} className="category-form">
              <div className="category-editor-list">
                {campaignCategories.map((category, index) => (
                  <div className="category-editor-row" key={`${category.id}-${index}`}>
                    <label>
                      Label
                      <input
                        value={category.label}
                        onChange={(event) => setCampaignCategories((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))}
                      />
                    </label>
                    <label>
                      ID
                      <input
                        value={category.id}
                        onChange={(event) => setCampaignCategories((current) => current.map((item, i) => i === index ? { ...item, id: categoryIdInput(event.target.value) } : item))}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary danger"
                      disabled={campaignCategories.length <= 1}
                      onClick={() => setCampaignCategories((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="member-actions">
                <button type="submit">Save categories</button>
              </div>
            </form>
          </section>
        )}

        {canManage && tab === "settings" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Repo validation</h2>
                <p className="muted">Checks the GitHub repo for the required CampaignRepo folders and starter files.</p>
              </div>
              <div className="member-actions">
                <button type="button" className="secondary" onClick={rebuildIndex}>Rebuild search</button>
                <button type="button" className="secondary" onClick={repairRepo}>Repair structure</button>
              </div>
            </div>
            <div className="validation-list">
              {validation?.checks.map((check) => (
                <article key={check.path} className={`validation-row ${check.ok ? "ok" : "needs-work"}`}>
                  <div>
                    <strong>{check.label}</strong>
                    <span>{check.path}</span>
                  </div>
                  <code>{check.status}{check.actualType && check.status !== "ok" ? `: ${check.actualType}` : ""}</code>
                  {check.error && <p className="error">{check.error}</p>}
                </article>
              ))}
              {!validation && <p className="muted">Connect GitHub to run repo validation.</p>}
            </div>
          </section>
        )}

        {canManage && tab === "settings" && (
          <section className="panel">
            <h2>Setup instructions</h2>
            <textarea readOnly rows={10} value={setup} />
            <button onClick={() => navigator.clipboard.writeText(setup)}>Copy setup instructions</button>
          </section>
        )}
      </div>
      {message && <p className="toast">{message}</p>}
    </section>
  );
}
