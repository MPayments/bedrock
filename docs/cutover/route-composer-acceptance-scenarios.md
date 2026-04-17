# Route Composer Acceptance Scenarios

These scenarios define the end-to-end behavior required before release.

The merge-time exception is limited to physical header storage on `deals.headerSnapshot + headerRevision`.
Runtime behavior still treats typed `DealHeader` as canonical, and accepted calculation remains the commercial freeze point.

## 1. Supplier payment with internal transfer and FX

1. Create a payment deal.
2. Bind customer, acting customer legal entity, internal organization, beneficiary counterparty, and payout requisites.
3. Apply or compose a route with collection, internal transfer, FX conversion, and payout legs.
4. Add mixed cost components: percentage liquidity cost, fixed wire fee, provider FX fee, and client markup.
5. Generate a calculation snapshot and accept it.
6. Materialize treasury execution.
7. Record actual fill, execution fee, and cash movement facts directly from the Finance execution workspace.
8. Reconcile external records.
9. Verify realized margin and variance.
10. Close the deal only after blockers clear.

## 2. Currency transit

1. Create a currency transit deal.
2. Build a route without payout conversion mismatch.
3. Verify route validation rejects broken currency semantics.
4. Accept the calculation and execute.
5. Confirm realized margin matches expected when actual facts align.

## 3. Currency exchange

1. Create a currency exchange deal.
2. Compose a direct or template-based FX route.
3. Accept a route-based calculation snapshot.
4. Optionally supersede the accepted calculation and accept a newer offered snapshot.
5. Record actual fill and provider fee.
6. Verify realized P&L by leg and by cost family.

## 4. Exporter settlement

1. Create an exporter settlement deal.
2. Bind exporter and settlement counterparties as external entities.
3. Ensure customer legal entities are selected only from counterparties linked to the customer.
4. Execute and reconcile the settlement route.
5. Verify close blockers clear only when required documents and reconciliation are complete.

## 5. Sub-agent commission case

1. Create a deal with an external sub-agent.
2. Select the sub-agent via `counterparty + sub_agent_profile`.
3. Add commission as a route cost component.
4. Verify expected net margin includes the commission expense.
5. Record actual fee and verify expected-vs-actual variance handling.

## 6. Mixed fixed and percentage cost lines

1. Create a route with both fixed and percentage cost components.
2. Generate a calculation snapshot.
3. Verify component inputs, basis, and outputs are preserved line-by-line.
4. Confirm effective rate and net margin are reproducible from snapshot data alone.

## 7. Reconciliation exception blocks close

1. Execute a deal and ingest external records with a mismatch.
2. Verify reconciliation raises a blocking exception.
3. Verify deal close fails while the exception is unresolved.
4. Resolve or explain the variance and confirm close succeeds only afterward.

## 8. Lookup semantics for route composer

1. Search participants by name prefix.
2. Filter by participant kind.
3. Verify organizations returned by the lookup are internal-only.
4. Verify customer legal entities come from `counterparties` linked to the customer.
5. Verify sub-agents are returned only when a `sub_agent_profile` exists.

## Release gate

The feature is not done until a finance operator can create, route, price, accept or supersede the current calculation, execute, record manual normalized actuals, reconcile, and close a deal without any dependency on the old application-based flow.
