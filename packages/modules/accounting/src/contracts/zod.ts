import { z } from "zod";

export const accountNoSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{4}$/, "accountNo must match NNNN");
