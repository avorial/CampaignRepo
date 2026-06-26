# CampaignRepo

CampaignRepo is a GitHub-backed campaign wiki for tabletop RPGs. It keeps every campaign in a normal GitHub repository while giving GMs and players a purpose-built web app for pages, media, templates, imports, search, review queues, and AI/MCP-assisted editing.

GMs get a durable Markdown workflow with approvals and private notes. Players get a clean portal that only exposes approved, player-safe material.

## Product Tour

### Campaign Dashboard

Search across every connected campaign, open a repo, or expand setup tools only when you need them. Once GitHub is connected, setup panels stay collapsed by default.

![Campaign dashboard](docs/screenshots/dashboard.png)

### Campaign Workspace

Each campaign has a workspace for search, wiki navigation, relationship maps, timelines, media, templates, settings, and repo maintenance. Campaign themes can reskin the workspace for systems such as Traveller.

![Campaign workspace](docs/screenshots/workspace.png)

### Wiki Page Editor

Pages are Markdown with YAML frontmatter. The editor keeps source text and rendered preview side by side, with insert tools for wiki links, media references, and GM-only blocks.

![Wiki page editor](docs/screenshots/editor.png)

### GM Review Queue

AI-created, imported, or otherwise unapproved content waits for GM review before it can become player-visible.

![GM review queue](docs/screenshots/review-queue.png)

### Player Portal

Players see only pages that are both approved and marked player-visible. GM-only blocks and internal import metadata are stripped from player reads.

![Player portal](docs/screenshots/player-portal.png)

## What CampaignRepo Does

- Stores campaign pages, media, templates, imports, search snapshots, and config in GitHub.
- Renders Markdown wiki pages with `[[wiki-links]]`, aliases, backlinks, tags, key links, and `:::gm` secret blocks.
- Gives GMs an editor, review queue, media manager, relationship map, timeline, and repo repair tools.
- Gives players a no-GitHub-needed portal for approved, player-visible lore and handouts.
- Imports Foundry Actor JSON and generic character JSON into campaign writeups.
- Supports system template packs and per-campaign visual themes.
- Exposes an MCP-style JSON-RPC API for AI tools and external clients.

## Core Features

### Accounts And Permissions

- Local CampaignRepo accounts with username/password login.
- Seeded local admin account with forced first-login password change.
- Global admin dashboard for users, campaign memberships, role changes, password resets, disabled accounts, and admin grants.
- Per-campaign GM tools for members, invite links, and table access.
- Owner, GM, and player campaign roles.

### Campaign Repositories

- One app can manage many campaign repos.
- GitHub App connection for normal repo read/write access.
- Manual GitHub token fallback for local testing and repo creation.
- Repo validation and repair for required folders and starter files.
- Portable repo structure, so campaign content remains readable without CampaignRepo.

### Wiki Editing

- Markdown pages with YAML frontmatter.
- Categories for characters, NPCs, organizations, species, locations, items, events, lore, and game notes.
- Safe Markdown rendering with sanitized HTML.
- `[[Page]]` and `[[Page|Label]]` wiki links.
- GM-only blocks using `:::gm`.
- Insert controls for wiki links, alias links, media snippets, and GM blocks.
- Save conflict detection when GitHub changes a file after it was opened.
- GM preview, player preview, and handout views.

### Imports, Media, Search

- Foundry Actor JSON import.
- Generic JSON character import with optional field mapping.
- Import source diffing for re-import review.
- Media upload, rename, delete, captions, alt text, tags, and repo-persisted metadata.
- SQLite full-text search plus portable `/wiki/search/index.json` snapshots.
- Relationship lists, visual relationship map, and event timeline.

### MCP And AI Workflow

- MCP-style JSON-RPC endpoint at `/api/mcp`.
- Dashboard-minted access tokens used with `Authorization: Bearer`.
- Tools for campaign search, page reads, page creation, unapproved updates, templates, media, graph data, review queues, and setup instructions.
- AI-created or AI-edited pages land as unapproved until a GM approves them.

