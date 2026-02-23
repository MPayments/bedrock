import { describe, expect, it } from "vitest";

import {
    CreateCounterpartyInputSchema,
    CreateCounterpartyGroupInputSchema,
    UpdateCounterpartyInputSchema,
} from "../src/validation";

describe("counterparties validation", () => {
    it("parses create counterparty input", () => {
        const parsed = CreateCounterpartyInputSchema.parse({
            shortName: "Acme",
            fullName: "Acme Incorporated",
            kind: "legal_entity",
            groupIds: [],
        });

        expect(parsed.shortName).toBe("Acme");
        expect(parsed.fullName).toBe("Acme Incorporated");
        expect(parsed.kind).toBe("legal_entity");
    });

    it("parses update counterparty input with nullable fields", () => {
        const parsed = UpdateCounterpartyInputSchema.parse({
            description: null,
            customerId: null,
        });

        expect(parsed.description).toBeNull();
        expect(parsed.customerId).toBeNull();
    });

    it("parses create counterparty group input", () => {
        const parsed = CreateCounterpartyGroupInputSchema.parse({
            code: "customer-vip",
            name: "Customer VIP",
            customerId: "550e8400-e29b-41d4-a716-446655440001",
        });

        expect(parsed.code).toBe("customer-vip");
        expect(parsed.customerId).toBe("550e8400-e29b-41d4-a716-446655440001");
    });
});
