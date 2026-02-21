import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import {
    type PaginatedList,
    resolveSortOrder,
    resolveSortValue,
} from "@bedrock/kernel/pagination";

import { OrganizationNotFoundError } from "./errors";
import { createOrganizationsServiceContext, type OrganizationsServiceDeps } from "./internal/context";
import {
    ListOrganizationsQuerySchema,
    CreateOrganizationInputSchema,
    UpdateOrganizationInputSchema,
    type ListOrganizationsQuery,
    type CreateOrganizationInput,
    type UpdateOrganizationInput,
    type Organization,
} from "./validation";

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;

const SORT_COLUMN_MAP = {
    name: schema.organizations.name,
    country: schema.organizations.country,
    baseCurrency: schema.organizations.baseCurrency,
    createdAt: schema.organizations.createdAt,
    updatedAt: schema.organizations.updatedAt,
} as const;

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
    const { db, log } = createOrganizationsServiceContext(deps);

    async function list(input?: ListOrganizationsQuery): Promise<PaginatedList<Organization>> {
        const query = ListOrganizationsQuerySchema.parse(input ?? {});
        const { limit, offset, sortBy, sortOrder, name, country, baseCurrency, isTreasury } = query;

        const conditions: SQL[] = [];
        if (name) conditions.push(ilike(schema.organizations.name, `%${name}%`));
        if (country) conditions.push(ilike(schema.organizations.country, `%${country}%`));
        if (baseCurrency?.length) {
            conditions.push(inArray(schema.organizations.baseCurrency, baseCurrency));
        }
        if (isTreasury !== undefined) conditions.push(eq(schema.organizations.isTreasury, isTreasury));

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
        const orderByCol = resolveSortValue(
            sortBy,
            SORT_COLUMN_MAP,
            schema.organizations.createdAt,
        );
        const orderByClause = orderByFn(orderByCol);

        const [data, countRows] = await Promise.all([
            db.select()
                .from(schema.organizations)
                .where(where)
                .orderBy(orderByClause)
                .limit(limit)
                .offset(offset),
            db.select({ total: sql<number>`count(*)::int` })
                .from(schema.organizations)
                .where(where),
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
