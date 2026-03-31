import {
  CrmActivityResponseSchema,
  type CrmActivityResponse,
} from "@/lib/activity/contracts";
import { CRM_API_BASE_URL } from "@/lib/constants";

export async function getCrmActivity(limit = 10): Promise<CrmActivityResponse> {
  const response = await fetch(
    `${CRM_API_BASE_URL}/activity?limit=${limit}`,
    {
      cache: "no-store",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to load CRM activity: ${response.status}`);
  }

  const payload = await response.json();
  return CrmActivityResponseSchema.parse(payload);
}
