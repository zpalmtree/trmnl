# IndyCar Schedule - TRMNL Plugin

A Cloudflare Worker that provides IndyCar next race countdown or off-season information for TRMNL e-ink displays.

See [../agents.md](../agents.md) for shared TRMNL documentation and setup instructions.

## Overview

This plugin fetches data from the official INDYCAR schedule page and results API on [indycar.com](https://www.indycar.com) and returns merge variables for TRMNL displays.

### Active Season Mode
- Next race name, track, and location
- Days until race
- Race time and broadcast network

### Off-Season Mode
- Days until next season
- Previous/current season leader info
- First race details when available

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Returns merge variables for TRMNL |
| `GET /api` | Returns merge variables + raw API data |
| `GET /health` | Health check (returns "OK") |

## Configuration

In `wrangler.toml`:
- `SEASON_START_FALLBACK` - Fallback Eastern date/time for season start if the official schedule does not expose a next race
