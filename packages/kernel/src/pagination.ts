import { z } from "zod";

export const PaginationInputSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationInput = z.infer<typeof PaginationInputSchema>;

export type PaginatedList<T> = {
    data: T[];
    total: number;
    limit: number;
    offset: number;
};

export function createPaginatedListSchema<T extends z.ZodType>(itemSchema: T) {
    return z.object({
        data: z.array(itemSchema),
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
    });
}
