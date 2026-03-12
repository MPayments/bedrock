import { describe, expect, it } from "vitest";

import { CounterpartyGroupRuleError } from "../../src/counterparties/errors";
import {
    type GroupMembershipClassification,
    enforceCustomerLinkRules,
} from "../../src/counterparties/internal/group-rules";

function makeClassification(
    overrides: Partial<GroupMembershipClassification> = {},
): GroupMembershipClassification {
    return {
        rootsByGroupId: new Map(),
        customerScopeByGroupId: new Map(),
        hasTreasury: false,
        hasCustomers: false,
        customerScopedIds: new Set(),
        ...overrides,
    };
}

describe("enforceCustomerLinkRules", () => {
    it("allows counterparties without group memberships", () => {
        expect(() => enforceCustomerLinkRules(makeClassification(), null)).not.toThrow();
    });

    it("requires customerId for customer tree", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({ hasCustomers: true }),
                null,
            ),
        ).toThrow(CounterpartyGroupRuleError);
    });

    it("rejects customerId for treasury tree", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({ hasTreasury: true }),
                "550e8400-e29b-41d4-a716-446655440001",
            ),
        ).toThrow(CounterpartyGroupRuleError);
    });

    it("rejects memberships in both trees", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({
                    hasTreasury: true,
                    hasCustomers: true,
                }),
                "550e8400-e29b-41d4-a716-446655440001",
            ),
        ).toThrow(CounterpartyGroupRuleError);
    });

    it("rejects customerId mismatch with scoped customer groups", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({
                    hasCustomers: true,
                    customerScopedIds: new Set(["550e8400-e29b-41d4-a716-446655440002"]),
                }),
                "550e8400-e29b-41d4-a716-446655440001",
            ),
        ).toThrow(CounterpartyGroupRuleError);
    });
});
