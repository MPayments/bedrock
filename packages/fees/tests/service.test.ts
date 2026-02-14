import { describe, expect, it } from "vitest";
import { createFeesService } from "../src/service";

describe("createFeesService", () => {
    it("uses makePlanKey callback when provided to buildFeeTransferPlans", () => {
        const service = createFeesService({ db: {} as any });
        let callbackCalls = 0;

        const plans = service.buildFeeTransferPlans({
            components: [
                {
                    id: "manual-bank-fee",
                    kind: "bank_fee",
                    currency: "USD",
                    amountMinor: 10n,
                    source: "manual",
                    settlementMode: "in_ledger",
                    debitAccountKey: "Debit:Account",
                    creditAccountKey: "Credit:Account",
                },
            ],
            makePlanKey: (component, idx) => {
                callbackCalls++;
                return `custom:${idx}:${component.id}`;
            },
            resolvePosting: () => ({}),
        });

        expect(callbackCalls).toBe(1);
        expect(plans).toHaveLength(1);
        expect(plans[0]!.planKey).toBe("custom:1:manual-bank-fee");
    });
});
