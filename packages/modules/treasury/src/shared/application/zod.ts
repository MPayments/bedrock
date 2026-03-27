import { z } from "zod";

export const uuidSchema = z.uuid();

export const nullableUuidSchema = z.union([z.uuid(), z.null()]);

export const minorAmountStringSchema = z
  .string()
  .regex(/^-?\d+$/, "amount must be an integer string in minor units");

export const positiveMinorAmountStringSchema = minorAmountStringSchema.refine(
  (value) => BigInt(value) > 0n,
  "amount must be positive",
);

export const jsonRecordSchema = z.record(z.string(), z.unknown());

export const optionalJsonRecordSchema = jsonRecordSchema.nullable().optional();

export const dateInputSchema = z.union([
  z.date(),
  z.iso.datetime().transform((value) => new Date(value)),
]);

export const optionalTextSchema = z.string().trim().max(1_000).nullable().optional();
