# Codex Local Actions

Use these repo commands in Codex Desktop `Settings -> Local environments` for the Bedrock payment deal flow:

- Start infra: `bun run infra:up`
- Reset DB: `bun run deal-payment:reset-db`
- Start app stack: `bun run deal-payment:start-stack`
- Run payment deal exploratory: `bun run deal-payment:explore`
- Run payment deal regression: `bun run test:e2e:deal-payment`

The repo owns the commands and artifacts; the current local Codex app did not expose a stable on-disk project-action config format to commit safely, so the shared part of the setup lives in these scripts, tests, and `.codex` assets.
