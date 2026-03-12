import { z } from "zod";

export const OptionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const OptionsListResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
  });
