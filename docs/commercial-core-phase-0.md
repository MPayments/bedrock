# Commercial Core Phase 0

This note is historical context for the pre-route-composer characterization phase.
It does not describe the current supported runtime after the route-composer cutover.

- Deal status transitions were still enforced by a static status map only. They did not yet validate quote acceptance, document readiness, funding readiness, or reconciliation state.
- The legacy deal create and legacy intake patch surfaces were still supported at that point. Those surfaces were removed during the route-composer cutover.
- Agreements still modeled customer, organization, organization requisite binding, contract metadata, and fee rules only. Corridor policy, capability policy, routing policy, and quote TTL were not modeled in Phase 0.
- Calculations still persisted their own snapshot and line model even when the source rate came from a treasury FX quote. That split was intentionally preserved and characterized before the later route-based pricing work.
- Non-payment deal planning already existed in the write model, but Phase 0 only documented behavior; it did not tighten business enforcement.

For the current release gate and acceptance suite, use `docs/cutover/route-composer-release-gate.md`.
