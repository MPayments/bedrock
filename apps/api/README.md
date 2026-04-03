# API

## Run

```bash
bun run --cwd apps/api dev
```

API default URL: `http://localhost:3000`

## Better Auth env

Set these in your root `.env` (or process env):

- `BETTER_AUTH_SECRET` - required in production
- `BETTER_AUTH_URL` - API origin (default: `http://localhost:3000`)
- `BETTER_AUTH_TRUSTED_ORIGINS` - comma-separated front-end origins (default: `http://localhost:3001,http://localhost:3002,http://localhost:3003`)

Auth handler path: `GET|POST /api/auth/*`
