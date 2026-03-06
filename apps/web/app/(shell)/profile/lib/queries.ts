import { getServerApiClient } from "@/lib/api-client.server";

export interface ProfileDetails {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: string | null;
    twoFactorEnabled: boolean | null;
    createdAt: string;
    updatedAt: string;
    lastSessionAt: string | null;
    lastSessionIp: string | null;
}

export async function getMyProfile(): Promise<ProfileDetails> {
    const client = await getServerApiClient();
    const res = await client.v1.me.$get({}, { init: { cache: "no-store" } });

    if (!res.ok) {
        throw new Error("Failed to fetch profile");
    }

    return res.json() as Promise<ProfileDetails>;
}
