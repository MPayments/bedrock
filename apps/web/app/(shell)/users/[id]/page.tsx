import { getUserById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";
import { UserGeneralForm } from "../components/user-general-form";
import { UserPasswordForm } from "../components/user-password-form";
import { UserBanControls } from "../components/user-ban-controls";

interface UserPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: UserPageProps) {
  const { entity: user } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getUserById,
  });

  return (
    <div className="flex flex-col gap-6">
      <UserGeneralForm user={user} />
      <div className="grid gap-6 md:grid-cols-2">
        <UserPasswordForm userId={user.id} />
        <UserBanControls user={user} />
      </div>
    </div>
  );
}
