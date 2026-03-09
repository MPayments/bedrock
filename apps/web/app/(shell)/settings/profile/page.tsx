import { User } from "lucide-react";

import { Separator } from "@multihansa/ui/components/separator";

import { ProfileGeneralForm } from "../../profile/components/profile-general-form";
import { ProfilePasswordForm } from "../../profile/components/profile-password-form";
import { ProfileTwoFactorSection } from "../../profile/components/profile-two-factor-section";
import { getMyProfile } from "../../profile/lib/queries";

export default async function SettingsProfilePage() {
  const profile = await getMyProfile();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="bg-muted rounded-lg p-2.5">
          <User className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <h3 className="mb-1 text-xl font-semibold">{profile.name}</h3>
          <p className="text-muted-foreground hidden text-sm md:block">
            {profile.email}
          </p>
        </div>
      </div>
      <Separator className="h-px w-full" />
      <div className="flex flex-col gap-6">
        <ProfileGeneralForm profile={profile} />
        <div className="grid gap-6 md:grid-cols-2">
          <ProfilePasswordForm />
          <ProfileTwoFactorSection
            twoFactorEnabled={profile.twoFactorEnabled}
          />
        </div>
      </div>
    </div>
  );
}
