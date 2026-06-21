# CampaignRepo

CampaignRepo is a GitHub-backed campaign wiki for tabletop RPGs.

It gives each campaign a normal GitHub repository for durable storage while providing a web app for GMs, players, imports, media, review queues, search, and AI/MCP-assisted editing.

## What It Does

- Stores campaign pages as Markdown in GitHub.
- Keeps campaign media, templates, import sources, search snapshots, and config in the same repo.
- Gives GMs an editor, review queue, media manager, relationship map, timeline, and repo repair tools.
- Gives players a clean portal that only shows approved, player-visible pages.
- Supports wiki links like `[[Page]]`, aliases like `[[Page|Label]]`, backlinks, tags, key links, and GM-only Markdown blocks.
- Imports Foundry Actor JSON and generic character JSON into campaign writeups.
- Exposes an MCP-style JSON-RPC API for AI tools and external clients.

## Current Features

### Accounts And Permissions

- Username/password CampaignRepo accounts.
- Seeded local admin account with forced first-login password change.
- Global admin dashboard for creating accounts, editing users, assigning campaign memberships, changing GM/player rights, resetting passwords, disabling accounts, and granting global admin access.
- Per-campaign GM portal for adding existing accounts, manually creating new accounts, and managing invite links.
- Player and GM campaign roles.

### Campaign Repos

- One CampaignRepo app can manage many campaign repositories.
- GitHub App connection for normal repo read/write access.
- Manual GitHub token fallback for local testing and repo creation.
- Repo validation and repair for required campaign folders and starter files.
- Portable repo structure, so campaign content remains readable without the app.

### Wiki Editing

- Markdown pages with YAML frontmatter.
- Categories for characters, NPCs, locations, events, games, and custom content.
- Safe Markdown rendering with sanitized HTML.
- `[[wiki-links]]`, alias links, backlinks, tags, key links, and missing-page prompts for GMs.
- GM-only blocks using `:::gm`.
- Insert controls for wiki links, alias links, media snippets, and GM-only blocks.
- Save conflict detection when a file changed on GitHub after it was opened.
- GM preview, player preview, and handout views.

### Player Portal

- Dedicated player-facing campaign view.
- Players only see pages that are both approved and visible to players.
- GM-only blocks and source import metadata are stripped from player reads.
- Player accounts do not need GitHub access.

### Imports And Media

- Foundry Actor JSON import.
- Generic JSON character import with optional field mapping.
- Import source diffing for re-import review.
- Media upload, rename, delete, captions, alt text, tags, and repo-persisted metadata.
- Character writeups can include portrait/media references from the campaign repo.

### Search, Graph, And Timeline

- SQLite full-text search.
- Portable search snapshot stored at `/wiki/search/index.json`.
- Manual per-campaign search rebuild.
- Relationship lists and visual relationship map.
- Timeline view for event pages.

### MCP And AI Workflow

- MCP-style JSON-RPC endpoint at `/api/mcp`.
- Personal access tokens can be minted from the dashboard and used with `Authorization: Bearer`.
- In-app sessions can also call the MCP endpoint.
- Tools include campaign search, page reads, page creation, unapproved updates, templates, media, graph data, review queue access, and setup instructions.
- AI-created or AI-edited content is routed through approval before players can see it.

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

## Docker

Run with Docker Compose:

```bash
docker compose up -d --build
```

Open:

```text
http://127.0.0.1:3000
```

The SQLite database is stored in the `campaignrepo-data` volume at `/app/data`.

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

## GitHub App Setup

The easiest setup path is from the CampaignRepo dashboard:

1. Sign in as a global admin.
2. Click **Connect GitHub**.
3. Let GitHub create the CampaignRepo GitHub App from the manifest.
4. Choose the campaign repositories the app can access.
5. Return to CampaignRepo and connect or repair the campaign repo.

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

## Campaign Repository Layout

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

Manual edits are allowed as long as YAML frontmatter and CampaignRepo conventions are preserved.

## Visibility Rules

Player safety is based on page metadata and GM-only blocks:

- `visibility: players` makes a page eligible for player view.
- `approvalStatus: approved` is required before players can see it.
- `:::gm` blocks are removed from player reads.
- Source import metadata is hidden from player reads.
- Players can read campaign content without GitHub credentials.

## Roadmap

Near-term priorities:

- Richer Markdown editing while preserving source compatibility.
- Better Foundry import rendering and safer re-import workflows.
- Improved player handout library and session-facing navigation.
- Stronger MCP schemas, resources, and prompt templates.
- Invite expiration, email delivery, and audit history.
- Media previews for images, PDFs, and audio.
- Better search ranking, filters, highlights, graph labels, and timeline controls.
- Branch and publishing workflows for staging campaign changes.
- Production backup/restore documentation for SQLite and campaign repos.

## License

See [LICENSE](LICENSE).
