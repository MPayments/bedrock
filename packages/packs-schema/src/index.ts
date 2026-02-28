import { z } from "zod";

const literalBindingSchema = z.object({
  kind: z.literal("literal"),
  value: z.string().min(1),
});

const dimensionBindingSchema = z.object({
  kind: z.literal("dimension"),
  key: z.string().min(1),
});

const refBindingSchema = z.object({
  kind: z.literal("ref"),
  key: z.string().min(1),
});

const bookRefBindingSchema = z.object({
  kind: z.literal("bookRef"),
  key: z.string().min(1),
});

export const ValueBindingSchema = z.discriminatedUnion("kind", [
  literalBindingSchema,
  dimensionBindingSchema,
  refBindingSchema,
  bookRefBindingSchema,
]);

export const AccountSideTemplateDefinitionSchema = z.object({
  accountNo: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/),
  dimensions: z.record(z.string(), ValueBindingSchema),
});

export const CreatePostingTemplateDefinitionSchema = z.object({
  key: z.string().min(1),
  lineType: z.literal("create"),
  postingCode: z.string().min(1).max(128),
  transferCode: z.number().int().nonnegative().optional(),
  allowModules: z.array(z.string().min(1)).min(1),
  requiredBookRefs: z.array(z.string().min(1)).min(1),
  requiredDimensions: z.array(z.string().min(1)),
  requiredRefs: z.array(z.string().min(1)).optional(),
  pendingMode: z.enum(["allowed", "required", "forbidden"]).optional(),
  debit: AccountSideTemplateDefinitionSchema,
  credit: AccountSideTemplateDefinitionSchema,
});

export const PendingPostingTemplateDefinitionSchema = z.object({
  key: z.string().min(1),
  lineType: z.enum(["post_pending", "void_pending"]),
  allowModules: z.array(z.string().min(1)).min(1),
  requiredBookRefs: z.array(z.string().min(1)).min(1),
  requiredDimensions: z.array(z.string().min(1)),
  requiredRefs: z.array(z.string().min(1)).optional(),
});

export const RawPostingTemplateDefinitionSchema = z.discriminatedUnion(
  "lineType",
  [
    CreatePostingTemplateDefinitionSchema,
    PendingPostingTemplateDefinitionSchema,
  ],
);

export const AccountingPackDefinitionSchema = z.object({
  packKey: z.string().min(1),
  version: z.number().int().positive(),
  templates: z.array(RawPostingTemplateDefinitionSchema),
});

export type ValueBinding = z.infer<typeof ValueBindingSchema>;
export type AccountSideTemplateDefinition = z.infer<
  typeof AccountSideTemplateDefinitionSchema
>;
export type CreatePostingTemplateDefinition = z.infer<
  typeof CreatePostingTemplateDefinitionSchema
>;
export type PendingPostingTemplateDefinition = z.infer<
  typeof PendingPostingTemplateDefinitionSchema
>;
export type RawPostingTemplateDefinition = z.infer<
  typeof RawPostingTemplateDefinitionSchema
>;
export type AccountingPackDefinition = z.infer<
  typeof AccountingPackDefinitionSchema
>;
