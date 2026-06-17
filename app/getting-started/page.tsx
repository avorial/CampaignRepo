import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting started · CampaignRepo",
  description: "A step-by-step guide to setting up your first GitHub-backed campaign wiki."
};

type Step = {
  title: string;
  body: React.ReactNode;
};

const steps: Step[] = [
  {
    title: "Sign in to CampaignRepo",
    body: (
      <>
        <p className="muted">
          Open the app and sign in. A first-run admin account is seeded as <code>admin</code> / <code>admin</code>;
          you&apos;ll be asked to set a real password before anything else. Or <Link href="/register">create your own account</Link>.
        </p>
      </>
    )
  },
  {
    title: "Connect your GitHub account",
    body: (
      <>
        <p className="muted">
          Each campaign is a GitHub repo, so CampaignRepo needs a token to read and write it. On the dashboard,
          paste a GitHub personal access token under <strong>GitHub connection</strong>.
        </p>
        <p className="muted">
          Create one at{" "}
          <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">github.com/settings/tokens</a>{" "}
          with <strong>read &amp; write access to repository contents</strong>. A fine-grained token scoped to the
          repos you&apos;ll use is ideal.
        </p>
      </>
    )
  },
  {
    title: "Build or connect a campaign repo",
    body: (
      <>
        <p className="muted">Under <strong>Build Campaign Repo</strong>, choose one:</p>
        <ul className="step-list">
          <li><strong>Create repo</strong> — CampaignRepo makes a new GitHub repo and scaffolds the full structure for you.</li>
          <li><strong>Connect repo</strong> — point at an existing repo (owner, name, branch); missing folders are repaired automatically.</li>
        </ul>
        <p className="muted">
          Pick your <strong>game system</strong> (Sword Chronicle, Dungeons &amp; Dragons, World of Darkness, Traveller,
          or Custom) — its template pack is seeded into the repo.
        </p>
      </>
    )
  },
  {
    title: "Know the repo layout",
    body: (
      <>
        <p className="muted">Your campaign repo is the source of truth. CampaignRepo manages:</p>
        <ul className="step-list">
          <li><code>/wiki/pages</code> — one Markdown file per page</li>
          <li><code>/wiki/media</code> — images, maps, PDFs, audio</li>
          <li><code>/wiki/templates/&lt;system&gt;</code> — your template pack</li>
          <li><code>/wiki/search/index.json</code> — portable search snapshot</li>
          <li><code>/wiki/campaign.yaml</code> — campaign settings</li>
        </ul>
        <p className="muted">Manual edits on GitHub are fine — just keep the frontmatter intact.</p>
      </>
    )
  },
  {
    title: "Write pages, link them, hide secrets",
    body: (
      <>
        <p className="muted">Create a page from a template, then use the editor&apos;s live preview:</p>
        <ul className="step-list">
          <li>Link pages with <code>[[Page Name]]</code> or <code>[[Page Name|label]]</code>. Missing links offer a one-click create.</li>
          <li>Wrap GM-only text in a <code>:::gm</code> … <code>:::</code> block — players never see it.</li>
          <li>Set <strong>visibility</strong> (GM / Players) and <strong>tags</strong> in the sidebar; toggle GM / Player / Handout preview.</li>
        </ul>
      </>
    )
  },
  {
    title: "Control what players see",
    body: (
      <>
        <p className="muted">
          Players only see pages marked <strong>Players</strong> and <strong>Approved</strong>, with all <code>:::gm</code>
          content stripped. AI- and import-created pages land as <strong>unapproved</strong> and wait in the GM review queue —
          on the campaign&apos;s admin page and the dashboard&apos;s cross-repo review.
        </p>
      </>
    )
  },
  {
    title: "Add media, imports, and explore",
    body: (
      <>
        <p className="muted">
          Upload images and handouts in the Media manager, import characters from Foundry / generic JSON, and browse the
          auto-built <strong>Timeline</strong> (from dated events) and <strong>Relationship</strong> graph. Search runs per
          repo or across every repo you can access.
        </p>
      </>
    )
  },
  {
    title: "Connect AI over MCP (optional)",
    body: (
      <>
        <p className="muted">
          Mint an <strong>MCP access token</strong> on the dashboard, then point an external client (e.g. Claude Desktop) at{" "}
          <code>/api/mcp</code> with an <code>Authorization: Bearer</code> header. The AI can search, read, create pages,
          and propose updates — all landing as unapproved for your review.
        </p>
      </>
    )
  }
];

export default function GettingStartedPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Guided walkthrough</p>
          <h1>Getting started</h1>
          <p className="muted">From zero to a living, GitHub-backed campaign wiki in eight steps.</p>
        </div>
        <Link className="button secondary" href="/dashboard">Go to dashboard</Link>
      </header>

      <ol className="steps">
        {steps.map((step, index) => (
          <li className="step panel" key={step.title}>
            <span className="step-num">{index + 1}</span>
            <div className="step-body">
              <h2>{step.title}</h2>
              {step.body}
            </div>
          </li>
        ))}
      </ol>

      <section className="band">
        <p className="muted">
          Ready? <Link href="/dashboard">Open the dashboard</Link> or <Link href="/login">sign in</Link> to begin.
        </p>
      </section>
    </main>
  );
}
