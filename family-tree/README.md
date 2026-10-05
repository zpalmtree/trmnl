# Family Tree

Shows one ancestor at a time on the TRMNL: who they are to Zach or Emily,
their dates, key facts, and their life story.

## Data flow

`npm run export` reads the generated projections at the private
family-history repo's committed `HEAD` (`data/family/people.json` and
`relationships.json`, location overridable with `FAMILY_HISTORY_DIR`).
Uncommitted research there never reaches the display. It writes the display
cards to `src/data/people.json`, which is **gitignored** because this repo is
public. Wrangler bundles that file into the Worker at deploy time, so `dev`,
`check` and `deploy` all re-export first.

### Staying current

A systemd user timer runs `npm run sync` daily at about 04:30 Eastern. It
re-exports and redeploys only when the cards changed, recording the deployed
hash in `src/data/deployed.sha256`. New people, facts and stories committed to
the family-history repo reach the display within a day.

```bash
cp systemd/trmnl-family-tree-sync.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now trmnl-family-tree-sync.timer
journalctl --user -u trmnl-family-tree-sync.service   # history
```

Life stories are generated in the family-history repo, not here. Its AGENTS.md
asks the agent working there to refresh the story of any main-scope person it
adds or changes.

The life stories come straight from the family-history repo's verified
pipeline (`npm run life-stories:status` there). This plugin never writes back.
The stories are written for this display as well as the family-history
viewer. Claude writes and verifies them there in a short, natural voice, under
90 words each. The export tidies them lightly for a screen that already shows
the name and dates.

### Who is shown

- Direct ancestors of Zach or Emily only, labelled by relation
  ("Emily's 3rd great-grandmother").
- Deceased people, plus people whose status is unknown but who are clearly
  historical (generation 4+ or born by 1916). Living or possibly living relatives
  appear only as first names in a line of descent.
- Candidate facts (unproven identity matches) are dropped. Established and
  family-information facts are kept.
- People with neither a story nor dates plus a place or occupation are skipped.

## Worker

`GET /api` returns merge variables for the current person and requires
`Authorization: Bearer <FEED_TOKEN>`. Without `FEED_TOKEN` configured, it
refuses every request. `GET /health` is open.

The person rotates every `ROTATE_MINUTES`, working through a shuffled order so
nobody repeats until everyone has appeared. No storage is needed.

| Setting | Values | Override per request |
|---------|--------|----------------------|
| `VARIANT` | `sidebar` (default), `story`, `headline` | `?variant=` |
| `POOL` | `all`, `story` (only people with a life story) | `?pool=` |
| `ROTATE_MINUTES` | minutes per person, default `60` | |
| `FONTS` | `classic` (default), `trmnl`: must match the device's Presentation > Font Family | `?fonts=` |
| | | `?id=<person-id>` pins one person |

## Layouts

There is no title bar, so each layout gets the whole 780x460 layout box.

- **sidebar**: identity, dates, age and facts on the left; story on the right.
  The line of descent sits below the story. When there's room, it's a timeline
  with birth years ("From Ann to Zach"). Otherwise it's one wrapped line.
- **story**: name and dates across the top, full-width story, a row of facts
  when the story leaves room, and the line of descent at the foot.
- **headline**: large name, lifespan and opening sentence, up to four fact
  cells, and the line of descent. Readable from across the room.

`src/pick.ts` plans each layout against font metrics measured for the
device's font family. The device uses Classic, where `content--large` is 26px
BlockKie rather than 21px TRMNL21. The old plan assumed the TRMNL family, which
is why long stories ran off the bottom of the real screen. The planner picks
the largest framework size that holds the whole story, then fits as many facts
as there's room for and chooses the form of the line of descent. Nothing is
clamped. Long stories keep their leading paragraphs at 16px, so the content
limiter doesn't shrink everything to 12px. Facts that only repeat the lifespan
(a bare birth or death year) are left out.

## Commands

```bash
npm install
npm run export     # refresh src/data/people.json from the family-history repo
npm run preview    # preview.html: sample people x every layout at 800x480
npm run preview -- --ids bella-blackman,michael-misamore
npm run preview -- --all --offset 40   # everyone, 40 per page
npm run preview -- --audit             # preview-audit.html: measure every render for clipping
npm run preview -- --calibrate         # preview-calibrate.html: font widths for src/pick.ts
npm run preview -- --fonts trmnl       # preview the other device font family
npm test
npm run check      # export + wrangler dry run
npm run sync       # export, deploy only if the cards changed
npm run deploy     # export + deploy unconditionally
```

## TRMNL setup

1. `npx wrangler secret put FEED_TOKEN` with a long random value, then deploy.
2. Create a Private Plugin with the **Polling** strategy, URL
   `https://trmnl-family-tree.<subdomain>.workers.dev/api`, and the polling
   header `Authorization: Bearer <FEED_TOKEN>`.
3. Paste `src/markup.html` into the full-screen markup editor.
4. Match the plugin refresh interval to `ROTATE_MINUTES`.
