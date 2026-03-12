"use client";

import Link from "next/link";
import { Eye, MoreHorizontal } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/ui/components/dropdown-menu";

type UserRowActionModel = {
  id: string;
  name: string;
};

type UserRowActionsProps = {
  user: UserRowActionModel;
};

export function UserRowActions({ user }: UserRowActionsProps) {
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
          <DropdownMenuItem render={<Link href={`/users/${user.id}`} />}>
            <Eye size={16} />
            Открыть
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
