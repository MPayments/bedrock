# Workers Runtime

## Worker Block Policies

Per-item guard outcomes are intentionally worker-specific:

| Worker ID | Policy |
| --- | --- |
| `ledger` | `release` |
| `treasury-rates` | `skip` |
| `documents` | `skip` |
| `balances` | `stop_batch` |

`reconciliation` currently remains dormant and is intentionally excluded from the active worker fleet.
