export interface CustomerBootstrapClaim {
  clientId: number | null;
  createdAt: Date;
  customerId: string | null;
  id: string;
  normalizedInn: string;
  normalizedKpp: string;
  status: string;
  updatedAt: Date;
  userId: string;
}
