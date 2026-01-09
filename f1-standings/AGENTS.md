# F1 Standings - TRMNL Plugin

A Cloudflare Worker that provides F1 driver championship standings for TRMNL e-ink displays.

See [../agents.md](../agents.md) for shared TRMNL documentation and setup instructions.

## Overview

This plugin fetches data from [f1api.dev](https://f1api.dev) and returns the current/latest driver championship standings.

### Features
- Championship leader with full details
- Top 3 podium positions with gaps
- Full top 10 standings

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Returns merge variables for TRMNL |
| `GET /api` | Returns merge variables + raw API data |
| `GET /health` | Health check (returns "OK") |
