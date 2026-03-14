"use client";

import { Badge } from "@bedrock/sdk-ui/components/badge";

type UserStatusBadgeProps = {
  banned: boolean | null;
  showActive?: boolean;
};

export function UserStatusBadge({
  banned,
  showActive = true,
}: UserStatusBadgeProps) {
  if (banned) {
    return <Badge variant="destructive">Заблокирован</Badge>;
  }

  if (!showActive) {
    return null;
  }

  return <Badge variant="outline">Активен</Badge>;
}
