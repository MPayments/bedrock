import { describe, expect, it } from "vitest";

import { CounterpartyGroupRuleError } from "../../src/errors";
import {
    type GroupMembershipClassification,
    enforceCustomerLinkRules,
} from "../../src/internal/group-rules";

function makeClassification(
    overrides: Partial<GroupMembershipClassification> = {},
): GroupMembershipClassification {
    return {
        customerScopeByGroupId: new Map(),
        customerScopedIds: new Set(),
        ...overrides,
    };
}

describe("enforceCustomerLinkRules", () => {
    it("allows counterparties without group memberships", () => {
        expect(() => enforceCustomerLinkRules(makeClassification(), null)).not.toThrow();
    });

    it("allows unscoped groups without customerId", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({
                    customerScopeByGroupId: new Map([["group-1", null]]),
                }),
                null,
            ),
        ).not.toThrow();
    });

    it("requires customerId for customer-scoped groups", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({
                    customerScopeByGroupId: new Map([
                        ["group-1", "550e8400-e29b-41d4-a716-446655440001"],
                    ]),
                    customerScopedIds: new Set([
                        "550e8400-e29b-41d4-a716-446655440001",
                    ]),
                }),
                null,
            ),
        ).toThrow(CounterpartyGroupRuleError);
    });

    it("allows matching customerId for customer-scoped groups", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({
                    customerScopeByGroupId: new Map([
                        ["group-1", "550e8400-e29b-41d4-a716-446655440001"],
                    ]),
                    customerScopedIds: new Set([
                        "550e8400-e29b-41d4-a716-446655440001",
                    ]),
                }),
                "550e8400-e29b-41d4-a716-446655440001",
            ),
        ).not.toThrow();
    });

    it("rejects customerId mismatch with scoped customer groups", () => {
        expect(() =>
            enforceCustomerLinkRules(
                makeClassification({
                    customerScopeByGroupId: new Map([
                        ["group-1", "550e8400-e29b-41d4-a716-446655440002"],
                    ]),
                    customerScopedIds: new Set([
                        "550e8400-e29b-41d4-a716-446655440002",
                    ]),
                }),
                "550e8400-e29b-41d4-a716-446655440001",
            ),
        ).toThrow(CounterpartyGroupRuleError);
    });
});
