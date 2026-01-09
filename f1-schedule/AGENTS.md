# F1 Schedule - TRMNL Plugin

A Cloudflare Worker that provides F1 next race countdown or off-season information for TRMNL e-ink displays.

See [../agents.md](../agents.md) for shared TRMNL documentation and setup instructions.

## Overview

This plugin fetches data from [f1api.dev](https://f1api.dev) and returns merge variables for TRMNL displays.

### Active Season Mode
- Next race name, circuit, and location
- Days until race
- Race and qualifying times

### Off-Season Mode
- Days until next season
- Previous season champion info
- First race details when available

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Returns merge variables for TRMNL |
| `GET /api` | Returns merge variables + raw API data |
| `GET /health` | Health check (returns "OK") |

## Configuration

In `wrangler.toml`:
- `SEASON_START_FALLBACK` - Fallback date for season start if API doesn't have next season data
