import { Users } from "lucide-react";

import { Separator } from "@bedrock/ui/components/separator";

import { getUserById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";
import { UserStatusBadge } from "../components/user-status-badge";

export default async function UserLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { entity: user } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getUserById,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Users className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">{user.name}</h3>
            <p className="text-muted-foreground hidden text-sm md:block">
              {user.email}
            </p>
          </div>
        </div>
        <UserStatusBadge banned={user.banned} showActive={false} />
      </div>
      <Separator className="h-px w-full" />
      {children}
    </div>
  );
}
