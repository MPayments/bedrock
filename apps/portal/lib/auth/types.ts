export type AppRole = "admin" | "agent" | "customer" | "finance" | null;

export type CustomerPortalCustomerSummary = {
  id: string;
  displayName: string;
  externalRef: string | null;
  description: string | null;
};

export type UserSessionSnapshot = {
  canAccessDashboard: boolean;
  customerPortalCustomers: CustomerPortalCustomerSummary[];
  hasOnboardingAccess: boolean;
  hasCustomerPortalAccess: boolean;
  isAuthenticated: boolean;
  role: AppRole;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  session: {
    id: string;
    expiresAt: string | null;
  } | null;
};
