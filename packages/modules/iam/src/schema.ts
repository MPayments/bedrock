import {
  account,
  accountRelations,
  session,
  sessionRelations,
  twoFactor,
  twoFactorRelations,
  user,
  userRelations,
  verification,
} from "./adapters/drizzle/auth-schema";
import { customerMemberships } from "./customer-memberships/adapters/drizzle/schema";

export {
  account,
  accountRelations,
  customerMemberships,
  session,
  sessionRelations,
  twoFactor,
  twoFactorRelations,
  user,
  userRelations,
  verification,
};

export const schema = {
  user,
  account,
  session,
  verification,
  twoFactor,
  userRelations,
  sessionRelations,
  accountRelations,
  twoFactorRelations,
  customerMemberships,
};
