import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, openAPI as openApiPlugin } from "better-auth/plugins";

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
        openApiPlugin(),
        adminPlugin({
            ac,
            admin,
            user,
        }),
    ],
});

export default auth;

export type { ResourcePermissions } from "./permissions";
