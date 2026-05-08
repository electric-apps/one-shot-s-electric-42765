# Real-Time Todo App

A persistent todo app synced in real time across browser tabs using Electric SQL.

## Features

- Add, toggle, and delete todos
- Changes persist to Postgres instantly
- All open tabs sync in real time via Electric SQL shapes

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `ELECTRIC_URL` | Electric service URL (default: `http://localhost:3000`) |
| `ELECTRIC_SOURCE_ID` | Electric Cloud source ID (if using Electric Cloud) |
| `ELECTRIC_SECRET` | Electric Cloud auth secret (if using Electric Cloud) |

## Dev Setup

```bash
pnpm install
pnpm exec drizzle-kit migrate
pnpm dev
```

Open `http://localhost:5174` in multiple tabs to see real-time sync in action.
