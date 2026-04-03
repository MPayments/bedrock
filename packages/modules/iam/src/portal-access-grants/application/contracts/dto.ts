import { z } from "zod";

import { PortalAccessGrantStatusSchema } from "./commands";

export const PortalAccessGrantSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  status: PortalAccessGrantStatusSchema,
  updatedAt: z.date(),
  userId: z.string(),
});

export type PortalAccessGrant = z.infer<typeof PortalAccessGrantSchema>;
