# IndyCar Standings - TRMNL Plugin

A Cloudflare Worker that provides IndyCar driver championship standings for TRMNL e-ink displays.

See [../agents.md](../agents.md) for shared TRMNL documentation and setup instructions.

## Overview

This plugin fetches data from the official INDYCAR results API on [indycar.com](https://www.indycar.com) and returns the current/latest driver championship standings.

### Features
- Championship leader with full details
- Top 3 podium positions with gaps
- Top 10 standings with wins and poles

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Returns merge variables for TRMNL |
| `GET /api` | Returns merge variables + raw API data |
| `GET /health` | Health check (returns "OK") |
