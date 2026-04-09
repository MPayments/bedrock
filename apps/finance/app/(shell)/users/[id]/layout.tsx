import { UserHeader } from "@bedrock/sdk-users-ui/components/user-header";

import { getUserById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

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
      <UserHeader
        name={user.name}
        email={user.email}
        banned={user.banned}
      />
      {children}
    </div>
  );
}
