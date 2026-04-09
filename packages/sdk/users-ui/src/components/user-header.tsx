"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Users } from "lucide-react";

import { Separator } from "@bedrock/sdk-ui/components/separator";

import { UserStatusBadge } from "./user-status-badge";

type UserHeaderProps = {
  name: string;
  email: string;
  banned: boolean | null;
  icon?: LucideIcon;
  actions?: ReactNode;
  showSeparator?: boolean;
};

export function UserHeader({
  name,
  email,
  banned,
  icon: Icon = Users,
  actions,
  showSeparator = true,
}: UserHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Icon className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">{name}</h3>
            <p className="text-muted-foreground hidden text-sm md:block">
              {email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserStatusBadge banned={banned} showActive={false} />
          {actions}
        </div>
      </div>
      {showSeparator && <Separator className="h-px w-full" />}
    </div>
  );
}
