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
} from "./adapters/drizzle/schema/auth-schema";
import {
  agentProfiles,
  agentProfilesRelations,
  userAccessStates,
  userAccessStatesRelations,
} from "./adapters/drizzle/schema/business-schema";
import { customerBootstrapClaims } from "./customer-bootstrap-claims/adapters/drizzle/schema";
import { customerMemberships } from "./customer-memberships/adapters/drizzle/schema";

export {
  account,
  accountRelations,
  agentProfiles,
  agentProfilesRelations,
  customerBootstrapClaims,
  customerMemberships,
  session,
  sessionRelations,
  twoFactor,
  twoFactorRelations,
  user,
  userAccessStates,
  userAccessStatesRelations,
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
  agentProfiles,
  agentProfilesRelations,
  userAccessStates,
  userAccessStatesRelations,
  customerBootstrapClaims,
  customerMemberships,
};
