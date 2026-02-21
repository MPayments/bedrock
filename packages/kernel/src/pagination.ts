import { z } from "zod";

export const PaginationInputSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationInput = z.infer<typeof PaginationInputSchema>;

export const SortInputSchema = z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc").optional(),
});

export type SortInput = z.infer<typeof SortInputSchema>;
export type SortOrder = NonNullable<SortInput["sortOrder"]>;

export type ListFilterCardinality = "single" | "multi";

interface ListFilterContractBase {
    cardinality: ListFilterCardinality;
}

interface ListStringFilterContract extends ListFilterContractBase {
    kind: "string";
    enumValues?: readonly [string, ...string[]];
}

interface ListNumberFilterContract extends ListFilterContractBase {
    kind: "number";
    int?: boolean;
    min?: number;
    max?: number;
}

interface ListBooleanFilterContract extends ListFilterContractBase {
    kind: "boolean";
}

export type ListFilterContract =
    | ListStringFilterContract
    | ListNumberFilterContract
    | ListBooleanFilterContract;

type EnsureListFilters<TFilters extends object> = {
    [K in keyof TFilters]: TFilters[K] extends ListFilterContract
        ? TFilters[K]
        : never;
};

export type ListFiltersContract<
    TFilters extends object = Record<string, ListFilterContract>,
> = EnsureListFilters<TFilters>;

export interface ListSortConfig<TSortBy extends string> {
    id: TSortBy;
    desc: boolean;
}

export interface ListQueryContract<
    TSortableColumns extends readonly [string, ...string[]],
    TFilters extends object,
> {
    sortableColumns: TSortableColumns;
    defaultSort: ListSortConfig<TSortableColumns[number]>;
    filters: ListFiltersContract<TFilters>;
}

export interface PaginatedList<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
}

export function createPaginatedListSchema<T extends z.ZodType>(itemSchema: T) {
    return z.object({
        data: z.array(itemSchema),
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
    });
}

type SortableValue = string | number | bigint | boolean | Date | null | undefined;

function createFilterValueSchema(filter: ListFilterContract) {
    if (filter.kind === "string") {
        if (filter.enumValues) {
            return z.enum(filter.enumValues);
        }
        return z.string();
    }

    if (filter.kind === "number") {
        let schema = z.coerce.number();
        if (filter.int) schema = schema.int();
        if (filter.min !== undefined) schema = schema.min(filter.min);
        if (filter.max !== undefined) schema = schema.max(filter.max);
        return schema;
    }

    return z.coerce.boolean();
}

type FilterOutputValue<TFilter extends ListFilterContract> =
    TFilter extends { kind: "number" }
        ? number
        : TFilter extends { kind: "boolean" }
            ? boolean
            : string;

type FilterSchema<TFilter extends ListFilterContract> =
    TFilter extends { cardinality: "multi" }
        ? z.ZodOptional<z.ZodArray<z.ZodType<FilterOutputValue<TFilter>>>>
        : z.ZodOptional<z.ZodType<FilterOutputValue<TFilter>>>;

type FiltersShape<TFilters extends object> = {
    [K in keyof TFilters]: TFilters[K] extends ListFilterContract
        ? FilterSchema<TFilters[K]>
        : never;
};

function createFilterSchema<TFilter extends ListFilterContract>(
    filter: TFilter,
): FilterSchema<TFilter> {
    const valueSchema = createFilterValueSchema(filter);

    if (filter.cardinality === "multi") {
        return z.preprocess(
            (value) => {
                if (value === undefined || value === null || value === "") {
                    return undefined;
                }

                const rawValues = Array.isArray(value) ? value : [value];
                return rawValues
                    .flatMap((item) => {
                        if (typeof item !== "string") {
                            return item;
                        }

                        return item
                            .split(",")
                            .map((part) => part.trim())
                            .filter((part) => part.length > 0);
                    });
            },
            z.array(valueSchema).optional(),
        ) as unknown as FilterSchema<TFilter>;
    }

    return valueSchema.optional() as unknown as FilterSchema<TFilter>;
}

export function createListQuerySchemaFromContract<
    TSortableColumns extends readonly [string, ...string[]],
    TFilters extends object,
>(contract: ListQueryContract<TSortableColumns, TFilters>) {
    const filtersShape = {} as FiltersShape<TFilters>;

    for (const key of Object.keys(contract.filters) as (keyof TFilters)[]) {
        const filter = contract.filters[key];
        filtersShape[key] = createFilterSchema(filter) as FiltersShape<TFilters>[typeof key];
    }

    return PaginationInputSchema.extend({
        sortBy: z.enum(contract.sortableColumns).default(contract.defaultSort.id),
        sortOrder: z
            .enum(["asc", "desc"])
            .default(contract.defaultSort.desc ? "desc" : "asc"),
        ...filtersShape,
    });
}

export function resolveSortOrder(sortOrder?: SortInput["sortOrder"]): SortOrder {
    return sortOrder === "desc" ? "desc" : "asc";
}

export function resolveSortValue<TSortBy extends string, TValue>(
    sortBy: TSortBy | undefined,
    sortMap: Record<TSortBy, TValue>,
    fallback: TValue,
): TValue {
    if (!sortBy) return fallback;
    return sortMap[sortBy];
}

function compareSortableValues(left: SortableValue, right: SortableValue) {
    if (left === right) return 0;

    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;

    if (left instanceof Date && right instanceof Date) {
        return left.getTime() - right.getTime();
    }

    if (typeof left === "number" && typeof right === "number") {
        return left - right;
    }

    if (typeof left === "bigint" && typeof right === "bigint") {
        return left > right ? 1 : -1;
    }

    if (typeof left === "boolean" && typeof right === "boolean") {
        return Number(left) - Number(right);
    }

    return String(left).localeCompare(String(right));
}

export function sortInMemory<TItem, TSortBy extends string>(
    rows: readonly TItem[],
    options: {
        sortBy?: TSortBy;
        sortOrder?: SortInput["sortOrder"];
        sortMap: Record<TSortBy, (item: TItem) => SortableValue>;
    },
): TItem[] {
    const { sortBy, sortMap } = options;
    if (!sortBy) return [...rows];

    const direction = resolveSortOrder(options.sortOrder);
    const getSortValue = sortMap[sortBy];

    return [...rows].sort((a, b) => {
        const compared = compareSortableValues(getSortValue(a), getSortValue(b));
        return direction === "desc" ? -compared : compared;
    });
}

export function paginateInMemory<TItem>(
    rows: readonly TItem[],
    pagination: Pick<PaginationInput, "limit" | "offset">,
): PaginatedList<TItem> {
    const { limit, offset } = pagination;

    return {
        data: rows.slice(offset, offset + limit),
        total: rows.length,
        limit,
        offset,
    };
}
