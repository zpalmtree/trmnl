# F1 Results - TRMNL Plugin

A Cloudflare Worker that provides the latest F1 race results for TRMNL e-ink displays.

See [../agents.md](../agents.md) for shared TRMNL documentation and setup instructions.

## Overview

This plugin fetches data from [f1api.dev](https://f1api.dev) and returns the most recent race results.

### Features
- Race winner with time and starting grid
- Full podium (P1, P2, P3) with gaps
- Top 10 finishers
- Fastest lap info

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Returns merge variables for TRMNL |
| `GET /api` | Returns merge variables + raw API data |
| `GET /health` | Health check (returns "OK") |
