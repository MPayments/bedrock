import { describe, expect, it, vi } from "vitest";
import {
    createStubDb,
    mockSelectReturns,
    mockInsertReturns,
    mockUpdateReturns,
    TEST_UUIDS,
    TEST_DATES,
} from "@bedrock/test-utils";
import { createOrganizationsService } from "../src/service";
import { OrganizationNotFoundError } from "../src/errors";

function makeOrg(overrides: Record<string, unknown> = {}) {
    return {
        id: TEST_UUIDS.ORG_1,
        externalId: null,
        customerId: TEST_UUIDS.CUSTOMER_1,
        name: "Acme Corp",
        country: "US",
        baseCurrency: "USD",
        isTreasury: false,
        createdAt: TEST_DATES.NOW,
        updatedAt: TEST_DATES.NOW,
        ...overrides,
    };
}

describe("createOrganizationsService", () => {
    describe("list", () => {
        it("returns all organizations", async () => {
            const db = createStubDb();
            const orgs = [makeOrg(), makeOrg({ id: TEST_UUIDS.ORG_2, name: "Beta Inc" })];
            db.select = vi.fn(() => ({
                from: vi.fn(async () => orgs),
            })) as any;

            const service = createOrganizationsService({ db });
            const result = await service.list();

            expect(result).toEqual(orgs);
        });
    });

    describe("findById", () => {
        it("returns organization when found", async () => {
            const db = createStubDb();
            const org = makeOrg();
            mockSelectReturns(db.select, [org]);

            const service = createOrganizationsService({ db });
            const result = await service.findById(TEST_UUIDS.ORG_1);

            expect(result).toEqual(org);
        });

        it("throws OrganizationNotFoundError when not found", async () => {
            const db = createStubDb();
            mockSelectReturns(db.select, []);

            const service = createOrganizationsService({ db });

            await expect(
                service.findById(TEST_UUIDS.ORG_1),
            ).rejects.toThrow(OrganizationNotFoundError);
        });
    });

    describe("create", () => {
        it("creates a non-treasury organization with customerId", async () => {
            const db = createStubDb();
            const created = makeOrg();
            mockInsertReturns(db.insert, [created]);

            const service = createOrganizationsService({ db });
            const result = await service.create({
                name: "Acme Corp",
                country: "US",
                baseCurrency: "USD",
                customerId: TEST_UUIDS.CUSTOMER_1,
            });

            expect(result).toEqual(created);
            expect(db.insert).toHaveBeenCalled();
        });

        it("creates a treasury organization without customerId", async () => {
            const db = createStubDb();
            const created = makeOrg({ isTreasury: true, customerId: null });
            mockInsertReturns(db.insert, [created]);

            const service = createOrganizationsService({ db });
            const result = await service.create({
                name: "Treasury Org",
                isTreasury: true,
            });

            expect(result).toEqual(created);
        });

        it("rejects non-treasury organization without customerId", async () => {
            const db = createStubDb();
            const service = createOrganizationsService({ db });

            await expect(
                service.create({ name: "Bad Org", isTreasury: false }),
            ).rejects.toThrow("customerId is required when isTreasury is false");
        });
    });

    describe("update", () => {
        it("updates organization fields", async () => {
            const db = createStubDb();
            const updated = makeOrg({ name: "Updated Corp" });
            mockUpdateReturns(db.update, [updated]);

            const service = createOrganizationsService({ db });
            const result = await service.update(TEST_UUIDS.ORG_1, { name: "Updated Corp" });

            expect(result).toEqual(updated);
            expect(db.update).toHaveBeenCalled();
        });

        it("throws OrganizationNotFoundError when not found", async () => {
            const db = createStubDb();
            mockUpdateReturns(db.update, []);

            const service = createOrganizationsService({ db });

            await expect(
                service.update(TEST_UUIDS.ORG_1, { name: "Updated Corp" }),
            ).rejects.toThrow(OrganizationNotFoundError);
        });

        it("returns existing org when no fields to update", async () => {
            const db = createStubDb();
            const org = makeOrg();
            mockSelectReturns(db.select, [org]);

            const service = createOrganizationsService({ db });
            const result = await service.update(TEST_UUIDS.ORG_1, {});

            expect(result).toEqual(org);
            expect(db.update).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("deletes an existing organization", async () => {
            const db = createStubDb();
            const org = makeOrg();
            mockSelectReturns(db.select, [org]);

            const service = createOrganizationsService({ db });
            await service.delete(TEST_UUIDS.ORG_1);

            expect(db.delete).toHaveBeenCalled();
        });

        it("throws OrganizationNotFoundError when not found", async () => {
            const db = createStubDb();
            mockSelectReturns(db.select, []);

            const service = createOrganizationsService({ db });

            await expect(
                service.delete(TEST_UUIDS.ORG_1),
            ).rejects.toThrow(OrganizationNotFoundError);
        });
    });
});
