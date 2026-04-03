# Commercial Core Phase 0

This note records the behaviors intentionally preserved while Phase 0 adds characterization coverage around the commercial core.

- Deal status transitions are still enforced by a static status map only. They do not yet validate quote acceptance, document readiness, funding readiness, or reconciliation state.
- The legacy deal create and legacy intake patch surfaces are still supported and are mapped into the typed intake snapshot internally.
- Agreements still model customer, organization, organization requisite binding, contract metadata, and fee rules only. Corridor policy, capability policy, routing policy, and quote TTL are not modeled yet.
- Calculations still persist their own snapshot and line model even when the source rate comes from a treasury FX quote. That split is preserved for now and covered explicitly by tests.
- Non-payment deal planning exists in the write model, but Phase 0 is only documenting current behavior. It is not tightening business enforcement yet.
