"use client";

import Link from "next/link";

import { UserRowActions as BaseUserRowActions } from "@bedrock/sdk-users-ui/components/user-row-actions";

type UserRowActionModel = {
  id: string;
  name: string;
};

type UserRowActionsProps = {
  user: UserRowActionModel;
};

export function UserRowActions({ user }: UserRowActionsProps) {
  return (
    <BaseUserRowActions
      user={user}
      viewLink={<Link href={`/users/${user.id}`} />}
    />
  );
}
