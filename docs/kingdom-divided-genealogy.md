# Kingdom Divided Genealogy Reference

The Bellringer Noble Lines export supplied on 2026-07-08 is a Family Echo HTML
download containing a GEDCOM 5.5.1 lineage export.

Do not copy or modify the Family Echo HTML viewer into CampaignRepo. The portable
campaign data is the embedded GEDCOM section.

## Source Shape

- Title: Bellringer Noble Lines
- People: 786 `INDI` records
- Families: 352 `FAM` records
- Source file: `Bellringer-Noble-Lines-8-Jul-2026-193549555.html`

## CampaignRepo Mapping

Genealogy should use normal wiki pages plus relationship frontmatter:

- GEDCOM `HUSB` / `WIFE` pairs map to `spouse-of`.
- GEDCOM `CHIL` from a family maps from each listed parent to the child as
  `parent-of`.
- Biological and non-biological parentage should remain distinguishable when the
  source includes it; use relationship `notes` until a dedicated parentage type is
  added.
- Titles, birth years, death years, house/surname, and Family Echo notes belong in
  page body tables or structured properties.
- External wiki URLs from GEDCOM `RESI WWW` should be preserved as source links.

## Layout Expectation

The Kingdom Divided genealogy view should feel like the Family Echo reference:

- Family / hierarchy layout is the primary view.
- Parent generations stack top to bottom.
- Spouses sit beside each other and share child branches.
- Dense noble lines need collapsible house clusters.
- Node labels should prioritize title, given name, house, and years.
- The graph must handle several hundred people without forcing the general
  relationship graph into an unreadable cloud.

## Import Direction

A future GEDCOM importer can create or update character/NPC pages from this data
when the GM explicitly asks for that.

For the current Kingdom Divided cleanup, do not create wiki entries for every
person in the noble-line export. Match GEDCOM people against existing wiki pages
first, then write only relationships whose source and target already have pages.
Names that do not match an existing page should remain as unresolved source data
or notes, not placeholder pages.

Use existing portraits, arms, or page images when a matched page already has one.
Do not generate or download new images as part of a genealogy relationship import
unless the GM asks for art sourcing separately.
