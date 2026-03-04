# Workers Runtime

## Worker Block Policies

Per-item guard outcomes are intentionally worker-specific:

| Worker ID | Policy |
| --- | --- |
| `ledger` | `release` |
| `fx-rates` | `skip` |
| `documents` | `skip` |
| `reconciliation` | `skip` |
| `balances` | `stop_batch` |
