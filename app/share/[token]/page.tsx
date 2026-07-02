import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getPageShare, getCampaignByIdPublic } from "@/lib/db";
import { loadCampaignTheme } from "@/lib/public-site";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, renderMarkdown, stripGmBlocks } from "@/lib/markdown";
import { themeToCssVars } from "@/lib/theme";
import Logo from "@/app/components/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const share = getPageShare(token);
  if (!share) return { title: "CampaignRepo" };
  const campaign = getCampaignByIdPublic(share.campaignId);
  if (!campaign) return { title: "CampaignRepo" };
  try {
    const storage = getStorageAdapter(campaign, null);
    if (!storage) return { title: campaign.name };
    const file = await storage.getTextFile(`wiki/pages/${share.slug}.md`);
    const page = parsePage(share.slug, file.text, file.sha);
    return {
      title: `${page.frontmatter.name} — ${campaign.name}`,
      description: page.frontmatter.summary || undefined
    };
  } catch {
    return { title: campaign.name };
  }
}

export default async function PageShareRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = getPageShare(token);
  if (!share) notFound();

  const campaign = getCampaignByIdPublic(share.campaignId);
  if (!campaign) notFound();

  const storage = getStorageAdapter(campaign, null);
  if (!storage) notFound();

  let pageHtml = "";
  let pageName = "";
  let pageSummary = "";
  let pageCover = "";
  let pageCategory = "";

  try {
    const file = await storage.getTextFile(`wiki/pages/${share.slug}.md`);
    const page = parsePage(share.slug, file.text, file.sha);

    pageName = page.frontmatter.name;
    pageSummary = page.frontmatter.summary || "";
    pageCover = page.frontmatter.cover || "";
    pageCategory = page.frontmatter.category || "";

    const content = stripGmBlocks(page.content);
    pageHtml = renderMarkdown(
      content,
      "handout",
      () => ({ href: "#", missing: false }),
      (path) => {
        const parts = path.split("/").map(encodeURIComponent);
        return `/share/${token}/media/${parts.join("/")}`;
      },
      () => null
    );
  } catch {
    notFound();
  }

  const theme = await loadCampaignTheme(campaign, null);
  const themeVars = themeToCssVars(theme) as CSSProperties;

  const coverUrl = pageCover
    ? `/share/${token}/media/${pageCover.split("/").map(encodeURIComponent).join("/")}`
    : "";

  return (
    <main className="app-shell" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Logo href="/" />
          <span className="muted" style={{ fontSize: 13 }}>{campaign.name}</span>
        </div>
        <div className="topbar-actions">
          <span className="muted" style={{ fontSize: 12 }}>Shared page · no account needed</span>
        </div>
      </header>

      <div className="workspace">
        <div className="reader-shell" style={{ gridColumn: "1 / -1" }}>
          <article className="preview page-reader">
            {coverUrl && <img className="page-cover" src={coverUrl} alt={pageName} />}
            <header className="handout-header">
              {pageCategory && <p className="muted" style={{ fontSize: 12, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{pageCategory}</p>}
              <h1>{pageName}</h1>
              {pageSummary && <p className="page-summary muted">{pageSummary}</p>}
            </header>

            <div
              className="content-body"
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />

            <footer className="share-page-footer">
              Created with <a href="/" className="quiet-link">CampaignRepo</a>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