## Quick Start

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

The local database seeds this first admin account:

```text
Email: admin@example.local
Password: admin
```

CampaignRepo forces the seeded admin password to be changed before the dashboard or APIs can be used.

## Common Commands

```bash
npm run dev        # Start local development server
npm run typecheck  # TypeScript check
npm test           # Run Vitest tests
npm run build      # Production build
npm start          # Start built Next.js app
```

## GitHub App Setup

The easiest setup path is from the CampaignRepo dashboard:

1. Sign in as a global admin.
2. Click **Connect GitHub**.
3. Let GitHub create the CampaignRepo GitHub App from the manifest.
4. Choose the campaign repositories the app can access.
5. Return to CampaignRepo and connect or repair a campaign repo.

CampaignRepo stores the GitHub App configuration in SQLite and uses short-lived installation tokens for repo access.

To create the GitHub App manually, create a new app at:

```text
https://github.com/settings/apps/new
```

Use these values:

- Homepage URL: your CampaignRepo URL.
- Callback URL: `https://YOUR-CAMPAIGNREPO-HOST/api/github/app/callback`.
- Setup URL: `https://YOUR-CAMPAIGNREPO-HOST/api/github/app/callback`.
- Repository permissions:
  - Contents: read/write.
  - Metadata: read-only.
- Installation access: only the repositories CampaignRepo should manage.

After adding the `GITHUB_APP_*` environment variables and restarting the app, use **Install or update GitHub App access** from the dashboard.

## Campaign Repo Layout

CampaignRepo creates and expects this structure inside each campaign repo:

```text
/wiki
  /pages
  /media
    media.json
  /templates/<game-type>
  /imports/characters
  /search
    index.json
  campaign.yaml
README.md
```

Manual edits are welcome. Preserve YAML frontmatter and CampaignRepo conventions for wiki links, visibility, approvals, and GM-only blocks.

## Visibility Rules

Player safety is based on page metadata and GM-only blocks:

- `visibility: players` makes a page eligible for player view.
- `approvalStatus: approved` is required before players can see it.
- `:::gm` blocks are removed from player reads.
- Source import metadata is hidden from player reads.
- Players can read campaign content without GitHub credentials.

## Docker

Run the prebuilt image from GitHub Container Registry:

```bash
docker compose -f docker-compose.image.yml up -d
```

The published image is:

```text
ghcr.io/avorial/campaignrepo:latest
```

For Portainer, create a stack from `docker-compose.image.yml` or use this image in your own compose file. The SQLite database is stored in the `campaignrepo-data` volume at `/app/data`.

After the first publish, make the GHCR package public in GitHub Packages if you want unauthenticated pulls.

To build locally instead:

```bash
docker compose up -d --build
```

Open:

```text
http://127.0.0.1:3000
```

Useful environment variables:

```bash
APP_URL=https://campaignrepo.example.com
SECURE_COOKIES=true
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-github-app-slug
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

Set `SECURE_COOKIES=true` when serving behind HTTPS so session cookies use the `Secure` flag.

Without Compose:

```bash
docker build -t campaignrepo .
docker run -p 3000:3000 -v campaignrepo-data:/app/data campaignrepo
```

## Portainer Updates

For a local Portainer install, GitOps polling is simpler than a webhook while testing.

Recommended stack settings:

- Repository: `https://github.com/avorial/CampaignRepo.git`
- Reference: `refs/heads/main`
- Compose path: `docker-compose.yml`
- Update method: polling
- Polling interval: 5 minutes

## Roadmap

Near-term priorities:

- Richer Markdown editing while preserving source compatibility.
- Better Foundry import rendering and safer re-import workflows.
- Improved player handout library and session-facing navigation.
- Stronger MCP schemas, resources, and prompt templates.
- Invite expiration, email delivery, and audit history.
- Better search ranking, filters, highlights, graph labels, and timeline controls.
- Branch and publishing workflows for staging campaign changes.
- Production backup/restore documentation for SQLite and campaign repos.

## License

See [LICENSE](LICENSE).
