# Workers Runtime

## Worker Block Policies

Per-item guard outcomes are intentionally worker-specific:

| Worker ID | Policy |
| --- | --- |
| `ledger` | `release` |
| `connectors-dispatch` | `requeue` |
| `connectors-poller` | `skip` |
| `connectors-statements` | `skip` |
| `orchestration-retry` | `skip` |
| `fx-rates` | `skip` |
| `documents` | `skip` |
| `reconciliation` | `skip` |
| `balances` | `stop_batch` |
