"use client";

import type { ReactElement, ReactNode } from "react";
import { Eye, MoreHorizontal } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";

type UserRowActionModel = {
  id: string;
  name: string;
};

type UserRowActionsProps = {
  user: UserRowActionModel;
  viewLink: ReactElement;
  extraItems?: ReactNode;
};

export function UserRowActions({
  user,
  viewLink,
  extraItems,
}: UserRowActionsProps) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              type="button"
              aria-label={`Действия для пользователя ${user.name}`}
            />
          }
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-34">
          <DropdownMenuItem render={viewLink}>
            <Eye size={16} />
            Открыть
          </DropdownMenuItem>
          {extraItems}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
