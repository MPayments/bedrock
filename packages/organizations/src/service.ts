import { eq } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";

import { createOrganizationsServiceContext, type OrganizationsServiceDeps } from "./internal/context";
import { OrganizationNotFoundError } from "./errors";
import {
    CreateOrganizationInputSchema,
    UpdateOrganizationInputSchema,
    type CreateOrganizationInput,
    type UpdateOrganizationInput,
} from "./validation";

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
    const { db, log } = createOrganizationsServiceContext(deps);

    async function list() {
        return db.select().from(schema.organizations);
    }

    async function findById(id: string) {
        const [row] = await db
            .select()
            .from(schema.organizations)
            .where(eq(schema.organizations.id, id))
            .limit(1);

        return row ?? null;
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
            const existing = await findById(id);
            if (!existing) throw new OrganizationNotFoundError(id);
            return existing;
        }

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
        const existing = await findById(id);
        if (!existing) throw new OrganizationNotFoundError(id);

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
        delete: remove,
    };
}
