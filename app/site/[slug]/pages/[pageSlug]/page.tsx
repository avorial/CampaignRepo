import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getPublicSiteCampaign } from "@/lib/db";
import { loadCampaignTheme } from "@/lib/public-site";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, renderMarkdown, stripGmBlocks } from "@/lib/markdown";
import { themeToCssVars } from "@/lib/theme";
import Logo from "@/app/components/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; pageSlug: string }> }): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const campaign = getPublicSiteCampaign(slug);
  if (!campaign) return { title: "CampaignRepo" };
  try {
    const storage = getStorageAdapter(campaign, null);
    if (!storage) return { title: campaign.name };
    const file = await storage.getTextFile(`wiki/pages/${pageSlug}.md`);
    const page = parsePage(pageSlug, file.text, file.sha);
    if (page.frontmatter.visibility !== "players" || page.frontmatter.approvalStatus !== "approved") {
      return { title: campaign.name };
    }
    const ogImages = page.frontmatter.cover
      ? [{ url: `/public-media/${slug}/${encodeURIComponent(page.frontmatter.cover)}` }]
      : [];
    return {
      title: `${page.frontmatter.name} — ${campaign.name}`,
      description: page.frontmatter.summary || undefined,
      openGraph: { title: page.frontmatter.name, description: page.frontmatter.summary || undefined, images: ogImages }
    };
  } catch {
    return { title: campaign.name };
  }
}

export default async function PublicPageRoute({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  const campaign = getPublicSiteCampaign(slug);
  if (!campaign) notFound();

  const storage = getStorageAdapter(campaign, null);
  if (!storage) notFound();

  let pageHtml = "";
  let pageName = "";
  let pageSummary = "";
  let pageCover = "";

  try {
    const file = await storage.getTextFile(`wiki/pages/${pageSlug}.md`);
    const page = parsePage(pageSlug, file.text, file.sha);
    if (page.frontmatter.visibility !== "players" || page.frontmatter.approvalStatus !== "approved") notFound();

    pageName = page.frontmatter.name;
    pageSummary = page.frontmatter.summary || "";
    pageCover = page.frontmatter.cover || "";

    const content = stripGmBlocks(page.content);
    pageHtml = renderMarkdown(
      content,
      "handout",
      (target) => ({ href: `/site/${slug}#${target}`, missing: false }),
      (path) => `/public-media/${slug}/${path.split("/").map(encodeURIComponent).join("/")}`,
      () => null
    );
  } catch {
    notFound();
  }

  const theme = await loadCampaignTheme(campaign, null);
  const themeVars = themeToCssVars(theme) as CSSProperties;

  const coverUrl = pageCover
    ? `/public-media/${slug}/${pageCover.split("/").map(encodeURIComponent).join("/")}`
    : "";

  return (
    <main className="app-shell" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Logo href="/site" />
          <a href={`/site/${slug}`} className="quiet-link">{campaign.name}</a>
        </div>
        <nav className="topbar-actions">
          <a href={`/site/${slug}`} className="button secondary">View full world</a>
        </nav>
      </header>

      <div className="workspace">
        <div className="reader-shell" style={{ gridColumn: "1 / -1" }}>
          <article className="preview page-reader">
            {coverUrl && <img className="page-cover" src={coverUrl} alt={pageName} />}
            <header className="handout-header">
              <h1>{pageName}</h1>
              {pageSummary && <p className="page-summary muted">{pageSummary}</p>}
            </header>

            <div
              className="content-body"
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />

            <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <a href={`/site/${slug}`} className="quiet-link muted">← Back to {campaign.name}</a>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
