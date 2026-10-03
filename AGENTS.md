# TRMNL Plugins

Each top-level directory is an independent Cloudflare Worker that feeds a TRMNL
Private Plugin. TRMNL polls the Worker for JSON merge variables and renders them
through the Liquid template kept in that project's `src/markup.html`, which is
pasted into the plugin's markup editor on trmnl.com.

The target device is a **TRMNL OG v2**: 800x480 landscape with 4 gray levels.

## Projects

| Directory | Shows |
|-----------|-------|
| `christian-names` | Random Christian boy names with meanings (OpenAI, KV cache) |
| `f1-standings`, `f1-results`, `f1-schedule` | Formula 1 championship, latest race, calendar |
| `indycar-standings`, `indycar-results`, `indycar-schedule` | IndyCar championship, latest race, calendar |
| `family-calendar` | Google Calendar agenda, person-coded (OAuth, bearer-token feed) |
| `family-tree` | One ancestor at a time from the private family-history repo |
| `pregnancy-tracker` | Pregnancy week-by-week tracking |
| `sol-incinerator` | Sol Incinerator usage stats with charts |
| `world-recipes` | Random world recipes |

Projects with their own `AGENTS.md` or `README.md` document their data sources
and quirks there.

## Rules

- **This repository is public.** Never commit secrets, `.env`, `.dev.vars`, or
  private data. Endpoints that serve personal data must require a secret
  (e.g. `Authorization: Bearer <token>`, set in TRMNL's polling headers).
- **New projects**: copy `.env` from an existing project. It holds
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the right account; the
  global wrangler login may point at a different one.
- **Time zone**: display and compute dates in Eastern Time
  (`America/New_York`). Always pass `timeZone` to `toLocale*String`; Workers
  run in UTC.

## Commands

Every project supports `npm install`, `npm run dev` (local Worker on :8787) and
`npm run deploy`. Newer projects add `check` (`wrangler deploy --dry-run`),
`test` (`node --test`) and a `preview` script that renders the markup locally.

## Markup

Framework docs: https://trmnl.com/framework/docs (v3.4 as of October 2026). The
old `usetrmnl.com` URLs redirect there.

- On trmnl.com the platform supplies `screen` and `view`. Plugin markup should
  be exactly one `<div class="layout">` followed by a sibling
  `<div class="title_bar">`. Older plugins wrap everything in
  `view view--full`; that still renders, but don't copy the pattern.
- **Use the framework's type classes, not arbitrary font sizes.** 12, 16 and
  21px are pixel fonts (`TRMNL12/16/21`) that stay crisp on e-ink. Larger sizes
  use Inter. A custom `font-size` either falls back to the browser serif or
  scales a pixel font badly. Measured classes:
  - `text--small` 12 · `text--base` 16 · `text--large` 21 · `text--xlarge` 26 ·
    `text--xxlarge` 38 · `text--xxxlarge` 58 · `text--mega` 74
  - `title--small` 16 bold · `title` 21 · `title--large` 30 · `title--xlarge` 35
  - `value--xxsmall` 16 · `value--xsmall` 20 · `value--small` 26 · `value` 38 ·
    `value--large` 58
  - `content--small` 12 · `content` 16 · `content--large` 21 · `content--xlarge` 30
  - `label--small` 12 · `label` 16 bold · `description` 12
- Keep custom CSS for arrangement (flex, grid, borders, widths). Black text and
  solid rules read best; use gray sparingly.
- The runtime (`plugins.js`) handles overflow. `data-content-limiter` steps
  prose down to 12px and clamps it, `data-clamp="N"` truncates,
  `data-value-fit` shrinks a value to its box, and `data-value-format`
  abbreviates numbers. Prefer sizing content so the limiter never fires; 12px
  is hard to read on the device.
- Deprecated in v3, removed in 4.0: `font--*` (use `text--*`) and
  `border--h-1..7` (use the shade steps `border--h-10..75`).
- Charts: Highcharts/Chartkick from `https://trmnl.com/js/...`, with every
  animation disabled.

## Previewing

Render the Liquid template with `liquidjs` into a page that loads the framework
directly. Measure, rather than eyeball, before shipping:

```html
<link rel="stylesheet" href="https://trmnl.com/css/3.4.0/plugins.css">
<script src="https://trmnl.com/js/3.4.0/plugins.js"></script>
<body class="environment trmnl">
  <div class="screen screen--ogv2"><div class="view view--full"><!-- markup --></div></div>
</body>
```

`family-tree/scripts/preview.mjs` is a working example: it renders each
variant in an 800x480 iframe. Open it with the Playwright MCP and check
`scrollHeight > clientHeight` on the layout containers to catch overflow
across real data. Keep each preview page to a few dozen iframes: hundreds of
them outlast the shared browser bridge's 45s tool timeout, which drops this
session's Playwright connection until `/mcp` reconnects it.
