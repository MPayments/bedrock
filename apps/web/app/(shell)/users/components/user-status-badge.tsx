"use client";

import { Badge } from "@bedrock/ui/components/badge";

type UserStatusBadgeProps = {
  banned: boolean | null;
};

export function UserStatusBadge({ banned }: UserStatusBadgeProps) {
  if (banned) {
    return <Badge variant="destructive">Заблокирован</Badge>;
  }

  return <Badge variant="outline">Активен</Badge>;
}
