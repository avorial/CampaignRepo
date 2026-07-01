import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting started · CampaignRepo",
  description: "A step-by-step guide to creating your first campaign."
};

type Step = {
  title: string;
  body: React.ReactNode;
  optional?: boolean;
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
    title: "Create your first campaign",
    body: (
      <>
        <p className="muted">
          On the dashboard, expand <strong>New campaign</strong>. Give it a name, pick your game system, and click
          {" "}<strong>Create campaign</strong>. That&apos;s it — no account, no Git, no config required.
          CampaignRepo creates a folder on this machine and scaffolds the full wiki structure automatically.
        </p>
        <p className="muted">
          Want version history, multi-device access, or player sharing?
          Open <em>Advanced options</em> and choose a GitHub backend — you can also add it to a local campaign later.
        </p>
      </>
    )
  },
  {
    title: "Write pages and link them",
    body: (
      <>
        <p className="muted">Create a page from a template, then use the editor&apos;s live preview:</p>
        <ul className="step-list">
          <li>Link pages with <code>[[Page Name]]</code> or <code>[[Page Name|label]]</code>. Missing links offer a one-click create.</li>
          <li>Wrap GM-only text in a <code>:::gm</code> … <code>:::</code> block — players never see it.</li>
          <li>Set <strong>visibility</strong> (GM / Players) and <strong>tags</strong> in the sidebar.</li>
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
          content stripped. AI- and import-created pages land as <strong>unapproved</strong> and wait in the GM review queue.
        </p>
        <p className="muted">
          Invite players from the campaign&apos;s Admin tab — they get a read-only portal at{" "}
          <code>/campaigns/[id]/portal</code>.
        </p>
      </>
    )
  },
  {
    title: "Know the campaign layout",
    body: (
      <>
        <p className="muted">Your campaign is a folder of plain files. CampaignRepo manages:</p>
        <ul className="step-list">
          <li><code>wiki/pages</code> — one Markdown file per page</li>
          <li><code>wiki/media</code> — images, maps, PDFs, audio</li>
          <li><code>wiki/templates/&lt;system&gt;</code> — your template pack</li>
          <li><code>wiki/search/index.json</code> — portable search snapshot</li>
          <li><code>wiki/campaign.yaml</code> — campaign settings, theme, categories</li>
        </ul>
        <p className="muted">Files are plain Markdown — edit them in any text editor, they&apos;re yours.</p>
      </>
    )
  },
  {
    title: "Add media, sessions, and quests",
    body: (
      <>
        <p className="muted">
          Upload images and handouts in the <strong>Media</strong> tab, plan sessions in{" "}
          <strong>Sessions</strong>, track story threads in <strong>Quests</strong>, and browse the
          auto-built <strong>Timeline</strong> and <strong>Relationship graph</strong>.
        </p>
      </>
    )
  },
  {
    title: "Connect GitHub for sync and history",
    optional: true,
    body: (
      <>
        <p className="muted">
          GitHub is optional but recommended for version history, multi-device access, and player invites.
          On the dashboard, open <strong>GitHub connection</strong> and install the GitHub App — it gives
          CampaignRepo access to only the repos you choose.
        </p>
        <p className="muted">
          Already have a local campaign? Go to its Settings tab and move it to a GitHub repo without losing any data.
        </p>
      </>
    )
  },
  {
    title: "Connect AI over MCP",
    optional: true,
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
          <p className="muted">From zero to a living campaign wiki — no account required.</p>
        </div>
        <Link className="button secondary" href="/dashboard">Go to dashboard</Link>
      </header>

      <ol className="steps">
        {steps.map((step, index) => (
          <li className="step panel" key={step.title}>
            <span className="step-num">{index + 1}</span>
            <div className="step-body">
              <h2>{step.title}{step.optional && <span className="badge muted" style={{ marginLeft: 8, fontSize: "11px", fontWeight: 400 }}>optional</span>}</h2>
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
