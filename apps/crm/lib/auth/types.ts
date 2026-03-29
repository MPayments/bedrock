export type CrmRole = "admin" | "agent" | "customer" | "finance" | "user" | null;

export type CustomerPortalCustomerSummary = {
  id: string;
  displayName: string;
  externalRef: string | null;
  description: string | null;
};

export type UserSessionSnapshot = {
  canAccessDashboard: boolean;
  customerPortalCustomers: CustomerPortalCustomerSummary[];
  hasCrmAccess: boolean;
  hasCustomerPortalAccess: boolean;
  isAuthenticated: boolean;
  role: CrmRole;
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
