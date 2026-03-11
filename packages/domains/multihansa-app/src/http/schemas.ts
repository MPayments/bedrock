import { z } from "zod";

export const DeletedResponseSchema = z.object({
  deleted: z.literal(true),
});

export const IdParamSchema = z.object({
  id: z.uuid(),
});
