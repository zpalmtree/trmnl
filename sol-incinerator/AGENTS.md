# Sol Incinerator TRMNL Plugin

TRMNL plugin displaying stats from the Sol Incinerator (Solana token burning service).

## Data Source

Uses the Cinder backend API at `https://sol-incinerator.dev/api` and Jupiter Price API for SOL price (with CryptoCompare/CoinGecko fallbacks).

### Endpoints Used
- `GET /stats/totalSolReclaimed` - Total SOL returned to users
- `GET /stats/cumulativeTransactions` - Cumulative transaction count
- `GET /stats/charts/monthly/cumulative_users` - Cumulative user count
- `GET /stats/charts/monthly/fees` - Monthly protocol fees/revenue
- `GET /stats/highestWeeklySolReclaimed` - Top user weekly
- `GET /stats/highestMonthlySolReclaimed` - Top user monthly
- Jupiter Price API v3 for live SOL/USD price (primary)
- CryptoCompare / CoinGecko as fallbacks

### Authentication
Requires API keys set via wrangler secrets:
```bash
npx wrangler secret put CINDER_API_KEY   # Cinder backend API
npx wrangler secret put JUP_API_KEY      # Jupiter Price API (get from https://portal.jup.ag)
```

For local development, create `.dev.vars`:
```
CINDER_API_KEY=your_key_here
JUP_API_KEY=your_jup_key_here
```

## Merge Variables

### Core Stats
| Variable | Description | Example |
|----------|-------------|---------|
| `sol_price` | Current SOL price | "135.16" |
| `sol_price_formatted` | SOL price with $ | "$135.16" |
| `total_sol_reclaimed` | Total SOL returned (formatted) | "485.22K" |
| `total_sol_reclaimed_usd` | Total value in USD | "$65.58M" |
| `total_users` | Total unique users | "3.14M" |
| `total_transactions` | Total transactions | "50.92M" |

### Revenue / Fees
| Variable | Description | Example |
|----------|-------------|---------|
| `total_fees_sol` | All-time protocol fees | "14.15K" |
| `total_fees_usd` | All-time fees in USD | "$1.91M" |
| `monthly_fees_sol` | Current month fees | "397.00" |
| `monthly_fees_usd` | Current month USD | "$53.61K" |
| `prev_month_fees_sol` | Previous month fees | "290.00" |
| `prev_month_fees_usd` | Previous month USD | "$39.16K" |

### Activity
| Variable | Description | Example |
|----------|-------------|---------|
| `monthly_new_users` | New users this month | "11.4K" |
| `monthly_new_transactions` | New txns this month | "200.9K" |
| `avg_sol_per_user` | Avg SOL per user | "0.1544" |
| `updated_display` | Last update time | "Jan 5, 1:23 AM" |

## TRMNL Templates

Two templates are provided:
- `template.html` - Full layout with all stats
- `template-simple.html` - Clean minimal layout

## Development

```bash
npm install
npm run dev    # Start local dev server on port 8787
npm run deploy # Deploy to Cloudflare
```

## Deployed URL

`https://trmnl-sol-incinerator.solslugs.workers.dev`

## Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **APIs**: Cinder backend, Jupiter Price API (primary), CryptoCompare/CoinGecko (fallbacks)
