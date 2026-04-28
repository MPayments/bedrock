# CLAUDE.md Refresh History

Append-only changelog of updates to `/CLAUDE.md`. Each entry records what was changed, what was verified unchanged, and what was flagged for human review. Written by the pre-PR researcher (`Explore` sub-agent) and by the scheduled refresh agent. Do not edit past entries — correct mistakes with a new entry referencing the earlier one.

Entry format:

```
## <YYYY-MM-DD> — <short title> (baseline: <sha>, trigger: pre-pr-researcher | scheduled-refresh | manual)

### Changed
- <fact>: <old> -> <new>  (evidence: <command or path>)

### Verified unchanged
- <fact> (evidence: <command or path>)

### Flagged (not changed)
- <observation that needs human decision>
```

---

## 2026-04-24 — initial sync and protocol bootstrap (baseline: d2b95746, trigger: manual)

First pass after introducing the refresh protocol. Baseline is `d2b95746` (`feat(customers): redesign counterparty pages with bilingual UI and detail headers`), the tip of the branch at the moment of bootstrapping.

### Changed

- **Workspace Topology — module count**: `packages/modules/ — 13 bounded-context business packages` -> `packages/modules/ — 20 bounded-context business packages`. Actual modules (`ls packages/modules/`): accounting, agreements, balances, calculations, currencies, deals, documents, fees, files, fx, iam, ledger, operations, organizations, parties, reconciliation, requisite-providers, requisites, treasury, users. Example tail broadened to include `@bedrock/deals` and `@bedrock/agreements`.
- **CRM Domain — workflows list**: previously listed only `customer-portal, deal-commission, document-generation`. Rewritten to reference `packages/workflows/` as the canonical location with a broader sample of CRM-adjacent flows (adds `document-drafts`, `document-posting`, `reconciliation-adjustments`). Actual workflows count: 12 (`ls packages/workflows/`).
- **CRM Domain — `@bedrock/iam` location**: noted explicitly that it lives under `packages/modules/iam`. Previously read as a loose "Supporting" item which obscured the fact that it is a first-class module.
- **CRM Domain — removed `See CRM_ARCHITECTURE.md`**: `CRM_ARCHITECTURE.md` no longer exists anywhere in the repo (`find . -maxdepth 5 -name CRM_ARCHITECTURE.md` returns nothing). The CRM section in CLAUDE.md is now self-sufficient.
- **Documentation Source of Truth — removed `CRM_ARCHITECTURE.md`**: same reason as above.
- **Documentation Source of Truth — removed `MERGE.md`**: file no longer exists (`find . -maxdepth 5 -name MERGE.md` returns nothing). MPayments merge is complete; the doc appears to have been archived.
- **Documentation Source of Truth — expanded ADR line**: now enumerates ADRs 0001, 0002, 0003 instead of "especially ADR 0001". Actual ADRs: `0001-bounded-context-explicit-architecture.md`, `0002-requisites-topology.md`, `0003-route-driven-deal-execution.md`.
- **Documentation Source of Truth — added `docs/deploy.md`, `docs/cutover/`, `docs/bugs/`, `docs/test-cases/`**: these exist in the repo but were not surfaced as canonical references.
- **Documentation Source of Truth — added `docs/history/claude-md.md`**: this file itself, introduced by the bootstrap.
- **Commands / Database — `docker compose -f infra/docker-compose.dev.yml up -d`** replaced with `bun run infra:up`. The script (`.scripts["infra:up"]` in root `package.json`) is literally `docker compose -f infra/docker-compose.dev.yml up -d`; using it is the preferred entry point.
- **New `## CLAUDE.md Refresh Protocol` section**: introduces pre-PR researcher flow, scheduled-refresh backstop, allowed/forbidden scope, logging rules, and the `<!-- last-synced: <sha> -->` marker. Placed between `## Workflow & Verification` and `## Architecture`.

### Verified unchanged

- **Ports**: `api` 3000 (via `PORT` env in `apps/api/src/index.ts`), `finance` 3001, `crm` 3002, `portal` 3003 — confirmed from each app's `dev` script.
- **Unit test project count**: 26 entries in `vitest.config.ts` `projects: [...]`.
- **Apps list in Workspace Topology**: `apps/api`, `apps/crm`, `apps/finance`, `apps/portal`, `apps/workers`, `apps/db` — all present and correct.
- **Dependency direction, Internal Package Layers table, Service Pattern, Key Conventions, ESLint Layer Enforcement, API Routes** — no structural change; policy not touched per scope rules.
- **`packages/shared` subpaths** listed in topology (`/core`, `/money`, `/reference-data`, `/parties`, `/requisites`) match `exports` in `packages/shared/package.json`.
- **Migration policy** statement (`db:nuke -> db:migrate -> db:seed:all`, baseline-only hard cutover) — still accurate for local reset.

### Flagged (not changed)

- **`apps/web` exists on disk** with only generated artifacts (`.next/`, `.turbo/`, `node_modules/`, `app/`) and zero tracked files (`git ls-files apps/web` is empty). Stale leftover from a deleted or never-tracked app. Not a drift against CLAUDE.md — flagging for a manual `rm -rf apps/web` or explicit `.gitignore` entry.
- **Top-level `redesign.md` and `summorize.md`** sit in the repo root. Not referenced anywhere in CLAUDE.md. Could be intentional working docs or scratch files. Not promoted to `Documentation Source of Truth` without a human decision.
- **Root `package.json` scripts not yet reflected in CLAUDE.md**: per-app `dev:api | dev:crm | dev:finance | dev:portal | dev:workers` shortcuts, `dev:all`, `test:e2e:deal-payment*`, `deal-payment:explore / reset-db / start-stack`, `db:bootstrap:accounting`, numerous `db:seed:*` helpers, `pack:activate / compile / validate`, `check:architecture / cycles / graph / hotspots / manifests / workspace-deps`. Adding all of these would bloat the Commands block. Left as-is pending a human decision on which are worth surfacing.
- **`packages/plugins/`** contains `documents-commercial`, `documents-ifrs`, `documents-sdk`. CLAUDE.md describes the folder as "Document plugin extensions", which is accurate; not adding the sub-list to keep the topology block terse.
- **`packages/sdk/`** contains 8 sub-packages (`api-client`, plus several `*-ui` bundles). CLAUDE.md says "API client and UI components" — qualitatively accurate. Left as-is.

### Next baseline

After this refresh is committed, the `<!-- last-synced: <sha> -->` marker at the end of CLAUDE.md will be set to the sha of the commit that applies these changes. The next pre-PR researcher or scheduled agent should diff from that sha forward.
