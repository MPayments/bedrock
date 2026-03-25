import { z } from "zod";

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const CreateOrganizationInputSchema = z.object({
  name: z.string().nullable().optional(),
  nameI18n: LocalizedTextSchema,
  orgType: z.string().nullable().optional(),
  orgTypeI18n: LocalizedTextSchema,
  country: z.string().nullable().optional(),
  countryI18n: LocalizedTextSchema,
  city: z.string().nullable().optional(),
  cityI18n: LocalizedTextSchema,
  address: z.string().nullable().optional(),
  addressI18n: LocalizedTextSchema,
  inn: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  kpp: z.string().nullable().optional(),
  ogrn: z.string().nullable().optional(),
  oktmo: z.string().nullable().optional(),
  okpo: z.string().nullable().optional(),
  directorName: z.string().nullable().optional(),
  directorNameI18n: LocalizedTextSchema,
  directorPosition: z.string().nullable().optional(),
  directorPositionI18n: LocalizedTextSchema,
  directorBasis: z.string().nullable().optional(),
  directorBasisI18n: LocalizedTextSchema,
  signatureKey: z.string().nullable().optional(),
  sealKey: z.string().nullable().optional(),
});

export type CreateOrganizationInput = z.infer<
  typeof CreateOrganizationInputSchema
>;

export const UpdateOrganizationInputSchema =
  CreateOrganizationInputSchema.partial().extend({
    id: z.number().int(),
  });

export type UpdateOrganizationInput = z.infer<
  typeof UpdateOrganizationInputSchema
>;
