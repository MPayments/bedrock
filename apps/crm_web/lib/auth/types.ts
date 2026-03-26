export type CrmRole = "admin" | "agent" | "customer";

export type UserSessionSnapshot = {
  isAuthenticated: boolean;
  role: CrmRole;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isAdmin?: boolean;
  } | null;
  session: {
    id: string;
    expiresAt: string | null;
  } | null;
};
