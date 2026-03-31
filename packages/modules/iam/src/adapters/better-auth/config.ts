import {
  account,
  session,
  twoFactor,
  user,
  verification,
} from "../drizzle/schema/auth-schema";

export const betterAuthSessionAdditionalFields = {
  audience: {
    type: "string",
    input: false,
  },
} as const;

export const betterAuthSchema = {
  account,
  session,
  twoFactor,
  user,
  verification,
};
