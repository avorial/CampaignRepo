# CampaignRepo

CampaignRepo is a GitHub-backed RPG campaign wiki. One app manages many campaigns, and each campaign maps to one GitHub repo containing Markdown pages, media, templates, imports, search snapshots, and campaign configuration.

## Current MVP

- Username/password app accounts.
- Private dashboard for creating or connecting campaign repos.
- GitHub token connection for repo creation and file commits.
- Game template packs for Traveller, Fantasy, Modern, Horror, Sci-Fi, and Custom.
- Wiki categories for Characters, NPCs, Locations, Events, and Games.
- Markdown pages with `[[Page]]` links, `[[Page|Label]]` aliases, key links, backlinks, tags, visibility, and approval status.
- GM-only Markdown blocks with `:::gm`.
- Foundry Actor JSON and generic JSON character import.
- SQLite full-text search plus portable repo snapshots at `/wiki/search/index.json`.
- MCP-style JSON-RPC endpoint at `/api/mcp` for AI search, reads, page creation, unapproved updates, and setup instructions.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

The local database seeds a first admin account:

- Username: `admin`
- Password: `admin`

CampaignRepo forces this password to be changed on first login before the dashboard or APIs can be used.

## Verification

```bash
npm run typecheck
npm run build
```

## GitHub Repo Structure Created For Campaigns

```text
/wiki
  /pages
  /media
  /templates/<game-type>
  /imports/characters
  /search/index.json
  campaign.yaml
README.md
```

Manual edits are allowed if YAML frontmatter and CampaignRepo conventions are preserved.
