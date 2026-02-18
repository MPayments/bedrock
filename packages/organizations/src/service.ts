import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { PaginationInputSchema, type PaginationInput, type PaginatedList } from "@bedrock/kernel/pagination";

import { OrganizationNotFoundError } from "./errors";
import { createOrganizationsServiceContext, type OrganizationsServiceDeps } from "./internal/context";
import {
    CreateOrganizationInputSchema,
    UpdateOrganizationInputSchema,
    type CreateOrganizationInput,
    type UpdateOrganizationInput,
    type Organization,
} from "./validation";

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
    const { db, log } = createOrganizationsServiceContext(deps);

    async function list(pagination?: PaginationInput): Promise<PaginatedList<Organization>> {
        const { limit, offset } = PaginationInputSchema.parse(pagination ?? {});

        const [data, countRows] = await Promise.all([
            db.select().from(schema.organizations).limit(limit).offset(offset),
            db.select({ total: sql<number>`count(*)::int` }).from(schema.organizations),
        ]);

        return {
            data,
            total: countRows[0]!.total,
            limit,
            offset,
        };
    }

    async function findById(id: string) {
        const [row] = await db
            .select()
            .from(schema.organizations)
            .where(eq(schema.organizations.id, id))
            .limit(1);

        if (!row) throw new OrganizationNotFoundError(id);

        return row;
    }

    async function create(input: CreateOrganizationInput) {
        const validated = CreateOrganizationInputSchema.parse(input);

        const [created] = await db
            .insert(schema.organizations)
            .values({
                name: validated.name,
                country: validated.country ?? null,
                baseCurrency: validated.baseCurrency,
                externalId: validated.externalId ?? null,
                isTreasury: validated.isTreasury,
                customerId: validated.customerId ?? null,
            })
            .returning();

        log?.info("Organization created", { id: created!.id, name: validated.name });
        return created!;
    }

    async function update(id: string, input: UpdateOrganizationInput) {
        const validated = UpdateOrganizationInputSchema.parse(input);

        const fields: Record<string, unknown> = {};
        if (validated.name !== undefined) fields.name = validated.name;
        if (validated.country !== undefined) fields.country = validated.country;
        if (validated.baseCurrency !== undefined) fields.baseCurrency = validated.baseCurrency;
        if (validated.externalId !== undefined) fields.externalId = validated.externalId;

        if (Object.keys(fields).length === 0) {
            return findById(id);
        }

        fields.updatedAt = sql`now()`;

        const [updated] = await db
            .update(schema.organizations)
            .set(fields)
            .where(eq(schema.organizations.id, id))
            .returning();

        if (!updated) throw new OrganizationNotFoundError(id);

        log?.info("Organization updated", { id });
        return updated;
    }

    async function remove(id: string) {
        await findById(id);

        await db
            .delete(schema.organizations)
            .where(eq(schema.organizations.id, id));

        log?.info("Organization deleted", { id });
    }

    return {
        list,
        findById,
        create,
        update,
        remove,
    };
}
