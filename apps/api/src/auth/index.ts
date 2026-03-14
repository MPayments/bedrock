import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
    admin as adminPlugin,
    openAPI as openApiPlugin,
    twoFactor,
} from "better-auth/plugins";

import { ac, admin, user } from "./permissions";
import { db } from "../db/client";

const auth = betterAuth({
    appName: "Bedrock Finance",
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL!,
    basePath: "/api/auth",
    trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    trustedHeaders: ["cookie"],
    advanced: {
        crossSubDomainCookies: {
            enabled: true
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    plugins: [
        openApiPlugin(),
        adminPlugin({
            ac,
            roles: {
                admin,
                user,
            },
        }),
        twoFactor({
            issuer: "Bedrock Finance",
            skipVerificationOnEnable: false,
        }),
    ],
});

export default auth;

export type { ResourcePermissions } from "./permissions";
