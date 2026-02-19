import z from "zod";

export const CurrencySchema = z.object({
    id: z.uuid(),
    name: z.string(),
    code: z.string(),
    symbol: z.string(),
    precision: z.number().int().positive(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type Currency = z.infer<typeof CurrencySchema>;

export const CreateCurrencyInputSchema = z.object({
    name: z.string().min(1, "name is required"),
    code: z.string().min(1, "code is required").transform((value) => value.trim().toUpperCase()),
    symbol: z.string().min(1, "symbol is required"),
    precision: z.number().min(1, "precision is required"),
})

export type CreateCurrencyInput = z.infer<typeof CreateCurrencyInputSchema>;

export const UpdateCurrencyInputSchema = z.object({
    name: z.string().optional(),
    code: z.string().transform((value) => value.trim().toUpperCase()).optional(),
    symbol: z.string().optional(),
    precision: z.number().optional(),
});

export type UpdateCurrencyInput = z.infer<typeof UpdateCurrencyInputSchema>;
