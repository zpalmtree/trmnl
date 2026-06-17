# IndyCar Results - TRMNL Plugin

A Cloudflare Worker that provides the latest IndyCar race results for TRMNL e-ink displays.

See [../agents.md](../agents.md) for shared TRMNL documentation and setup instructions.

## Overview

This plugin fetches data from the official INDYCAR results API on [indycar.com](https://www.indycar.com) and returns the most recent race results.

### Features
- Race winner with time, team, and starting position
- Full podium (P1, P2, P3) with gaps
- Positions 4-17
- Fastest lap info

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Returns merge variables for TRMNL |
| `GET /api` | Returns merge variables + raw API data |
| `GET /health` | Health check (returns "OK") |
