# World Recipes - TRMNL Plugin

A Cloudflare Worker that serves random recipes from around the world for display on TRMNL e-ink devices.

See [../agents.md](../agents.md) for shared TRMNL documentation and setup instructions.

## Architecture

- **API**: Spoonacular for recipe data
- **LLM**: OpenAI GPT-5.2 for formatting/condensing recipes
- **Hosting**: Cloudflare Workers

## Endpoints

- `/` - Returns formatted recipe JSON for TRMNL
- `/api` - Returns recipe JSON with raw Spoonacular data (debug)
- `/health` - Health check

## Secrets

Set via `wrangler secret put`:
- `SPOONACULAR_API_KEY`
- `OPENAI_API_KEY`

## Deployment

- **Worker code changes** (`src/index.ts`, `wrangler.toml`): Deploy via `wrangler deploy`
- **Markup changes** (`src/markup.html`): Edit directly in TRMNL dashboard, NOT via wrangler deploy. The markup file in this repo is for reference/backup only.

## GPT-5.2 API Notes

GPT-5.2 has different API requirements than GPT-4:
- Use `max_completion_tokens` instead of `max_tokens`
- `temperature` parameter not supported (only default value of 1)
- Model ID: `gpt-5.2-chat-latest` for chat completions
