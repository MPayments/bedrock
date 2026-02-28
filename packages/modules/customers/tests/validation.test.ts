import { describe, expect, it } from "vitest";

import {
    CreateCustomerInputSchema,
    ListCustomersQuerySchema,
    UpdateCustomerInputSchema,
} from "../src/validation";

describe("customers validation", () => {
    it("parses create customer input", () => {
        const parsed = CreateCustomerInputSchema.parse({
            displayName: "Acme Corp",
            externalRef: "crm-123",
            description: "VIP customer",
        });

        expect(parsed.displayName).toBe("Acme Corp");
        expect(parsed.externalRef).toBe("crm-123");
        expect(parsed.description).toBe("VIP customer");
    });

    it("parses update customer input with nullable externalRef", () => {
        const parsed = UpdateCustomerInputSchema.parse({
            displayName: "Acme Updated",
            externalRef: null,
            description: null,
        });

        expect(parsed.displayName).toBe("Acme Updated");
        expect(parsed.externalRef).toBeNull();
        expect(parsed.description).toBeNull();
    });

    it("parses list query with pagination and filters", () => {
        const parsed = ListCustomersQuerySchema.parse({
            limit: 20,
            offset: 0,
            sortBy: "displayName",
            sortOrder: "asc",
            displayName: "Acme",
            externalRef: "crm",
        });

        expect(parsed.limit).toBe(20);
        expect(parsed.sortBy).toBe("displayName");
        expect(parsed.sortOrder).toBe("asc");
        expect(parsed.displayName).toBe("Acme");
        expect(parsed.externalRef).toBe("crm");
    });
});
