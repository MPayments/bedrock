import { betterAuth } from "better-auth";
import { admin as adminPlugin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@bedrock/db";

import { ac, admin, user } from "./permissions";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL!,
    basePath: "/api/auth",
    trustedOrigins: [process.env.BETTER_AUTH_TRUSTED_ORIGINS!],
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    plugins: [
        adminPlugin({
            ac,
            admin,
            user,
        }),
    ],
});

export default auth;